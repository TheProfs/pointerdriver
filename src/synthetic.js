import { FRAME_MS } from './timing.js'

const coords = (x, y) => ({
  clientX: x,
  clientY: y,
  pageX: x + window.scrollX,
  pageY: y + window.scrollY,
  screenX: x,
  screenY: y,
  x,
  y,
})

const MODIFIERS = new Set([
  'Shift', 'Control', 'Alt', 'Meta'
])

const codeOf = key =>
  ({
    Shift: 'ShiftLeft',
    Control: 'ControlLeft',
    Alt: 'AltLeft',
    Meta: 'MetaLeft',
    ' ': 'Space',
  })[key] ??
  (key >= '0' && key <= '9'
    ? `Digit${key}`
    : key.length === 1
      ? `Key${key.toUpperCase()}`
      : key)

export class IosTouchProfile {
  #size

  constructor() {
    const sizes = [83.41984760016203, 104.2748082280159]
    const base = sizes[Math.random() < 0.5 ? 0 : 1]
    const jitter = (Math.random() - 0.5) * 1.5

    this.#size = Math.max(1, base + jitter)
  }

  pointer(i, total, extra = {}) {
    return {
      pointerType: 'touch',
      pressure: 0,
      webkitForce: 0,
      width: this.#size,
      height: this.#size,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      altitudeAngle: Math.PI / 2,
      azimuthAngle: 0,
      ...extra,
    }
  }

  get radius() {
    return this.#size / 2
  }
}

export class IosMouseProfile {
  pointer(i, total, extra = {}) {
    return {
      pointerType: 'mouse',
      pressure: 0,
      webkitForce: 0,
      width: 1,
      height: 1,
      tangentialPressure: 0,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      altitudeAngle: 0,
      azimuthAngle: 0,
      ...extra,
    }
  }

  get radius() {
    return 0.5
  }
}

export class IosPenProfile {
  #tiltX
  #tiltY
  #altitude
  #azimuth
  #phase

  constructor() {
    this.#tiltX = 22 + Math.random() * 13
    this.#tiltY = 20 + Math.random() * 10
    this.#altitude = 0.86 + Math.random() * 0.18
    this.#azimuth = 0.47 + Math.random() * 0.36
    this.#phase = Math.random()
  }

  pressure(i, total) {
    const t = i / (total - 1 || 1)
    const shaped = Math.pow(Math.sin(Math.PI * t), 8)
    const noise = (Math.random() - 0.5) * 0.02

    return Math.max(
      0,
      Math.min(
        0.6,
        0.08 + 0.31 * shaped + noise
      )
    )
  }

