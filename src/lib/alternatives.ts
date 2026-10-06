/**
 * Deciding whether an alternative upload really is the song it stands in for.
 *
 * A fallback exists because a video will not play, not because the song was wrong.
 * The search that finds alternatives, however, matches on words: a search for
 * "XXX." returns Kim Petras as readily as Kendrick Lamar. Playing that would put
 * the wrong song behind the right title, which is worse than admitting the track
 * cannot be played.
 */

/**
 * Letters and digits only, lowercased.
 *
 * Separators are removed rather than replaced with spaces, so punctuation inside a
 * word is not a difference: "X.X.X" and "XXX." fold to the same thing, which is
 * the point, since uploads spell the same title in every way they can.
 */
function fold(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export interface SongIdentity {
  title: string
  artist: string
}

/**
 * Whether a candidate is plausibly the same song by the same artist.
 *
 * The artist has to appear somewhere in what the candidate says about itself,
 * either as its artist or inside its title, which is how a reupload credits the
 * original ("Kendrick Lamar, U2 & Dave Chappelle - XXX. (Audio)" is on a channel
 * called F.A.R). The title has to match in one direction or the other, so a
 * longer decorated title still counts and a shorter one does not lose its song.
 */
export function isSameSong(
  candidate: SongIdentity,
  track: SongIdentity,
): boolean {
  const title = fold(track.title)
  const artist = fold(track.artist)
  if (title.length < 2 || artist.length < 2) return false

  const candidateTitle = fold(candidate.title)
  const candidateArtist = fold(candidate.artist)

  const titleMatches =
    candidateTitle.includes(title) || title.includes(candidateTitle)
  const artistMatches =
    candidateArtist.includes(artist) ||
    candidateTitle.includes(artist) ||
    artist.includes(candidateArtist)

  return titleMatches && artistMatches
}
