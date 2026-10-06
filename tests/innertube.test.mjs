import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  MUSIC_CLIENT,
  OFFICIAL_VIDEO_TYPES,
  isByArtist,
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

// The card at the top of a search is its own renderer, and skipping it meant the
// artist someone searched for was the one result that never appeared: a search
// for "Kendrick Lamar" listed J. Cole and SZA as artists, and not him.
const cardFixture = JSON.parse(
  readFileSync(
    new URL('./fixtures/innertube-search-card.json', import.meta.url),
    'utf8',
  ),
)

test('the top result card is read as an entity', () => {
  const entities = parseSearchEntities(cardFixture)
  assert.equal(entities.length, 1)
  assert.deepEqual(entities[0].kind, 'artist')
  assert.equal(entities[0].title, 'Kendrick Lamar')
  assert.equal(entities[0].id, 'UCprAFmT0C6O4X0ToEXpeFTQ')
  assert.equal(entities[0].artist, '')
  assert.match(entities[0].detail, /monthly audience/)
})

test('the card comes before the rows it sits above', () => {
  const both = { ...entityFixture }
  both.rows = [...cardFixture.rows, ...entityFixture.rows]
  const entities = parseSearchEntities(both)
  assert.equal(entities[0].title, 'Kendrick Lamar')
  assert.equal(entities[1].kind, 'song')
})

// The chip has to be a filter, not a hint: a scoped search still returns rows by
// other people, so the artist is matched on identity and the rest are dropped.
const entity = (over) => ({
  kind: 'song',
  id: 'v1',
  title: 'A song',
  artist: '',
  album: '',
  year: '',
  detail: '',
  durationMs: 0,
  ...over,
})

const kendrick = { id: 'UCkendrick', name: 'Kendrick Lamar' }
const sza = { id: 'UCsza', name: 'SZA' }

test('an artist filter matches the id the row links to', () => {
  // This row names nobody: the id is the only thing that could match.
  const row = entity({ artistIds: ['UCkendrick'] })
  assert.equal(isByArtist(row, kendrick), true)
  assert.equal(isByArtist(row, sza), false)
})

test('a featured artist counts as being on the song', () => {
  // "Money Trees (feat. Jay Rock)" links to both, primary first.
  const row = entity({ artistIds: ['UCkendrick', 'UCjayrock'] })
  assert.equal(isByArtist(row, kendrick), true)
  assert.equal(isByArtist(row, { id: 'UCjayrock', name: 'Jay Rock' }), true)
  assert.equal(isByArtist(row, sza), false)
})

test('another artist is dropped, however highly the search ranked them', () => {
  const row = entity({ artistIds: ['UCcole'], artist: 'J. Cole' })
  assert.equal(isByArtist(row, kendrick), false)
})

test('without an artist link, the names a row lists decide', () => {
  const row = entity({ artist: 'Kendrick Lamar, SZA' })
  assert.equal(isByArtist(row, kendrick), true)
  assert.equal(isByArtist(row, sza), true)
  assert.equal(isByArtist(row, { id: 'UCx', name: 'Drake' }), false)
})

test('names compare loosely, ids do not', () => {
  assert.equal(
    isByArtist(entity({ artist: 'Kendrick  LAMAR' }), kendrick),
    true,
  )
  assert.equal(isByArtist(entity({ artist: 'Kendrick' }), kendrick), false)
  // An unnamed row with no link cannot be claimed by anybody.
  assert.equal(isByArtist(entity({}), kendrick), false)
})

test("an artist's own row is kept only for that artist", () => {
  const row = {
    ...entity({ kind: 'artist', id: 'UCsza', title: 'SZA' }),
  }
  assert.equal(isByArtist(row, sza), true)
  assert.equal(isByArtist(row, kendrick), false)
})

test('a feature recorded only in the title still counts', () => {
  // This is the real shape of the row: no artist link, and the primary artist as
  // plain text, so the title is the only place the feature is written down.
  const row = entity({
    title: 'Money Trees (feat. Jay Rock)',
    artist: 'Kendrick Lamar',
  })
  assert.equal(isByArtist(row, { id: 'UCjayrock', name: 'Jay Rock' }), true)
  assert.equal(isByArtist(row, kendrick), true)
})

test('an ordinary title is not read as a list of artists', () => {
  const row = entity({ title: 'Rock & Roll Queen', artist: 'Someone' })
  assert.equal(isByArtist(row, { id: 'UCx', name: 'Roll Queen' }), false)
  assert.equal(isByArtist(row, { id: 'UCx', name: 'Rock' }), false)
})

test('a credit with several names is read as several names', () => {
  const row = entity({
    title: 'A Song (feat. SZA & Jay Rock)',
    artist: 'Kendrick Lamar',
  })
  assert.equal(isByArtist(row, sza), true)
  assert.equal(isByArtist(row, { id: 'UCj', name: 'Jay Rock' }), true)
  assert.equal(isByArtist(row, { id: 'UCd', name: 'Drake' }), false)
})

// An album's own track rows keep the video id on the play button rather than on
// the title, which is why nine of DAMN.'s fourteen tracks used to be dropped.
test('a track row whose id sits on its play button is still a song', () => {
  const payload = {
    musicResponsiveListItemRenderer: {
      flexColumns: [
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: { runs: [{ text: 'BLOOD.' }] },
          },
        },
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: { runs: [{ text: 'Song • 1:58' }] },
          },
        },
      ],
      overlay: {
        musicItemThumbnailOverlayRenderer: {
          content: {
            musicPlayButtonRenderer: {
              playNavigationEndpoint: {
                watchEndpoint: { videoId: 'aBcDeFgHiJk' },
              },
            },
          },
        },
      },
    },
  }

  const [entity] = parseSearchEntities(payload)
  assert.equal(entity.kind, 'song')
  assert.equal(entity.id, 'aBcDeFgHiJk')
  assert.equal(entity.title, 'BLOOD.')
  // The row's own subtitle still carries the length.
  assert.equal(entity.durationMs, 118000)
})

test('the title column is preferred when it carries the id', () => {
  const payload = {
    musicResponsiveListItemRenderer: {
      flexColumns: [
        {
          musicResponsiveListItemFlexColumnRenderer: {
            text: {
              runs: [
                {
                  text: 'DNA.',
                  navigationEndpoint: { watchEndpoint: { videoId: 'titleId12345' } },
                },
              ],
            },
          },
        },
      ],
      overlay: {
        musicItemThumbnailOverlayRenderer: {
          content: {
            musicPlayButtonRenderer: {
              playNavigationEndpoint: {
                watchEndpoint: { videoId: 'buttonId1234' },
              },
            },
          },
        },
      },
    },
  }

  assert.equal(parseSearchEntities(payload)[0].id, 'titleId12345')
})
