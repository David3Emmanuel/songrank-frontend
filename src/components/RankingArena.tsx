'use client'

import { useRanker } from '../context/RankerContext'
import SwipeComparison from '../components/SwipeComparison'
import SongCard from '../components/SongCard'
import { List, X } from 'lucide-react'
import { useState } from 'react'

export default function RankingArena() {
  const {
    currentPair,
    submitVote,
    confidence,
    completedComparisons,
    forceFinish,
  } = useRanker()
  const [showPause, setShowPause] = useState(false)

  if (!currentPair) {
    return null
  }

  const [trackA, trackB] = currentPair

  return (
    <div className='relative w-full h-screen'>
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

      {/* Progress Indicators */}
      <div className='absolute top-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none'>
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
          <div className='bg-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-white/10'>
            <h2 className='text-2xl font-bold text-white mb-4'>Paused</h2>
            <p className='text-white/70 mb-6'>
              You&apos;ve completed {completedComparisons} comparisons. Current
              confidence: {Math.round(confidence * 100)}%
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
  )
}
