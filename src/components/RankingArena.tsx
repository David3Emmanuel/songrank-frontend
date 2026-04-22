'use client'

import { useRanker } from '../context/RankerContext'
import SwipeComparison from '../components/SwipeComparison'
import SongCard from '../components/SongCard'
import LiveRankings from '../components/LiveRankings'
import YouTube from '../lib/youtube'
import type { Track } from '../lib/types'
import { List, X } from 'lucide-react'
import { useState, useEffect } from 'react'

/**
 * Silently preloads a YouTube video in a hidden, muted iframe.
 * This warms up the CDN connection and buffers the first few seconds so
 * that when the video becomes the active card the audio starts faster.
 */
function AudioPreloader({ track }: { track: Track }) {
  const videoId = track.externalUrls?.youtube
    ? track.externalUrls.youtube.split('v=')[1]?.split('&')[0] || track.id
    : track.id

  const opts = {
    height: '1',
    width: '1',
    playerVars: { autoplay: 1, mute: 1, playsinline: 1, controls: 0, disablekb: 1 },
  }

  return (
    <div
      aria-hidden='true'
      style={{
        position: 'absolute',
        top: -9999,
        left: -9999,
        visibility: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <YouTube videoId={videoId} opts={opts} />
    </div>
  )
}

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

  if (!currentPair) {
    return null
  }

  const [trackA, trackB] = currentPair

  return (
    <div className='flex h-screen'>
      {/* Main Ranking Area */}
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

        {/* Mobile: full-width confidence bar at top edge */}
        <div className='md:hidden absolute top-0 left-0 right-0 z-50 h-0.5 bg-white/10 pointer-events-none'>
          <div
            className='h-full bg-linear-to-r from-yellow-500 to-green-500 transition-all duration-500'
            style={{ width: `${confidence * 100}%` }}
          />
        </div>

        {/* Desktop: labelled pills top-right */}
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
          leftCard={<SongCard track={trackA} side='left' />}
          rightCard={<SongCard track={trackB} side='right' />}
          onVote={submitVote}
        />
      </div>

      {/* Live Rankings Sidebar/Panel */}
      <LiveRankings
        rankings={rankings}
        tracks={tracks}
        completedComparisons={completedComparisons}
      />

      {/* Speculative preloaders for the next pair — hidden, muted, off-screen.
          Warms up YouTube connections so audio starts faster after the next swipe. */}
      {nextPair && (
        <>
          <AudioPreloader key={nextPair[0].id} track={nextPair[0]} />
          <AudioPreloader key={nextPair[1].id} track={nextPair[1]} />
        </>
      )}
    </div>
  )
}
