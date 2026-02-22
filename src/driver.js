import { Font } from './font.js'
import {
  frameDelay,
  IosMouseProfile,
  IosPenProfile,
  IosTouchProfile,
  SyntheticDualTouch,
  SyntheticKeyboard,
  SyntheticMouse,
  SyntheticPointer,
  SyntheticTouch,
} from './synthetic.js'
import { STEP } from './timing.js'

const delay = ms =>
  new Promise(r => setTimeout(r, ms))

const lerp = (a, b, t) => a + (b - a) * t

let nextId =
  Math.floor(1_000_000_000 + Math.random() * 1_000_000_000)
const pointerId = () => nextId++

const SESSION =
  `pd-${Math.random().toString(36).slice(2, 8)}`

const isNum = n =>
  typeof n === 'number' &&
  Number.isFinite(n)

const isPosInt = n =>
  Number.isInteger(n) && n > 0

const toStroke = points => {
  if (!Array.isArray(points) || !points.length)
    throw new TypeError('points must be a non-empty array')

  let lastT = -Infinity

  return points.map((p, i) => {
    if (!Array.isArray(p) || p.length !== 3)
      throw new TypeError(
        'points must be [[x, y, t], ...]'
      )

    const [x, y, t] = p

    if (!isNum(x) || !isNum(y) || !isNum(t))
      throw new TypeError(
        'points must be [[x, y, t], ...] numbers'
      )

    if (t < lastT)
      throw new RangeError(
        'point timestamps must be nondecreasing'
      )

    lastT = t

    return { x, y, createdAt: t }
  })
}

const PEN = {
  type: 'pen', label: 'stroke',
  touch: true
}

const FINGER = {
  type: 'touch', label: 'glide',
  touch: true
}

const MOUSE = {
  type: 'mouse', label: 'drag',
  touch: false
}

class BreakGlass {
  static events = [
    'pointerdown', 'pointermove', 'pointerup',
    'pointercancel',
    'gotpointercapture', 'lostpointercapture',
    'pointerover', 'pointerenter',
    'pointerout', 'pointerleave',
    'mousedown', 'mousemove', 'mouseup',
    'touchstart', 'touchmove', 'touchend',
    'touchcancel',
    'keydown', 'keyup'
  ]

  #container
  #el
  #timer
  #handler

  constructor(container) {
    this.#container = container

    const r = container.getBoundingClientRect()
    const el = document.createElement('div')

    el.id =
      `pd-${Math.random().toString(36).slice(2, 10)}`
    el.className = SESSION

    el.textContent =
      'element is under automated control'

    el.style.cssText = [
      'position: fixed',
      `top: ${r.top}px`,
      `left: ${r.left}px`,
      `width: ${r.width}px`,
      `height: ${r.height}px`,
      'z-index: 2147483647',
      'background: light-dark(' +
        'rgba(230, 119, 0, 0.06), ' +
        'rgba(230, 119, 0, 0.04))',
      'display: flex',
      'align-items: flex-end',
      'justify-content: flex-start',
      'padding: 10px',
      'box-sizing: border-box',
      'color-scheme: light dark',
      'font: 100 10px/1 system-ui, sans-serif',
      'color: #e67700',
      'user-select: none',
      'opacity: 0',
      'transition: opacity 1.5s',
    ].join(';')

    document.body.appendChild(el)
    requestAnimationFrame(() => {
      el.style.opacity = '1'
    })

    this.#el = el
    this.#handler = () => this.#reset()

    for (const name of BreakGlass.events)
      container.addEventListener(
        name, this.#handler, { passive: true }
      )

    this.#reset()
  }

  get el() { return this.#el }

  #reset() {
    clearTimeout(this.#timer)
    this.#timer =
      setTimeout(() => this.#teardown(), 2000)
  }

  #teardown() {
    for (const name of BreakGlass.events)
      this.#container.removeEventListener(
        name, this.#handler
      )

    this.#el.style.opacity = '0'
    this.#el.addEventListener(
      'transitionend', () => {
        this.#el.remove()
        this.#el = null
      },
      { once: true }
    )
  }
}

class PointerDriver {
  #strokes
  #container
  #id
  #len
  #lastEl
  #pointer
  #touch
  #mouse
  #kbd
  #captured

  #src
  #strokeIdx
  #font
  #fontUrl
  #glass

