import { PathMotion } from '#path'

export class GlideMotion extends PathMotion {
  get device() { return 'touch' }

  async perform() {
    await this.resolve()

    for (const points of this.strokes) {
      if (!points.length)
        continue

      const pointer = this.pointer({ primary: true })
      const n = points.length

      const target = this.hit(points[0])
      let point = points[0]

      pointer.enter(target, point)
        .down(target, point, 0, n)

      try {
        pointer.capture(target)
        this.touchstart(pointer, point)

        for (let i = 1; i < n; i++) {
          await this.delay(points[i].ms - points[i - 1].ms)

          this.hit(points[i])
          point = points[i]

          pointer.move(target, point, i, n)
          this.touchmove(pointer, point)
        }

        pointer.up(target, point, n - 1, n)
          .release(target, n - 1, n)
          .leave(target, point, n - 1, n)

        this.touchend(pointer, point)
      } catch (err) {
        pointer.cancel(target, point)
        this.touchcancel(pointer, point)
        throw new Error(`glide aborted: ${err?.message ?? String(err)}`, { cause: err })
      }
    }
  }
}
