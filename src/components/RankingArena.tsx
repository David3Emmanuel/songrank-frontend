'use client'

import { useRanker } from '../context/RankerContext'
import SwipeComparison from '../components/SwipeComparison'
import SongCard from '../components/SongCard'
import LiveRankings from '../components/LiveRankings'
import PlayerDebugHud, { type DebugSlotRow } from '../components/PlayerDebugHud'
import LandingBackground from '../components/LandingBackground'
import YouTube from '../lib/youtube'
import {
  commandsForSlot,
  groupOfSlot,
  intentsForPool,
  isPlayerReady,
  nextGroup,
  previousGroup,
  SLOT_COUNT,
  type Group,
  readDuration,
  readPlayerSnapshot,
  runCommand,
  shouldHoldStart,
  slotsOfGroup,
  START_HOLD_TIMEOUT_MS,
  YT_UNKNOWN,
  type AppliedSlot,
  type PlaybackPhase,
  type PlayerHandle,
  type PlayerSnapshot,
  type SlotReadiness,
} from '../lib/playerSlots'
import type { Track } from '../lib/types'
import { sessionProgress } from '../lib/sessionProgress'
import { isSameSong } from '../lib/alternatives'
import { OFFSCREEN, PLAYER_OPTS } from '../lib/playerOptions'
import { List, ListChecks, Pause, Play, RotateCcw, Undo2, X } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { YouTubeEvent } from 'react-youtube'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVideoId(track: Track): string {
  return track.externalUrls?.youtube
    ? track.externalUrls.youtube.split('v=')[1]?.split('&')[0] || track.id
    : track.id
}

/**
 * `autoplay: 0` is load-bearing. react-youtube reads this flag to choose between
 * `loadVideoById` (plays immediately) and `cueVideoById` (buffers, silent) when
 * a `videoId` prop changes — see node_modules/react-youtube/dist/YouTube.esm.js.
 * With autoplay on, every preload started playing, so the off-screen pair was
 * audible-in-waiting and only the volume kept it quiet.
 */
/**
 * How many times a slot is reloaded for the same video before the pool gives up
 * on it and looks for a different one. A network fault usually clears on the
 * first remount; anything that survives two is not a blip.
 */
const MAX_RELOADS = 2



// ─── Player plumbing ──────────────────────────────────────────────────────────
//
// Module scope on purpose. Exactly one function owns "make the players match the
// intents", it reads the refs and drives the players, and it is the only place
// that calls play/pause/seek/volume on the pool.

const UNKNOWN_SNAPSHOT: PlayerSnapshot = {
  ytState: null,
  currentTime: null,
  volume: null,
}

function applySlotCommands(
  refs: Array<React.RefObject<PlayerHandle | null>>,
  applied: Array<AppliedSlot | null>,
  desired: AppliedSlot[],
  held: ReadonlySet<number>,
): Array<AppliedSlot | null> {
  const next = [...applied]
  for (let i = 0; i < desired.length; i++) {
    // A held slot is left exactly as it was, including its applied record, so the
    // next pass retries the start instead of believing it already played.
    if (held.has(i)) continue

    const player = refs[i]?.current
    if (!player) {
      // No player yet (never mounted, or torn down): nothing was applied.
      next[i] = null
      continue
    }
    const commands = commandsForSlot(applied[i], desired[i], readDuration(player))
    for (const command of commands) runCommand(player, command)
    next[i] = desired[i]
  }
  return next
}

const NOTHING_HELD: ReadonlySet<number> = new Set<number>()

function readPoolSnapshot(
  refs: Array<React.RefObject<PlayerHandle | null>>,
): PlayerSnapshot[] {
  return refs.map((ref) => readPlayerSnapshot(ref.current))
}

// ─── Client-only reads ────────────────────────────────────────────────────────
//
// Read through useSyncExternalStore so the server render and the first client
// render agree. An effect that set state would both mismatch hydration and trip
// the set-state-in-effect lint rule.

function subscribeNever(): () => void {
  return () => {}
}

