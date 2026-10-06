'use client'

import { useRanker } from '../context/RankerContext'
import ShareCardModal from './ShareCardModal'
import DuelInviteModal from './DuelInviteModal'
import TrackArtwork from './TrackArtwork'
import { sessionProgress } from '../lib/sessionProgress'
import {
  bandStarts,
  measuredRange,
  normalizeScore,
  PLACE_COLOURS,
  scoreTint,
} from '../lib/scoreDisplay'
import { formatDurationMs } from '../lib/videoMetadata'
import { Trophy, Download, Share2, Users } from 'lucide-react'
import { useState } from 'react'

export default function ResultsView() {
  const {
    rankings,
    tracks,
    playlistName,
    completedComparisons,
    comparisonCounts,
    resetRanker,
  } = useRanker()
  const [showShareModal, setShowShareModal] = useState(false)
  const [showDuelModal, setShowDuelModal] = useState(false)
  const progress = sessionProgress(tracks.length, completedComparisons)

  const rankedTracks = rankings
    .map((r) => {
      const track = tracks.find((t) => t.id === r.Song)
      return { ...r, track }
    })
    .filter((r) => r.track)

  // Which rows carry a real measurement, and where the breaks between groups
  // fall. A song nobody has picked is left out of both: its 0 is an absence.
  const measured = rankedTracks.map(
    (item) => (comparisonCounts[item.track!.id] ?? 0) > 0,
  )
  const scores = rankedTracks.map((item) => item.Score)
  const range = measuredRange(scores, measured)
  const breaks = bandStarts(scores, measured)

  return (
    <div className='min-h-screen bg-gradient-to-b from-white to-sky-50 text-slate-900 p-4 md:p-8'>
      <div className='max-w-4xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-8'>
          <div className='inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/70 backdrop-blur-md border border-slate-200/80 shadow-sm mb-4'>
            <Trophy size={40} className='text-amber-500' />
          </div>
          <h1 className='text-4xl font-bold mb-2'>Your Rankings</h1>
          {playlistName && (
            <p className='text-slate-600 text-lg font-medium mb-1'>{playlistName}</p>
          )}
          <p className='text-slate-500 text-sm'>
            From your {completedComparisons} pick
            {completedComparisons !== 1 ? 's' : ''}
          </p>
          {progress.topMayShift && (
            <p className='mt-2 text-xs text-amber-600'>
              The top few could still swap places. A couple more picks would
              settle them.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className='flex flex-wrap gap-3 justify-center mb-8'>
          <button
            disabled
            title='Coming soon'
            className='flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-400 px-6 py-3 rounded-lg font-semibold cursor-not-allowed'
          >
            <Download size={20} />
            Export to Spotify (Coming Soon)
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className='flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors'
          >
            <Share2 size={20} />
            Share my ranking
          </button>
          <button
            onClick={() => setShowDuelModal(true)}
            className='flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors'
          >
            <Users size={20} />
            Challenge a friend
          </button>
        </div>

        {/* Podium for the top three: a card each, with a floating place badge,
            the winner's card a size larger, and the bottoms aligned. A place
            nobody reached keeps the card shape with an empty frame. */}
        <div className='mt-16 mb-8 flex items-end justify-center gap-2 sm:gap-4 md:gap-6'>
          {[2, 1, 3].map((place) => {
            const item = rankedTracks[place - 1]
            const track = item?.track
            const duration = formatDurationMs(track?.durationMs)
            const winner = place === 1

            const frame =
              place === 1
                ? 'border-amber-300 shadow-lg shadow-amber-500/10'
                : place === 2
                  ? 'border-slate-300'
                  : 'border-orange-300'

            return (
              <div
                key={place}
                className={`relative rounded-2xl border bg-white/70 p-2.5 backdrop-blur-md sm:p-3 md:p-4 ${frame} ${
                  winner ? 'w-28 sm:w-40 md:w-56' : 'w-24 sm:w-36 md:w-48'
                }`}
              >
                <span
                  className='absolute -top-3 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full text-xs font-bold text-white md:h-7 md:w-7 md:text-sm'
                  style={{ backgroundColor: PLACE_COLOURS[place - 1] }}
                >
                  {place}
                </span>

                <div className='aspect-square w-full overflow-hidden rounded-xl bg-slate-100'>
                  {track ? (
                    <TrackArtwork
                      src={track.coverImage}
                      alt={track.title}
                      higherQuality
                    />
                  ) : (
                    <div className='flex h-full w-full items-center justify-center'>
                      <div className='h-1/2 w-1/2 rounded-full border border-dashed border-slate-300' />
                    </div>
                  )}
                </div>

                {track && (
                  <>
                    <p className='mt-3 truncate text-center text-sm font-bold md:text-base'>
                      {track.title}
                    </p>
                    <p className='truncate text-center text-xs text-slate-500 md:text-sm'>
                      {track.artist}
                    </p>
                    {duration && (
                      <p className='mt-0.5 text-center text-xs text-slate-400'>
                        {duration}
                      </p>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* The rest of the list, continuing below the podium */}
        <div className='space-y-2'>
          {rankedTracks.slice(3).map((item, idx) => {
            const track = item.track!
            const rank = idx + 4
            const position = idx + 3
            const unmeasured = !measured[position]

            return (
              <div key={track.id}>
                {breaks[position] && (
                  <div className='mb-2 flex h-3 items-center'>
                    <div className='h-px w-full bg-slate-300' />
                  </div>
                )}
                <div
                  className={`backdrop-blur-md border shadow-sm rounded-xl p-4 flex items-center gap-4 transition-colors ${
                    unmeasured
                      ? 'border-slate-200/60 bg-slate-100/80'
                      : 'border-slate-200/80 bg-white/70 hover:bg-slate-100'
                  }`}
                  style={{
                    backgroundColor: unmeasured
                      ? undefined
                      : scoreTint(normalizeScore(item.Score, range)),
                  }}
                >
                  {/* Rank */}
                  <div className='shrink-0 w-12 text-center'>
                    <span
                      className={`text-2xl font-bold ${
                        unmeasured ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      #{rank}
                    </span>
                  </div>

                  {/* Album Art */}
                  <div
                    className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-100 ${
                      unmeasured ? 'opacity-60' : ''
                    }`}
                  >
                    <TrackArtwork src={track.coverImage} alt={track.title} />
                  </div>

                  {/* Track Info */}
                  <div className='flex-1 min-w-0'>
                    <h3
                      className={`font-semibold text-lg truncate ${
                        unmeasured ? 'text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {track.title}
                    </h3>
                    <p
                      className={`text-sm truncate ${
                        unmeasured ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      {track.artist}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer Actions */}
        <div className='mt-8 text-center'>
          <button
            onClick={resetRanker}
            className='text-slate-500 hover:text-slate-900 underline transition-colors'
          >
            Start New Ranking
          </button>
        </div>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <ShareCardModal
          rankings={rankings}
          tracks={tracks}
          playlistName={playlistName}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showDuelModal && (
        <DuelInviteModal
          tracks={tracks}
          playlistName={playlistName}
          onClose={() => setShowDuelModal(false)}
        />
      )}
    </div>
  )
}
