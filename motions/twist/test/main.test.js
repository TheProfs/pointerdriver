import { test } from 'node:test'
import { mockDOM, mockListen } from '#test/utils'
import { IosTouchPointer } from '#pointer'
import { TwistMotion } from '../index.js'

class TestTouchPointer extends IosTouchPointer {
  constructor(opts) {
    super({ ...opts, id: opts.primary ? 1 : 2 })
  }
}

const testPlatform = { touch: TestTouchPointer }

test('TwistMotion', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM, mockListen }).mockDOM())

  await t.test('steps non-positive', async t => {
    await t.test('throws RangeError', t => {
      const stage = document.createElement('div')

      t.assert.throws(
        () => new TwistMotion(stage, 45, { x: 20, y: 20, steps: 0 }),
        { name: 'RangeError', message: /steps/i }
      )
    })
  })

  await t.test('2-finger twist within element', async t => {
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

      document.elementFromPoint = x => (x < 20 ? t.b : t.a)
    })

    await t.test('dispatches 2 pointerdown events', async t => {
      const dispatched = t.mockListen(['pointerdown'])

      await new TwistMotion(t.stage, 45, {
        x: 20,
        y: 20,
        radius: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.strictEqual(dispatched.length, 2)
    })

    await t.test('pointerdown uses different targets and IDs', async t => {
      const dispatched = t.mockListen(['pointerdown'])

      await new TwistMotion(t.stage, 45, {
        x: 20,
        y: 20,
        radius: 10,
        steps: 3,
        platform: testPlatform,
      }).perform()

      t.assert.deepStrictEqual(
        dispatched.map(e => ({ id: e.pointerId, target: e.target })),
        [{ id: 1, target: 'a' }, { id: 2, target: 'b' }]
      )
    })

    await t.test('clockwise degrees yields positive rotation', async t => {
      const dispatched = t.mockListen(['gestureend'])

      await new TwistMotion(t.stage, 45, {
        x: 20,
        y: 20,
        radius: 10,
        steps: 2,
        platform: testPlatform,
      }).perform()

      t.assert.ok(
        dispatched.some(e => e.target === 'a' && e.rotation > 0)
      )
    })

    await t.test('counterclockwise degrees yields negative rotation', async t => {
      const dispatched = t.mockListen(['gestureend'])

      await new TwistMotion(t.stage, -45, {
        x: 20,
        y: 20,
        radius: 10,
        steps: 2,
        platform: testPlatform,
      }).perform()

      t.assert.ok(
        dispatched.some(e => e.target === 'a' && e.rotation < 0)
      )
    })

    await t.test('positions follow rotation geometry', async t => {
      const dispatched = t.mockListen(['touchmove'])

      await new TwistMotion(t.stage, 45, {
        x: 20,
        y: 20,
        radius: 10,
        steps: 2,
        platform: testPlatform,
      }).perform()

      const angle = (45 * Math.PI) / 180 * (1 / 2)

      const expected = [
        { x: 20 + Math.cos(angle) * 10, y: 20 + Math.sin(angle) * 10 },
        {
          x: 20 + Math.cos(angle + Math.PI) * 10,
          y: 20 + Math.sin(angle + Math.PI) * 10,
        },
      ]

      t.assert.deepStrictEqual(
        dispatched
          .slice(0, 2)
          .map(e => ({
            id: e.changedTouches[0].id,
            x: e.changedTouches[0].x,
            y: e.changedTouches[0].y,
          })),
        [
          { id: 1, x: expected[0].x, y: expected[0].y },
          { id: 2, x: expected[1].x, y: expected[1].y },
        ]
      )
    })

    await t.test('gesturestart begins at scale 1 and rotation 0', async t => {
      const dispatched = t.mockListen(['gesturestart'])

      await new TwistMotion(t.stage, 45, {
        x: 20,
        y: 20,
        radius: 10,
        steps: 2,
        platform: testPlatform,
      }).perform()

      t.assert.deepStrictEqual(
        {
          target: dispatched[0].target,
          scale: dispatched[0].scale,
          rotation: dispatched[0].rotation,
        },
        { target: 'a', scale: 1, rotation: 0 }
      )
    })

    await t.test('second gesturestart begins at scale 1 and rotation 0', async t => {
      const dispatched = t.mockListen(['gesturestart'])

      await new TwistMotion(t.stage, 45, {
        x: 20,
        y: 20,
        radius: 10,
        steps: 2,
        platform: testPlatform,
      }).perform()

      const [, bStart] = dispatched

      t.assert.deepStrictEqual(
        {
          target: bStart.target,
          scale: bStart.scale,
          rotation: bStart.rotation,
        },
        { target: 'b', scale: 1, rotation: 0 }
      )
    })

    await t.test('gestureend is dispatched on both targets', async t => {
      const dispatched = t.mockListen(['gestureend'])

      await new TwistMotion(t.stage, 45, {
        x: 20,
        y: 20,
        radius: 10,
        steps: 2,
        platform: testPlatform,
      }).perform()

      t.assert.deepStrictEqual(dispatched.map(e => e.target), ['a', 'b'])
    })

    await t.test('last touchend resets scale and rotation', async t => {
      const dispatched = t.mockListen(['touchend'])

      await new TwistMotion(t.stage, 45, {
        x: 20,
        y: 20,
        radius: 10,
        steps: 2,
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
        if (y > 20) return null
        return x < 20 ? b : a
      }

      const warn = t.mock.method(console, 'warn')

      await new TwistMotion(stage, 45, {
        x: 20,
        y: 20,
        radius: 10,
        steps: 2,
        platform: testPlatform,
      }).perform()

      t.assert.ok(warn.mock.callCount() >= 1)
      t.assert.match(warn.mock.calls[0].arguments[0], /hit-test missed/i)
    })
  })
})