function hasDebugFlag(flag: string): boolean {
  const value = new URLSearchParams(window.location.search).get('debug') ?? ''
  return value
    .split(',')
    .map((part) => part.trim())
    .includes(flag)
}

function readDebugFlag(): boolean {
  return hasDebugFlag('players')
}

function readFalse(): boolean {
  return false
}

function subscribeVisibility(onStoreChange: () => void): () => void {
  document.addEventListener('visibilitychange', onStoreChange)
  return () => document.removeEventListener('visibilitychange', onStoreChange)
}

function readVisible(): boolean {
  return document.visibilityState === 'visible'
}

function readVisibleOnServer(): boolean {
  return true
}

// ─── Pool types ───────────────────────────────────────────────────────────────

interface SlotState {
  videoId: string
  track: Track | null
  isLoading: boolean
  isPlaying: boolean
  hasError: boolean
  isFallbackLoading: boolean
  isFallback: boolean
  /** Last state the player reported; `YT_UNKNOWN` until it reports one. */
  ytState: number
  /** Bumped to remount this slot's player after a transient fault. */
  reloadKey: number
}

const EMPTY_SLOT: SlotState = {
  videoId: '',
  track: null,
  isLoading: true,
  isPlaying: false,
  hasError: false,
  isFallbackLoading: false,
  isFallback: false,
  ytState: YT_UNKNOWN,
  reloadKey: 0,
}

/**
 * A pool's worth of empty slots, sized from the pool's own count so the two
 * cannot drift apart, with a fresh object each so no slot shares another's state.
 */
const emptySlots = (): SlotState[] =>
  Array.from({ length: SLOT_COUNT }, () => ({ ...EMPTY_SLOT }))

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * One round control in the corner of the arena. Icon only, so the label is
 * carried in the tooltip and in the accessible name.
 */
function ArenaControl({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className='flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40'
    >
      {children}
    </button>
  )
}

