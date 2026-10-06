import { NextRequest, NextResponse } from 'next/server'
import { YouTubeAdapter } from '../../../lib/adapters/youtube'

/** Results fetched per query. `search.list` is 100 quota units whatever we ask for. */
const RESULT_COUNT = 25

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim()

  if (!query) {
    return NextResponse.json({ error: 'Missing search query' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'YouTube API not configured on server' },
      { status: 503 },
    )
  }

  try {
    const adapter = new YouTubeAdapter(apiKey)
    const collection = await adapter.searchCollection(query, RESULT_COUNT)

    if (collection.tracks.length < 2) {
      return NextResponse.json(
        { error: `Not enough songs found for “${query}”` },
        { status: 404 },
      )
    }

    return NextResponse.json(collection)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
