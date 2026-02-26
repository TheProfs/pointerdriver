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

const eventDefaults = type => ({
  pointerover: { bubbles: true, cancelable: true, composed: true },
  pointerenter: { bubbles: false, cancelable: false, composed: false },
  pointerdown: { bubbles: true, cancelable: true, composed: true },
  pointermove: { bubbles: true, cancelable: true, composed: true },
  pointerup: { bubbles: true, cancelable: true, composed: true },
  pointerout: { bubbles: true, cancelable: true, composed: true },
  pointerleave: { bubbles: false, cancelable: false, composed: false },
  pointercancel: { bubbles: true, cancelable: true, composed: true },
  gotpointercapture: { bubbles: true, cancelable: false, composed: true },
  lostpointercapture: { bubbles: true, cancelable: false, composed: true },
})[type] ?? { bubbles: true, cancelable: true, composed: true }

const clamp = (min, max, n) =>
  Math.min(max, Math.max(min, n))

const rand01 = seed => {
  let t = (seed + 0x6d2b79f5) >>> 0
  t = Math.imul(t ^ t >>> 15, t | 1)
  t ^= t + Math.imul(t ^ t >>> 7, t | 61)
  return ((t ^ t >>> 14) >>> 0) / 4294967296
}

const phase = seed =>
  rand01(seed) * Math.PI * 2

const drift = (min, max, t, phi) =>
  min + (max - min) * ((Math.sin(Math.PI * 2 * t + phi) + 1) / 2)

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

    if (target !== this.#target) {
      this.#target = target
      this.#path = pathOf(target)
    }

    this.#dispatch('gotpointercapture', target, this.#lastPoint ?? null, {
      bubbles: true,
    })
  }

  release(target) {
    if (!this.#captureTarget) return

    this.#captureTarget = null

    this.#dispatch('lostpointercapture', target, this.#lastPoint ?? null, {
      bubbles: true,
    })
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

    const defaults = eventDefaults(type)

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
      type === 'pointermove'
        ? this.#movement(point)
        : {}

    const init = { ...defaults, ...base, ...coords, ...props, ...movement, ...extra }

    target.dispatchEvent(new Event(type, init))

    if (point)
      this.#lastPoint = point
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

export class PenPointer extends Pointer {
  get type() { return 'pen' }
  get emitsTouch() { return true }

  props(i, total) {
    return {
      width: 0.5,
      height: 0.5,
      pressure: 0.5,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      altitudeAngle: 1,
      azimuthAngle: 0.6,
    }
  }

  touch(target, point) {
    const Touch = globalThis.Touch
    if (typeof Touch !== 'function')
      throw new Error('Touch is not available in this environment')

    const { width, height } = this.props(0, 1)

    return new Touch({
      identifier: this.id,
      target,
      clientX: point.x,
      clientY: point.y,
      pageX: point.x,
      pageY: point.y,
      screenX: point.x,
      screenY: point.y,
      radiusX: width / 2,
      radiusY: height / 2,
      rotationAngle: 0,
      force: 0,
    })
  }
}

export class IosPenPointer extends PenPointer {
  props(i, total) {
    const t = total <= 1 ? 0 : i / (total - 1)
    const seed = this.id

    const pressureBase =
      0.08 + 0.52 * (Math.sin(Math.PI * t) ** 8)

    const noise =
      (rand01(seed + 10_000 + i * 101) - 0.5) * 0.04

    const pressure =
      clamp(0.08, 0.6, pressureBase + noise)

    return {
      width: 0.5,
      height: 0.5,
      pressure,
      tiltX: drift(22, 35, t, phase(seed + 1)),
      tiltY: drift(20, 30, t, phase(seed + 2)),
      tangentialPressure: 0,
      twist: 0,
      altitudeAngle: drift(0.86, 1.04, t, phase(seed + 3)),
      azimuthAngle: drift(0.47, 0.83, t, phase(seed + 4)),
    }
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

export class TouchPointer extends Pointer {
  get type() { return 'touch' }
  get emitsTouch() { return true }
  get implicitCapture() { return true }

  props(i, total) {
    return {
      width: 42,
      height: 42,
      pressure: 0,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      altitudeAngle: Math.PI / 2,
      azimuthAngle: 0,
    }
  }

  touch(target, point) {
    const Touch = globalThis.Touch
    if (typeof Touch !== 'function')
      throw new Error('Touch is not available in this environment')

    const { width, height } = this.props(0, 1)

    return new Touch({
      identifier: this.id,
      target,
      clientX: point.x,
      clientY: point.y,
      pageX: point.x,
      pageY: point.y,
      screenX: point.x,
      screenY: point.y,
      radiusX: width / 2,
      radiusY: height / 2,
      rotationAngle: 0,
      force: 0,
    })
  }
}

export class IosTouchPointer extends TouchPointer {
  props(i, total) {
    return {
      ...super.props(i, total),
      width: 41.72413777559996,
      height: 41.72413777559996,
    }
  }
}

export const webkit = {
  pen: IosPenPointer,
  mouse: IosMousePointer,
  touch: IosTouchPointer,
}
