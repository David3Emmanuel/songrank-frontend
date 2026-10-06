/**
 * THROWAWAY demo. Not linked from anywhere and not part of the app.
 *
 * Three copies of the real rankings sidebar, same size, same markup as
 * LiveRankings. Column numbers match the earlier round: 2 (air) and 4 (bars)
 * were rejected, so they are gone.
 *
 * Scores are invented and span negative to positive. Covers are the demo
 * playlist's own. A row nobody has picked looks disabled rather than saying so.
 * Delete this route once a variant is chosen.
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

const AFTER_HOURS = 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36'

const ROWS: Row[] = [
  { title: 'Blinding Lights', artist: 'The Weeknd', cover: AFTER_HOURS, score: 2.8, picks: 4 },
  { title: 'Save Your Tears', artist: 'The Weeknd', cover: AFTER_HOURS, score: 2.6, picks: 4 },
  {
    title: 'Levitating',
    artist: 'Dua Lipa',
    cover: 'https://i.scdn.co/image/ab67616d00001e02c88bae7846e62a8ba59ee0bd',
    score: 1.2,
    picks: 3,
  },
  { title: 'No More Lies', artist: 'Thundercat', cover: '', score: 0, picks: 0 },
  {
    title: 'Good 4 U',
    artist: 'Olivia Rodrigo',
    cover: 'https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a',
    score: 0,
    picks: 2,
  },
  {
    title: 'Heat Waves',
    artist: 'Glass Animals',
    cover: 'https://i.scdn.co/image/ab67616d00001e029e495fb707973f3390850eea',
    score: -1.4,
    picks: 1,
  },
]

// The full score range, negatives included, so nothing is clipped at zero.
const SCORES = ROWS.map((row) => row.score)
const MIN_SCORE = Math.min(...SCORES)
const MAX_SCORE = Math.max(...SCORES)
/** 0 at the worst score, 1 at the best. */
const rankStrength = (score: number) =>
  MAX_SCORE === MIN_SCORE ? 0.5 : (score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE)

// Separation between neighbours, for the band rule.
const GAPS = ROWS.map((row, i) => (i === 0 ? 0 : ROWS[i - 1].score - row.score))
const MAX_GAP = Math.max(...GAPS)
const BAND_GAP = MAX_GAP * 0.5
const startsBand = (i: number) => i > 0 && GAPS[i] >= BAND_GAP

const GROW_FLOOR = 1
const GROW_SPAN = 2

/** An unpicked row has no measured strength, so it sits at the floor. */
const grow = (row: Row) =>
  GROW_FLOOR + (row.picks === 0 ? 0 : rankStrength(row.score) * GROW_SPAN)

const LIST_GRADIENT =
  'linear-gradient(to bottom, rgba(16, 185, 129, 0.30) 0%, rgba(245, 158, 11, 0.24) 50%, rgba(244, 63, 94, 0.30) 100%)'

function RankRow({
  row,
  rank,
  className = '',
  style,
}: {
  row: Row
  rank: number
  className?: string
  style?: React.CSSProperties
}) {
  const unmeasured = row.picks === 0
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

  return (
    <div
      className={`relative flex items-center gap-2 overflow-hidden rounded-lg border p-2 shadow-sm backdrop-blur-md ${
        unmeasured
          ? 'border-slate-200/60 bg-slate-100/80'
          : `border-slate-200/80 bg-white/70 ${rank <= 3 ? 'ring-1 ring-yellow-500/40' : ''}`
      } ${className}`}
      style={style}
    >
      <div className='w-8 shrink-0 text-center'>
        {medal && !unmeasured ? (
          <span className='text-xl'>{medal}</span>
        ) : (
          <span
            className={`text-sm font-semibold ${
              unmeasured ? 'text-slate-300' : 'text-slate-400'
            }`}
          >
            #{rank}
          </span>
        )}
      </div>

      <div
        className={`h-10 w-10 shrink-0 overflow-hidden rounded ${
          unmeasured ? 'bg-slate-100' : 'bg-slate-100 text-slate-300'
        } ${unmeasured ? 'opacity-60' : ''}`}
      >
        <TrackArtwork src={row.cover} alt={row.title} />
      </div>

      <div className='min-w-0 flex-1'>
        <h4
          className={`truncate text-sm leading-tight font-semibold ${
            unmeasured ? 'text-slate-400' : 'text-slate-900'
          }`}
        >
          {row.title}
        </h4>
        <p
          className={`truncate text-xs leading-tight ${
            unmeasured ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          {row.artist}
        </p>
      </div>

      <div className='shrink-0 text-right'>
        <div
          className={`text-xs font-bold ${
            unmeasured ? 'text-slate-300' : 'text-slate-600'
          }`}
        >
          {unmeasured ? '–' : row.score.toFixed(1)}
        </div>
      </div>
    </div>
  )
}

function Sidebar({ n, children }: { n: number; children: React.ReactNode }) {
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

      <div className='flex min-h-0 flex-1 flex-col p-3'>{children}</div>

      <div className='border-t border-slate-200 p-3 text-center text-xs text-slate-500'>
        Rankings update after each vote
      </div>
    </div>
  )
}

/** 1. Row height follows the score itself, across the full range. */
function HeightByScoreVariant() {
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-1.5'>
      {ROWS.map((row, i) => (
        <RankRow
          key={row.title}
          row={row}
          rank={i + 1}
          style={{ flexGrow: grow(row), flexBasis: 0, minHeight: 48 }}
        />
      ))}
    </div>
  )
}

/** 3. Equal rows, split wherever the separation is at least half the largest. */
function BandVariant() {
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-1.5'>
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
            style={{ flexGrow: 1, flexBasis: 0, minHeight: 48 }}
          />
        </div>
      ))}
    </div>
  )
}

/** 5. One vertical gradient behind the list, green at the best, red at the worst. */
function GradientVariant() {
  return (
    <div
      className='flex min-h-0 flex-1 flex-col gap-1.5 rounded-lg'
      style={{ backgroundImage: LIST_GRADIENT }}
    >
      {ROWS.map((row, i) => (
        <RankRow
          key={row.title}
          row={row}
          rank={i + 1}
          style={{ flexGrow: 1, flexBasis: 0, minHeight: 48 }}
        />
      ))}
    </div>
  )
}

export default function GapsDemoPage() {
  return (
    <main className='grid h-screen grid-cols-3 bg-gradient-to-b from-white to-sky-50 text-slate-900'>
      <Sidebar n={1}>
        <HeightByScoreVariant />
      </Sidebar>
      <Sidebar n={3}>
        <BandVariant />
      </Sidebar>
      <Sidebar n={5}>
        <GradientVariant />
      </Sidebar>
    </main>
  )
}
