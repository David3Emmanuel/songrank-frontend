/**
 * THROWAWAY demo. Not linked from anywhere and not part of the app.
 *
 * Four copies of the real rankings sidebar, side by side. Every column is the
 * same size and the rows use the same markup as LiveRankings, so the only thing
 * that differs between them is how the space inside is distributed.
 *
 * Scores are invented, covers are the demo playlist's own. Delete this route
 * once one variant is chosen.
 */

import TrackArtwork from '../../components/TrackArtwork'
import { Trophy } from 'lucide-react'

type Row = {
  title: string
  artist: string
  cover: string
  score: number
  picks: number
}

const ROWS: Row[] = [
  {
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    cover: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
    score: 2.8,
    picks: 3,
  },
  {
    title: 'Save Your Tears',
    artist: 'The Weeknd',
    cover: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
    score: 2.6,
    picks: 3,
  },
  {
    title: 'Levitating',
    artist: 'Dua Lipa',
    cover: 'https://i.scdn.co/image/ab67616d00001e02c88bae7846e62a8ba59ee0bd',
    score: 1.2,
    picks: 2,
  },
  {
    title: 'Good 4 U',
    artist: 'Olivia Rodrigo',
    cover: 'https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a',
    score: 1.1,
    picks: 2,
  },
  {
    title: 'Heat Waves',
    artist: 'Glass Animals',
    cover: 'https://i.scdn.co/image/ab67616d00001e029e495fb707973f3390850eea',
    score: 0,
    picks: 0,
  },
]

// The gap above each row. A row nobody has picked has no measurable gap, so it
// is left out of both the scale and the spacing.
const GAPS = ROWS.map((row, i) => (i === 0 ? 0 : ROWS[i - 1].score - row.score))
const REAL_GAPS = GAPS.filter((_, i) => i > 0 && ROWS[i].picks > 0)
const MAX_GAP = Math.max(...REAL_GAPS)
const MEDIAN_GAP = [...REAL_GAPS].sort((a, b) => a - b)[
  Math.floor(REAL_GAPS.length / 2)
]

const weight = (i: number) =>
  ROWS[i].picks === 0 ? 0 : Math.max(0, GAPS[i]) / MAX_GAP

const startsBand = (i: number) =>
  i > 0 && ROWS[i].picks > 0 && GAPS[i] >= 2 * MEDIAN_GAP

const ROW_NATURAL = 52

function RankRow({
  row,
  rank,
  className = '',
  style,
  barFraction,
}: {
  row: Row
  rank: number
  className?: string
  style?: React.CSSProperties
  barFraction?: number
}) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

  return (
    <div
      className={`relative flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/70 p-2 shadow-sm backdrop-blur-md ${
        rank <= 3 ? 'ring-1 ring-yellow-500/40' : ''
      } ${className}`}
      style={style}
    >
      <div className='w-8 shrink-0 text-center'>
        {medal ? (
          <span className='text-xl'>{medal}</span>
        ) : (
          <span className='text-sm font-semibold text-slate-400'>#{rank}</span>
        )}
      </div>

      <div className='h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-100 text-slate-300'>
        <TrackArtwork src={row.cover} alt={row.title} />
      </div>

      <div className='min-w-0 flex-1'>
        <h4 className='truncate text-sm leading-tight font-semibold'>{row.title}</h4>
        <p className='truncate text-xs leading-tight text-slate-500'>{row.artist}</p>
      </div>

      {row.picks === 0 ? (
        <span className='shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700'>
          not picked yet
        </span>
      ) : (
        <div className='shrink-0 text-right'>
          <div className='text-xs font-bold text-slate-600'>
            {row.score.toFixed(1)}
          </div>
        </div>
      )}

      {barFraction !== undefined && (
        <div className='absolute inset-x-2 bottom-1 h-0.5 rounded-full bg-slate-200'>
          <div
            className='h-0.5 rounded-full bg-slate-400'
            style={{ width: `${barFraction * 100}%` }}
          />
        </div>
      )}
    </div>
  )
}

function Sidebar({
  n,
  children,
}: {
  n: number
  children: React.ReactNode
}) {
  return (
    <div className='flex h-full min-w-0 flex-col overflow-hidden border-l border-slate-200/80 bg-white/70 backdrop-blur-md'>
      <div className='border-b border-slate-200 p-4'>
        <span className='text-[10px] font-semibold text-slate-300'>{n}</span>
        <div className='mt-1 flex items-center gap-2'>
          <Trophy size={20} className='text-amber-500' />
          <h3 className='text-lg font-bold'>Current Rankings</h3>
        </div>
        <p className='text-sm text-slate-500'>9 comparisons</p>
      </div>

      <div className='flex min-h-0 flex-1 flex-col gap-1.5 p-3'>{children}</div>

      <div className='border-t border-slate-200 p-3 text-center text-xs text-slate-500'>
        Rankings update after each vote
      </div>
    </div>
  )
}

/** 1. The row gets taller where the gap above it is bigger. */
function HeightVariant() {
  return (
    <>
      {ROWS.map((row, i) => (
        <RankRow
          key={row.title}
          row={row}
          rank={i + 1}
          style={{ flexGrow: 1 + weight(i), flexBasis: 0, minHeight: ROW_NATURAL }}
        />
      ))}
    </>
  )
}

/** 2. Fixed rows, with the leftover space handed to the gaps. */
function AirVariant() {
  return (
    <>
      {ROWS.map((row, i) => (
        <div key={row.title} className='contents'>
          {i > 0 && (
            <div
              style={{ flexGrow: weight(i) * 3, flexBasis: 0, minHeight: 0 }}
              aria-hidden
            />
          )}
          <RankRow
            row={row}
            rank={i + 1}
            className='shrink-0'
            style={{ height: ROW_NATURAL, flex: '0 0 auto' }}
          />
        </div>
      ))}
    </>
  )
}

/** 3. Equal rows, grouped wherever the gap is well above typical. */
function BandVariant() {
  return (
    <>
      {ROWS.map((row, i) => (
        <div key={row.title} className='contents'>
          {startsBand(i) && (
            <div className='flex shrink-0 items-center' style={{ height: 14 }}>
              <div className='h-px w-full bg-slate-300' />
            </div>
          )}
          <RankRow
            row={row}
            rank={i + 1}
            style={{ flexGrow: 1, flexBasis: 0, minHeight: ROW_NATURAL }}
          />
        </div>
      ))}
    </>
  )
}

/** 4. Equal rows, with the gap drawn as a bar along the bottom of each row. */
function BarVariant() {
  return (
    <>
      {ROWS.map((row, i) => (
        <RankRow
          key={row.title}
          row={row}
          rank={i + 1}
          barFraction={i < ROWS.length - 1 ? weight(i + 1) : 0}
          style={{ flexGrow: 1, flexBasis: 0, minHeight: ROW_NATURAL }}
        />
      ))}
    </>
  )
}

export default function GapsDemoPage() {
  return (
    <main className='grid h-screen grid-cols-4 bg-gradient-to-b from-white to-sky-50 text-slate-900'>
      <Sidebar n={1}>
        <HeightVariant />
      </Sidebar>
      <Sidebar n={2}>
        <AirVariant />
      </Sidebar>
      <Sidebar n={3}>
        <BandVariant />
      </Sidebar>
      <Sidebar n={4}>
        <BarVariant />
      </Sidebar>
    </main>
  )
}
