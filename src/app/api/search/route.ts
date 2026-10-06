import { NextRequest, NextResponse } from 'next/server'
import { YouTubeAdapter } from '../../../lib/adapters/youtube'

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get('title') ?? ''
  const artist = request.nextUrl.searchParams.get('artist') ?? ''

  if (!title) {
    return NextResponse.json({ candidates: [] }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ candidates: [] }, { status: 503 })
  }

  const adapter = new YouTubeAdapter(apiKey)
  // Ids alone are not enough to hand a slot: what is playing has to be the same
  // song, and only the caller knows which one it wants.
  const candidates = await adapter.findAlternatives(title, artist)
  return NextResponse.json({ candidates })
}
