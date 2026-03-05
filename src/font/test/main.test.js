import { test } from 'node:test'
import { Font } from '../index.js'

const fixture = `<svg><font horiz-adv-x="500">
  <font-face units-per-em="1000" ascent="800" descent="-200"/>
  <glyph unicode="e" horiz-adv-x="315"
    d="M 63 63 L 126 94.5 L 158 126"/>
  <glyph unicode="i" horiz-adv-x="300"
    d="M 100 0 L 100 200 M 100 280 L 100 300"/>
  <glyph unicode=" " horiz-adv-x="250"/>
</font></svg>`

test('Font', async t => {
  await t.test('#from', async t => {
    await t.test('parses valid SVG font', t => {
      t.assert.ok(Font.from(fixture))
    })

    await t.test('throws on missing font element', t => {
      t.assert.throws(
        () => Font.from('<svg></svg>'),
        { name: 'TypeError', message: /font/i }
      )
    })

    await t.test('throws on missing font-face element', t => {
      t.assert.throws(
        () => Font.from('<svg><font></font></svg>'),
        { name: 'TypeError', message: /font-face/i }
      )
    })
  })

  await t.test('#layout', async t => {
    t.beforeEach(t => (t.font = Font.from(fixture)))

    await t.test('returns strokes for known glyph', t => {
      const strokes = t.font.layout('e', { size: 30 })

      t.assert.ok(strokes.length > 0)
      t.assert.ok(strokes[0].length > 0)
    })

    await t.test('each point is [x, y]', t => {
      const [[first]] = t.font.layout('e', { size: 30 })

      t.assert.strictEqual(first.length, 2)
      t.assert.ok(Number.isFinite(first[0]))
      t.assert.ok(Number.isFinite(first[1]))
    })

    await t.test('scales to target size', t => {
      const small = t.font.layout('e', { size: 10 })
      const large = t.font.layout('e', { size: 100 })

      const height = strokes => {
        const ys = strokes.flat().map(p => p[1])
        return Math.max(...ys) - Math.min(...ys)
      }

      t.assert.ok(height(large) > height(small))
    })

    await t.test('advances cursor between glyphs', t => {
      const one = t.font.layout('e', { size: 30 })
      const two = t.font.layout('ee', { size: 30 })

      const maxX = strokes =>
        Math.max(...strokes.flat().map(p => p[0]))

      t.assert.ok(maxX(two) > maxX(one))
    })

    await t.test('splits on pen lifts', t => {
      const strokes = t.font.layout('i', { size: 30 })

      t.assert.ok(strokes.length >= 2)
    })

    await t.test('space advances without strokes', t => {
      const spaced = t.font.layout('e e', { size: 30 })
      const tight = t.font.layout('ee', { size: 30 })

      const maxX = strokes =>
        Math.max(...strokes.flat().map(p => p[0]))

      t.assert.ok(maxX(spaced) > maxX(tight))
    })

    await t.test('throws on unknown glyph', t => {
      t.assert.throws(
        () => t.font.layout('Ø', { size: 30 }),
        { name: 'TypeError', message: /glyph/i }
      )
    })
  })
})
