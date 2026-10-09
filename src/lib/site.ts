/**
 * Where this deployment lives, and what a shared card says at the bottom.
 *
 * Both are configuration rather than code. A card with nothing but a name on it is
 * a dead end for whoever sees it in a timeline, and an address is also what link
 * previews need in order to resolve their image. Until one is configured, the card
 * says what it has always said and the previews stay relative.
 */

/** The deployment's address, without a trailing slash. Empty when unset. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
  .trim()
  .replace(/\/+$/, '')

/**
 * What the bottom of a share card reads.
 *
 * An address is shown as its host, because "songrank.app" is what somebody can
 * type and a full URL on a card is mostly noise. Without one there is nothing to
 * type, so the name alone stands.
 */
export function cardFooter(site: string = SITE_URL): string {
  const trimmed = site.trim().replace(/\/+$/, '')
  if (!trimmed) return 'SongRank'
  return trimmed.replace(/^https?:\/\//i, '')
}
