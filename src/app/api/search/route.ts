import { NextRequest, NextResponse } from 'next/server'
import { YouTubeAdapter } from '../../../lib/adapters/youtube'

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title') ?? ''
  const artist = request.nextUrl.searchParams.get('artist') ?? ''

  if (!title) {
    return NextResponse.json({ videoId: null }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ videoId: null }, { status: 503 })
  }

  const adapter = new YouTubeAdapter(apiKey)
  const videoId = await adapter.searchByQuery(title, artist)
  return NextResponse.json({ videoId })
}
