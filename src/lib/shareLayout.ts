/**
 * The geometry of a share card, worked out from the shape and how many songs it
 * has to show.
 *
 * Fixed sizes could not hold every combination: a top 10 on a square card needs a
 * podium plus seven rows inside 1080 pixels, which the first attempt overflowed.
 * Everything here is derived from the height instead, and the two blocks share
 * the space: the rows take a preferred height and the podium cover absorbs what
 * is left, so a three song card gets a large podium rather than a small one
 * stranded under the header.
 *
 * The cover is bounded by width as well as height, because the podium is three
 * covers across: the winner at full size and the other two at 78 per cent, so the
 * cover cannot be larger than about a third of the usable width.
 */

import type { ShareCardConfig } from './types'

export const CARD_DIMENSIONS = {
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
} as const

/** How wide the other two podium covers are, relative to the winner's. */
export const RUNNER_COVER_RATIO = 0.78
/** The same, when the podium is stacked on a tall card. */
const STACKED_RUNNER_RATIO = 0.62
/** Gap between podium columns. */
const COLUMN_GAP = { tall: 40, compact: 30 }

/** Rows never get smaller than this, or they would stop being legible. */
const MIN_ROW_FRACTION = 0.05
/** The height a row would like, before the podium takes its share. */
const PREFERRED_ROW_FRACTION = 0.085
/** Bounds on the podium cover. */
const MIN_COVER_FRACTION = 0.16
const MAX_COVER_FRACTION = 0.42
/** Used only when the rows cannot fit otherwise. */
const HARD_MIN_COVER_FRACTION = 0.12

export interface CardLayout {
  width: number
  height: number
  tall: boolean
  marginX: number
  headerY: number
  subtitleY: number
  /** A top three on a tall card stacks, since three squares across cannot fill it. */
  podiumStacked: boolean
  /** Top of the winner's cover, after the content is centred. */
  podiumTop: number
  /** The winner's cover. */
  podiumCover: number
  /** The second and third covers. */
  runnerCover: number
  /** Top of the second and third covers, on a stacked podium only. */
  podiumRunnerTop: number
  podiumColumnGap: number
  podiumTextBlock: number
  podiumTitleY: number
  podiumArtistY: number
  podiumDurationY: number
  runnerTitleY: number
  runnerArtistY: number
  runnerDurationY: number
  /** Top of the first row past the podium. */
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
  const podiumTopBase = at(0.2)
  const podiumTextBlock = at(0.075)
  const footerY = height - at(0.075)
  const marginX = tall ? 70 : 60
  const podiumColumnGap = tall ? COLUMN_GAP.tall : COLUMN_GAP.compact

  // The space between the header and the footer, shared by the podium and rows.
  const region = footerY - podiumTopBase

  const rowCount = Math.max(0, songCount - 3)
  const rowGap = at(0.012)
  const minRow = at(MIN_ROW_FRACTION)
  const leadIn = rowCount > 0 ? at(0.02) : 0

  // A top three on a tall card stacks instead: three squares across a 1080 wide
  // story only reach about a third of the width each, which leaves most of the
  // height empty. Anything with rows keeps the podium across, because the rows
  // need the height more.
  const stacked = tall && rowCount === 0

  // Across, the cover is bounded by the width as well as the height, because the
  // podium is three covers side by side.
  const acrossWidth = 1 + RUNNER_COVER_RATIO * 2
  const widthCap = stacked
    ? width - marginX * 2
    : (width - marginX * 2 - podiumColumnGap * 2) / acrossWidth
  const minCover = Math.min(at(MIN_COVER_FRACTION), widthCap)
  const maxCover = Math.min(at(MAX_COVER_FRACTION), widthCap)

  const clamp = (value: number, low: number, high: number) =>
    Math.max(low, Math.min(high, value))

  const preferredRows =
    rowCount > 0
      ? rowCount * at(PREFERRED_ROW_FRACTION) + (rowCount - 1) * rowGap
      : 0

  // The podium takes the slack, within bounds.
  let podiumCover = clamp(
    region - preferredRows - leadIn - podiumTextBlock,
    minCover,
    maxCover,
  )

  const heightPerRow = (cover: number) => {
    if (rowCount === 0) return 0
    const space = region - cover - leadIn - podiumTextBlock
    return Math.floor((space - (rowCount - 1) * rowGap) / rowCount)
  }

