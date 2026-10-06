import test from 'node:test'
import assert from 'node:assert/strict'

import {
  groupVideos,
  songTitleKey,
} from '../src/lib/songGrouping.ts'

const video = (id, title, channelTitle, durationMs = 200000) => ({
  id,
  title,
  channelTitle,
  durationMs,
})

test('the decorations come off a title, the song does not change', () => {
  assert.equal(songTitleKey('Blinding Lights (Official Video)'), 'Blinding Lights')
  assert.equal(songTitleKey('Blinding Lights [Official Audio]'), 'Blinding Lights')
  assert.equal(songTitleKey('Blinding Lights (Official Lyric Video)'), 'Blinding Lights')
  assert.equal(songTitleKey('Levitating (feat. DaBaby)'), 'Levitating')
})

test('live and remix are different songs, so they stay', () => {
  assert.equal(songTitleKey('Blinding Lights (Live)'), 'Blinding Lights (Live)')
  assert.equal(songTitleKey('Blinding Lights (Remix)'), 'Blinding Lights (Remix)')
})

test('an "Artist - Song" upload is keyed on the song', () => {
  assert.equal(songTitleKey('Noname - Rainforest (lyrics)'), 'Rainforest')
  assert.equal(songTitleKey('Nomane - Rainforest'), 'Rainforest')
  assert.equal(songTitleKey('Rainforest'), 'Rainforest')
})

test('that still holds when the take is meaningful', () => {
  assert.equal(songTitleKey('Noname - Rainforest (Live)'), 'Rainforest (Live)')
  assert.notEqual(
    songTitleKey('Noname - Rainforest (Live)'),
    songTitleKey('Rainforest'),
  )
})

test('a hyphen inside a title is not a separator', () => {
  assert.equal(songTitleKey('Spider-Man'), 'Spider-Man')
  assert.equal(songTitleKey('Rainforest - Part 2'), 'Rainforest - Part 2')
})

test('a concert is not a song', () => {
  const grouped = groupVideos([
    video('concert', 'Noname: Tiny Desk Concert', 'NPR Music'),
    video('song', 'Rainforest', 'Noname - Topic'),
  ])
  assert.deepEqual(
    grouped.songs.map((song) => song.id),
    ['song'],
  )
  assert.equal(grouped.filtered, 1)
})

test('an obfuscated title does not dodge the rules', () => {
  // Mathematical bold letters, straight from a real search page.
  const obfuscated = '𝙽𝚘𝚗𝚊𝚖𝚎 - 𝚁𝚊𝚒𝚗𝚏𝚘𝚛𝚎𝚜𝚝 [𝙨𝙡𝚘𝙬𝚎𝚍 + 𝚛𝚎𝚟𝚎𝚛𝚋]'
  const grouped = groupVideos([
    video('slow', obfuscated, 'YUTAKA'),
    video('real', 'Rainforest', 'Noname - Topic'),
  ])

  // Folding them down is what lets the row match the plain title; without that
  // the key comes out empty and this becomes a second song of its own.
  assert.equal(grouped.songs.length, 1)
  assert.equal(grouped.duplicates, 1)
  assert.deepEqual(
    grouped.songs.map((song) => song.id),
    ['real'],
  )
})

test('a song-first title still finds the song', () => {
  // "Rainforest - Noname" puts the song first, opposite to the usual order.
  const grouped = groupVideos([
    video('real', 'Rainforest', 'Noname - Topic'),
    video('songfirst', 'Rainforest - Noname', 'Some Reuploads'),
  ])

  assert.equal(grouped.songs.length, 1)
  assert.equal(grouped.duplicates, 1)
  // The artist's own channel still wins.
  assert.equal(grouped.songs[0].id, 'real')
})

test('karaoke and sped up takes collapse into the song', () => {
  // The same song, badly uploaded. These fold into one entry rather than being
  // dropped: nobody should be asked to rank a song against itself.
  const grouped = groupVideos([
    video('real', 'Rainforest', 'Noname - Topic'),
    video('karaoke', 'Rainforest - Noname Karaoke', 'Seongchal Karaoke'),
    video('sped', 'Rainforest - Noname (sped up)', 'YUTAKA'),
  ])

  assert.equal(grouped.songs.length, 1)
  assert.equal(grouped.duplicates, 2)
  assert.equal(grouped.filtered, 0)
  assert.deepEqual(
    grouped.songs.map((song) => song.id),
    ['real'],
  )
})

test('the entity type beats the channel name', () => {
  // A reupload on a Topic-looking channel loses to the official track.
  const grouped = groupVideos([
    {
      ...video('ugc', 'Rainforest', 'Noname - Topic'),
      videoType: 'MUSIC_VIDEO_TYPE_UGC',
    },
    {
      ...video('atv', 'Rainforest', 'Some Aggregator'),
      videoType: 'MUSIC_VIDEO_TYPE_ATV',
    },
  ])

  assert.equal(grouped.songs.length, 1)
  assert.equal(grouped.songs[0].id, 'atv')
})

test('an official video beats user generated content', () => {
  const grouped = groupVideos([
    {
      ...video('ugc', 'Rainforest', 'Reuploads R Us'),
      videoType: 'MUSIC_VIDEO_TYPE_UGC',
    },
    {
      ...video('omv', 'Rainforest', 'Reuploads R Us'),
      videoType: 'MUSIC_VIDEO_TYPE_OMV',
    },
  ])

  assert.equal(grouped.songs[0].id, 'omv')
})

