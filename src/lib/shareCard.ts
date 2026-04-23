import type { Track, SongRanking, ShareCardConfig } from './types'

/**
 * Generates a shareable social media card as a data URL
 * @param topTracks Top N tracks to display
 * @param config Configuration for the card
 * @param playlistName Name of the playlist
 * @returns Data URL of the generated image
 */
export async function generateShareCard(
  topTracks: Array<{ track: Track; ranking: SongRanking }>,
  config: ShareCardConfig,
  playlistName: string = 'My Playlist',
): Promise<string> {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not get canvas context')

  // Set dimensions based on format
  const dimensions = {
    '9:16': { width: 1080, height: 1920 }, // Instagram Stories
    '1:1': { width: 1080, height: 1080 }, // Instagram Square
    '16:9': { width: 1920, height: 1080 }, // Twitter/X
  }
  const { width, height } = dimensions[config.format]
  canvas.width = width
  canvas.height = height

  // Background
  const gradient = ctx.createLinearGradient(0, 0, width, height)
  if (config.theme === 'dark') {
    gradient.addColorStop(0, '#1e1b4b') // indigo-900
    gradient.addColorStop(0.5, '#0f172a') // slate-900
    gradient.addColorStop(1, '#581c87') // purple-900
  } else {
    gradient.addColorStop(0, '#fef3c7') // amber-100
    gradient.addColorStop(0.5, '#fce7f3') // pink-100
    gradient.addColorStop(1, '#ddd6fe') // violet-200
  }
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Title
  const textColor = config.theme === 'dark' ? '#ffffff' : '#000000'
  ctx.fillStyle = textColor
  ctx.font = 'bold 72px sans-serif'
  ctx.textAlign = 'center'
  const titleText = playlistName || `My Top ${config.top_n}`
  ctx.fillText(titleText, width / 2, 150)

  // Subtitle
  ctx.font = '42px sans-serif'
  ctx.fillStyle = mutedColor
  ctx.fillText(`Top ${config.top_n} Songs`, width / 2, 218)

  // Draw top tracks
  const startY = 320
  const trackHeight = config.format === '9:16' ? 280 : 180
  const spacing = 20

  for (let i = 0; i < Math.min(topTracks.length, config.top_n); i++) {
    const { track, ranking } = topTracks[i]
    const y = startY + i * (trackHeight + spacing)

    // Card background
    ctx.fillStyle = config.theme === 'dark' ? '#ffffff20' : '#00000020'
    ctx.fillRect(80, y, width - 160, trackHeight)

    // Rank badge
    const badges = ['🥇', '🥈', '🥉']
    const badge = badges[i] || `#${i + 1}`
    ctx.font = 'bold 64px sans-serif'
    ctx.fillStyle = textColor
    ctx.textAlign = 'left'
    ctx.fillText(badge, 120, y + 100)

    // Album art placeholder (if we load images)
    const artX = 250
    const artSize = trackHeight - 40
    ctx.fillStyle = config.theme === 'dark' ? '#ffffff10' : '#00000010'
    ctx.fillRect(artX, y + 20, artSize, artSize)

    // Try to load and draw album art
    if (track.coverImage) {
      try {
        const img = await loadImage(track.coverImage)
        ctx.drawImage(img, artX, y + 20, artSize, artSize)
      } catch {
        // Fallback to placeholder
        ctx.fillStyle = config.theme === 'dark' ? '#ffffff40' : '#00000040'
        ctx.font = 'bold 48px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('♪', artX + artSize / 2, y + 20 + artSize / 2 + 16)
      }
    }

    // Track info
    const textX = artX + artSize + 40
    const maxTextWidth = width - textX - 80

    ctx.fillStyle = textColor
    ctx.font = 'bold 42px sans-serif'
    ctx.textAlign = 'left'
    const titleText = truncateText(ctx, track.title, maxTextWidth)
    ctx.fillText(titleText, textX, y + 80)

    ctx.font = '36px sans-serif'
    ctx.fillStyle = config.theme === 'dark' ? '#ffffff99' : '#00000099'
    const artistText = truncateText(ctx, track.artist, maxTextWidth)
    ctx.fillText(artistText, textX, y + 130)

    // Score (if config.include_stats)
    if (config.include_stats) {
      ctx.font = 'bold 32px sans-serif'
      ctx.fillStyle = config.theme === 'dark' ? '#10b981' : '#059669'
      ctx.fillText(`Score: ${ranking.Score.toFixed(1)}`, textX, y + 180)
    }
  }

  // Footer/Watermark
  const footerY = config.format === '9:16' ? height - 100 : height - 80
  ctx.font = 'bold 40px sans-serif'
  ctx.fillStyle = config.theme === 'dark' ? '#ffffff60' : '#00000060'
  ctx.textAlign = 'center'
  ctx.fillText('Created with SongRank', width / 2, footerY)

  return canvas.toDataURL('image/png')
}

/**
 * Helper to load an image from a URL
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/**
 * Helper to truncate text to fit within a max width
 */
function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  const width = ctx.measureText(text).width
  if (width <= maxWidth) return text

  let truncated = text
  while (
    ctx.measureText(truncated + '...').width > maxWidth &&
    truncated.length > 0
  ) {
    truncated = truncated.slice(0, -1)
  }
  return truncated + '...'
}

/**
 * Download a data URL as a file
 */
export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Share using Web Share API (if available)
 */
export async function shareDataUrl(
  dataUrl: string,
  title: string,
  text: string,
): Promise<boolean> {
  if (!navigator.share || !navigator.canShare) {
    return false
  }

  try {
    // Convert data URL to Blob
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const file = new File([blob], 'songrank-top-songs.png', {
      type: 'image/png',
    })

    const shareData = {
      title,
      text,
      files: [file],
    }

    if (navigator.canShare(shareData)) {
      await navigator.share(shareData)
      return true
    }
    return false
  } catch (error) {
    console.error('Share failed:', error)
    return false
  }
}
