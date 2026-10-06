import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CARD_DIMENSIONS,
  cardLayout,
  layoutBottom,
  podiumWidth,
  RUNNER_COVER_RATIO,
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

test('nothing runs off the bottom, in any shape or length', () => {
  for (const format of FORMATS) {
    for (const count of COUNTS) {
      const layout = cardLayout(format, count)
      assert.ok(
        layoutBottom(layout) <= layout.footerY,
        `${format} with ${count} songs reached the footer`,
      )
      assert.equal(layout.rowCount, Math.max(0, count - 3))
    }
  }
})

test('the podium fits across the card, which bounds the cover too', () => {
  for (const format of FORMATS) {
    for (const count of COUNTS) {
      const layout = cardLayout(format, count)
      const usable = layout.width - layout.marginX * 2

      assert.ok(
        podiumWidth(layout) <= usable,
        `${format} with ${count} songs pushed the podium off the sides`,
      )
    }
  }
})

test('rows stay legible and never stretch', () => {
  for (const format of FORMATS) {
    for (const count of COUNTS) {
      const layout = cardLayout(format, count)
      if (layout.rowCount === 0) continue

      assert.ok(
        layout.rowHeight >= Math.floor(layout.height * 0.05),
        `${format} with ${count} songs made rows too small`,
      )
      assert.ok(
        layout.rowHeight <= Math.ceil(layout.height * 0.09),
        `${format} with ${count} songs stretched the rows`,
      )
      assert.ok(
        layout.rowArt > 0 && layout.rowArt < layout.rowHeight,
        'a cover must fit inside its row',
      )
    }
  }
})

test('fewer songs means a bigger podium, not a smaller one', () => {
  for (const format of FORMATS) {
    const three = cardLayout(format, 3)
    const five = cardLayout(format, 5)
    const ten = cardLayout(format, 10)

    assert.ok(
      three.podiumCover >= five.podiumCover,
      `${format}: three songs should not have a smaller podium than five`,
    )
    assert.ok(five.podiumCover >= ten.podiumCover, `${format}: five against ten`)
    // And it should be worth looking at, not a thumbnail.
    assert.ok(
      three.podiumCover >= Math.min(three.height * 0.28, three.width * 0.3),
      `${format}: the podium on a three song card is too small`,
    )
  }
})

test('the content is centred rather than pinned under the header', () => {
  for (const format of FORMATS) {
    for (const count of COUNTS) {
      const layout = cardLayout(format, count)
      const regionTop = Math.round(layout.height * 0.2)
      const above = layout.podiumTop - regionTop
      const below = layout.contentBottomLimit - layoutBottom(layout)

      assert.ok(above >= 0, `${format}/${count}: content went above the region`)
      assert.ok(
        below >= 0,
        `${format}/${count}: content ran into the footer, by ${-below}`,
      )
      assert.ok(
        Math.abs(above - below) <= 2,
        `${format} with ${count} songs is not centred: ${above} above, ${below} below`,
      )
    }
  }
})

test('caption lines cannot overlap each other or the row below', () => {
  for (const format of FORMATS) {
    for (const count of COUNTS) {
      const layout = cardLayout(format, count)
      const groups = [layout.podium]
      if (layout.podiumStacked) groups.push(layout.runner)

      for (const group of groups) {
        assert.ok(
          group.titleY >= group.titleFont,
          `${format}/${count}: the title has no room above it`,
        )
        assert.ok(
          group.artistY - group.titleY >= group.titleFont,
          `${format}/${count}: the artist crowds the title`,
        )
        assert.ok(
          group.durationY - group.artistY >= group.artistFont,
          `${format}/${count}: the length crowds the artist`,
        )
        assert.ok(
          group.block >= group.durationY,
          `${format}/${count}: the caption block does not hold the length`,
        )
      }
    }
  }
})

test('a three song card uses most of the height it has', () => {
  for (const format of FORMATS) {
    const layout = cardLayout(format, 3)
    const region = layout.footerY - Math.round(layout.height * 0.2)
    const used = layoutBottom(layout) - layout.podiumTop
    assert.ok(
      used >= region * 0.5,
      `${format}: only ${Math.round((used / region) * 100)}% of the space is used`,
    )
  }
})

test('the runner up covers are sized as a ratio of the winner', () => {
  assert.ok(RUNNER_COVER_RATIO > 0 && RUNNER_COVER_RATIO < 1)
})

test('a story has room for taller rows than a square', () => {
  assert.ok(cardLayout('9:16', 10).rowHeight > cardLayout('1:1', 10).rowHeight)
})
