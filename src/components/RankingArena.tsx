'use client'

import { useRanker } from '../context/RankerContext'
import SwipeComparison from '../components/SwipeComparison'
import SongCard from '../components/SongCard'
import LiveRankings from '../components/LiveRankings'
import PlayerDebugHud, { type DebugSlotRow } from '../components/PlayerDebugHud'
import YouTube from '../lib/youtube'
import {
  commandsForSlot,
  groupOfSlot,
  intentsForPool,
  otherGroup,
  readCurrentTime,
  readPlayerSnapshot,
  runCommand,
  slotsOfGroup,
  type AppliedSlot,
  type PlaybackPhase,
  type PlayerHandle,
  type PlayerSnapshot,
} from '../lib/playerSlots'
import type { Track } from '../lib/types'
import { List, X } from 'lucide-react'
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
const PLAYER_OPTS = {
  height: '1',
  width: '1',
  playerVars: { autoplay: 0, playsinline: 1, controls: 0, disablekb: 1 },
}

const OFFSCREEN: React.CSSProperties = {
  position: 'absolute',
  top: -9999,
  left: -9999,
  visibility: 'hidden',
  pointerEvents: 'none',
}

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
): Array<AppliedSlot | null> {
  const next = [...applied]
  for (let i = 0; i < desired.length; i++) {
    const player = refs[i]?.current
    if (!player) {
      // No player yet (never mounted, or torn down): nothing was applied.
      next[i] = null
      continue
    }
    const commands = commandsForSlot(
      applied[i],
      desired[i],
      readCurrentTime(player),
    )
    for (const command of commands) runCommand(player, command)
    next[i] = desired[i]
  }
  return next
}

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

function readDebugFlag(): boolean {
  return new URLSearchParams(window.location.search).get('debug') === 'players'
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
}