export default function RankingArena() {
  const {
    currentPair,
    nextPair,
    submitVote,
    confidence,
    completedComparisons,
    comparisonCounts,
    forceFinish,
    rankings,
    tracks,
    undoLastVote,
    restartRanker,
    canUndo,
  } = useRanker()

  const [isPaused, setIsPaused] = useState(false)
  /** Whether the phone menu is open. Desktop shows the controls outright. */
  const [showControls, setShowControls] = useState(false)
  const [showRestartConfirm, setShowRestartConfirm] = useState(false)


  const [stopSuggestionDismissed, setStopSuggestionDismissed] = useState(false)

  // Two reasons for the whole pool to go quiet: the pause menu is open, or the
  // tab is not being looked at. A ranking session you walked away from should
  // not keep playing.
  const isTabVisible = useSyncExternalStore(
    subscribeVisibility,
    readVisible,
    readVisibleOnServer,
  )
  const debugEnabled = useSyncExternalStore(
    subscribeNever,
    readDebugFlag,
    readFalse,
  )
  const phase: PlaybackPhase =
    isPaused || !isTabVisible ? 'suspended' : 'active'

  // ── Pool state ──────────────────────────────────────────────────────────────
  // Three pairs of slots: the one on screen, the one ahead, the one behind.
  // activeGroup determines which pair the user currently sees.
  const [slots, setSlots] = useState<SlotState[]>(emptySlots())
  // Mirror of slots readable synchronously in async callbacks (no stale closure)
  const slotsRef = useRef<SlotState[]>(emptySlots())

  const slot0Ref = useRef<PlayerHandle | null>(null)
  const slot1Ref = useRef<PlayerHandle | null>(null)
  const slot2Ref = useRef<PlayerHandle | null>(null)
  const slot3Ref = useRef<PlayerHandle | null>(null)
  // Memoised so the array has a stable identity: it is what SongCard mixes with
  // during a swipe and a dependency of the reconcile below.
  const slotRefs = useMemo(
    () => [slot0Ref, slot1Ref, slot2Ref, slot3Ref],
    [slot0Ref, slot1Ref, slot2Ref, slot3Ref],
  )
  /** What was last applied to each player, so an unchanged slot costs nothing. */
  const appliedRef = useRef<Array<AppliedSlot | null>>([null, null, null, null])

  // Ref version avoids stale closures in async callbacks; state drives render
  const activeGroupRef = useRef<Group>(0)
  const [activeGroup, setActiveGroupState] = useState<Group>(0)
  const setActiveGroup = useCallback((g: Group) => {
    activeGroupRef.current = g
    setActiveGroupState(g)
  }, [])

  const initialized = useRef(false)

  // Tracks the pair seen by the transition effect so it can distinguish
  // "first pair arrived" (skip rotation) from "pair changed after a vote"
  const prevPairRef = useRef<[Track, Track] | null>(null)
  // Tracks completedComparisons at the last transition so we can tell
  // forward vote (count went up) from undo (count went down)
  const prevCompletedInTransitionRef = useRef(0)
  /**
   * What each slot has already tried: how many reloads for the video it holds,
   * which videos it has been through, and whether it ran out of candidates.
   */
  const reloadsRef = useRef<
    Array<{
      videoId: string
      attempts: number
      tried: string[]
      exhausted?: boolean
    }>
  >([])

  // ── Pool helpers ────────────────────────────────────────────────────────────

  const updateSlot = useCallback(
    (idx: number, patch: Partial<SlotState>) =>
      setSlots((prev) => {
        const next = [...prev]
        next[idx] = { ...next[idx], ...patch }
        slotsRef.current = next   // keep mirror in sync
        return next
      }),
    [],
  )

  const loadSlot = useCallback(
    (idx: number, track: Track) => {
      updateSlot(idx, {
        videoId: getVideoId(track),
        track,
        isLoading: true,
        isPlaying: false,
        hasError: false,
        isFallbackLoading: false,
        isFallback: false,
      })
      // Volume, playback and position are not decided here: the reconcile below
      // derives all three from the slot's intent, so there is exactly one owner.
    },
    [updateSlot],
  )

  // ── Fallback search ─────────────────────────────────────────────────────────

  const handleSlotError = useCallback(
    async (slotIdx: number, code?: number) => {
      const slot = slotsRef.current[slotIdx]

      if (!slot.track) {
        updateSlot(slotIdx, { isLoading: false, hasError: true, isFallbackLoading: false })
        return
      }

      // A player or network fault is worth another go at the same video. A video
      // that is gone, or that will not embed, is not: those want a different one,
      // which is what the search below is for. Codes 100, 101 and 150 are the
      // permanent ones; 2 and 5 are the player and HTML5 faults.
      const transient = code === undefined || code === 2 || code === 5
      const seen = reloadsRef.current[slotIdx]
      const attempts = seen && seen.videoId === slot.videoId ? seen.attempts : 0

      if (transient && attempts < MAX_RELOADS) {
        reloadsRef.current[slotIdx] = {
          videoId: slot.videoId,
          attempts: attempts + 1,
          tried: seen?.tried ?? [],
        }
        // The remounted player knows nothing, so forget what was applied to it.
        appliedRef.current[slotIdx] = null
        updateSlot(slotIdx, {
          isLoading: true,
          hasError: false,
          reloadKey: slot.reloadKey + 1,
        })
        return
      }

      // Out of retries on the fallback as well: nothing left to try.
      if (slot.isFallback && (seen?.exhausted ?? false)) {
        updateSlot(slotIdx, { isLoading: false, hasError: true, isFallbackLoading: false })
        return
      }

      updateSlot(slotIdx, { isFallbackLoading: true })

      const track = slot.track
      if (!track) {
        updateSlot(slotIdx, { isLoading: false, hasError: true, isFallbackLoading: false })
        return
      }

      const { title, artist } = track
      const tried = seen?.tried ?? []

      // The music search is asked first, and it is the only one that can see some
      // tracks at all: "XXX." on DAMN. comes back empty from the Data API under
      // every phrasing, while the music index lists it straight away. It also costs
      // no quota, so the Data API is only asked when this finds nothing.
      let candidates: string[] = []

      try {
        const music = await fetch(
          `/api/search-import?q=${encodeURIComponent(`${title} ${artist}`)}`,
        )
        if (music.ok) {
          const data: { tracks?: Track[] } = await music.json()
          // Only songs that are actually this one: a search for a title as plain
          // as "XXX." also returns other people's songs, and playing one of those
          // would put the wrong audio behind the right title.
          candidates = (data.tracks ?? [])
            .filter((song) => isSameSong(song, track))
            .map((song) => song.id)
        }
      } catch {
        // Fall through to the other index.
      }

      if (candidates.length === 0) {
        try {
          const params = new URLSearchParams({ title, artist })
          const r = await fetch(`/api/search?${params}`)
          const data: { videoIds?: string[] } = await r.json()
          candidates = data.videoIds ?? []
        } catch {
          candidates = []
        }
      }

      // One that has already been tried is never tried again: a slot that fails on
      // a video and is handed the same video back would loop rather than recover.
      {
        const next = candidates.find(
          (id) => id && id !== slot.videoId && !tried.includes(id),
        )

        if (next) {
          reloadsRef.current[slotIdx] = {
            videoId: next,
            attempts: 0,
            tried: [...tried, next],
          }
          updateSlot(slotIdx, {
            videoId: next,
            isLoading: true,
            isFallbackLoading: false,
            isFallback: true,
            hasError: false,
          })
        } else {
          reloadsRef.current[slotIdx] = {
            videoId: slot.videoId,
            attempts: seen?.attempts ?? 0,
            tried,
            exhausted: true,
          }
          updateSlot(slotIdx, { isLoading: false, hasError: true, isFallbackLoading: false })
        }
      }
    },
    [updateSlot],
  )

  // ── The single owner of play / pause / seek / volume ────────────────────────
  //
  // Everything else in this file decides *what* each slot should be doing. This
  // is the only thing that tells the players, and it is the only thing allowed
  // to — the pool used to enforce volume from four different places, and none of
  // them ever paused anything.
  const applyIntents = useCallback(
    (force = false): 'applied' | 'held' => {
      const current = slotsRef.current
      const intents = intentsForPool(activeGroup, phase)
      const desired: AppliedSlot[] = current.map((slot, index) => ({
        videoId: slot.videoId,
        intent: intents[index],
      }))

      // Both sides of a comparison start on the same tick, so neither gets a
      // head start. Holding is only about a pair that is *starting*: a swap of
      // one side mid-comparison has nothing to line up with.
      const [left, right] = slotsOfGroup(activeGroup)
      const isStarting = (index: number) => {
        const before = appliedRef.current[index]
        return (
          intents[index] === 'playing' &&
          (before?.intent !== 'playing' || before.videoId !== desired[index].videoId)
        )
      }
      const readinessOf = (index: number): SlotReadiness => ({
        ready: isPlayerReady(slotRefs[index]?.current ?? null, current[index].ytState),
        unavailable: current[index].hasError || !current[index].videoId,
      })

      const hold =
        !force &&
        isStarting(left) &&
        isStarting(right) &&
        shouldHoldStart([readinessOf(left), readinessOf(right)])

      appliedRef.current = applySlotCommands(
        slotRefs,
        appliedRef.current,
        desired,
        hold ? new Set([left, right]) : NOTHING_HELD,
      )

      return hold ? 'held' : 'applied'
    },
    [activeGroup, phase, slotRefs],
  )

  // ── Pool effects (declaration order = execution order within a render) ───────
  //
  // Correct order:
  //   1. Init          — loads slots 0,1 for the very first pair
  //   2. Transition    — rotates activeGroupRef BEFORE nextPair preload reads it
  //   3. nextPair pre  — reads the now-updated activeGroupRef to target freed slots

  // 1. Init — runs once when the first currentPair arrives
  useEffect(() => {
    if (!currentPair || initialized.current) return
    loadSlot(0, currentPair[0]) // active left
    loadSlot(1, currentPair[1]) // active right
    // Slots 2 & 3 are populated by the nextPair effect below in the same render
    initialized.current = true
  }, [currentPair, loadSlot])

  // 2. Pair transition — rotates the ring one way on a forward vote and the
  //    other way on an undo. Both are promotions: forward takes the pair that has
  //    been buffering ahead, undo takes the pair still buffered behind it, so an
  //    undo is instant rather than a reload.
  //    Must run BEFORE the nextPair preload effect so activeGroupRef is
  //    already rotated when the preload effect reads it.
  useEffect(() => {
    if (!currentPair || !initialized.current) return

    // First pair: record it and bail — init effect already set up slots 0,1
    if (!prevPairRef.current) {
      prevPairRef.current = currentPair
      prevCompletedInTransitionRef.current = completedComparisons
      return
    }

    // Same pair identity (shouldn't normally happen, but guard anyway)
    if (
      prevPairRef.current[0].id === currentPair[0].id &&
      prevPairRef.current[1].id === currentPair[1].id
    ) {
      return
    }

    const isForward = completedComparisons > prevCompletedInTransitionRef.current

    prevPairRef.current = currentPair
    prevCompletedInTransitionRef.current = completedComparisons

    if (isForward) {
      // Rotate: promote the pair that has been buffering off screen. Playback,
      // volume and position all follow from the new active group — the reconcile
      // at the end of this file applies them.
      setActiveGroup(nextGroup(activeGroupRef.current))
    } else {
      // Undo: the pair the session came from is still buffered in the previous
      // group, so rotating back promotes it rather than reloading it.
      setActiveGroup(previousGroup(activeGroupRef.current))
    }
  }, [currentPair, completedComparisons, setActiveGroup, loadSlot])

  // 3. nextPair preload — keeps the group ahead warm with the upcoming pair.
  //    Runs AFTER the transition effect so activeGroupRef reflects the new
  //    group and we load into the just-freed (not just-promoted) slots.
  useEffect(() => {
    if (!nextPair || !initialized.current) return
    const [pL, pR] = slotsOfGroup(nextGroup(activeGroupRef.current))
    loadSlot(pL, nextPair[0])
    loadSlot(pR, nextPair[1])
  }, [nextPair, loadSlot])

  // 4. Per-slot state change handler
  const handleSlotStateChange = useCallback(
    (slotIdx: number, ytState: number) => {
      // Reporting only. A player's own state change must never be the thing that
      // decides whether it *should* be playing — that is the reconcile's job.
      updateSlot(slotIdx, {
        isPlaying: ytState === 1,
        isLoading: ytState === -1 || ytState === 3,
        ytState,
      })
    },
    [updateSlot],
  )

  // ── Restart / undo pool reset ───────────────────────────────────────────────
  /**
   * Throws the pool away for a fresh session.
   *
   * Not just a re-cue: a restarted session can open with the same two videos, and
   * a player that already holds one would resume it part way through.
   *
   * Called from the two paths that can empty a session, restart and undo, rather
   * than from an effect watching the count. Nothing else reduces it, and setting
   * state from an effect costs a second render that the reconcile below could not
   * use anyway.
   */
  const resetPool = useCallback(() => {
    initialized.current = false
    prevPairRef.current = null
    prevCompletedInTransitionRef.current = 0
    setActiveGroup(0)
    const empty = emptySlots()
    slotsRef.current = empty
    setSlots(empty)
  }, [setActiveGroup])

  /** Undoing the last remaining pick empties the session, so reset the pool too. */
  const undo = useCallback(() => {
    if (completedComparisons <= 1) resetPool()
    undoLastVote()
  }, [completedComparisons, resetPool, undoLastVote])

  const controls = [
    {
      key: 'pause',
      label: isPaused ? 'Play' : 'Pause',
      onClick: () => setIsPaused((value) => !value),
      disabled: false,
      icon: isPaused ? <Play size={20} /> : <Pause size={20} />,
    },
    {
      key: 'undo',
      label: 'Undo last pick',
      onClick: undo,
      disabled: !canUndo,
      icon: <Undo2 size={20} />,
    },
    {
      key: 'restart',
      label: 'Start over',
      onClick: () => setShowRestartConfirm(true),
      disabled: false,
      icon: <RotateCcw size={20} />,
    },
    {
      key: 'results',
      label: 'See my results',
      onClick: forceFinish,
      disabled: false,
      icon: <ListChecks size={20} />,
    },
  ]

  // 5. Reconcile — the only place the players are told what to do.
  //    Runs last, once the effects above have settled the pool's shape for this
  //    render. Keyed on the video ids as well as the group, because a track that
  //    lands in the same slot twice in a row must still be re-applied.
  const slotKey = slots.map((slot) => slot.videoId).join('|')
  // Player states, so a slot reporting itself loaded re-runs the reconcile and
  // lets a held comparison start.
  const readinessKey = slots.map((slot) => slot.ytState).join('|')
  useEffect(() => {
    const outcome = applyIntents()
    if (outcome !== 'held') return
    // Backstop: a side that never reports itself ready must not silence the
    // pair. After the timeout the start goes ahead regardless.
    const id = setTimeout(() => applyIntents(true), START_HOLD_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [applyIntents, slotKey, readinessKey])

  // 6. Debug HUD sampling, only while the HUD is on screen.
  const [snapshot, setSnapshot] = useState<PlayerSnapshot[]>([
    UNKNOWN_SNAPSHOT,
    UNKNOWN_SNAPSHOT,
    UNKNOWN_SNAPSHOT,
    UNKNOWN_SNAPSHOT,
  ])
  useEffect(() => {
    if (!debugEnabled) return
    const id = setInterval(() => setSnapshot(readPoolSnapshot(slotRefs)), 250)
    return () => clearInterval(id)
  }, [debugEnabled, slotRefs])

  // 7. Order logging, behind `?debug=order`.
  //
  // Written to answer one question during a test session: at which vote did the
  // order last change, and did that include the top three? It keeps a running
  // answer so the last console line is the summary, with no screenshots to
  // transcribe.
  const orderLogEnabled = useSyncExternalStore(
    subscribeNever,
    () => hasDebugFlag('order'),
    readFalse,
  )
  const lastOrderChangeRef = useRef({ top3: 0, all: 0 })
  const previousOrderRef = useRef<string[] | null>(null)

  useEffect(() => {
    if (!orderLogEnabled) return

    const order = [...rankings]
      .sort((a, b) => b.Score - a.Score)
      .map((row) => row.Song)
    if (order.length === 0) return

    const previous = previousOrderRef.current
    if (previous) {
      if (previous.slice(0, 3).join('|') !== order.slice(0, 3).join('|')) {
        lastOrderChangeRef.current.top3 = completedComparisons
      }
      if (previous.join('|') !== order.join('|')) {
        lastOrderChangeRef.current.all = completedComparisons
      }
    }
    previousOrderRef.current = order

    const { top3, all } = lastOrderChangeRef.current
    console.log(
      `[order] after vote #${completedComparisons} — last changes: top3 @${top3 || '—'}, whole order @${all || '—'}`,
    )
    console.log(
      order
        .map((id, index) => {
          const track = tracks.find((t) => t.id === id)
          return `  ${index + 1}. ${track?.title ?? id}`
        })
        .join('\n'),
    )
  }, [orderLogEnabled, completedComparisons, rankings, tracks])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPaused((v) => !v)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && canUndo) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canUndo, undo])

  if (!currentPair) return null

  // ── Derive active refs & states for the visible pair ───────────────────────
  const [activeLeftIdx, activeRightIdx] = slotsOfGroup(activeGroup)

  const leftPlayerRef = slotRefs[activeLeftIdx]
  const rightPlayerRef = slotRefs[activeRightIdx]

  const leftState = slots[activeLeftIdx]
  const rightState = slots[activeRightIdx]

  const [trackA, trackB] = currentPair

  const intents = intentsForPool(activeGroup, phase)
  const progress = sessionProgress(tracks.length, completedComparisons)
  const showStopSuggestion =
    progress.suggestStop && !stopSuggestionDismissed && !isPaused
  const debugRows: DebugSlotRow[] = slots.map((slot, index) => ({
    index,
    group: groupOfSlot(index),
    title: slot.track?.title ?? '',
    videoId: slot.videoId,
    isFallback: slot.isFallback,
    intent: intents[index],
    ytState: snapshot[index]?.ytState ?? null,
    currentTime: snapshot[index]?.currentTime ?? null,
    volume: snapshot[index]?.volume ?? null,
  }))

  return (
    <div className='relative flex h-screen overflow-hidden bg-gradient-to-b from-white to-sky-50'>
      <LandingBackground />

      {/* ── Always-mounted pool players, always hidden ──
          The key carries the reload counter: remounting is how a slot recovers
          from a transient fault, since react-youtube only reloads on a changed
          videoId and the video here is deliberately the same one. */}
      {slots.map((slot, i) =>
        slot.videoId ? (
          <div key={`${i}-${slot.reloadKey}`} aria-hidden style={OFFSCREEN}>
            <YouTube
              videoId={slot.videoId}
              opts={PLAYER_OPTS}
              onReady={(e: YouTubeEvent) => {
                slotRefs[i].current = e.target as unknown as PlayerHandle
                // A player that has just been created has had nothing applied to
                // it: the props cued the video, and the pool has to say play.
                appliedRef.current[i] = null
                applyIntents()
              }}
              onStateChange={(e: YouTubeEvent) =>
                handleSlotStateChange(i, e.data)
              }
              onError={(e: YouTubeEvent<number>) =>
                handleSlotError(i, e.data)
              }
            />
          </div>
        ) : null,
      )}

      {/* ── Main Ranking Area ── */}
      <div className='flex-1 relative'>
        {/* Controls. A visible row on desktop; on a phone the same icons sit in
            a column under a menu button that turns into a close cross. Restart is
            destructive, so it confirms in a dialog rather than acting outright. */}
        {/* Tapping anywhere else puts the phone menu away. Sits below the
            controls so the buttons still take their own taps. */}
        {showControls && (
          <div
            className='fixed inset-0 z-40 md:hidden'
            onClick={() => setShowControls(false)}
            aria-hidden
          />
        )}

        <div className='absolute top-4 left-4 z-50'>
          <div className='hidden md:flex items-center gap-2'>
            {/* eslint-disable-next-line react-hooks/refs -- these handlers run from
                a tap, not while rendering. The compiler cannot see that through the
                array, so it assumes the worst. */}
            {controls.map((control) => (
              <ArenaControl
                key={control.key}
                label={control.label}
                onClick={control.onClick}
                disabled={control.disabled}
              >
                {control.icon}
              </ArenaControl>
            ))}
          </div>

          <div className='flex flex-col items-start gap-2 md:hidden'>
            <button
              onClick={() => setShowControls((value) => !value)}
              className='w-12 h-12 rounded-full bg-white/80 backdrop-blur-md border border-slate-200 flex items-center justify-center hover:bg-white shadow-sm transition-colors'
              aria-label={showControls ? 'Close menu' : 'Open menu'}
              aria-expanded={showControls}
            >
              {showControls ? (
                <X size={24} className='text-slate-600' />
              ) : (
                <List size={24} className='text-slate-600' />
              )}
            </button>

            {showControls &&
              // eslint-disable-next-line react-hooks/refs -- as above
              controls.map((control) => (
                <ArenaControl
                  key={control.key}
                  label={control.label}
                  onClick={() => {
                    control.onClick()
                    // The work is done, so get out of the way.
                    if (control.key !== 'pause') setShowControls(false)
                  }}
                  disabled={control.disabled}
                >
                  {control.icon}
                </ArenaControl>
              ))}
          </div>
        </div>

        {/* Mobile: full-width confidence bar */}
        <div className='md:hidden absolute top-0 left-0 right-0 z-50 h-0.5 bg-slate-200 pointer-events-none'>
          <div
            className='h-full bg-linear-to-r from-amber-500 to-emerald-500 transition-all duration-500'
            style={{ width: `${confidence * 100}%` }}
          />
        </div>

        {/* Desktop: the session's progress, as a bar with no reading to interpret */}
        <div className='hidden md:flex absolute top-4 right-4 z-50 flex-col items-end gap-2 pointer-events-none'>
          <div className='bg-white/80 backdrop-blur-md border border-slate-200 rounded-full px-4 py-2 text-slate-700 text-sm shadow-sm'>
            {completedComparisons} {completedComparisons === 1 ? 'pick' : 'picks'}
          </div>
          <div
            role='progressbar'
            aria-label='Ranking confidence'
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(confidence * 100)}
            className='bg-white/80 backdrop-blur-md border border-slate-200 rounded-full px-4 py-3 shadow-sm'
          >
            <div className='w-32 h-2 bg-slate-200 rounded-full overflow-hidden'>
              <div
                className='h-full bg-linear-to-r from-amber-500 to-emerald-500 transition-all duration-500'
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* A natural place to stop, offered once and dismissible */}
        {showStopSuggestion && (
          <div className='absolute right-4 top-24 z-40 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-emerald-200 bg-white/95 p-3 shadow-lg backdrop-blur-md'>
            <p className='text-sm text-slate-700'>
              Good point to wrap up. Want to see where it landed?
            </p>
            <div className='mt-3 flex gap-2'>
              <button
                onClick={forceFinish}
                className='flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800'
              >
                Finish
              </button>
              <button
                onClick={() => setStopSuggestionDismissed(true)}
                className='flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200'
              >
                Keep going
              </button>
            </div>
          </div>
        )}

        {/* Starting over throws away every pick, so it asks first */}
        {showRestartConfirm && (
          <div
            className='fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm'
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setShowRestartConfirm(false)
              }
            }}
          >
            <div className='mx-4 w-full max-w-sm rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-xl'>
              <h2 className='text-lg font-bold text-slate-900'>Start over?</h2>
              <p className='mt-2 text-sm text-slate-600'>
                This clears all {completedComparisons} pick
                {completedComparisons !== 1 ? 's' : ''} and starts the ranking
                again from the first pair.
              </p>
              <div className='mt-5 flex gap-3'>
                <button
                  onClick={() => setShowRestartConfirm(false)}
                  className='flex-1 rounded-lg bg-slate-100 py-2.5 font-semibold text-slate-700 transition-colors hover:bg-slate-200'
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    restartRanker()
                    resetPool()
                    setShowRestartConfirm(false)
                    setIsPaused(false)
                  }}
                  className='flex-1 rounded-lg bg-rose-600 py-2.5 font-semibold text-white transition-colors hover:bg-rose-700'
                >
                  Start over
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Swipe Interface */}
        <SwipeComparison
          leftCard={
            <SongCard
              track={trackA}
              side='left'
              playerRef={leftPlayerRef}
              isLoading={leftState.isLoading}
              isPlaying={leftState.isPlaying}
              isFallbackLoading={leftState.isFallbackLoading}
              hasError={leftState.hasError}
            />
          }
          rightCard={
            <SongCard
              track={trackB}
              side='right'
              playerRef={rightPlayerRef}
              isLoading={rightState.isLoading}
              isPlaying={rightState.isPlaying}
              isFallbackLoading={rightState.isFallbackLoading}
              hasError={rightState.hasError}
            />
          }
          onVote={submitVote}
        />
      </div>

      {/* Live Rankings Sidebar */}
      <LiveRankings
        rankings={rankings}
        tracks={tracks}
        completedComparisons={completedComparisons}
        comparisonCounts={comparisonCounts}
      />

      {/* Pool state, when asked for with ?debug=players */}
      {debugEnabled && (
        <PlayerDebugHud
          rows={debugRows}
          activeGroup={activeGroup}
          phase={phase}
        />
      )}
    </div>
  )
}
