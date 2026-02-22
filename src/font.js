import { GAP, LIFT, STEP } from './timing.js'

const SEGMENTS = 10

const cubic = (a, b, c, d, n) =>
  Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n
    const u = 1 - t

    return {
      x: u*u*u*a.x + 3*u*u*t*b.x +
        3*u*t*t*c.x + t*t*t*d.x,
      y: u*u*u*a.y + 3*u*u*t*b.y +
        3*u*t*t*c.y + t*t*t*d.y
    }
  })

const nums = raw =>
  raw
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)

export const parsePath = d => {
  const tokens = d.match(/[MLCZ][^MLCZ]*/g)

  if (!tokens) return []

  const strokes = []
  let pts = []
  let start = null
  let x = 0
  let y = 0

  for (const token of tokens) {
    const cmd = token[0]
    const n = nums(token.slice(1))

    if (cmd === 'M') {
      if (pts.length) strokes.push(pts)
      x = n[0]
      y = n[1]
      pts = [{ x, y }]
      start = { x, y }

      for (let i = 2; i + 1 < n.length; i += 2) {
        x = n[i]
        y = n[i + 1]
        pts.push({ x, y })
      }
    }

    if (cmd === 'L') {
      for (let i = 0; i + 1 < n.length; i += 2) {
        x = n[i]
        y = n[i + 1]
        pts.push({ x, y })
      }
    }

    if (cmd === 'C') {
      for (let i = 0; i + 5 < n.length; i += 6) {
        pts.push(...cubic(
          { x, y },
          { x: n[i], y: n[i + 1] },
          { x: n[i + 2], y: n[i + 3] },
          { x: n[i + 4], y: n[i + 5] },
          SEGMENTS
        ))

        x = n[i + 4]
        y = n[i + 5]
      }
    }

    if (cmd === 'Z') {
      if (pts.length) strokes.push(pts)
      pts = []
      if (start) {
        x = start.x
        y = start.y
      }
      start = null
    }
  }

  if (pts.length) strokes.push(pts)

  return strokes
}

export class Font {
  #glyphs
  #em
  #advance

  constructor(glyphs, em, advance) {
    this.#glyphs = glyphs
    this.#em = em
    this.#advance = advance
  }

  static async from(url) {
    const res = await fetch(url)

    if (!res.ok)
      throw new Error(`${url}: ${res.status}`)

    const xml = await res.text()
    const doc = new DOMParser()
      .parseFromString(xml, 'image/svg+xml')

    const face = doc.querySelector('font-face')
    const el = doc.querySelector('font')

    if (!face || !el)
      throw new Error(`${url}: invalid SVG font`)

    const emRaw = face.getAttribute('units-per-em')

    if (!emRaw)
      throw new Error(`${url}: units-per-em missing`)

    const em = +emRaw
    const advance = +(
      el.getAttribute('horiz-adv-x') ?? em
    )

    const glyphs = new Map()

    for (const g of doc.querySelectorAll('glyph')) {
      const ch = g.getAttribute('unicode')
      if (!ch) continue

      const d = g.getAttribute('d')

      glyphs.set(ch, {
        advance: +(
          g.getAttribute('horiz-adv-x') ?? advance
        ),
        strokes: d ? parsePath(d) : []
      })
    }

    return new Font(glyphs, em, advance)
  }

  trace(text, { x = 0, y = 0, fontSize = 20 } = {}) {
    const scale = fontSize / this.#em
    let cursor = x
    let time = 0
    const strokes = []

    for (const ch of text) {
      const glyph = this.#glyphs.get(ch)

      if (!glyph) {
        cursor += this.#advance * scale
        continue
      }

      for (const raw of glyph.strokes) {
        if (strokes.length) time += LIFT

        strokes.push(raw.map((pt, i) => ({
          x: cursor + pt.x * scale,
          y: y - pt.y * scale,
          createdAt: time + i * STEP
        })))

        time += (raw.length - 1) * STEP
      }

      time += GAP
      cursor += glyph.advance * scale
    }

    return strokes
  }
}
