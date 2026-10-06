import test from 'node:test'
import assert from 'node:assert/strict'

import {
  artistFromChannelTitle,
  artistFromVideo,
  chunkIds,
  decodeHtmlEntities,
  parseIsoDurationMs,
} from '../src/lib/videoMetadata.ts'

test('unescapes the titles YouTube hands back', () => {
  assert.equal(decodeHtmlEntities('Dua Lipa &amp; Shakira'), 'Dua Lipa & Shakira')
  assert.equal(decodeHtmlEntities('Rock &amp; Roll'), 'Rock & Roll')
  assert.equal(decodeHtmlEntities('It&#39;s Time'), "It's Time")
  assert.equal(decodeHtmlEntities('It&#x27;s Time'), "It's Time")
  assert.equal(decodeHtmlEntities('A &lt;B&gt; C'), 'A <B> C')
  assert.equal(decodeHtmlEntities('&quot;Quoted&quot;'), '"Quoted"')
  assert.equal(decodeHtmlEntities('A &nbsp; B'), 'A   B')
  assert.equal(decodeHtmlEntities('&#9731; snow'), '☃ snow')
  assert.equal(decodeHtmlEntities('&#x2603; snow'), '☃ snow')
})

test('leaves anything it does not understand alone', () => {
  assert.equal(decodeHtmlEntities('No entities here'), 'No entities here')
  assert.equal(decodeHtmlEntities('100% & rising'), '100% & rising')
  assert.equal(decodeHtmlEntities('&notarealentity;'), '&notarealentity;')
  assert.equal(decodeHtmlEntities('&#;'), '&#;')
  // Out of range for a code point: better left as written than thrown on.
  assert.equal(decodeHtmlEntities('&#1114112;'), '&#1114112;')
  assert.equal(decodeHtmlEntities(''), '')
  assert.equal(decodeHtmlEntities(null), '')
  assert.equal(decodeHtmlEntities(undefined), '')
})

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

// A VEVO channel runs the artist's name together with the suffix, so stripping it
// leaves "KendrickLamar". The video's own title spells the same name properly.
test('a run together channel name is spelled out by the title', () => {
  assert.equal(
    artistFromVideo('KendrickLamarVEVO', 'Kendrick Lamar - DNA.'),
    'Kendrick Lamar',
  )
  assert.equal(
    artistFromVideo('NonameVEVO', 'Noname - Rainforest'),
    'Noname',
  )
})

test('a channel that already reads properly is left alone', () => {
  assert.equal(
    artistFromVideo('Kendrick Lamar - Topic', 'DNA.'),
    'Kendrick Lamar',
  )
  assert.equal(artistFromVideo('', 'DNA.'), 'Unknown Artist')
})

test('a title that disagrees with the channel does not rename anybody', () => {
  // The channel says one thing and the title another: neither is trusted to
  // rewrite the other.
  assert.equal(
    artistFromVideo('KendrickLamarVEVO', 'Some Other Artist - DNA.'),
    'KendrickLamar',
  )
  assert.equal(artistFromVideo('TemsVEVO', 'Free Mind'), 'Tems')
})
