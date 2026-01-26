'use client'

import { useRanker } from '../context/RankerContext'
import ShareCardModal from './ShareCardModal'
import DuelInviteModal from './DuelInviteModal'
import { Trophy, Download, Share2, Users } from 'lucide-react'
import { useState } from 'react'
import Image from 'next/image'

export default function ResultsView() {
  const { rankings, tracks, completedComparisons, resetRanker } = useRanker()
  const [showShareModal, setShowShareModal] = useState(false)
  const [showDuelModal, setShowDuelModal] = useState(false)

  const rankedTracks = rankings
    .map((r) => {
      const track = tracks.find((t) => t.id === r.Song)
      return { ...r, track }
    })
    .filter((r) => r.track)

  return (
    <div className='min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4 md:p-8'>
      <div className='max-w-4xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-8'>
          <div className='inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500 mb-4'>
            <Trophy size={40} className='text-slate-900' />
          </div>
          <h1 className='text-4xl font-bold mb-2'>Your Rankings</h1>
          <p className='text-white/70'>
            Based on {completedComparisons} comparisons
          </p>
        </div>

        {/* Action Buttons */}
        <div className='flex flex-wrap gap-3 justify-center mb-8'>
          <button className='flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-6 py-3 rounded-lg font-semibold transition-colors'>
            <Download size={20} />
            Export to Spotify
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className='flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold transition-colors'
          >
            <Share2 size={20} />
            Share Results
          </button>
          <button
            onClick={() => setShowDuelModal(true)}
            className='flex items-center gap-2 bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-semibold transition-colors'
          >
            <Users size={20} />
            Challenge Friend
          </button>
        </div>

        {/* Rankings List */}
        <div className='space-y-2'>
          {rankedTracks.map((item, idx) => {
            const track = item.track!
            const medal =
              idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null

            return (
              <div
                key={track.id}
                className='bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 flex items-center gap-4 hover:bg-white/15 transition-colors'
              >
                {/* Rank */}
                <div className='shrink-0 w-12 text-center'>
                  {medal ? (
                    <span className='text-3xl'>{medal}</span>
                  ) : (
                    <span className='text-2xl font-bold text-white/50'>
                      #{idx + 1}
                    </span>
                  )}
                </div>

                {/* Album Art */}
                <div className='shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-700'>
                  {track.coverImage ? (
                    <Image
                      src={track.coverImage}
                      alt={track.title}
                      width={64}
                      height={64}
                      className='object-cover'
                    />
                  ) : (
                    <div className='w-full h-full flex items-center justify-center text-white/30'>
                      ♪
                    </div>
                  )}
                </div>

                {/* Track Info */}
                <div className='flex-1 min-w-0'>
                  <h3 className='font-semibold text-lg truncate'>
                    {track.title}
                  </h3>
                  <p className='text-sm text-white/60 truncate'>
                    {track.artist}
                  </p>
                </div>

                {/* Score */}
                <div className='shrink-0 text-right'>
                  <div className='text-sm text-white/50'>Score</div>
                  <div className='text-lg font-bold'>
                    {item.Score.toFixed(2)}
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
            className='text-white/60 hover:text-white underline transition-colors'
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
          playlistName='My Ranked Playlist'
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Duel Invite Modal */}
      {showDuelModal && (
        <DuelInviteModal
          tracks={tracks}
          playlistName='My Ranked Playlist'
          onClose={() => setShowDuelModal(false)}
        />
      )}
    </div>
  )
}
