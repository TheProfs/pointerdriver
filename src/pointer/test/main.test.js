import { test } from 'node:test'
import { mockDOM, mockListen } from '#test/utils'
import { MousePointer } from '../index.js'

test('Pointer', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM, mockListen }).mockDOM())

  t.beforeEach(t => Object.assign(t, {
    el: document.body.appendChild(
      Object.assign(document.createElement('div'), { id: 'el' })
    ),
    other: document.body.appendChild(
      Object.assign(document.createElement('div'), { id: 'other' })
    ),
  }))

  await t.test('#enter', async t => {
    t.beforeEach(t => {
      t.pointer = new MousePointer({ primary: true })
    })

    await t.test('single element', async t => {
      await t.test('emits pointerover and pointerenter path', t => {
        const dispatched = t.mockListen(['pointerover', 'pointerenter'])

        t.pointer.enter(t.el, { x: 10, y: 10 })

        t.assert.eventSequence(dispatched, [
          'pointerover@el',
          'pointerenter@HTML',
          'pointerenter@BODY',
          'pointerenter@el',
        ])
      })

      await t.test('sets target', t => {
        t.pointer.enter(t.el, { x: 10, y: 10 })

        t.assert.strictEqual(t.pointer.target, t.el)
      })
    })
  })

  await t.test('#move', async t => {
    t.beforeEach(t => {
      t.pointer = new MousePointer({ primary: true })
    })

    await t.test('new sibling target', async t => {
      await t.test('emits transition events', t => {
        const dispatched = t.mockListen([
          'pointerout',
          'pointerleave',
          'pointerover',
          'pointerenter',
          'pointermove',
        ])

        t.pointer.enter(t.el, { x: 10, y: 10 })

        t.pointer.move(t.other, { x: 11, y: 12 }, 1, 2)

        t.assert.eventSequence(dispatched, [
          'pointerover@el',
          'pointerenter@HTML',
          'pointerenter@BODY',
          'pointerenter@el',
          'pointerout@el',
          'pointerleave@el',
          'pointerover@other',
          'pointerenter@other',
          'pointermove@other',
        ])
      })

      await t.test('updates target', t => {
        t.pointer.enter(t.el, { x: 10, y: 10 })
        t.pointer.move(t.other, { x: 11, y: 12 }, 1, 2)

        t.assert.strictEqual(t.pointer.target, t.other)
      })
    })
  })

  await t.test('#capture', async t => {
    t.beforeEach(t => {
      t.pointer = new MousePointer({ primary: true })
    })

    await t.test('active capture', async t => {
      await t.test('dispatches pointermove on capture target', t => {
        const dispatched = t.mockListen([
          'pointerout',
          'pointerleave',
          'pointerover',
          'pointerenter',
          'pointermove',
        ])

        const start = { x: 10, y: 10 }

        t.pointer.enter(t.el, start)
        t.pointer.down(t.el, start, 0, 2)
        t.pointer.capture(t.el)
        dispatched.length = 0

        t.pointer.move(t.other, { x: 11, y: 12 }, 1, 2)

        t.assert.eventSequence(dispatched, ['pointermove@el'])
      })
    })
  })

  await t.test('#leave', async t => {
    t.beforeEach(t => {
      t.pointer = new MousePointer({ primary: true })
    })

    await t.test('after enter', async t => {
      await t.test('emits pointerout and pointerleave path', t => {
        const dispatched = t.mockListen(['pointerout', 'pointerleave'])

        t.pointer.enter(t.el, { x: 10, y: 10 })
        t.pointer.leave(t.el, { x: 10, y: 10 })

        t.assert.eventSequence(dispatched, [
          'pointerout@el',
          'pointerleave@el',
          'pointerleave@BODY',
          'pointerleave@HTML',
        ])
      })

      await t.test('resets target', t => {
        t.pointer.enter(t.el, { x: 10, y: 10 })
        t.pointer.leave(t.el, { x: 10, y: 10 })

        t.assert.strictEqual(t.pointer.target, null)
      })
    })
  })
})
