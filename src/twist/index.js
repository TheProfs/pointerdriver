import { GestureMotion } from '#gesture'

const wrap180 = deg =>
  (((deg + 180) % 360) + 360) % 360 - 180

export class TwistMotion extends GestureMotion {
  #degrees
  #radius

  constructor(el, degrees = 45, opts = {}) {
    const name = new.target.name

    if (opts === null || typeof opts !== 'object')
      throw new TypeError(`${name}.opts must be an object`)

    const { radius = 80, ...rest } = opts
    super(el, rest)

    if (typeof degrees !== 'number' || !Number.isFinite(degrees))
      throw new TypeError(`${name}.degrees must be a finite number`)

    if (typeof radius !== 'number' || !Number.isFinite(radius))
      throw new TypeError(`${name}.radius must be a finite number`)

    if (radius <= 0)
      throw new RangeError(`${name}.radius must be > 0`)

    this.#degrees = degrees
    this.#radius = radius
  }

  positions() {
    const { x, y } = this.center
    const steps = this.steps
    const degrees = this.#degrees
    const radius = this.#radius

    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps
      const angle = (degrees * Math.PI * t) / 180

      return [
        {
          x: x + Math.cos(angle) * radius,
          y: y + Math.sin(angle) * radius,
        },
        {
          x: x + Math.cos(angle + Math.PI) * radius,
          y: y + Math.sin(angle + Math.PI) * radius,
        },
      ]
    })
  }

  gesture(a, b, base) {
    const raw = super.gesture(a, b, base)

    return { scale: raw.scale, rotation: wrap180(raw.rotation) }
  }
}
