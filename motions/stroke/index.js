import { PathMotion } from '#path'

export class StrokeMotion extends PathMotion {
  get device() { return 'pen' }

  async perform() {
    await this.resolve()

    for (const points of this.strokes) {
      if (!points.length)
        continue

      const pointer = this.pointer({ primary: true })
      const n = points.length

      let point = points[0]
      let target = this.hit(point)
      let i = 0

      pointer.enter(target, point)
        .down(target, point, 0, n)

      try {
        for (let next = 1; next < n; next++) {
          await this.delay(points[next].ms - points[next - 1].ms)

          target = this.hit(points[next])
          point = points[next]

          pointer.move(target, point, next, n)
          i = next
        }

        pointer.up(target, point, n - 1, n)
          .leave(target, point, n - 1, n)
      } catch (err) {
        pointer.cancel(target, point, i, n)
        throw new Error(`stroke aborted: ${err?.message ?? String(err)}`, { cause: err })
      }
    }
  }
}
