/**
 * Searching through YouTube Music's own endpoint.
 *
 * Preferred over the Data API for search because it returns songs rather than
 * uploads and labels each result with its entity type, which is what tells an
 * official track from a reupload. The Data API is still used for playlists and,
 * when an API key is around, to fill in track lengths, which this endpoint
 * mostly does not carry.
 */

import type { GroupedSongCollection } from './youtube'
import { YouTubeApiError } from './youtube'
import {
  INNERTUBE_SEARCH_ENDPOINT,
  MUSIC_CLIENT,
  parseSearchEntities,
  type MusicSearchEntity,
} from '../innertube'
import { groupVideos } from '../songGrouping'
import { smallerThumbnailUrl } from '../videoMetadata'
import type { Track } from '../types'

export interface MusicSearch {
  /** The songs, grouped, as the pick list has always taken them. */
  collection: GroupedSongCollection
  /** Everything the search returned, in the order it ranked them. */
  entities: MusicSearchEntity[]
}

export class YouTubeMusicAdapter {
  /**
   * One search, one request. No key and no quota: this is the endpoint the music
   * web player itself calls.
   */
  async searchBoth(query: string, max = 25): Promise<MusicSearch> {
    const body = {
      context: { client: MUSIC_CLIENT },
      query,
    }

    const res = await fetch(INNERTUBE_SEARCH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://music.youtube.com',
        Referer: 'https://music.youtube.com/',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      let reason = `HTTP ${res.status}`
      try {
        const payload = (await res.json()) as {
          error?: { message?: string }
        }
        reason = payload.error?.message ?? reason
      } catch {
        // Body was not JSON, the status is all there is.
      }
      throw new YouTubeApiError(res.status, reason)
    }

    const parsed = parseSearchEntities(await res.json())
    const entities = parsed.slice(0, max)
    // Only what can be played, in the order the search ranked it. Cap the songs
    // as well as the entities, since the entity list carries albums and artists
    // that would otherwise eat into the list.
    const songs = parsed
      .filter((entity) => entity.kind === 'song' || entity.kind === 'video')
      .slice(0, max)

    const grouped = groupVideos(
      songs.map((song) => ({
        id: song.id,
        title: song.title,
        channelTitle: song.artist,
        durationMs: song.durationMs,
        videoType: song.videoType,
        album: song.album,
        coverImage: smallerThumbnailUrl(song.coverImage),
      })),
    )

    const tracks: Track[] = grouped.songs.map((song) => ({
      id: song.id,
      title: song.title,
      artist: song.channelTitle || 'Unknown Artist',
      album: song.album,
      durationMs: song.durationMs,
      coverImage: song.coverImage,
      externalUrls: {
        youtube: `https://www.youtube.com/watch?v=${song.id}`,
      },
      previewUrl: undefined,
    }))

    return {
      entities,
      collection: {
        id: `search:${query}`,
        type: 'playlist',
        name: query,
        description: `${tracks.length} songs for “${query}”`,
        coverImage: tracks[0]?.coverImage,
        tracks,
        duplicates: grouped.duplicates,
        filtered: grouped.filtered,
      },
    }
  }

  /** Just the playable songs, for callers that do not care about the rest. */
  async searchCollection(
    query: string,
    max = 25,
  ): Promise<GroupedSongCollection> {
    return (await this.searchBoth(query, max)).collection
  }
}
