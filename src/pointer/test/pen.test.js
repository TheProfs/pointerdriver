import { test } from 'node:test'
import { mockDOM } from '#test/utils'
import { IosPenPointer, PenPointer } from '../index.js'

test('PenPointer', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM }).mockDOM())

  await t.test('#props', async t => {
    await t.test('returns pressure, tilt, and angles', t => {
      const props = new PenPointer({ primary: true }).props(0, 1)

      t.assert.ok([
        'pressure',
        'tiltX',
        'tiltY',
        'altitudeAngle',
        'azimuthAngle',
      ].every(k => typeof props[k] === 'number'))
    })

    await t.test('returns 0.5×0.5 contact', t => {
      const props = new PenPointer({ primary: true }).props(0, 1)

      t.assert.deepStrictEqual(
        { width: props.width, height: props.height },
        { width: 0.5, height: 0.5 }
      )
    })

    await t.test('IosPenPointer pressure within expected range', t => {
      const pointer = new IosPenPointer({ primary: true })

      const pressures = [0, 5, 10].map(i =>
        pointer.props(i, 11).pressure
      )

      t.assert.ok(pressures.every(p => p >= 0.08 && p <= 0.6))
    })
  })

  await t.test('#touch', async t => {
    await t.test('returns Touch object', t => {
      const el = document.createElement('div')
      const pointer = new PenPointer({ primary: true })

      const touch = pointer.touch(el, { x: 10, y: 20 })

      t.assert.partialDeepStrictEqual(touch, {
        identifier: pointer.id,
        target: el,
        clientX: 10,
        clientY: 20,
        radiusX: 0.25,
        radiusY: 0.25,
      })
    })
  })
})

