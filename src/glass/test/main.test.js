import { test } from 'node:test'
import { mockDOM } from '#test/utils'
import { Glass } from '../index.js'

test('Glass', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM }).mockDOM())

  await t.test('#constructor', async t => {
    await t.test('appends element to document.body', t => {
      const glass = new Glass()

      t.assert.ok(
        document.querySelector('[data-glass]')
      )

      glass.remove()
    })

    await t.test('contains style, canvas, table, script', t => {
      const glass = new Glass()
      const el = document.querySelector('[data-glass]')

      t.assert.ok(el.querySelector('style'))
      t.assert.ok(el.querySelector('canvas'))
      t.assert.ok(el.querySelector('table tbody'))
      t.assert.ok(el.querySelector('script'))

      glass.remove()
    })

    await t.test('calls fn when provided', t => {
      const fn = t.mock.fn()
      const glass = new Glass(fn)

      t.assert.strictEqual(fn.mock.callCount(), 1)

      glass.remove()
    })

    await t.test('does not throw without fn', t => {
      const glass = new Glass()

      t.assert.ok(glass)

      glass.remove()
    })
  })

  await t.test('#remove', async t => {
    await t.test('removes element from document', t => {
      const glass = new Glass()
      glass.remove()

      t.assert.strictEqual(
        document.querySelector('[data-glass]'),
        null
      )
    })

    await t.test('dispatches glass:remove event', t => {
      const glass = new Glass()
      const el = document.querySelector('[data-glass]')
      const handler = t.mock.fn()

      el.addEventListener('glass:remove', handler)
      glass.remove()

      t.assert.strictEqual(handler.mock.callCount(), 1)
    })
  })
})
