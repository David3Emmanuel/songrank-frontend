import type { Track, ShareCardConfig } from './types'
import { cardSubtitle, PLACE_COLOURS } from './scoreDisplay'
import { coverCrop, formatDurationMs, largerThumbnailUrl } from './videoMetadata'
import { cardLayout } from './shareLayout'

interface Palette {
  background: [string, string]
  card: string
  border: string
  text: string
  muted: string
}

function palette(theme: 'dark' | 'light'): Palette {
  return theme === 'dark'
    ? {
        background: ['#0f172a', '#1e293b'],
        card: 'rgba(255,255,255,0.06)',
        border: 'rgba(255,255,255,0.12)',
        text: '#ffffff',
        muted: 'rgba(255,255,255,0.6)',
      }
    : {
        background: ['#ffffff', '#f1f5f9'],
        card: '#ffffff',
        border: '#e2e8f0',
        text: '#0f172a',
        muted: '#64748b',
      }
}



function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius)
    return
  }
  ctx.rect(x, y, width, height)
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/** The cover at the best size available, or null if none of them load. */
async function loadCover(track: Track): Promise<HTMLImageElement | null> {
  const candidates = [largerThumbnailUrl(track.coverImage), track.coverImage]
  for (const url of candidates) {
    if (!url) continue
    try {
      return await loadImage(url)
    } catch {
      // Try the next size down rather than giving up on the cover.
    }
  }
  return null
}

function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text

  let cut = text
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1)
  }
  return `${cut}…`
}

/** Draws a cover as a square, cropped rather than stretched. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  cover: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
  radius: number,
  placeholder: string,
) {
  ctx.save()
  roundRect(ctx, x, y, size, size, radius)
  ctx.clip()

  if (cover) {
    const crop = coverCrop(
      cover.naturalWidth || cover.width,
      cover.naturalHeight || cover.height,
    )
    ctx.drawImage(cover, crop.sx, crop.sy, crop.sw, crop.sh, x, y, size, size)
  } else {
    ctx.fillStyle = placeholder
    ctx.fillRect(x, y, size, size)
  }

  ctx.restore()
}

export interface ShareCardInput {
  /** The songs to show, in ranking order. */
  tracks: Track[]
  playlistName: string
  /** How many songs the ranking covered, so a top three can be put in context. */
  totalSongs: number
  config: ShareCardConfig
  /**
   * How a row lays out its text. Both arrangements are drawn while the densest
   * card is being chosen between them; one of them goes once that is settled.
   */
  rowText?: 'stacked' | 'inline'
  /** Multiplier on the row type, for comparing sizes. */
  rowTitleScale?: number
}

/**
 * Draws the shareable card and hands back a blob.
 *
 * The top three get the podium the results screen uses, with the winner's cover
 * larger, and anything past third is a row. Light by default, covers cropped
 * rather than stretched, and no scores: this is a summary, not the ranking.
 */
