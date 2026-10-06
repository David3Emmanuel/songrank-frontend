import { NextRequest, NextResponse } from 'next/server'
import { YouTubeAdapter } from '../../../lib/adapters/youtube'

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title') ?? ''
  const artist = request.nextUrl.searchParams.get('artist') ?? ''

  if (!title) {
    return NextResponse.json({ videoIds: [] }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ videoIds: [] }, { status: 503 })
  }

  const adapter = new YouTubeAdapter(apiKey)
  const videoIds = await adapter.findAlternatives(title, artist)
  return NextResponse.json({ videoIds })
}
