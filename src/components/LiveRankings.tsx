'use client'

import { useState } from 'react'
import { Trophy, X } from 'lucide-react'
import TrackArtwork from './TrackArtwork'
import type { SongRanking, Track } from '../lib/types'

interface LiveRankingsProps {
  rankings: SongRanking[]
  tracks: Track[]
  completedComparisons: number
}

export default function LiveRankings({
  rankings,
  tracks,
  completedComparisons,
}: LiveRankingsProps) {
  const [isOpen, setIsOpen] = useState(false)

  const rankedTracks = rankings
    .map((r) => {
      const track = tracks.find((t) => t.id === r.Song)
      return { ...r, track }
    })
    .filter((r) => r.track)

  return (
    <>
      {/* Desktop View (Sidebar) */}
      <div className='hidden md:flex flex-col w-80 h-full bg-white/70 backdrop-blur-md border-l border-slate-200/80 overflow-hidden'>
        {/* Header */}
        <div className='p-4 border-b border-slate-200'>
          <div className='flex items-center gap-2 mb-2'>
            <Trophy size={20} className='text-amber-500' />
            <h3 className='text-lg font-bold'>Current Rankings</h3>
          </div>
          <p className='text-sm text-slate-500'>
            {completedComparisons} comparison
            {completedComparisons !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Rankings List */}
        <div className='flex-1 overflow-y-auto p-3 space-y-1.5'>
          {rankedTracks.length === 0 ? (
            <div className='text-center text-slate-500 py-8 text-sm'>
              Make some comparisons to see rankings
            </div>
          ) : (
            <>
              {rankedTracks.map((item, idx) => {
                const track = item.track!
                const medal =
                  idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                const hasScore = item.Score !== 0

                return (
                  <div
                    key={track.id}
                    className={`bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-sm rounded-lg p-2 flex items-center gap-2 transition-all hover:bg-slate-100 ${
                      idx < 3 ? 'ring-1 ring-yellow-500/40' : ''
                    }`}
                  >
                    {/* Rank */}
                    <div className='shrink-0 w-8 text-center'>
                      {medal ? (
                        <span className='text-xl'>{medal}</span>
                      ) : (
                        <span className='text-sm font-semibold text-slate-400'>
                          #{idx + 1}
                        </span>
                      )}
                    </div>

                    {/* Album Art */}
                    <div className='shrink-0 w-10 h-10 rounded overflow-hidden bg-slate-100 text-slate-300'>
                      <TrackArtwork src={track.coverImage} alt={track.title} />
                    </div>

                    {/* Track Info */}
                    <div className='flex-1 min-w-0'>
                      <h4 className='text-sm font-semibold truncate leading-tight'>
                        {track.title}
                      </h4>
                      <p className='text-xs text-slate-500 truncate leading-tight'>
                        {track.artist}
                      </p>
                    </div>

                    {/* Score */}
                    {hasScore && (
                      <div className='shrink-0 text-right'>
                        <div className='text-xs font-bold text-slate-600'>
                          {item.Score.toFixed(1)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer Hint */}
        <div className='p-3 border-t border-slate-200 text-xs text-slate-500 text-center'>
          Rankings update after each vote
        </div>
      </div>

      {/* Mobile View (Bottom Sheet) */}
      <div className='md:hidden'>
        {/* Toggle Button */}
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className='fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 flex items-center justify-center shadow-lg hover:bg-white transition-colors'
            aria-label='View Rankings'
          >
            <div className='relative'>
              <Trophy size={24} className='text-amber-500' />
              {completedComparisons > 0 && (
                <div className='absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white'>
                  {completedComparisons > 9 ? '9+' : completedComparisons}
                </div>
              )}
            </div>
          </button>
        )}

        {/* Bottom Sheet */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className='fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 animate-fade-in'
              onClick={() => setIsOpen(false)}
            />

            {/* Sheet */}
            <div className='fixed inset-x-0 bottom-0 z-50 bg-white/95 backdrop-blur-md rounded-t-3xl border-t border-slate-200 shadow-xl max-h-[80vh] flex flex-col animate-slide-up'>
              {/* Handle Bar */}
              <div className='flex items-center justify-center py-3 border-b border-slate-200'>
                <div className='w-12 h-1 bg-slate-300 rounded-full' />
              </div>

              {/* Header */}
              <div className='px-4 py-3 flex items-center justify-between border-b border-slate-200'>
                <div className='flex items-center gap-2'>
                  <Trophy size={20} className='text-amber-500' />
                  <div>
                    <h3 className='font-bold'>Current Rankings</h3>
                    <p className='text-xs text-slate-500'>
                      {completedComparisons} comparison
                      {completedComparisons !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className='w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors'
                  aria-label='Close'
                >
                  <X size={18} />
                </button>
              </div>

              {/* Rankings List */}
              <div className='flex-1 overflow-y-auto p-4 space-y-2'>
                {rankedTracks.length === 0 ? (
                  <div className='text-center text-slate-500 py-12'>
                    Make some comparisons to see rankings
                  </div>
                ) : (
                  rankedTracks.map((item, idx) => {
                    const track = item.track!
                    const medal =
                      idx === 0
                        ? '🥇'
                        : idx === 1
                          ? '🥈'
                          : idx === 2
                            ? '🥉'
                            : null
                    const hasScore = item.Score !== 0

                    return (
                      <div
                        key={track.id}
                        className={`bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-sm rounded-xl p-3 flex items-center gap-3 ${
                          idx < 3 ? 'ring-1 ring-yellow-500/40' : ''
                        }`}
                      >
                        {/* Rank */}
                        <div className='shrink-0 w-10 text-center'>
                          {medal ? (
                            <span className='text-2xl'>{medal}</span>
                          ) : (
                            <span className='text-lg font-semibold text-slate-400'>
                              #{idx + 1}
                            </span>
                          )}
                        </div>

                        {/* Album Art */}
                        <div className='shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-slate-100 text-slate-300'>
                          <TrackArtwork src={track.coverImage} alt={track.title} />
                        </div>

                        {/* Track Info */}
                        <div className='flex-1 min-w-0'>
                          <h4 className='font-semibold truncate'>
                            {track.title}
                          </h4>
                          <p className='text-sm text-slate-500 truncate'>
                            {track.artist}
                          </p>
                        </div>

                        {/* Score */}
                        {hasScore && (
                          <div className='shrink-0 text-right'>
                            <div className='text-xs text-slate-500'>Score</div>
                            <div className='text-sm font-bold'>
                              {item.Score.toFixed(1)}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Footer */}
              <div className='p-4 border-t border-slate-200 text-xs text-slate-500 text-center'>
                Rankings update after each vote
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