  constructor(container, src, opts) {
    if (
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    )
      throw new Error(
        'PointerDriver requires a browser environment'
      )

    const el = typeof container === 'string'
      ? document.querySelector(container)
      : container

    if (!(el instanceof Element))
      throw new TypeError(
        typeof container === 'string'
          ? `no element matches "${container}"`
          : `expected element or selector, ` +
            `got ${typeof container}`
      )

    this.#container = el

    if (
      src != null &&
      typeof src === 'object' &&
      !Array.isArray(src)
    ) {
      opts = src
      src = null
    }

    const { font } = opts ?? {}

    if (font != null) {
      if (typeof font !== 'string')
        throw new TypeError(
          `font must be a URL string, ` +
          `got ${typeof font}`
        )

      this.#fontUrl = font
    }

    if (typeof src === 'string')
      this.#src = src
    else if (Array.isArray(src))
      this.#strokes = src
    else if (src != null)
      throw new TypeError(
        `expected strokes or URL, ` +
        `got ${typeof src}`
      )

    this.#lastEl = null
    this.#kbd = new SyntheticKeyboard()
  }

  #engage() {
    if (!this.#glass?.el)
      this.#glass = new BreakGlass(this.#container)
  }

  #at(point) {
    const glass = this.#glass?.el

    if (glass) glass.style.display = 'none'

    const el =
      document.elementFromPoint(point.x, point.y)

    if (glass) glass.style.display = ''

    if (!el || !this.#container.contains(el))
      throw new RangeError(
        `point (${point.x}, ${point.y}) ` +
        `is outside container`
      )

    return el
  }

  #pick(point) {
    try {
      return this.#at(point)
    } catch (err) {
      if (this.#lastEl) return this.#lastEl
      throw err
    }
  }

  async #load() {
    if (this.#strokes) return this.#strokes

    if (!this.#src) return this.#rose()

    const res = await fetch(this.#src)

    if (!res.ok)
      throw new Error(`${this.#src}: ${res.status}`)

    this.#strokes = await res.json()

    return this.#strokes
  }

  #rose() {
    const rect = this.#container.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const radius =
      Math.min(rect.width, rect.height) * 0.4

    const petals = [2, 3, 4, 5, 6, 7]
    const steps = [
      29, 31, 37, 41, 43, 47,
      53, 59, 61, 67, 71, 73, 79, 83, 89, 97
    ]

    const pick = arr =>
      arr[Math.floor(Math.random() * arr.length)]

    const k = pick(petals)
    const d = pick(steps)
    const n = 361

    const pts = Array.from({ length: n }, (_, i) => {
      const theta = i * d * Math.PI / 180
      const r = radius * Math.sin(k * theta)

      return {
        x: cx + r * Math.cos(theta),
        y: cy + r * Math.sin(theta),
        createdAt: i * STEP
      }
    })

    return [pts]
  }

  async #trace(text, opts = {}) {
    if (!this.#font) {
      if (!this.#fontUrl)
        throw new Error('no font provided')

      this.#font = await Font.from(this.#fontUrl)
    }

    const fontSize = opts.fontSize ?? parseFloat(
      getComputedStyle(this.#container).fontSize
    )

    if (opts.x != null || opts.y != null)
      return this.#font.trace(text, { fontSize, ...opts })

    const strokes = this.#font.trace(
      text, { x: 0, y: 0, fontSize }
    )

    if (!strokes.length) return strokes

    const rect =
      this.#container.getBoundingClientRect()
    const b = this.#bounds(strokes)

    const dx =
      rect.left + (rect.width - b.w) / 2 - b.x
    const dy =
      rect.top + (rect.height - b.h) / 2 - b.y

    for (const s of strokes)
      for (const pt of s) {
        pt.x += dx
        pt.y += dy
      }

    return strokes
  }

  #bounds(strokes) {
    let x0 = Infinity, y0 = Infinity
    let x1 = -Infinity, y1 = -Infinity

    for (const s of strokes)
      for (const pt of s) {
        if (pt.x < x0) x0 = pt.x
        if (pt.y < y0) y0 = pt.y
        if (pt.x > x1) x1 = pt.x
        if (pt.y > y1) y1 = pt.y
      }

    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }

