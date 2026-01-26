'use client'

import { useState } from 'react'
import { RankerProvider, useRanker } from '../context/RankerContext'
import RankingArena from '../components/RankingArena'
import ResultsView from '../components/ResultsView'
import YouTubeImportModal from '../components/YouTubeImportModal'
import { Music2, Play, Sparkles, Youtube } from 'lucide-react'
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
    },
  },
  {
    id: '3',
    title: 'Levitating',
    artist: 'Dua Lipa',
    album: 'Future Nostalgia',
    durationMs: 203064,
    coverImage:
      'https://i.scdn.co/image/ab67616d0000b273fc59e9108992c0c446e72e5c',
    externalUrls: {
      spotify: 'https://open.spotify.com/track/39LLxExYz6ewLAcYrzQQyP',
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
    },
  },
  {
    id: '5',
    title: 'Heat Waves',
    artist: 'Glass Animals',
    album: 'Dreamland',
    durationMs: 238805,
    coverImage:
      'https://i.scdn.co/image/ab67616d0000b27369a3fae1c6b9cb4e15ecf329',
    externalUrls: {
      spotify: 'https://open.spotify.com/track/02MWAaffLxlfxAUY7c5dvx',
    },
  },
]

function DashboardContent() {
  const { initializeRanker, currentPair, isComplete } = useRanker()
  const [showYouTubeImport, setShowYouTubeImport] = useState(false)

  const handleStartDemo = () => {
    initializeRanker(DEMO_TRACKS)
  }

  const handleYouTubeImport = (tracks: Track[]) => {
    initializeRanker(tracks)
  }

  // Show results if complete
  if (isComplete) {
    return <ResultsView />
  }

  // Show ranking arena if session active
  if (currentPair) {
    return <RankingArena />
  }

  // Show dashboard
  return (
    <div className='min-h-screen bg-linear-to-br from-purple-900 via-slate-900 to-indigo-900 text-white flex items-center justify-center p-4'>
      <div className='max-w-2xl w-full'>
        {/* Hero Section */}
        <div className='text-center mb-12'>
          <div className='inline-flex items-center justify-center w-24 h-24 rounded-full bg-linear-to-br from-emerald-400 to-blue-500 mb-6 shadow-2xl'>
            <Music2 size={48} className='text-white' />
          </div>
          <h1 className='text-6xl font-bold mb-4 bg-linear-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent'>
            SongRank
          </h1>
          <p className='text-xl text-white/80 mb-2'>
            Discover your true music preferences
          </p>
          <p className='text-white/60'>
            Swipe to compare. AI learns your taste. Get the perfect ranking.
          </p>
        </div>

        {/* Feature Cards */}
        <div className='grid md:grid-cols-3 gap-4 mb-8'>
          <div className='bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 text-center'>
            <Sparkles className='w-8 h-8 mx-auto mb-3 text-yellow-400' />
            <h3 className='font-semibold mb-1'>Smart Ranking</h3>
            <p className='text-sm text-white/60'>
              Active learning adapts to your taste
            </p>
          </div>
          <div className='bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 text-center'>
            <Play className='w-8 h-8 mx-auto mb-3 text-emerald-400' />
            <h3 className='font-semibold mb-1'>Preview Audio</h3>
            <p className='text-sm text-white/60'>Listen while you compare</p>
          </div>
          <div className='bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 text-center'>
            <Music2 className='w-8 h-8 mx-auto mb-3 text-blue-400' />
            <h3 className='font-semibold mb-1'>Export Results</h3>
            <p className='text-sm text-white/60'>Save to Spotify & share</p>
          </div>
        </div>

        {/* Action Section */}
        <div className='bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8'>
          <h2 className='text-2xl font-bold mb-4'>Get Started</h2>

          {/* Demo Button */}
          <button
            onClick={handleStartDemo}
            className='w-full bg-linear-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-105 mb-4 shadow-lg'
          >
            Try Demo (5 Songs)
          </button>

          {/* Import Options */}
          <div className='space-y-3'>
            <button
              disabled
              className='w-full bg-white/5 border border-white/20 text-white/50 font-semibold py-3 rounded-xl cursor-not-allowed'
            >
              Import from Spotify (Coming Soon)
            </button>
            <button
              onClick={() => setShowYouTubeImport(true)}
              className='w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2'
            >
              <Youtube size={20} />
              Import from YouTube Music
            </button>
          </div>

          <p className='text-xs text-white/40 mt-4 text-center'>
            YouTube import requires a free API key
          </p>
        </div>

        {/* YouTube Import Modal */}
        {showYouTubeImport && (
          <YouTubeImportModal
            onImport={handleYouTubeImport}
            onClose={() => setShowYouTubeImport(false)}
          />
        )}

        {/* Footer */}
        <div className='text-center mt-8 text-white/40 text-sm'>
          <p>Built with Next.js, TypeScript, and Active Learning</p>
        </div>
      </div>
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
