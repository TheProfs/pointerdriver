import { Motion } from '#motion'

export class StrokeMotion extends Motion {
  #points

  constructor(el, points, opts) {
    super(el, opts)
    this.#points = Motion.normalizePoints(this.constructor.name, points)
  }

  get device() { return 'pen' }

  async perform() {
    const points = this.#points
    if (!points.length)
      return

    const pointer = this.pointer({ primary: true })

    let point = points[0]
    let target = this.hit(point)
    let i = 0

    pointer.enter(target, point)
    pointer.down(target, point, 0, points.length)

    try {
      this.touchstart(pointer, point)

      for (let next = 1; next < points.length; next++) {
        await this.delay(points[next].ms - points[next - 1].ms)

        target = this.hit(points[next])
        point = points[next]

        pointer.move(target, point, next, points.length)
        this.touchmove(pointer, point)
        i = next
      }

      pointer.up(target, point, points.length - 1, points.length)
      pointer.leave(target, point, points.length - 1, points.length)

      this.touchend(pointer, point)
    } catch (err) {
      pointer.cancel(target, point, i, points.length)
      this.touchcancel(pointer, point)
      throw new Error(
        `stroke aborted: ${err?.message ?? String(err)}`,
        { cause: err }
      )
    }
  }
}
