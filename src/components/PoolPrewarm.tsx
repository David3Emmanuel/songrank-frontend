'use client'

import YouTube from '../lib/youtube'
import type { YouTubeEvent } from 'react-youtube'
import { OFFSCREEN, PLAYER_OPTS, PREWARM_COUNT } from '../lib/playerOptions'
import type { Track } from '../lib/types'

/**
 * Loads the first comparison's players while the list is still being built.
 *
 * The arena's first pair cannot start until the embed page, the player script and
 * the media metadata have all arrived, and none of that used to begin until the
 * session did. Cueing them here moves that off the critical path, so pressing
 * Start lands on players that are already warm.
 *
 * These are cued, never played: autoplay is off, the players are muted as a
 * second guard against a stray sound in the builder, and the whole component
 * unmounts the moment the arena takes over, so there is only ever one audio
 * owner. Nothing here feeds the pool's state; it exists for what the browser
 * caches.
 */
export default function PoolPrewarm({ tracks }: { tracks: Track[] }) {
  const ids = tracks
    .slice(0, PREWARM_COUNT)
    .map((track) => track.id)
    .filter(Boolean)

  if (ids.length === 0) return null

  return (
    <>
      {ids.map((id, index) => (
        <div key={`${id}-${index}`} aria-hidden style={OFFSCREEN}>
          <YouTube
            videoId={id}
            opts={{
              ...PLAYER_OPTS,
              playerVars: { ...PLAYER_OPTS.playerVars, mute: 1 },
            }}
            onReady={(event: YouTubeEvent) => {
              // Belt and braces: an error here is harmless, and nothing should
              // reach for the network a second time.
              const player = event.target as unknown as {
                mute?: () => void
                pauseVideo?: () => void
              }
              player.mute?.()
              player.pauseVideo?.()
            }}
          />
        </div>
      ))}
    </>
  )
}
