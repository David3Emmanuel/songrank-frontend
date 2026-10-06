import type { SongCollection, Track } from '../types'
import {
  artistFromChannelTitle,
  chunkIds,
  parseIsoDurationMs,
} from '../videoMetadata'

/** The slice of videos.list this adapter reads. */
interface VideosListResponse {
  items?: Array<{
    id: string
    contentDetails?: { duration?: string }
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

export class YouTubeAdapter {
  private apiKey: string
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

  async searchByQuery(title: string, artist: string): Promise<string | null> {
    try {
      const query = `${title} ${artist} official audio`
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
          new URLSearchParams({
            part: 'snippet',
            q: query,
            type: 'video',
            videoCategoryId: '10',
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
      const pageData = (await itemsRes.json()) as PlaylistItemsResponse
      items.push(...(pageData.items ?? []))

      pageToken = pageData.nextPageToken
      if (!pageToken) break
    }

    // Lengths live on the video, not on the playlist item, so they need one more
    // call: 1 quota unit per 50 tracks.
    const videoIds = items.map((item) => item.contentDetails.videoId)
    const durations = await this.fetchDurations(videoIds)

    const playlist = playlistData.items[0]
    const tracks: Track[] =
      items.map((item) => ({
        id: item.contentDetails.videoId,
        title: item.snippet.title,
        artist: artistFromChannelTitle(item.snippet.videoOwnerChannelTitle),
        album: '',
        durationMs: durations.get(item.contentDetails.videoId) ?? 0,
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
   * Durations for a list of videos, keyed by id, in batches of 50.
   *
   * A failed batch leaves those tracks at 0 rather than failing the import:
   * lengths improve the ranking screen, they are not what the user asked for.
   */
  private async fetchDurations(videoIds: string[]): Promise<Map<string, number>> {
    const durations = new Map<string, number>()

    for (const batch of chunkIds(videoIds, 50)) {
      try {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?` +
            new URLSearchParams({
              part: 'contentDetails',
              id: batch.join(','),
              key: this.apiKey,
            }),
        )
        const data = (await res.json()) as VideosListResponse
        for (const item of data.items ?? []) {
          durations.set(item.id, parseIsoDurationMs(item.contentDetails?.duration))
        }
      } catch {
        // Leave this batch at 0 and carry on.
      }
    }

    return durations
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
