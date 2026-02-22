import { JSDOM } from 'jsdom'

const descriptorOf = (obj, key) => {
  for (let cur = obj; cur; cur = Object.getPrototypeOf(cur)) {
    const desc = Object.getOwnPropertyDescriptor(cur, key)
    if (desc) return desc
  }
  return null
}

const writable = desc =>
  !desc ||
  (Object.hasOwn(desc, 'writable')
    ? desc.writable
    : typeof desc.set === 'function')

const makeEvent = Base => {
  const skip = new Set([
    'bubbles',
    'cancelBubble',
    'cancelable',
    'composed',
    'currentTarget',
    'defaultPrevented',
    'eventPhase',
    'isTrusted',
    'returnValue',
    'srcElement',
    'target',
    'timeStamp',
    'type',
  ])

  return class extends Base {
    constructor(type, init = {}) {
      super(type, init)

      for (const [k, v] of Object.entries(init)) {
        if (skip.has(k)) continue
        const desc = descriptorOf(this, k)
        if (!writable(desc)) continue
        if (!desc) {
          Object.defineProperty(this, k, {
            value: v,
            writable: true,
            configurable: true,
            enumerable: true,
          })
        } else {
          Reflect.set(this, k, v)
        }
      }
    }
  }
}

export const withDom = async fn => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    pretendToBeVisual: true,
    url: 'https://example.test/'
  })

  const keys = [
    'window',
    'document',
    'Element',
    'Event',
    'MouseEvent',
    'KeyboardEvent',
    'DOMParser',
    'getComputedStyle',
    'requestAnimationFrame',
    'PointerEvent',
    'Touch',
    'TouchEvent',
  ]

  const prev = new Map(
    keys.map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)])
  )

  const set = (key, value) =>
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    })

  set('window', dom.window)
  set('document', dom.window.document)
  set('Element', dom.window.Element)
  set('Event', dom.window.Event)
  set('MouseEvent', dom.window.MouseEvent)
  set('KeyboardEvent', dom.window.KeyboardEvent)
  set('DOMParser', dom.window.DOMParser)
  set('getComputedStyle', dom.window.getComputedStyle)
  set(
    'requestAnimationFrame',
    dom.window.requestAnimationFrame ?? (cb => setTimeout(cb, 0))
  )

  set('PointerEvent', makeEvent(dom.window.Event))
  set('Touch', class Touch {
    constructor(init = {}) {
      Object.assign(this, init)
    }
  })
  set('TouchEvent', makeEvent(dom.window.Event))

  try {
    return await fn(dom)
  } finally {
    dom.window.close()

    for (const key of keys) {
      const desc = prev.get(key)

      if (!desc) {
        delete globalThis[key]
        continue
      }

      const current = Object.getOwnPropertyDescriptor(globalThis, key)
      if (current?.configurable === false) continue

      Object.defineProperty(globalThis, key, desc)
    }
  }
}
