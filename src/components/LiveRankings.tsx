'use client'

import { useState } from 'react'
import { Trophy, X } from 'lucide-react'
import TrackArtwork from './TrackArtwork'
import { bandStarts, measuredRange, normalizeScore, scoreTint } from '../lib/scoreDisplay'
import type { SongRanking, Track } from '../lib/types'

interface LiveRankingsProps {
  rankings: SongRanking[]
  tracks: Track[]
  completedComparisons: number
  /** Comparisons per song id. Absent means never compared. */
  comparisonCounts?: Record<string, number>
}

interface RankedRow {
  item: SongRanking & { track?: Track }
  breaksBefore: boolean
  /** Undefined for a song nobody has compared: shown greyed out instead. */
  tint?: string
}

/**
 * One ranked song, drawn the same way in the sidebar and the phone sheet.
 *
 * A song with no comparisons is grey and carries no colour, so it reads as not
 * yet measured rather than as a middling score.
 */
function RankingRow({
  row,
  rank,
  size,
}: {
  row: RankedRow
  rank: number
  size: 'sidebar' | 'sheet'
}) {
  const track = row.item.track!
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
  const unmeasured = row.tint === undefined
  const sheet = size === 'sheet'

  return (
    <>
      {row.breaksBefore && (
        <div className='flex h-3 shrink-0 items-center'>
          <div className='h-px w-full bg-slate-300' />
        </div>
      )}
      <div
        className={`flex items-center gap-2 rounded-lg border shadow-sm ${
          sheet ? 'gap-3 rounded-xl p-3' : 'p-2'
        } ${
          unmeasured
            ? 'border-slate-200/60 bg-slate-100/80'
            : `border-slate-200/80 ${rank <= 3 ? 'ring-1 ring-yellow-500/40' : ''}`
        }`}
        style={{ backgroundColor: row.tint }}
      >
        <div className={`w-8 shrink-0 text-center ${sheet ? 'w-10' : ''}`}>
          {medal && !unmeasured ? (
            <span className={sheet ? 'text-2xl' : 'text-xl'}>{medal}</span>
          ) : (
            <span
              className={`font-semibold ${sheet ? 'text-lg' : 'text-sm'} ${
                unmeasured ? 'text-slate-300' : 'text-slate-400'
              }`}
            >
              #{rank}
            </span>
          )}
        </div>

        <div
          className={`shrink-0 overflow-hidden rounded bg-slate-100/80 ${
            sheet ? 'h-12 w-12' : 'h-10 w-10'
          } ${unmeasured ? 'opacity-60' : ''}`}
        >
          <TrackArtwork src={track.coverImage} alt={track.title} />
        </div>

        <div className='min-w-0 flex-1'>
          <h4
            className={`truncate leading-tight font-semibold ${
              sheet ? 'text-base' : 'text-sm'
            } ${unmeasured ? 'text-slate-400' : 'text-slate-900'}`}
          >
            {track.title}
          </h4>
          <p
            className={`truncate leading-tight ${
              sheet ? 'text-sm' : 'text-xs'
            } ${unmeasured ? 'text-slate-400' : 'text-slate-500'}`}
          >
            {track.artist}
          </p>
        </div>
      </div>
    </>
  )
}

export default function LiveRankings({
  rankings,
  tracks,
  completedComparisons,
  comparisonCounts = {},
}: LiveRankingsProps) {
  const [isOpen, setIsOpen] = useState(false)

  const rankedTracks = rankings
    .map((r) => {
      const track = tracks.find((t) => t.id === r.Song)
      return { ...r, track }
    })
    .filter((r) => r.track)

  // Which rows carry a real measurement, the session's range, and where the
  // breaks between groups fall. A song nobody has picked is left out of all
  // three: its 0 is an absence, not a score.
  const measured = rankedTracks.map(
    (item) => (comparisonCounts[item.track!.id] ?? 0) > 0,
  )
  const scores = rankedTracks.map((item) => item.Score)
  const range = measuredRange(scores, measured)
  const breaks = bandStarts(scores, measured)

  /** Everything a row needs to draw itself, worked out once for both layouts. */
  const rows = rankedTracks.map((item, i) => ({
    item,
    breaksBefore: breaks[i],
    tint: measured[i] ? scoreTint(normalizeScore(scores[i], range)) : undefined,
  }))

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
            {completedComparisons} pick
            {completedComparisons !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Rankings List */}
        <div className='flex-1 overflow-y-auto p-3 space-y-1.5'>
          {rankedTracks.length === 0 ? (
            <div className='text-center text-slate-500 py-8 text-sm'>
              Pick a few winners and your ranking shows up here
            </div>
          ) : (
            rows.map((row, idx) => (
              <RankingRow
                key={row.item.track!.id}
                row={row}
                rank={idx + 1}
                size='sidebar'
              />
            ))
          )}
        </div>

        {/* Footer Hint */}
        <div className='p-3 border-t border-slate-200 text-xs text-slate-500 text-center'>
          Updates after every pick
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
                      {completedComparisons} pick
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
                    Pick a few winners and your ranking shows up here
                  </div>
                ) : (
                  rows.map((row, idx) => (
                    <RankingRow
                      key={row.item.track!.id}
                      row={row}
                      rank={idx + 1}
                      size='sheet'
                    />
                  ))
                )}
              </div>

              {/* Footer */}
              <div className='p-4 border-t border-slate-200 text-xs text-slate-500 text-center'>
                Updates after every pick
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
