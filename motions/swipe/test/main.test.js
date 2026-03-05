import { test } from 'node:test'
import { mockDOM, mockListen } from '#test/utils'
import { IosTouchPointer } from '#pointer'
import { SwipeMotion } from '../index.js'

class TestTouchPointer extends IosTouchPointer {
  constructor(opts) {
    super({ ...opts, id: opts.primary ? 1 : 2 })
  }
}

const testPlatform = { touch: TestTouchPointer }

test('SwipeMotion', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM, mockListen }).mockDOM())

  await t.test('distance non-positive', async t => {
    await t.test('throws RangeError', t => {
      const stage = document.createElement('div')

      t.assert.throws(
        () => new SwipeMotion(stage, 0, { x: 20, y: 20 }),
        { name: 'RangeError', message: /distance/i }
      )
    })
  })

  await t.test('steps non-positive', async t => {
    await t.test('throws RangeError', t => {
      const stage = document.createElement('div')

      t.assert.throws(
        () => new SwipeMotion(stage, 100, { x: 20, y: 20, steps: 0 }),
        { name: 'RangeError', message: /steps/i }
      )
    })
  })

  await t.test('2-finger swipe within element', async t => {
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

      document.elementFromPoint = (x, y) => (y < 20 ? t.a : t.b)
    })

    await t.test('dispatches 2 pointerdown events', async t => {
      const dispatched = t.mockListen(['pointerdown'])

      await new SwipeMotion(t.stage, 50, {
        x: 20,
        y: 20,
        separation: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.strictEqual(dispatched.length, 2)
    })

    await t.test('pointerdown uses different targets and IDs', async t => {
      const dispatched = t.mockListen(['pointerdown'])

      await new SwipeMotion(t.stage, 50, {
        x: 20,
        y: 20,
        separation: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.deepStrictEqual(
        dispatched.map(e => ({ id: e.pointerId, target: e.target })),
        [{ id: 1, target: 'b' }, { id: 2, target: 'a' }]
      )
    })

    await t.test('positions follow parallel displacement', async t => {
      const dispatched = t.mockListen(['touchmove'])

      await new SwipeMotion(t.stage, 60, {
        x: 20,
        y: 20,
        angle: 0,
        separation: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      const first = dispatched.slice(0, 2)
      const ax = first[0].changedTouches[0].x
      const bx = first[1].changedTouches[0].x

      t.assert.ok(
        Math.abs(ax - bx) < 0.01,
        'both fingers move equal distance along x'
      )
    })

    await t.test('gesturestart begins at scale 1 and rotation 0', async t => {
      const dispatched = t.mockListen(['gesturestart'])

      await new SwipeMotion(t.stage, 50, {
        x: 20,
        y: 20,
        separation: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.deepStrictEqual(
        dispatched.map(e => ({ scale: e.scale, rotation: e.rotation })),
        [
          { scale: 1, rotation: 0 },
          { scale: 1, rotation: 0 },
        ]
      )
    })

    await t.test('gestureend is dispatched on both targets', async t => {
      const dispatched = t.mockListen(['gestureend'])

      await new SwipeMotion(t.stage, 50, {
        x: 20,
        y: 20,
        separation: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.deepStrictEqual(dispatched.map(e => e.target), ['b', 'a'])
    })

    await t.test('last touchend resets scale and rotation', async t => {
      const dispatched = t.mockListen(['touchend'])

      await new SwipeMotion(t.stage, 50, {
        x: 20,
        y: 20,
        separation: 10,
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
    await t.test('warns once and continues', async t => {
      const stage = document.body.appendChild(
        Object.assign(document.createElement('div'), { id: 'stage' })
      )

      const a = Object.assign(document.createElement('div'), { id: 'a' })
      const b = Object.assign(document.createElement('div'), { id: 'b' })
      stage.append(a, b)

      document.elementFromPoint = (x, y) => {
        if (x > 50) return null
        return y < 20 ? a : b
      }

      const warn = t.mock.method(console, 'warn')

      await new SwipeMotion(stage, 100, {
        x: 20,
        y: 20,
        angle: 0,
        separation: 10,
        steps: 2,
        platform: testPlatform,
      }).perform()

      t.assert.ok(warn.mock.callCount() >= 1)
      t.assert.match(warn.mock.calls[0].arguments[0], /hit-test missed/i)
    })
  })
})
