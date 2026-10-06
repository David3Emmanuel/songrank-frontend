import { NextRequest, NextResponse } from 'next/server'
import { YouTubeAdapter, YouTubeApiError } from '../../../lib/adapters/youtube'
import { YouTubeMusicAdapter } from '../../../lib/adapters/youtubeMusic'
import { createTtlCache } from '../../../lib/ttlCache'
import type { GroupedSongCollection } from '../../../lib/adapters/youtube'

/** Songs taken from one page. Enough for an album, an EP or an artist's top list. */
const RESULT_COUNT = 50

/**
 * The ids an entity page can carry, by the kind of thing it is.
 *
 * Checked rather than trusted: this id goes straight into an upstream request, so
 * anything that is not one of these shapes is refused before it gets there.
 */
const ID_PATTERNS: Record<string, RegExp> = {
  album: /^MPREb_[\w-]{5,}$/,
  single: /^MPREb_[\w-]{5,}$/,
  artist: /^UC[\w-]{10,}$/,
  playlist: /^(VL)?[\w-]{10,}$/,
}

/**
 * Opening a thing costs about a second upstream, and the same album is likely to
 * be opened again in the same session, so it is cached like a search is.
 */
const browseCache = createTtlCache<GroupedSongCollection>({
  ttlMs: 10 * 60 * 1000,
  maxEntries: 50,
})

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')?.trim() ?? ''
  const kind = request.nextUrl.searchParams.get('kind')?.trim() ?? ''
  const title = request.nextUrl.searchParams.get('title')?.trim() ?? ''

  const pattern = ID_PATTERNS[kind]
  if (!pattern || !pattern.test(id)) {
    return NextResponse.json(
      { error: 'That is not something this can open.' },
      { status: 400 },
    )
  }

  const cacheKey = `${kind}:${id}`
  const cached = browseCache.get(cacheKey)
  if (cached) {
    return NextResponse.json(cached, { headers: { 'x-browse-cache': 'hit' } })
  }

  // A key is not needed to read the page. It only improves the result, by naming
  // the artist and adding lengths the page left out.
  const apiKey = process.env.YOUTUBE_API_KEY

  try {
    const collection = await new YouTubeMusicAdapter().browseCollection(
      id,
      title || 'This',
      RESULT_COUNT,
    )

    if (collection.tracks.length === 0) {
      return NextResponse.json(
        { error: 'That one has no songs this can play.' },
        { status: 404 },
      )
    }

    const filled = apiKey
      ? {
          ...collection,
          tracks: await new YouTubeAdapter(apiKey).fillDetails(collection.tracks),
        }
      : collection

    browseCache.set(cacheKey, filled)
    return NextResponse.json(filled, {
      headers: { 'x-browse-cache': 'miss' },
    })
  } catch (err) {
    if (err instanceof YouTubeApiError) {
      // The reason is for developers; the copy is for the person waiting.
      console.error('Music browse refused:', err.status, err.message)
      return NextResponse.json(
        { error: 'YouTube Music turned that down. Try again in a moment.' },
        { status: 502 },
      )
    }

    const message = err instanceof Error ? err.message : 'Open failed'
    console.error('Browse failed:', message)
    return NextResponse.json(
      { error: 'That did not open. Give it another go in a moment.' },
      { status: 500 },
    )
  }
}
