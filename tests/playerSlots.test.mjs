import test from 'node:test'
import assert from 'node:assert/strict'

import {
  commandsForSlot,
  groupOfSlot,
  SLOT_COUNT,
  intentForSlot,
  intentsForPool,
  labelForPlayerState,
  nextGroup,
  previousGroup,
  previewStartSeconds,
  readCurrentTime,
  readDuration,
  shouldHoldStart,
  slotsOfGroup,
  volumeForIntent,
} from '../src/lib/playerSlots.ts'

const playing = (videoId) => ({ videoId, intent: 'playing' })
const cued = (videoId) => ({ videoId, intent: 'cued' })
const suspended = (videoId) => ({ videoId, intent: 'suspended' })

const kinds = (commands) => commands.map((command) => command.kind)

/** The seek target of a command list, or null when it does not seek. */
const seekTo = (commands) => {
  const seek = commands.find((command) => command.kind === 'seek')
  return seek ? seek.to : null
}

// A 4:23 video, as videos.list reports it.
const VIDEO_SECONDS = 263

test('six slots make three pairs of two', () => {
  assert.equal(SLOT_COUNT, 6)
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(groupOfSlot), [0, 0, 1, 1, 2, 2])
  assert.deepEqual(slotsOfGroup(0), [0, 1])
  assert.deepEqual(slotsOfGroup(1), [2, 3])
  assert.deepEqual(slotsOfGroup(2), [4, 5])
})

// The ring is what makes an undo a promotion: the group behind the active one
// still holds the pair the session came from.
test('the groups form a ring, forwards and back', () => {
  assert.equal(nextGroup(0), 1)
  assert.equal(nextGroup(1), 2)
  assert.equal(nextGroup(2), 0)
  assert.equal(previousGroup(0), 2)
  assert.equal(previousGroup(1), 0)
  assert.equal(previousGroup(2), 1)
  for (const group of [0, 1, 2]) {
    assert.equal(previousGroup(nextGroup(group)), group)
    assert.equal(nextGroup(previousGroup(group)), group)
  }
})

test('only the group on screen plays', () => {
  assert.equal(intentForSlot(0, 0, 'active'), 'playing')
  assert.equal(intentForSlot(1, 0, 'active'), 'playing')
  assert.equal(intentForSlot(2, 0, 'active'), 'cued')
  assert.equal(intentForSlot(3, 0, 'active'), 'cued')
  assert.equal(intentForSlot(4, 0, 'active'), 'cued')
  assert.equal(intentForSlot(5, 0, 'active'), 'cued')
  assert.equal(intentForSlot(2, 1, 'active'), 'playing')
  assert.equal(intentForSlot(4, 2, 'active'), 'playing')
  assert.equal(intentForSlot(5, 2, 'active'), 'playing')
  assert.equal(intentForSlot(0, 1, 'active'), 'cued')
  assert.equal(intentForSlot(0, 2, 'active'), 'cued')
})

// The regression this whole module exists for: an off-screen slot must never be
// left playing, whatever its video is doing.
test('an off-screen slot is never playing', () => {
  const intents = intentsForPool(1, 'active')
  assert.deepEqual(intents, [
    'cued',
    'cued',
    'playing',
    'playing',
    'cued',
    'cued',
  ])
  assert.equal(intents.filter((intent) => intent === 'playing').length, 2)
})

test('a suspended pool plays nothing at all', () => {
  assert.deepEqual(intentsForPool(0, 'suspended'), [
    'suspended',
    'suspended',
    'suspended',
    'suspended',
    'suspended',
    'suspended',
  ])
})

test('only a playing slot is audible', () => {
  assert.equal(volumeForIntent('playing'), 50)
  assert.equal(volumeForIntent('playing', 80), 80)
  assert.equal(volumeForIntent('cued'), 0)
  assert.equal(volumeForIntent('suspended'), 0)
})

test('the preview offset scales with the track', () => {
  assert.equal(previewStartSeconds(VIDEO_SECONDS), 52.6)
  assert.equal(previewStartSeconds(200), 40)
  assert.equal(previewStartSeconds(3723), 744.6)
})

test('an unknown or nonsense length starts at the beginning', () => {
  assert.equal(previewStartSeconds(0), 0)
  assert.equal(previewStartSeconds(-5), 0)
  assert.equal(previewStartSeconds(Number.NaN), 0)
  assert.equal(previewStartSeconds(Number.POSITIVE_INFINITY), 0)
})

test('a freshly cued video starts at the preview offset, not the intro', () => {
  const commands = commandsForSlot(cued('a'), playing('a'), VIDEO_SECONDS)
  assert.deepEqual(kinds(commands), ['seek', 'play', 'volume'])
  assert.equal(seekTo(commands), 52.6)
})

