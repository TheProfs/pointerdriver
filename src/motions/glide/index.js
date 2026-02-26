import { Motion } from '../../motion/index.js'

const normalizePoints = raw => {
  if (!Array.isArray(raw))
    throw new TypeError('GlideMotion.points must be [x, y, ms][]')

  const points = raw.map((p, i) => {
    if (!Array.isArray(p) || p.length !== 3)
      throw new TypeError(`points[${i}] must be [x, y, ms]`)

    const [x, y, createdAt] = p

    if (
      ![x, y, createdAt]
        .every(n => typeof n === 'number' && Number.isFinite(n))
    )
      throw new TypeError(`points[${i}] must contain finite numbers`)

    if (createdAt < 0)
      throw new RangeError(`points[${i}][2] must be >= 0`)

    return { x, y, createdAt }
  })

  for (let i = 1; i < points.length; i++) {
    if (points[i].createdAt < points[i - 1].createdAt)
      throw new RangeError(
        `points[${i}][2] must be >= points[${i - 1}][2]`
      )
  }

  return points
}

export class GlideMotion extends Motion {
  #points

  constructor(el, points, opts) {
    super(el, opts)
    this.#points = normalizePoints(points)
  }

  get device() { return 'touch' }

  async perform() {
    const points = this.#points
    if (!points.length) return

    const pointer = this.pointer({ primary: true })

    const target = this.hit(points[0])
    let point = points[0]

    pointer.enter(target, point)
    pointer.down(target, point, 0, points.length)

    try {
      this.touchstart(pointer, point)
      pointer.capture(target)

      for (let i = 1; i < points.length; i++) {
        await this.delay(points[i].createdAt - points[i - 1].createdAt)

        this.hit(points[i])
        point = points[i]

        pointer.move(target, point, i, points.length)
        this.touchmove(pointer, point)
      }

      pointer.up(target, point, points.length - 1, points.length)
      pointer.release(target)
      pointer.leave(target, point)

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
