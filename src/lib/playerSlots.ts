/**
 * The player pool's lifecycle rules, as pure functions.
 *
 * Six iframes sit in three groups of two: the pair on screen, the pair waiting
 * ahead of it, and the pair just left behind. What each one should be doing
 * follows from exactly two facts — which group is on screen, and whether playback
 * is suspended — and the players are then driven imperatively from that, never
 * from React props. Keeping the rules here means they can be tested without a
 * browser, which matters because the bugs they exist to prevent are audible
 * rather than visible.
 */

/** Two players per group, because a comparison is two tracks. */
export const PLAYERS_PER_GROUP = 2

/** On screen, waiting ahead, and just left behind. */
export const GROUP_COUNT = 3

export const SLOT_COUNT = PLAYERS_PER_GROUP * GROUP_COUNT

/** Which pair of players a slot belongs to. */
export type Group = 0 | 1 | 2

/** Both sides of a comparison sit at the same level; this is just the mix level. */
export const DEFAULT_MIX_LEVEL = 50

/**
 * How far into a track a comparison begins.
 *
 * Music videos open with intros — sometimes a cold open, sometimes talking — and
 * a ranking comparison is about the song. Starting a fifth of the way in skips
 * most of that while still scaling with the track: a 3-minute song starts at
 * ~0:36, a 6-minute one at ~1:12.
 */
export const PREVIEW_START_FRACTION = 0.2

/** How long a starting pair may be held waiting for the other side. */
export const START_HOLD_TIMEOUT_MS = 1200

/**
 * The offset a track should play from.
 *
 * Length comes from the *player*, not from `Track.durationMs`: for a YouTube
 * music video the two differ (the song is 3:20, the video is 4:23), and the
 * player is the thing being positioned. An unknown length means 0 rather than a
 * guess.
 */
export function previewStartSeconds(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0
  return durationSeconds * PREVIEW_START_FRACTION
}

/**
 * What a slot should be doing right now.
 *
 * `cued` is the off-screen state: loaded and buffered so a promotion is fast,
 * but explicitly not playing. The old pool expressed this as "playing at volume
 * 0", which is why demoted tracks kept running.
 */
export type SlotIntent =
  /** On screen: audible, from the top of the track. */
  | 'playing'
  /** Off screen: buffered and silent, held at 0:00. */
  | 'cued'
  /** Nothing in the pool should make sound (pause menu, hidden tab). */
  | 'suspended'

export type PlaybackPhase = 'active' | 'suspended'

/** Slots 0,1 back the pair on screen; slots 2,3 the preloaded one. */
export function groupOfSlot(slotIndex: number): Group {
  return Math.floor(slotIndex / PLAYERS_PER_GROUP) as Group
}

export function slotsOfGroup(group: Group): [number, number] {
  const first = group * PLAYERS_PER_GROUP
  return [first, first + 1]
}

/**
 * The group holding the pair that will be promoted next.
 *
 * In a two group pool this was simply "the other one". With three, the ring
 * separates the pair waiting ahead from the pair just left behind, which is what
 * makes an undo a promotion rather than a reload.
 */
export function nextGroup(group: Group): Group {
  return ((group + 1) % GROUP_COUNT) as Group
}

/** The group holding the pair the session has just come from. */
export function previousGroup(group: Group): Group {
  return ((group + GROUP_COUNT - 1) % GROUP_COUNT) as Group
}

export function intentForSlot(
  slotIndex: number,
  activeGroup: Group,
  phase: PlaybackPhase,
): SlotIntent {
  if (phase === 'suspended') return 'suspended'
  // Everything off screen is buffered and silent, the history group included:
  // it is kept warm so an undo can promote it, never so it can be heard.
  return groupOfSlot(slotIndex) === activeGroup ? 'playing' : 'cued'
}

export function intentsForPool(
  activeGroup: Group,
  phase: PlaybackPhase,
): SlotIntent[] {
  return Array.from({ length: SLOT_COUNT }, (_, index) =>
    intentForSlot(index, activeGroup, phase),
  )
}

export function volumeForIntent(
  intent: SlotIntent,
  mixLevel: number = DEFAULT_MIX_LEVEL,
): number {
  return intent === 'playing' ? mixLevel : 0
}

/** What the pool last applied to a slot, so an unchanged slot is a no-op. */
export interface AppliedSlot {
  videoId: string
  intent: SlotIntent
}

export type SlotCommand =
  | { kind: 'play' }
  | { kind: 'pause' }
  | { kind: 'seek'; to: number }
  | { kind: 'volume'; value: number }

/** What a player reports about the track it holds, for the decisions below. */
export interface SlotReadiness {
  /** Length is known, so the preview offset can be computed. */
  ready: boolean
  /** No track, or a player that errored: must not hold up the other side. */
  unavailable: boolean
}

/**
 * Whether a starting comparison must wait before either side plays.
 *
 * Both sides of a comparison should begin on the same tick, so neither gets a
 * head start. A side that can never become ready — a missing track, a player
 * that errored — must not block the other one forever, which is why
 * `unavailable` counts as settled.
 */
export function shouldHoldStart(sides: SlotReadiness[]): boolean {
  return sides.some((side) => !side.ready && !side.unavailable)
}

