'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Music } from 'lucide-react'

interface TrackArtworkProps {
  src?: string
  alt: string
  /** Fill the (positioned) parent, as the comparison cards do. */
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  className?: string
  fallbackClassName?: string
}

/**
 * A cover that always renders something.
 *
 * Cover URLs are third-party and can rot or simply fail to load — half the demo
 * playlist's were dead 404s. Without this the browser paints a broken-image icon
 * and the alt text across the card, which reads as a rendering bug rather than a
 * missing image.
 */
export default function TrackArtwork({
  src,
  alt,
  fill = false,
  width,
  height,
  sizes,
  className,
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

  const onError = () => setFailedSrc(src)

  return fill ? (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      onError={onError}
    />
  ) : (
    <Image
      src={src}
      alt={alt}
      width={width ?? 40}
      height={height ?? 40}
      className={className}
      onError={onError}
    />
  )
}
