/**
 * Small, source-agnostic helpers for the metadata YouTube hands back.
 *
 * Kept pure and separate from the adapter so the parsing rules — which are the
 * parts most likely to be subtly wrong — can be tested without a network call.
 */

/**
 * The Data API returns durations as ISO-8601 ("PT4M23S", "PT1H2M3S").
 *
 * Anything unparseable is 0 rather than a guess: a wrong length would silently
 * become a wrong timeline once something draws one.
 */
export function parseIsoDurationMs(value: string | null | undefined): number {
  if (!value) return 0

  const match = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
    value.trim(),
  )
  if (!match) return 0

  const [, weeks, days, hours, minutes, seconds] = match
  if (!weeks && !days && !hours && !minutes && !seconds) return 0

  const totalSeconds =
    Number(weeks ?? 0) * 604800 +
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0)

  return Math.round(totalSeconds * 1000)
}

/**
 * A usable artist name from a channel title.
 *
 * Playlist items only carry `videoOwnerChannelTitle`, which is the uploader, not
 * the artist: auto-generated music channels come through as "Dua Lipa - Topic"
 * and label channels as "TheWeekndVEVO". Stripping those two decorations is the
 * part that can be done from this data alone; it does not split "TheWeeknd" into
 * two words, which would need real artist metadata rather than a guess.
 */
export function artistFromChannelTitle(
  channelTitle: string | null | undefined,
): string {
  const raw = (channelTitle ?? '').trim()
  if (!raw) return 'Unknown Artist'

  const cleaned = raw
    .replace(/\s*-\s*Topic$/i, '')
    .replace(/VEVO$/i, '')
    .trim()

  return cleaned || 'Unknown Artist'
}

/** Split ids into batches the Data API will accept in one `id=` parameter. */
export function chunkIds<T>(items: T[], size: number): T[][] {
  if (size < 1) throw new Error('chunk size must be at least 1')
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
