import test from 'node:test'
import assert from 'node:assert/strict'

import { isSameSong } from '../src/lib/alternatives.ts'

const xxx = { title: 'XXX.', artist: 'Kendrick Lamar' }

test('another artist using the same title is refused', () => {
  // The music index returns this for a search of "XXX. Kendrick Lamar".
  assert.equal(isSameSong({ title: 'XXX', artist: 'Kim Petras' }, xxx), false)
})

test('a reupload that credits the original is accepted', () => {
  assert.equal(
    isSameSong(
      {
        title: 'Kendrick Lamar, U2 & Dave Chappelle - XXX. (Audio)',
        artist: 'F.A.R',
      },
      xxx,
    ),
    true,
  )
})

test('the same song under a decorated title is accepted', () => {
  assert.equal(
    isSameSong({ title: 'XXX. (feat. U2)', artist: 'Kendrick Lamar' }, xxx),
    true,
  )
  assert.equal(
    isSameSong({ title: 'XXX (Official Audio)', artist: 'Kendrick Lamar - Topic' }, xxx),
    true,
  )
})

test('punctuation and case are not what makes a song', () => {
  assert.equal(isSameSong({ title: 'xxx.', artist: 'KENDRICK LAMAR' }, xxx), true)
  assert.equal(
    isSameSong({ title: 'X.X.X', artist: 'Kendrick Lamar' }, xxx),
    true,
  )
})

test('a different song by the same artist is refused', () => {
  assert.equal(
    isSameSong({ title: 'Alright', artist: 'Kendrick Lamar' }, xxx),
    false,
  )
})

test('a title too short to judge is refused rather than guessed at', () => {
  assert.equal(isSameSong({ title: 'A', artist: 'Kendrick Lamar' }, { title: 'A', artist: 'Kendrick Lamar' }), false)
})
