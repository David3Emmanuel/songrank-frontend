/**
 * The player pool's lifecycle rules, as pure functions.
 *
 * Four iframes sit in two groups of two. What each one should be doing follows
 * from exactly two facts — which group is on screen, and whether playback is
 * suspended — and the players are then driven imperatively from that, never
 * from React props. Keeping the rules here means they can be tested without a
 * browser, which matters because the bugs they exist to prevent are audible
 * rather than visible.
 */

export const SLOT_COUNT = 4

/** Both sides of a comparison sit at the same level; this is just the mix level. */
export const DEFAULT_MIX_LEVEL = 50

/**
 * How far into a track a slot must be before returning it to `playing` means
 * "resume" rather than "start". A slot that was previously heard is paused
 * somewhere in the middle, and promoting it must start it over — a ranking
 * comparison is about the same excerpt of both songs.
 */
export const REWIND_THRESHOLD_SECONDS = 0.5

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
export function groupOfSlot(slotIndex: number): 0 | 1 {
  return slotIndex <= 1 ? 0 : 1
}

export function slotsOfGroup(group: 0 | 1): [number, number] {
  return group === 0 ? [0, 1] : [2, 3]
}

/** The group that is not on screen — the one holding the preloaded pair. */
export function otherGroup(group: 0 | 1): 0 | 1 {
  return group === 0 ? 1 : 0
}

export function intentForSlot(
  slotIndex: number,
  activeGroup: 0 | 1,
  phase: PlaybackPhase,
): SlotIntent {
  if (phase === 'suspended') return 'suspended'
  return groupOfSlot(slotIndex) === activeGroup ? 'playing' : 'cued'
}

export function intentsForPool(
  activeGroup: 0 | 1,
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
  | { kind: 'rewind' }
  | { kind: 'volume'; value: number }

/**
 * The commands that take one slot from what was applied to it to what it should
 * be doing, given where its playhead currently sits.
 *
 * Two rules here are load-bearing, and both are bug fixes rather than taste:
 *
 * - `play` is issued whenever the slot's video or intent *changes*, not when the
 *   intent merely *is* `playing`. react-youtube only reacts to a changed
 *   `videoId`, so a track that lands in the same slot twice in a row (a track
 *   can be paired with A and then with B) never got reloaded — the player kept
 *   running from wherever it was while React marked the slot idle.
 * - `rewind` is gated on the previous intent having been `cued`. Resuming from
 *   the pause menu should carry on where it stopped; only a slot coming back
 *   from the off-screen pool starts over. Gating it on `playing` instead would
 *   seek a track to 0 on every single reconcile pass, which would be audible.
 */
export function commandsForSlot(
  applied: AppliedSlot | null,
  next: AppliedSlot,
  currentTime: number,
  mixLevel: number = DEFAULT_MIX_LEVEL,
): SlotCommand[] {
  const sameVideo = applied !== null && applied.videoId === next.videoId
  const changed = applied === null || !sameVideo || applied.intent !== next.intent
  const commands: SlotCommand[] = []

  if (next.intent === 'playing') {
    if (
      changed &&
      sameVideo &&
      applied.intent === 'cued' &&
      currentTime > REWIND_THRESHOLD_SECONDS
    ) {
      commands.push({ kind: 'rewind' })
    }
    if (changed) commands.push({ kind: 'play' })
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
export const YT_STATE_LABELS: Record<number, string> = {
  [-1]: 'unstarted',
  0: 'ended',
  1: 'playing',
  2: 'paused',
  3: 'buffering',
  5: 'cued',
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
      case 'rewind':
        player.seekTo(0, true)
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