  const preferredRow = at(PREFERRED_ROW_FRACTION)
  let rowHeight = heightPerRow(podiumCover)

  // Rows that came out too tight take their space back from the podium.
  if (rowCount > 0 && rowHeight < minRow) {
    podiumCover = clamp(
      region -
        (rowCount * minRow + (rowCount - 1) * rowGap) -
        leadIn -
        podiumTextBlock,
      Math.min(at(HARD_MIN_COVER_FRACTION), widthCap),
      maxCover,
    )
    rowHeight = heightPerRow(podiumCover)
  }

  // And rows that came out too generous keep to a sensible height, leaving the
  // rest as even margin rather than a row the size of a postcard.
  if (rowHeight > preferredRow) rowHeight = preferredRow

  // A stacked podium has two cover blocks to fit, so the winner's cover is sized
  // from the height that is left once the runners and both captions are counted.
  let runnerCover = Math.round(podiumCover * RUNNER_COVER_RATIO)
  if (stacked) {
    const fits = (region - podiumTextBlock * 1.9) / (1 + STACKED_RUNNER_RATIO)
    podiumCover = Math.max(minCover, Math.min(widthCap, Math.floor(fits)))
    runnerCover = Math.round(podiumCover * STACKED_RUNNER_RATIO)
  }

  const podiumBlock = stacked
    ? podiumCover + podiumTextBlock + runnerCover + Math.round(podiumTextBlock * 0.9)
    : podiumCover + podiumTextBlock

  // Leftover space is split above and below, so the card is filled rather than
  // pinned under the header.
  const contentHeight =
    podiumBlock +
    leadIn +
    (rowCount > 0 ? rowCount * rowHeight + (rowCount - 1) * rowGap : 0)
  const slack = Math.max(0, region - contentHeight)
  const podiumTop = podiumTopBase + Math.floor(slack / 2)

  const podiumRunnerTop = podiumTop + podiumCover + podiumTextBlock
  const captionOffset = (fraction: number) => Math.round(podiumTextBlock * fraction)

  const rowArt = rowHeight > 0 ? Math.max(24, rowHeight - (tall ? 40 : 22)) : 0

  return {
    width,
    height,
    tall,
    marginX,
    headerY,
    subtitleY,
    podiumStacked: stacked,
    podiumTop,
    podiumCover,
    runnerCover,
    podiumRunnerTop,
    podiumColumnGap,
    podiumTextBlock,
    podiumTitleY: podiumTop + podiumCover + captionOffset(stacked ? 0.3 : 0.42),
    podiumArtistY: podiumTop + podiumCover + captionOffset(stacked ? 0.55 : 0.72),
    podiumDurationY: podiumTop + podiumCover + captionOffset(stacked ? 0.78 : 0.98),
    runnerTitleY: podiumRunnerTop + runnerCover + captionOffset(0.34),
    runnerArtistY: podiumRunnerTop + runnerCover + captionOffset(0.6),
    runnerDurationY: podiumRunnerTop + runnerCover + captionOffset(0.86),
    rowsTop: podiumTop + podiumBlock + leadIn,
    rowHeight,
    rowArt,
    rowGap,
    rowCount,
    footerY,
  }
}

/** The bottom edge of the last thing drawn, for checking nothing runs off. */
export function layoutBottom(layout: CardLayout): number {
  if (layout.rowCount > 0) {
    return (
      layout.rowsTop +
      layout.rowCount * layout.rowHeight +
      (layout.rowCount - 1) * layout.rowGap
    )
  }

  if (layout.podiumStacked) {
    return (
      layout.podiumRunnerTop +
      layout.runnerCover +
      Math.round(layout.podiumTextBlock * 0.9)
    )
  }

  return layout.podiumTop + layout.podiumCover + layout.podiumTextBlock
}

/** The full width the podium covers take up, for checking it fits across. */
export function podiumWidth(layout: CardLayout): number {
  if (layout.podiumStacked) {
    return Math.max(
      layout.podiumCover,
      layout.runnerCover * 2 + layout.podiumColumnGap,
    )
  }

  return (
    layout.podiumCover * (1 + RUNNER_COVER_RATIO * 2) +
    layout.podiumColumnGap * 2
  )
}
