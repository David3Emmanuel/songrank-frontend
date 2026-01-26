import type { SongCollection, Track } from '../types'

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

    // Get playlist items
    const itemsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?` +
        new URLSearchParams({
          part: 'snippet,contentDetails',
          playlistId: playlistId,
          maxResults: '50',
          key: this.apiKey,
        }),
    )
    const itemsData = await itemsRes.json()

    const playlist = playlistData.items[0]
    const tracks: Track[] =
      itemsData.items?.map((item: any) => ({
        id: item.contentDetails.videoId,
        title: item.snippet.title,
        artist: item.snippet.videoOwnerChannelTitle || 'Unknown Artist',
        album: '',
        durationMs: 0,
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
