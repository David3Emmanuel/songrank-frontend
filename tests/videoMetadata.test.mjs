import test from 'node:test'
import assert from 'node:assert/strict'

import {
  artistFromChannelTitle,
  chunkIds,
  parseIsoDurationMs,
} from '../src/lib/videoMetadata.ts'

test('parses the durations the Data API actually returns', () => {
  // Values taken from videos.list for the demo playlist's videos.
  assert.equal(parseIsoDurationMs('PT4M23S'), 263000) // Blinding Lights video
  assert.equal(parseIsoDurationMs('PT4M9S'), 249000)
  assert.equal(parseIsoDurationMs('PT3M51S'), 231000)
  assert.equal(parseIsoDurationMs('PT3M19S'), 199000)
  assert.equal(parseIsoDurationMs('PT3M56S'), 236000)
})

test('parses the other ISO-8601 shapes', () => {
  assert.equal(parseIsoDurationMs('PT45S'), 45000)
  assert.equal(parseIsoDurationMs('PT1H2M3S'), 3723000)
  assert.equal(parseIsoDurationMs('P1DT1S'), 86401000)
  assert.equal(parseIsoDurationMs('PT1.5S'), 1500)
  assert.equal(parseIsoDurationMs('  PT3M20S  '), 200000)
})

// A wrong length becomes a wrong timeline, so unknown must stay unknown.
test('anything unparseable is 0, never a guess', () => {
  assert.equal(parseIsoDurationMs(''), 0)
  assert.equal(parseIsoDurationMs(null), 0)
  assert.equal(parseIsoDurationMs(undefined), 0)
  assert.equal(parseIsoDurationMs('3:20'), 0)
  assert.equal(parseIsoDurationMs('P'), 0)
  assert.equal(parseIsoDurationMs('LIVE'), 0)
})

test('strips the decorations the channel title arrives with', () => {
  assert.equal(artistFromChannelTitle('Dua Lipa'), 'Dua Lipa')
  assert.equal(artistFromChannelTitle('Dua Lipa - Topic'), 'Dua Lipa')
  assert.equal(artistFromChannelTitle('TheWeekndVEVO'), 'TheWeeknd')
  assert.equal(artistFromChannelTitle('TheWeeknd - Topic'), 'TheWeeknd')
  assert.equal(artistFromChannelTitle('  Glass Animals - Topic  '), 'Glass Animals')
})

test('falls back rather than producing an empty artist', () => {
  assert.equal(artistFromChannelTitle(''), 'Unknown Artist')
  assert.equal(artistFromChannelTitle(undefined), 'Unknown Artist')
  assert.equal(artistFromChannelTitle('- Topic'), 'Unknown Artist')
  assert.equal(artistFromChannelTitle('VEVO'), 'Unknown Artist')
})

test('batches ids into the size the API accepts', () => {
  assert.deepEqual(chunkIds([], 50), [])
  assert.deepEqual(chunkIds(['a'], 50), [['a']])
  assert.equal(chunkIds(Array.from({ length: 50 }, (_, i) => i), 50).length, 1)
  assert.equal(chunkIds(Array.from({ length: 51 }, (_, i) => i), 50).length, 2)
  const last = chunkIds(Array.from({ length: 120 }, (_, i) => i), 50)
  assert.equal(last.length, 3)
  assert.equal(last[2].length, 20)
  assert.throws(() => chunkIds([1], 0))
})
