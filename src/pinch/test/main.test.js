import { test } from 'node:test'
import { mockDOM, mockListen } from '#test/utils'
import { IosTouchPointer } from '#pointer'
import { PinchMotion } from '../index.js'

class TestTouchPointer extends IosTouchPointer {
  constructor(opts) {
    super({ ...opts, id: opts.primary ? 1 : 2 })
  }
}

const testPlatform = { touch: TestTouchPointer }

test('PinchMotion', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM, mockListen }).mockDOM())

  await t.test('steps non-positive', async t => {
    await t.test('throws RangeError', t => {
      const stage = document.createElement('div')

      t.assert.throws(
        () => new PinchMotion(stage, 2, { x: 20, y: 20, steps: 0 }),
        { name: 'RangeError', message: /steps/i }
      )
    })
  })

  await t.test('2-finger pinch within element', async t => {
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

    await t.test('dispatches 2 pointerdown events', async t => {
      const dispatched = t.mockListen(['pointerdown'])

      await new PinchMotion(t.stage, 2, {
        x: 20,
        y: 20,
        distance: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.strictEqual(dispatched.length, 2)
    })

    await t.test('pointerdown uses different targets and IDs', async t => {
      const dispatched = t.mockListen(['pointerdown'])

      await new PinchMotion(t.stage, 2, {
        x: 20,
        y: 20,
        distance: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.deepStrictEqual(
        dispatched.map(e => ({ id: e.pointerId, target: e.target })),
        [{ id: 1, target: 'a' }, { id: 2, target: 'b' }]
      )
    })

    await t.test('dispatches gotpointercapture for each pointer before its first move', async t => {
      const dispatched = t.mockListen([
        'gotpointercapture',
        'pointermove',
      ])

      await new PinchMotion(t.stage, 2, {
        x: 20,
        y: 20,
        distance: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      const aCapture = dispatched.findIndex(e =>
        e.type === 'gotpointercapture' && e.pointerId === 1
      )

      const bCapture = dispatched.findIndex(e =>
        e.type === 'gotpointercapture' && e.pointerId === 2
      )

      const aMove = dispatched.findIndex(e =>
        e.type === 'pointermove' && e.pointerId === 1
      )

      const bMove = dispatched.findIndex(e =>
        e.type === 'pointermove' && e.pointerId === 2
      )

      t.assert.ok(
        aCapture >= 0 &&
        aMove >= 0 &&
        aCapture < aMove &&
        bCapture >= 0 &&
        bMove >= 0 &&
        bCapture < bMove
      )
    })

    await t.test('touchstart fires once per finger', async t => {
      const dispatched = t.mockListen(['touchstart'])

      await new PinchMotion(t.stage, 2, {
        x: 20,
        y: 20,
        distance: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.strictEqual(dispatched.length, 2)
    })

    await t.test('second touchstart includes both touches', async t => {
      const dispatched = t.mockListen(['touchstart'])

      await new PinchMotion(t.stage, 2, {
        x: 20,
        y: 20,
        distance: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.deepStrictEqual(dispatched[1].touches?.map(t => t.id), [1, 2])
    })

    await t.test('gesturestart begins at scale 1 and rotation 0', async t => {
      const dispatched = t.mockListen(['gesturestart'])

      await new PinchMotion(t.stage, 2, {
        x: 20,
        y: 20,
        distance: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.deepStrictEqual(
        { target: dispatched[0].target, scale: dispatched[0].scale, rotation: dispatched[0].rotation },
        { target: 'a', scale: 1, rotation: 0 }
      )
    })

    await t.test('second gesturestart values match first gesturechange', async t => {
      const dispatched = t.mockListen([
        'gesturestart',
        'gesturechange',
      ])

      await new PinchMotion(t.stage, 2, {
        x: 20,
        y: 20,
        distance: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      const [, bStart] = dispatched.filter(e => e.type === 'gesturestart')
      const [firstChange] = dispatched.filter(e => e.type === 'gesturechange')

      t.assert.deepStrictEqual(
        { scale: bStart.scale, rotation: bStart.rotation },
        { scale: firstChange.scale, rotation: firstChange.rotation }
      )
    })

    await t.test('gestureend is dispatched on both targets', async t => {
      const dispatched = t.mockListen(['gestureend'])

      await new PinchMotion(t.stage, 2, {
        x: 20,
        y: 20,
        distance: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.deepStrictEqual(dispatched.map(e => e.target), ['b', 'a'])
    })

    await t.test('first touchend happens while 1 touch remains', async t => {
      const dispatched = t.mockListen(['touchend'])

      await new PinchMotion(t.stage, 2, {
        x: 20,
        y: 20,
        distance: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.strictEqual(dispatched[0].touches?.length, 1)
    })

    await t.test('last touchend resets scale and rotation', async t => {
      const dispatched = t.mockListen(['touchend'])

      await new PinchMotion(t.stage, 2, {
        x: 20,
        y: 20,
        distance: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.deepStrictEqual(
        { scale: dispatched[1].scale, rotation: dispatched[1].rotation },
        { scale: 1, rotation: 0 }
      )
    })
  })

  await t.test('hit-test miss mid-gesture', async t => {
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

      document.elementFromPoint = x => {
        if (x > 27) return null
        return x < 20 ? t.a : t.b
      }
    })

    await t.test('rejects with hit-test missed error', async t => {
      await t.assert.rejects(
        () => new PinchMotion(t.stage, 2, {
          x: 20,
          y: 20,
          distance: 10,
          steps: 2,
          platform: testPlatform,
        }).perform(),
        { name: 'Error', message: /hit-test missed/i }
      )
    })

    await t.test('dispatches pointercancel and touchcancel for both contacts', async t => {
      const dispatched = t.mockListen([
        'pointercancel',
        'touchcancel',
      ])

      await new PinchMotion(t.stage, 2, {
        x: 20,
        y: 20,
        distance: 10,
        steps: 2,
        platform: testPlatform,
      }).perform().catch(() => null)

      t.assert.deepStrictEqual(
        dispatched.map(e => `${e.type}@${e.target}`),
        [
          'pointercancel@a',
          'touchcancel@a',
          'pointercancel@b',
          'touchcancel@b',
        ]
      )
    })
  })
})
