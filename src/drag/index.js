import { PathMotion } from '#path'

export class DragMotion extends PathMotion {
  get device() { return 'mouse' }

  async perform() {
    await this.resolve()

    for (const points of this.strokes) {
      if (!points.length)
        continue

      const pointer = this.pointer({ primary: true })
      const n = points.length

      let point = points[0]
      let target = this.hit(point)

      pointer.enter(target, point)
        .down(target, point, 0, n)

      try {
        for (let i = 1; i < n; i++) {
          await this.delay(points[i].ms - points[i - 1].ms)

          target = this.hit(points[i])
          point = points[i]
          pointer.move(target, point, i, n)
        }

        pointer.up(target, point, n - 1, n)
          .leave(target, point, n - 1, n)
      } catch (err) {
        pointer.cancel(target, point)
        throw new Error(`drag aborted: ${err?.message ?? String(err)}`, { cause: err })
      }
    }
  }
}
