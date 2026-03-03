import { test } from 'node:test'
import { hit, mockDOM } from '#test/utils'
import { Motion } from '../index.js'

class FooMotion extends Motion {
  get device() { return 'mouse' }
}

class BarMotion extends Motion {
  get device() { return 'unknown' }
}

test('Motion', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM }).mockDOM())

  await t.test('#constructor', async t => {
    await t.test('el not an Element', async t => {
      await t.test('throws TypeError', t => {
        t.assert.throws(
          () => new FooMotion(null),
          { name: 'TypeError', message: /Motion\.el/i }
        )
      })
    })
  })

  await t.test('#pointer', async t => {
    await t.test('platform missing device', async t => {
      await t.test('throws Error', t => {
        const el = document.createElement('div')

        t.assert.throws(
          () => new BarMotion(el).pointer({ primary: true }),
          { name: 'Error', message: /missing device/i }
        )
      })
    })

    await t.test('platform has device', async t => {
      await t.test('returns pointer', t => {
        const el = document.createElement('div')
        const pointer = new FooMotion(el).pointer({ primary: true })

        t.assert.strictEqual(pointer.type, 'mouse')
      })
    })
  })

  await t.test('#hit', async t => {
    await t.test('hit-test within element', async t => {
      await t.test('returns hit target', t => {
        const el = document.body.appendChild(
          Object.assign(document.createElement('div'), { id: 'el' })
        )

        hit(el)

        t.assert.strictEqual(
          new FooMotion(el).hit({ x: 10, y: 10 }),
          el
        )
      })
    })

    await t.test('hit-test outside element', async t => {
      await t.test('throws RangeError', t => {
        const el = document.body.appendChild(
          Object.assign(document.createElement('div'), { id: 'el' })
        )

        hit(document.body)

        t.assert.throws(
          () => new FooMotion(el).hit({ x: 10, y: 10 }),
          { name: 'RangeError', message: /hit-test missed/i }
        )
      })
    })
  })
})
