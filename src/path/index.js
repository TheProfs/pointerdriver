import { Motion } from '#motion'
import { Font } from '#font'

const FREQ = 60

let cached = null

const defaultFont = () =>
  cached ??= Font.load(
    new URL('../../fonts/hershey-script.svg', import.meta.url).href
  )

const segmentLengths = points =>
  points.slice(1).map((p, i) =>
    Math.hypot(p[0] - points[i][0], p[1] - points[i][1])
  )

const interpolate = (waypoints, offsetX, offsetY, velocity) => {
  const lengths = segmentLengths(waypoints)
  const total = lengths.reduce((a, b) => a + b, 0)

  if (total === 0)
    return [{ x: waypoints[0][0] + offsetX, y: waypoints[0][1] + offsetY, ms: 0 }]

  const duration = total / velocity
  const frames = Math.max(1, Math.round(duration * FREQ))

  return Array.from({ length: frames + 1 }, (_, f) => {
    const t = f / frames
    let dist = t * total
    let seg = 0

    while (seg < lengths.length - 1 && dist > lengths[seg]) {
      dist -= lengths[seg]
      seg++
    }

    const ratio = lengths[seg] > 0 ? dist / lengths[seg] : 0
    const [ax, ay] = waypoints[seg]
    const [bx, by] = waypoints[seg + 1]

    return {
      x: ax + (bx - ax) * ratio + offsetX,
      y: ay + (by - ay) * ratio + offsetY,
      ms: f * (1000 / FREQ),
    }
  })
}

export class PathMotion extends Motion {
  #strokes
  #pending

  constructor(el, input, opts = {}) {
    const name = new.target.name

    if (typeof input === 'string') {
      const { font, size, x, y, ...rest } = opts
      super(el, rest)

      if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0)
        throw new TypeError(`${name}.size must be a finite number > 0`)

      if (typeof x !== 'number' || !Number.isFinite(x))
        throw new TypeError(`${name}.x must be a finite number`)

      if (typeof y !== 'number' || !Number.isFinite(y))
        throw new TypeError(`${name}.y must be a finite number`)

      this.#pending = { text: input, font, size, x, y }
      this.#strokes = null
    } else {
      super(el, opts)
      this.#strokes = [Motion.normalizePoints(name, input)]
      this.#pending = null
    }
  }

  get strokes() { return this.#strokes }

  async resolve() {
    if (this.#strokes)
      return

    const { text, font: fontOpt, size, x, y } = this.#pending

    const font =
      fontOpt instanceof Font ? fontOpt
        : typeof fontOpt === 'string' ? await Font.load(fontOpt)
        : await defaultFont()

    const velocity = size * 4

    this.#strokes = font
      .layout(text, { size })
      .map(waypoints => interpolate(waypoints, x, y, velocity))
  }
}
