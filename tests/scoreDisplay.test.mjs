import test from 'node:test'
import assert from 'node:assert/strict'

import {
  bandStarts,
  DEFAULT_TINT,
  MAX_BANDS,
  measuredRange,
  normalizeScore,
  scoreTint,
} from '../src/lib/scoreDisplay.ts'

const range = (min, max) => ({ min, max })

test('the scale only counts songs that were compared', () => {
  // The 0 belongs to an unpicked song, so it must not drag the range down.
  const scores = [2.8, 2.6, 1.2, 0]
  const measured = [true, true, true, false]
  assert.deepEqual(measuredRange(scores, measured), range(1.2, 2.8))
})

test('a genuine zero is a real score and does count', () => {
  const scores = [2.8, 0, -1.4]
  const measured = [true, true, true]
  assert.deepEqual(measuredRange(scores, measured), range(-1.4, 2.8))
})

test('an empty or single song range collapses to the middle', () => {
  assert.deepEqual(measuredRange([0, 0], [false, false]), range(0, 0))
  assert.deepEqual(measuredRange([2.2], [true]), range(2.2, 2.2))
  assert.equal(normalizeScore(2.2, range(2.2, 2.2)), 0)
})

test('the best and worst songs land on +1 and -1', () => {
  const session = range(1.2, 2.8)
  assert.equal(normalizeScore(2.8, session), 1)
  assert.equal(normalizeScore(1.2, session), -1)
  // The middle is exact up to floating point.
  assert.ok(Math.abs(normalizeScore(2.0, session)) < 1e-12)
})

test('close scores stay close on the scale', () => {
  const session = range(-1.4, 2.8)
  const a = normalizeScore(2.8, session)
  const b = normalizeScore(2.7, session)
  assert.ok(Math.abs(a - b) < 0.06, `expected close, got ${a} and ${b}`)
})

test('the ends of the scale are green and red, the middle amber', () => {
  assert.equal(scoreTint(1), 'rgba(16, 185, 129, 0.12)')
  assert.equal(scoreTint(-1), 'rgba(244, 63, 94, 0.12)')
  assert.equal(scoreTint(0), 'rgba(245, 158, 11, 0.12)')
  assert.equal(scoreTint(0, 0.06), 'rgba(245, 158, 11, 0.06)')
  assert.equal(DEFAULT_TINT, 0.12)
})

test('out of range values are clamped, not extrapolated', () => {
  assert.equal(scoreTint(9), scoreTint(1))
  assert.equal(scoreTint(-9), scoreTint(-1))
})

test('a break is only drawn below a song that was compared', () => {
  // One huge gap, but the song under it has never been picked.
  const scores = [3, 2.8, 0]
  const measured = [true, true, false]
  assert.deepEqual(bandStarts(scores, measured), [false, false, false])
})

test('evenly spaced songs get no bands at all', () => {
  const scores = [3, 2, 1, 0, -1]
  const measured = scores.map(() => true)
  assert.deepEqual(bandStarts(scores, measured), [false, false, false, false, false])
})

test('only the clear breaks become bands, and never more than the cap', () => {
  // Three big drops and three small ones: the small ones are the same band.
  const scores = [3, 2.9, 2.8, 1, 0.9, 0.8, -1]
  const measured = scores.map(() => true)
  const bands = bandStarts(scores, measured)
  assert.deepEqual(bands, [false, false, false, true, false, false, true])
  assert.ok(bands.filter(Boolean).length < MAX_BANDS)
})

test('a list of uneven gaps is still capped', () => {
  const scores = [10, 9, 8, 7, 6, 5, 4, 3]
  const measured = scores.map(() => true)
  const bands = bandStarts(scores, measured, 3)
  assert.ok(bands.filter(Boolean).length <= 2)
})

test('an empty list and a single song are safe', () => {
  assert.deepEqual(bandStarts([], []), [])
  assert.deepEqual(bandStarts([1], [true]), [false])
})
