import { JSDOM } from 'jsdom'
import { assert } from 'node:test'

assert.register('eventSequence', function(actual, expected, message) {
  this.assert.deepStrictEqual(
    actual.map(e => `${e.type}@${e.target}`),
    expected,
    message
  )
})

const makeEvent = Base => class extends Base {
  constructor(type, init = {}) {
    super(type, init)
    for (const [k, v] of Object.entries(init))
      if (!(k in this)) this[k] = v
  }
}

const installGlobals = win => {
  const globals = {
    window: win,
    document: win.document,
    Element: win.Element,
    Event: win.Event,
    MouseEvent: win.MouseEvent,
    KeyboardEvent: win.KeyboardEvent,
    DOMParser: win.DOMParser,
    getComputedStyle: win.getComputedStyle,
    requestAnimationFrame: win.requestAnimationFrame,
    PointerEvent: makeEvent(win.MouseEvent),
    Touch: class Touch {
      constructor(init = {}) { Object.assign(this, init) }
    },
    TouchEvent: makeEvent(win.UIEvent),
    GestureEvent: makeEvent(win.Event),
  }

  const prev = new Map()

  for (const [k, v] of Object.entries(globals)) {
    prev.set(k, Object.getOwnPropertyDescriptor(globalThis, k))
    Object.defineProperty(globalThis, k, {
      value: v,
      writable: true,
      configurable: true,
    })
  }

  return () => {
    for (const [key, desc] of prev) {
      if (!desc) { delete globalThis[key]; continue }
      Object.defineProperty(globalThis, key, desc)
    }
  }
}

export function mockDOM() {
  if (this.dom) return this.dom

  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'https://example.test/',
  })

  const restore = installGlobals(dom.window)

  this.dom = {
    window: dom.window,
    document: dom.window.document,
    close: () => { dom.window.close(); restore() },
  }

  this.after(() => { this.dom.close(); this.dom = null })

  return this.dom
}

export function mockListen(types) {
  const doc = document
  const dispatched = []

  for (const type of types) {
    const handler = e => dispatched.push({
      type: e.type,
      target: e.target?.id || e.target?.tagName || null,
      pointerType: e.pointerType ?? null,
      pointerId: e.pointerId ?? null,
      isPrimary: e.isPrimary ?? null,
      hasCapture: e.hasCapture ?? null,
      movementX: e.movementX ?? null,
      movementY: e.movementY ?? null,
      scale: e.scale ?? null,
      rotation: e.rotation ?? null,
      touches: e.touches
        ? Array.from(e.touches).map(t => ({
          id: t.identifier ?? null,
          target: t.target?.id || t.target?.tagName || null,
          x: t.clientX ?? null,
          y: t.clientY ?? null,
        }))
        : null,
      targetTouches: e.targetTouches
        ? Array.from(e.targetTouches).map(t => ({
          id: t.identifier ?? null,
          target: t.target?.id || t.target?.tagName || null,
        }))
        : null,
      changedTouches: e.changedTouches
        ? Array.from(e.changedTouches).map(t => ({
          id: t.identifier ?? null,
          target: t.target?.id || t.target?.tagName || null,
          x: t.clientX ?? null,
          y: t.clientY ?? null,
        }))
        : null,
    })

    doc.addEventListener(type, handler, { capture: true })
    this.after(() => doc.removeEventListener(type, handler, { capture: true }))
  }

  return dispatched
}

export const hit = target =>
  (document.elementFromPoint = () => target, target)
