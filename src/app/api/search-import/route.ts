import { NextRequest, NextResponse } from 'next/server'
import { YouTubeAdapter, YouTubeApiError } from '../../../lib/adapters/youtube'
import { YouTubeMusicAdapter } from '../../../lib/adapters/youtubeMusic'
import { createTtlCache, normalizeQuery } from '../../../lib/ttlCache'
import type { GroupedSongCollection } from '../../../lib/adapters/youtube'
import type { MusicSearchEntity } from '../../../lib/innertube'

/** What a search hands back: the playable songs, and every entity beside them. */
type SearchResponse = GroupedSongCollection & { entities: MusicSearchEntity[] }

/** Results fetched per query. Both endpoints cap around this anyway. */
const RESULT_COUNT = 25

/**
 * Typing ahead means the same query arriving more than once, and the upstream
 * call costs around a second, so a short-lived cache makes repeats free. Lives
 * with the server process, which is all this needs.
 */
const searchCache = createTtlCache<SearchResponse>({
  ttlMs: 10 * 60 * 1000,
  maxEntries: 50,
})

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim()

  if (!query) {
    return NextResponse.json(
      { error: 'Type something to search for and give it another go.' },
      { status: 400 },
    )
  }

  const cacheKey = normalizeQuery(query)
  const cached = searchCache.get(cacheKey)
  if (cached) {
    return NextResponse.json(cached, { headers: { 'x-search-cache': 'hit' } })
  }

  // No API key is needed to search: this goes through the music web player's own
  // endpoint. A key only improves the results, by adding track lengths.
  const apiKey = process.env.YOUTUBE_API_KEY

  try {
    const { collection, entities } = await new YouTubeMusicAdapter().searchBoth(
      query,
      RESULT_COUNT,
    )

    if (collection.tracks.length === 0) {
      return NextResponse.json(
        {
          error: `Nothing musical came back for “${query}”. Try an artist, an album, or fewer words.`,
        },
        { status: 404 },
      )
    }

    const filled = apiKey
      ? {
          ...collection,
          tracks: await new YouTubeAdapter(apiKey).fillDetails(
            collection.tracks,
          ),
        }
      : collection

    // A song row that named nobody got a name from the video, so the entity rows
    // are given it too: the list the user reads is the entity list, and it would
    // be odd for the same song to be named in one place and blank in the other.
    const named = new Map(
      filled.tracks
        .filter((track) => track.artist && track.artist !== 'Unknown Artist')
        .map((track) => [track.id, track.artist]),
    )
    const namedEntities = entities.map((entity) =>
      entity.kind === 'song' || entity.kind === 'video'
        ? { ...entity, artist: entity.artist || named.get(entity.id) || '' }
        : entity,
    )

    // The entities ride along with the songs: the client shows the whole result
    // list, and only the songs can be added to a ranking so far.
    const payload: SearchResponse = { ...filled, entities: namedEntities }
    searchCache.set(cacheKey, payload)
    return NextResponse.json(payload, { headers: { 'x-search-cache': 'miss' } })
  } catch (err) {
    if (err instanceof YouTubeApiError) {
      // The reason is logged rather than shown: it is written for developers.
      console.error('Music search refused:', err.status, err.message)
      return NextResponse.json(
        {
          error:
            'YouTube Music turned that search down. That usually means the search endpoint changed and needs updating.',
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