const EMPTY_SLOT: SlotState = {
  videoId: '',
  track: null,
  isLoading: true,
  isPlaying: false,
  hasError: false,
  isFallbackLoading: false,
  isFallback: false,
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RankingArena() {
  const {
    currentPair,
    nextPair,
    submitVote,
    confidence,
    completedComparisons,
    forceFinish,
    rankings,
    tracks,
    undoLastVote,
    restartRanker,
    canUndo,
  } = useRanker()

  const [showPause, setShowPause] = useState(false)

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
    showPause || !isTabVisible ? 'suspended' : 'active'

  // ── Pool state ──────────────────────────────────────────────────────────────
  // Slots 0,1 = group-0 pair   Slots 2,3 = group-1 pair
  // activeGroup determines which pair the user currently sees.
  const [slots, setSlots] = useState<SlotState[]>([
    EMPTY_SLOT,
    EMPTY_SLOT,
    EMPTY_SLOT,
    EMPTY_SLOT,
  ])
  // Mirror of slots readable synchronously in async callbacks (no stale closure)
  const slotsRef = useRef<SlotState[]>([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT])

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
  const activeGroupRef = useRef<0 | 1>(0)
  const [activeGroup, setActiveGroupState] = useState<0 | 1>(0)
  const setActiveGroup = useCallback((g: 0 | 1) => {
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
    async (slotIdx: number) => {
      const slot = slotsRef.current[slotIdx]

      // Already tried fallback or no track — mark as error and bail
      if (!slot.track || slot.isFallback) {
        updateSlot(slotIdx, { isLoading: false, hasError: true, isFallbackLoading: false })
        return
      }

      updateSlot(slotIdx, { isFallbackLoading: true })

      const { title, artist } = slot.track
      const params = new URLSearchParams({ title, artist })

      try {
        const r = await fetch(`/api/search?${params}`)
        const { videoId }: { videoId: string | null } = await r.json()

        if (videoId) {
          updateSlot(slotIdx, {
            videoId,
            isLoading: true,
            isFallbackLoading: false,
            isFallback: true,
            hasError: false,
          })
        } else {
          updateSlot(slotIdx, { isLoading: false, hasError: true, isFallbackLoading: false })
        }
      } catch {
        updateSlot(slotIdx, { isLoading: false, hasError: true, isFallbackLoading: false })
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
  const applyIntents = useCallback(() => {
    const intents = intentsForPool(activeGroup, phase)
    const desired: AppliedSlot[] = slotsRef.current.map((slot, index) => ({
      videoId: slot.videoId,
      intent: intents[index],
    }))
    appliedRef.current = applySlotCommands(slotRefs, appliedRef.current, desired)
  }, [activeGroup, phase, slotRefs])

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

  // 2. Pair transition — promotes preloaded slots to active on each forward
  //    vote, or reloads active slots directly on undo.
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
      setActiveGroup(otherGroup(activeGroupRef.current))
    } else {
      // Undo: reload the currently active slots with the restored pair directly,
      // no group rotation needed
      const [aL, aR] = slotsOfGroup(activeGroupRef.current)
      loadSlot(aL, currentPair[0])
      loadSlot(aR, currentPair[1])
    }
  }, [currentPair, completedComparisons, setActiveGroup, loadSlot])

  // 3. nextPair preload — keeps the idle slots warm with the upcoming pair.
  //    Runs AFTER the transition effect so activeGroupRef reflects the new
  //    group and we load into the just-freed (not just-promoted) slots.
  useEffect(() => {
    if (!nextPair || !initialized.current) return
    const [pL, pR] = slotsOfGroup(otherGroup(activeGroupRef.current))
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
      })
    },
    [updateSlot],
  )

  // ── Restart / undo pool reset ───────────────────────────────────────────────
  // When the ranker restarts (completedComparisons drops back to 0 while a
  // pair is present), the pool must be re-initialised.
  const prevCompletedRef = useRef(completedComparisons)
  useEffect(() => {
    if (
      completedComparisons === 0 &&
      prevCompletedRef.current > 0 &&
      currentPair
    ) {
      initialized.current = false
      prevPairRef.current = null
      prevCompletedInTransitionRef.current = 0
      setActiveGroup(0)
      const empty: SlotState[] = [EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]
      slotsRef.current = empty
      setSlots(empty)
    }
    prevCompletedRef.current = completedComparisons
  }, [completedComparisons, currentPair, setActiveGroup])

  // 5. Reconcile — the only place the players are told what to do.
  //    Runs last, once the effects above have settled the pool's shape for this
  //    render. Keyed on the video ids as well as the group, because a track that
  //    lands in the same slot twice in a row must still be re-applied.
  const slotKey = slots.map((slot) => slot.videoId).join('|')
  useEffect(() => {
    applyIntents()
  }, [applyIntents, slotKey])

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

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPause((v) => !v)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && canUndo) {
        e.preventDefault()
        undoLastVote()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canUndo, undoLastVote])

  if (!currentPair) return null

  // ── Derive active refs & states for the visible pair ───────────────────────
  const [activeLeftIdx, activeRightIdx] = slotsOfGroup(activeGroup)

  const leftPlayerRef = slotRefs[activeLeftIdx]
  const rightPlayerRef = slotRefs[activeRightIdx]

  const leftState = slots[activeLeftIdx]
  const rightState = slots[activeRightIdx]

  const [trackA, trackB] = currentPair

  const intents = intentsForPool(activeGroup, phase)
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
    <div className='flex h-screen'>
      {/* ── Always-mounted pool players (4 iframes, always hidden) ── */}
      {slots.map((slot, i) =>
        slot.videoId ? (
          <div key={i} aria-hidden style={OFFSCREEN}>
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
              onError={() => handleSlotError(i)}
            />
          </div>
        ) : null,
      )}

      {/* ── Main Ranking Area ── */}
      <div className='flex-1 relative'>
        {/* Pause Menu Button */}
        <button
          onClick={() => setShowPause(!showPause)}
          className='absolute top-4 left-4 z-50 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/30 flex items-center justify-center hover:bg-white/20 transition-colors'
          aria-label='Menu'
        >
          {showPause ? (
            <X size={24} className='text-white' />
          ) : (
            <List size={24} className='text-white' />
          )}
        </button>

        {/* Mobile: full-width confidence bar */}
        <div className='md:hidden absolute top-0 left-0 right-0 z-50 h-0.5 bg-white/10 pointer-events-none'>
          <div
            className='h-full bg-linear-to-r from-yellow-500 to-green-500 transition-all duration-500'
            style={{ width: `${confidence * 100}%` }}
          />
        </div>

        {/* Desktop: labelled pills */}
        <div className='hidden md:flex absolute top-4 right-4 z-50 flex-col items-end gap-2 pointer-events-none'>
          <div className='bg-white/10 backdrop-blur-md border border-white/30 rounded-full px-4 py-2 text-white text-sm'>
            Comparisons: {completedComparisons}
          </div>
          <div className='bg-white/10 backdrop-blur-md border border-white/30 rounded-full px-4 py-2 flex items-center gap-2'>
            <span className='text-white text-sm'>Confidence:</span>
            <div className='w-24 h-2 bg-white/20 rounded-full overflow-hidden'>
              <div
                className='h-full bg-linear-to-r from-yellow-500 to-green-500 transition-all duration-500'
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
            <span className='text-white text-sm font-bold'>
              {Math.round(confidence * 100)}%
            </span>
          </div>
        </div>

        {/* Pause Overlay */}
        {showPause && (
          <div className='absolute inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center'>
            <div className='bg-slate-900/95 backdrop-blur-md rounded-2xl p-8 max-w-md w-full mx-4 border border-white/20'>
              <h2 className='text-2xl font-bold text-white mb-4'>Paused</h2>
              <p className='text-white/70 mb-6'>
                You&apos;ve completed {completedComparisons} comparisons.
                Current confidence: {Math.round(confidence * 100)}%
              </p>
              <div className='flex flex-col gap-3'>
                <button
                  onClick={() => setShowPause(false)}
                  className='w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg transition-colors'
                >
                  Resume Ranking
                </button>
                <button
                  onClick={() => {
                    undoLastVote()
                    setShowPause(false)
                  }}
                  disabled={!canUndo}
                  className='w-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-left px-4'
                >
                  ↩ Undo Last Swipe
                  {canUndo && (
                    <span className='float-right text-white/50 text-xs font-normal mt-0.5'>
                      Ctrl+Z
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        'Restart ranking? All comparisons will be cleared.',
                      )
                    ) {
                      restartRanker()
                      setShowPause(false)
                    }
                  }}
                  className='w-full bg-red-500/20 hover:bg-red-500/40 text-white font-semibold py-3 rounded-lg transition-colors text-left px-4'
                >
                  ↺ Restart from Scratch
                </button>
                <button
                  onClick={() => {
                    setShowPause(false)
                    forceFinish()
                  }}
                  className='w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors'
                >
                  Finish & View Results
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
