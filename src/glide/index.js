import { Motion } from '#motion'

export class GlideMotion extends Motion {
  #points

  constructor(el, points, opts) {
    super(el, opts)
    this.#points = Motion.normalizePoints(this.constructor.name, points)
  }

  get device() { return 'touch' }

  async perform() {
    const points = this.#points
    if (!points.length)
      return

    const pointer = this.pointer({ primary: true })

    const target = this.hit(points[0])
    let point = points[0]

    pointer.enter(target, point)
    pointer.down(target, point, 0, points.length)

    try {
      pointer.capture(target)
      this.touchstart(pointer, point)

      for (let i = 1; i < points.length; i++) {
        await this.delay(points[i].ms - points[i - 1].ms)

        this.hit(points[i])
        point = points[i]

        pointer.move(target, point, i, points.length)
        this.touchmove(pointer, point)
      }

      pointer.up(target, point, points.length - 1, points.length)
      pointer.release(target, points.length - 1, points.length)
      pointer.leave(target, point, points.length - 1, points.length)

      this.touchend(pointer, point)
    } catch (err) {
      pointer.cancel(target, point)
      this.touchcancel(pointer, point)
      throw new Error(
        `glide aborted: ${err?.message ?? String(err)}`,
        { cause: err }
      )
    }
  }
}
