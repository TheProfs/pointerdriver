import { test } from 'node:test'
import { mockDOM, mockListen } from '#test/utils'
import { GlideMotion } from '../index.js'

test('GlideMotion', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM, mockListen }).mockDOM())

  await t.test('points with non-array input', async t => {
    await t.test('throws TypeError', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new GlideMotion(el, null),
        { name: 'TypeError', message: /GlideMotion\.points/i }
      )
    })
  })

  await t.test('points with negative timestamps', async t => {
    await t.test('throws RangeError', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new GlideMotion(el, [[10, 10, -1]]),
        { name: 'RangeError', message: />= 0/i }
      )
    })
  })

  await t.test('points with decreasing timestamps', async t => {
    await t.test('throws RangeError', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new GlideMotion(el, [
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
        () => new GlideMotion(el, [[10, 10]]),
        { name: 'TypeError', message: /\[x, y, ms\]/i }
      )
    })

    await t.test('throws TypeError on non-finite numbers', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new GlideMotion(el, [[10, NaN, 0]]),
        { name: 'TypeError', message: /finite/i }
      )
    })
  })

  await t.test('1-finger drag within element', async t => {
    t.beforeEach(t => Object.assign(t, {
      stage: document.body.appendChild(
        Object.assign(document.createElement('div'), { id: 'stage' })
      ),
      a: document.createElement('div'),
      b: document.createElement('div'),
    }))

    t.beforeEach(t => {
      t.a.id = 'a'
      t.b.id = 'b'
      t.stage.append(t.a, t.b)

      document.elementFromPoint = x => (x < 20 ? t.a : t.b)
    })

    await t.test('dispatches expected event sequence', async t => {
      const dispatched = t.mockListen([
        'pointerover',
        'pointerenter',
        'pointerdown',
        'gotpointercapture',
        'touchstart',
        'pointermove',
        'touchmove',
        'pointerup',
        'lostpointercapture',
        'pointerout',
        'pointerleave',
        'touchend',
      ])

      await new GlideMotion(t.stage, [
        [10, 10, 0],
        [30, 10, 0],
      ]).perform()

      t.assert.eventSequence(dispatched, [
        'pointerover@a',
        'pointerenter@HTML',
        'pointerenter@BODY',
        'pointerenter@stage',
        'pointerenter@a',
        'pointerdown@a',
        'gotpointercapture@a',
        'touchstart@a',
        'pointermove@a',
        'touchmove@a',
        'pointerup@a',
        'lostpointercapture@a',
        'pointerout@a',
        'pointerleave@a',
        'pointerleave@stage',
        'pointerleave@BODY',
        'pointerleave@HTML',
        'touchend@a',
      ])
    })

    await t.test('dispatches pointerdown with capture', async t => {
      const dispatched = t.mockListen(['pointerdown'])

      await new GlideMotion(t.stage, [
        [10, 10, 0],
        [30, 10, 0],
      ]).perform()

      t.assert.strictEqual(dispatched[0].hasCapture, true)
    })

    await t.test('uses pointerType touch', async t => {
      const dispatched = t.mockListen([
        'pointerover',
        'pointerenter',
        'pointerdown',
        'pointermove',
        'pointerup',
        'pointerout',
        'pointerleave',
        'gotpointercapture',
        'lostpointercapture',
      ])

      await new GlideMotion(t.stage, [
        [10, 10, 0],
        [30, 10, 0],
      ]).perform()

      t.assert.ok(
        dispatched.length > 0 &&
          dispatched.every(e => e.pointerType === 'touch')
      )
    })

    await t.test('keeps TouchEvent targets stable', async t => {
      const dispatched = t.mockListen(['touchstart', 'touchmove', 'touchend'])

      await new GlideMotion(t.stage, [
        [10, 10, 0],
        [30, 10, 0],
      ]).perform()

      t.assert.eventSequence(dispatched, [
        'touchstart@a',
        'touchmove@a',
        'touchend@a',
      ])
    })
  })

  await t.test('hit-test miss mid-motion', async t => {
    await t.test('warns once and continues', async t => {
      const stage = document.body.appendChild(
        Object.assign(document.createElement('div'), { id: 'stage' })
      )

      const a = Object.assign(document.createElement('div'), { id: 'a' })
      stage.append(a)
      document.elementFromPoint = x => (x < 20 ? a : null)

      const warn = t.mock.method(console, 'warn')

      await new GlideMotion(stage, [
        [10, 10, 0],
        [30, 10, 0],
      ]).perform()

      t.assert.strictEqual(warn.mock.callCount(), 1)
      t.assert.match(warn.mock.calls[0].arguments[0], /hit-test missed/i)
    })
  })
})
