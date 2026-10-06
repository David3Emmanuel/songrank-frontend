import { NextRequest, NextResponse } from 'next/server'
import {
  YouTubeAdapter,
  YouTubeApiError,
} from '../../../lib/adapters/youtube'

/** Results fetched per query. `search.list` is 100 quota units whatever we ask for. */
const RESULT_COUNT = 25

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim()

  if (!query) {
    return NextResponse.json(
      { error: 'Type something to search for and give it another go.' },
      { status: 400 },
    )
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'Searching is not switched on for this server yet, so nothing came back.',
      },
      { status: 503 },
    )
  }

  try {
    const adapter = new YouTubeAdapter(apiKey)
    const collection = await adapter.searchCollection(query, RESULT_COUNT)

    // One song is a fine addition now that lists are built up over time, so only
    // a completely empty answer is worth reporting.
    if (collection.tracks.length === 0) {
      return NextResponse.json(
        {
          error: `Nothing musical came back for “${query}”. Try an artist, an album, or fewer words.`,
        },
        { status: 404 },
      )
    }

    return NextResponse.json(collection)
  } catch (err) {
    if (err instanceof YouTubeApiError) {
      // The reason is logged rather than shown: it is written for developers.
      console.error('YouTube search refused:', err.status, err.message)
      return NextResponse.json(
        {
          error:
            'YouTube turned that search down. That usually means the API key is wrong or today’s quota is used up.',
        },
        { status: 502 },
      )
    }

    const message = err instanceof Error ? err.message : 'Search failed'
    console.error('Search failed:', message)
    return NextResponse.json(
      { error: 'That search did not work. Give it another go in a moment.' },
      { status: 500 },
    )
  }
}