test('a row called a review is still dropped', () => {
  const grouped = groupVideos([
    video('review', 'Rainforest ALBUM REVIEW', 'Some Channel'),
    video('real', 'Rainforest', 'Noname - Topic'),
  ])

  assert.equal(grouped.filtered, 1)
  assert.deepEqual(
    grouped.songs.map((song) => song.id),
    ['real'],
  )
})

test('uploads of one song collapse to a single entry', () => {
  const grouped = groupVideos([
    video('a', 'Blinding Lights (Official Video)', 'TheWeekndVEVO'),
    video('b', 'Blinding Lights (Official Audio)', 'The Weeknd - Topic'),
    video('c', 'Blinding Lights (Lyrics)', 'Some Lyrics Channel'),
  ])

  assert.equal(grouped.songs.length, 1)
  assert.equal(grouped.duplicates, 2)
  assert.equal(grouped.filtered, 0)
  // The artist's own channel wins over a lyric reupload.
  assert.equal(grouped.songs[0].id, 'b')
})

test('official beats merely popular', () => {
  const grouped = groupVideos([
    video('popular', 'Levitating', 'Random Uploads'),
    video('official', 'Levitating', 'Dua Lipa - Topic'),
  ])
  assert.equal(grouped.songs[0].id, 'official')
})

test('on equal footing the cleaner title wins', () => {
  const grouped = groupVideos([
    video('decorated', 'Levitating (Official Audio)', 'Dua Lipa - Topic'),
    video('clean', 'Levitating', 'Dua Lipa - Topic'),
  ])
  assert.equal(grouped.songs[0].id, 'clean')
})

test('something that is not a song is dropped and counted', () => {
  const grouped = groupVideos([
    video('reaction', 'Blinding Lights REACTION', 'Reacts Daily'),
    video('album', 'After Hours (Full Album)', 'Music Uploads'),
    video('real', 'Blinding Lights', 'The Weeknd - Topic'),
  ])

  assert.deepEqual(
    grouped.songs.map((song) => song.id),
    ['real'],
  )
  assert.equal(grouped.filtered, 2)
})

test('relevance order is kept for distinct songs', () => {
  const grouped = groupVideos([
    video('1', 'These Walls', 'Kendrick Lamar - Topic'),
    video('2', 'Rainforest', 'Noname - Topic'),
    video('3', 'Feather', 'Sabrina Carpenter - Topic'),
  ])
  assert.deepEqual(
    grouped.songs.map((song) => song.id),
    ['1', '2', '3'],
  )
})

test('the counts always add up to what came in', () => {
  const items = [
    video('a', 'Song One', 'A - Topic'),
    video('a2', 'Song One (Official Video)', 'A VEVO'),
    video('b', 'Podcast About Song One', 'Chat Show'),
    video('c', 'Song Two', 'B - Topic'),
    video('d', 'Song Two (Remix)', 'B - Topic'),
  ]
  const grouped = groupVideos(items)

  assert.equal(
    grouped.songs.length + grouped.duplicates + grouped.filtered,
    items.length,
  )
  assert.equal(grouped.songs.length, 3)
  assert.equal(grouped.filtered, 1)
})

test('an empty page of results is safe', () => {
  assert.deepEqual(groupVideos([]), { songs: [], duplicates: 0, filtered: 0 })
})

// The regression this guards: "how to" used to be enough on its own to throw a
// song away, and "How To Pray", "How to Love" and "How to Save a Life" are songs.
test('a song is not a tutorial just because it says how to', () => {
  const grouped = groupVideos([
    { ...video('a', 'How To Pray', 'Dahi'), videoType: 'MUSIC_VIDEO_TYPE_ATV' },
    video('b', 'How to Love', 'Lil Wayne - Topic'),
    video('c', 'How to Save a Life', 'The Fray - Topic'),
  ])
  assert.deepEqual(
    grouped.songs.map((song) => song.title),
    ['How To Pray', 'How to Love', 'How to Save a Life'],
  )
  assert.equal(grouped.filtered, 0)
})

test('instruction still goes, because it asks for a verb', () => {
  const grouped = groupVideos([
    video('a', 'HOW TO PLAY N95 ON GUITAR (easy tutorial)', 'guitar guy'),
    video('b', 'How to produce a Kendrick Lamar beat', 'beatmaker'),
    video('c', 'Kendrick Lamar - Not Like Us (Reaction)', 'some reactor'),
  ])
  assert.deepEqual(grouped.songs, [])
  assert.equal(grouped.filtered, 3)
})

test('an official release is a song whatever its title claims', () => {
  // An interview that is an official release is still not a song, but a track
  // whose title merely reads like one is, and the label is what decides.
  const grouped = groupVideos([
    { ...video('a', 'How To Pray', 'Dahi'), videoType: 'MUSIC_VIDEO_TYPE_ATV' },
    { ...video('b', 'Interview With The Artist', 'someone'), videoType: 'MUSIC_VIDEO_TYPE_UGC' },
  ])
  assert.deepEqual(grouped.songs.map((song) => song.id), ['a'])
  assert.equal(grouped.filtered, 1)
})

test('an unofficial copy of a song folds into the official one', () => {
  const grouped = groupVideos([
    video('upload', 'How To Pray', 'some uploader'),
    { ...video('official', 'How To Pray', 'Dahi'), videoType: 'MUSIC_VIDEO_TYPE_ATV' },
  ])
  assert.deepEqual(grouped.songs.map((song) => song.id), ['official'])
  assert.equal(grouped.duplicates, 1)
})
