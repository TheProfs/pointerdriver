import { Motion } from '#motion'

export class DragMotion extends Motion {
  #points

  constructor(el, points, opts) {
    super(el, opts)
    this.#points = Motion.normalizePoints(this.constructor.name, points)
  }

  get device() { return 'mouse' }

  async perform() {
    const points = this.#points
    if (!points.length)
      return

    const pointer = this.pointer({ primary: true })

    let point = points[0]
    let target = this.hit(point)

    pointer.enter(target, point)
    pointer.down(target, point, 0, points.length)

    try {
      for (let i = 1; i < points.length; i++) {
        await this.delay(points[i].ms - points[i - 1].ms)

        target = this.hit(points[i])
        point = points[i]
        pointer.move(target, point, i, points.length)
      }

      pointer.up(target, point, points.length - 1, points.length)
      pointer.leave(target, point, points.length - 1, points.length)
    } catch (err) {
      pointer.cancel(target, point)
      throw new Error(
        `drag aborted: ${err?.message ?? String(err)}`,
        { cause: err }
      )
    }
  }
}
