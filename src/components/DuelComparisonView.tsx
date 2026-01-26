'use client'

import { useEffect, useState } from 'react'
import { getDuelComparison } from '../lib/duelApi'
import type { DuelComparison, Track } from '../lib/types'
import { Trophy, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface DuelComparisonViewProps {
  duelId: string
  tracks: Track[]
}

export default function DuelComparisonView({
  duelId,
  tracks,
}: DuelComparisonViewProps) {
  const [comparison, setComparison] = useState<DuelComparison | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadComparison()
  }, [duelId])

  const loadComparison = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getDuelComparison(duelId)
      if (!data) {
        setError('Waiting for your friend to complete their ranking...')
      } else {
        setComparison(data)
      }
    } catch (err) {
      setError('Failed to load comparison results')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className='min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center'>
        <div className='text-center'>
          <Loader2 size={48} className='text-white animate-spin mx-auto mb-4' />
          <p className='text-white/80'>Loading comparison...</p>
        </div>
      </div>
    )
  }

  if (error && !comparison) {
    return (
      <div className='min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4'>
        <div className='text-center max-w-md'>
          <AlertTriangle size={48} className='text-yellow-500 mx-auto mb-4' />
          <p className='text-white text-xl mb-4'>{error}</p>
          <button
            onClick={loadComparison}
            className='bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors'
          >
            Refresh
          </button>
        </div>
      </div>
    )
  }

  if (!comparison) return null

  const compatibilityPercent = Math.round(comparison.compatibility_score * 100)
  const compatibilityColor =
    compatibilityPercent >= 70
      ? 'text-emerald-400'
      : compatibilityPercent >= 40
        ? 'text-yellow-400'
        : 'text-red-400'

  return (
    <div className='min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4 md:p-8'>
      <div className='max-w-5xl mx-auto'>
        {/* Header */}
        <div className='text-center mb-8'>
          <h1 className='text-4xl font-bold mb-2'>Duel Results</h1>
          <p className='text-white/70'>
            {comparison.session.playlist_metadata.name}
          </p>
        </div>

        {/* Compatibility Score */}
        <div className='bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 mb-8'>
          <div className='text-center'>
            <TrendingUp
              size={48}
              className={`${compatibilityColor} mx-auto mb-4`}
            />
            <h2 className='text-3xl font-bold mb-2'>Compatibility Score</h2>
            <div className={`text-6xl font-black ${compatibilityColor} mb-4`}>
              {compatibilityPercent}%
            </div>
            <p className='text-white/70'>
              {compatibilityPercent >= 70
                ? '🎉 You have very similar music tastes!'
                : compatibilityPercent >= 40
                  ? '😊 You share some common favorites'
                  : '🤔 You have quite different tastes!'}
            </p>
          </div>
        </div>

        {/* Agreed Favorites */}
        {comparison.agreed_favorites.length > 0 && (
          <div className='bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 mb-8'>
            <div className='flex items-center gap-3 mb-4'>
              <Trophy size={24} className='text-yellow-500' />
              <h3 className='text-2xl font-bold'>Songs You Both Love</h3>
            </div>
            <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'>
              {comparison.agreed_favorites.slice(0, 8).map((songId) => {
                const track = tracks.find((t) => t.id === songId)
                if (!track) return null
                return (
                  <div key={songId} className='bg-white/5 rounded-lg p-3'>
                    {track.coverImage && (
                      <div className='aspect-square rounded-lg overflow-hidden mb-2'>
                        <Image
                          src={track.coverImage}
                          alt={track.title}
                          width={200}
                          height={200}
                          className='object-cover w-full h-full'
                        />
                      </div>
                    )}
                    <p className='font-semibold text-sm truncate'>
                      {track.title}
                    </p>
                    <p className='text-xs text-white/60 truncate'>
                      {track.artist}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Controversial */}
        {comparison.controversial.length > 0 && (
          <div className='bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 mb-8'>
            <div className='flex items-center gap-3 mb-4'>
              <AlertTriangle size={24} className='text-orange-500' />
              <h3 className='text-2xl font-bold'>Biggest Disagreements</h3>
            </div>
            <div className='space-y-3'>
              {comparison.controversial.map((item) => {
                const track = tracks.find((t) => t.id === item.song)
                if (!track) return null
                return (
                  <div
                    key={item.song}
                    className='bg-white/5 rounded-lg p-4 flex items-center gap-4'
                  >
                    {track.coverImage && (
                      <div className='shrink-0 w-16 h-16 rounded-lg overflow-hidden'>
                        <Image
                          src={track.coverImage}
                          alt={track.title}
                          width={64}
                          height={64}
                          className='object-cover w-full h-full'
                        />
                      </div>
                    )}
                    <div className='flex-1 min-w-0'>
                      <p className='font-semibold truncate'>{track.title}</p>
                      <p className='text-sm text-white/60 truncate'>
                        {track.artist}
                      </p>
                    </div>
                    <div className='shrink-0 text-right'>
                      <div className='text-sm text-white/60'>Ranks</div>
                      <div className='font-bold'>
                        #{item.rank_a} vs #{item.rank_b}
                      </div>
                      <div className='text-xs text-orange-400'>
                        {Math.abs(item.rank_a - item.rank_b)} apart
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className='text-center'>
          <button
            onClick={() => (window.location.href = '/')}
            className='bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-3 rounded-lg transition-colors'
          >
            Create Your Own Ranking
          </button>
        </div>
      </div>
    </div>
  )
}