  #center() {
    const r = this.#container.getBoundingClientRect()

    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2
    }
  }

  async #dual(frames, label) {
    this.#engage()

    const f0 = frames[0]
    const target = this.#at(f0.a)
    this.#at(f0.b)

    const pA = new SyntheticPointer({
      pointerId: pointerId(),
      isPrimary: true,
      profile: new IosTouchProfile()
    })

    const pB = new SyntheticPointer({
      pointerId: pointerId(),
      isPrimary: false,
      profile: new IosTouchProfile()
    })

    const touch = new SyntheticDualTouch({ a: pA, b: pB })

    pA.over(target, f0.a, 0, frames.length, { buttons: 1 })
    pA.enter(target, f0.a, 0, frames.length, { buttons: 1 })
    pA.down(target, f0.a, 0, frames.length)

    pB.over(target, f0.b, 0, frames.length, { buttons: 1 })
    pB.enter(target, f0.b, 0, frames.length, { buttons: 1 })
    pB.down(target, f0.b, 0, frames.length)

    touch.start(target, f0.a, f0.b)
    pA.gotCapture(target)
    pB.gotCapture(target)

    let lastEl = target
    let lastA = f0.a
    let lastB = f0.b
    let err = null

    try {
      for (let i = 1; i < frames.length; i++) {
        await frameDelay()

        const f = frames[i]
        const el = this.#at(f.a)
        this.#at(f.b)

        pA.move(el, f.a, i, frames.length)
        pB.move(el, f.b, i, frames.length)
        touch.move(el, f.a, f.b)

        lastEl = el
        lastA = f.a
        lastB = f.b
      }
    } catch (e) {
      err = e
    }

    if (err) {
      pA.cancel(lastEl, lastA, frames.length - 1, frames.length)
      pB.cancel(lastEl, lastB, frames.length - 1, frames.length)
    } else {
      pA.up(lastEl, lastA, frames.length - 1, frames.length)
      pB.up(lastEl, lastB, frames.length - 1, frames.length)
      pA.lostCapture(lastEl)
      pB.lostCapture(lastEl)
    }

    pA.out(lastEl, lastA, frames.length - 1, frames.length)
    pA.leave(lastEl, lastA, frames.length - 1, frames.length)
    pB.out(lastEl, lastB, frames.length - 1, frames.length)
    pB.leave(lastEl, lastB, frames.length - 1, frames.length)
    touch.end(lastEl, lastA, lastB, !!err)

    if (err)
      throw new Error(
        `${label} aborted: ${err.message}`,
        { cause: err }
      )
  }

  async *#timed(pts) {
    yield pts[0]

    for (let i = 1; i < pts.length; i++) {
      await delay(
        pts[i].createdAt - pts[i - 1].createdAt
      )
      yield pts[i]
    }
  }

  #down(pt, device) {
    const target = this.#at(pt)
    this.#lastEl = target

    this.#pointer.over(target, pt, 0, this.#len, { buttons: 1 })
    this.#pointer.enter(target, pt, 0, this.#len, { buttons: 1 })
    this.#pointer.down(target, pt, 0, this.#len)

    this.#mouse.down(target, pt)

    if (this.#touch) {
      this.#touch.start(target, pt)
      if (device.type === 'touch') {
        this.#pointer.gotCapture(target)
        this.#captured = true
      }
    }
  }

  #move(pt, i, device) {
    const target = this.#at(pt)
    const prev = this.#lastEl
    this.#lastEl = target

    if (prev && prev !== target) {
      this.#pointer.out(prev, pt, i, this.#len, {
        buttons: 1,
        relatedTarget: target,
        toElement: target,
      })

      this.#pointer.leave(prev, pt, i, this.#len, {
        buttons: 1,
        relatedTarget: target,
        toElement: target,
      })

      this.#pointer.over(target, pt, i, this.#len, {
        buttons: 1,
        relatedTarget: prev,
        fromElement: prev,
      })

      this.#pointer.enter(target, pt, i, this.#len, {
        buttons: 1,
        relatedTarget: prev,
        fromElement: prev,
      })
    }

    this.#pointer.move(target, pt, i, this.#len)
    this.#mouse.move(target, pt)

    if (this.#touch)
      this.#touch.move(target, pt)
  }

  #end(pt, device, cancel = false) {
    const target = this.#pick(pt)

    if (cancel) {
      this.#pointer.cancel(target, pt, this.#len - 1, this.#len)
    } else {
      this.#pointer.up(target, pt, this.#len - 1, this.#len)
      if (this.#captured) this.#pointer.lostCapture(target)
    }

    this.#pointer.out(target, pt, this.#len - 1, this.#len)
    this.#pointer.leave(target, pt, this.#len - 1, this.#len)

    if (this.#touch)
      cancel
        ? this.#touch.cancel(target, pt)
        : this.#touch.end(target, pt)

    this.#mouse.up(target, pt)

    this.#lastEl = null
    this.#captured = false
  }

  async #replay(pts, device) {
    this.#id = pointerId()
    this.#len = pts.length
    let i = 0
    let last = null
    this.#lastEl = null
    let err = null

    const profile =
      device.type === 'pen'
        ? new IosPenProfile()
        : device.type === 'touch'
          ? new IosTouchProfile()
          : new IosMouseProfile()

    this.#pointer = new SyntheticPointer({
      pointerId: this.#id,
      profile,
      isPrimary: true
    })

    this.#mouse = new SyntheticMouse()
    this.#touch = device.touch
      ? new SyntheticTouch({
        identifier: this.#id,
        radius: profile.radius
      })
      : null

    this.#captured = false

    try {
      for await (const pt of this.#timed(pts)) {
        last = pt

        i === 0
          ? this.#down(pt, device)
          : this.#move(pt, i, device)
        i++
      }
    } catch (e) {
      err = e
    } finally {
      if (this.#lastEl && last)
        this.#end(last, device, !!err)
    }

    if (err)
      throw new Error(
        `${device.label} ${this.#strokeIdx} ` +
        `aborted: ${err.message}`,
        { cause: err }
      )
  }

  async #run(input, opts, device) {
    this.#engage()

    const strokes = typeof input === 'string'
      ? await this.#trace(input, opts)
      : Array.isArray(input)
        ? [toStroke(input)]
        : await this.#load()

    const items = []
    const hasPaper =
      typeof paper !== 'undefined' &&
      paper.project?.activeLayer
    const before = hasPaper
      ? paper.project.activeLayer.children.length
      : 0

    for (let s = 0; s < strokes.length; s++) {
      const pts = strokes[s]
      this.#strokeIdx = s + 1

      if (s > 0) {
        const prev = strokes[s - 1].at(-1)
        await delay(
          pts[0].createdAt - prev.createdAt
        )
      }

      await this.#replay(pts, device)

      if (hasPaper) {
        const kids =
          paper.project.activeLayer.children

        if (kids.length > before + items.length)
          items.push(kids.at(-1))
      }
    }

    return items
  }

  async stroke(text, opts) {
    return this.#run(text, opts, PEN)
  }

  async glide(text, opts) {
    return this.#run(text, opts, FINGER)
  }

  async drag(text, opts) {
    return this.#run(text, opts, MOUSE)
  }

  async pinch(
    scale,
    { x, y, distance = 100, steps = 20 } = {}
  ) {
    if (!isPosInt(steps))
      throw new RangeError('steps must be a positive integer')

    const c = x != null
      ? { x, y }
      : this.#center()

    const frames = Array.from(
      { length: steps + 1 },
      (_, i) => {
        const t = i / steps
        const d = distance * lerp(1, scale, t) / 2

        return {
          a: { x: c.x - d, y: c.y },
          b: { x: c.x + d, y: c.y }
        }
      }
    )

    return this.#dual(frames, 'pinch')
  }

  async swipe(
    dx, dy,
    { x, y, spread = 50, steps = 20 } = {}
  ) {
    if (!isPosInt(steps))
      throw new RangeError('steps must be a positive integer')

    const c = x != null
      ? { x, y }
      : this.#center()

    const frames = Array.from(
      { length: steps + 1 },
      (_, i) => {
        const t = i / steps
        const ox = dx * t
        const oy = dy * t

        return {
          a: {
            x: c.x + ox,
            y: c.y - spread / 2 + oy
          },
          b: {
            x: c.x + ox,
            y: c.y + spread / 2 + oy
          }
        }
      }
    )

    return this.#dual(frames, 'swipe')
  }

  async twist(
    degrees = 45,
    { x, y, radius = 80, steps = 20 } = {}
  ) {
    if (!isPosInt(steps))
      throw new RangeError('steps must be a positive integer')

    const c = x != null
      ? { x, y }
      : this.#center()

    const rad = degrees * Math.PI / 180

    const frames = Array.from(
      { length: steps + 1 },
      (_, i) => {
        const t = i / steps
        const angle = rad * t

        return {
          a: {
            x: c.x + Math.cos(angle) * radius,
            y: c.y + Math.sin(angle) * radius
          },
          b: {
            x: c.x + Math.cos(angle + Math.PI) * radius,
            y: c.y + Math.sin(angle + Math.PI) * radius
          }
        }
      }
    )

    return this.#dual(frames, 'twist')
  }

  async keycombo(groups, { delay: gap = 1000 } = {}) {
    this.#engage()

    return this.#kbd.combo(
      this.#container,
      groups,
      { delay: gap }
    )
  }

  press(keys) {
    this.#engage()
    this.#kbd.press(this.#container, keys)
    return this
  }

  release(keys) {
    this.#engage()
    this.#kbd.release(this.#container, keys)
    return this
  }
}

export { PointerDriver }
