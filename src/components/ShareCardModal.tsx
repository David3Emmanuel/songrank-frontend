'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Download, Loader2, Share2, Sliders, X } from 'lucide-react'
import type { Track, SongRanking, ShareCardConfig } from '../lib/types'
import { downloadBlob, generateShareCard, shareImage } from '../lib/shareCard'

interface ShareCardModalProps {
  rankings: SongRanking[]
  tracks: Track[]
  playlistName?: string
  onClose: () => void
}

/** Light and square by default, like the rest of the app. */
const DEFAULT_CONFIG: ShareCardConfig = {
  top_n: 3,
  theme: 'light',
  format: '1:1',
}

export default function ShareCardModal({
  rankings,
  tracks,
  playlistName = 'My ranking',
  onClose,
}: ShareCardModalProps) {
  const [config, setConfig] = useState<ShareCardConfig>(DEFAULT_CONFIG)
  const [showOptions, setShowOptions] = useState(false)
  const [card, setCard] = useState<Blob | null>(null)
  const [isGenerating, setIsGenerating] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<'shared' | 'saved' | null>(null)
  /** The first card is drawn at once; later changes wait for a pause. */
  const drawnOnce = useRef(false)

  const topTracks = useMemo(
    () =>
      rankings
        .slice(0, config.top_n)
        .map((ranking) => {
          const track = tracks.find((t) => t.id === ranking.Song)
          return { ranking, track: track! }
        })
        .filter((item) => item.track),
    [rankings, tracks, config.top_n],
  )

  // An object URL for whatever card is current, released when it is replaced.
  const previewUrl = useMemo(
    () => (card ? URL.createObjectURL(card) : null),
    [card],
  )
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  // Changing an option redraws the card, so the loading state is raised here
  // rather than inside the effect that does the drawing.
  const updateConfig = (patch: Partial<ShareCardConfig>) => {
    setIsGenerating(true)
    setError(null)
    setConfig((current) => ({ ...current, ...patch }))
  }

  // The card draws itself as soon as the modal opens, and again whenever an
  // option changes, so there is never a Generate button to press first. Only the
  // first draw is immediate: later changes wait briefly, so clicking through the
  // options a few times redraws once instead of once per click.
  useEffect(() => {
    let cancelled = false
    const delay = drawnOnce.current ? 200 : 0

    const timer = setTimeout(() => {
      drawnOnce.current = true

      generateShareCard(topTracks, config, playlistName)
        .then((blob) => {
          if (!cancelled) setCard(blob)
        })
        .catch((err) => {
          console.error('Failed to generate share card:', err)
          if (!cancelled) {
            setError('Could not draw the card. Try another shape.')
          }
        })
        .finally(() => {
          if (!cancelled) setIsGenerating(false)
        })
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [topTracks, playlistName, config])

  // A short confirmation, then back to normal.
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => setDone(null), 2000)
    return () => clearTimeout(timer)
  }, [done])

  const canShare =
    typeof navigator !== 'undefined' &&
    Boolean(navigator.share) &&
    Boolean(navigator.canShare)

  const save = () => {
    if (!card) return
    downloadBlob(card, `songrank-top-${config.top_n}.png`)
    setDone('saved')
  }

  const share = async () => {
    if (!card) return
    const outcome = await shareImage(
      card,
      `My top ${config.top_n} songs`,
      `My top ${config.top_n} from ${playlistName}`,
    )
    // A dismissed share sheet is not a failure, and must not save anything.
    if (outcome === 'shared') setDone('shared')
    if (outcome === 'unsupported') save()
  }

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-sm'
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className='my-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-xl backdrop-blur-md'>
        <div className='mb-4 flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <h2 className='text-lg font-bold text-slate-900'>
              Share your ranking
            </h2>
            <p className='truncate text-sm text-slate-500'>{playlistName}</p>
          </div>
          <button
            onClick={onClose}
            className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 transition-colors hover:bg-slate-200'
            aria-label='Close'
          >
            <X size={18} className='text-slate-600' />
          </button>
        </div>

        {/* The card itself, drawn before anything is asked of the user */}
        <div className='flex justify-center rounded-xl border border-slate-200 bg-slate-50 p-3'>
          <div className='relative flex max-h-[52vh] min-h-52 items-center justify-center overflow-hidden'>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt='Share card preview'
                className={`max-h-[50vh] w-auto rounded-lg transition-opacity ${
                  isGenerating ? 'opacity-50' : 'opacity-100'
                }`}
              />
            ) : (
              <Loader2 size={24} className='animate-spin text-slate-400' />
            )}
          </div>
        </div>

        {error && <p className='mt-3 text-sm text-rose-700'>{error}</p>}

        {/* Actions first, options second */}
        <div className='mt-4 flex gap-3'>
          {canShare && (
            <button
              onClick={share}
              disabled={!card || isGenerating}
              className='flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 py-3 font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-40'
            >
              {done === 'shared' ? <Check size={20} /> : <Share2 size={20} />}
              {done === 'shared' ? 'Shared' : 'Share'}
            </button>
          )}
          <button
            onClick={save}
            disabled={!card || isGenerating}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-3 font-semibold transition-colors disabled:opacity-40 ${
              canShare
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {done === 'saved' ? <Check size={20} /> : <Download size={20} />}
            {done === 'saved' ? 'Saved' : 'Save image'}
          </button>
        </div>

        <button
          onClick={() => setShowOptions((value) => !value)}
          className='mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700'
        >
          <Sliders size={16} />
          {showOptions ? 'Hide options' : 'Customise'}
        </button>

        {showOptions && (
          <div className='mt-2 space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4'>
            <div>
              <p className='mb-2 text-sm font-medium text-slate-600'>Songs</p>
              <div className='flex gap-2'>
                {[3, 5, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => updateConfig({ top_n: n })}
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                      config.top_n === n
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className='mb-2 text-sm font-medium text-slate-600'>Shape</p>
              <div className='flex gap-2'>
                {[
                  { value: '1:1', label: 'Square' },
                  { value: '9:16', label: 'Story' },
                  { value: '16:9', label: 'Wide' },
                ].map((format) => (
                  <button
                    key={format.value}
                    onClick={() =>
                      updateConfig({
                        format: format.value as ShareCardConfig['format'],
                      })
                    }
                    className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                      config.format === format.value
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {format.label}
                  </button>
                ))}
              </div>
            </div>

            <div className='flex items-center justify-between'>
              <span className='text-sm font-medium text-slate-600'>Style</span>
              <div className='flex gap-2'>
                {(['light', 'dark'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => updateConfig({ theme })}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                      config.theme === theme
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
