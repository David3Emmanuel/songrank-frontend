/**
 * THROWAWAY demo. Not linked from anywhere and not part of the app.
 *
 * Two copies of the real rankings sidebar plus their combination. 1 (height),
 * 2 (air) and 4 (bars) are rejected and gone.
 *
 * Scores are invented on the scale the colour assumes: +1 is the best a song can
 * score, -1 the worst. A song's colour comes from its own score, so two songs
 * that scored almost the same get almost the same colour whatever their rank.
 * A row nobody has picked has no score, so it stays grey.
 *
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

/** Colours for the ends of the scale and its middle. */
const GREEN = [16, 185, 129]
const AMBER = [245, 158, 11]
const RED = [244, 63, 94]
const TINT_ALPHA = 0.32

/**
 * +1 is green, -1 is red, 0 is amber. Anything outside the scale is clamped, so
 * a runaway score cannot invent a colour the legend does not have.
 */
function scoreColor(score: number, alpha = TINT_ALPHA): string {
  const t = Math.min(1, Math.max(0, (score + 1) / 2))
  const [from, to, local] =
    t < 0.5 ? [RED, AMBER, t / 0.5] : [AMBER, GREEN, (t - 0.5) / 0.5]
  const rgb = from.map((channel, i) => Math.round(channel + (to[i] - channel) * local))
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

// Separation between neighbours, for the band rule. A boundary only counts if
// the row below it has actually been picked.
const GAPS = ROWS.map((row, i) => (i === 0 ? 0 : ROWS[i - 1].score - row.score))
const MAX_GAP = Math.max(...GAPS)
const BAND_GAP = MAX_GAP * 0.5
const startsBand = (i: number) =>
  i > 0 && ROWS[i].picks > 0 && GAPS[i] >= BAND_GAP

function RankRow({
  row,
  rank,
  colored = false,
}: {
  row: Row
  rank: number
  colored?: boolean
}) {
  const unmeasured = row.picks === 0
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null

  return (
    <div
      className={`relative flex items-center gap-2 overflow-hidden rounded-lg border p-2 shadow-sm ${
        unmeasured
          ? 'border-slate-200/60 bg-slate-100/80'
          : `border-slate-200/80 ${rank <= 3 ? 'ring-1 ring-yellow-500/40' : ''}`
      } ${!unmeasured && !colored ? 'bg-white/70' : ''}`}
      style={{
        flexGrow: 1,
        flexBasis: 0,
        minHeight: 48,
        backgroundColor:
          !unmeasured && colored ? scoreColor(row.score) : undefined,
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

function Sidebar({ n, children }: { n: string; children: React.ReactNode }) {
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
          <RankRow row={row} rank={i + 1} />
        </div>
      ))}
    </div>
  )
}

/** 5. Each card coloured by its own score on the +1 to -1 scale. */
function ColorVariant() {
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-1.5'>
      {ROWS.map((row, i) => (
        <RankRow key={row.title} row={row} rank={i + 1} colored />
      ))}
    </div>
  )
}

/** 3 and 5 together: bands plus the score colours. */
function BandAndColorVariant() {
  return (
    <div className='flex min-h-0 flex-1 flex-col gap-1.5'>
      {ROWS.map((row, i) => (
        <div key={row.title} className='contents'>
          {startsBand(i) && (
            <div className='flex shrink-0 items-center' style={{ height: 14 }}>
              <div className='h-px w-full bg-slate-300' />
            </div>
          )}
          <RankRow row={row} rank={i + 1} colored />
        </div>
      ))}
    </div>
  )
}

export default function GapsDemoPage() {
  return (
    <main className='grid h-screen grid-cols-3 bg-gradient-to-b from-white to-sky-50 text-slate-900'>
      <Sidebar n='3'>
        <BandVariant />
      </Sidebar>
      <Sidebar n='5'>
        <ColorVariant />
      </Sidebar>
      <Sidebar n='3 + 5'>
        <BandAndColorVariant />
      </Sidebar>
    </main>
  )
}
