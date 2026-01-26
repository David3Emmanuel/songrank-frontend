'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { Music, Play, Pause } from 'lucide-react'
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
}

export default function SongCard({
  track,
  side = 'left',
  accentColor = side === 'left' ? '#10b981' : '#3b82f6',
  registerUpdateHandler,
}: SongCardProps) {
  const [scale, setScale] = useState(1)
  const [opacity, setOpacity] = useState(1)
  const [volume, setVolume] = useState(0.5)
  const [isStrong, setIsStrong] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio
  useEffect(() => {
    if (track.previewUrl) {
      audioRef.current = new Audio(track.previewUrl)
      audioRef.current.loop = true
      audioRef.current.volume = 0.5
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [track.previewUrl])

  // Auto-play when card appears
  useEffect(() => {
    if (audioRef.current && !isPlaying) {
      audioRef.current.play().catch(() => {
        // Auto-play blocked, user needs to interact first
      })
      setIsPlaying(true)
    }
  }, [])

  // Register this card's update handler with parent
  useEffect(() => {
    if (!registerUpdateHandler) return

    const handleUpdate = (state: InteractionState) => {
      if (!state.isActive) {
        // Reset to default
        setScale(1)
        setOpacity(1)
        setVolume(0.5)
        setIsStrong(false)
        if (audioRef.current) {
          audioRef.current.volume = 0.5
        }
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
        // User is dragging towards us - we're winning
        const newVolume = 0.2 + progress * 0.8
        setVolume(newVolume)
        setScale(1 + progress * 0.4)
        setOpacity(1)
        setIsStrong(zone === `strong-${side === 'left' ? 'a' : 'b'}`)
        if (audioRef.current) {
          audioRef.current.volume = newVolume
        }
      } else if (isLosing) {
        // User is dragging away - we're losing
        const newVolume = Math.max(0, 0.2 - progress * 0.2)
        setVolume(newVolume)
        setScale(1 - progress * 0.2)
        setOpacity(1 - progress * 0.6)
        setIsStrong(false)
        if (audioRef.current) {
          audioRef.current.volume = newVolume
        }
      } else {
        setVolume(0.5)
        setScale(1)
        setOpacity(1)
        setIsStrong(false)
        if (audioRef.current) {
          audioRef.current.volume = 0.5
        }
      }
    }

    registerUpdateHandler(handleUpdate)
  }, [registerUpdateHandler, side])

  const togglePlayback = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  return (
    <div
      className='w-40 h-56 md:w-64 md:h-80 transition-transform duration-100 ease-out flex flex-col'
      style={{
        transform: `scale(${scale})`,
        opacity: opacity,
      }}
    >
      {/* Album Art */}
      <div
        className='w-full aspect-square rounded-2xl shadow-2xl flex items-center justify-center border-2 relative overflow-hidden'
        style={{
          borderColor: `${accentColor}40`,
          backgroundColor: '#1f2937',
        }}
      >
        {/* Eclipse Flash Effect */}
        {isStrong && (
          <div className='absolute inset-0 bg-white/30 animate-pulse z-10' />
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

        {/* Play/Pause Button */}
        {track.previewUrl && (
          <button
            onClick={togglePlayback}
            className='absolute bottom-2 right-2 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors z-20'
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className='w-5 h-5 text-white' fill='currentColor' />
            ) : (
              <Play className='w-5 h-5 text-white ml-0.5' fill='currentColor' />
            )}
          </button>
        )}

        {/* Audio Visualizer */}
        <div className='absolute bottom-2 left-2 flex gap-0.5 h-6 items-end z-10'>
          {isPlaying &&
            [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className='w-1 bg-white/70 rounded-full transition-all duration-100'
                style={{
                  height: `${volume * 100 * (0.3 + Math.random() * 0.7)}%`,
                  animation: `pulse ${0.5 + Math.random() * 0.5}s ease-in-out infinite`,
                }}
              />
            ))}
        </div>
      </div>

      {/* Track Info */}
      <div className='mt-3 px-1'>
        <p
          className='font-bold text-sm md:text-base truncate'
          style={{ color: accentColor }}
        >
          {track.title}
        </p>
        <p className='text-xs md:text-sm text-white/60 truncate'>
          {track.artist}
        </p>
      </div>
    </div>
  )
}
