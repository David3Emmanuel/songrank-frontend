/**
 * Turning a page of video results into songs.
 *
 * YouTube has no song entity, so a search for one track comes back as several
 * uploads of it: the official video, the audio, the lyric video, a slowed
 * reupload, sometimes titled "Song - Artist" instead of "Artist - Song". Ranking
 * those against each other is meaningless, so they are collapsed to one entry,
 * and obvious non-songs are dropped.
 *
 * Order is preserved: search results arrive in relevance order and the song list
 * should follow it.
 */

export interface CandidateVideo {
  id: string
  /** Already HTML-decoded. */
  title: string
  channelTitle?: string
  durationMs: number
}

export interface GroupedSongs<T extends CandidateVideo> {
  songs: T[]
  /** Collapsed because another upload of the same song was kept. */
  duplicates: number
  /** Dropped because the upload did not look like a song. */
  filtered: number
}

/**
 * Fold the compatibility forms down to plain letters.
 *
 * Uploads obfuscate titles with mathematical bold and full-width characters, and
 * without this they dodge every rule below: the keywords never match and the
 * key comes out empty, so the same song is counted twice.
 */
export function normalizeUnicode(value: string): string {
  return value.normalize('NFKC')
}

/**
 * Bracketed parts that name a *different* take on the song, so they are kept.
 * Everything else in brackets describes the upload and is dropped.
 */
const MEANINGFUL =
  /\b(live|remix|acoustic|instrumental|unplugged|extended|edit|version|demo|session|orchestral|cover|reprise|interlude)\b/i

const BRACKETS = /[([{][^)\]}]*[)\]}]/g

/** A trailing segment that continues the title rather than naming the artist. */
const CONTINUATION = /^(part|pt|chapter|vol|volume|act|book|disc|no)\b/i

/** Titles that describe something other than the song being ranked. */
const NOT_A_SONG =
  /\b(reaction|reacts|review|reviews|interview|podcast|concert|behind the scenes|making of|tutorial|lesson|how to|full album|mixtape|compilation|documentary|trailer|teaser|unboxing|loop|slowed|reverb|sped up|8d audio|karaoke)\b/i

function fold(value: string): string {
  return normalizeUnicode(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** The title with its upload decoration removed, and nothing else. */
function undecorated(title: string): string {
  return normalizeUnicode(title)
    .replace(BRACKETS, (segment) => (MEANINGFUL.test(segment) ? segment : ' '))
    .replace(/\s{2,}/g, ' ')
    .trim()
}

interface TitleParts {
  /** The title with decoration removed. */
  whole: string
  /** Grouping keys, best guess first. */
  keys: string[]
  /** The readable form of each key, in the same order. */
  readable: string[]
}

/**
 * How a title might name its song.
 *
 * Uploads title themselves "Artist - Song", and some put the song first, so both
 * ends are offered and whichever matches something already seen wins. A trailing
 * segment that reads as a continuation ("Part 2") means the separator belongs to
 * the song's own name, and then only the whole title counts.
 */
function titleParts(title: string): TitleParts {
  const whole = undecorated(title)
  const keys: string[] = []
  const readable: string[] = []

  const add = (value: string) => {
    const key = fold(value)
    if (key && !keys.includes(key)) {
      keys.push(key)
      readable.push(value)
    }
  }

  const segments = whole
    .split(/\s+[-–—]\s+/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length > 1) {
    const last = segments[segments.length - 1]
    const first = segments[0]
    if (!CONTINUATION.test(last)) {
      add(last)
      if (!CONTINUATION.test(first)) add(first)
    }
  }

  add(whole)
  return { whole, keys, readable }
}

/** Every key this title could be grouped under, best guess first. */
function songKeys(title: string): string[] {
  return titleParts(title).keys
}

/**
 * The song a title most likely names, which is what two uploads of it have in
 * common. Used for display comparisons and for tests.
 */
export function songTitleKey(title: string): string {
  const parts = titleParts(title)
  return parts.readable[0] ?? parts.whole
}

/**
 * How much a channel looks like the source of the real recording. Auto-generated
 * artist channels carry the label's own audio, so they win.
 */
function officialScore(channelTitle: string | undefined): number {
  const channel = (channelTitle ?? '').toLowerCase()
  if (/\btopic\b/.test(channel)) return 3
  if (/vevo|official/.test(channel)) return 2
  return 1
}

/**
 * Which upload of a song to keep: the most official, then the least decorated
 * title, then whichever YouTube ranked higher.
 */
function betterOf<T extends CandidateVideo>(a: T, b: T): T {
  const official = officialScore(a.channelTitle) - officialScore(b.channelTitle)
  if (official !== 0) return official > 0 ? a : b

  // Measured against the raw title, so a title carrying more decoration loses.
  const decoration = (video: T) =>
    video.title.length - songTitleKey(video.title).length
  const decorated = decoration(a) - decoration(b)
  if (decorated !== 0) return decorated < 0 ? a : b

  return a
}

export function groupVideos<T extends CandidateVideo>(
  items: T[],
): GroupedSongs<T> {
  /** Any song key to the index of the group holding it. */
  const index = new Map<string, number>()
  const groups: Array<{ song: T; keys: string[] }> = []
  let filtered = 0

  for (const item of items) {
    if (NOT_A_SONG.test(normalizeUnicode(item.title))) {
      filtered++
      continue
    }

    const keys = songKeys(item.title)
    // A title with no letters or digits left keeps to itself rather than
    // colliding with every other such title.
    const lookup = keys.length > 0 ? keys : [`id:${item.id}`]

    let at = -1
    for (const key of lookup) {
      const hit = index.get(key)
      if (hit !== undefined) {
        at = hit
        break
      }
    }

    if (at === -1) {
      const groupIndex = groups.length
      groups.push({ song: item, keys: lookup })
      for (const key of lookup) index.set(key, groupIndex)
      continue
    }

    const group = groups[at]
    const better = betterOf(group.song, item)
    if (better !== group.song) {
      group.song = better
      // The new representative may answer to keys the group did not hold yet.
      for (const key of [...lookup, ...songKeys(better.title)]) {
        if (!group.keys.includes(key)) {
          group.keys.push(key)
          index.set(key, at)
        }
      }
    }
  }

  const songs = groups.map((group) => group.song)
  return { songs, duplicates: items.length - songs.length - filtered, filtered }
}
