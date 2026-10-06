'use client'

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react'
import { PlaylistRanker } from '../lib/PlaylistRanker'
import type { Track, Feedback, SongRanking } from '../lib/types'

interface RankerContextValue {
  ranker: PlaylistRanker | null
  tracks: Track[]
  playlistName: string
  currentPair: [Track, Track] | null
  nextPair: [Track, Track] | null
  rankings: SongRanking[]
  confidence: number
  completedComparisons: number
  /** Comparisons per song id. Absent means never compared. */
  comparisonCounts: Record<string, number>
  isComplete: boolean
  canUndo: boolean

  // Actions
  initializeRanker: (tracks: Track[], playlistName?: string) => void
  submitVote: (feedback: Feedback) => void
  resetRanker: () => void
  forceFinish: () => void
  undoLastVote: () => void
  restartRanker: () => void
}

const RankerContext = createContext<RankerContextValue | null>(null)

/** Resolve a pair of song ids to tracks, or null if either one is missing. */
function pairFromIds(
  ids: [string, string] | null,
  trackList: Track[],
): [Track, Track] | null {
  if (!ids) return null
  const a = trackList.find((t) => t.id === ids[0])
  const b = trackList.find((t) => t.id === ids[1])
  return a && b ? [a, b] : null
}

export function RankerProvider({ children }: { children: React.ReactNode }) {
  const [ranker, setRanker] = useState<PlaylistRanker | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [playlistName, setPlaylistName] = useState('')
  const [currentPair, setCurrentPair] = useState<[Track, Track] | null>(null)
  const [nextPair, setNextPair] = useState<[Track, Track] | null>(null)
  const [pairHistory, setPairHistory] = useState<[Track, Track][]>([])
  const [rankings, setRankings] = useState<SongRanking[]>([])
  const [confidence, setConfidence] = useState(0)
  const [completedComparisons, setCompletedComparisons] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  // Commit the pair for the round after this one so the pool can preload it.
  //
  // This has to be a commitment rather than a guess. getNextPair() picks its
  // pair with weighted randomness, so calling it twice for the same history
  // returns two different pairs. The pool preloads whatever is committed here
  // and promotes it a round later, so a second speculative draw meant the
  // audible pair was almost never the pair on screen.
  const commitNextPair = useCallback(
    (r: PlaylistRanker, trackList: Track[]) => {
      setNextPair(pairFromIds(r.getNextPair(), trackList))
    },
    [],
  )

  const initializeRanker = useCallback((trackList: Track[], name?: string) => {
    if (trackList.length < 2) {
      throw new Error('Need at least 2 tracks to rank')
    }

    const songIds = trackList.map((t) => t.id)
    const newRanker = new PlaylistRanker(songIds)

    setRanker(newRanker)
    setTracks(trackList)
    setPlaylistName(name ?? '')
    setCompletedComparisons(0)
    setIsComplete(false)
    setPairHistory([])

    // Get first pair
    const pair = pairFromIds(newRanker.getNextPair(), trackList)
    if (pair) {
      setCurrentPair(pair)
      commitNextPair(newRanker, trackList)
    }

    // Initial rankings
    setRankings(newRanker.computeRankings())
    setConfidence(newRanker.getConfidence())
  }, [commitNextPair])

  const submitVote = useCallback(
    (feedback: Feedback) => {
      if (!ranker || !currentPair) return

      const [trackA, trackB] = currentPair

      // Push current pair onto history stack before advancing (enables undo)
      setPairHistory((prev) => [...prev, currentPair])

      // Record the vote
      ranker.addSwipe(trackA.id, trackB.id, feedback)

      // Update state
      setCompletedComparisons((prev) => prev + 1)

      // Compute new rankings
      const newRankings = ranker.computeRankings()
      setRankings(newRankings)

      // Update confidence
      const newConfidence = ranker.getConfidence()
      setConfidence(newConfidence)

      // Check if we should finish (high confidence threshold)
      if (newConfidence >= 0.85) {
        setIsComplete(true)
        setCurrentPair(null)
        return
      }

      // Show the pair already committed for this round, so the group the pool
      // has preloaded is the group it promotes. Only a restored session or an
      // undo arrives here without one.
      const upcoming = nextPair ?? pairFromIds(ranker.getNextPair(), tracks)
      if (!upcoming) {
        setIsComplete(true)
        setCurrentPair(null)
        setNextPair(null)
        return
      }

      setCurrentPair(upcoming)
      commitNextPair(ranker, tracks)
    },
    [ranker, currentPair, tracks, nextPair, commitNextPair],
  )

  const forceFinish = useCallback(() => {
    if (!ranker) return

    const finalRankings = ranker.computeRankings()
    setRankings(finalRankings)
    setIsComplete(true)
    setCurrentPair(null)
  }, [ranker])

  const resetRanker = useCallback(() => {
    setRanker(null)
    setTracks([])
    setCurrentPair(null)
    setNextPair(null)
    setPairHistory([])
    setRankings([])
    setConfidence(0)
    setCompletedComparisons(0)
    setIsComplete(false)
  }, [])

  const undoLastVote = useCallback(() => {
    if (!ranker || pairHistory.length === 0) return

    ranker.undoLastComparison()
    const previousPair = pairHistory[pairHistory.length - 1]
    setPairHistory((prev) => prev.slice(0, -1))
    setCurrentPair(previousPair)
    // The pair being undone is exactly what comes next this time, so commit it
    // rather than drawing a fresh one: undo becomes a step back, and re-voting
    // replays the same round instead of a random one.
    setNextPair(currentPair)
    setCompletedComparisons((c) => Math.max(0, c - 1))
    setIsComplete(false)
    setRankings(ranker.computeRankings())
    setConfidence(ranker.getConfidence())
  }, [ranker, pairHistory, currentPair])

  const restartRanker = useCallback(() => {
    if (tracks.length === 0) return
    initializeRanker(tracks, playlistName)
  }, [tracks, playlistName, initializeRanker])

  // Persist state to sessionStorage
  useEffect(() => {
    if (ranker && tracks.length > 0) {
      const state = {
        rankerState: ranker.exportState(),
        tracks,
        playlistName,
        completedComparisons,
        confidence,
        isComplete,
      }
      sessionStorage.setItem('songrank-session', JSON.stringify(state))
    }
  }, [ranker, tracks, playlistName, completedComparisons, confidence, isComplete])

  // Restore state on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem('songrank-session')
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        const restoredRanker = new PlaylistRanker()
        restoredRanker.loadState(
          parsed.rankerState.songs,
          parsed.rankerState.history,
        )

        setRanker(restoredRanker)
        setTracks(parsed.tracks)
        setPlaylistName(parsed.playlistName ?? '')
        setCompletedComparisons(parsed.completedComparisons)
        setConfidence(parsed.confidence)
        setIsComplete(parsed.isComplete)

        if (!parsed.isComplete) {
          const pair = pairFromIds(restoredRanker.getNextPair(), parsed.tracks)
          if (pair) {
            setCurrentPair(pair)
            // Commit the following pair too, or the pool starts this session
            // with nothing preloaded.
            setNextPair(pairFromIds(restoredRanker.getNextPair(), parsed.tracks))
          }
        }

        setRankings(restoredRanker.computeRankings())
      } catch (error) {
        console.error('Failed to restore session:', error)
        sessionStorage.removeItem('songrank-session')
      }
    }
  }, [])

  const canUndo = completedComparisons > 0

  // A song with no comparisons scores 0, and so does one that was compared and
  // landed on 0. Screens need the count to tell those apart.
  const comparisonCounts = useMemo(
    () => ranker?.getComparisonCounts() ?? {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ranker, completedComparisons],
  )

  const value: RankerContextValue = {
    ranker,
    tracks,
    playlistName,
    currentPair,
    nextPair,
    rankings,
    confidence,
    completedComparisons,
    comparisonCounts,
    isComplete,
    canUndo,
    initializeRanker,
    submitVote,
    resetRanker,
    forceFinish,
    undoLastVote,
    restartRanker,
  }

  return (
    <RankerContext.Provider value={value}>{children}</RankerContext.Provider>
  )
}

export function useRanker() {
  const context = useContext(RankerContext)
  if (!context) {
    throw new Error('useRanker must be used within a RankerProvider')
  }
  return context
}
