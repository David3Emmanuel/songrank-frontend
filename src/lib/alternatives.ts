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
 * Words that mean a different recording of the same song.
 *
 * A live take, a remix, a slowed version and an instrumental are not the song that
 * was asked for. An upload of it is; a reworking of it is not, and hearing one
 * under the original's title is the wrong-audio bug in a quieter form. It happened
 * with "XXX.", which fell back to a live version.
 */
const VERSION_MARKERS = [
  'remix',
  'live',
  'slowed',
  'spedup',
  'reverb',
  'instrumental',
  'acoustic',
  'karaoke',
  'nightcore',
  'mashup',
  '8d',
  'cover',
  'tribute',
  'typebeat',
]

/** A version the candidate claims and the track does not. */
function claimsAnotherVersion(
  candidate: SongIdentity,
  track: SongIdentity,
): boolean {
  const candidateTitle = fold(candidate.title)
  const trackTitle = fold(track.title)

  return VERSION_MARKERS.some((marker) => {
    const folded = fold(marker)
    return candidateTitle.includes(folded) && !trackTitle.includes(folded)
  })
}

/**
 * Whether a candidate is plausibly the same song by the same artist.
 *
 * The artist has to appear somewhere in what the candidate says about itself,
 * either as its artist or inside its title, which is how a reupload credits the
 * original ("Kendrick Lamar, U2 & Dave Chappelle - XXX. (Audio)" is on a channel
 * called F.A.R). The title has to match in one direction or the other, so a
 * longer decorated title still counts and a shorter one does not lose its song.
 * And it has to be the same recording: a live take or a remix is not.
 */
export function isSameSong(
  candidate: SongIdentity,
  track: SongIdentity,
): boolean {
  const title = fold(track.title)
  const artist = fold(track.artist)
  if (title.length < 2 || artist.length < 2) return false
  if (claimsAnotherVersion(candidate, track)) return false

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
