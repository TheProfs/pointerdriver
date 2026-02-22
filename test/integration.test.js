import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withDom } from './utils/jsdom.js'

const loadDriver = async () =>
  (await import(`../index.js?jsdom=${Math.random()}`)).PointerDriver

const rect = (w, h) => ({
  left: 0, top: 0, right: w, bottom: h, width: w, height: h
})

const mount = ({ w = 100, h = 100, children = [] } = {}) => {
  const container = document.createElement('div')
  container.id = 'c'
  container.getBoundingClientRect = () => rect(w, h)
  container.append(...children)
  document.body.append(container)

  return container
}

const record = (el, types, out) => {
  for (const type of types)
    el.addEventListener(type, e =>
      out.push({
        type: e.type,
        target: e.target?.id ?? e.target?.tagName ?? null,
        related: e.relatedTarget?.id ?? null,
        pointerType: e.pointerType ?? null,
        button: e.button ?? null,
        buttons: e.buttons ?? null,
        movementX: e.movementX ?? null,
        movementY: e.movementY ?? null,
        key: e.key ?? null,
        code: e.code ?? null,
        shiftKey: e.shiftKey ?? null,
        ctrlKey: e.ctrlKey ?? null,
        altKey: e.altKey ?? null,
        metaKey: e.metaKey ?? null,
      })
    )
}

