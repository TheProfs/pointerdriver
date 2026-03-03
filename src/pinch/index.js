import { GestureMotion } from '#gesture'

const lerp = (a, b, t) =>
  a + (b - a) * t

export class PinchMotion extends GestureMotion {
  #scale
  #distance

  constructor(el, scale, opts = {}) {
    const name = new.target.name

    if (opts === null || typeof opts !== 'object')
      throw new TypeError(`${name}.opts must be an object`)

    const { distance = 100, ...rest } = opts
    super(el, rest)

    if (typeof scale !== 'number' || !Number.isFinite(scale))
      throw new TypeError(`${name}.scale must be a finite number`)

    if (scale <= 0)
      throw new RangeError(`${name}.scale must be > 0`)

    if (typeof distance !== 'number' || !Number.isFinite(distance))
      throw new TypeError(`${name}.distance must be a finite number`)

    if (distance <= 0)
      throw new RangeError(`${name}.distance must be > 0`)

    this.#scale = scale
    this.#distance = distance
  }

  positions() {
    const { x, y } = this.center
    const steps = this.steps
    const scale = this.#scale
    const distance = this.#distance

    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps
      const d = (distance * lerp(1, scale, t)) / 2

      return [
        { x: x - d, y },
        { x: x + d, y },
      ]
    })
  }
}
