import { test } from 'node:test'
import { hit, mockDOM, mockListen } from '#test/utils'
import { Font } from '#font'
import { StrokeMotion } from '#stroke'

const fixture = `<svg><font horiz-adv-x="500">
  <font-face units-per-em="1000" ascent="800" descent="-200"/>
  <glyph unicode="e" horiz-adv-x="315"
    d="M 63 63 L 126 94.5 L 158 126"/>
  <glyph unicode="i" horiz-adv-x="300"
    d="M 100 0 L 100 200 M 100 280 L 100 300"/>
  <glyph unicode=" " horiz-adv-x="250"/>
</font></svg>`

test('StrokeMotion with string', async t => {
  t.beforeEach(t =>
    Object.assign(t, { mockDOM, mockListen }).mockDOM())

  t.beforeEach(t => Object.assign(t, {
    font: Font.from(fixture),
    stage: document.body.appendChild(
      Object.assign(
        document.createElement('div'), { id: 'stage' }
      )
    ),
  }))

  t.beforeEach(t => hit(t.stage))

  await t.test('dispatches pointer events', async t => {
    const dispatched = t.mockListen([
      'pointerdown', 'pointermove', 'pointerup',
    ])

    await new StrokeMotion(t.stage, 'e', {
      font: t.font, size: 30, x: 10, y: 10,
    }).perform()

    t.assert.ok(dispatched.length > 0)
  })

  await t.test('uses pointerType pen', async t => {
    const dispatched = t.mockListen([
      'pointerdown', 'pointermove', 'pointerup',
    ])

    await new StrokeMotion(t.stage, 'e', {
      font: t.font, size: 30, x: 10, y: 10,
    }).perform()

    t.assert.ok(
      dispatched.every(e => e.pointerType === 'pen')
    )
  })

  await t.test('does not dispatch touch events', async t => {
    const dispatched = t.mockListen([
      'touchstart', 'touchmove', 'touchend',
    ])

    await new StrokeMotion(t.stage, 'e', {
      font: t.font, size: 30, x: 10, y: 10,
    }).perform()

    t.assert.strictEqual(dispatched.length, 0)
  })

  await t.test('pen lift dispatches multiple down-up cycles',
    async t => {
      const dispatched = t.mockListen([
        'pointerdown', 'pointerup',
      ])

      await new StrokeMotion(t.stage, 'i', {
        font: t.font, size: 30, x: 10, y: 10,
      }).perform()

      const downs = dispatched.filter(e => e.type === 'pointerdown')

      t.assert.ok(downs.length >= 2)
    }
  )

  await t.test('multi-character text dispatches events', async t => {
    const dispatched = t.mockListen([
      'pointerdown', 'pointermove', 'pointerup',
    ])

    await new StrokeMotion(t.stage, 'ei', {
      font: t.font, size: 30, x: 10, y: 10,
    }).perform()

    t.assert.ok(dispatched.length > 3)
  })

  await t.test('without size throws', t => {
    t.assert.throws(
      () => new StrokeMotion(t.stage, 'e', {
        font: t.font, x: 10, y: 10,
      }),
      { name: 'TypeError', message: /size/i }
    )
  })

  await t.test('without x throws', t => {
    t.assert.throws(
      () => new StrokeMotion(t.stage, 'e', {
        font: t.font, size: 30, y: 10,
      }),
      { name: 'TypeError', message: /\.x/i }
    )
  })

  await t.test('without y throws', t => {
    t.assert.throws(
      () => new StrokeMotion(t.stage, 'e', {
        font: t.font, size: 30, x: 10,
      }),
      { name: 'TypeError', message: /\.y/i }
    )
  })

  await t.test('unknown glyph rejects', async t => {
    await t.assert.rejects(
      () => new StrokeMotion(t.stage, 'Ø', {
        font: t.font, size: 30, x: 10, y: 10,
      }).perform(),
      { name: 'TypeError', message: /glyph/i }
    )
  })
})
