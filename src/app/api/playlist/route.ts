import { NextRequest, NextResponse } from 'next/server'
import {
  YouTubeAdapter,
  YouTubeApiError,
  extractYouTubePlaylistId,
} from '../../../lib/adapters/youtube'

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('id') ?? ''
  const playlistId = extractYouTubePlaylistId(raw)

  if (!playlistId) {
    return NextResponse.json(
      {
        error:
          'That does not look like a playlist link. Copy it from the address bar and try again.',
      },
      { status: 400 },
    )
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'Imports are not switched on for this server yet, so nothing came back.',
      },
      { status: 503 },
    )
  }

  try {
    const adapter = new YouTubeAdapter(apiKey)
    const playlist = await adapter.getPlaylist(playlistId)

    if (playlist.tracks.length === 0) {
      return NextResponse.json(
        {
          error:
            'That playlist came back empty. If it is private, it has to be shared before it can be read.',
        },
        { status: 404 },
      )
    }

    return NextResponse.json(playlist)
  } catch (err) {
    if (err instanceof YouTubeApiError) {
      console.error('YouTube playlist refused:', err.status, err.message)
      return NextResponse.json(
        {
          error:
            'YouTube turned that request down. That usually means the API key is wrong or today’s quota is used up.',
        },
        { status: 502 },
      )
    }

    const message = err instanceof Error ? err.message : 'Import failed'
    if (message === 'Playlist not found') {
      return NextResponse.json(
        {
          error:
            'No playlist by that link. Check it is the one you meant, and that it is public or unlisted.',
        },
        { status: 404 },
      )
    }

    console.error('Playlist import failed:', message)
    return NextResponse.json(
      { error: 'That import did not work. Give it another go in a moment.' },
      { status: 500 },
    )
  }
}
