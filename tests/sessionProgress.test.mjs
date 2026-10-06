import test from 'node:test'
import assert from 'node:assert/strict'

import {
  sessionProgress,
  SUGGEST_STOP_PER_SONG,
  SETTLED_TOP_PER_SONG,
} from '../src/lib/sessionProgress.ts'

test('a fresh session suggests nothing', () => {
  const progress = sessionProgress(10, 0)
  assert.equal(progress.perSong, 0)
  assert.equal(progress.suggestStop, false)
  assert.equal(progress.topMayShift, true)
})

// The threshold comes from the measured run: a 10-song session stopped at 15
// comparisons, and the order still moved at 19.
test('the measured stopping point is where the suggestion starts', () => {
  const at = sessionProgress(10, 15)
  assert.equal(at.perSong, SUGGEST_STOP_PER_SONG)
  assert.equal(at.suggestStop, true)
  assert.equal(at.topMayShift, true)

  const before = sessionProgress(10, 14)
  assert.equal(before.suggestStop, false)
})

test('a 10-song session is unsettled at the top until 20 comparisons', () => {
  assert.equal(sessionProgress(10, 19).topMayShift, true)
  const settled = sessionProgress(10, 20)
  assert.equal(settled.perSong, SETTLED_TOP_PER_SONG)
  assert.equal(settled.topMayShift, false)
  assert.equal(settled.suggestStop, true)
})

test('the thresholds scale with the playlist', () => {
  assert.equal(sessionProgress(5, 7).suggestStop, false)
  assert.equal(sessionProgress(5, 8).suggestStop, true)
  assert.equal(sessionProgress(20, 30).suggestStop, true)
  assert.equal(sessionProgress(20, 39).topMayShift, true)
  assert.equal(sessionProgress(20, 40).topMayShift, false)
})

test('a session that cannot compare anything suggests nothing', () => {
  assert.equal(sessionProgress(0, 12).suggestStop, false)
  assert.equal(sessionProgress(0, 12).perSong, 0)
  assert.equal(sessionProgress(1, 99).suggestStop, false)
  assert.equal(sessionProgress(1, 99).topMayShift, true)
})

test('the comparison count is carried through untouched', () => {
  assert.equal(sessionProgress(10, 22).comparisons, 22)
})
