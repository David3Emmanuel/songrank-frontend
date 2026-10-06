import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  MUSIC_CLIENT,
  OFFICIAL_VIDEO_TYPES,
  kindForRow,
  parseDurationText,
  parseSearchEntities,
  parseSearchSongs,
  parseSubtitle,
} from '../src/lib/innertube.ts'

// Six rows captured from a real response to a search for "Noname Rainforest",
// chosen to include an official track, an official video and a reupload.
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/innertube-search-rows.json', import.meta.url), 'utf8'),
)

test('a length reads as milliseconds', () => {
  assert.equal(parseDurationText('3:20'), 200000)
  assert.equal(parseDurationText('0:01'), 1000)
  assert.equal(parseDurationText('1:02:03'), 3723000)
})

test('anything that is not a length is zero', () => {
  assert.equal(parseDurationText('116K views'), 0)
  assert.equal(parseDurationText('Song'), 0)
  assert.equal(parseDurationText(''), 0)
  assert.equal(parseDurationText('2:43:'), 0)
})

test('a subtitle splits into the song, the artist and the length', () => {
  assert.deepEqual(parseSubtitle('Song • Noname • 2:43'), {
    kind: 'Song',
    artist: 'Noname',
    album: '',
    durationMs: 163000,
  })
})

test('a view count is not mistaken for a song or an artist', () => {
  assert.deepEqual(parseSubtitle('Video • Hungry  • 907 views'), {
    kind: 'Video',
    artist: 'Hungry',
    album: '',
    durationMs: 0,
  })
})

test('an album is kept when the row carries one', () => {
  assert.deepEqual(parseSubtitle('Song • Noname • Room 25 • 3:12'), {
    kind: 'Song',
    artist: 'Noname',
    album: 'Room 25',
    durationMs: 192000,
  })
})

test('a subtitle with no kind still yields the artist', () => {
  assert.equal(parseSubtitle('nanotopia').artist, 'nanotopia')
})

test('every row of the captured response parses', () => {
  const songs = parseSearchSongs(fixture)
  assert.equal(songs.length, 6)
  for (const song of songs) {
    assert.ok(song.videoId, 'each song needs something to play')
    assert.ok(song.title, 'each song needs a title')
    assert.ok(song.artist, 'each song needs an artist')
  }
})

test('the captured rows keep their order and their types', () => {
  const songs = parseSearchSongs(fixture)
  assert.equal(songs[0].title, 'Rainforest')
  assert.equal(songs[0].videoId, 'zZfs3o5_sc8')
  assert.equal(songs[0].videoType, 'MUSIC_VIDEO_TYPE_ATV')

  // The artist for the official track is the channel the label publishes as,
  // not a reuploader's name.
  assert.equal(songs[0].artist, 'nanotopia')
  assert.equal(songs[1].videoType, 'MUSIC_VIDEO_TYPE_OMV')
  assert.equal(songs[2].videoType, 'MUSIC_VIDEO_TYPE_UGC')
  assert.equal(songs[2].artist, 'Hungry')
})

test('the official types are the two that mean real music', () => {
  assert.ok(OFFICIAL_VIDEO_TYPES.has('MUSIC_VIDEO_TYPE_ATV'))
  assert.ok(OFFICIAL_VIDEO_TYPES.has('MUSIC_VIDEO_TYPE_OMV'))
  assert.ok(!OFFICIAL_VIDEO_TYPES.has('MUSIC_VIDEO_TYPE_UGC'))
})

test('the client is named as the web player names it', () => {
  assert.equal(MUSIC_CLIENT.clientName, 'WEB_REMIX')
  assert.ok(MUSIC_CLIENT.clientVersion.startsWith('1.'))
})

test('a payload with nothing in it is an empty list, not a crash', () => {
  assert.deepEqual(parseSearchSongs({}), [])
  assert.deepEqual(parseSearchSongs({ contents: { rows: [] } }), [])
  assert.deepEqual(parseSearchSongs(null), [])
})

test('a row with no video id is skipped rather than shown unplayable', () => {
  const payload = {
    musicResponsiveListItemRenderer: {
      flexColumns: [
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: { runs: [{ text: 'A song with nowhere to go' }] },
          },
        },
      ],
    },
  }
  assert.deepEqual(parseSearchSongs(payload), [])
})

