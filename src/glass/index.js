const css = `
[data-glass] {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  pointer-events: none;
  color-scheme: light dark;

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  table {
    position: absolute;
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    left: calc(12px + env(safe-area-inset-left, 0px));
    border: none;
    border-collapse: collapse;
    font: 11px/1.4 system-ui, -apple-system, sans-serif;
    color: light-dark(#1d1d1f, #f5f5f7);
    background: none;
  }

  td {
    padding: 4px 10px;
    border: none;
  }

  td + td {
    border-left: 0.5px solid light-dark(
      rgba(0, 0, 0, 0.06),
      rgba(255, 255, 255, 0.06)
    );
  }

  tr + tr td {
    border-top: 0.5px solid light-dark(
      rgba(0, 0, 0, 0.06),
      rgba(255, 255, 255, 0.06)
    );
  }
}
`

const js = `;(() => {
  const el = document.querySelector('[data-glass]')
  const canvas = el.querySelector('canvas')
  const tbody = el.querySelector('tbody')
  const ctx = canvas.getContext('2d')
  const dpr = devicePixelRatio || 1

  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  ctx.scale(dpr, dpr)

  const families = [
    { name: 'pointer', color: '#0A84FF', types: [
      'pointerdown', 'pointermove', 'pointerup',
      'pointerover', 'pointerout', 'pointerenter',
      'pointerleave', 'pointercancel',
      'gotpointercapture', 'lostpointercapture'
    ]},
    { name: 'touch', color: '#30D158', types: [
      'touchstart', 'touchmove', 'touchend', 'touchcancel'
    ]},
    { name: 'gesture', color: '#BF5AF2', types: [
      'gesturestart', 'gesturechange', 'gestureend'
    ]},
    { name: 'mouse', color: '#FF9F0A', types: [
      'mousedown', 'mousemove', 'mouseup',
      'mouseover', 'mouseout', 'mouseenter', 'mouseleave'
    ]},
    { name: 'wheel', color: '#64D2FF', types: [
      'wheel'
    ]},
  ]

  const lookup = new Map()

  for (const f of families)
    for (const t of f.types)
      lookup.set(t, f)

  const counts = new Map()

  const dot = e => {
    if (e.isTrusted) return

    const f = lookup.get(e.type)
    if (!f) return

    const x = e.changedTouches?.[0]?.clientX ?? e.clientX
    const y = e.changedTouches?.[0]?.clientY ?? e.clientY

    if (x == null || y == null) return

    ctx.fillStyle = f.color
    ctx.globalAlpha = 0.8
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    const entry = counts.get(f.name)

    if (entry) {
      entry.n++
      entry.cell.textContent = entry.n
      return
    }

    const row = tbody.insertRow()
    const dc = row.insertCell()
    dc.textContent = '\\u25cf'
    dc.style.color = f.color
    row.insertCell().textContent = f.name
    const countCell = row.insertCell()
    countCell.textContent = 1

    counts.set(f.name, { n: 1, cell: countCell })
  }

  for (const [type] of lookup)
    document.addEventListener(type, dot, true)

  el.addEventListener('glass:remove', () => {
    for (const [type] of lookup)
      document.removeEventListener(type, dot, true)
  })
})()`

export class Glass {
  #el

  constructor(fn) {
    this.#el = document.createElement('div')
    this.#el.setAttribute('data-glass', '')

    const style = document.createElement('style')
    style.textContent = css

    const canvas = document.createElement('canvas')

    const table = document.createElement('table')
    table.innerHTML = '<tbody></tbody>'

    const script = document.createElement('script')
    script.textContent = js

    this.#el.append(style, canvas, table, script)
    document.body.appendChild(this.#el)

    if (typeof fn === 'function') fn()
  }

  remove() {
    this.#el.dispatchEvent(new Event('glass:remove'))
    this.#el.remove()
  }
}
