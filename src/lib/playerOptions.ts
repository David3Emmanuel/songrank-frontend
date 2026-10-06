/**
 * How the pool's players are configured, shared by the arena and the prewarm.
 *
 * There is one audio owner at a time: the builder's prewarm players are unmounted
 * before the arena's pool mounts, so these options are never in play twice.
 */

/**
 * Autoplay stays off, deliberately.
 *
 * react-youtube calls `loadVideoById` (plays immediately) when `autoplay` is set
 * and `cueVideoById` (buffers, stays silent) when it is not — see
 * node_modules/react-youtube/dist/YouTube.esm.js. With it on, every preloaded
 * player started playing, so the off-screen pair was audible-in-waiting and only
 * the volume kept it quiet.
 */
export const PLAYER_OPTS = {
  height: '1',
  width: '1',
  playerVars: { autoplay: 0, playsinline: 1, controls: 0, disablekb: 1 },
}

/** Off the page entirely: these players are for their audio, not their picture. */
export const OFFSCREEN = {
  position: 'absolute',
  top: -9999,
  left: -9999,
  visibility: 'hidden',
  pointerEvents: 'none',
} as const

/**
 * How many players the builder warms before a session starts.
 *
 * Two, because that is the first comparison. The larger win is the player script
 * and the embed page, which the browser then has cached for every player the
 * arena creates.
 */
export const PREWARM_COUNT = 2
