'use client'

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react'
import { PlaylistRanker } from '../lib/PlaylistRanker'
import type { Track, Feedback, RankerState, SongRanking } from '../lib/types'

interface RankerContextValue {
  ranker: PlaylistRanker | null
  tracks: Track[]
  currentPair: [Track, Track] | null
  rankings: SongRanking[]
  confidence: number
  completedComparisons: number
  isComplete: boolean

  // Actions
  initializeRanker: (tracks: Track[]) => void
  submitVote: (feedback: Feedback) => void
  resetRanker: () => void
  forceFinish: () => void
}

const RankerContext = createContext<RankerContextValue | null>(null)

export function RankerProvider({ children }: { children: React.ReactNode }) {
  const [ranker, setRanker] = useState<PlaylistRanker | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [currentPair, setCurrentPair] = useState<[Track, Track] | null>(null)
  const [rankings, setRankings] = useState<SongRanking[]>([])
  const [confidence, setConfidence] = useState(0)
  const [completedComparisons, setCompletedComparisons] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  const initializeRanker = useCallback((trackList: Track[]) => {
    if (trackList.length < 2) {
      throw new Error('Need at least 2 tracks to rank')
    }

    const songIds = trackList.map((t) => t.id)
    const newRanker = new PlaylistRanker(songIds)

    setRanker(newRanker)
    setTracks(trackList)
    setCompletedComparisons(0)
    setIsComplete(false)

    // Get first pair
    const pair = newRanker.getNextPair()
    if (pair) {
      const trackA = trackList.find((t) => t.id === pair[0])
      const trackB = trackList.find((t) => t.id === pair[1])
      if (trackA && trackB) {
        setCurrentPair([trackA, trackB])
      }
    }

    // Initial rankings
    setRankings(newRanker.computeRankings())
    setConfidence(newRanker.getConfidence())
  }, [])

  const submitVote = useCallback(
    (feedback: Feedback) => {
      if (!ranker || !currentPair) return

      const [trackA, trackB] = currentPair

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

      // Get next pair
      const nextPair = ranker.getNextPair()
      if (nextPair) {
        const nextTrackA = tracks.find((t) => t.id === nextPair[0])
        const nextTrackB = tracks.find((t) => t.id === nextPair[1])
        if (nextTrackA && nextTrackB) {
          setCurrentPair([nextTrackA, nextTrackB])
        } else {
          setIsComplete(true)
          setCurrentPair(null)
        }
      } else {
        setIsComplete(true)
        setCurrentPair(null)
      }
    },
    [ranker, currentPair, tracks],
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
    setRankings([])
    setConfidence(0)
    setCompletedComparisons(0)
    setIsComplete(false)
  }, [])

  // Persist state to sessionStorage
  useEffect(() => {
    if (ranker && tracks.length > 0) {
      const state = {
        rankerState: ranker.exportState(),
        tracks,
        completedComparisons,
        confidence,
        isComplete,
      }
      sessionStorage.setItem('songrank-session', JSON.stringify(state))
    }
  }, [ranker, tracks, completedComparisons, confidence, isComplete])

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
        setCompletedComparisons(parsed.completedComparisons)
        setConfidence(parsed.confidence)
        setIsComplete(parsed.isComplete)

        if (!parsed.isComplete) {
          const pair = restoredRanker.getNextPair()
          if (pair) {
            const trackA = parsed.tracks.find((t: Track) => t.id === pair[0])
            const trackB = parsed.tracks.find((t: Track) => t.id === pair[1])
            if (trackA && trackB) {
              setCurrentPair([trackA, trackB])
            }
          }
        }

        setRankings(restoredRanker.computeRankings())
      } catch (error) {
        console.error('Failed to restore session:', error)
        sessionStorage.removeItem('songrank-session')
      }
    }
  }, [])

  const value: RankerContextValue = {
    ranker,
    tracks,
    currentPair,
    rankings,
    confidence,
    completedComparisons,
    isComplete,
    initializeRanker,
    submitVote,
    resetRanker,
    forceFinish,
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
