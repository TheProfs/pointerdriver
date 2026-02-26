import { test } from 'node:test'
import { mockDOM, mockListen } from '#test/utils'
import { MousePointer } from '../index.js'

test('MousePointer', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM, mockListen }).mockDOM())

  await t.test('#props', async t => {
    await t.test('returns 1×1, no pressure, no tilt', t => {
      const props = new MousePointer({ primary: true }).props(0, 1)

      t.assert.deepStrictEqual(props, {
        width: 1,
        height: 1,
        pressure: 0,
        tiltX: 0,
        tiltY: 0,
      })
    })
  })

  await t.test('#movement', async t => {
    await t.test('tracks deltas across moves', t => {
      const el = document.body.appendChild(
        Object.assign(document.createElement('div'), { id: 'el' })
      )

      const dispatched = t.mockListen(['pointermove'])

      const pointer = new MousePointer({ primary: true })

      pointer.enter(el, { x: 10, y: 10 })
      pointer.move(el, { x: 13, y: 14 }, 1, 3)
      pointer.move(el, { x: 13, y: 15 }, 2, 3)

      t.assert.deepStrictEqual(
        dispatched.map(e => ({ x: e.movementX, y: e.movementY })),
        [
          { x: 3, y: 4 },
          { x: 0, y: 1 },
        ]
      )
    })
  })

  await t.test('#touch', async t => {
    await t.test('returns null', t => {
      const el = document.createElement('div')
      const pointer = new MousePointer({ primary: true })

      t.assert.strictEqual(pointer.touch(el, { x: 10, y: 20 }), null)
    })
  })
})

