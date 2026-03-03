import { test } from 'node:test'
import { mockDOM } from '#test/utils'
import { IosTouchPointer, TouchPointer } from '../index.js'

test('TouchPointer', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM }).mockDOM())

  await t.test('#props', async t => {
    await t.test('returns large contact and no pressure', t => {
      const props = new TouchPointer({ primary: true }).props(0, 1)

      t.assert.ok(
        props.width > 1 &&
        props.height > 1 &&
        props.pressure === 0 &&
        props.tiltX === 0 &&
        props.tiltY === 0
      )
    })

    await t.test('IosTouchPointer contact ~42px', t => {
      const props = new IosTouchPointer({ primary: true }).props(0, 1)

      t.assert.ok(
        props.width > 40 &&
        props.width < 43 &&
        props.height > 40 &&
        props.height < 43
      )
    })
  })

  await t.test('#touch', async t => {
    await t.test('returns Touch object with correct radius', t => {
      const el = document.createElement('div')
      const pointer = new IosTouchPointer({ primary: true })
      const props = pointer.props(0, 1)

      const touch = pointer.touch(el, { x: 10, y: 20 })

      t.assert.deepStrictEqual(
        { radiusX: touch.radiusX, radiusY: touch.radiusY },
        { radiusX: props.width / 2, radiusY: props.height / 2 }
      )
    })
  })
})