/**
 * The commands that take one slot from what was applied to it to what it should
 * be doing, given the length of the track it holds.
 *
 * Two rules here are load-bearing, and both are bug fixes rather than taste:
 *
 * - `play` is issued whenever the slot's video or intent *changes*, not when the
 *   intent merely *is* `playing`. react-youtube only reacts to a changed
 *   `videoId`, so a track that lands in the same slot twice in a row (a track
 *   can be paired with A and then with B) never got reloaded — the player kept
 *   running from wherever it was while React marked the slot idle.
 * - the `seek` is gated on the previous intent not being `suspended`. Resuming
 *   from the pause menu carries on where it stopped; every other route into
 *   `playing` starts at the preview offset, because a cue leaves the player at
 *   0:00. Gating it on "was playing" instead would seek the audible track on
 *   every reconcile pass, which would be plainly audible.
 */
export function commandsForSlot(
  applied: AppliedSlot | null,
  next: AppliedSlot,
  durationSeconds: number,
  mixLevel: number = DEFAULT_MIX_LEVEL,
): SlotCommand[] {
  const sameVideo = applied !== null && applied.videoId === next.videoId
  const changed = applied === null || !sameVideo || applied.intent !== next.intent
  const commands: SlotCommand[] = []

  if (next.intent === 'playing') {
    if (changed) {
      // Resuming from the pause menu carries on where it stopped; every other
      // route into `playing` starts at the preview offset, because a cue leaves
      // the player at 0:00. The two decisions are separate: `play` is needed on
      // every entry into `playing`, the seek is not.
      if (applied?.intent !== 'suspended') {
        commands.push({ kind: 'seek', to: previewStartSeconds(durationSeconds) })
      }
      commands.push({ kind: 'play' })
    }
  } else if (changed) {
    // A freshly cued video should not be playing, and an off-screen one must
    // not be. Pausing an already-paused player is a no-op.
    commands.push({ kind: 'pause' })
  }

  // Volume is cheap and idempotent, so it is enforced on every pass rather than
  // only on transitions — that is what keeps the swipe mixing from sticking.
  commands.push({ kind: 'volume', value: volumeForIntent(next.intent, mixLevel) })
  return commands
}

/**
 * The slice of the IFrame player API this pool drives.
 *
 * Declared here rather than imported from `react-youtube`: that type is
 * re-exported from `youtube-player/dist/types`, which ships no `.d.ts`, so it
 * resolves to `any` under `skipLibCheck` and would let a typo through.
 */
export interface PlayerHandle {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAway?: boolean): void
  setVolume(volume: number): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getVolume(): number
}

export interface PlayerSnapshot {
  ytState: number | null
  currentTime: number | null
  volume: number | null
}

const UNKNOWN_SNAPSHOT: PlayerSnapshot = {
  ytState: null,
  currentTime: null,
  volume: null,
}

/** Player states as YouTube names them, for the debug HUD. */
export const YT_UNKNOWN = -2
export const YT_UNSTARTED = -1
export const YT_ENDED = 0
export const YT_PLAYING = 1
export const YT_PAUSED = 2
export const YT_BUFFERING = 3
export const YT_CUED = 5

export const YT_STATE_LABELS: Record<number, string> = {
  [YT_UNSTARTED]: 'unstarted',
  [YT_ENDED]: 'ended',
  [YT_PLAYING]: 'playing',
  [YT_PAUSED]: 'paused',
  [YT_BUFFERING]: 'buffering',
  [YT_CUED]: 'cued',
}

/**
 * Whether a slot can be positioned and started.
 *
 * `5` is the state that matters: YouTube reports it once a cued video is loaded,
 * which is the earliest point at which a seek lands where it was asked to. The
 * other states mean the player has already been through that once.
 */
export function isPlayerReady(player: PlayerHandle | null, ytState: number): boolean {
  if (ytState === YT_CUED || ytState === YT_PLAYING || ytState === YT_PAUSED) return true
  return readDuration(player) > 0
}

export function labelForPlayerState(state: number | null): string {
  if (state === null) return '—'
  return YT_STATE_LABELS[state] ?? `state ${state}`
}

/** Total at every step: a player with no video answers these by throwing. */
export function readCurrentTime(player: PlayerHandle): number {
  try {
    const seconds = player.getCurrentTime()
    return Number.isFinite(seconds) ? seconds : 0
  } catch {
    return 0
  }
}

/** The track's length as the player knows it, or 0 before it is loaded. */
export function readDuration(player: PlayerHandle | null): number {
  if (!player) return 0
  try {
    const seconds = player.getDuration()
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  } catch {
    return 0
  }
}

/**
 * Runs the commands for one slot.
 *
 * Deliberately tolerant: a player can be torn down between the reconcile that
 * decided something and the call that carries it out, and that is not an error
 * worth surfacing.
 */
export function runCommand(player: PlayerHandle, command: SlotCommand): void {
  try {
    switch (command.kind) {
      case 'play':
        player.playVideo()
        break
      case 'pause':
        player.pauseVideo()
        break
      case 'seek':
        player.seekTo(command.to, true)
        break
      case 'volume':
        player.setVolume(command.value)
        break
    }
  } catch {
    // Torn down mid-flight.
  }
}

export function readPlayerSnapshot(player: PlayerHandle | null): PlayerSnapshot {
  if (!player) return UNKNOWN_SNAPSHOT
  try {
    return {
      ytState: player.getPlayerState(),
      currentTime: player.getCurrentTime(),
      volume: player.getVolume(),
    }
  } catch {
    return UNKNOWN_SNAPSHOT
  }
}
