import type { Track, SongRanking, ShareCardConfig } from './types'
import { coverCrop, formatDurationMs, largerThumbnailUrl } from './videoMetadata'

/** Place colours, matching the podium on the results screen. */
const PLACE_COLOURS = ['#f59e0b', '#94a3b8', '#f97316']

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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
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

/**
 * Draws the shareable card and hands back a data URL.
 *
 * Deliberately close to the results screen: light by default, place badges
 * instead of emoji medals, covers cropped rather than stretched, and no scores
 * unless they are asked for.
 */
export async function generateShareCard(
  topTracks: Array<{ track: Track; ranking: SongRanking }>,
  config: ShareCardConfig,
  playlistName: string = 'My ranking',
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  const dimensions = {
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '16:9': { width: 1920, height: 1080 },
  }
  const { width, height } = dimensions[config.format]
  canvas.width = width
  canvas.height = height

  const colours = palette(config.theme)
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, colours.background[0])
  gradient.addColorStop(1, colours.background[1])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  const tall = config.format === '9:16'
  const rows = topTracks.slice(0, config.top_n)
  const rowHeight = tall ? 260 : 150
  const artSize = rowHeight - 60
  const gap = tall ? 28 : 18
  const marginX = tall ? 70 : 60
  const startY = tall ? 300 : 240

  // Header
  ctx.textAlign = 'center'
  ctx.fillStyle = colours.text
  ctx.font = 'bold 64px system-ui, sans-serif'
  ctx.fillText(truncate(ctx, playlistName, width - 160), width / 2, 140)

  ctx.fillStyle = colours.muted
  ctx.font = '36px system-ui, sans-serif'
  const count = rows.length
  ctx.fillText(`Top ${count} song${count === 1 ? '' : 's'}`, width / 2, 196)

  // Covers up front, in parallel: waiting for them one at a time was the slow
  // part of generating a card.
  const covers = await Promise.all(rows.map((row) => loadCover(row.track)))

  rows.forEach((row, i) => {
    const y = startY + i * (rowHeight + gap)
    const colour = PLACE_COLOURS[i] ?? '#64748b'

    ctx.fillStyle = colours.card
    ctx.strokeStyle = i < 3 ? colour : colours.border
    ctx.lineWidth = i < 3 ? 4 : 2
    roundRect(ctx, marginX, y, width - marginX * 2, rowHeight, 28)
    ctx.fill()
    ctx.stroke()

    // Place badge
    const badgeX = marginX + 54
    const badgeY = y + rowHeight / 2
    ctx.beginPath()
    ctx.arc(badgeX, badgeY, 30, 0, Math.PI * 2)
    ctx.fillStyle = colour
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 32px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(i + 1), badgeX, badgeY + 11)

    // Cover, cropped to a square
    const artX = marginX + 104
    const artY = y + (rowHeight - artSize) / 2
    const cover = covers[i]

    ctx.save()
    roundRect(ctx, artX, artY, artSize, artSize, 18)
    ctx.clip()
    if (cover) {
      const crop = coverCrop(
        cover.naturalWidth || cover.width,
        cover.naturalHeight || cover.height,
      )
      ctx.drawImage(
        cover,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        artX,
        artY,
        artSize,
        artSize,
      )
    } else {
      ctx.fillStyle = colours.border
      ctx.fillRect(artX, artY, artSize, artSize)
    }
    ctx.restore()

    // Title and artist
    const textX = artX + artSize + 32
    const maxWidth = width - marginX - 30 - textX

    ctx.textAlign = 'left'
    ctx.fillStyle = colours.text
    ctx.font = `bold ${tall ? 40 : 34}px system-ui, sans-serif`
    ctx.fillText(
      truncate(ctx, row.track.title, maxWidth),
      textX,
      y + rowHeight / 2 - 14,
    )

    ctx.fillStyle = colours.muted
    ctx.font = `${tall ? 30 : 26}px system-ui, sans-serif`
    const length = formatDurationMs(row.track.durationMs)
    const subtitle = length
      ? `${row.track.artist} · ${length}`
      : row.track.artist
    ctx.fillText(
      truncate(ctx, subtitle, maxWidth),
      textX,
      y + rowHeight / 2 + 30,
    )
  })

  // Footer. No domain is claimed, since this app does not have one to promise.
  ctx.textAlign = 'center'
  ctx.fillStyle = colours.muted
  ctx.font = '32px system-ui, sans-serif'
  ctx.fillText('SongRank', width / 2, height - 60)

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