test('PointerDriver', async t => {
  await t.test('glide() emits touch capture + over/out transitions', async () => {
    await withDom(async () => {
    const a = document.createElement('div')
    a.id = 'a'
    const b = document.createElement('div')
    b.id = 'b'

    const container = mount({ w: 100, h: 100, children: [a, b] })
    document.elementFromPoint = x => (x < 50 ? a : b)

    const events = []
    const types = [
      'pointerover', 'pointerenter', 'pointerdown',
      'gotpointercapture',
      'pointermove',
      'pointerout', 'pointerleave',
      'pointerup', 'lostpointercapture',
      'touchstart', 'touchmove', 'touchend',
    ]

    record(a, types, events)
    record(b, types, events)

    const PointerDriver = await loadDriver()

    await new PointerDriver(container)
      .glide([[10, 10, 0], [20, 10, 0], [70, 10, 0]])

    const seq = events.map(e => `${e.type}@${e.target}`)
    assert.deepEqual(seq.slice(0, 5), [
      'pointerover@a',
      'pointerenter@a',
      'pointerdown@a',
      'touchstart@a',
      'gotpointercapture@a',
    ])

    assert.ok(seq.indexOf('pointerout@a') < seq.indexOf('pointerover@b'))

    assert.ok(seq.indexOf('pointerup@b') < seq.indexOf('lostpointercapture@b'))
    assert.ok(seq.indexOf('lostpointercapture@b') < seq.lastIndexOf('touchend@b'))
    })
  })

  await t.test('stroke() does not emit got/lost pointer capture', async () => {
    await withDom(async () => {
    const container = mount({ w: 100, h: 100 })
    document.elementFromPoint = () => container

    const events = []
    record(container, ['gotpointercapture', 'lostpointercapture'], events)

    const PointerDriver = await loadDriver()
    await new PointerDriver(container)
      .stroke([[10, 10, 0], [20, 10, 0]])

    assert.equal(events.length, 0)
    })
  })

  await t.test('stroke(text) traces glyph strokes via SVG font URL', async () => {
    await withDom(async () => {
    const container = mount({ w: 100, h: 100 })
    document.elementFromPoint = () => container

    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg">',
      '<defs>',
      '<font horiz-adv-x="1000">',
      '<font-face units-per-em="1000" ascent="800" descent="-200" />',
      '<glyph unicode="A" horiz-adv-x="1000" d="M0,0 L100,0 Z" />',
      '</font>',
      '</defs>',
      '</svg>',
    ].join('')
    const url = `data:image/svg+xml,${encodeURIComponent(svg)}`

    const events = []
    record(container, ['pointerdown', 'touchstart', 'touchend'], events)

    const PointerDriver = await loadDriver()
    await new PointerDriver(container, { font: url })
      .stroke('A', { fontSize: 20 })

    assert.ok(events.some(e => e.type === 'pointerdown'))
    assert.ok(events.some(e => e.type === 'touchstart'))
    assert.ok(events.some(e => e.type === 'touchend'))
    })
  })

  await t.test('drag() sets movementX/Y on pointermove only', async () => {
    await withDom(async () => {
    const container = mount({ w: 100, h: 100 })
    document.elementFromPoint = () => container

    const moves = []
    container.addEventListener('pointermove', e =>
      moves.push({ movementX: e.movementX, movementY: e.movementY })
    )

    const PointerDriver = await loadDriver()
    await new PointerDriver(container)
      .drag([[10, 10, 0], [13, 14, 0], [13, 15, 0]])

    assert.deepEqual(moves, [
      { movementX: 0, movementY: 0 },
      { movementX: 0, movementY: 1 },
    ])
    })
  })

  await t.test('pinch() emits two pointers + touch events', async () => {
    await withDom(async () => {
    const container = mount({ w: 200, h: 200 })
    document.elementFromPoint = () => container

    const events = []
    record(container, [
      'pointerdown',
      'gotpointercapture',
      'lostpointercapture',
      'touchstart',
      'touchend',
    ], events)

    const PointerDriver = await loadDriver()
    await new PointerDriver(container)
      .pinch(1.2, { x: 100, y: 100, steps: 2 })

    assert.equal(events.filter(e => e.type === 'pointerdown').length, 2)
    assert.equal(events.filter(e => e.type === 'gotpointercapture').length, 2)
    assert.equal(events.filter(e => e.type === 'lostpointercapture').length, 2)
    assert.ok(events.some(e => e.type === 'touchstart'))
    assert.ok(events.some(e => e.type === 'touchend'))
    })
  })

  await t.test('pinch() cancels on hit-test failure mid-gesture', async () => {
    await withDom(async () => {
    const container = mount({ w: 200, h: 200 })
    let calls = 0
    document.elementFromPoint = () => (calls++ < 8 ? container : null)

    const events = []
    record(container, ['pointercancel', 'touchcancel'], events)

    const PointerDriver = await loadDriver()
    await assert.rejects(
      () => new PointerDriver(container).pinch(1.2, { x: 100, y: 100, steps: 4 }),
      /aborted/i
    )

    assert.ok(events.some(e => e.type === 'pointercancel'))
    assert.ok(events.some(e => e.type === 'touchcancel'))
    })
  })

  await t.test('swipe() emits two pointers + touch events', async () => {
    await withDom(async () => {
    const container = mount({ w: 200, h: 200 })
    document.elementFromPoint = () => container

    const events = []
    record(container, [
      'pointerdown',
      'gotpointercapture',
      'lostpointercapture',
      'touchstart',
      'touchend',
    ], events)

    const PointerDriver = await loadDriver()
    await new PointerDriver(container)
      .swipe(40, 0, { x: 100, y: 100, steps: 2 })

    assert.equal(events.filter(e => e.type === 'pointerdown').length, 2)
    assert.equal(events.filter(e => e.type === 'gotpointercapture').length, 2)
    assert.equal(events.filter(e => e.type === 'lostpointercapture').length, 2)
    assert.ok(events.some(e => e.type === 'touchstart'))
    assert.ok(events.some(e => e.type === 'touchend'))
    })
  })

  await t.test('twist() emits two pointers + touch events', async () => {
    await withDom(async () => {
    const container = mount({ w: 200, h: 200 })
    document.elementFromPoint = () => container

    const events = []
    record(container, [
      'pointerdown',
      'gotpointercapture',
      'lostpointercapture',
      'touchstart',
      'touchend',
    ], events)

    const PointerDriver = await loadDriver()
    await new PointerDriver(container)
      .twist(45, { x: 100, y: 100, steps: 2 })

    assert.equal(events.filter(e => e.type === 'pointerdown').length, 2)
    assert.equal(events.filter(e => e.type === 'gotpointercapture').length, 2)
    assert.equal(events.filter(e => e.type === 'lostpointercapture').length, 2)
    assert.ok(events.some(e => e.type === 'touchstart'))
    assert.ok(events.some(e => e.type === 'touchend'))
    })
  })

  await t.test('pinch/swipe/twist reject non-positive steps', async () => {
    await withDom(async () => {
    const container = mount({ w: 200, h: 200 })
    document.elementFromPoint = () => container

    const PointerDriver = await loadDriver()
    const d = new PointerDriver(container)

    await assert.rejects(
      () => d.pinch(1.1, { x: 100, y: 100, steps: 0 }),
      /steps must be a positive integer/
    )
    await assert.rejects(
      () => d.swipe(10, 0, { x: 100, y: 100, steps: 0 }),
      /steps must be a positive integer/
    )
    await assert.rejects(
      () => d.twist(10, { x: 100, y: 100, steps: 0 }),
      /steps must be a positive integer/
    )
    })
  })

  await t.test('keycombo() dispatches modifier states', async () => {
    await withDom(async () => {
    const container = mount({ w: 100, h: 100 })
    const events = []
    record(container, ['keydown', 'keyup'], events)

    const PointerDriver = await loadDriver()
    await new PointerDriver(container)
      .keycombo([['Shift', 'a']], { delay: 0 })

    const seq = events.map(e => `${e.type}:${e.key}:${e.shiftKey}`)
    assert.deepEqual(seq, [
      'keydown:Shift:true',
      'keydown:a:true',
      'keyup:a:true',
      'keyup:Shift:false',
    ])
    })
  })

  await t.test('press()/release() hold and release keys', async () => {
    await withDom(async () => {
    const container = mount({ w: 100, h: 100 })
    const events = []
    record(container, ['keydown', 'keyup'], events)

    const PointerDriver = await loadDriver()
    const d = new PointerDriver(container)
    d.press(['Shift', 'a'])
    d.release()

    const seq = events.map(e => `${e.type}:${e.key}:${e.shiftKey}`)
    assert.deepEqual(seq, [
      'keydown:Shift:true',
      'keydown:a:true',
      'keyup:a:true',
      'keyup:Shift:false',
    ])
    })
  })
})
