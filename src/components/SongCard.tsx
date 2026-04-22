'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { Music } from 'lucide-react'
import YouTube, { type YouTubePlayer, type YouTubeProps } from '../lib/youtube'
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
}

export default function SongCard({
  track,
  side = 'left',
  accentColor = side === 'left' ? '#10b981' : '#3b82f6',
  registerUpdateHandler,
  numberOfBars = 20,
}: SongCardProps) {
  const [scale, setScale] = useState(1)
  const [opacity, setOpacity] = useState(1)
  const [volume, setVolume] = useState(0.5)
  const [isStrong, setIsStrong] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isFallbackLoading, setIsFallbackLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [fallbackVideoId, setFallbackVideoId] = useState<string | null>(null)

  const playerRef = useRef<YouTubePlayer | null>(null)

  const opts: YouTubeProps['opts'] = {
    height: '1',
    width: '1',
    playerVars: {
      autoplay: 1,
      playsinline: 1,
      controls: 0,
      disablekb: 1,
    },
  }

  // Reset loading/error state whenever the video ID changes (react-youtube
  // reuses the existing iframe and calls loadVideoById, so onReady won't fire
  // again — we have to reset manually here).
  const videoId = track.externalUrls?.youtube
    ? track.externalUrls.youtube.split('v=')[1]?.split('&')[0] || track.id
    : track.id

  // Full reset whenever the base video changes (new track in the pair)
  useEffect(() => {
    setFallbackVideoId(null)
    setIsFallbackLoading(false)
    setIsLoading(true)
    setHasError(false)
    setIsPlaying(false)
  }, [videoId])

  // The ID actually fed to the player — fallback overrides base when set
  const activeVideoId = fallbackVideoId ?? videoId

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target
    event.target.setVolume(volume * 100)
    event.target.playVideo()
  }

  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    // YouTube IFrame API states: -1 unstarted, 1 playing, 2 paused,
    // 3 buffering, 5 video cued
    const state = event.data
    setIsPlaying(state === 1)
    setIsLoading(state === -1 || state === 3)
    if (state === 1) setHasError(false)
  }

  const onPlayerError: YouTubeProps['onError'] = async () => {
    // If the fallback itself failed, give up
    if (fallbackVideoId) {
      setIsFallbackLoading(false)
      setIsLoading(false)
      setHasError(true)
      return
    }

    // First failure — search for a playable alternative
    setIsFallbackLoading(true)
    try {
      const params = new URLSearchParams({ title: track.title, artist: track.artist })
      const res = await fetch(`/api/search?${params}`)
      const data = await res.json()
      if (data.videoId) {
        setFallbackVideoId(data.videoId)
        setIsLoading(true)
        setIsFallbackLoading(false)
      } else {
        setIsFallbackLoading(false)
        setIsLoading(false)
        setHasError(true)
      }
    } catch {
      setIsFallbackLoading(false)
      setIsLoading(false)
      setHasError(true)
    }
  }

  // Clean up player on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.pauseVideo()
      }
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
        if (playerRef.current) {
          playerRef.current.setVolume(50)
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
        if (playerRef.current) {
          playerRef.current.setVolume(newVolume * 100)
        }
      } else if (isLosing) {
        // User is dragging away - we're losing
        const newVolume = Math.max(0, 0.2 - progress * 0.2)
        setVolume(newVolume)
        setScale(1 - progress * 0.2)
        setOpacity(1 - progress)
        setIsStrong(false)
        if (playerRef.current) {
          playerRef.current.setVolume(newVolume * 100)
        }
      } else {
        setVolume(0.5)
        setScale(1)
        setOpacity(1)
        setIsStrong(false)
        if (playerRef.current) {
          playerRef.current.setVolume(50)
        }
      }
    }

    registerUpdateHandler(handleUpdate)
  }, [registerUpdateHandler, side])

  return (
    <>
      {/* Hidden YouTube Player */}
      <div
        className='absolute'
        style={{ top: '-9999px', left: '-9999px', visibility: 'hidden' }}
      >
        <YouTube
          videoId={activeVideoId}
          opts={opts}
          onReady={onPlayerReady}
          onStateChange={onPlayerStateChange}
          onError={onPlayerError}
        />
      </div>

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
    </>
  )
}
