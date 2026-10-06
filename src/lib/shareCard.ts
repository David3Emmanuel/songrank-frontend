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
  } = layout
  const podiumText = layout.podiumTextBlock

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
  const podiumTitleY = podiumTop + podiumCover + Math.round(podiumText * 0.5)
  const podiumArtistY = podiumTop + podiumCover + Math.round(podiumText * 0.85)

  // Header
  ctx.textAlign = 'center'
  ctx.fillStyle = colours.text
  ctx.font = `bold ${tall ? 66 : 56}px system-ui, sans-serif`
  ctx.fillText(
    truncate(ctx, playlistName, width - marginX * 2),
    width / 2,
    headerY,
  )

  ctx.fillStyle = colours.muted
  ctx.font = `${tall ? 36 : 32}px system-ui, sans-serif`
  ctx.fillText(cardSubtitle(shown.length, totalSongs), width / 2, subtitleY)

  // Covers up front, in parallel: one round trip rather than one per song.
  const covers = await Promise.all(shown.map((track) => loadCover(track)))

  // Podium: second and third flank the winner, as they do on the screen.
  const columns = [2, 1, 3].filter((place) => place <= podium.length)
  if (columns.length > 0) {
    const gap = tall ? 40 : 30
    const widths = columns.map((place) =>
      place === 1 ? podiumCover : Math.round(podiumCover * 0.78),
    )
    const totalWidth = widths.reduce((sum, w) => sum + w, 0) + gap * (columns.length - 1)
    let x = (width - totalWidth) / 2

    columns.forEach((place, index) => {
      const track = podium[place - 1]
      const cover = covers[place - 1] ?? null
      const columnWidth = widths[index]
      const coverSize = place === 1 ? podiumCover : Math.round(podiumCover * 0.78)
      const coverX = x + (columnWidth - coverSize) / 2
      const coverY = podiumTop + (podiumCover - coverSize)

      // Cover
      drawCover(ctx, cover, coverX, coverY, coverSize, tall ? 20 : 16, colours.border)

      // Place badge, straddling the top edge of the cover
      const badgeRadius = tall ? 26 : 22
      const badgeX = coverX + coverSize / 2
      const badgeY = coverY - badgeRadius + 8
      ctx.beginPath()
      ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2)
      ctx.fillStyle = PLACE_COLOURS[place - 1] ?? '#64748b'
      ctx.fill()

      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffffff'
      ctx.font = `bold ${tall ? 30 : 26}px system-ui, sans-serif`
      ctx.fillText(String(place), badgeX, badgeY + (tall ? 11 : 9))

      // Title and artist
      if (track) {
        ctx.fillStyle = colours.text
        ctx.font = `bold ${tall ? 34 : 28}px system-ui, sans-serif`
        ctx.fillText(
          truncate(ctx, track.title, columnWidth + 20),
          x + columnWidth / 2,
          podiumTitleY,
        )

        ctx.fillStyle = colours.muted
        ctx.font = `${tall ? 26 : 22}px system-ui, sans-serif`
        ctx.fillText(
          truncate(ctx, track.artist, columnWidth + 20),
          x + columnWidth / 2,
          podiumArtistY,
        )
      }

      x += columnWidth + gap
    })
  }

  // Everything past third
  const rowTitle = Math.min(34, Math.max(18, Math.round(rowHeight * 0.42)))
  const rowSub = Math.min(26, Math.max(15, Math.round(rowHeight * 0.32)))
  const rowBadge = Math.min(26, Math.max(16, Math.round(rowHeight * 0.36)))

  rest.forEach((track, index) => {
    const place = index + 4
    const cover = covers[index + 3] ?? null
    const y = rowsTop + index * (rowHeight + rowGap)
    const colour = PLACE_COLOURS[place - 1] ?? colours.border

    ctx.fillStyle = colours.card
    ctx.strokeStyle = colours.border
    ctx.lineWidth = 2
    roundRect(ctx, marginX, y, width - marginX * 2, rowHeight, 20)
    ctx.fill()
    ctx.stroke()

    // Place badge
    const badgeX = marginX + (tall ? 50 : 42)
    const badgeY = y + rowHeight / 2
    ctx.beginPath()
    ctx.arc(badgeX, badgeY, rowBadge, 0, Math.PI * 2)
    ctx.fillStyle = colour
    ctx.fill()

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.round(rowBadge * 1.1)}px system-ui, sans-serif`
    ctx.fillText(String(place), badgeX, badgeY + Math.round(rowBadge * 0.4))

    // Cover
    const artX = marginX + (tall ? 96 : 80)
    const artY = y + (rowHeight - rowArt) / 2
    drawCover(ctx, cover, artX, artY, rowArt, 14, colours.border)

    // Title, artist and length
    const textX = artX + rowArt + (tall ? 28 : 22)
    const maxWidth = width - marginX - 30 - textX
    const length = formatDurationMs(track.durationMs)

    ctx.textAlign = 'left'
    ctx.fillStyle = colours.text
    ctx.font = `bold ${rowTitle}px system-ui, sans-serif`
    ctx.fillText(
      truncate(ctx, track.title, maxWidth),
      textX,
      y + rowHeight / 2 - Math.round(rowSub * 0.4),
    )

    ctx.fillStyle = colours.muted
    ctx.font = `${rowSub}px system-ui, sans-serif`
    ctx.fillText(
      truncate(ctx, length ? `${track.artist} · ${length}` : track.artist, maxWidth),
      textX,
      y + rowHeight / 2 + Math.round(rowSub * 1.2),
    )
  })

  // Footer. No domain is claimed, since this app does not have one to promise.
  ctx.textAlign = 'center'
  ctx.fillStyle = colours.muted
  ctx.font = `${tall ? 32 : 28}px system-ui, sans-serif`
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
