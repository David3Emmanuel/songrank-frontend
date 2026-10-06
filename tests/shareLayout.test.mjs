import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CARD_DIMENSIONS,
  cardLayout,
  layoutBottom,
} from '../src/lib/shareLayout.ts'

const FORMATS = ['9:16', '1:1', '16:9']
const COUNTS = [3, 5, 10]

test('the card is the size the platform expects', () => {
  assert.deepEqual(CARD_DIMENSIONS['1:1'], { width: 1080, height: 1080 })
  assert.deepEqual(CARD_DIMENSIONS['9:16'], { width: 1080, height: 1920 })
  assert.deepEqual(CARD_DIMENSIONS['16:9'], { width: 1920, height: 1080 })
})

test('a card of three has no rows below the podium', () => {
  for (const format of FORMATS) {
    const layout = cardLayout(format, 3)
    assert.equal(layout.rowCount, 0)
    assert.equal(layout.rowHeight, 0)
  }
})

test('every format can hold every count without running off the bottom', () => {
  for (const format of FORMATS) {
    for (const count of COUNTS) {
      const layout = cardLayout(format, count)
      const bottom = layoutBottom(layout)

      assert.ok(
        bottom <= layout.footerY,
        `${format} with ${count} songs reached the footer`,
      )
      assert.equal(layout.rowCount, Math.max(0, count - 3))
    }
  }
})

test('rows stay legible and never stretch', () => {
  for (const format of FORMATS) {
    for (const count of COUNTS) {
      const layout = cardLayout(format, count)
      if (layout.rowCount === 0) continue

      const smallest = layout.height * 0.05
      const largest = layout.height * 0.09
      assert.ok(
        layout.rowHeight >= Math.floor(smallest),
        `${format} with ${count} songs made rows too small`,
      )
      assert.ok(
        layout.rowHeight <= Math.ceil(largest),
        `${format} with ${count} songs stretched the rows`,
      )
      assert.ok(layout.rowArt > 0, 'a row needs a cover')
      assert.ok(layout.rowArt < layout.rowHeight, 'a cover must fit its row')
    }
  }
})

test('more songs means tighter rows, up to the floor', () => {
  const five = cardLayout('1:1', 5)
  const ten = cardLayout('1:1', 10)
  assert.ok(ten.rowHeight <= five.rowHeight)
  assert.equal(five.rowCount, 2)
  assert.equal(ten.rowCount, 7)
})

test('a story has room for taller rows than a square', () => {
  assert.ok(cardLayout('9:16', 10).rowHeight > cardLayout('1:1', 10).rowHeight)
})
