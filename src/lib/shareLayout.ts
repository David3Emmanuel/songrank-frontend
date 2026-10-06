/**
 * The geometry of a share card, worked out from the shape and how many songs it
 * has to show.
 *
 * Everything is derived from the height, and the two blocks share the space: the
 * rows take a preferred height and the podium cover absorbs what is left, so a
 * three song card gets a large podium rather than a small one stranded under the
 * header.
 *
 * Caption positions come from the font sizes rather than from fractions of a
 * block. Spacing three lines by eye had them crowding each other, and the
 * footer's reserve counted its baseline but not the text above it, which put
 * "SongRank" on top of the last row. Both are now impossible by construction, and
 * both are asserted in the tests.
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

export interface CaptionMetrics {
  titleFont: number
  artistFont: number
  durationFont: number
  titleY: number
  artistY: number
  durationY: number
  /** Height needed below a cover to hold all three lines. */
  block: number
}

/** Baselines derived from the fonts, so the lines cannot overlap each other. */
function caption(
  titleFont: number,
  artistFont: number,
  durationFont: number,
): CaptionMetrics {
  // Each line is spaced by the size of the line above it, not by its own, or a
  // large title would run into a small artist.
  const titleY = Math.round(titleFont * 1.2)
  const artistY = titleY + Math.round(titleFont * 1.3)
  const durationY = artistY + Math.round(artistFont * 1.35)

  return {
    titleFont,
    artistFont,
    durationFont,
    titleY,
    artistY,
    durationY,
    block: durationY + Math.round(durationFont * 0.4),
  }
}

export interface CardLayout {
  width: number
  height: number
  tall: boolean
  marginX: number
  headerY: number
  headerFont: number
  subtitleY: number
  subtitleFont: number
  footerY: number
  footerFont: number
  /** Content must end above this, or it collides with the footer text. */
  contentBottomLimit: number
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
  podium: CaptionMetrics
  runner: CaptionMetrics
  /** Top of the first row past the podium. */
  rowsTop: number
  rowHeight: number
  rowArt: number
  rowGap: number
  rowTitleFont: number
  rowSubFont: number
  rowBadgeRadius: number
  /** Songs past the podium, so 0 for a card of three. */
  rowCount: number
  /** 2 on a wide card, where the rows sit in two panes. */
  rowColumns: number
  /** Rows in the fullest pane, which is what the height is measured on. */
  rowsPerColumn: number
  rowPaneGap: number
  rowPaneWidth: number
}

