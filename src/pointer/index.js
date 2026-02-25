const pathOf = el => {
  const path = []

  for (let cur = el; cur; cur = cur.parentElement)
    path.push(cur)

  return path.reverse()
}

const prefixLen = (a, b) => {
  const n = Math.min(a.length, b.length)
  let i = 0

  while (i < n && a[i] === b[i])
    i++

  return i
}

export class Pointer {
  static id = () => {
    const { crypto } = globalThis
    if (!crypto?.getRandomValues)
      throw new Error('crypto.getRandomValues is required')

    return crypto.getRandomValues(new Uint32Array(1))[0]
  }

  #id
  #primary
  #pressed = false
  #path = []
  #target = null
  #captureTarget = null
  #lastPoint = null

  constructor({ id = Pointer.id(), primary } = {}) {
    if (typeof primary !== 'boolean')
      throw new TypeError('Pointer.primary must be boolean')

    this.#id = id
    this.#primary = primary
  }

  get id() { return this.#id }
  get target() { return this.#target }
  get type() { throw new Error('Pointer.type must be implemented') }
  get emitsTouch() { return false }
  get implicitCapture() { return false }

  props(i, total) { return {} }

  enter(target, point) {
    const next = pathOf(target)

    this.#target = target
    this.#path = next

    this.#dispatch('pointerover', target, point, { bubbles: true })

    for (const el of next)
      this.#dispatch('pointerenter', el, point, { bubbles: false })
  }

  down(target, point, i, total) {
    this.#pressed = true
    this.#target = target
    this.#lastPoint = point

    if (this.implicitCapture)
      this.#captureTarget = target

    this.#dispatch('pointerdown', target, point, {
      bubbles: true,
      button: 0,
      buttons: 1,
    }, { i, total })
  }

  move(target, point, i, total) {
    const nextTarget = this.#captureTarget ?? target

    if (!this.#captureTarget)
      this.#transition(nextTarget, point, i, total)

    this.#dispatch('pointermove', this.#captureTarget ?? this.#target, point, {
      bubbles: true,
      buttons: this.#pressed ? 1 : 0,
    }, { i, total })
  }

  up(target, point, i, total) {
    this.#pressed = false
    this.#target = this.#captureTarget ?? target

    this.#dispatch('pointerup', this.#target, point, {
      bubbles: true,
      button: 0,
      buttons: 0,
    }, { i, total })
  }

  leave(target, point) {
    if (!this.#target) return

    this.#dispatch('pointerout', this.#target, point, { bubbles: true })

    for (const el of [...this.#path].reverse())
      this.#dispatch('pointerleave', el, point, { bubbles: false })

    this.#pressed = false
    this.#path = []
    this.#target = null
    this.#captureTarget = null
    this.#lastPoint = null
  }

  cancel(target, point) {
    if (!this.#target) return

    this.#dispatch('pointercancel', this.#target, point, {
      bubbles: true,
      buttons: 0,
    })

    this.leave(target, point)
  }

  capture(target) {
    this.#captureTarget = target
    this.#dispatch('gotpointercapture', target, this.#lastPoint ?? null, {
      bubbles: true,
    })
  }

  release(target) {
    if (!this.#captureTarget) return

    this.#dispatch('lostpointercapture', target, this.#lastPoint ?? null, {
      bubbles: true,
    })

    this.#captureTarget = null
  }

  touch(target, point) { return null }

  #transition(nextTarget, point, i, total) {
    if (nextTarget === this.#target) return

    const prev = this.#path
    const next = pathOf(nextTarget)
    const common = prefixLen(prev, next)

    this.#dispatch(
      'pointerout',
      this.#target,
      point,
      { bubbles: true },
      { i, total }
    )

    for (const el of prev.slice(common).reverse())
      this.#dispatch(
        'pointerleave',
        el,
        point,
        { bubbles: false },
        { i, total }
      )

    this.#dispatch(
      'pointerover',
      nextTarget,
      point,
      { bubbles: true },
      { i, total }
    )

    for (const el of next.slice(common))
      this.#dispatch(
        'pointerenter',
        el,
        point,
        { bubbles: false },
        { i, total }
      )

    this.#path = next
    this.#target = nextTarget
  }

  #dispatch(type, target, point, extra, { i = 0, total = 1 } = {}) {
    const Event = globalThis.PointerEvent
    if (typeof Event !== 'function')
      throw new Error('PointerEvent is not available in this environment')

    const base = {
      pointerId: this.#id,
      pointerType: this.type,
      isPrimary: this.#primary,
      hasCapture: Boolean(this.#captureTarget),
    }

    const coords = point
      ? {
        clientX: point.x,
        clientY: point.y,
        pageX: point.x,
        pageY: point.y,
        screenX: point.x,
        screenY: point.y,
      }
      : {}

    const props = this.props(i, total)

    const movement =
      type === 'pointermove' && this.type === 'mouse'
        ? this.#movement(point)
        : {}

    const init = { ...base, ...coords, ...props, ...movement, ...extra }

    target.dispatchEvent(new Event(type, init))
  }

  #movement(point) {
    if (!point || !this.#lastPoint)
      return { movementX: 0, movementY: 0 }

    const movementX = point.x - this.#lastPoint.x
    const movementY = point.y - this.#lastPoint.y

    this.#lastPoint = point

    return { movementX, movementY }
  }
}

export class MousePointer extends Pointer {
  get type() { return 'mouse' }
  props(i, total) {
    return {
      width: 1,
      height: 1,
      pressure: 0,
      tiltX: 0,
      tiltY: 0,
    }
  }
}

export class IosMousePointer extends MousePointer {}

export const webkit = {
  mouse: IosMousePointer,
}
