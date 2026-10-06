/**
 * Turning a search bar and its filters into the words that get asked for.
 *
 * An artist chosen from the results is a filter on the search rather than a
 * separate screen, so it is prepended to whatever is typed. The music endpoint
 * reads "this artist, these words" as exactly that, and it keeps the one search
 * box as the only place a search comes from.
 */

/**
 * The query a search is sent with.
 *
 * With no artist this is just what was typed, and with no typed words it is just
 * the artist, which is a perfectly good search on its own.
 */
export function scopedQuery(
  artist: string | null | undefined,
  text: string,
): string {
  const name = (artist ?? '').trim()
  const words = text.trim()

  if (!name) return words
  if (!words) return name
  return `${name} ${words}`
}

/**
 * What to call the results on screen.
 *
 * The artist is already named by the filter chip sitting in the search bar, so
 * the heading repeats only the typed words, and falls back to the artist when
 * there are none.
 */
export function resultsLabel(
  artist: string | null | undefined,
  text: string,
): string {
  const name = (artist ?? '').trim()
  const words = text.trim()
  return words || name
}