test('a brand-new video also starts at the preview offset', () => {
  for (const applied of [null, playing('a')]) {
    const commands = commandsForSlot(applied, playing('b'), VIDEO_SECONDS)
    assert.deepEqual(kinds(commands), ['seek', 'play', 'volume'])
    assert.equal(seekTo(commands), 52.6)
  }
})

test('a slot with no known length still plays, from 0:00', () => {
  assert.deepEqual(kinds(commandsForSlot(cued('a'), playing('a'), 0)), [
    'seek',
    'play',
    'volume',
  ])
  assert.equal(seekTo(commandsForSlot(cued('a'), playing('a'), 0)), 0)
})

test('demoting a slot pauses it and silences it', () => {
  assert.deepEqual(kinds(commandsForSlot(playing('a'), cued('a'), VIDEO_SECONDS)), [
    'pause',
    'volume',
  ])
  assert.deepEqual(
    kinds(commandsForSlot(playing('a'), suspended('a'), VIDEO_SECONDS)),
    ['pause', 'volume'],
  )
})

// The audible bug: a track can land in the same slot on consecutive pairs, so
// it must start at the preview offset rather than resume wherever it stopped.
test('a slot returning to the screen starts over at the preview offset', () => {
  const commands = commandsForSlot(cued('a'), playing('a'), VIDEO_SECONDS)
  assert.deepEqual(kinds(commands), ['seek', 'play', 'volume'])
})

// Resuming from the pause menu continues; nothing else does.
test('resuming from suspension carries on where it stopped', () => {
  assert.deepEqual(
    kinds(commandsForSlot(suspended('a'), playing('a'), VIDEO_SECONDS)),
    ['play', 'volume'],
  )
})

// If a seek leaked into the steady state it would jump the audible track back to
// the preview offset on every reconcile pass, several times a second.
test('a steady playing slot is only ever re-volumed', () => {
  assert.deepEqual(kinds(commandsForSlot(playing('a'), playing('a'), VIDEO_SECONDS)), [
    'volume',
  ])
  assert.deepEqual(kinds(commandsForSlot(cued('a'), cued('a'), VIDEO_SECONDS)), [
    'volume',
  ])
  assert.deepEqual(
    kinds(commandsForSlot(suspended('a'), suspended('a'), VIDEO_SECONDS)),
    ['volume'],
  )
})

test('the mix level reaches the command', () => {
  const volume = commandsForSlot(playing('a'), playing('a'), VIDEO_SECONDS, 80).find(
    (command) => command.kind === 'volume',
  )
  assert.equal(volume?.value, 80)
  const silent = commandsForSlot(playing('a'), cued('a'), VIDEO_SECONDS, 80).find(
    (command) => command.kind === 'volume',
  )
  assert.equal(silent?.value, 0)
})

test('a comparison starts only once both sides can be positioned', () => {
  const ready = { ready: true, unavailable: false }
  const loading = { ready: false, unavailable: false }
  const broken = { ready: false, unavailable: true }

  assert.equal(shouldHoldStart([ready, ready]), false)
  assert.equal(shouldHoldStart([ready, loading]), true)
  assert.equal(shouldHoldStart([loading, loading]), true)
  // A side that can never load must not hold the other one back.
  assert.equal(shouldHoldStart([ready, broken]), false)
  assert.equal(shouldHoldStart([broken, broken]), false)
})

test('a length is only reported once the player has one', () => {
  assert.equal(readDuration(null), 0)
  assert.equal(readDuration({ getDuration: () => VIDEO_SECONDS }), VIDEO_SECONDS)
  assert.equal(readDuration({ getDuration: () => 0 }), 0)
  assert.equal(readDuration({ getDuration: () => -1 }), 0)
  assert.equal(readDuration({ getDuration: () => Number.NaN }), 0)
  assert.equal(
    readDuration({
      getDuration: () => {
        throw new Error('not loaded')
      },
    }),
    0,
  )
})

test('player states are labelled, including the unknown ones', () => {
  assert.equal(labelForPlayerState(1), 'playing')
  assert.equal(labelForPlayerState(-1), 'unstarted')
  assert.equal(labelForPlayerState(5), 'cued')
  assert.equal(labelForPlayerState(9), 'state 9')
  assert.equal(labelForPlayerState(null), '—')
})

test('a player that cannot answer reports 0:00 instead of throwing', () => {
  assert.equal(readCurrentTime({ getCurrentTime: () => 12.5 }), 12.5)
  assert.equal(
    readCurrentTime({
      getCurrentTime: () => {
        throw new Error('no video')
      },
    }),
    0,
  )
  assert.equal(readCurrentTime({ getCurrentTime: () => Number.NaN }), 0)
})
