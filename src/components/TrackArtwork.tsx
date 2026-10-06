'use client'

/* eslint-disable @next/next/no-img-element -- Image optimisation is switched off
   app-wide (see next.config.ts), so next/image would only add a wrapper and
   attribute juggling. A plain img, sized by its parent, is what we want. */

import { useState } from 'react'
import { Music } from 'lucide-react'

interface TrackArtworkProps {
  src?: string
  alt: string
  /** Pin to the (positioned) parent, as the comparison cards do. */
  fill?: boolean
  className?: string
  fallbackClassName?: string
}

/**
 * A cover that always renders something, always filling its frame.
 *
 * Two things it has to get right:
 *
 * - Sizing comes from the parent (`h-full w-full`), never from the image's own
 *   dimensions. Covers here are YouTube thumbnails: 16:9 frames with the album
 *   art letterboxed inside them, so anything short of a forced crop shows the
 *   bars that are baked into the source.
 * - Third-party cover URLs rot. Half the demo playlist's were dead 404s, and
 *   without the fallback the browser paints a broken-image icon with the alt
 *   text across the card.
 */
export default function TrackArtwork({
  src,
  alt,
  fill = false,
  className = 'object-cover',
  fallbackClassName = 'flex h-full w-full items-center justify-center',
}: TrackArtworkProps) {
  // Keyed on the src rather than a bare boolean. The card slots are reused for
  // different tracks, so a plain `failed` flag stayed set when the src changed
  // and poisoned that slot for the rest of the session — a track whose cover
  // loads fine would keep showing the placeholder.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  if (!src || failedSrc === src) {
    return (
      <div className={fallbackClassName}>
        <Music className='h-1/2 w-1/2 max-h-16 max-w-16 min-h-4 min-w-4 text-slate-300' />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading='lazy'
      decoding='async'
      onError={() => setFailedSrc(src)}
      className={[fill ? 'absolute inset-0' : '', 'h-full w-full', className]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
