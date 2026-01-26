'use client'

import { useState } from 'react'
import { Download, Share2, X, Loader2 } from 'lucide-react'
import type { Track, SongRanking, ShareCardConfig } from '../lib/types'
import {
  generateShareCard,
  downloadDataUrl,
  shareDataUrl,
} from '../lib/shareCard'

interface ShareCardModalProps {
  rankings: SongRanking[]
  tracks: Track[]
  playlistName?: string
  onClose: () => void
}

export default function ShareCardModal({
  rankings,
  tracks,
  playlistName = 'My Playlist',
  onClose,
}: ShareCardModalProps) {
  const [config, setConfig] = useState<ShareCardConfig>({
    top_n: 3,
    include_stats: true,
    theme: 'dark',
    format: '9:16',
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const topTracks = rankings
        .slice(0, config.top_n)
        .map((ranking) => {
          const track = tracks.find((t) => t.id === ranking.Song)
          return { ranking, track: track! }
        })
        .filter((item) => item.track)

      const dataUrl = await generateShareCard(topTracks, config, playlistName)
      setPreviewUrl(dataUrl)
    } catch (error) {
      console.error('Failed to generate share card:', error)
      alert('Failed to generate image. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!previewUrl) return
    downloadDataUrl(previewUrl, `songrank-top-${config.top_n}.png`)
  }

  const handleShare = async () => {
    if (!previewUrl) return
    const shared = await shareDataUrl(
      previewUrl,
      `My Top ${config.top_n} Songs`,
      `Check out my top ${config.top_n} songs from ${playlistName}!`,
    )
    if (!shared) {
      // Fallback to download if share not supported
      handleDownload()
    }
  }

  return (
    <div className='fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto'>
      <div className='bg-slate-800 rounded-2xl p-6 max-w-2xl w-full border border-white/10 my-8'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <h2 className='text-2xl font-bold text-white'>Create Share Card</h2>
          <button
            onClick={onClose}
            className='w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors'
            aria-label='Close'
          >
            <X size={20} className='text-white' />
          </button>
        </div>

        {/* Configuration */}
        <div className='space-y-4 mb-6'>
          {/* Top N */}
          <div>
            <label className='block text-white/80 text-sm font-medium mb-2'>
              Number of Songs
            </label>
            <div className='flex gap-2'>
              {[3, 5, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => setConfig({ ...config, top_n: n })}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    config.top_n === n
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  Top {n}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className='block text-white/80 text-sm font-medium mb-2'>
              Format
            </label>
            <div className='flex gap-2'>
              {[
                { value: '9:16', label: 'Story (9:16)' },
                { value: '1:1', label: 'Square (1:1)' },
                { value: '16:9', label: 'Wide (16:9)' },
              ].map((format) => (
                <button
                  key={format.value}
                  onClick={() =>
                    setConfig({
                      ...config,
                      format: format.value as ShareCardConfig['format'],
                    })
                  }
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    config.format === format.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {format.label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className='block text-white/80 text-sm font-medium mb-2'>
              Theme
            </label>
            <div className='flex gap-2'>
              {[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ].map((theme) => (
                <button
                  key={theme.value}
                  onClick={() =>
                    setConfig({
                      ...config,
                      theme: theme.value as 'dark' | 'light',
                    })
                  }
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    config.theme === theme.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-white/60 hover:bg-white/20'
                  }`}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          {/* Include Stats */}
          <div className='flex items-center gap-3'>
            <input
              type='checkbox'
              id='include-stats'
              checked={config.include_stats}
              onChange={(e) =>
                setConfig({ ...config, include_stats: e.target.checked })
              }
              className='w-5 h-5 rounded border-white/30 bg-white/10 checked:bg-emerald-600'
            />
            <label htmlFor='include-stats' className='text-white/80'>
              Include ranking scores
            </label>
          </div>
        </div>

        {/* Generate Button */}
        {!previewUrl && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className='w-full bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2'
          >
            {isGenerating ? (
              <>
                <Loader2 size={20} className='animate-spin' />
                Generating...
              </>
            ) : (
              <>Generate Card</>
            )}
          </button>
        )}

        {/* Preview */}
        {previewUrl && (
          <div className='space-y-4'>
            <div className='bg-white/5 rounded-lg p-4 max-h-96 overflow-auto'>
              <img
                src={previewUrl}
                alt='Share card preview'
                className='w-full h-auto rounded-lg'
              />
            </div>

            {/* Action Buttons */}
            <div className='flex gap-3'>
              <button
                onClick={handleDownload}
                className='flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg transition-colors'
              >
                <Download size={20} />
                Download
              </button>
              <button
                onClick={handleShare}
                className='flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors'
              >
                <Share2 size={20} />
                Share
              </button>
            </div>

            {/* Regenerate */}
            <button
              onClick={() => setPreviewUrl(null)}
              className='w-full bg-white/10 hover:bg-white/20 text-white font-semibold py-2 rounded-lg transition-colors'
            >
              Change Settings
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