export async function generateShareCard({
  tracks,
  playlistName,
  totalSongs,
  config,
  rowText = 'stacked',
  rowTitleScale = 1,
}: ShareCardInput): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  const shown = tracks.slice(0, config.top_n)
  const layout = cardLayout(config.format, shown.length)
  const {
    width,
    height,
    tall,
    marginX,
    headerY,
    subtitleY,
    podiumTop,
    podiumCover,
    rowHeight,
    rowArt,
    rowGap,
    rowsTop,
    runnerCover,
    podiumStacked,
    podium: podiumFonts,
    runner: runnerFonts,
    headerFont,
    subtitleFont,
    footerFont,
    rowTitleFont,
    rowSubFont,
    rowBadgeRadius,
    rowColumns,
    rowsPerColumn,
    rowPaneGap,
    rowPaneWidth,
    rowsSharePanel,
    podiumColumnGap,
    podiumRunnerTop,
  } = layout

  canvas.width = width
  canvas.height = height

  const colours = palette(config.theme)
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, colours.background[0])
  gradient.addColorStop(1, colours.background[1])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const podium = shown.slice(0, 3)
  const rest = shown.slice(3)

  // Header
  ctx.textAlign = 'center'
  ctx.fillStyle = colours.text
  ctx.font = `bold ${headerFont}px system-ui, sans-serif`
  ctx.fillText(
    truncate(ctx, playlistName, width - marginX * 2),
    width / 2,
    headerY,
  )

  ctx.fillStyle = colours.muted
  ctx.font = `${subtitleFont}px system-ui, sans-serif`
  ctx.fillText(cardSubtitle(shown.length, totalSongs), width / 2, subtitleY)

  // Covers up front, in parallel: one round trip rather than one per song.
  const covers = await Promise.all(shown.map((track) => loadCover(track)))

  // Podium. Across on a square or wide card, with second and third flanking the
  // winner; stacked on a tall card, since three squares across a 1080 wide story
  // leave most of the height empty.
  const columns = [2, 1, 3].filter((place) => place <= podium.length)
  const badge = (place: number, cx: number, cy: number) => {
    const radius = tall ? 26 : 22
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fillStyle = PLACE_COLOURS[place - 1] ?? '#64748b'
    ctx.fill()

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${tall ? 30 : 26}px system-ui, sans-serif`
    ctx.fillText(String(place), cx, cy + (tall ? 11 : 9))
  }

  const caption = (
    track: Track | undefined,
    metrics: { titleFont: number; artistFont: number; durationFont: number },
    cx: number,
    titleY: number,
    artistY: number,
    durationY: number,
    maxWidth: number,
  ) => {
    if (!track) return

    ctx.textAlign = 'center'
    ctx.fillStyle = colours.text
    ctx.font = `bold ${metrics.titleFont}px system-ui, sans-serif`
    ctx.fillText(truncate(ctx, track.title, maxWidth), cx, titleY)

    ctx.fillStyle = colours.muted
    ctx.font = `${metrics.artistFont}px system-ui, sans-serif`
    ctx.fillText(truncate(ctx, track.artist, maxWidth), cx, artistY)

    const length = formatDurationMs(track.durationMs)
    if (length) {
      ctx.font = `${metrics.durationFont}px system-ui, sans-serif`
      ctx.fillText(length, cx, durationY)
    }
  }

  if (columns.length > 0 && podiumStacked) {
    // Winner above, runners beneath.
    const winnerX = (width - podiumCover) / 2
    drawCover(ctx, covers[0] ?? null, winnerX, podiumTop, podiumCover, 22, colours.border)
    badge(1, width / 2, podiumTop - (tall ? 18 : 14))
    caption(
      podium[0],
      podiumFonts,
      width / 2,
      podiumTop + podiumCover + podiumFonts.titleY,
      podiumTop + podiumCover + podiumFonts.artistY,
      podiumTop + podiumCover + podiumFonts.durationY,
      width - marginX * 2,
    )

    const runners = [2, 3].filter((place) => place <= podium.length)
    const runnerTotal =
      runners.length * runnerCover + Math.max(0, runners.length - 1) * podiumColumnGap
    let x = (width - runnerTotal) / 2

    runners.forEach((place) => {
      drawCover(
        ctx,
        covers[place - 1] ?? null,
        x,
        podiumRunnerTop,
        runnerCover,
        18,
        colours.border,
      )
      badge(place, x + runnerCover / 2, podiumRunnerTop - (tall ? 18 : 14))
      caption(
        podium[place - 1],
        runnerFonts,
        x + runnerCover / 2,
        podiumRunnerTop + runnerCover + runnerFonts.titleY,
        podiumRunnerTop + runnerCover + runnerFonts.artistY,
        podiumRunnerTop + runnerCover + runnerFonts.durationY,
        runnerCover + 40,
      )
      x += runnerCover + podiumColumnGap
    })
  } else if (columns.length > 0) {
    const widths = columns.map((place) =>
      place === 1 ? podiumCover : runnerCover,
    )
    const totalWidth =
      widths.reduce((sum, w) => sum + w, 0) +
      podiumColumnGap * (columns.length - 1)
    let x = (width - totalWidth) / 2

    columns.forEach((place, index) => {
      const track = podium[place - 1]
      const cover = covers[place - 1] ?? null
      const columnWidth = widths[index]
      const coverSize = place === 1 ? podiumCover : runnerCover
      const coverX = x + (columnWidth - coverSize) / 2
      const coverY = podiumTop + (podiumCover - coverSize)

      drawCover(
        ctx,
        cover,
        coverX,
        coverY,
        coverSize,
        tall ? 20 : 16,
        colours.border,
      )
      badge(place, coverX + coverSize / 2, coverY - (tall ? 18 : 14))
      caption(
        track,
        podiumFonts,
        x + columnWidth / 2,
        podiumTop + podiumCover + podiumFonts.titleY,
        podiumTop + podiumCover + podiumFonts.artistY,
        podiumTop + podiumCover + podiumFonts.durationY,
        columnWidth + 20,
      )

      x += columnWidth + podiumColumnGap
    })
  }

  // Everything past third
  //
  // One panel behind all of them, rather than a bordered box each. Seven boxes
  // stacked read as cramped even with no spacing between them, and the borders
  // ate the width. A single panel gives the rows a shared surface and the room
  // back, and the badges and covers carry the rhythm instead.
  if (rowsSharePanel && rest.length > 0) {
    const panelHeight =
      rowsPerColumn * rowHeight + Math.max(0, rowsPerColumn - 1) * rowGap

    for (let pane = 0; pane < rowColumns; pane++) {
      if (rest.length <= pane * rowsPerColumn) continue

      const paneX = marginX + pane * (rowPaneWidth + rowPaneGap)
      ctx.fillStyle = colours.card
      ctx.strokeStyle = colours.border
      ctx.lineWidth = 2
      roundRect(ctx, paneX, rowsTop, rowPaneWidth, panelHeight, 26)
      ctx.fill()
      ctx.stroke()
    }
  }

  rest.forEach((track, index) => {
    const place = index + 4
    const cover = covers[index + 3] ?? null

    // A wide card sets the rows in two panes, so the column and the row within
    // it come from the index rather than the index being the row.
    const column = rowColumns > 1 ? Math.floor(index / rowsPerColumn) : 0
    const rowInColumn = rowColumns > 1 ? index % rowsPerColumn : index
    const paneX = marginX + column * (rowPaneWidth + rowPaneGap)
    const y = rowsTop + rowInColumn * (rowHeight + rowGap)
    const colour = PLACE_COLOURS[place - 1] ?? colours.border

    // A box each, except where they share a panel and the boxes would only draw
    // two borders against each other.
    if (!rowsSharePanel) {
      ctx.fillStyle = colours.card
      ctx.strokeStyle = colours.border
      ctx.lineWidth = 2
      roundRect(ctx, paneX, y, rowPaneWidth, rowHeight, 20)
      ctx.fill()
      ctx.stroke()
    }

    // Place badge
    const badgeX = paneX + (tall ? 50 : 42)
    const badgeY = y + rowHeight / 2
    ctx.beginPath()
    ctx.arc(badgeX, badgeY, rowBadgeRadius, 0, Math.PI * 2)
    ctx.fillStyle = colour
    ctx.fill()

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.round(rowBadgeRadius * 1.1)}px system-ui, sans-serif`
    ctx.fillText(String(place), badgeX, badgeY + Math.round(rowBadgeRadius * 0.4))

    // Cover
    const artX = paneX + (tall ? 96 : 80)
    const artY = y + (rowHeight - rowArt) / 2
    drawCover(ctx, cover, artX, artY, rowArt, 14, colours.border)

    // Row text. Two arrangements are drawn while the densest card is being
    // decided between them: the artist and length stacked under the title, or
    // lined up on the right of it. `rowTitleScale` exists for the same
    // comparison, to see whether smaller type reads better than moving it.
    const textX = artX + rowArt + (tall ? 28 : 22)
    const metaRight = paneX + rowPaneWidth - 30
    const length = formatDurationMs(track.durationMs)
    const meta = length ? `${track.artist} · ${length}` : track.artist
    const scale = rowTitleScale
    const titleFont = Math.round(rowTitleFont * scale)
    const subFont = Math.round(rowSubFont * scale)

    if (rowText === 'inline') {
      const baseline = y + rowHeight / 2 + Math.round(titleFont * 0.35)

      ctx.textAlign = 'right'
      ctx.fillStyle = colours.muted
      ctx.font = `${subFont}px system-ui, sans-serif`
      const metaWidth = Math.min(
        ctx.measureText(meta).width,
        (metaRight - textX) * 0.5,
      )
      ctx.fillText(truncate(ctx, meta, metaWidth), metaRight, baseline)

      ctx.textAlign = 'left'
      ctx.fillStyle = colours.text
      ctx.font = `bold ${titleFont}px system-ui, sans-serif`
      ctx.fillText(
        truncate(ctx, track.title, metaRight - metaWidth - 28 - textX),
        textX,
        baseline,
      )
    } else {
      const maxWidth = metaRight - textX

      ctx.textAlign = 'left'
      ctx.fillStyle = colours.text
      ctx.font = `bold ${titleFont}px system-ui, sans-serif`
      ctx.fillText(
        truncate(ctx, track.title, maxWidth),
        textX,
        y + rowHeight / 2 - Math.round(subFont * 0.4),
      )

      ctx.fillStyle = colours.muted
      ctx.font = `${subFont}px system-ui, sans-serif`
      ctx.fillText(
        truncate(ctx, meta, maxWidth),
        textX,
        y + rowHeight / 2 + Math.round(subFont * 1.2),
      )
    }
  })

  // Footer. No domain is claimed, since this app does not have one to promise.
  ctx.textAlign = 'center'
  ctx.fillStyle = colours.muted
  ctx.font = `${footerFont}px system-ui, sans-serif`
  ctx.fillText('SongRank', width / 2, layout.footerY)

  // A blob rather than a data URL: base64 inflates the bytes by a third, and
  // the share sheet wants a Blob anyway.
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not encode the card'))
    }, 'image/png')
  })
}

/** Saves a blob as a file, cleaning up the object URL afterwards. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported'

/**
 * Hands the image to the platform share sheet.
 *
 * Cancelling and not being supported are told apart on purpose: dismissing the
 * sheet used to look like a failure, and the caller downloaded the file as a
 * consolation prize the user never asked for.
 */
export async function shareImage(
  blob: Blob,
  title: string,
  text: string,
): Promise<ShareOutcome> {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) {
    return 'unsupported'
  }

  try {
    const file = new File([blob], 'songrank.png', { type: 'image/png' })
    const shareData = { title, text, files: [file] }

    if (!navigator.canShare(shareData)) return 'unsupported'

    await navigator.share(shareData)
    return 'shared'
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
    console.error('Share failed:', error)
    return 'unsupported'
  }
}