  pointer(i, total, extra = {}) {
    const t = i / (total - 1 || 1)
    const a = (t + this.#phase) * Math.PI * 2
    const pressure = this.pressure(i, total)

    return {
      pointerType: 'pen',
      pressure,
      webkitForce: pressure,
      width: 0.5,
      height: 0.5,
      tangentialPressure: 0,
      tiltX: Math.round(this.#tiltX + Math.sin(a) * 2),
      tiltY: Math.round(this.#tiltY + Math.cos(a) * 2),
      twist: 0,
      altitudeAngle: this.#altitude + Math.sin(a) * 0.05,
      azimuthAngle: this.#azimuth + Math.cos(a) * 0.05,
      ...extra,
    }
  }

  get radius() {
    return 0.25
  }
}

export class SyntheticPointer {
  #pointerId
  #isPrimary
  #profile
  #lastMove

  constructor({ pointerId, isPrimary = true, profile }) {
    this.#pointerId = pointerId
    this.#isPrimary = isPrimary
    this.#profile = profile
    this.#lastMove = null
  }

  #init(type, { x, y }, i, total, extra = {}) {
    const mx = this.#lastMove ? x - this.#lastMove.x : 0
    const my = this.#lastMove ? y - this.#lastMove.y : 0
    const movement =
      type === 'pointermove'
        ? { movementX: mx, movementY: my }
        : { movementX: 0, movementY: 0 }

    const base = {
      pointerId: this.#pointerId,
      isPrimary: this.#isPrimary,
      bubbles: true,
      cancelable: true,
      composed: true,
      relatedTarget: null,
      fromElement: null,
      toElement: null,
      ...coords(x, y),
      ...this.#profile.pointer(i, total),
      ...movement,
      type,
      view: window,
      detail: 0,
      which: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      ...extra,
    }

    return base
  }

  dispatch(target, type, point, i, total, extra) {
    const init = this.#init(type, point, i, total, extra)
    target.dispatchEvent(
      new PointerEvent(
        type,
        init
      )
    )

    if (type === 'pointermove')
      this.#lastMove = { x: point.x, y: point.y }
  }

  over(target, point, i, total, extra = {}) {
    return this.dispatch(
      target,
      'pointerover',
      point,
      i,
      total,
      { button: -1, ...extra }
    )
  }

  enter(target, point, i, total, extra = {}) {
    return this.dispatch(
      target,
      'pointerenter',
      point,
      i,
      total,
      { button: -1, bubbles: false, ...extra }
    )
  }

  down(target, point, i, total, extra = {}) {
    return this.dispatch(
      target,
      'pointerdown',
      point,
      i,
      total,
      { button: 0, buttons: 1, ...extra }
    )
  }

  move(target, point, i, total, extra = {}) {
    return this.dispatch(
      target,
      'pointermove',
      point,
      i,
      total,
      { button: -1, buttons: 1, ...extra }
    )
  }

  up(target, point, i, total, extra = {}) {
    return this.dispatch(
      target,
      'pointerup',
      point,
      i,
      total,
      { button: 0, buttons: 0, pressure: 0, webkitForce: 0, ...extra }
    )
  }

  cancel(target, point, i, total, extra = {}) {
    return this.dispatch(
      target,
      'pointercancel',
      point,
      i,
      total,
      { button: -1, buttons: 0, pressure: 0, webkitForce: 0, ...extra }
    )
  }

  out(target, point, i, total, extra = {}) {
    return this.dispatch(
      target,
      'pointerout',
      point,
      i,
      total,
      { button: -1, buttons: 0, pressure: 0, webkitForce: 0, ...extra }
    )
  }

  leave(target, point, i, total, extra = {}) {
    return this.dispatch(
      target,
      'pointerleave',
      point,
      i,
      total,
      {
        button: -1,
        buttons: 0,
        pressure: 0,
        webkitForce: 0,
        bubbles: false,
        ...extra
      }
    )
  }

  gotCapture(target) {
    return this.dispatch(
      target,
      'gotpointercapture',
      { x: 0, y: 0 },
      0,
      1,
      {
        button: 0,
        buttons: 0,
        pressure: 0,
        webkitForce: 0,
        pageX: 0,
        pageY: 0,
        screenX: 0,
        screenY: 0,
      }
    )
  }

  lostCapture(target) {
    return this.dispatch(
      target,
      'lostpointercapture',
      { x: 0, y: 0 },
      0,
      1,
      {
        button: 0,
        buttons: 0,
        pressure: 0,
        webkitForce: 0,
        pageX: 0,
        pageY: 0,
        screenX: 0,
        screenY: 0,
      }
    )
  }

  get pointerId() {
    return this.#pointerId
  }

  get radius() {
    return this.#profile.radius
  }
}

const hasTouchApi = () =>
  typeof Touch === 'function' &&
  typeof TouchEvent === 'function'

export class SyntheticTouch {
  #id
  #radius

  constructor({ identifier, radius }) {
    this.#id = identifier
    this.#radius = radius
  }

  #touch(target, { x, y }) {
    if (!hasTouchApi())
      throw new Error('Touch API unavailable')

    return new Touch({
      identifier: this.#id,
      target,
      ...coords(x, y),
      radiusX: this.#radius,
      radiusY: this.#radius,
      force: 0,
    })
  }

  #event(type, touches, changedTouches, targetTouches) {
    return new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      touches,
      changedTouches,
      targetTouches,
      view: window,
      detail: 0,
    })
  }

  start(target, point) {
    const t = this.#touch(target, point)
    target.dispatchEvent(
      this.#event('touchstart', [t], [t], [t])
    )
  }

  move(target, point) {
    const t = this.#touch(target, point)
    target.dispatchEvent(
      this.#event('touchmove', [t], [t], [t])
    )
  }

  end(target, point) {
    const t = this.#touch(target, point)
    target.dispatchEvent(
      this.#event('touchend', [], [t], [])
    )
  }

  cancel(target, point) {
    const t = this.#touch(target, point)
    target.dispatchEvent(
      this.#event('touchcancel', [], [t], [])
    )
  }
}

export class SyntheticDualTouch {
  #a
  #b

  constructor({ a, b }) {
    this.#a = a
    this.#b = b
  }

