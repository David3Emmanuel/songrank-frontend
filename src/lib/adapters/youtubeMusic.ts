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
  INNERTUBE_BROWSE_ENDPOINT,
  INNERTUBE_SEARCH_ENDPOINT,
  MUSIC_CLIENT,
  isByArtist,
  parseSearchEntities,
  type ArtistFilter,
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
  /** Results dropped for being by somebody else, when a filter is on. */
  hiddenByArtist: number
}

export class YouTubeMusicAdapter {
  /**
   * One search, one request. No key and no quota: this is the endpoint the music
   * web player itself calls.
   *
   * An artist filter is both asked for and enforced. Asking is what finds their
   * songs, since the endpoint reads "this artist, these words" as a scoped
   * search; enforcing is what makes it a filter, because a scoped search still
   * returns rows by other people.
   */
  async searchBoth(
    query: string,
    max = 25,
    artist?: ArtistFilter,
  ): Promise<MusicSearch> {
    const payload = await this.call(INNERTUBE_SEARCH_ENDPOINT, { query })
    const parsed = parseSearchEntities(payload)

    const kept = artist
      ? parsed.filter((entity) => isByArtist(entity, artist))
      : parsed

    return {
      entities: kept.slice(0, max),
      hiddenByArtist: parsed.length - kept.length,
      collection: this.toCollection(kept, max, query, `for “${query}”`),
    }
  }

  /**
   * The songs behind an artist, an album, a single or a playlist.
   *
   * Every one of those pages carries its tracks as rows of the same shape a
   * search returns, so one parser reads them all: an album page, an artist's
   * songs shelf and a playlist all come back through `parseSearchEntities`.
   */
  async browseCollection(
    browseId: string,
    title: string,
    max = 50,
  ): Promise<GroupedSongCollection> {
    const payload = await this.call(INNERTUBE_BROWSE_ENDPOINT, { browseId })
    const parsed = parseSearchEntities(payload)

    return this.toCollection(parsed, max, title, `from ${title}`)
  }

  /** Just the playable songs, for callers that do not care about the rest. */
  async searchCollection(
    query: string,
    max = 25,
  ): Promise<GroupedSongCollection> {
    return (await this.searchBoth(query, max)).collection
  }

  private async call(
    endpoint: string,
    extra: Record<string, unknown>,
  ): Promise<unknown> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://music.youtube.com',
        Referer: 'https://music.youtube.com/',
      },
      body: JSON.stringify({ context: { client: MUSIC_CLIENT }, ...extra }),
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

    return res.json()
  }

  /**
   * The playable side of a parsed page.
   *
   * Only what can be played, in the order the page listed it, capped so one
   * artist page cannot hand back an entire discography by accident.
   */
  private toCollection(
    parsed: MusicSearchEntity[],
    max: number,
    name: string,
    description: string,
  ): GroupedSongCollection {
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
      id: `browse:${name}`,
      type: 'playlist',
      name,
      description: `${tracks.length} songs ${description}`,
      coverImage: tracks[0]?.coverImage,
      tracks,
      duplicates: grouped.duplicates,
      filtered: grouped.filtered,
    }
  }
}
