const attr = (tag, name) => {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'))
  return match?.[1] ?? null
}

const parseD = d => {
  if (!d)
    return []

  const tokens = d.trim().split(/\s+/)
  const strokes = []
  let current = null

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]

    if (t === 'M') {
      current = [[+tokens[i + 1], +tokens[i + 2]]]
      strokes.push(current)
      i += 2
    } else if (t === 'L') {
      current?.push([+tokens[i + 1], +tokens[i + 2]])
      i += 2
    }
  }

  return strokes.filter(s => s.length > 1)
}

const parseSvg = svg => {
  const fontTag = svg.match(/<font\b[^>]*>/i)?.[0]

  if (!fontTag)
    throw new TypeError('missing <font> element')

  const faceTag = svg.match(/<font-face\b[^>]*>/i)?.[0]

  if (!faceTag)
    throw new TypeError('missing <font-face> element')

  const defaultAdvance = +(attr(fontTag, 'horiz-adv-x') || 0)
  const unitsPerEm = +(attr(faceTag, 'units-per-em') || 1000)
  const ascent = +(attr(faceTag, 'ascent') || 800)

  const glyphs = new Map()
  const re = /<glyph\b[^>]*>/gi
  let m

  while ((m = re.exec(svg))) {
    const tag = m[0]
    const unicode = attr(tag, 'unicode')

    if (unicode == null)
      continue

    glyphs.set(unicode, {
      advance: +(attr(tag, 'horiz-adv-x') || defaultAdvance),
      strokes: parseD(attr(tag, 'd')),
    })
  }

  return { unitsPerEm, ascent, defaultAdvance, glyphs }
}

export class Font {
  #meta

  constructor(meta) {
    this.#meta = meta
  }

  static from(svg) {
    return new Font(parseSvg(svg))
  }

  static async load(url) {
    const res = await fetch(url)

    if (!res.ok)
      throw new Error(`Font fetch failed: ${res.status}`)

    return Font.from(await res.text())
  }

  layout(text, { size }) {
    const { unitsPerEm, ascent, glyphs } = this.#meta
    const scale = size / unitsPerEm
    const result = []
    let cursor = 0

    for (const ch of text) {
      const glyph = glyphs.get(ch)

      if (!glyph)
        throw new TypeError(`Unknown glyph: "${ch}"`)

      for (const stroke of glyph.strokes)
        result.push(
          stroke.map(([x, y]) => [
            (x + cursor) * scale,
            (ascent - y) * scale,
          ])
        )

      cursor += glyph.advance
    }

    return result
  }
}
