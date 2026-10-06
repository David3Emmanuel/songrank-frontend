import test from 'node:test'
import assert from 'node:assert/strict'

import {
  commandsForSlot,
  groupOfSlot,
  intentForSlot,
  intentsForPool,
  labelForPlayerState,
  otherGroup,
  readCurrentTime,
  slotsOfGroup,
  volumeForIntent,
} from '../src/lib/playerSlots.ts'

const playing = (videoId) => ({ videoId, intent: 'playing' })
const cued = (videoId) => ({ videoId, intent: 'cued' })
const suspended = (videoId) => ({ videoId, intent: 'suspended' })

const kinds = (commands) => commands.map((command) => command.kind)

test('slots 0,1 are group 0 and slots 2,3 are group 1', () => {
  assert.deepEqual([0, 1, 2, 3].map(groupOfSlot), [0, 0, 1, 1])
  assert.deepEqual(slotsOfGroup(0), [0, 1])
  assert.deepEqual(slotsOfGroup(1), [2, 3])
  assert.equal(otherGroup(0), 1)
  assert.equal(otherGroup(1), 0)
})

test('only the group on screen plays', () => {
  assert.equal(intentForSlot(0, 0, 'active'), 'playing')
  assert.equal(intentForSlot(1, 0, 'active'), 'playing')
  assert.equal(intentForSlot(2, 0, 'active'), 'cued')
  assert.equal(intentForSlot(3, 0, 'active'), 'cued')
  assert.equal(intentForSlot(2, 1, 'active'), 'playing')
  assert.equal(intentForSlot(0, 1, 'active'), 'cued')
})

// The regression this whole module exists for: an off-screen slot must never be
// left playing, whatever its video is doing.
test('an off-screen slot is never playing', () => {
  const intents = intentsForPool(1, 'active')
  assert.deepEqual(intents, ['cued', 'cued', 'playing', 'playing'])
  assert.equal(intents.filter((intent) => intent === 'playing').length, 2)
})

test('a suspended pool plays nothing at all', () => {
  assert.deepEqual(intentsForPool(0, 'suspended'), [
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

test('a freshly cued video is played from the top, with no seek', () => {
  // react-youtube cued the new video: it is at 0:00, so a rewind would be waste.
  assert.deepEqual(kinds(commandsForSlot(cued('a'), playing('a'), 0)), [
    'play',
    'volume',
  ])
})

test('a brand-new video is played', () => {
  assert.deepEqual(kinds(commandsForSlot(null, playing('a'), 0)), ['play', 'volume'])
  assert.deepEqual(kinds(commandsForSlot(playing('a'), playing('b'), 0)), [
    'play',
    'volume',
  ])
})

test('demoting a slot pauses it and silences it', () => {
  assert.deepEqual(kinds(commandsForSlot(playing('a'), cued('a'), 42)), [
    'pause',
    'volume',
  ])
  assert.deepEqual(kinds(commandsForSlot(playing('a'), suspended('a'), 42)), [
    'pause',
    'volume',
  ])
})

// The audible bug: a track can land in the same slot on consecutive pairs, so
// it must start over rather than resume at 0:42.
test('a slot returning to the screen starts over', () => {
  assert.deepEqual(kinds(commandsForSlot(cued('a'), playing('a'), 42)), [
    'rewind',
    'play',
    'volume',
  ])
})

test('a slot barely into its track does not bother seeking', () => {
  assert.deepEqual(kinds(commandsForSlot(cued('a'), playing('a'), 0.2)), [
    'play',
    'volume',
  ])
})

// Resuming from the pause menu continues; only the off-screen pool restarts.
test('resuming from suspension carries on where it stopped', () => {
  assert.deepEqual(kinds(commandsForSlot(suspended('a'), playing('a'), 42)), [
    'play',
    'volume',
  ])
})

// If a rewind leaked into the steady state it would seek the audible track to 0
// on every reconcile pass, several times a second.
test('a steady playing slot is only ever re-volumed', () => {
  assert.deepEqual(kinds(commandsForSlot(playing('a'), playing('a'), 42)), [
    'volume',
  ])
  assert.deepEqual(kinds(commandsForSlot(cued('a'), cued('a'), 0)), ['volume'])
  assert.deepEqual(kinds(commandsForSlot(suspended('a'), suspended('a'), 42)), [
    'volume',
  ])
})

test('the mix level reaches the command', () => {
  const volume = commandsForSlot(playing('a'), playing('a'), 0, 80).find(
    (command) => command.kind === 'volume',
  )
  assert.equal(volume?.value, 80)
  const silent = commandsForSlot(playing('a'), cued('a'), 0, 80).find(
    (command) => command.kind === 'volume',
  )
  assert.equal(silent?.value, 0)
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
