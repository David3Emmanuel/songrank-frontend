/**
 * The geometry of a share card, worked out from the shape and how many songs it
 * has to show.
 *
 * Three arrangements, chosen by shape and length:
 *
 * - One column: the podium, then the rows beneath it. Every square and portrait
 *   card, and a wide card showing only a top three.
 * - A stacked podium: a top three on a tall card, where three squares across a
 *   1080 wide canvas reach a third of the width each and leave the height empty.
 * - Two panes: a wide card that has rows. The podium takes the left pane and the
 *   rows the right, which is what the wide shape is for.
 *
 * Caption positions come from the font sizes rather than from fractions of a
 * block, and the footer's reserve counts the text above its baseline, so neither
 * can collide with the rows.
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
  /** Podium left of the rows, on a wide card that has any. */
  sideBySide: boolean
  paneGap: number
  /** A top three on a tall card stacks, since three squares across cannot fill it. */
  podiumStacked: boolean
  /** Where the podium is centred: the left pane when the panes sit side by side. */
  podiumCentreX: number
  /** How much width the podium may use, for checking it fits. */
  podiumPaneWidth: number
  /** Top of the winner's cover. */
  podiumTop: number
  /** The winner's cover. */
  podiumCover: number
  /** Covers plus captions, so the pane can be centred on its own. */
  podiumBlockHeight: number
  /** The second and third covers. */
  runnerCover: number
  /** Top of the second and third covers, on a stacked podium only. */
  podiumRunnerTop: number
  podiumColumnGap: number
  podium: CaptionMetrics
  runner: CaptionMetrics
  /** Left edge and width of the rows. */
  rowsPaneX: number
  rowsPaneWidth: number
  /** Top of the first row. */
  rowsTop: number
  rowHeight: number
  rowArt: number
  rowGap: number
  rowTitleFont: number
  rowSubFont: number
  rowBadgeRadius: number
  /** Songs past the podium, so 0 for a card of three. */
  rowCount: number
  /**
   * Whether the rows sit on one shared panel instead of a box each, and put the
   * artist to the right of the title.
   *
   * Only worth it on the densest card: flush rows with their own borders draw
   * two lines against each other, which reads as cramped. Derived from the
   * density rather than named per shape, so it cannot drift out of step with the
   * spacing that makes it necessary.
   */
  rowsSharePanel: boolean
}

