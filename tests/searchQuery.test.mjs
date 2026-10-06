import test from 'node:test'
import assert from 'node:assert/strict'

import { resultsLabel, scopedQuery } from '../src/lib/searchQuery.ts'

test('no filter sends exactly what was typed', () => {
  assert.equal(scopedQuery(null, 'rainforest'), 'rainforest')
  assert.equal(scopedQuery('', 'rainforest'), 'rainforest')
  assert.equal(scopedQuery(undefined, '  rainforest  '), 'rainforest')
})

test('a filter on its own is a search by itself', () => {
  assert.equal(scopedQuery('Kendrick Lamar', ''), 'Kendrick Lamar')
  assert.equal(scopedQuery('Kendrick Lamar', '   '), 'Kendrick Lamar')
})

test('a filter scopes the words rather than replacing them', () => {
  assert.equal(scopedQuery('Kendrick Lamar', 'GNX'), 'Kendrick Lamar GNX')
  assert.equal(
    scopedQuery('  Noname ', '  rainforest '),
    'Noname rainforest',
  )
})

test('the heading does not repeat the filter that is already on screen', () => {
  // The chip says the artist, so the heading says the words.
  assert.equal(resultsLabel('Kendrick Lamar', 'GNX'), 'GNX')
  assert.equal(resultsLabel('Kendrick Lamar', ''), 'Kendrick Lamar')
  assert.equal(resultsLabel(null, 'rainforest'), 'rainforest')
})
