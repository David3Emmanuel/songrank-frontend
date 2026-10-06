'use client'

/* eslint-disable @next/next/no-img-element -- Image optimisation is switched off
   app-wide (see next.config.ts), so next/image would only add a wrapper and
   attribute juggling. A plain img, sized by its parent, is what we want. */

import { useEffect, useState } from 'react'
import { Music } from 'lucide-react'
import { largerThumbnailUrl } from '../lib/videoMetadata'

interface TrackArtworkProps {
  src?: string
  alt: string
  /** Pin to the (positioned) parent, as the comparison cards do. */
  fill?: boolean
  className?: string
  fallbackClassName?: string
  /**
   * Also fetch a larger version and swap it in once it has loaded.
   *
   * Worth it where the cover is drawn big, which is the comparison cards and the
   * podium. Not worth it in a list of 40px rows: the small image is already the
   * right size, and a second request per row would only slow the list down.
   */
  higherQuality?: boolean
}

/**
 * A cover that always renders something, always filling its frame.
 *
 * Three things it has to get right:
 *
 * - Sizing comes from the parent (`h-full w-full`), never from the image's own
 *   dimensions. Covers here are YouTube thumbnails: 16:9 frames with the album
 *   art letterboxed inside them, so anything short of a forced crop shows the
 *   bars that are baked into the source.
 * - Third-party cover URLs rot. Half the demo playlist's were dead 404s, and
 *   without the fallback the browser paints a broken-image icon with the alt
 *   text across the card.
 * - A larger version, when asked for, must never make things worse: the small
 *   image shows first, and a failed or slow bigger one simply never replaces it.
 */
export default function TrackArtwork({
  src,
  alt,
  fill = false,
  className = 'object-cover',
  fallbackClassName = 'flex h-full w-full items-center justify-center',
  higherQuality = false,
}: TrackArtworkProps) {
  // Keyed on the src rather than a bare boolean. The card slots are reused for
  // different tracks, so a plain `failed` flag stayed set when the src changed
  // and poisoned that slot for the rest of the session — a track whose cover
  // loads fine would keep showing the placeholder.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [upgraded, setUpgraded] = useState<{ from: string; src: string } | null>(
    null,
  )

  useEffect(() => {
    if (!higherQuality || !src) return

    const bigger = largerThumbnailUrl(src)
    if (!bigger || bigger === src) return

    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (!cancelled) setUpgraded({ from: src, src: bigger })
    }
    image.src = bigger

    return () => {
      cancelled = true
    }
  }, [src, higherQuality])

  if (!src || failedSrc === src) {
    return (
      <div className={fallbackClassName}>
        <Music className='h-1/2 w-1/2 max-h-16 max-w-16 min-h-4 min-w-4 text-slate-300' />
      </div>
    )
  }

  const shown = upgraded?.from === src ? upgraded.src : src

  return (
    <img
      src={shown}
      alt={alt}
      loading='lazy'
      decoding='async'
      onError={() => {
        // A failed upgrade is not a failed cover: keep showing the small one.
        if (shown !== src) setUpgraded(null)
        else setFailedSrc(src)
      }}
      className={[fill ? 'absolute inset-0' : '', 'h-full w-full', className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
