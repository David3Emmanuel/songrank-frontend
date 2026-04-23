'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Music } from 'lucide-react'
import type { YouTubePlayer } from '../lib/youtube'
import type { Track } from '../lib/types'

export interface InteractionState {
  position: { x: number; y: number }
  zone: string
  progress: number // 0 to 1
  direction: 'left' | 'right' | 'center'
  isActive: boolean
  side: 'left' | 'right'
}

export interface SongCardProps {
  track: Track
  side?: 'left' | 'right'
  accentColor?: string
  registerUpdateHandler?: (handler: (state: InteractionState) => void) => void
  numberOfBars?: number
  // Player is owned by the pool in RankingArena — passed down here for
  // volume control during swipe interactions
  playerRef: React.RefObject<YouTubePlayer | null>
  // Display state driven by the pool
  isLoading?: boolean
  isPlaying?: boolean
  isFallbackLoading?: boolean
  hasError?: boolean
}

export default function SongCard({
  track,
  side = 'left',
  accentColor = side === 'left' ? '#10b981' : '#3b82f6',
  registerUpdateHandler,
  numberOfBars = 20,
  playerRef,
  isLoading = true,
  isPlaying = false,
  isFallbackLoading = false,
  hasError = false,
}: SongCardProps) {
  const [scale, setScale] = useState(1)
  const [opacity, setOpacity] = useState(1)
  const [volume, setVolume] = useState(0.5)
  const [isStrong, setIsStrong] = useState(false)

  // Register this card's swipe update handler with SwipeComparison.
  // playerRef is in the dep array so the handler re-registers (and thus
  // controls the correct player) whenever the pool swaps which slot backs
  // this card after a pair transition.
  useEffect(() => {
    if (!registerUpdateHandler) return

    const handleUpdate = (state: InteractionState) => {
      if (!state.isActive) {
        setScale(1)
        setOpacity(1)
        setVolume(0.5)
        setIsStrong(false)
        playerRef.current?.setVolume(50)
        return
      }

      const { progress, direction, zone } = state

      const isWinning =
        (side === 'left' && direction === 'left') ||
        (side === 'right' && direction === 'right')

      const isLosing =
        (side === 'left' && direction === 'right') ||
        (side === 'right' && direction === 'left')

      if (isWinning) {
        const newVolume = 0.2 + progress * 0.8
        setVolume(newVolume)
        setScale(1 + progress * 0.4)
        setOpacity(1)
        setIsStrong(zone === `strong-${side === 'left' ? 'a' : 'b'}`)
        playerRef.current?.setVolume(newVolume * 100)
      } else if (isLosing) {
        const newVolume = Math.max(0, 0.2 - progress * 0.2)
        setVolume(newVolume)
        setScale(1 - progress * 0.2)
        setOpacity(1 - progress)
        setIsStrong(false)
        playerRef.current?.setVolume(newVolume * 100)
      } else {
        setVolume(0.5)
        setScale(1)
        setOpacity(1)
        setIsStrong(false)
        playerRef.current?.setVolume(50)
      }
    }

    registerUpdateHandler(handleUpdate)
  }, [registerUpdateHandler, side, playerRef])

  return (
    <div
      className='w-40 h-40 md:w-64 md:h-64 transition-transform duration-100 ease-out flex flex-col items-center justify-center'
      style={{ transform: `scale(${scale})`, opacity }}
    >
      <div
        className='w-full h-full rounded-2xl shadow-2xl flex items-center justify-center border-2 border-white/10 relative overflow-hidden'
        style={{ backgroundColor: '#1f2937' }}
      >
        {/* Eclipse Flash Effect */}
        {isStrong && (
          <div className='absolute inset-0 bg-white/20 animate-pulse' />
        )}

        {track.coverImage ? (
          <Image
            src={track.coverImage}
            alt={track.title}
            fill
            className='object-cover'
            sizes='(max-width: 768px) 160px, 256px'
          />
        ) : (
          <Music className='w-16 h-16 text-white/30' />
        )}

        {/* Loading Spinner */}
        {isLoading && !hasError && !isFallbackLoading && (
          <div className='absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl'>
            <div className='w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin' />
          </div>
        )}

        {/* Fallback Search Overlay */}
        {isFallbackLoading && (
          <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-2xl gap-2'>
            <div className='w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin' />
            <span className='text-white/70 text-xs text-center px-3 leading-tight'>
              Finding alternative…
            </span>
          </div>
        )}

        {/* Error Overlay */}
        {hasError && (
          <div className='absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-2xl gap-1'>
            <span className='text-2xl'>⚠️</span>
            <span className='text-white/60 text-xs text-center px-3 leading-tight'>
              Audio unavailable
            </span>
          </div>
        )}

        {/* Audio Visualizer */}
        <div className='absolute bottom-4 left-0 right-0 flex justify-center gap-1 h-8 items-end'>
          {isPlaying &&
            Array.from({ length: numberOfBars }).map((_, i) => (
              <div
                key={i}
                className='w-1 bg-white/50 rounded-full transition-all duration-100'
                style={{ height: `${volume * 100 * Math.random()}%` }}
              />
            ))}
        </div>
      </div>

      <p className='mt-4 font-bold' style={{ color: accentColor }}>
        {track.title}
      </p>
    </div>
  )
}
