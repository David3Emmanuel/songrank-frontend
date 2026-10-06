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

  if (
    parts.length > 0 &&
    /^(song|video|album|single|artist|playlist|ep)$/i.test(parts[0])
  ) {
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

/** The runs of one column, as nodes, for reading both their text and their links. */
function runsOf(column: Node): Node[] {
  const renderer = asNode(column.musicResponsiveListItemFlexColumnRenderer)
  const text = asNode(renderer?.text)
  const runs = Array.isArray(text?.runs) ? (text.runs as unknown[]) : []
  return runs.map((run) => asNode(run) ?? {})
}

/** The runs of one column, joined back into the line the player shows. */
function columnText(column: Node): string {
  return runsOf(column)
    .map((run) => (typeof run.text === 'string' ? run.text : ''))
    .join('')
}

/** The page type a run's own link points at. */
function runPageType(run: Node): string {
  const endpoint = asNode(run.navigationEndpoint)
  const browse = asNode(endpoint?.browseEndpoint)
  const configs = asNode(browse?.browseEndpointContextSupportedConfigs)
  const music = asNode(configs?.browseEndpointContextMusicConfig)
  const value = music?.pageType
  return typeof value === 'string' ? value : ''
}

/**
 * The artist a row links to.
 *
 * A song row often states only its length, so its subtitle never names the
 * artist. The row still links to the artist's page from one of its runs, which is
 * both a better answer than a placeholder and the entity itself.
 */
function artistFromRow(columns: Node[]): string {
  for (const column of columns.slice(0, 2)) {
    for (const run of runsOf(column)) {
      if (runPageType(run) !== 'MUSIC_PAGE_TYPE_ARTIST') continue
      const text = typeof run.text === 'string' ? run.text.trim() : ''
      if (text) return text
    }
  }
  return ''
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
 * One row of a search response, as whatever kind of thing it is.
 *
 * A search result is not a list of songs with some junk in it: it is a list of
 * entities. An album, a single, an artist and a playlist each arrive as their own
 * kind, with a browse id rather than a video id, and dropping them loses the most
 * useful thing a search can return.
 */
export type MusicEntityKind =
  | 'song'
  | 'video'
  | 'album'
  | 'single'
  | 'artist'
  | 'playlist'

export interface MusicSearchEntity {
  kind: MusicEntityKind
  /** A video id for a song, a browse id for every other kind. */
  id: string
  title: string
  artist: string
  album: string
  /** The release year a row stated, when it stated one. */
  year: string
  /** The row's own subtitle line, for anything the fields above do not cover. */
  detail: string
  durationMs: number
  coverImage?: string
  videoType?: string
}

/** The page type an entity row declares about itself. */
function pageTypeOf(row: Node): string {
  const nav = asNode(row.navigationEndpoint)
  const browse = asNode(nav?.browseEndpoint)
  const configs = asNode(browse?.browseEndpointContextSupportedConfigs)
  const music = asNode(configs?.browseEndpointContextMusicConfig)
  const value = music?.pageType
  return typeof value === 'string' ? value : ''
}

function browseIdOf(row: Node): string {
  const nav = asNode(row.navigationEndpoint)
  const browse = asNode(nav?.browseEndpoint)
  const value = browse?.browseId
  return typeof value === 'string' ? value : ''
}

/** The four digit year a row mentions, if it mentions one. */
function yearIn(text: string): string {
  const match = /(?:^|\s)(\d{4})(?:\s|$)/.exec(text)
  return match ? match[1] : ''
}

/**
 * What kind of thing a row is.
 *
 * The page type is the authority, and the subtitle only splits albums from
 * singles, which share a shape and differ by that one word.
 */
export function kindForRow(
  pageType: string,
  subtitleKind: string,
): MusicEntityKind | null {
  const said = subtitleKind.toLowerCase()

  if (pageType === 'MUSIC_PAGE_TYPE_ALBUM') {
    return said === 'single' ? 'single' : 'album'
  }
  if (pageType === 'MUSIC_PAGE_TYPE_ARTIST') return 'artist'
  if (pageType === 'MUSIC_PAGE_TYPE_PLAYLIST') return 'playlist'
  // Credits pages, podcast shows and channels are real pages but not something
  // anybody wants to add to a ranking.
  if (pageType) return null

  return said === 'video' ? 'video' : 'song'
}

/**
 * Every row of a search response, typed, in the order YouTube Music ranked them.
 *
 * A row that carries a video id and names no page type is a song: it can be
 * played, whatever else it links to. Everything else is an entity, and needs both
 * a page type and a browse id to be worth returning.
 */
export function parseSearchEntities(payload: unknown): MusicSearchEntity[] {
  const entities: MusicSearchEntity[] = []

  for (const row of collect(payload, SONG_ROW)) {
    const columns = Array.isArray(row.flexColumns)
      ? (row.flexColumns as unknown[]).map((column) => asNode(column) ?? {})
      : []

    const title = columnText(columns[0] ?? {}).trim()
    if (!title) continue

    const detail = columnText(columns[1] ?? {}).trim()
    const subtitle = parseSubtitle(detail)
    const videoType = findValue(columns[0], 'musicVideoType')
    const pageType = pageTypeOf(row)
    const videoId = findValue(columns[0], 'videoId')

    if (!pageType && typeof videoId === 'string' && videoId) {
      entities.push({
        kind: subtitle.kind.toLowerCase() === 'video' ? 'video' : 'song',
        id: videoId,
        title,
        // Empty rather than a placeholder when the row names nobody: the caller
        // can still find the artist from the video, and a placeholder cannot be
        // told apart from a real name.
        artist: artistFromRow(columns) || subtitle.artist,
        album: subtitle.album,
        year: '',
        detail,
        durationMs: subtitle.durationMs,
        coverImage: coverFrom(row),
        videoType: typeof videoType === 'string' ? videoType : undefined,
      })
      continue
    }

    const kind = kindForRow(pageType, subtitle.kind)
    const browseId = browseIdOf(row)
    if (!kind || !browseId) continue

    entities.push({
      kind,
      id: browseId,
      title,
      // An artist row's second column is an audience figure, not an artist, and a
      // playlist's is whoever made it, so neither is read as the artist.
      artist: kind === 'artist' || kind === 'playlist' ? '' : subtitle.artist,
      album: '',
      year: yearIn(detail),
      detail,
      durationMs: subtitle.durationMs,
      coverImage: coverFrom(row),
    })
  }

  return entities
}

/**
 * One song per row, in the order YouTube Music ranked them.
 *
 * Everything that is not a song or a video is left out, since there would be
 * nothing to play, as is any row without a video id.
 */
export function parseSearchSongs(payload: unknown): MusicSearchSong[] {
  return parseSearchEntities(payload)
    .filter((entity) => entity.kind === 'song' || entity.kind === 'video')
    .map((entity) => ({
      videoId: entity.id,
      title: entity.title,
      artist: entity.artist || 'Unknown Artist',
      album: entity.album,
      durationMs: entity.durationMs,
      coverImage: entity.coverImage,
      videoType: entity.videoType,
    }))
}
