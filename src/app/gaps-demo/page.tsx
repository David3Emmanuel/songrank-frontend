/**
 * THROWAWAY demo. Not linked from anywhere and not part of the app.
 *
 * Same ten rows, same order, four ways of showing the gaps between them. Scores
 * are invented. The faint number per row is a checking aid for the mapping.
 * Delete this route once one is chosen.
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

// Viewport relative, so every column fits the screen without scrolling.
const ROW_BASE = '4.6vh'
const HEIGHT_EXTRA = 6
const AIR_EXTRA = 4.6
const RULE_SPACE = 2
const BAR_TRACK = 70

const rowHeight = (i: number) =>
  `calc(${ROW_BASE} + ${(norm(GAPS[i]) * HEIGHT_EXTRA).toFixed(2)}vh)`

function RowContent({ row, rank }: { row: Row; rank: number }) {
  return (
    <div className='flex items-center gap-2.5 px-3'>
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

function Column({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <section className='flex h-full min-w-0 flex-col overflow-hidden p-2'>
      <span className='mb-1 shrink-0 px-1 text-[10px] font-semibold text-slate-300'>
        {n}
      </span>
      <div className='min-h-0 flex-1'>{children}</div>
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
          style={{ height: rowHeight(i) }}
        >
          <div className='flex h-full items-center'>
            <RowContent row={row} rank={i + 1} />
          </div>
        </div>
      ))}
    </>
  )
}

/** 2. Fixed rows, with space inserted above in proportion to the gap. */
function AirVariant() {
  return (
    <>
      {ROWS.map((row, i) => (
        <div
          key={row.title}
          className='rounded-lg border border-slate-100 bg-white'
          style={{
            height: ROW_BASE,
            marginTop: i === 0 ? 0 : `${(norm(GAPS[i]) * AIR_EXTRA).toFixed(2)}vh`,
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
            <div className='' style={{ height: `${RULE_SPACE}vh` }}>
              <div className='h-px w-full translate-y-[50%] bg-slate-200' />
            </div>
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
            <div className='px-3 pb-1.5'>
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
  return (
    <main className='grid h-screen grid-cols-4 divide-x divide-slate-200 bg-gradient-to-b from-white to-sky-50 text-slate-900'>
      <Column n={1}>
        <HeightVariant />
      </Column>
      <Column n={2}>
        <AirVariant />
      </Column>
      <Column n={3}>
        <BandVariant />
      </Column>
      <Column n={4}>
        <BarVariant />
      </Column>
    </main>
  )
}
