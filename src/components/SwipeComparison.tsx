'use client'

import { useState, useRef, useEffect, cloneElement } from 'react'
import * as React from 'react'
import { Minus, Heart, Music, ArrowDown } from 'lucide-react'
import type { SongCardProps, InteractionState } from './SongCard'
import type { Feedback } from '../lib/types'

interface SwipeComparisonProps {
  leftCard: React.ReactElement<SongCardProps>
  rightCard: React.ReactElement<SongCardProps>
  neutralFeedback?: string
  onVote?: (feedback: Feedback) => void
}

export default function SwipeComparison({
  leftCard,
  rightCard,
  neutralFeedback = 'Drag to Listen & Rank',
  onVote,
}: SwipeComparisonProps) {
  // State for drag physics
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  // State for game logic
  const [feedback, setFeedback] = useState(neutralFeedback)
  const [zone, setZone] = useState('neutral')
  const [lastVote, setLastVote] = useState<Feedback | null>(null)

  const puckRef = useRef(null)
  const containerRef = useRef(null)

  // Refs to store card update functions
  const leftCardUpdateRef = useRef<((state: InteractionState) => void) | null>(
    null,
  )
  const rightCardUpdateRef = useRef<((state: InteractionState) => void) | null>(
    null,
  )

  // Extract track info from card components
  const leftTrack = leftCard.props.track
  const rightTrack = rightCard.props.track
  const leftCardAccent = leftCard.props.accentColor || '#10b981'
  const rightCardAccent = rightCard.props.accentColor || '#3b82f6'

  // Constants
  const MAX_DRAG_X = 160
  const THRESHOLD_WEAK = 50
  const THRESHOLD_STRONG = 140
  const THRESHOLD_TIE_Y = 100

  // --- MOUSE / TOUCH HANDLERS ---

  const handleStart = (clientX: number, clientY: number) => {
    if (lastVote) return
    setIsDragging(true)
    setDragStart({
      x: clientX - position.x,
      y: clientY - position.y,
    })
  }

  const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX, e.clientY)
  const onTouchStart = (e: React.TouchEvent) =>
    handleStart(e.touches[0].clientX, e.touches[0].clientY)

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return

    const newX = clientX - dragStart.x
    const newY = clientY - dragStart.y

    const clampedX = Math.max(-MAX_DRAG_X, Math.min(MAX_DRAG_X, newX))
    const clampedY = Math.max(-20, Math.min(150, newY))

    setPosition({ x: clampedX, y: clampedY })
    determineZone(clampedX, clampedY)

    updateCardStates(clampedX, clampedY)
  }

  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX, e.clientY)
  const onTouchMove = (e: React.TouchEvent) =>
    handleMove(e.touches[0].clientX, e.touches[0].clientY)

  const handleEnd = () => {
    if (!isDragging) return
    setIsDragging(false)

    // Map zone to Feedback type
    let vote: Feedback | null = null

    if (zone === 'tie') {
      vote = 'Tie'
    } else if (zone === 'strong-a') {
      vote = 'Strong Win A'
    } else if (zone === 'strong-b') {
      vote = 'Strong Win B'
    } else if (zone === 'weak-a') {
      vote = 'Weak Win A'
    } else if (zone === 'weak-b') {
      vote = 'Weak Win B'
    }

    if (vote) {
      setLastVote(vote)
      const displayName =
        vote === 'Tie'
          ? 'Tie'
          : vote.includes('A')
            ? leftTrack.title
            : rightTrack.title
      setFeedback(
        `Voted: ${vote.replace('A', displayName).replace('B', displayName)}`,
      )
      onVote?.(vote)

      // Reset after animation
      setTimeout(() => {
        setLastVote(null)
        setPosition({ x: 0, y: 0 })
        setZone('neutral')
        setFeedback(neutralFeedback)
      }, 1200)
    } else {
      // Bounce back
      setPosition({ x: 0, y: 0 })
      setZone('neutral')
      setFeedback(neutralFeedback)
      updateCardStates(0, 0)
    }
  }

  // --- LOGIC HELPERS ---

  const updateCardStates = (x: number, y: number) => {
    const progress = Math.min(Math.abs(x) / MAX_DRAG_X, 1)
    const direction = x < 0 ? 'left' : x > 0 ? 'right' : 'center'

    const leftState: InteractionState = {
      position: { x, y },
      zone,
      progress,
      direction,
      isActive: isDragging || progress > 0,
      side: 'left',
    }

    const rightState: InteractionState = {
      position: { x, y },
      zone,
      progress,
      direction,
      isActive: isDragging || progress > 0,
      side: 'right',
    }

    leftCardUpdateRef.current?.(leftState)
    rightCardUpdateRef.current?.(rightState)
  }

  const determineZone = (x: number, y: number) => {
    const absX = Math.abs(x)

    // Vertical Priority (Tie)
    if (y > THRESHOLD_TIE_Y) {
      setZone('tie')
      setFeedback('Release to Tie')
      return
    }

    // Horizontal Priority
    if (absX > THRESHOLD_STRONG) {
      if (x < 0) {
        setZone('strong-a')
        setFeedback(`STRONG WIN: ${leftTrack.title}`)
      } else {
        setZone('strong-b')
        setFeedback(`STRONG WIN: ${rightTrack.title}`)
      }
    } else if (absX > THRESHOLD_WEAK) {
      if (x < 0) {
        setZone('weak-a')
        setFeedback(`Weak Win: ${leftTrack.title}`)
      } else {
        setZone('weak-b')
        setFeedback(`Weak Win: ${rightTrack.title}`)
      }
    } else {
      setZone('neutral')
      setFeedback('Peeking...')
    }
  }

  const getBackgroundColor = () => {
    const x = position.x
    const progress = Math.min(Math.abs(x) / MAX_DRAG_X, 1)
    const direction = x < 0 ? 'left' : x > 0 ? 'right' : 'center'

    return direction === 'left'
      ? `rgba(16, 185, 129, ${progress * 0.3})`
      : direction === 'right'
        ? `rgba(59, 130, 246, ${progress * 0.3})`
        : 'rgba(0,0,0,0)'
  }

  useEffect(() => {
    const handleGlobalEnd = () => {
      if (isDragging) handleEnd()
    }

    window.addEventListener('mouseup', handleGlobalEnd)
    window.addEventListener('touchend', handleGlobalEnd)

    return () => {
      window.removeEventListener('mouseup', handleGlobalEnd)
      window.removeEventListener('touchend', handleGlobalEnd)
    }
  }, [isDragging, zone])

  return (
    <div
      className='w-full h-full bg-slate-900 text-white overflow-hidden flex flex-col font-sans select-none relative'
      onMouseMove={onMouseMove}
      onTouchMove={onTouchMove}
      ref={containerRef}
    >
      {/* Dynamic Background Overlay */}
      <div
        className='absolute inset-0 transition-colors duration-100 ease-linear pointer-events-none'
        style={{ backgroundColor: getBackgroundColor() }}
      />

      {/* --- HEADER --- */}
      <div className='absolute top-0 left-0 right-0 p-6 text-center z-10 pointer-events-none'>
        <h2
          className={`text-xl font-bold tracking-wider transition-all duration-200 ${
            zone.includes('strong') ? 'scale-110 text-white' : 'text-white/70'
          }`}
        >
          {feedback}
        </h2>
        <div className='flex justify-center gap-1 mt-2'>
          <div
            className={`w-2 h-2 rounded-full ${
              zone === 'neutral' ? 'bg-white' : 'bg-white/20'
            }`}
          />
          <div
            className={`w-2 h-2 rounded-full ${
              zone.includes('weak') ? 'bg-white' : 'bg-white/20'
            }`}
          />
          <div
            className={`w-2 h-2 rounded-full ${
              zone.includes('strong') ? 'bg-white' : 'bg-white/20'
            }`}
          />
        </div>
      </div>

      {/* --- MAIN STAGE --- */}
      <div className='flex-1 flex items-center justify-center relative w-full max-w-4xl mx-auto px-4'>
        {/* LEFT CARD */}
        <div className='absolute left-[5%] md:left-[15%]'>
          {cloneElement(leftCard, {
            side: 'left' as const,
            accentColor: leftCardAccent,
            registerUpdateHandler: (
              handler: (state: InteractionState) => void,
            ) => {
              leftCardUpdateRef.current = handler
            },
          })}
        </div>

        {/* RIGHT CARD */}
        <div className='absolute right-[5%] md:right-[15%]'>
          {cloneElement(rightCard, {
            side: 'right' as const,
            accentColor: rightCardAccent,
            registerUpdateHandler: (
              handler: (state: InteractionState) => void,
            ) => {
              rightCardUpdateRef.current = handler
            },
          })}
        </div>

        {/* --- THE PUCK (CONTROLLER) --- */}
        {lastVote ? (
          // SUCCESS STATE
          <div className='z-50 flex flex-col items-center animate-bounce'>
            <div className='w-32 h-32 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.5)]'>
              {lastVote === 'Tie' ? (
                <Minus size={48} />
              ) : (
                <Heart size={48} className='fill-current text-red-500' />
              )}
            </div>
          </div>
        ) : (
          // DRAGGABLE PUCK
          <div
            ref={puckRef}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            style={{
              transform: `translate(${position.x}px, ${position.y}px)`,
              cursor: isDragging ? 'grabbing' : 'grab',
              transition: isDragging
                ? 'none'
                : 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            className='z-50 w-24 h-24 md:w-32 md:h-32 rounded-full bg-white/10 backdrop-blur-md border border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex items-center justify-center relative touch-none hover:bg-white/20 transition-colors'
          >
            {/* Center Icon */}
            {zone === 'neutral' && (
              <Music className='text-white opacity-80' size={32} />
            )}
            {zone === 'tie' && <Minus className='text-white' size={40} />}
            {(zone === 'weak-a' || zone === 'strong-a') && (
              <div
                className='font-black text-2xl'
                style={{ color: leftCardAccent }}
              >
                {leftTrack.title.charAt(0)}
              </div>
            )}
            {(zone === 'weak-b' || zone === 'strong-b') && (
              <div
                className='font-black text-2xl'
                style={{ color: rightCardAccent }}
              >
                {rightTrack.title.charAt(0)}
              </div>
            )}

            {/* Ring Progress Indicator */}
            <div
              className={`absolute inset-0 rounded-full border-4 transition-all duration-200 ${
                zone.includes('strong')
                  ? 'border-white opacity-100 scale-110'
                  : zone.includes('weak')
                    ? 'border-white/50 opacity-100'
                    : 'border-transparent opacity-0'
              }`}
            />
          </div>
        )}
      </div>

      {/* --- TIE ZONE (BOTTOM) --- */}
      <div
        className={`h-32 flex flex-col items-center justify-end pb-8 transition-opacity duration-300 ${
          zone === 'tie' ? 'opacity-100' : 'opacity-30'
        }`}
      >
        <div
          className={`w-16 h-16 rounded-full border-2 border-dashed border-white flex items-center justify-center transition-all ${
            zone === 'tie' ? 'scale-125 bg-white/10 border-solid' : ''
          }`}
        >
          <ArrowDown size={24} />
        </div>
        <p className='text-xs uppercase tracking-widest mt-2'>Drop to Tie</p>
      </div>
    </div>
  )
}