export function cardLayout(
  format: ShareCardConfig['format'],
  songCount: number,
): CardLayout {
  const { width, height } = CARD_DIMENSIONS[format]
  const tall = format === '9:16'
  const at = (fraction: number) => Math.round(height * fraction)

  const headerFont = tall ? 66 : 56
  const subtitleFont = tall ? 36 : 32
  const footerFont = tall ? 32 : 28

  const headerY = at(0.105)
  const subtitleY = at(0.152)
  const podiumTopBase = at(0.2)
  const footerY = height - at(0.055)
  // The footer's own text rises above its baseline and must not be run into.
  const contentBottomLimit = footerY - Math.round(footerFont * 1.4)
  const marginX = tall ? 70 : 60
  const podiumColumnGap = tall ? COLUMN_GAP.tall : COLUMN_GAP.compact

  const podiumCaption = tall ? caption(42, 32, 27) : caption(30, 24, 20)
  const runnerCaption = tall ? caption(36, 28, 24) : caption(26, 21, 18)

  // The space between the header and the footer, shared by the podium and rows.
  const region = contentBottomLimit - podiumTopBase

  const wide = format === '16:9'
  const rowCount = Math.max(0, songCount - 3)
  const minRow = at(MIN_ROW_FRACTION)
  const preferredRow = at(PREFERRED_ROW_FRACTION)
  const leadIn = rowCount > 0 ? at(0.02) : 0

  // A wide card lays the rows out in two panes: seven rows in one column of a
  // 1080 tall canvas is a cramped strip, where two panes of four have room.
  const rowColumns = wide && rowCount > 0 ? 2 : 1
  const rowsPerColumn = rowColumns > 0 ? Math.ceil(rowCount / rowColumns) : 0
  const rowPaneGap = rowColumns === 2 ? at(0.03) : 0
  const rowPaneWidth =
    (width - marginX * 2 - rowPaneGap * (rowColumns - 1)) / rowColumns

  /** The space between rows, dropped when a card gets dense. */
  let rowGap = at(0.012)

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
    rowsPerColumn > 0
      ? rowsPerColumn * preferredRow + (rowsPerColumn - 1) * rowGap
      : 0

  // The podium takes the slack, within bounds.
  let podiumCover = clamp(
    region - preferredRows - leadIn - podiumCaption.block,
    minCover,
    maxCover,
  )

  const heightPerRow = (cover: number, gap: number) => {
    if (rowsPerColumn === 0) return 0
    const space = region - cover - leadIn - podiumCaption.block
    return Math.floor((space - (rowsPerColumn - 1) * gap) / rowsPerColumn)
  }

  let rowHeight = heightPerRow(podiumCover, rowGap)

  // Spacing is the first thing to go on a dense card. Rows carry borders, so
  // touching ones still read as separate, whereas a row at the legibility floor
  // does not get better by keeping the space between them.
  if (rowsPerColumn > 0 && rowHeight <= minRow) {
    rowGap = 0
    rowHeight = heightPerRow(podiumCover, rowGap)
  }

  // Still too tight, so the rows take their space back from the podium.
  if (rowsPerColumn > 0 && rowHeight < minRow) {
    podiumCover = clamp(
      region -
        (rowsPerColumn * minRow + (rowsPerColumn - 1) * rowGap) -
        leadIn -
        podiumCaption.block,
      Math.min(at(HARD_MIN_COVER_FRACTION), widthCap),
      maxCover,
    )
    rowHeight = heightPerRow(podiumCover, rowGap)
  }

  // And rows that came out too generous keep to a sensible height, leaving the
  // rest as even margin rather than a row the size of a postcard.
  if (rowHeight > preferredRow) rowHeight = preferredRow

  // A stacked podium has two cover blocks and two caption blocks to fit.
  let runnerCover = Math.round(podiumCover * RUNNER_COVER_RATIO)
  if (stacked) {
    const fits =
      (region - podiumCaption.block - runnerCaption.block) /
      (1 + STACKED_RUNNER_RATIO)
    podiumCover = Math.max(minCover, Math.min(widthCap, Math.floor(fits)))
    runnerCover = Math.round(podiumCover * STACKED_RUNNER_RATIO)
  }

  const podiumBlock = stacked
    ? podiumCover + podiumCaption.block + runnerCover + runnerCaption.block
    : podiumCover + podiumCaption.block

  // Leftover space is split above and below, so the card is filled rather than
  // pinned under the header.
  const contentHeight =
    podiumBlock +
    leadIn +
    (rowsPerColumn > 0
      ? rowsPerColumn * rowHeight + (rowsPerColumn - 1) * rowGap
      : 0)
  const slack = Math.max(0, region - contentHeight)
  const podiumTop = podiumTopBase + Math.floor(slack / 2)

  const podiumRunnerTop = podiumTop + podiumCover + podiumCaption.block
  const rowArt = rowHeight > 0 ? Math.max(24, rowHeight - (tall ? 40 : 22)) : 0

  return {
    width,
    height,
    tall,
    marginX,
    headerY,
    headerFont,
    subtitleY,
    subtitleFont,
    footerY,
    footerFont,
    contentBottomLimit,
    podiumStacked: stacked,
    podiumTop,
    podiumCover,
    runnerCover,
    podiumRunnerTop,
    podiumColumnGap,
    podium: podiumCaption,
    runner: runnerCaption,
    rowsTop: podiumTop + podiumBlock + leadIn,
    rowHeight,
    rowArt,
    rowGap,
    rowTitleFont: Math.min(34, Math.max(18, Math.round(rowHeight * 0.42))),
    rowSubFont: Math.min(26, Math.max(15, Math.round(rowHeight * 0.32))),
    rowBadgeRadius: Math.min(26, Math.max(16, Math.round(rowHeight * 0.36))),
    rowCount,
    rowColumns,
    rowsPerColumn,
    rowPaneGap,
    rowPaneWidth,
  }
}

/** The bottom edge of the last thing drawn, for checking nothing runs off. */
export function layoutBottom(layout: CardLayout): number {
  if (layout.rowCount > 0) {
    return (
      layout.rowsTop +
      layout.rowsPerColumn * layout.rowHeight +
      (layout.rowsPerColumn - 1) * layout.rowGap
    )
  }

  if (layout.podiumStacked) {
    return layout.podiumRunnerTop + layout.runnerCover + layout.runner.block
  }

  return layout.podiumTop + layout.podiumCover + layout.podium.block
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