  #event(type, touches, changedTouches, targetTouches) {
    return new TouchEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      touches,
      changedTouches,
      targetTouches,
      view: window,
      detail: 0,
    })
  }

  #pair(target, pa, pb) {
    if (!hasTouchApi())
      throw new Error('Touch API unavailable')

    const ta = new Touch({
      identifier: this.#a.pointerId,
      target,
      ...coords(pa.x, pa.y),
      radiusX: this.#a.radius,
      radiusY: this.#a.radius,
      force: 0,
    })

    const tb = new Touch({
      identifier: this.#b.pointerId,
      target,
      ...coords(pb.x, pb.y),
      radiusX: this.#b.radius,
      radiusY: this.#b.radius,
      force: 0,
    })

    return { ta, tb }
  }

  start(target, pa, pb) {
    const { ta, tb } = this.#pair(target, pa, pb)

    target.dispatchEvent(
      this.#event('touchstart', [ta, tb], [ta, tb], [ta, tb])
    )
  }

  move(target, pa, pb) {
    const { ta, tb } = this.#pair(target, pa, pb)

    target.dispatchEvent(
      this.#event('touchmove', [ta, tb], [ta, tb], [ta, tb])
    )
  }

  end(target, pa, pb, cancel = false) {
    const { ta, tb } = this.#pair(target, pa, pb)

    target.dispatchEvent(
      this.#event(cancel ? 'touchcancel' : 'touchend', [], [ta, tb], [])
    )
  }
}

export class SyntheticMouse {
  #init(type, { x, y }, extra = {}) {
    return {
      ...coords(x, y),
      bubbles: true,
      cancelable: true,
      composed: true,
      ...extra,
      type,
      view: window,
      detail: 0,
      which: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    }
  }

  dispatch(target, type, point, extra) {
    target.dispatchEvent(
      new MouseEvent(type, this.#init(type, point, extra))
    )
  }

  down(target, point) {
    return this.dispatch(
      target,
      'mousedown',
      point,
      { button: 0, buttons: 1 }
    )
  }

  move(target, point) {
    return this.dispatch(
      target,
      'mousemove',
      point,
      { buttons: 1 }
    )
  }

  up(target, point) {
    return this.dispatch(
      target,
      'mouseup',
      point,
      { button: 0, buttons: 0 }
    )
  }
}

export class SyntheticKeyboard {
  #held

  constructor() {
    this.#held = new Set()
  }

  #init(type, key, held) {
    return {
      key,
      code: codeOf(key),
      shiftKey: held.has('Shift'),
      ctrlKey: held.has('Control'),
      altKey: held.has('Alt'),
      metaKey: held.has('Meta'),
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      detail: 0,
      which: 0,
      type,
    }
  }

  keydown(target, key, held) {
    target.dispatchEvent(
      new KeyboardEvent(
        'keydown',
        this.#init('keydown', key, held)
      )
    )
  }

  keyup(target, key, held) {
    target.dispatchEvent(
      new KeyboardEvent(
        'keyup',
        this.#init('keyup', key, held)
      )
    )
  }

  async combo(target, groups, { delay = 1000 } = {}) {
    for (let g = 0; g < groups.length; g++) {
      if (g > 0)
        await new Promise(r => setTimeout(r, delay))

      const keys = groups[g]
      const mods = keys.filter(k => MODIFIERS.has(k))
      const rest = keys.filter(k => !MODIFIERS.has(k))
      const ordered = [...mods, ...rest]
      const held = new Set()

      for (const key of ordered) {
        if (MODIFIERS.has(key)) held.add(key)
        this.keydown(target, key, held)
      }

      for (const key of [...ordered].reverse()) {
        if (MODIFIERS.has(key)) held.delete(key)
        this.keyup(target, key, held)
      }
    }
  }

  press(target, keys) {
    const mods = keys.filter(k => MODIFIERS.has(k))
    const rest = keys.filter(k => !MODIFIERS.has(k))

    for (const key of [...mods, ...rest]) {
      const next =
        this.#held.has(key) ? this.#held.size : this.#held.size + 1

      if (next > 6)
        throw new RangeError(
          `too many held keys ` +
          `(${next}), ` +
          `release before pressing more`
        )

      this.#held.add(key)
      this.keydown(target, key, this.#held)
    }

    return this
  }

  release(target, keys) {
    const all = keys ?? [...this.#held]
    const mods = all.filter(k => MODIFIERS.has(k))
    const rest = all.filter(k => !MODIFIERS.has(k))

    for (const key of [
      ...rest.reverse(),
      ...mods.reverse()
    ]) {
      this.#held.delete(key)
      this.keyup(target, key, this.#held)
    }

    return this
  }
}

export const frameDelay = () =>
  new Promise(r => setTimeout(r, FRAME_MS))
