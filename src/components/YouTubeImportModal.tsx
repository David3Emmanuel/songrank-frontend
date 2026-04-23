'use client'

import { useState } from 'react'
import { X, Youtube, Link as LinkIcon, Loader2 } from 'lucide-react'
import type { Track } from '../lib/types'

interface YouTubeImportModalProps {
  onImport: (tracks: Track[], name?: string) => void
  onClose: () => void
}

export default function YouTubeImportModal({
  onImport,
  onClose,
}: YouTubeImportModalProps) {
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImport = async () => {
    setError(null)
    setIsLoading(true)
    try {
      const res = await fetch(
        `/api/playlist?id=${encodeURIComponent(playlistUrl.trim())}`,
      )
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Failed to import playlist')
        return
      }

      onImport(data.tracks, data.name ?? '')
      onClose()
    } catch {
      setError('Failed to import playlist. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
      <div className='bg-slate-900/95 backdrop-blur-md rounded-2xl p-6 max-w-md w-full border border-white/20'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 rounded-full bg-red-600 flex items-center justify-center'>
              <Youtube size={24} className='text-white' />
            </div>
            <h2 className='text-2xl font-bold text-white'>
              Import from YouTube
            </h2>
          </div>
          <button
            onClick={onClose}
            className='w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors'
            aria-label='Close'
          >
            <X size={20} className='text-white' />
          </button>
        </div>

        {/* Form */}
        <div className='space-y-4'>
          {/* Playlist URL Input */}
          <div>
            <label className='block text-white/80 text-sm font-medium mb-2'>
              Playlist URL or ID
            </label>
            <input
              type='text'
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && playlistUrl.trim() && handleImport()}
              placeholder='https://youtube.com/playlist?list=...'
              className='w-full bg-white/5 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-red-500 transition-colors'
            />
            <p className='text-xs text-white/40 mt-1'>
              Paste the full URL or just the playlist ID
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className='bg-red-600/20 border border-red-500/30 rounded-lg p-3'>
              <p className='text-sm text-red-200'>{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className='flex gap-3 pt-2'>
            <button
              onClick={handleImport}
              disabled={isLoading || !playlistUrl.trim()}
              className='flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2'
            >
              {isLoading ? (
                <>
                  <Loader2 size={20} className='animate-spin' />
                  Importing...
                </>
              ) : (
                <>
                  <LinkIcon size={20} />
                  Import Playlist
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={isLoading}
              className='px-6 bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors'
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
