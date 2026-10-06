import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CARD_DIMENSIONS,
  cardLayout,
  layoutBottom,
  podiumWidth,
  rowsBlockHeight,
  RUNNER_COVER_RATIO,
} from '../src/lib/shareLayout.ts'

const FORMATS = ['9:16', '1:1', '16:9']
const COUNTS = [3, 5, 10]
/** The top of the region the content lives in, whatever the shape. */
const regionTop = (layout) => Math.round(layout.height * 0.2)

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
    assert.equal(layout.sideBySide, false)
  }
})

test('nothing runs off the bottom, in any shape or length', () => {
  for (const format of FORMATS) {
    for (const count of COUNTS) {
      const layout = cardLayout(format, count)
      assert.ok(
        layoutBottom(layout) <= layout.contentBottomLimit,
        `${format} with ${count} songs ran into the footer`,
      )
      assert.equal(layout.rowCount, Math.max(0, count - 3))
    }
  }
})

test('the podium fits the width it is given', () => {
  for (const format of FORMATS) {
    for (const count of COUNTS) {
      const layout = cardLayout(format, count)
      assert.ok(
        podiumWidth(layout) <= layout.podiumPaneWidth + 1,
        `${format} with ${count} songs pushed the podium out of its pane`,
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
  }
})

test('the content is centred rather than pinned under the header', () => {
  for (const format of FORMATS) {
    for (const count of COUNTS) {
      const layout = cardLayout(format, count)
      const top = regionTop(layout)

      // Side by side, the two panes are centred on their own. In one column the
      // podium and the rows are centred together, as a single block.
      const panes = layout.sideBySide
        ? [
            {
              name: 'podium',
              above: layout.podiumTop - top,
              height: layout.podiumBlockHeight,
              from: layout.podiumTop,
            },
            {
              name: 'rows',
              above: layout.rowsTop - top,
              height: rowsBlockHeight(layout),
              from: layout.rowsTop,
            },
          ]
        : [
            {
              name: 'column',
              above: layout.podiumTop - top,
              height: layoutBottom(layout) - layout.podiumTop,
              from: layout.podiumTop,
            },
          ]

      for (const pane of panes) {
        const below = layout.contentBottomLimit - (pane.from + pane.height)

        assert.ok(
          pane.above >= 0,
          `${format}/${count}: the ${pane.name} went above the region`,
        )
        assert.ok(
          below >= 0,
          `${format}/${count}: the ${pane.name} ran into the footer by ${-below}`,
        )
        assert.ok(
          Math.abs(pane.above - below) <= 2,
          `${format}/${count}: the ${pane.name} is not centred, ${pane.above} above and ${below} below`,
        )
      }
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
    const region = layout.contentBottomLimit - regionTop(layout)
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

test('a dense square card drops the gaps before it shrinks the rows', () => {
  const ten = cardLayout('1:1', 10)
  assert.equal(ten.rowGap, 0, 'a top ten square should set its rows flush')
  assert.ok(ten.rowHeight > Math.floor(ten.height * 0.05))
})

test('a roomy card keeps its gaps', () => {
  const five = cardLayout('1:1', 5)
  assert.ok(five.rowGap > 0, 'a top five has no reason to squeeze')
})

test('the tall card is left alone, since its rows already have room', () => {
  const ten = cardLayout('9:16', 10)
  assert.ok(ten.rowGap > 0)
  assert.ok(ten.rowHeight > Math.floor(ten.height * 0.05))
  assert.equal(ten.sideBySide, false)
})

test('a wide card puts the podium in one pane and the rows in the other', () => {
  const ten = cardLayout('16:9', 10)

  assert.equal(ten.sideBySide, true)
  assert.equal(ten.rowCount, 7)
  assert.ok(
    ten.rowsPaneX > ten.marginX,
    'the rows should start to the right of the podium pane',
  )
  assert.ok(
    ten.podiumPaneWidth + ten.paneGap + ten.rowsPaneWidth <=
      ten.width - ten.marginX * 2 + 1,
    'the panes do not fit across the card',
  )
  // And the whole point of the wide shape: taller rows than a square card.
  assert.ok(
    ten.rowHeight > cardLayout('1:1', 10).rowHeight,
    'the wide pane should beat the single column',
  )
})

test('a wide card with a shorter list stays in one column', () => {
  // Only the top ten is split into panes: two rows under a full width podium
  // read fine, and splitting them would leave both halves sparse.
  const five = cardLayout('16:9', 5)
  assert.equal(five.sideBySide, false)
  assert.equal(five.rowCount, 2)
  assert.equal(five.rowsPaneX, five.marginX)
})

test('only the densest card puts its rows on a shared panel', () => {
  const panelCases = []
  for (const format of FORMATS) {
    for (const count of COUNTS) {
      const layout = cardLayout(format, count)
      if (layout.rowsSharePanel) panelCases.push(`${format}/${count}`)
    }
  }
  assert.deepEqual(panelCases, ['1:1/10'])
})
