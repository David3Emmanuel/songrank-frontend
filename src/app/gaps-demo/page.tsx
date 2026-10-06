/**
 * THROWAWAY demo. Not linked from anywhere and not part of the app.
 *
 * The chosen treatment: bands (3) plus score-coloured cards (5), at three tint
 * strengths so the strength can be picked. Scores are invented on the +1 to -1
 * scale the colour assumes. A row nobody has picked stays grey.
 *
 * Delete this route once the strength is chosen.
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
  { title: 'Blinding Lights', artist: 'The Weeknd', cover: AFTER_HOURS, score: 0.9, picks: 4 },
  { title: 'Save Your Tears', artist: 'The Weeknd', cover: AFTER_HOURS, score: 0.78, picks: 4 },
  {
    title: 'Levitating',
    artist: 'Dua Lipa',
    cover: 'https://i.scdn.co/image/ab67616d00001e02c88bae7846e62a8ba59ee0bd',
    score: 0.2,
    picks: 3,
  },
  { title: 'No More Lies', artist: 'Thundercat', cover: '', score: 0, picks: 0 },
  {
    title: 'Good 4 U',
    artist: 'Olivia Rodrigo',
    cover: 'https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a',
    score: -0.05,
    picks: 2,
  },
  {
    title: 'Heat Waves',
    artist: 'Glass Animals',
    cover: 'https://i.scdn.co/image/ab67616d00001e029e495fb707973f3390850eea',
    score: -0.55,
    picks: 1,
  },
]

const GREEN = [16, 185, 129]
const AMBER = [245, 158, 11]
const RED = [244, 63, 94]

/**
 * +1 is green, -1 is red, 0 is amber, clamped outside the scale. Proportional, so
 * two songs that scored nearly the same get nearly the same colour.
 */
function scoreColor(score: number, alpha: number): string {
  const t = Math.min(1, Math.max(0, (score + 1) / 2))
  const [from, to, local] =
    t < 0.5 ? [RED, AMBER, t / 0.5] : [AMBER, GREEN, (t - 0.5) / 0.5]
  const rgb = from.map((channel, i) => Math.round(channel + (to[i] - channel) * local))
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

// Separation between neighbours. A boundary only counts if the row below it has
// actually been picked.
const GAPS = ROWS.map((row, i) => (i === 0 ? 0 : ROWS[i - 1].score - row.score))
const MAX_GAP = Math.max(...GAPS)
const BAND_GAP = MAX_GAP * 0.5
const startsBand = (i: number) => i > 0 && ROWS[i].picks > 0 && GAPS[i] >= BAND_GAP

function RankRow({
  row,
  rank,
  alpha,
}: {
  row: Row
  rank: number
  alpha: number
}) {
  const unmeasured = row.picks === 0
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

  return (
    <div
      className={`relative flex items-center gap-2 overflow-hidden rounded-lg border p-2 shadow-sm ${
        unmeasured
          ? 'border-slate-200/60 bg-slate-100/80'
          : `border-slate-200/80 bg-white/70 ${rank <= 3 ? 'ring-1 ring-yellow-500/40' : ''}`
      }`}
      style={{
        flexGrow: 1,
        flexBasis: 0,
        minHeight: 48,
        backgroundColor: unmeasured ? undefined : scoreColor(row.score, alpha),
      }}
    >
      <div className='w-8 shrink-0 text-center'>
        {medal && !unmeasured ? (
          <span className='text-xl'>{medal}</span>
        ) : (
          <span
            className={`text-sm font-semibold ${
              unmeasured ? 'text-slate-300' : 'text-slate-500'
            }`}
          >
            #{rank}
          </span>
        )}
      </div>

      <div
        className={`h-10 w-10 shrink-0 overflow-hidden rounded bg-slate-100/80 ${
          unmeasured ? 'opacity-60' : ''
        }`}
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
            unmeasured ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          {row.artist}
        </p>
      </div>

      <div className='shrink-0 text-right'>
        <div
          className={`text-xs font-bold ${
            unmeasured ? 'text-slate-300' : 'text-slate-700'
          }`}
        >
          {unmeasured ? '–' : row.score.toFixed(2)}
        </div>
      </div>
    </div>
  )
}

function Sidebar({
  label,
  alpha,
}: {
  label: string
  alpha: number
}) {
  return (
    <div className='flex h-full min-w-0 flex-col overflow-hidden border-l border-slate-200/80 bg-white/70 backdrop-blur-md'>
      <div className='border-b border-slate-200 p-4'>
        <span className='text-[10px] font-semibold text-slate-300'>{label}</span>
        <div className='mt-1 flex items-center gap-2'>
          <Trophy size={20} className='text-amber-500' />
          <h3 className='text-lg font-bold'>Current Rankings</h3>
        </div>
        <p className='text-sm text-slate-500'>9 comparisons</p>
      </div>

      <div className='flex min-h-0 flex-1 flex-col gap-1.5 p-3'>
        {ROWS.map((row, i) => (
          <div key={row.title} className='contents'>
            {startsBand(i) && (
              <div className='flex shrink-0 items-center' style={{ height: 14 }}>
                <div className='h-px w-full bg-slate-300' />
              </div>
            )}
            <RankRow row={row} rank={i + 1} alpha={alpha} />
          </div>
        ))}
      </div>

      <div className='border-t border-slate-200 p-3 text-center text-xs text-slate-500'>
        Rankings update after each vote
      </div>
    </div>
  )
}

export default function GapsDemoPage() {
  return (
    <main className='grid h-screen grid-cols-3 bg-gradient-to-b from-white to-sky-50 text-slate-900'>
      <Sidebar label='0.12' alpha={0.12} />
      <Sidebar label='0.18' alpha={0.18} />
      <Sidebar label='0.24' alpha={0.24} />
    </main>
  )
}
