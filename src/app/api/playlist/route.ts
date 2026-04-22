import { NextRequest, NextResponse } from 'next/server'
import { YouTubeAdapter, extractYouTubePlaylistId } from '../../../lib/adapters/youtube'

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('id') ?? ''
  const playlistId = extractYouTubePlaylistId(raw)

  if (!playlistId) {
    return NextResponse.json({ error: 'Invalid playlist URL or ID' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'YouTube API not configured on server' }, { status: 503 })
  }

  try {
    const adapter = new YouTubeAdapter(apiKey)
    const playlist = await adapter.getPlaylist(playlistId)

    if (playlist.tracks.length === 0) {
      return NextResponse.json({ error: 'No tracks found in playlist' }, { status: 404 })
    }

    return NextResponse.json(playlist)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch playlist'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