// Five rows from a real response to a search for "Kendrick Lamar", one of each
// shape a result list mixes: a song, an album, an artist, a playlist and a single.
const entityFixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/innertube-search-entities.json', import.meta.url),
    'utf8',
  ),
)

test('a result list is typed, not just songs', () => {
  const entities = parseSearchEntities(entityFixture)
  assert.deepEqual(
    entities.map((entity) => entity.kind),
    ['song', 'album', 'artist', 'playlist', 'single'],
  )
})

test('an album carries its artist, its year and a browse id', () => {
  const album = parseSearchEntities(entityFixture).find(
    (entity) => entity.kind === 'album',
  )
  assert.ok(album.id.startsWith('MPREb_'), 'an album is identified by a browse id')
  assert.equal(album.title, 'GNX')
  assert.equal(album.artist, 'Kendrick Lamar')
  assert.equal(album.year, '2024')
  assert.ok(album.coverImage, 'an album row has artwork')
})

test('a single shares the album shape and is told apart by its own word', () => {
  const single = parseSearchEntities(entityFixture).find(
    (entity) => entity.kind === 'single',
  )
  assert.ok(single.id.startsWith('MPREb_'))
  assert.equal(single.artist, 'Kendrick Lamar')
  assert.equal(single.year, '2011')
})

test('an artist row is not read as if it named an artist', () => {
  const artist = parseSearchEntities(entityFixture).find(
    (entity) => entity.kind === 'artist',
  )
  assert.ok(artist.id.startsWith('UC'), 'an artist is identified by a channel id')
  assert.equal(artist.title, 'J. Cole')
  // Its second column is an audience figure, which is not an artist's name.
  assert.equal(artist.artist, '')
  assert.match(artist.detail, /monthly audience/)
})

test('a playlist row keeps its creator out of the artist field', () => {
  const playlist = parseSearchEntities(entityFixture).find(
    (entity) => entity.kind === 'playlist',
  )
  assert.ok(playlist.id.startsWith('VL'))
  assert.equal(playlist.artist, '')
})

test('a song row that names nobody says so, rather than inventing a name', () => {
  const song = parseSearchEntities(entityFixture).find(
    (entity) => entity.kind === 'song',
  )
  assert.equal(song.artist, '')
  assert.match(song.detail, /Song/)
  // Parsed as a song, it still reaches the import with a placeholder.
  const parsed = parseSearchSongs(entityFixture)
  assert.equal(parsed[0].artist, 'Unknown Artist')
})

test('the page type decides what a row is, and the subtitle only splits albums', () => {
  assert.equal(kindForRow('MUSIC_PAGE_TYPE_ALBUM', 'Album'), 'album')
  assert.equal(kindForRow('MUSIC_PAGE_TYPE_ALBUM', 'Single'), 'single')
  assert.equal(kindForRow('MUSIC_PAGE_TYPE_ARTIST', 'Artist'), 'artist')
  assert.equal(kindForRow('MUSIC_PAGE_TYPE_PLAYLIST', 'Playlist'), 'playlist')
  assert.equal(kindForRow('', 'Song'), 'song')
  assert.equal(kindForRow('', 'Video'), 'video')
  // Credits pages and podcast shows are pages, but nothing to add to a ranking.
  assert.equal(kindForRow('MUSIC_PAGE_TYPE_TRACK_CREDITS', 'Song'), null)
  assert.equal(kindForRow('MUSIC_PAGE_TYPE_PODCAST_SHOW_DETAIL_PAGE', 'Show'), null)
})

test('an entity row without a browse id is dropped rather than shown dead', () => {
  const payload = {
    musicResponsiveListItemRenderer: {
      navigationEndpoint: {
        browseEndpoint: {
          browseEndpointContextSupportedConfigs: {
            browseEndpointContextMusicConfig: {
              pageType: 'MUSIC_PAGE_TYPE_ALBUM',
            },
          },
        },
      },
      flexColumns: [
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: { runs: [{ text: 'An album with nowhere to go' }] },
          },
        },
      ],
    },
  }
  assert.deepEqual(parseSearchEntities(payload), [])
})
