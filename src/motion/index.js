import { webkit } from '../pointer/index.js'

export class Motion {
  #el
  #platform
  #touches = new Map()

  constructor(el, { platform = webkit } = {}) {
    if (!(el instanceof Element))
      throw new TypeError('Motion.el must be an Element')

    this.#el = el
    this.#platform = platform
  }

  get el() { return this.#el }
  get platform() { return this.#platform }
  get device() { throw new Error('Motion.device must be implemented') }

  pointer(opts) {
    const Ctor = this.#platform?.[this.device]
    if (!Ctor)
      throw new Error(`Platform missing device: ${this.device}`)

    return new Ctor(opts)
  }

  hit(point) {
    const target = document.elementFromPoint(point.x, point.y)

    if (!target || !this.#el.contains(target))
      throw new RangeError(
        `hit-test missed: (${point.x},${point.y}) outside element`
      )

    return target
  }

  delay(ms) {
    if (!ms) return Promise.resolve()

    return new Promise(resolve =>
      setTimeout(resolve, ms)
    )
  }

  touchstart(pointer, point, gesture = { scale: 1, rotation: 0 }) {
    const target = pointer.target
    if (!pointer.emitsTouch || !target) return

    this.#touches.set(pointer.id, { pointer, target, point })

    const changed = pointer.touch(target, point)

    this.#dispatchTouch('touchstart', target, changed, gesture)
  }

  touchmove(pointer, point, gesture = { scale: 1, rotation: 0 }) {
    if (!pointer.emitsTouch) return

    const entry = this.#touches.get(pointer.id)
    if (!entry) return

    entry.point = point

    const changed = pointer.touch(entry.target, point)

    this.#dispatchTouch('touchmove', entry.target, changed, gesture)
  }

  touchend(pointer, point, gesture = { scale: 1, rotation: 0 }) {
    if (!pointer.emitsTouch) return

    const entry = this.#touches.get(pointer.id)
    if (!entry) return

    const changed = pointer.touch(entry.target, point)

    this.#touches.delete(pointer.id)

    this.#dispatchTouch('touchend', entry.target, changed, gesture)
  }

  touchcancel(pointer, point, gesture = { scale: 1, rotation: 0 }) {
    if (!pointer.emitsTouch) return

    const entry = this.#touches.get(pointer.id)
    if (!entry) return

    const changed = pointer.touch(entry.target, point)

    this.#touches.delete(pointer.id)

    this.#dispatchTouch('touchcancel', entry.target, changed, gesture)
  }

  gesturestart(target, gesture = { scale: 1, rotation: 0 }) {
    this.#dispatchGesture('gesturestart', target, gesture)
  }

  gesturechange(target, gesture) {
    this.#dispatchGesture('gesturechange', target, gesture)
  }

  gestureend(target, gesture) {
    this.#dispatchGesture('gestureend', target, gesture)
  }

  #dispatchTouch(type, target, changed, gesture) {
    const Event = globalThis.TouchEvent
    if (typeof Event !== 'function')
      throw new Error('TouchEvent is not available in this environment')

    const touches =
      [...this.#touches.values()].map(entry =>
        entry.target === target && entry.pointer.id === changed.identifier
          ? changed
          : entry.pointer.touch(entry.target, entry.point)
      )

    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      touches,
      targetTouches: touches.filter(t => t.target === target),
      changedTouches: [changed],
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      scale: gesture.scale,
      rotation: gesture.rotation,
    }

    target.dispatchEvent(new Event(type, init))
  }

  #dispatchGesture(type, target, { scale = 1, rotation = 0 } = {}) {
    const Event = globalThis.GestureEvent
    if (typeof Event !== 'function')
      throw new Error('GestureEvent is not available in this environment')

    target.dispatchEvent(new Event(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      scale,
      rotation,
    }))
  }
}
