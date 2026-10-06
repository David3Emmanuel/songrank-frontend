/**
 * Reading YouTube Music's own search results.
 *
 * This is the internal API the YouTube Music web player calls, not the public
 * Data API. It needs no API key, returns real entities rather than uploads, and
 * labels each row as a song, a video or user-generated content, which is the
 * distinction the Data API leaves you to guess at.
 *
 * What it does not do is documented or stable. The client name and version below
 * are what the web player sends; when Google ships a new web client these have
 * to be updated or the endpoint starts refusing requests. The response is a tree
 * of renderers, parsed defensively here so a shape change degrades to fewer
 * results rather than a crash.
 */

/** The web player's own endpoint. No key is required. */
export const INNERTUBE_SEARCH_ENDPOINT =
  'https://music.youtube.com/youtubei/v1/search?prettyPrint=false'

/** Identifies the client, exactly as the music web player does. */
export const MUSIC_CLIENT = {
  clientName: 'WEB_REMIX',
  clientVersion: '1.20250101.01.00',
  hl: 'en',
  gl: 'US',
} as const

/** The row renderer that holds one song or one video. */
const SONG_ROW = 'musicResponsiveListItemRenderer'

/** The label on a row that distinguishes real music from reuploads. */
export const OFFICIAL_VIDEO_TYPES = new Set([
  'MUSIC_VIDEO_TYPE_ATV',
  'MUSIC_VIDEO_TYPE_OMV',
])

export interface MusicSearchSong {
  videoId: string
  title: string
  artist: string
  album: string
  /** 0 when the row did not carry a length. Most rows do not. */
  durationMs: number
  coverImage?: string
  /** MUSIC_VIDEO_TYPE_ATV for the official track, UGC for a reupload. */
  videoType?: string
}

type Node = Record<string, unknown>

function asNode(value: unknown): Node | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Node)
    : null
}

/** Every object stored under `key`, wherever it sits in the tree. */
function collect(node: unknown, key: string, found: Node[] = []): Node[] {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, key, found)
    return found
  }

  const object = asNode(node)
  if (!object) return found

  for (const [name, value] of Object.entries(object)) {
    if (name === key) {
      const match = asNode(value)
      if (match) found.push(match)
    } else {
      collect(value, key, found)
    }
  }

  return found
}

/** The first value found for `key`, looking through the whole subtree. */
function findValue(node: unknown, key: string): unknown {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findValue(child, key)
      if (hit !== undefined) return hit
    }
    return undefined
  }

  const object = asNode(node)
  if (!object) return undefined

  for (const [name, value] of Object.entries(object)) {
    if (name === key && value !== null && typeof value !== 'object') return value
    const hit = findValue(value, key)
    if (hit !== undefined) return hit
  }

  return undefined
}

/** "3:20" or "1:02:03" as milliseconds. Anything else is 0. */
export function parseDurationText(text: string): number {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/.exec(text.trim())
  if (!match) return 0

  const [, hours, minutes, seconds] = match
  const total =
    Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds)
  return total * 1000
}

export interface ParsedSubtitle {
  /** "Song", "Video", or empty when the row did not say. */
  kind: string
  artist: string
  album: string
  durationMs: number
}

/**
 * The second column of a row, which reads like "Song • Noname • 3:12" or
 * "Video • Noname • 116K views". View counts are dropped, and the artist is
 * whatever is left that is not a length.
 */
export function parseSubtitle(text: string): ParsedSubtitle {
  const parts = text
    .split(/\s*[•·]\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  const result: ParsedSubtitle = {
    kind: '',
    artist: '',
    album: '',
    durationMs: 0,
  }

  if (parts.length > 0 && /^(song|video|album|artist|playlist|ep)$/i.test(parts[0])) {
    result.kind = parts[0]
    parts.shift()
  }

  for (const part of parts) {
    const duration = parseDurationText(part)
    if (duration > 0 && result.durationMs === 0) {
      result.durationMs = duration
      continue
    }
    if (/(views?|plays?|subscribers?)$/i.test(part)) continue
    if (!result.artist) result.artist = part
    else if (!result.album) result.album = part
  }

  return result
}

/** The runs of one column, joined back into the line the player shows. */
function columnText(column: Node): string {
  const renderer = asNode(column.musicResponsiveListItemFlexColumnRenderer)
  const text = asNode(renderer?.text)
  const runs = Array.isArray(text?.runs) ? (text.runs as unknown[]) : []
  return runs
    .map((run) => {
      const value = asNode(run)?.text
      return typeof value === 'string' ? value : ''
    })
    .join('')
}

function coverFrom(row: Node): string | undefined {
  const renderer = asNode(row.thumbnail)
  const music = asNode(renderer?.musicThumbnailRenderer)
  const thumbnail = asNode(music?.thumbnail)
  const thumbnails = Array.isArray(thumbnail?.thumbnails)
    ? (thumbnail.thumbnails as unknown[])
    : []

  const best = thumbnails
    .map((entry) => asNode(entry))
    .filter((entry): entry is Node => Boolean(entry?.url))
    .sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0))[0]

  return typeof best?.url === 'string' ? best.url : undefined
}

/**
 * One song per row, in the order YouTube Music ranked them.
 *
 * Rows that are albums, artists or playlists use a different renderer and are
 * left out, as is any row without a video id, since there would be nothing to
 * play.
 */
export function parseSearchSongs(payload: unknown): MusicSearchSong[] {
  const songs: MusicSearchSong[] = []

  for (const row of collect(payload, SONG_ROW)) {
    const columns = Array.isArray(row.flexColumns)
      ? (row.flexColumns as unknown[]).map((column) => asNode(column) ?? {})
      : []

    const title = columnText(columns[0] ?? {}).trim()
    if (!title) continue

    const videoId = findValue(columns[0], 'videoId')
    if (typeof videoId !== 'string' || !videoId) continue

    const videoType = findValue(columns[0], 'musicVideoType')
    const subtitle = parseSubtitle(columnText(columns[1] ?? {}))

    songs.push({
      videoId,
      title,
      artist: subtitle.artist || 'Unknown Artist',
      album: subtitle.album,
      durationMs: subtitle.durationMs,
      coverImage: coverFrom(row),
      videoType: typeof videoType === 'string' ? videoType : undefined,
    })
  }

  return songs
}
