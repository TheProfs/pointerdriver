import { test } from 'node:test'
import { hit, mockDOM, mockListen } from '#test/utils'
import { DragMotion } from '../index.js'

test('DragMotion', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM, mockListen }).mockDOM())

  await t.test('points with non-array input', async t => {
    await t.test('throws TypeError', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new DragMotion(el, null),
        { name: 'TypeError', message: /DragMotion\.points/i }
      )
    })
  })

  await t.test('points with negative timestamps', async t => {
    await t.test('throws RangeError', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new DragMotion(el, [[10, 10, -1]]),
        { name: 'RangeError', message: />= 0/i }
      )
    })
  })

  await t.test('points with decreasing timestamps', async t => {
    await t.test('throws RangeError', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new DragMotion(el, [
          [10, 10, 1],
          [11, 11, 0],
        ]),
        { name: 'RangeError', message: /points\[1\]\[2\]/i }
      )
    })
  })

  await t.test('points with invalid tuples', async t => {
    await t.test('throws TypeError on non-[x, y, ms]', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new DragMotion(el, [[10, 10]]),
        { name: 'TypeError', message: /\[x, y, ms\]/i }
      )
    })

    await t.test('throws TypeError on non-finite numbers', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new DragMotion(el, [[10, NaN, 0]]),
        { name: 'TypeError', message: /finite/i }
      )
    })
  })

  await t.test('points with non-decreasing timestamps', async t => {
    await t.test('computes movementX/Y deltas on pointermove', async t => {
      const el = hit(document.body.appendChild(
        Object.assign(document.createElement('div'), { id: 'el' })
      ))

      const dispatched = t.mockListen(['pointermove'])

      await new DragMotion(el, [
        [10, 10, 0],
        [13, 14, 0],
        [13, 15, 0],
      ]).perform()

      t.assert.deepStrictEqual(
        dispatched.map(e => ({ x: e.movementX, y: e.movementY })),
        [
          { x: 3, y: 4 },
          { x: 0, y: 1 },
        ]
      )
    })

    await t.test('emits expected event sequence', async t => {
      const el = hit(document.body.appendChild(
        Object.assign(document.createElement('div'), { id: 'el' })
      ))

      const dispatched = t.mockListen([
        'pointercancel',
        'pointerover', 'mouseover',
        'pointerenter', 'mouseenter',
        'pointerdown', 'mousedown',
        'pointermove', 'mousemove',
        'pointerup', 'mouseup',
        'pointerout', 'mouseout',
        'pointerleave', 'mouseleave',
        'touchstart',
        'gotpointercapture',
        'lostpointercapture',
      ])

      await new DragMotion(el, [
        [10, 10, 0],
        [13, 14, 0],
      ]).perform()

      t.assert.eventSequence(dispatched, [
        'pointerover@el',
        'mouseover@el',
        'pointerenter@HTML',
        'mouseenter@HTML',
        'pointerenter@BODY',
        'mouseenter@BODY',
        'pointerenter@el',
        'mouseenter@el',
        'pointerdown@el',
        'mousedown@el',
        'pointermove@el',
        'mousemove@el',
        'pointerup@el',
        'mouseup@el',
        'pointerout@el',
        'mouseout@el',
        'pointerleave@el',
        'mouseleave@el',
        'pointerleave@BODY',
        'mouseleave@BODY',
        'pointerleave@HTML',
        'mouseleave@HTML',
      ])
    })

    await t.test('uses pointerType mouse', async t => {
      const el = hit(document.body.appendChild(
        Object.assign(document.createElement('div'), { id: 'el' })
      ))

      const dispatched = t.mockListen(['pointerdown', 'pointermove'])

      await new DragMotion(el, [
        [10, 10, 0],
        [13, 14, 0],
      ]).perform()

      t.assert.ok(
        dispatched.length > 0 &&
          dispatched.every(e => e.pointerType === 'mouse')
      )
    })
  })

  await t.test('hit-test miss mid-motion', async t => {
    await t.test('warns once and continues', async t => {
      const el = document.body.appendChild(
        Object.assign(document.createElement('div'), { id: 'el' })
      )

      document.elementFromPoint = x => (x < 11 ? el : null)

      const warn = t.mock.method(console, 'warn')

      await new DragMotion(el, [
        [10, 10, 0],
        [13, 14, 0],
      ]).perform()

      t.assert.strictEqual(warn.mock.callCount(), 1)
      t.assert.match(warn.mock.calls[0].arguments[0], /hit-test missed/i)
    })
  })
})
