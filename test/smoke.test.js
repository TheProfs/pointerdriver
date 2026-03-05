import { test } from 'node:test'
import { mockDOM } from '#test/utils'

import {
  DragMotion,
  GlideMotion,
  StrokeMotion,
  PinchMotion,
  TwistMotion,
  SwipeMotion,
  Font,
  Glass,
} from '../index.js'

test('smoke', async t => {
  t.beforeEach(t => Object.assign(t, { mockDOM }).mockDOM())

  await t.test('all exports are constructable', t => {
    const el = document.body.appendChild(
      document.createElement('div')
    )

    t.assert.ok(new DragMotion(el, [[0, 0, 0]]))
    t.assert.ok(new GlideMotion(el, [[0, 0, 0]]))
    t.assert.ok(new StrokeMotion(el, [[0, 0, 0]]))
    t.assert.ok(new PinchMotion(el, 2, { x: 0, y: 0 }))
    t.assert.ok(new TwistMotion(el, 45, { x: 0, y: 0 }))
    t.assert.ok(new SwipeMotion(el, 50, { x: 0, y: 0 }))
    t.assert.ok(new Glass())
    t.assert.ok(Font)
  })
})