export function cardLayout(
  format: ShareCardConfig['format'],
  songCount: number,
): CardLayout {
  const { width, height } = CARD_DIMENSIONS[format]
  const tall = format === '9:16'
  const wide = format === '16:9'
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

  const region = contentBottomLimit - podiumTopBase

  const rowCount = Math.max(0, songCount - 3)
  const minRow = at(MIN_ROW_FRACTION)
  const preferredRow = at(PREFERRED_ROW_FRACTION)
  const leadIn = rowCount > 0 ? at(0.02) : 0

  // A wide card with a top ten gives the podium the left pane and the rows the
  // right. A shorter list does not need it: two or four rows under a full width
  // podium read fine, and the panes would only make both halves sparse.
  const sideBySide = wide && songCount >= 10
  const paneGap = sideBySide ? at(0.03) : 0
  const paneWidth = sideBySide
    ? (width - marginX * 2 - paneGap) / 2
    : width - marginX * 2

  // A top three on a tall card stacks instead: three squares across a 1080 wide
  // story reach about a third of the width each, which leaves the height empty.
  const stacked = tall && rowCount === 0

  // Across, the cover is bounded by the width as well as the height, because the
  // podium is three covers side by side.
  const acrossWidth = 1 + RUNNER_COVER_RATIO * 2
  const widthCap = stacked
    ? paneWidth
    : (paneWidth - podiumColumnGap * 2) / acrossWidth
  const minCover = Math.min(at(MIN_COVER_FRACTION), widthCap)
  const maxCover = Math.min(at(MAX_COVER_FRACTION), widthCap)

  const clamp = (value: number, low: number, high: number) =>
    Math.max(low, Math.min(high, value))

  const heightPerRow = (cover: number, gap: number) => {
    if (rowCount === 0) return 0
    const space = region - cover - leadIn - podiumCaption.block
    return Math.floor((space - (rowCount - 1) * gap) / rowCount)
  }

  let rowGap = at(0.012)
  let podiumCover: number
  let rowHeight: number
  let podiumBlock: number
  let podiumTop: number
  let rowsTop: number

  if (sideBySide) {
    // Two panes, each centred in the region and measured on its own.
    rowHeight = Math.min(
      preferredRow,
      Math.floor((region - (rowCount - 1) * rowGap) / rowCount),
    )
    if (rowHeight <= minRow) {
      rowGap = 0
      rowHeight = Math.min(preferredRow, Math.floor(region / rowCount))
    }

    podiumCover = clamp(region - podiumCaption.block, minCover, maxCover)
    podiumBlock = podiumCover + podiumCaption.block

    const rowsBlock = rowCount * rowHeight + (rowCount - 1) * rowGap
    podiumTop = podiumTopBase + Math.max(0, Math.floor((region - podiumBlock) / 2))
    rowsTop = podiumTopBase + Math.max(0, Math.floor((region - rowsBlock) / 2))
  } else {
    // One column: the podium takes the slack, the rows take what is left, and
    // the pair is centred together.
    const preferredRows =
      rowCount > 0 ? rowCount * preferredRow + (rowCount - 1) * rowGap : 0

    podiumCover = clamp(
      region - preferredRows - leadIn - podiumCaption.block,
      minCover,
      maxCover,
    )
    rowHeight = heightPerRow(podiumCover, rowGap)

    // Spacing is the first thing to go on a dense card. Rows carry borders, so
    // touching ones still read as separate, whereas a row at the legibility floor
    // does not get better by keeping the space between them.
    if (rowCount > 0 && rowHeight <= minRow) {
      rowGap = 0
      rowHeight = heightPerRow(podiumCover, rowGap)
    }

    // Still too tight, so the rows take their space back from the podium.
    if (rowCount > 0 && rowHeight < minRow) {
      podiumCover = clamp(
        region -
          (rowCount * minRow + (rowCount - 1) * rowGap) -
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
    if (stacked) {
      const fits =
        (region - podiumCaption.block - runnerCaption.block) /
        (1 + STACKED_RUNNER_RATIO)
      podiumCover = Math.max(minCover, Math.min(widthCap, Math.floor(fits)))
    }

    podiumBlock = stacked
      ? podiumCover +
        podiumCaption.block +
        Math.round(podiumCover * STACKED_RUNNER_RATIO) +
        runnerCaption.block
      : podiumCover + podiumCaption.block

    const contentHeight =
      podiumBlock +
      leadIn +
      (rowCount > 0 ? rowCount * rowHeight + (rowCount - 1) * rowGap : 0)
    podiumTop = podiumTopBase + Math.max(0, Math.floor((region - contentHeight) / 2))
    rowsTop = podiumTop + podiumBlock + leadIn
  }

  const runnerCover = Math.round(
    podiumCover * (stacked ? STACKED_RUNNER_RATIO : RUNNER_COVER_RATIO),
  )
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
    sideBySide,
    paneGap,
    podiumStacked: stacked,
    podiumCentreX: sideBySide ? marginX + paneWidth / 2 : width / 2,
    podiumPaneWidth: paneWidth,
    podiumTop,
    podiumCover,
    podiumBlockHeight: podiumBlock,
    runnerCover,
    podiumRunnerTop,
    podiumColumnGap,
    podium: podiumCaption,
    runner: runnerCaption,
    rowsPaneX: sideBySide ? marginX + paneWidth + paneGap : marginX,
    rowsPaneWidth: paneWidth,
    rowsTop,
    rowHeight,
    rowArt,
    rowGap,
    rowTitleFont: Math.min(34, Math.max(18, Math.round(rowHeight * 0.42))),
    rowSubFont: Math.min(26, Math.max(15, Math.round(rowHeight * 0.32))),
    rowBadgeRadius: Math.min(26, Math.max(16, Math.round(rowHeight * 0.36))),
    rowCount,
    rowsSharePanel: !sideBySide && rowGap === 0 && rowCount >= 6,
  }
}

/** The height the rows take up, for checking the pane is centred. */
export function rowsBlockHeight(layout: CardLayout): number {
  if (layout.rowCount === 0) return 0
  return (
    layout.rowCount * layout.rowHeight + (layout.rowCount - 1) * layout.rowGap
  )
}

/** The bottom edge of the lowest thing drawn, for checking nothing runs off. */
export function layoutBottom(layout: CardLayout): number {
  const rowsBottom =
    layout.rowCount > 0 ? layout.rowsTop + rowsBlockHeight(layout) : 0

  const podiumBottom = layout.podiumStacked
    ? layout.podiumRunnerTop + layout.runnerCover + layout.runner.block
    : layout.podiumTop + layout.podiumBlockHeight

  return Math.max(rowsBottom, podiumBottom)
}

/** The full width the podium covers take up, for checking it fits its pane. */
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
