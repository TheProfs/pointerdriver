import { webkit } from '#pointer'

export class Motion {
  #el
  #platform
  #touches = new Map()

  constructor(el, opts = {}) {
    if (!(el instanceof Element))
      throw new TypeError('Motion.el must be an Element')

    if (opts === null || typeof opts !== 'object')
      throw new TypeError('Motion.opts must be an object')

    const { platform = webkit } = opts

    this.#el = el
    this.#platform = platform
  }

  get el() { return this.#el }
  get platform() { return this.#platform }
  get device() { throw new Error('Motion.device must be implemented') }

  static normalizePoints(name, raw) {
    const pointsKey = `${name}.points`

    if (!Array.isArray(raw))
      throw new TypeError(`${pointsKey} must be [x, y, ms][]`)

    const points = raw.map((p, i) => {
      if (!Array.isArray(p) || p.length !== 3)
        throw new TypeError(`${pointsKey}[${i}] must be [x, y, ms]`)

      const [x, y, ms] = p

      if (
        ![x, y, ms]
          .every(n => typeof n === 'number' && Number.isFinite(n))
      )
        throw new TypeError(`${pointsKey}[${i}] must contain finite numbers`)

      if (ms < 0)
        throw new RangeError(`${pointsKey}[${i}][2] must be >= 0`)

      return { x, y, ms }
    })

    for (let i = 1; i < points.length; i++) {
      if (points[i].ms < points[i - 1].ms)
        throw new RangeError(
          `${pointsKey}[${i}][2] must be >= ${pointsKey}[${i - 1}][2]`
        )
    }

    return points
  }

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
    if (!ms)
      return Promise.resolve()

    return new Promise(resolve =>
      setTimeout(resolve, ms)
    )
  }

  touchstart(pointer, point, gesture = { scale: 1, rotation: 0 }) {
    const target = pointer.target
    if (!pointer.emitsTouch || !target)
      return

    this.#touches.set(pointer.id, { pointer, target, point })

    const changed = pointer.touch(target, point)

    this.#dispatchTouch('touchstart', target, changed, gesture)
  }

  touchsync(pointer, point) {
    if (!pointer.emitsTouch)
      return

    const entry = this.#touches.get(pointer.id)
    if (!entry)
      return

    entry.point = point
  }

  touchmove(pointer, point, gesture = { scale: 1, rotation: 0 }) {
    if (!pointer.emitsTouch)
      return

    const entry = this.#touches.get(pointer.id)
    if (!entry)
      return

    entry.point = point

    const changed = pointer.touch(entry.target, point)

    this.#dispatchTouch('touchmove', entry.target, changed, gesture)
  }

  touchend(pointer, point, gesture = { scale: 1, rotation: 0 }) {
    if (!pointer.emitsTouch)
      return

    const entry = this.#touches.get(pointer.id)
    if (!entry)
      return

    const changed = pointer.touch(entry.target, point)

    this.#touches.delete(pointer.id)

    this.#dispatchTouch('touchend', entry.target, changed, gesture)
  }

  touchcancel(pointer, point, gesture = { scale: 1, rotation: 0 }) {
    if (!pointer.emitsTouch)
      return

    const entry = this.#touches.get(pointer.id)
    if (!entry)
      return

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
      return

    const points =
      [...this.#touches.values()]
        .map(entry => entry.point)
        .filter(Boolean)

    const coords = points.length
      ? (() => {
        const clientX = points.reduce((sum, p) => sum + p.x, 0) / points.length
        const clientY = points.reduce((sum, p) => sum + p.y, 0) / points.length

        const win = target.ownerDocument?.defaultView ?? globalThis.window
        const scrollX = typeof win?.scrollX === 'number' ? win.scrollX : 0
        const scrollY = typeof win?.scrollY === 'number' ? win.scrollY : 0

        return {
          clientX,
          clientY,
          pageX: clientX + scrollX,
          pageY: clientY + scrollY,
        }
      })()
      : {}

    target.dispatchEvent(new Event(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      ...coords,
      scale,
      rotation,
    }))
  }
}
