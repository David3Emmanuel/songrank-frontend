'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { Music } from 'lucide-react'
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

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio
  useEffect(() => {
    if (track.previewUrl) {
      audioRef.current = new Audio(track.previewUrl)
      audioRef.current.loop = true
      audioRef.current.volume = 0.5

      // Auto-play
      audioRef.current.play().catch(() => {
        // Auto-play blocked, user needs to interact first
      })
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [track.previewUrl])

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
        setOpacity(1 - progress)
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

  return (
    <div
      className='w-40 h-40 md:w-64 md:h-64 transition-transform duration-100 ease-out flex flex-col items-center justify-center'
      style={{
        transform: `scale(${scale})`,
        opacity: opacity,
      }}
    >
      <div
        className='w-full h-full rounded-2xl shadow-2xl flex items-center justify-center border-2 border-white/10 relative overflow-hidden'
        style={{
          backgroundColor: '#1f2937',
        }}
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

        {/* Audio Visualizer */}
        <div className='absolute bottom-4 left-0 right-0 flex justify-center gap-1 h-8 items-end'>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className='w-1 bg-white/50 rounded-full transition-all duration-100'
              style={{
                height: `${volume * 100 * Math.random()}%`,
              }}
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
