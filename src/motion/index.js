import { webkit } from '../pointer/index.js'

export class Motion {
  #el
  #platform

  constructor(el, { platform = webkit } = {}) {
    if (!(el instanceof Element))
      throw new TypeError('Motion.el must be an Element')

    this.#el = el
    this.#platform = platform
  }

  get el() { return this.#el }
  get platform() { return this.#platform }
  get device() { throw new Error('Motion.device must be implemented') }

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
    if (!ms) return Promise.resolve()

    return new Promise(resolve =>
      setTimeout(resolve, ms)
    )
  }
}
