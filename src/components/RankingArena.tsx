'use client'

import { useRanker } from '../context/RankerContext'
import SwipeComparison from '../components/SwipeComparison'
import SongCard from '../components/SongCard'
import LiveRankings from '../components/LiveRankings'
import YouTube, { type YouTubePlayer } from '../lib/youtube'
import type { Track } from '../lib/types'
import { List, X } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVideoId(track: Track): string {
  return track.externalUrls?.youtube
    ? track.externalUrls.youtube.split('v=')[1]?.split('&')[0] || track.id
    : track.id
}

const PLAYER_OPTS = {
  height: '1',
  width: '1',
  playerVars: { autoplay: 1, playsinline: 1, controls: 0, disablekb: 1 },
}

const OFFSCREEN: React.CSSProperties = {
  position: 'absolute',
  top: -9999,
  left: -9999,
  visibility: 'hidden',
  pointerEvents: 'none',
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

  // ── Pool state ──────────────────────────────────────────────────────────────
  // Slots 0,1 = group-0 pair   Slots 2,3 = group-1 pair
  // activeGroup determines which pair the user currently sees.
  const [slots, setSlots] = useState<SlotState[]>([
    EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT,
  ])
  const slot0Ref = useRef<YouTubePlayer | null>(null)
  const slot1Ref = useRef<YouTubePlayer | null>(null)
  const slot2Ref = useRef<YouTubePlayer | null>(null)
  const slot3Ref = useRef<YouTubePlayer | null>(null)
  const slotRefs = [slot0Ref, slot1Ref, slot2Ref, slot3Ref]

  // Ref version avoids stale closures in async callbacks; state drives render
  const activeGroupRef = useRef<0 | 1>(0)
  const [activeGroup, setActiveGroupState] = useState<0 | 1>(0)
  const setActiveGroup = useCallback((g: 0 | 1) => {
    activeGroupRef.current = g
    setActiveGroupState(g)
  }, [])

  const initialized = useRef(false)

  // ── Pool helpers ────────────────────────────────────────────────────────────

  const updateSlot = useCallback(
    (idx: number, patch: Partial<SlotState>) =>
      setSlots((prev) => {
        const next = [...prev]
        next[idx] = { ...next[idx], ...patch }
        return next
      }),
    [],
  )

  const loadSlot = useCallback(
    (idx: number, track: Track, muted: boolean) => {
      const videoId = getVideoId(track)
      updateSlot(idx, {
        videoId,
        track,
        isLoading: true,
        isPlaying: false,
        hasError: false,
        isFallbackLoading: false,
        isFallback: false,
      })
      // Enforce volume immediately if the player is already initialised
      slotRefs[idx].current?.setVolume(muted ? 0 : 50)
    },
    [updateSlot], // slotRefs is stable (array of stable refs)
  )

  // ── Fallback search ─────────────────────────────────────────────────────────

  const handleSlotError = useCallback(
    async (slotIdx: number) => {
      setSlots((prev) => {
        const slot = prev[slotIdx]
        if (!slot.track || slot.isFallback) return prev  // already tried or no track

        const next = [...prev]
        next[slotIdx] = { ...slot, isFallbackLoading: true }
        return next
      })

      // Read current slot synchronously for the fetch
      setSlots((prev) => {
        const slot = prev[slotIdx]
        if (!slot.isFallbackLoading) return prev  // guard cleared above already

        const { title, artist } = slot.track!
        const params = new URLSearchParams({ title, artist })

        fetch(`/api/search?${params}`)
          .then((r) => r.json())
          .then(({ videoId }: { videoId: string | null }) => {
            if (videoId) {
              const g = activeGroupRef.current
              const isActive = g === 0 ? slotIdx <= 1 : slotIdx >= 2
              updateSlot(slotIdx, {
                videoId,
                isLoading: true,
                isFallbackLoading: false,
                isFallback: true,
                hasError: false,
              })
              if (!isActive) slotRefs[slotIdx].current?.setVolume(0)
            } else {
              updateSlot(slotIdx, {
                isLoading: false,
                hasError: true,
                isFallbackLoading: false,
              })
            }
          })
          .catch(() =>
            updateSlot(slotIdx, {
              isLoading: false,
              hasError: true,
              isFallbackLoading: false,
            }),
          )

        return prev  // no direct state change here — async path above handles it
      })
    },
    [updateSlot],
  )

  // ── Pool effects (declaration order = execution order within a render) ───────

  // 1. Init — runs once when the first currentPair arrives
  useEffect(() => {
    if (!currentPair || initialized.current) return
    loadSlot(0, currentPair[0], false)  // active left  (unmuted)
    loadSlot(1, currentPair[1], false)  // active right (unmuted)
    // Slots 2 & 3 are populated by the nextPair effect below in the same render
    initialized.current = true
  }, [currentPair, loadSlot])

  // 2. nextPair preload — keeps the idle slots warm with the upcoming pair
  useEffect(() => {
    if (!nextPair || !initialized.current) return
    const [pL, pR] = activeGroupRef.current === 0 ? [2, 3] : [0, 1]
    loadSlot(pL, nextPair[0], true)   // preload left  (muted)
    loadSlot(pR, nextPair[1], true)   // preload right (muted)
  }, [nextPair, loadSlot])

  // 3. Pair transition — promotes preloaded slots to active on each vote
  useEffect(() => {
    if (!currentPair || !initialized.current) return

    const newGroup: 0 | 1 = activeGroupRef.current === 0 ? 1 : 0
    const [aL, aR] = newGroup === 0 ? [0, 1] : [2, 3]
    const [pL, pR] = newGroup === 0 ? [2, 3] : [0, 1]

    // Promote: unmute the preloaded pair (they're already buffering)
    slotRefs[aL].current?.setVolume(50)
    slotRefs[aR].current?.setVolume(50)

    // Demote: silence the freed pair (nextPair effect will load new videos)
    slotRefs[pL].current?.setVolume(0)
    slotRefs[pR].current?.setVolume(0)

    setActiveGroup(newGroup)
  }, [currentPair, setActiveGroup])

  // 4. Per-slot state change handler
  const handleSlotStateChange = useCallback(
    (slotIdx: number, ytState: number) => {
      const g = activeGroupRef.current
      const isActive = g === 0 ? slotIdx <= 1 : slotIdx >= 2
      updateSlot(slotIdx, {
        isPlaying: ytState === 1,
        isLoading: ytState === -1 || ytState === 3,
      })
      if (ytState === 1) {
        // Enforce correct volume the moment the video starts playing
        slotRefs[slotIdx].current?.setVolume(isActive ? 50 : 0)
      }
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
      setActiveGroup(0)
      setSlots([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT])
    }
    prevCompletedRef.current = completedComparisons
  }, [completedComparisons, currentPair, setActiveGroup])

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
  const activeLeftIdx  = activeGroup === 0 ? 0 : 2
  const activeRightIdx = activeGroup === 0 ? 1 : 3

  const leftPlayerRef  = slotRefs[activeLeftIdx]
  const rightPlayerRef = slotRefs[activeRightIdx]

  const leftState  = slots[activeLeftIdx]
  const rightState = slots[activeRightIdx]

  const [trackA, trackB] = currentPair

  return (
    <div className='flex h-screen'>
      {/* ── Always-mounted pool players (4 iframes, always hidden) ── */}
      {slots.map((slot, i) =>
        slot.videoId ? (
          <div key={i} aria-hidden style={OFFSCREEN}>
            <YouTube
              videoId={slot.videoId}
              opts={PLAYER_OPTS}
              onReady={(e) => {
                slotRefs[i].current = e.target
                // Set initial volume based on whether this slot is active
                const g = activeGroupRef.current
                const isActive = g === 0 ? i <= 1 : i >= 2
                e.target.setVolume(isActive ? 50 : 0)
                e.target.playVideo()
              }}
              onStateChange={(e) => handleSlotStateChange(i, e.data)}
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
                  onClick={() => { undoLastVote(); setShowPause(false) }}
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
                    if (confirm('Restart ranking? All comparisons will be cleared.')) {
                      restartRanker()
                      setShowPause(false)
                    }
                  }}
                  className='w-full bg-red-500/20 hover:bg-red-500/40 text-white font-semibold py-3 rounded-lg transition-colors text-left px-4'
                >
                  ↺ Restart from Scratch
                </button>
                <button
                  onClick={() => { setShowPause(false); forceFinish() }}
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
    </div>
  )
}
