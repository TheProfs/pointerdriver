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
        'touchstart',
        'gotpointercapture',
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
        'touchstart@a',
        'gotpointercapture@a',
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

      t.assert.everyPartialEqual(dispatched, { pointerType: 'touch' })
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
    t.beforeEach(t => Object.assign(t, {
      stage: document.body.appendChild(
        Object.assign(document.createElement('div'), { id: 'stage' })
      ),
      a: document.createElement('div'),
    }))

    t.beforeEach(t => {
      t.a.id = 'a'
      t.stage.append(t.a)
      document.elementFromPoint = x => (x < 20 ? t.a : null)
    })

    await t.test('rejects with hit-test missed error', async t => {
      await t.assert.rejects(
        () => new GlideMotion(t.stage, [
          [10, 10, 0],
          [30, 10, 0],
        ]).perform(),
        { name: 'Error', message: /hit-test missed/i }
      )
    })

    await t.test('dispatches pointercancel then leave then touchcancel', async t => {
      const dispatched = t.mockListen([
        'pointerover',
        'pointerenter',
        'pointerdown',
        'touchstart',
        'gotpointercapture',
        'pointercancel',
        'pointerout',
        'pointerleave',
        'touchcancel',
      ])

      await new GlideMotion(t.stage, [
        [10, 10, 0],
        [30, 10, 0],
      ]).perform().catch(() => null)

      t.assert.eventSequence(dispatched, [
        'pointerover@a',
        'pointerenter@HTML',
        'pointerenter@BODY',
        'pointerenter@stage',
        'pointerenter@a',
        'pointerdown@a',
        'touchstart@a',
        'gotpointercapture@a',
        'pointercancel@a',
        'pointerout@a',
        'pointerleave@a',
        'pointerleave@stage',
        'pointerleave@BODY',
        'pointerleave@HTML',
        'touchcancel@a',
      ])
    })
  })
})

