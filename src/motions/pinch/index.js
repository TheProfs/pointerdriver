import { Motion } from '../../motion/index.js'

const lerp = (a, b, t) =>
  a + (b - a) * t

const computeGesture = (a, b, base) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dist = Math.hypot(dx, dy)

  const scale = dist / base.dist
  const rotation = (Math.atan2(dy, dx) - base.angle) * (180 / Math.PI)

  return { scale, rotation }
}

const frameDelay = () =>
  new Promise(resolve => requestAnimationFrame(() => resolve()))

export class PinchMotion extends Motion {
  #scale
  #center
  #distance
  #steps

  constructor(el, scale, opts = {}) {
    const { x, y, distance = 100, steps = 20, ...rest } = opts
    super(el, rest)

    if (typeof scale !== 'number' || !Number.isFinite(scale))
      throw new TypeError('PinchMotion.scale must be a finite number')

    if (scale <= 0)
      throw new RangeError('PinchMotion.scale must be > 0')

    if (typeof x !== 'number' || !Number.isFinite(x))
      throw new TypeError('PinchMotion.x must be a finite number')

    if (typeof y !== 'number' || !Number.isFinite(y))
      throw new TypeError('PinchMotion.y must be a finite number')

    if (typeof distance !== 'number' || !Number.isFinite(distance))
      throw new TypeError('PinchMotion.distance must be a finite number')

    if (distance <= 0)
      throw new RangeError('PinchMotion.distance must be > 0')

    if (!Number.isInteger(steps) || steps <= 0)
      throw new RangeError('PinchMotion.steps must be positive integer')

    this.#scale = scale
    this.#center = { x, y }
    this.#distance = distance
    this.#steps = steps
  }

  get device() { return 'touch' }

  async perform() {
    const scale = this.#scale
    const center = this.#center
    const distance = this.#distance
    const steps = this.#steps

    const pos = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps
      const d = (distance * lerp(1, scale, t)) / 2

      return [
        { x: center.x - d, y: center.y },
        { x: center.x + d, y: center.y },
      ]
    })

    const n = pos.length

    const a0 = this.hit(pos[0][0])
    const b0 = this.hit(pos[0][1])

    const a = this.pointer({ primary: true })
    const b = this.pointer({ primary: false })

    const base = {
      dist: Math.hypot(pos[0][1].x - pos[0][0].x, pos[0][1].y - pos[0][0].y),
      angle: Math.atan2(pos[0][1].y - pos[0][0].y, pos[0][1].x - pos[0][0].x),
    }

    let gesture = { scale: 1, rotation: 0 }
    let lastPos = pos[0]
    let gestureStarted = false
    let gestureEnded = false

    try {
      a.enter(a0, pos[0][0])
      a.down(a0, pos[0][0], 0, n)
      this.touchstart(a, pos[0][0], { scale: 1, rotation: 0 })

      this.gesturestart(a0, { scale: 1, rotation: 0 })
      gestureStarted = true

      b.enter(b0, pos[0][1])
      b.down(b0, pos[0][1], 0, n)
      this.touchstart(b, pos[0][1], { scale: 1, rotation: 0 })

      a.capture(a0)
      b.capture(b0)

      for (let i = 1; i < n; i++) {
        await frameDelay()

        this.hit(pos[i][0])
        this.hit(pos[i][1])

        lastPos = pos[i]
        gesture = computeGesture(pos[i][0], pos[i][1], base)

        a.move(a0, pos[i][0], i, n)
        this.touchmove(a, pos[i][0], gesture)

        b.move(b0, pos[i][1], i, n)
        this.touchmove(b, pos[i][1], gesture)

        if (i === 1) {
          this.gesturestart(b0, gesture)
          this.gesturechange(a0, gesture)
        } else {
          this.gesturechange(b0, gesture)
          this.gesturechange(a0, gesture)
        }
      }

      this.gestureend(b0, gesture)
      this.gestureend(a0, gesture)
      gestureEnded = true

      a.up(a0, pos[n - 1][0], n - 1, n)
      a.release(a0)
      a.leave(a0, pos[n - 1][0])

      this.touchend(a, pos[n - 1][0], gesture)

      b.up(b0, pos[n - 1][1], n - 1, n)
      b.release(b0)
      b.leave(b0, pos[n - 1][1])

      this.touchend(b, pos[n - 1][1], { scale: 1, rotation: 0 })
    } catch (err) {
      if (gestureStarted && !gestureEnded) {
        this.gestureend(b0, gesture)
        this.gestureend(a0, gesture)
      }

      a.cancel(a0, lastPos[0])
      this.touchcancel(a, lastPos[0])

      b.cancel(b0, lastPos[1])
      this.touchcancel(b, lastPos[1])

      throw new Error(
        `pinch aborted: ${err?.message ?? String(err)}`,
        { cause: err }
      )
    }
  }
}
