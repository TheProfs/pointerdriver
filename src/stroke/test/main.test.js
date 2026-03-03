import { test } from 'node:test'
import { hit, mockDOM, mockListen } from '#test/utils'
import { StrokeMotion } from '../index.js'

test('StrokeMotion', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM, mockListen }).mockDOM())

  await t.test('points with non-array input', async t => {
    await t.test('throws TypeError', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new StrokeMotion(el, null),
        { name: 'TypeError', message: /StrokeMotion\.points/i }
      )
    })
  })

  await t.test('points with negative timestamps', async t => {
    await t.test('throws RangeError', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new StrokeMotion(el, [[10, 10, -1]]),
        { name: 'RangeError', message: />= 0/i }
      )
    })
  })

  await t.test('points with decreasing timestamps', async t => {
    await t.test('throws RangeError', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new StrokeMotion(el, [
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
        () => new StrokeMotion(el, [[10, 10]]),
        { name: 'TypeError', message: /\[x, y, ms\]/i }
      )
    })

    await t.test('throws TypeError on non-finite numbers', t => {
      const el = document.createElement('div')

      t.assert.throws(
        () => new StrokeMotion(el, [[10, NaN, 0]]),
        { name: 'TypeError', message: /finite/i }
      )
    })
  })

  await t.test('pen stroke within element', async t => {
    t.beforeEach(t => Object.assign(t, {
      stage: document.body.appendChild(
        Object.assign(document.createElement('div'), { id: 'stage' })
      ),
      a: document.createElement('div'),
    }))

    t.beforeEach(t => {
      t.a.id = 'a'
      t.stage.append(t.a)
      hit(t.a)
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

      await new StrokeMotion(t.stage, [
        [10, 10, 0],
        [11, 11, 0],
      ]).perform()

      t.assert.eventSequence(dispatched, [
        'pointerover@a',
        'pointerenter@HTML',
        'pointerenter@BODY',
        'pointerenter@stage',
        'pointerenter@a',
        'pointerdown@a',
        'touchstart@a',
        'pointermove@a',
        'touchmove@a',
        'pointerup@a',
        'pointerout@a',
        'pointerleave@a',
        'pointerleave@stage',
        'pointerleave@BODY',
        'pointerleave@HTML',
        'touchend@a',
      ])
    })

    await t.test('dispatches pointermove for each point after first', async t => {
      const dispatched = t.mockListen(['pointermove'])

      await new StrokeMotion(t.stage, [
        [10, 10, 0],
        [11, 11, 0],
        [12, 12, 0],
      ]).perform()

      t.assert.strictEqual(dispatched.length, 2)
    })

    await t.test('uses pointerType pen', async t => {
      const dispatched = t.mockListen([
        'pointerover',
        'pointerenter',
        'pointerdown',
        'pointermove',
        'pointerup',
        'pointerout',
        'pointerleave',
      ])

      await new StrokeMotion(t.stage, [
        [10, 10, 0],
        [11, 11, 0],
      ]).perform()

      t.assert.ok(
        dispatched.length > 0 &&
          dispatched.every(e => e.pointerType === 'pen')
      )
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
        () => new StrokeMotion(t.stage, [
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
        'pointercancel',
        'pointerout',
        'pointerleave',
        'touchcancel',
      ])

      await new StrokeMotion(t.stage, [
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
