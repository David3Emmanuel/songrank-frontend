import test from 'node:test'
import assert from 'node:assert/strict'

import { draftEstimate, LONG_LIST_SONGS } from '../src/lib/sessionProgress.ts'
import { formatDurationMs, smallerThumbnailUrl } from '../src/lib/videoMetadata.ts'

test('a draft list is priced in picks using the measured rate', () => {
  // 10 songs was where the ending test naturally stopped, at 15 picks.
  assert.equal(draftEstimate(10).picks, 15)
  assert.equal(draftEstimate(20).picks, 30)
})

test('the time is a range, never a single confident number', () => {
  const estimate = draftEstimate(10)
  assert.ok(estimate.minutesLow >= 1)
  assert.ok(estimate.minutesHigh > estimate.minutesLow)
})

test('a tiny list still takes a minute rather than zero', () => {
  assert.ok(draftEstimate(2).minutesLow >= 1)
})

test('only a genuinely long list is flagged', () => {
  assert.equal(draftEstimate(LONG_LIST_SONGS).isLong, false)
  assert.equal(draftEstimate(LONG_LIST_SONGS + 1).isLong, true)
})

test('a duration reads as m:ss and h:mm:ss', () => {
  assert.equal(formatDurationMs(200040), '3:20')
  assert.equal(formatDurationMs(178147), '2:58')
  assert.equal(formatDurationMs(238805), '3:59')
  assert.equal(formatDurationMs(3723000), '1:02:03')
})

test('an unknown duration is blank, not zero', () => {
  assert.equal(formatDurationMs(0), '')
  assert.equal(formatDurationMs(undefined), '')
  assert.equal(formatDurationMs(null), '')
  assert.equal(formatDurationMs(-5), '')
  assert.equal(formatDurationMs(Number.NaN), '')
})

test('seconds are padded, so lengths line up', () => {
  assert.equal(formatDurationMs(65000), '1:05')
  assert.equal(formatDurationMs(1000), '0:01')
})

test('a thumbnail is swapped for a smaller one and loses its query', () => {
  const signed =
    'https://i.ytimg.com/vi/zZfs3o5_sc8/hqdefault.jpg?sqp=-oaymwEWCJADEOEBIAQqCggAEOADGC0guwJIWg&rs=AMzJL3kMF3nMmD60hpTajYEDboWwSYNjJQ'
  assert.equal(
    smallerThumbnailUrl(signed),
    'https://i.ytimg.com/vi/zZfs3o5_sc8/mqdefault.jpg',
  )
  assert.equal(
    smallerThumbnailUrl('https://i.ytimg.com/vi/zZfs3o5_sc8/hqdefault.jpg', 'default'),
    'https://i.ytimg.com/vi/zZfs3o5_sc8/default.jpg',
  )
})

test('a thumbnail that is already small is left alone, and so is anything else', () => {
  assert.equal(
    smallerThumbnailUrl('https://i.ytimg.com/vi/abc/mqdefault.jpg'),
    'https://i.ytimg.com/vi/abc/mqdefault.jpg',
  )
  // Covers from elsewhere are not YouTube thumbnails and must not be rewritten.
  assert.equal(
    smallerThumbnailUrl('https://i.scdn.co/image/ab67616d0000b2738863bc11'),
    'https://i.scdn.co/image/ab67616d0000b2738863bc11',
  )
  assert.equal(smallerThumbnailUrl(null), undefined)
  assert.equal(smallerThumbnailUrl(''), undefined)
})
