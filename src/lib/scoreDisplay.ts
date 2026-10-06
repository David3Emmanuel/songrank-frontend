/**
 * How a ranking presents itself: a colour per song and the breaks between groups.
 *
 * The ranker's raw scores are not on a fixed scale, so they are normalised onto
 * the session's own +1 to -1 range before anything is drawn from them. Two songs
 * that scored nearly the same therefore get nearly the same colour, whatever the
 * spread of the session.
 */

const GREEN = [16, 185, 129]
const AMBER = [245, 158, 11]
const RED = [244, 63, 94]

/** Default card tint. Subtle enough to read as a wash rather than a colour. */
export const DEFAULT_TINT = 0.12

/** The breaks worth showing between groups of songs. */
export const MAX_BANDS = 4

export interface ScoreRange {
  min: number
  max: number
}

/**
 * The session's range, taken only from songs that have actually been compared.
 *
 * A song nobody has picked sits at 0 because it has no comparisons, not because
 * it scored zero, so letting it set the scale would distort every colour on the
 * screen. A song picked once or twice that genuinely landed at 0 is a real score
 * and is included.
 */
export function measuredRange(
  scores: number[],
  measured: boolean[],
): ScoreRange {
  const values = scores.filter((_, i) => measured[i])
  if (values.length === 0) return { min: 0, max: 0 }
  return { min: Math.min(...values), max: Math.max(...values) }
}

/** Where a score sits on the +1 to -1 scale. Flat sessions land in the middle. */
export function normalizeScore(score: number, range: ScoreRange): number {
  const span = range.max - range.min
  if (!Number.isFinite(span) || span <= 0) return 0
  const t = ((score - range.min) / span) * 2 - 1
  return Math.min(1, Math.max(-1, t))
}

/**
 * The card tint for a score on that scale: +1 green, 0 amber, -1 red, clamped so
 * nothing can produce a colour the scale does not have.
 */
export function scoreTint(normalized: number, alpha = DEFAULT_TINT): string {
  const t = Math.min(1, Math.max(0, (normalized + 1) / 2))
  const [from, to, local] =
    t < 0.5 ? [RED, AMBER, t / 0.5] : [AMBER, GREEN, (t - 0.5) / 0.5]
  const rgb = from.map((channel, i) =>
    Math.round(channel + (to[i] - channel) * local),
  )
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`
}

/**
 * Which rows begin a new band.
 *
 * A boundary has to stand out two ways: at least half the largest separation in
 * the list, and at least one and a half times the typical (median) one. The
 * first keeps small breaks out, the second is what stops an evenly spaced list
 * from being striped, since there every gap equals the largest. A break is also
 * never drawn below a song that has not been compared, and the count is capped.
 */
export function bandStarts(
  scores: number[],
  measured: boolean[],
  maxBands: number = MAX_BANDS,
): boolean[] {
  const gaps = scores.map((score, i) => (i === 0 ? 0 : scores[i - 1] - score))
  const positive = gaps.filter((gap) => gap > 0)
  if (positive.length === 0) return scores.map(() => false)

  const sorted = [...positive].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle]

  const threshold = Math.max(
    Math.max(...positive) * 0.5,
    median * 1.5,
  )

  const chosen = gaps
    .map((gap, i) => ({ gap, i }))
    .filter(({ gap, i }) => i > 0 && gap >= threshold && measured[i])
    .sort((a, b) => b.gap - a.gap)
    .slice(0, Math.max(0, maxBands - 1))
    .map(({ i }) => i)

  const breaks = new Set(chosen)
  return scores.map((_, i) => breaks.has(i))
}
