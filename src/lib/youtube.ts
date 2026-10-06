import type { ComponentType } from 'react'
import * as ReactYouTube from 'react-youtube'
import type { YouTubeProps } from 'react-youtube'

/**
 * Picks the player component out of react-youtube's CommonJS interop.
 *
 * The default export arrives either as the component itself or wrapped in a
 * further default, depending on how the module is bundled. The original code
 * cast the namespace to `any` to reach into it; this walks the same shapes with
 * types instead, and falls back to the namespace itself as before.
 */
type PlayerComponent = ComponentType<YouTubeProps>

const namespace = ReactYouTube as unknown as {
  default?: PlayerComponent | { default?: PlayerComponent }
}

const candidate = namespace.default

const YouTube: PlayerComponent =
  typeof candidate === 'function'
    ? candidate
    : (candidate?.default ?? (ReactYouTube as unknown as PlayerComponent))

export default YouTube
export type { YouTubeProps, YouTubePlayer } from 'react-youtube'
