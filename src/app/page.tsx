'use client'

import { useState } from 'react'
import { RankerProvider, useRanker } from '../context/RankerContext'
import RankingArena from '../components/RankingArena'
import ResultsView from '../components/ResultsView'
import LandingBackground from '../components/LandingBackground'
import YouTubeImportModal from '../components/YouTubeImportModal'
import { Music2 } from 'lucide-react'
import type { Track } from '../lib/types'

// Demo tracks for testing
const DEMO_TRACKS: Track[] = [
  {
    id: '1',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    durationMs: 200040,
    coverImage:
      'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
    externalUrls: {
      spotify: 'https://open.spotify.com/track/0VjIjW4GlUZAMYd2vXMi3b',
      youtube: 'https://www.youtube.com/watch?v=4NRXx6U8ABQ',
    },
  },
  {
    id: '2',
    title: 'Save Your Tears',
    artist: 'The Weeknd',
    album: 'After Hours',
    durationMs: 215626,
    coverImage:
      'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36',
    externalUrls: {
      spotify: 'https://open.spotify.com/track/5QO79kh1waicV47BqGRL3g',
      youtube: 'https://www.youtube.com/watch?v=XXYlFuWEuKI',
    },
  },
  {
    id: '3',
    title: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    durationMs: 203064,
    coverImage:
      'https://i.scdn.co/image/ab67616d00001e02c88bae7846e62a8ba59ee0bd',
    externalUrls: {
      spotify: 'https://open.spotify.com/track/39LLxExYz6ewLAcYrzQQyP',
      youtube: 'https://www.youtube.com/watch?v=TUVcZfQe-Kw',
    },
  },
  {
    id: '4',
    title: 'Good 4 U',
    artist: 'Olivia Rodrigo',
    album: 'SOUR',
    durationMs: 178147,
    coverImage:
      'https://i.scdn.co/image/ab67616d0000b273a91c10fe9472d9bd89802e5a',
    externalUrls: {
      spotify: 'https://open.spotify.com/track/4ZtFanR9U6ndgddUvNcjcG',
      youtube: 'https://www.youtube.com/watch?v=gNi_6U5Pm_o',
    },
  },
  {
    id: '5',
    title: 'Heat Waves',
    artist: 'Glass Animals',
    album: 'Dreamland',
    durationMs: 238805,
    coverImage:
      'https://i.scdn.co/image/ab67616d00001e029e495fb707973f3390850eea',
    externalUrls: {
      spotify: 'https://open.spotify.com/track/02MWAaffLxlfxAUY7c5dvx',
      youtube: 'https://www.youtube.com/watch?v=mRD0-GxqHVo',
    },
  },
]

function DashboardContent() {
  const { initializeRanker, currentPair, isComplete } = useRanker()
  const [showYouTubeImport, setShowYouTubeImport] = useState(false)
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStartDemo = () => {
    initializeRanker(DEMO_TRACKS, 'Demo Mix')
  }

  const handleYouTubeImport = (tracks: Track[], name?: string) => {
    initializeRanker(tracks, name || 'YouTube Playlist')
  }

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed || isSearching) return

    setIsSearching(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/search-import?q=${encodeURIComponent(trimmed)}`,
      )
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Search failed')
      if (!Array.isArray(data.tracks) || data.tracks.length < 2) {
        throw new Error(`Not enough songs found for “${trimmed}”`)
      }

      initializeRanker(data.tracks as Track[], data.name ?? trimmed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  // Show results if complete
  if (isComplete) {
    return <ResultsView />
  }

  // Show ranking arena if session active
  if (currentPair) {
    return <RankingArena />
  }

  return (
    <div className='relative min-h-screen overflow-hidden bg-gradient-to-b from-white to-sky-50 text-slate-900'>
      <LandingBackground />

      <div className='relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16'>
        <header className='animate-rise text-center'>
          <div className='mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-sky-500 text-white shadow-lg shadow-emerald-500/25'>
            <Music2 size={36} />
          </div>
          <h1 className='text-5xl font-bold tracking-tight'>SongRank</h1>
          <p className='mt-3 text-lg text-slate-600'>
            Two songs at a time. Your real ranking at the end.
          </p>
        </header>

        <div className='animate-rise mt-10 space-y-3'>
          <button
            onClick={handleStartDemo}
            className='w-full rounded-2xl bg-slate-900 py-4 font-semibold text-white shadow-lg shadow-slate-900/10 transition-colors hover:bg-slate-800'
          >
            Start with 5 songs
          </button>

          <form onSubmit={handleSearch} className='flex gap-2'>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='An artist or a song title'
              aria-label='Search for songs to rank'
              className='min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-slate-900 outline-none backdrop-blur transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'
            />
            <button
              type='submit'
              disabled={!query.trim() || isSearching}
              className='rounded-2xl bg-emerald-500 px-5 font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40'
            >
              {isSearching ? 'Finding…' : 'Find 25'}
            </button>
          </form>

          <button
            onClick={() => setShowYouTubeImport(true)}
            className='w-full rounded-2xl border border-slate-200 bg-white/70 py-3 font-medium text-slate-600 backdrop-blur transition-colors hover:bg-white'
          >
            Paste a playlist link instead
          </button>
        </div>

        {error && (
          <p className='animate-rise mt-4 text-center text-sm text-rose-600'>
            {error}
          </p>
        )}

        <p className='mt-8 text-center text-xs text-slate-400'>
          Searching and importing use a free YouTube API key, set on the server.
        </p>
      </div>

      {/* YouTube Import Modal */}
      {showYouTubeImport && (
        <YouTubeImportModal
          onImport={handleYouTubeImport}
          onClose={() => setShowYouTubeImport(false)}
        />
      )}
    </div>
  )
}

export default function Home() {
  return (
    <RankerProvider>
      <DashboardContent />
    </RankerProvider>
  )
}
