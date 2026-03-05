# pointerdriver

[![test][test-badge]][test]

Simulate human maneuvers across devices on gesture-heavy web apps.  
For usage as an automated testing utility.

Abstracts idiosyncrasies across various pointer devices;    
e.g: "Apple Pencil", "touchscreen", "mouse" etc...  
using an ergonomic and uniform API.

> [!NOTE]
> LLM agents/assistants **must** read the [skill][skill-md].

## Usage

Import in your target app's DevTools/Web Inspector/Console:

```js
const { DragMotion } = await import('https://cdn.jsdelivr.net/gh/TheProfs/pointerdriver@main/pointerdriver.js')

await new DragMotion(document.querySelector('#el'), [
  [30, 50, 0],
  [60, 80, 16],
]).perform()
```

### Local usage

Run a local server instead of the CDN:

```bash
npx github:TheProfs/pointerdriver
```

```js
const { DragMotion } = await import('http://127.0.0.1:5619/pointerdriver.js')

await new DragMotion(document.querySelector('#el'), [
  [30, 50, 0],
  [60, 80, 16],
]).perform()
```

If the target page is HTTPS, the HTTP import is blocked as mixed content.  
Use a [Cloudflare Tunnel][cftunnel] to wrap it in HTTPS:

```bash
cloudflared tunnel --url http://127.0.0.1:5619
```

### Programmatic usage

You can also `import` and use it to drive automated tests:

```bash
npm i github:TheProfs/pointerdriver
```

```js
import { test } from 'node:test'
import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: false })
const page = await browser.newPage()
await page.goto('http://localhost:3000')

test('#mousedrag', async t => {
  t.beforeEach(() => page.evaluate(async () => {
    const { DragMotion } = await import(
      'http://127.0.0.1:5619/pointerdriver.js'
    )

    await new DragMotion(document.querySelector('#el'), [
      [30, 50, 0],
      [60, 80, 16],
    ]).perform()
  }))

  await t.test('creates a PathItem', async t => {
    // assertions...
  })

  await t.test('closely following the cursor path', async t => {
    // assertions...
  })

  await t.test('with selected attributes', async t => {
    // assertions...
  })
})
```

## Motions

A `Motion` encodes the manner in which the actual device it represents,  
translates inputs into events and constucts a near-identical   
event stream and dispatches it to the passed `element`:

> "swipe across an element using 1 finger, and draw a square":

```js
await new DragMotion(document.querySelector('#whiteboard'), [
  [30, 50, 0],
  [60, 80, 16],
  [120, 140, 32],
]).perform()
```

> "put 2 fingers down and twist `45 degrees` at pivot: `x: 100, y: 100`,  
> then lift up":

```js
await new TwistMotion(document.querySelector('#whiteboard'), 45, {
  x: 100, y: 100
}).perform()
```

### Element targeting

The passed element should be the **container** of the  
actual element you're targeting:

```html
<div id="whiteboard">
  <canvas></canvas>
</div>
```

```js
await new DragMotion(document.querySelector('#whiteboard'), [
  [30, 50, 0],
  [60, 80, 16],
]).perform()
```

There are 2 types of Motions; 

- Drawing motions
- Gesture motions

### Drawing

Single-pointer interactions, commonly used for drawing on a surface.


- `DragMotion` — mouse
- `GlideMotion` — touch
- `StrokeMotion` — pen

All three take `(el, points)`:

- `points` is `[[x, y, ms], ...]`
- `ms` is monotonic and `>= 0`

```js
await new DragMotion(document.querySelector('#el'), [
  [30, 50, 0],
  [60, 80, 16],
]).perform()
```

### Gestures

Multi-pointer interactions, commonly used for navigation (zoom, pan etc.)

#### `PinchMotion(el, scale, { x, y, distance, steps })`

Two-finger pinch together or apart.

- `scale` — target scale factor
- `x`, `y` — gesture center
- `distance` — initial finger gap in px (default `100`)
- `steps` — interpolation frames (default `20`)

```js
await new PinchMotion(document.querySelector('#el'), 2, {
  x: 60, y: 80
}).perform()
```

#### `TwistMotion(el, degrees, { x, y, radius, steps })`

Two-finger rotation around a center point.

- `degrees` — rotation angle (default `45`)
- `x`, `y` — gesture center
- `radius` — finger distance from center (default `80`)
- `steps` — interpolation frames (default `20`)

```js
await new TwistMotion(document.querySelector('#el'), 45, {
  x: 60, y: 80
}).perform()
```

#### `SwipeMotion(el, distance, { x, y, angle, separation, steps })`

Two-finger parallel drag.

- `distance` — travel distance in px
- `x`, `y` — gesture center
- `angle` — direction in degrees (default `0`)
- `separation` — gap between fingers in px (default `40`)
- `steps` — interpolation frames (default `20`)

```js
await new SwipeMotion(document.querySelector('#el'), 200, {
  x: 60, y: 80
}).perform()
```

## Add a motion

Motions are extensible, allowing support for more  
devices and interaction types.

```
Motion (base)
├── PathMotion (drawing)
│   ├── DragMotion
│   ├── GlideMotion
│   └── StrokeMotion
└── GestureMotion (gestures)
    ├── PinchMotion
    ├── TwistMotion
    └── SwipeMotion
```

1. Create `motions/<name>/index.js`
2. Extend `PathMotion` or `GestureMotion`
3. Export from `motions/index.js`

> [!NOTE]
> Co-locate tests in `motions/<name>/test/`.

## Run tests

```bash
npm test
```

## License

[MIT][license]

[test-badge]: https://github.com/TheProfs/pointerdriver/actions/workflows/test.yml/badge.svg
[test]: https://github.com/TheProfs/pointerdriver/actions/workflows/test.yml
[license]: https://opensource.org/licenses/MIT
[skill-md]: bin/skill.md
[cftunnel]: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
