import type { SongCollection, Track } from '../types'
import {
  artistFromChannelTitle,
  artistFromVideo,
  chunkIds,
  decodeHtmlEntities,
  parseIsoDurationMs,
  smallerThumbnailUrl,
} from '../videoMetadata'
import { groupVideos } from '../songGrouping'

/** The slice of search.list this adapter reads. */
interface SearchListResponse {
  items?: Array<{
    id?: { videoId?: string }
    snippet: {
      title: string
      channelTitle?: string
      thumbnails?: Record<string, { url: string }>
    }
  }>
}

/** The slice of videos.list this adapter reads. */
interface VideosListResponse {
  items?: Array<{
    id: string
    contentDetails?: { duration?: string }
    snippet?: { channelTitle?: string; title?: string }
  }>
}

/** The slice of playlistItems.list this adapter reads. */
interface PlaylistItemsResponse {
  nextPageToken?: string
  items?: Array<{
    contentDetails: { videoId: string }
    snippet: {
      title: string
      videoOwnerChannelTitle?: string
      thumbnails?: Record<string, { url: string }>
    }
  }>
}

/**
 * A stop for the paging loop. 40 pages is 2000 tracks, well past any playlist
 * anyone would rank, and it means a server that keeps handing back a token
 * cannot spin forever.
 */
const MAX_PLAYLIST_PAGES = 40

/**
 * A refusal from the Data API, carrying enough to say something useful.
 *
 * Without this a quota error parses into an object with no `items`, looks like
 * an empty result, and the user is told their search was too narrow when in fact
 * YouTube turned it down.
 */
export class YouTubeApiError extends Error {
  readonly status: number

  constructor(status: number, reason: string) {
    super(reason)
    this.name = 'YouTubeApiError'
    this.status = status
  }
}

