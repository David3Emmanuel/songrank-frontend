import test from 'node:test'
import assert from 'node:assert/strict'

import { cardFooter } from '../src/lib/site.ts'

test('with no address configured the card just says the name', () => {
  assert.equal(cardFooter(''), 'SongRank')
  assert.equal(cardFooter('   '), 'SongRank')
})

test('an address is shown as the thing somebody could type', () => {
  assert.equal(cardFooter('https://songrank.app'), 'songrank.app')
  assert.equal(cardFooter('http://localhost:3000'), 'localhost:3000')
  assert.equal(cardFooter('songrank.app/'), 'songrank.app')
  assert.equal(cardFooter('https://songrank.app///'), 'songrank.app')
})
