/**
 * THROWAWAY demo. Not linked from anywhere and not part of the app.
 *
 * One dataset, four ways of showing the same gaps, side by side so they can be
 * judged against each other. Delete this route once one is chosen.
 *
 * The scores are invented, loosely modelled on a 10 song session, so the shapes
 * are realistic. The small numbers on the right are reference only: in the app
 * they would be hidden.
 */

type Row = {
  title: string
  artist: string
  score: number
  picks: number
}

const ROWS: Row[] = [
  { title: 'These Walls', artist: 'Kendrick Lamar', score: 3.4, picks: 5 },
  { title: 'Rainforest', artist: 'Noname', score: 2.1, picks: 5 },
  { title: "Bitch, Don't Kill My Vibe", artist: 'Kendrick Lamar', score: 1.9, picks: 4 },
  { title: 'Majesty', artist: 'Peruzzi', score: 1.75, picks: 4 },
  { title: "Somethin' Ain't Right", artist: 'Release', score: 1.1, picks: 4 },
  { title: 'Feeling', artist: 'Noname', score: 0.55, picks: 3 },
  { title: 'black mirror', artist: 'Noname', score: 0.4, picks: 3 },
  { title: 'Trouble Sleep Yanga Wake Am', artist: 'Noname', score: 0.1, picks: 2 },
  { title: 'No Rest for the Wicked', artist: 'Kendrick Lamar', score: 0.05, picks: 2 },
  { title: 'No More Lies', artist: 'Thundercat', score: 0, picks: 0 },
]

// Gap above each row: how much better the row above it scored.
const GAPS = ROWS.map((row, i) => (i === 0 ? 0 : ROWS[i - 1].score - row.score))
const MAX_GAP = Math.max(...GAPS)
const norm = (gap: number) => (MAX_GAP > 0 ? Math.max(0, gap) / MAX_GAP : 0)

const SORTED_GAPS = GAPS.slice(1).sort((a, b) => a - b)
const MEDIAN_GAP = SORTED_GAPS[Math.floor(SORTED_GAPS.length / 2)]
/** A boundary where the gap is well above typical. */
const startsBand = (i: number) => i > 0 && GAPS[i] >= 2 * MEDIAN_GAP

const ROW_BASE = 34
const HEIGHT_EXTRA = 46
const AIR_EXTRA = 30
const BAR_TRACK = 78

function RowContent({ row, rank }: { row: Row; rank: number }) {
  return (
    <div className='flex items-center gap-2.5 px-2.5'>
      <span className='w-4 shrink-0 text-right text-xs font-semibold text-slate-400'>
        {rank}
      </span>
      <div className='min-w-0 flex-1 leading-tight'>
        <p className='truncate text-sm font-semibold text-slate-800'>{row.title}</p>
        <p className='truncate text-xs text-slate-500'>{row.artist}</p>
      </div>
      {row.picks === 0 && (
        <span className='shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700'>
          not picked yet
        </span>
      )}
      <span className='shrink-0 font-mono text-[10px] text-slate-300'>
        {row.score.toFixed(2)}
      </span>
    </div>
  )
}

function Panel({
  n,
  title,
  mechanism,
  children,
}: {
  n: number
  title: string
  mechanism: string
  children: React.ReactNode
}) {
  return (
    <section className='rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm backdrop-blur-md'>
      <h2 className='text-sm font-bold text-slate-900'>
        {n}. {title}
      </h2>
      <p className='mt-0.5 mb-3 text-xs leading-snug text-slate-500'>{mechanism}</p>
      <div className='space-y-0'>{children}</div>
    </section>
  )
}

/** 1. The row itself gets taller where the gap above it is bigger. */
function HeightVariant() {
  return (
    <>
      {ROWS.map((row, i) => (
        <div
          key={row.title}
          className='rounded-lg border border-slate-100 bg-white'
          style={{ height: ROW_BASE + norm(GAPS[i]) * HEIGHT_EXTRA }}
        >
          <div className='flex h-full items-center'>
            <RowContent row={row} rank={i + 1} />
          </div>
        </div>
      ))}
    </>
  )
}

