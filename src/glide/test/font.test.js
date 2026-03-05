import { test } from 'node:test'
import { hit, mockDOM, mockListen } from '#test/utils'
import { Font } from '#font'
import { GlideMotion } from '#glide'

const fixture = `<svg><font horiz-adv-x="500">
  <font-face units-per-em="1000" ascent="800" descent="-200"/>
  <glyph unicode="e" horiz-adv-x="315"
    d="M 63 63 L 126 94.5 L 158 126"/>
  <glyph unicode="i" horiz-adv-x="300"
    d="M 100 0 L 100 200 M 100 280 L 100 300"/>
  <glyph unicode=" " horiz-adv-x="250"/>
</font></svg>`

test('GlideMotion with string', async t => {
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

    await new GlideMotion(t.stage, 'e', {
      font: t.font, size: 30, x: 10, y: 10,
    }).perform()

    t.assert.ok(dispatched.length > 0)
  })

  await t.test('uses pointerType touch', async t => {
    const dispatched = t.mockListen([
      'pointerdown', 'pointermove', 'pointerup',
    ])

    await new GlideMotion(t.stage, 'e', {
      font: t.font, size: 30, x: 10, y: 10,
    }).perform()

    t.assert.ok(
      dispatched.every(e => e.pointerType === 'touch')
    )
  })

  await t.test('dispatches touchstart and touchend', async t => {
    const dispatched = t.mockListen([
      'touchstart', 'touchend',
    ])

    await new GlideMotion(t.stage, 'e', {
      font: t.font, size: 30, x: 10, y: 10,
    }).perform()

    t.assert.ok(
      dispatched.some(e => e.type === 'touchstart') &&
      dispatched.some(e => e.type === 'touchend')
    )
  })

  await t.test('pen lift dispatches multiple down-up cycles',
    async t => {
      const dispatched = t.mockListen([
        'pointerdown', 'pointerup',
      ])

      await new GlideMotion(t.stage, 'i', {
        font: t.font, size: 30, x: 10, y: 10,
      }).perform()

      const downs = dispatched.filter(e => e.type === 'pointerdown')

      t.assert.ok(downs.length >= 2)
    }
  )

  await t.test('without size throws', t => {
    t.assert.throws(
      () => new GlideMotion(t.stage, 'e', {
        font: t.font, x: 10, y: 10,
      }),
      { name: 'TypeError', message: /size/i }
    )
  })

  await t.test('unknown glyph rejects', async t => {
    await t.assert.rejects(
      () => new GlideMotion(t.stage, 'Ø', {
        font: t.font, size: 30, x: 10, y: 10,
      }).perform(),
      { name: 'TypeError', message: /glyph/i }
    )
  })
})
