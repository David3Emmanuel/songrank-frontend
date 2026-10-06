/**
 * THROWAWAY demo. Not linked from anywhere and not part of the app.
 *
 * The settled treatment: bands plus score-coloured cards at tint 0.12. This
 * round varies how many songs are in the list, to see how it holds up as it
 * grows. Rows are a fixed height and the list scrolls, like the real sidebar, so
 * the three columns are directly comparable.
 *
 * Scores are invented on the +1 to -1 scale. Some songs have no picks, which puts
 * them at 0 like the real ranker. Delete this route once the lengths are checked.
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
const LEVITATING = 'https://i.scdn.co/image/ab67616d00001e02c88bae7846e62a8ba59ee0bd'
const GOOD_4_U = 'https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a'
const HEAT_WAVES = 'https://i.scdn.co/image/ab67616d00001e029e495fb707973f3390850eea'
const COVERS = [AFTER_HOURS, LEVITATING, GOOD_4_U, HEAT_WAVES]

const POOL = [
  { title: 'These Walls', artist: 'Kendrick Lamar' },
  { title: 'Rainforest', artist: 'Noname' },
  { title: "Bitch, Don't Kill My Vibe", artist: 'Kendrick Lamar' },
  { title: 'Majesty', artist: 'Peruzzi' },
  { title: "Somethin' Ain't Right", artist: 'Release' },
  { title: 'Feeling', artist: 'Noname' },
  { title: 'black mirror', artist: 'Noname' },
  { title: 'Trouble Sleep Yanga Wake Am', artist: 'Noname' },
  { title: 'No Rest for the Wicked', artist: 'Kendrick Lamar' },
  { title: 'No More Lies', artist: 'Thundercat' },
  { title: 'Blinding Lights', artist: 'The Weeknd' },
  { title: 'Save Your Tears', artist: 'The Weeknd' },
  { title: 'Levitating', artist: 'Dua Lipa' },
  { title: 'Good 4 U', artist: 'Olivia Rodrigo' },
  { title: 'Heat Waves', artist: 'Glass Animals' },
  { title: 'Alright', artist: 'Kendrick Lamar' },
  { title: 'Telephone', artist: 'Noname' },
  { title: 'Come Down', artist: 'Anderson .Paak' },
  { title: 'Them Changes', artist: 'Thundercat' },
  { title: 'Dang!', artist: 'Mac Miller' },
]

/** Uneven separations, so clusters and clear drops both appear at any length. */
const GAP_PATTERN = [
  0.34, 0.06, 0.09, 0.28, 0.05, 0.07, 0.22, 0.04, 0.12, 0.08, 0.18, 0.05, 0.06,
  0.2, 0.09, 0.04, 0.15, 0.07, 0.11,
]
const TOP_SCORE = 0.95
const SPAN = 1.85

/** A list of n songs, spread across the scale, with some still unpicked. */
function buildRows(n: number): Row[] {
  const gaps = GAP_PATTERN.slice(0, Math.max(1, n - 1))
  const scale = SPAN / gaps.reduce((sum, gap) => sum + gap, 0)

  const scores = [TOP_SCORE]
  gaps.forEach((gap) => scores.push(scores[scores.length - 1] - gap * scale))

  const unpicked = new Set<number>()
  for (let k = 0; k < Math.round(n * 0.15); k++) {
    unpicked.add(Math.floor(n / 2) + k)
  }

  return POOL.slice(0, n)
    .map((entry, i) => ({
      ...entry,
      cover: COVERS[i % COVERS.length],
      score: unpicked.has(i) ? 0 : scores[i],
      picks: unpicked.has(i) ? 0 : Math.max(1, Math.round((n - i) / 2)),
    }))
    .sort((a, b) => b.score - a.score)
}

const GREEN = [16, 185, 129]
const AMBER = [245, 158, 11]
const RED = [244, 63, 94]
const TINT = 0.12

/** +1 is green, -1 is red, 0 is amber, clamped outside the scale. */
function scoreColor(score: number, alpha: number): string {
  const t = Math.min(1, Math.max(0, (score + 1) / 2))
  const [from, to, local] =
    t < 0.5 ? [RED, AMBER, t / 0.5] : [AMBER, GREEN, (t - 0.5) / 0.5]
  const rgb = from.map((channel, i) => Math.round(channel + (to[i] - channel) * local))
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

/** Band boundaries: a gap of at least half the largest, below a picked row. */
function bandFlags(rows: Row[]): boolean[] {
  const gaps = rows.map((row, i) => (i === 0 ? 0 : rows[i - 1].score - row.score))
  const maxGap = Math.max(...gaps)
  return rows.map((row, i) => i > 0 && row.picks > 0 && gaps[i] >= maxGap * 0.5)
}

function RankRow({ row, rank }: { row: Row; rank: number }) {
  const unmeasured = row.picks === 0
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

  return (
    <div
      className={`flex shrink-0 items-center gap-2 overflow-hidden rounded-lg border p-2 shadow-sm ${
        unmeasured
          ? 'border-slate-200/60 bg-slate-100/80'
          : `border-slate-200/80 ${rank <= 3 ? 'ring-1 ring-yellow-500/40' : ''}`
      }`}
      style={{
        height: 48,
        backgroundColor: unmeasured ? undefined : scoreColor(row.score, TINT),
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
        className={`h-8 w-8 shrink-0 overflow-hidden rounded bg-slate-100/80 ${
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

function Sidebar({ label, size }: { label: string; size: number }) {
  const rows = buildRows(size)
  const bands = bandFlags(rows)

  return (
    <div className='flex h-full min-w-0 flex-col overflow-hidden border-l border-slate-200/80 bg-white/70 backdrop-blur-md'>
      <div className='border-b border-slate-200 p-4'>
        <span className='text-[10px] font-semibold text-slate-300'>{label}</span>
        <div className='mt-1 flex items-center gap-2'>
          <Trophy size={20} className='text-amber-500' />
          <h3 className='text-lg font-bold'>Current Rankings</h3>
        </div>
        <p className='text-sm text-slate-500'>{size} songs</p>
      </div>

      <div className='flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-3'>
        {rows.map((row, i) => (
          <div key={row.title} className='contents'>
            {bands[i] && (
              <div className='flex shrink-0 items-center' style={{ height: 12 }}>
                <div className='h-px w-full bg-slate-300' />
              </div>
            )}
            <RankRow row={row} rank={i + 1} />
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
      <Sidebar label='5' size={5} />
      <Sidebar label='10' size={10} />
      <Sidebar label='20' size={20} />
    </main>
  )
}
