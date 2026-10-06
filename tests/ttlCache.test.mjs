import test from 'node:test'
import assert from 'node:assert/strict'

import { createTtlCache, normalizeQuery } from '../src/lib/ttlCache.ts'

/** A clock the test drives by hand. */
function clock(start = 0) {
  let at = start
  return {
    now: () => at,
    advance: (ms) => {
      at += ms
    },
  }
}

test('a value comes back until it expires', () => {
  const time = clock()
  const cache = createTtlCache({ ttlMs: 1000, now: time.now })

  cache.set('a', 'first')
  assert.equal(cache.get('a'), 'first')

  time.advance(999)
  assert.equal(cache.get('a'), 'first')

  time.advance(1)
  assert.equal(cache.get('a'), undefined)
})

test('a value that expired is forgotten, not stale', () => {
  const time = clock()
  const cache = createTtlCache({ ttlMs: 500, now: time.now })
  cache.set('a', 1)
  time.advance(501)
  assert.equal(cache.size(), 0)
})

test('the cache stops growing', () => {
  const time = clock()
  const cache = createTtlCache({ ttlMs: 10_000, maxEntries: 3, now: time.now })

  for (const key of ['a', 'b', 'c', 'd']) cache.set(key, key)
  assert.equal(cache.size(), 3)
  // The oldest went first.
  assert.equal(cache.get('a'), undefined)
  assert.equal(cache.get('d'), 'd')
})

test('a missing key is simply missing', () => {
  const cache = createTtlCache({ ttlMs: 1000 })
  assert.equal(cache.get('never set'), undefined)
})

test('a query is the same query regardless of case and spacing', () => {
  assert.equal(normalizeQuery('  Noname   Rainforest '), 'noname rainforest')
  assert.equal(normalizeQuery('NONAME rainforest'), 'noname rainforest')
  assert.equal(normalizeQuery(''), '')
})
