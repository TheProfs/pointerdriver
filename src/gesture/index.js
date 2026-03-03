import { Motion } from '#motion'

const frameDelay = () => {
  const raf = globalThis.requestAnimationFrame
  if (typeof raf !== 'function')
    throw new Error('requestAnimationFrame is required')

  return new Promise(resolve => raf(() => resolve()))
}

export class GestureMotion extends Motion {
  #center
  #steps

  constructor(el, opts = {}) {
    const name = new.target.name

    if (opts === null || typeof opts !== 'object')
      throw new TypeError(`${name}.opts must be an object`)

    const { x, y, steps = 20, ...rest } = opts

    super(el, rest)

    if (typeof x !== 'number' || !Number.isFinite(x))
      throw new TypeError(`${name}.x must be a finite number`)

    if (typeof y !== 'number' || !Number.isFinite(y))
      throw new TypeError(`${name}.y must be a finite number`)

    if (!Number.isInteger(steps) || steps <= 0)
      throw new RangeError(`${name}.steps must be positive integer`)

    this.#center = { x, y }
    this.#steps = steps
  }

  get device() { return 'touch' }
  get center() { return this.#center }
  get steps() { return this.#steps }

  positions() {
    throw new Error('GestureMotion.positions must be implemented')
  }

  gesture(a, b, base) {
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.hypot(dx, dy)

    const scale = dist / base.dist
    const rotation =
      (Math.atan2(dy, dx) - base.angle) * (180 / Math.PI)

    return { scale, rotation }
  }

  async perform() {
    const pos = this.positions()
    const n = pos.length

    const a0 = this.hit(pos[0][0])
    const b0 = this.hit(pos[0][1])

    const a = this.pointer({ primary: true })
    const b = this.pointer({ primary: false })

    const base = {
      dist: Math.hypot(
        pos[0][1].x - pos[0][0].x,
        pos[0][1].y - pos[0][0].y
      ),
      angle: Math.atan2(
        pos[0][1].y - pos[0][0].y,
        pos[0][1].x - pos[0][0].x
      ),
    }

    let gesture = { scale: 1, rotation: 0 }
    let lastPos = pos[0]
    let gestureStarted = false
    let gestureEnded = false

    try {
      a.enter(a0, pos[0][0])
      a.down(a0, pos[0][0], 0, n)
      a.capture(a0)
      this.touchstart(a, pos[0][0], { scale: 1, rotation: 0 })

      b.enter(b0, pos[0][1])
      b.down(b0, pos[0][1], 0, n)
      b.capture(b0)
      this.touchstart(b, pos[0][1], { scale: 1, rotation: 0 })

      this.gesturestart(a0, { scale: 1, rotation: 0 })
      this.gesturestart(b0, { scale: 1, rotation: 0 })
      gestureStarted = true

      for (let i = 1; i < n; i++) {
        await frameDelay()

        this.hit(pos[i][0])
        this.hit(pos[i][1])

        lastPos = pos[i]
        gesture = this.gesture(pos[i][0], pos[i][1], base)

        a.move(a0, pos[i][0], i, n)
        b.move(b0, pos[i][1], i, n)

        this.touchsync(a, pos[i][0])
        this.touchsync(b, pos[i][1])

        this.touchmove(a, pos[i][0], gesture)
        this.touchmove(b, pos[i][1], gesture)

        this.gesturechange(a0, gesture)
        this.gesturechange(b0, gesture)
      }

      this.gestureend(a0, gesture)
      this.gestureend(b0, gesture)
      gestureEnded = true

      a.up(a0, pos[n - 1][0], n - 1, n)
      a.release(a0, n - 1, n)
      a.leave(a0, pos[n - 1][0], n - 1, n)

      this.touchend(a, pos[n - 1][0], gesture)

      b.up(b0, pos[n - 1][1], n - 1, n)
      b.release(b0, n - 1, n)
      b.leave(b0, pos[n - 1][1], n - 1, n)

      this.touchend(b, pos[n - 1][1], { scale: 1, rotation: 0 })
    } catch (err) {
      if (gestureStarted && !gestureEnded) {
        this.gestureend(a0, gesture)
        this.gestureend(b0, gesture)
      }

      a.cancel(a0, lastPos[0])
      this.touchcancel(a, lastPos[0])

      b.cancel(b0, lastPos[1])
      this.touchcancel(b, lastPos[1])

      const verb = this.constructor.name
        .replace(/Motion$/, '').toLowerCase()

      throw new Error(
        `${verb} aborted: ${err?.message ?? String(err)}`,
        { cause: err }
      )
    }
  }
}
