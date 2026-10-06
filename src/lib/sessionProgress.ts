/**
 * How far a session has come, and whether it is worth suggesting a stop.
 *
 * Comparisons per song, not confidence: confidence mixes in how spread the
 * scores happen to be, so it says as much about the songs as about the work
 * done. The numbers below come from the ending test — a session measured on a
 * 10-song playlist naturally stopped at 1.5 comparisons per song, and the order
 * was still moving at 1.9.
 */

/** Comparisons per song at which stopping is worth suggesting. */
export const SUGGEST_STOP_PER_SONG = 1.5

/** Below this, the top of the ranking is still expected to move. */
export const SETTLED_TOP_PER_SONG = 2

export interface SessionProgress {
  comparisons: number
  perSong: number
  /** Enough comparisons that stopping is a reasonable choice. */
  suggestStop: boolean
  /** The ordering at the top of the list is still unsettled, and worth saying. */
  topMayShift: boolean
}

export function sessionProgress(
  songCount: number,
  comparisons: number,
): SessionProgress {
  const perSong = songCount > 0 ? comparisons / songCount : 0
  // A ranking needs at least two songs to have a comparison at all.
  const comparable = songCount > 1

  return {
    comparisons,
    perSong,
    suggestStop: comparable && perSong >= SUGGEST_STOP_PER_SONG,
    // Nothing is settled when there is nothing to rank.
    topMayShift: !comparable || perSong < SETTLED_TOP_PER_SONG,
  }
}

/** A list this long is worth a gentle nudge before committing to it. */
export const LONG_LIST_SONGS = 15

/**
 * Seconds one pick takes, used only to give a rough length for a draft list.
 * A wide range on purpose: an estimate that looks precise would be a lie.
 */
const SECONDS_PER_PICK_LOW = 12
const SECONDS_PER_PICK_HIGH = 20

export interface DraftEstimate {
  picks: number
  minutesLow: number
  minutesHigh: number
  /** Long enough that the session is likely to be abandoned. */
  isLong: boolean
}

/**
 * What a draft list is likely to cost the user before they start.
 *
 * Uses the same comparisons per song the ending test measured, so the promise
 * matches what the session actually asks for.
 */
export function draftEstimate(songCount: number): DraftEstimate {
  const picks = Math.ceil(songCount * SUGGEST_STOP_PER_SONG)
  return {
    picks,
    minutesLow: Math.max(1, Math.round((picks * SECONDS_PER_PICK_LOW) / 60)),
    minutesHigh: Math.max(1, Math.round((picks * SECONDS_PER_PICK_HIGH) / 60)),
    isLong: songCount > LONG_LIST_SONGS,
  }
}
