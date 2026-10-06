'use client'

import {
  labelForPlayerState,
  type PlaybackPhase,
  type SlotIntent,
} from '../lib/playerSlots'

export interface DebugSlotRow {
  index: number
  group: 0 | 1
  title: string
  videoId: string
  isFallback: boolean
  /** What the pool has decided this slot should be doing. */
  intent: SlotIntent
  /** What the player itself reports. Disagreement with `intent` is the bug. */
  ytState: number | null
  currentTime: number | null
  volume: number | null
}

export interface PlayerDebugHudProps {
  rows: DebugSlotRow[]
  activeGroup: 0 | 1
  phase: PlaybackPhase
}

/**
 * Per-slot state for the pool, behind `?debug=players`.
 *
 * The pool's bugs are audible rather than visible, and "a song kept playing"
 * cannot be diagnosed from a description. This turns the whole pool into four
 * rows: what each slot was told to do, what its player actually reports, and how
 * far in it is.
 */
export default function PlayerDebugHud({
  rows,
  activeGroup,
  phase,
}: PlayerDebugHudProps) {
  return (
    <div className='pointer-events-none fixed bottom-2 left-2 z-[9999] max-w-[96vw] overflow-hidden rounded-lg border border-white/20 bg-black/85 p-2 font-mono text-[10px] leading-tight text-white/90 shadow-2xl'>
      <div className='mb-1 text-white/50'>
        pool · activeGroup={activeGroup} · phase={phase} · debug=players
      </div>
      <table className='border-collapse'>
        <thead>
          <tr className='text-white/40'>
            <th className='pr-2 text-left font-normal'>slot</th>
            <th className='pr-2 text-left font-normal'>g</th>
            <th className='pr-2 text-left font-normal'>intent</th>
            <th className='pr-2 text-left font-normal'>player</th>
            <th className='pr-2 text-right font-normal'>pos</th>
            <th className='pr-2 text-right font-normal'>vol</th>
            <th className='text-left font-normal'>track</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            // The two states that should never be seen: an off-screen slot
            // making noise, or a slot that was told to play and isn't.
            const leaking = row.intent !== 'playing' && row.ytState === 1
            const stalled = row.intent === 'playing' && row.ytState === 2
            return (
              <tr
                key={row.index}
                className={
                  leaking
                    ? 'text-red-400'
                    : stalled
                      ? 'text-amber-300'
                      : row.intent === 'playing'
                        ? 'text-emerald-300'
                        : 'text-white/70'
                }
              >
                <td className='pr-2'>{row.index}</td>
                <td className='pr-2'>{row.group}</td>
                <td className='pr-2'>{row.intent}</td>
                <td className='pr-2'>
                  {labelForPlayerState(row.ytState)}
                  {leaking ? ' ←LEAK' : ''}
                  {stalled ? ' ←stalled' : ''}
                </td>
                <td className='pr-2 text-right'>
                  {row.currentTime === null ? '—' : row.currentTime.toFixed(1)}
                </td>
                <td className='pr-2 text-right'>
                  {row.volume === null ? '—' : row.volume}
                </td>
                <td className='max-w-[180px] truncate'>
                  {row.title || '—'}
                  {row.isFallback ? ' (fallback)' : ''}
                  <span className='text-white/30'> {row.videoId || '—'}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
