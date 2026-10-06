/**
 * The geometry of a share card, worked out from the shape and how many songs it
 * has to show.
 *
 * Fixed sizes could not hold every combination: a top 10 on a square card needs a
 * podium plus seven rows inside 1080 pixels, which the first attempt overflowed.
 * Everything here is derived from the height, so the rows are sized to whatever
 * is left over and nothing runs off the bottom.
 */

import type { ShareCardConfig } from './types'

export const CARD_DIMENSIONS = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
} as const

/** Rows never get smaller than this, or they would stop being legible. */
const MIN_ROW_FRACTION = 0.05
/** Nor larger, so a three song card does not look stretched. */
const MAX_ROW_FRACTION = 0.09

export interface CardLayout {
  width: number
  height: number
  tall: boolean
  marginX: number
  headerY: number
  subtitleY: number
  podiumTop: number
  podiumCover: number
  podiumTextBlock: number
  rowsTop: number
  rowHeight: number
  rowArt: number
  rowGap: number
  /** Songs past the podium, so 0 for a card of three. */
  rowCount: number
  footerY: number
}

export function cardLayout(
  format: ShareCardConfig['format'],
  songCount: number,
): CardLayout {
  const { width, height } = CARD_DIMENSIONS[format]
  const tall = format === '9:16'
  const at = (fraction: number) => Math.round(height * fraction)

  const headerY = at(0.105)
  const subtitleY = at(0.152)
  const podiumTop = at(0.215)
  const podiumCover = at(0.16)
  const podiumTextBlock = at(0.066)
  const footerReserve = at(0.075)
  const marginX = tall ? 70 : 60

  const rowsTop = podiumTop + podiumCover + podiumTextBlock + at(0.02)
  const rowCount = Math.max(0, songCount - 3)
  const rowGap = at(0.012)
  const available = height - rowsTop - footerReserve

  // Whatever is left, shared between the rows, kept inside sane bounds.
  const natural =
    rowCount > 0 ? (available - rowGap * (rowCount - 1)) / rowCount : 0
  const rowHeight =
    rowCount > 0
      ? Math.max(
          at(MIN_ROW_FRACTION),
          Math.min(at(MAX_ROW_FRACTION), Math.floor(natural)),
        )
      : 0

  // The cover takes the row's height less its padding, never below a dot.
  const rowArt = rowHeight > 0 ? Math.max(24, rowHeight - (tall ? 40 : 22)) : 0

  return {
    width,
    height,
    tall,
    marginX,
    headerY,
    subtitleY,
    podiumTop,
    podiumCover,
    podiumTextBlock,
    rowsTop,
    rowHeight,
    rowArt,
    rowGap,
    rowCount,
    footerY: height - at(0.035),
  }
}

/** The bottom edge of the last row, for checking that nothing runs off. */
export function layoutBottom(layout: CardLayout): number {
  if (layout.rowCount === 0) return layout.rowsTop
  return (
    layout.rowsTop +
    layout.rowCount * layout.rowHeight +
    (layout.rowCount - 1) * layout.rowGap
  )
}
