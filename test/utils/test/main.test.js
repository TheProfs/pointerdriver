import { test } from 'node:test'
import { mockDOM, mockListen } from '#test/utils'

test('mockListen', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM, mockListen }).mockDOM())

  await t.test('captures dispatched events in order', async t => {
    const el = document.body.appendChild(
      Object.assign(document.createElement('div'), { id: 'el' })
    )

    const dispatched = t.mockListen(['pointerdown', 'pointermove'])

    el.dispatchEvent(new PointerEvent('pointerdown', {
      pointerId: 1, pointerType: 'mouse',
    }))

    el.dispatchEvent(new PointerEvent('pointermove', {
      pointerId: 1, pointerType: 'mouse',
    }))

    t.assert.deepStrictEqual(
      dispatched.map(e => e.type),
      ['pointerdown', 'pointermove']
    )
  })
})
