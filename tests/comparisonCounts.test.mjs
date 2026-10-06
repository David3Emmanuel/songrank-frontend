import test from 'node:test'
import assert from 'node:assert/strict'

import { PlaylistRanker } from '../src/lib/PlaylistRanker.ts'

test('counts how often each song has been compared', () => {
  const ranker = new PlaylistRanker(['a', 'b', 'c'])
  ranker.addSwipe('a', 'b', 'Strong Win A')
  ranker.addSwipe('a', 'c', 'Weak Win B')
  ranker.addSwipe('b', 'c', 'Tie')

  assert.deepEqual(ranker.getComparisonCounts(), { a: 2, b: 2, c: 2 })
})

test('a song nobody has compared is simply absent', () => {
  const ranker = new PlaylistRanker(['a', 'b', 'c'])
  ranker.addSwipe('a', 'b', 'Strong Win A')

  const counts = ranker.getComparisonCounts()
  assert.equal(counts.a, 1)
  assert.equal(counts.b, 1)
  assert.equal(counts.c, undefined)
  assert.equal(counts.c ?? 0, 0)
})

test('an empty session counts nothing', () => {
  assert.deepEqual(new PlaylistRanker(['a', 'b']).getComparisonCounts(), {})
})

test('undo takes the count back down', () => {
  const ranker = new PlaylistRanker(['a', 'b'])
  ranker.addSwipe('a', 'b', 'Strong Win A')
  ranker.undoLastComparison()
  assert.deepEqual(ranker.getComparisonCounts(), {})
})