/** 2. Fixed rows, with space inserted between them in proportion to the gap. */
function AirVariant() {
  return (
    <>
      {ROWS.map((row, i) => (
        <div
          key={row.title}
          className='rounded-lg border border-slate-100 bg-white'
          style={{
            height: ROW_BASE,
            marginTop: i === 0 ? 0 : norm(GAPS[i]) * AIR_EXTRA,
          }}
        >
          <div className='flex h-full items-center'>
            <RowContent row={row} rank={i + 1} />
          </div>
        </div>
      ))}
    </>
  )
}

/** 3. Rows group into bands wherever the gap is well above typical. */
function BandVariant() {
  return (
    <>
      {ROWS.map((row, i) => (
        <div key={row.title}>
          {startsBand(i) && (
            <div className='my-2 h-px bg-slate-200' />
          )}
          <div
            className='rounded-lg border border-slate-100 bg-white'
            style={{ height: ROW_BASE }}
          >
            <div className='flex h-full items-center'>
              <RowContent row={row} rank={i + 1} />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

/** 4. The number replaced by a bar whose length is the gap to the next song. */
function BarVariant() {
  return (
    <>
      {ROWS.map((row, i) => (
        <div
          key={row.title}
          className='rounded-lg border border-slate-100 bg-white'
          style={{ height: ROW_BASE }}
        >
          <div className='flex h-full items-center'>
            <RowContent row={row} rank={i + 1} />
          </div>
          {i < ROWS.length - 1 && (
            <div className='px-2.5 pb-1.5'>
              <div className='h-0.5 rounded-full bg-slate-100' style={{ width: BAR_TRACK }}>
                <div
                  className='h-0.5 rounded-full bg-slate-400'
                  style={{ width: norm(GAPS[i + 1]) * BAR_TRACK }}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  )
}

export default function GapsDemoPage() {
  const bands = ROWS.filter((_, i) => startsBand(i)).length + 1

  return (
    <main className='min-h-screen bg-gradient-to-b from-white to-sky-50 p-6 text-slate-900'>
      <header className='mx-auto mb-5 max-w-[1700px]'>
        <h1 className='text-2xl font-bold'>Four ways to feel the gaps</h1>
        <p className='mt-1 max-w-3xl text-sm text-slate-600'>
          Throwaway screen, same ten rows in the same order in every panel. Gaps
          are normalised against the largest gap in this session and capped, so
          these describe this session only. The faint numbers are here so you can
          check the mapping; in the app they would be gone. The last row has no
          picks at all, which is the case that needs a decision regardless of
          which layout wins.
        </p>
        <p className='mt-2 text-xs text-slate-500'>
          Gaps: {GAPS.slice(1).map((g) => g.toFixed(2)).join(', ')} · median{' '}
          {MEDIAN_GAP.toFixed(2)} · a band starts at twice the median, giving{' '}
          {bands} bands
        </p>
      </header>

      <div className='mx-auto grid max-w-[1700px] grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4'>
        <Panel
          n={1}
          title='Container height'
          mechanism='The row gets taller where the gap above it is bigger. Nothing is added between rows.'
        >
          <HeightVariant />
        </Panel>

        <Panel
          n={2}
          title='Air between rows'
          mechanism='Rows stay the same height. Space is inserted above a row in proportion to the gap.'
        >
          <AirVariant />
        </Panel>

        <Panel
          n={3}
          title='Bands'
          mechanism='A divider wherever the gap is at least twice the median. Inside a band, songs are effectively tied.'
        >
          <BandVariant />
        </Panel>

        <Panel
          n={4}
          title='Gap bars'
          mechanism='The score is replaced by a bar whose length is the gap to the song below.'
        >
          <BarVariant />
        </Panel>
      </div>
    </main>
  )
}
