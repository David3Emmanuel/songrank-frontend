'use client'

/* eslint-disable @next/next/no-img-element -- These are blob URLs from the
   canvas, which next/image could not optimise anyway. Image optimisation is off
   app-wide; see next.config.ts. */

/**
 * Every share card the app can draw, on one screen: three shapes against three
 * lengths. For tuning the layout metrics in `lib/shareLayout.ts`, which is where
 * the sizes actually live.
 *
 * The songs are stand-ins whose covers are real YouTube thumbnails, so the
 * artwork loads and crops the way it will in the app. The title and cover
 * pairings are not necessarily the right ones.
 */

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { ShareCardConfig, Track } from '../../lib/types'
import { generateShareCard } from '../../lib/shareCard'

const COVERS = [
  'hDgPW4kIdUI',
  'SLCaLlNMi0Y',
  '5bvJnN6N3qc',
  'AEzwNaCHtzU',
  'NnKLYRu3jKQ',
  'AHNK4k3Cr24',
  'mC3ZiQ-opeg',
  'GNi42nGU6FE',
  '4a9mXpKn924',
  'DfLS0A5IAhk',
]

const SONGS: Array<[string, string, number]> = [
  ['These Walls', 'Kendrick Lamar', 304000],
  ['Rainforest', 'Noname', 219000],
  ["Bitch, Don't Kill My Vibe", 'Kendrick Lamar', 310000],
  ['Majesty', 'Peruzzi', 232000],
  ["Somethin' Ain't Right", 'Release', 268000],
  ['Feeling', 'Noname', 191000],
  ['black mirror', 'Noname', 205000],
  ['Trouble Sleep Yanga Wake Am', 'Noname', 386000],
  ['No Rest for the Wicked', 'Kendrick Lamar', 244000],
  ['No More Lies', 'Thundercat', 168000],
]

const PREVIEW_TRACKS: Track[] = SONGS.map(([title, artist, durationMs], i) => ({
  id: COVERS[i],
  title,
  artist,
  album: '',
  durationMs,
  coverImage: `https://i.ytimg.com/vi/${COVERS[i]}/mqdefault.jpg`,
  externalUrls: { youtube: `https://www.youtube.com/watch?v=${COVERS[i]}` },
}))

const SHAPES: Array<ShareCardConfig['format']> = ['1:1', '9:16', '16:9']
const COUNTS = [3, 5, 10]

/**
 * The densest card, drawn three ways, so the row treatment can be chosen against
 * itself rather than in isolation. The extra two are temporary.
 */
const VARIANTS: Array<{
  key: string
  label: string
  rowText?: 'stacked' | 'inline'
  rowTitleScale?: number
}> = [
  { key: '1:1-10', label: '1:1 · top 10 · artist under' },
  { key: '1:1-10-inline', label: '1:1 · top 10 · artist right', rowText: 'inline' },
  { key: '1:1-10-small', label: '1:1 · top 10 · smaller title', rowTitleScale: 0.78 },
]

export default function SharePreviewPage() {
  const [cards, setCards] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const made: string[] = []

    const run = async () => {
      for (const format of SHAPES) {
        for (const top_n of COUNTS) {
          if (cancelled) return

          try {
            const blob = await generateShareCard({
              tracks: PREVIEW_TRACKS,
              playlistName: 'Preview Mix',
              totalSongs: PREVIEW_TRACKS.length,
              config: { top_n, theme: 'light', format },
            })
            if (cancelled) return

            const url = URL.createObjectURL(blob)
            made.push(url)
            setCards((current) => ({ ...current, [`${format}-${top_n}`]: url }))
          } catch (err) {
            if (!cancelled) {
              setError(err instanceof Error ? err.message : 'Could not draw it')
            }
            return
          }
        }
      }

      // The densest card again, drawn the other two ways.
      for (const variant of VARIANTS) {
        if (cancelled) return

        try {
          const blob = await generateShareCard({
            tracks: PREVIEW_TRACKS,
            playlistName: 'Preview Mix',
            totalSongs: PREVIEW_TRACKS.length,
            config: { top_n: 10, theme: 'light', format: '1:1' },
            rowText: variant.rowText,
            rowTitleScale: variant.rowTitleScale,
          })
          if (cancelled) return

          const url = URL.createObjectURL(blob)
          made.push(url)
          setCards((current) => ({ ...current, [variant.key]: url }))
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'Could not draw it')
          }
          return
        }
      }
    }

    void run()

    return () => {
      cancelled = true
      for (const url of made) URL.revokeObjectURL(url)
    }
  }, [])

  return (
    <main className='min-h-screen bg-slate-100 p-4'>
      <div className='mx-auto grid max-w-[1100px] grid-cols-3 gap-3'>
        {SHAPES.flatMap((format) =>
          COUNTS.map((count) => {
            const key = `${format}-${count}`
            const url = cards[key]

            return (
              <div
                key={key}
                className='flex flex-col items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-2'
              >
                <p className='text-[11px] font-medium text-slate-500'>
                  {format} · top {count}
                </p>
                {url ? (
                  <img
                    src={url}
                    alt={`${format} card with ${count} songs`}
                    className='h-[210px] w-auto rounded-md border border-slate-200'
                  />
                ) : (
                  <div className='flex h-[210px] w-[140px] items-center justify-center text-slate-300'>
                    <Loader2 size={20} className='animate-spin' />
                  </div>
                )}
              </div>
            )
          }),
        )}
      </div>

      {/* The same card, three ways, to choose the row treatment against itself */}
      <div className='mx-auto mt-3 grid max-w-[1100px] grid-cols-3 gap-3'>
        {VARIANTS.map((variant) => {
          const url = cards[variant.key]

          return (
            <div
              key={variant.key}
              className='flex flex-col items-center gap-1.5 rounded-xl border border-slate-300 bg-white p-2'
            >
              <p className='text-[11px] font-medium text-slate-500'>
                {variant.label}
              </p>
              {url ? (
                <img
                  src={url}
                  alt={variant.label}
                  className='h-[210px] w-auto rounded-md border border-slate-200'
                />
              ) : (
                <div className='flex h-[210px] w-[140px] items-center justify-center text-slate-300'>
                  <Loader2 size={20} className='animate-spin' />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <p className='mt-4 text-center text-sm text-rose-700'>{error}</p>
      )}
    </main>
  )
}
