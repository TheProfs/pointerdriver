import { GestureMotion } from '#gesture'

export class SwipeMotion extends GestureMotion {
  #distance
  #angle
  #separation

  constructor(el, distance, opts = {}) {
    const name = new.target.name

    if (opts === null || typeof opts !== 'object')
      throw new TypeError(`${name}.opts must be an object`)

    const { angle = 0, separation = 40, ...rest } = opts
    super(el, rest)

    if (typeof distance !== 'number' || !Number.isFinite(distance))
      throw new TypeError(
        `${name}.distance must be a finite number`
      )

    if (distance <= 0)
      throw new RangeError(`${name}.distance must be > 0`)

    if (typeof angle !== 'number' || !Number.isFinite(angle))
      throw new TypeError(
        `${name}.angle must be a finite number`
      )

    if (typeof separation !== 'number' || !Number.isFinite(separation))
      throw new TypeError(
        `${name}.separation must be a finite number`
      )

    if (separation <= 0)
      throw new RangeError(`${name}.separation must be > 0`)

    this.#distance = distance
    this.#angle = angle
    this.#separation = separation
  }

  positions() {
    const { x, y } = this.center
    const steps = this.steps
    const distance = this.#distance
    const rad = this.#angle * Math.PI / 180
    const sep = this.#separation / 2

    const px = -Math.sin(rad) * sep
    const py = Math.cos(rad) * sep

    return Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps
      const dx = Math.cos(rad) * distance * t
      const dy = Math.sin(rad) * distance * t

      return [
        { x: x + px + dx, y: y + py + dy },
        { x: x - px + dx, y: y - py + dy },
      ]
    })
  }
}
