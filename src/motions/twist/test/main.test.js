import { test } from 'node:test'
import { mockDOM, mockListen } from '#test/utils'
import { IosTouchPointer } from '../../../pointer/index.js'
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

      const aEnd = dispatched.find(e => e.target === 'a')

      t.assert.ok(aEnd?.rotation > 0)
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

      const aEnd = dispatched.find(e => e.target === 'a')

      t.assert.ok(aEnd?.rotation < 0)
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
        { x: 20 + Math.cos(angle + Math.PI) * 10, y: 20 + Math.sin(angle + Math.PI) * 10 },
      ]

      t.assert.deepStrictEqual(
        dispatched
          .slice(0, 2)
          .map(e => ({ id: e.changedTouches?.[0]?.id, x: e.changedTouches?.[0]?.x, y: e.changedTouches?.[0]?.y })),
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
        { target: dispatched[0].target, scale: dispatched[0].scale, rotation: dispatched[0].rotation },
        { target: 'a', scale: 1, rotation: 0 }
      )
    })

    await t.test('second gesturestart values match first gesturechange', async t => {
      const dispatched = t.mockListen(['gesturestart', 'gesturechange'])

      await new TwistMotion(t.stage, 45, {
        x: 20,
        y: 20,
        radius: 10,
        steps: 2,
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

      await new TwistMotion(t.stage, 45, {
        x: 20,
        y: 20,
        radius: 10,
        steps: 2,
        platform: testPlatform,
      }).perform()

      t.assert.deepStrictEqual(dispatched.map(e => e.target), ['b', 'a'])
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

      document.elementFromPoint = (x, y) => {
        if (y > 20) return null
        return x < 20 ? t.b : t.a
      }
    })

    await t.test('rejects with hit-test missed error', async t => {
      await t.assert.rejects(
        () => new TwistMotion(t.stage, 45, {
          x: 20,
          y: 20,
          radius: 10,
          steps: 2,
          platform: testPlatform,
        }).perform(),
        { name: 'Error', message: /hit-test missed/i }
      )
    })

    await t.test('dispatches pointercancel and touchcancel for both contacts', async t => {
      const dispatched = t.mockListen(['pointercancel', 'touchcancel'])

      await new TwistMotion(t.stage, 45, {
        x: 20,
        y: 20,
        radius: 10,
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