/** The Data API's own explanation, when it gives one. */
async function apiErrorReason(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    return body.error?.message ?? `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

/**
 * A search result page, plus a note of what was collapsed or dropped on the way
 * in, so the screen can say what was hidden rather than hiding it silently.
 */
export interface GroupedSongCollection extends SongCollection {
  duplicates: number
  filtered: number
}

export class YouTubeAdapter {  private apiKey: string
  private accessToken?: string

  constructor(apiKey: string, accessToken?: string) {
    this.apiKey = apiKey
    this.accessToken = accessToken
  }

  async searchByIsrc(isrc: string): Promise<string | null> {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
          new URLSearchParams({
            part: 'snippet',
            q: isrc,
            type: 'video',
            videoCategoryId: '10', // Music category
            key: this.apiKey,
            maxResults: '1',
          }),
      )
      const data = await res.json()
      return data.items?.[0]?.id?.videoId || null
    } catch {
      return null
    }
  }

  /**
   * Alternative uploads of a track, best first, for a slot that will not play.
   *
   * The first query is the one that has always been used: the music category and
   * the words "official audio". That narrowness is also why it returns nothing at
   * all for some tracks, and nothing is what a failing slot gets handed, so it
   * gives up. "XXX." on DAMN. is the example: the query comes back with zero
   * results while "DUCKWORTH." finds a video, and the difference is punctuation
   * and whatever a region's safe search makes of it.
   *
   * So a second, plainer query is tried when the first yields nothing, and several
   * ids are returned so the caller can move on from one that will not play. Each
   * query costs a hundred units of quota, which is why there are only two and the
   * second is skipped as soon as the first finds anything.
   */
  async findAlternatives(
    title: string,
    artist: string,
  ): Promise<Array<{ id: string; title: string; artist: string }>> {
    // Punctuation is noise to a search: "XXX." becomes "XXX".
    const cleaned = title
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const queries = [
      { q: `${title} ${artist} official audio`, category: '10' },
      { q: `${cleaned || title} ${artist}`.trim(), category: null },
    ]

    const found: Array<{ id: string; title: string; artist: string }> = []

    for (const query of queries) {
      const candidates = await this.searchVideoIds(query.q, query.category)
      for (const candidate of candidates) {
        if (!found.some((seen) => seen.id === candidate.id)) found.push(candidate)
      }
      if (found.length > 0) break
    }

    return found.slice(0, 5)
  }

  /** Video ids for one search, with what each claims to be, in YouTube's order. */
  private async searchVideoIds(
    query: string,
    category: string | null,
  ): Promise<Array<{ id: string; title: string; artist: string }>> {
    try {
      const params = new URLSearchParams({
        part: 'snippet',
        q: query,
        type: 'video',
        key: this.apiKey,
        maxResults: '5',
      })
      if (category) params.set('videoCategoryId', category)

      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${params}`,
      )
      if (!res.ok) return []

      const data = (await res.json()) as {
        items?: Array<{
          id?: { videoId?: string }
          snippet?: { title?: string; channelTitle?: string }
        }>
      }
      return (data.items ?? [])
        .map((item) => ({
          id: item.id?.videoId ?? '',
          title: decodeHtmlEntities(item.snippet?.title ?? ''),
          artist: item.snippet?.channelTitle ?? '',
        }))
        .filter((candidate) => Boolean(candidate.id))
    } catch {
      return []
    }
  }

  async getPlaylist(playlistId: string): Promise<SongCollection> {
    // Get playlist metadata
    const playlistRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?` +
        new URLSearchParams({
          part: 'snippet',
          id: playlistId,
          key: this.apiKey,
        }),
    )
    if (!playlistRes.ok) {
      throw new YouTubeApiError(
        playlistRes.status,
        await apiErrorReason(playlistRes),
      )
    }
    const playlistData = await playlistRes.json()

    if (!playlistData.items?.[0]) {
      throw new Error('Playlist not found')
    }

    // Every page of playlist items, not just the first: a single page holds 50
    // tracks and silently truncating a longer playlist is worse than a slow
    // import.
    const items: NonNullable<PlaylistItemsResponse['items']> = []
    let pageToken: string | undefined

    for (let page = 0; page < MAX_PLAYLIST_PAGES; page++) {
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        playlistId: playlistId,
        maxResults: '50',
        key: this.apiKey,
      })
      if (pageToken) params.set('pageToken', pageToken)

      const itemsRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      )
      if (!itemsRes.ok) {
        throw new YouTubeApiError(
          itemsRes.status,
          await apiErrorReason(itemsRes),
        )
      }
      const pageData = (await itemsRes.json()) as PlaylistItemsResponse
      items.push(...(pageData.items ?? []))

      pageToken = pageData.nextPageToken
      if (!pageToken) break
    }

    // Lengths live on the video, not on the playlist item, so they need one more
    // call: 1 quota unit per 50 tracks.
    const videoIds = items.map((item) => item.contentDetails.videoId)
    const details = await this.fetchVideoDetails(videoIds)

    const playlist = playlistData.items[0]
    const tracks: Track[] =
      items.map((item) => ({
        id: item.contentDetails.videoId,
        title: decodeHtmlEntities(item.snippet.title),
        artist: artistFromVideo(
          item.snippet.videoOwnerChannelTitle,
          decodeHtmlEntities(item.snippet.title),
        ),
        album: '',
        durationMs: details.get(item.contentDetails.videoId)?.durationMs ?? 0,
        coverImage:
          item.snippet.thumbnails?.maxres?.url ||
          item.snippet.thumbnails?.high?.url ||
          item.snippet.thumbnails?.default?.url,
        externalUrls: {
          youtube: `https://www.youtube.com/watch?v=${item.contentDetails.videoId}`,
        },
        previewUrl: undefined, // YouTube doesn't provide direct audio previews
      })) || []

    return {
      id: playlist.id,
      type: 'playlist',
      name: playlist.snippet.title,
      description: playlist.snippet.description || '',
      coverImage:
        playlist.snippet.thumbnails?.high?.url ||
        playlist.snippet.thumbnails?.default?.url,
      etag: playlist.etag,
      tracks: tracks,
    }
  }

  /**
   * A collection built from a free-text query, shaped exactly like an imported
   * playlist so the landing page can offer "type an artist" and "paste a link"
   * as interchangeable routes into the same ranker.
   *
   * Costs 100 quota units for the search plus 1 per 50 results for the lengths,
   * which is why the result count is capped rather than paged.
   */
  async searchCollection(
    query: string,
    max = 25,
  ): Promise<GroupedSongCollection> {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
        new URLSearchParams({
          part: 'snippet',
          q: query,
          type: 'video',
          videoCategoryId: '10', // Music
          maxResults: String(Math.min(Math.max(max, 2), 50)),
          key: this.apiKey,
        }),
    )
    if (!res.ok) {
      throw new YouTubeApiError(res.status, await apiErrorReason(res))
    }
    const data = (await res.json()) as SearchListResponse

    const found = (data.items ?? []).filter(
      (item): item is typeof item & { id: { videoId: string } } =>
        Boolean(item.id?.videoId),
    )
    const details = await this.fetchVideoDetails(found.map((item) => item.id.videoId))

    // YouTube returns uploads, not songs: the same track arrives as the official
    // video, the audio, a lyric reupload. Collapsed here so nobody is asked to
    // rank a song against itself.
    const grouped = groupVideos(
      found.map((item) => ({
        id: item.id.videoId,
        title: decodeHtmlEntities(item.snippet.title),
        channelTitle: item.snippet.channelTitle,
        durationMs: details.get(item.id.videoId)?.durationMs ?? 0,
        coverImage: smallerThumbnailUrl(
          item.snippet.thumbnails?.high?.url ||
            item.snippet.thumbnails?.default?.url,
        ),
      })),
    )

    const tracks: Track[] = grouped.songs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: artistFromChannelTitle(song.channelTitle),
      album: '',
      durationMs: song.durationMs,
      coverImage: song.coverImage,
      externalUrls: {
        youtube: `https://www.youtube.com/watch?v=${song.id}`,
      },
      previewUrl: undefined, // YouTube doesn't provide direct audio previews
    }))

    return {
      id: `search:${query}`,
      type: 'playlist',
      name: query,
      description: `${tracks.length} songs for “${query}”`,
      coverImage: tracks[0]?.coverImage,
      tracks,
      duplicates: grouped.duplicates,
      filtered: grouped.filtered,
    }
  }

  /**
   * Fills in what a track is missing from somewhere else.
   *
   * YouTube Music's search endpoint carries a length on almost none of its rows,
   * and occasionally names nobody at all: a row can read "Song • 4:22" with the
   * artist only present as a link. The video itself always knows both, so when an
   * API key happens to be configured the Data API is asked. One unit per fifty
   * tracks, against a hundred for a search, and a track keeps its blank length or
   * its placeholder rather than failing if the call does not work.
   */
  async fillDetails(tracks: Track[]): Promise<Track[]> {
    const missing = tracks.filter(
      (track) => !track.durationMs || !track.artist || track.artist === 'Unknown Artist',
    )
    if (missing.length === 0) return tracks

    const details = await this.fetchVideoDetails(missing.map((track) => track.id))
    if (details.size === 0) return tracks

    return tracks.map((track) => {
      const found = details.get(track.id)
      if (!found) return track

      // A run-together name is the signature of a VEVO channel, whose spelling
      // YouTube Music's own album page repeats. The video's title spells the same
      // artist properly ("Kendrick Lamar - DNA."), so it is used when it agrees
      // with the channel and only then.
      const spelled = artistFromVideo(found.channelTitle, found.title)
      const named =
        track.artist && track.artist !== 'Unknown Artist'
          ? !track.artist.includes(' ') && spelled.includes(' ')
            ? spelled
            : track.artist
          : spelled || track.artist
      const durationMs = track.durationMs || found.durationMs

      return named === track.artist && durationMs === track.durationMs
        ? track
        : { ...track, artist: named, durationMs }
    })
  }

  /**
   * Lengths and channel names for a list of videos, keyed by id, in batches of 50.
   *
   * A failed batch leaves those tracks as they were rather than failing the
   * import: a length improves the ranking screen, it is not what was asked for.
   */
  private async fetchVideoDetails(
    videoIds: string[],
  ): Promise<
    Map<string, { durationMs: number; channelTitle: string; title: string }>
  > {
    const details = new Map<
      string,
      { durationMs: number; channelTitle: string; title: string }
    >()

    for (const batch of chunkIds(videoIds, 50)) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?` +
            new URLSearchParams({
              part: 'contentDetails,snippet',
              id: batch.join(','),
              key: this.apiKey,
            }),
        )
        const data = (await res.json()) as VideosListResponse
        for (const item of data.items ?? []) {
          details.set(item.id, {
            durationMs: parseIsoDurationMs(item.contentDetails?.duration),
            // Kept raw: the spelling is reconciled with the title in fillDetails,
            // which is the only place that has both.
            channelTitle: item.snippet?.channelTitle ?? '',
            title: item.snippet?.title ?? '',
          })
        }
      } catch {
        // Leave this batch as it was and carry on.
      }
    }

    return details
  }

  async createPlaylist(title: string, description: string): Promise<string> {
    if (!this.accessToken) {
      throw new Error('OAuth token required for creating playlists')
    }

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?` +
        new URLSearchParams({
          part: 'snippet,status',
          key: this.apiKey,
        }),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snippet: { title, description },
          status: { privacyStatus: 'private' },
        }),
      },
    )
    const data = await res.json()
    return data.id
  }

  async addTracksToPlaylist(
    playlistId: string,
    videoIds: string[],
  ): Promise<void> {
    if (!this.accessToken) {
      throw new Error('OAuth token required for adding tracks')
    }

    for (const videoId of videoIds) {
      try {
        await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?` +
            new URLSearchParams({
              part: 'snippet',
              key: this.apiKey,
            }),
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              snippet: {
                playlistId: playlistId,
                resourceId: { kind: 'youtube#video', videoId: videoId },
              },
            }),
          },
        )
      } catch (error) {
        console.error(`Failed to add ${videoId}:`, error)
      }
    }
  }
}

// Helper function to extract playlist ID from URL
export function extractYouTubePlaylistId(url: string): string | null {
  try {
    const urlObj = new URL(url)
    return urlObj.searchParams.get('list')
  } catch {
    // If not a URL, assume it's already an ID
    return url.trim() || null
  }
}
