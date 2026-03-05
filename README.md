# pointerdriver

[![test][test-badge]][test]

Simulate human maneuvers across devices on gesture-heavy web apps.
For usage as an automated testing utility.

Abstracts the idiosyncrasies across many different pointer
devices; e.g: "Apple Pencil", "touchscreen", "mouse" etc...
behind an ergonomic and uniform API.

> [!NOTE]
> LLM agents/assistants **must** read the [skill][skill-md].

## Usage

Start the local server, then import in your target app's
DevTools/Web Inspector/Console:

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

A `Motion` is a unit that represents a particular maneuver.
For example:

- `"swipe across an element using 1 finger, following this <path>"`
- `"put 2 fingers down and twist <amount> of degrees and lift up"`

The `Motion` is then executed on the passed `element`,
which starts dispatching appropriate events at appropriate timings.

Run any motion with `new Motion(args).perform()`.

There are 2 types of Motions; both explained below:

### Drawing

Motions used for drawing on a surface.

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

```js
await new GlideMotion(document.querySelector('#el'), [
  [30, 50, 0],
  [60, 80, 16],
]).perform()
```

```js
await new StrokeMotion(document.querySelector('#el'), [
  [30, 50, 0],
  [60, 80, 16],
]).perform()
```

### Gestures

Motions used for interaction (zooming, panning, etc).

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

## Local server

For local development:

```bash
npx github:TheProfs/pointerdriver
```

then in your target app Web Console:

```js
const { DragMotion } = await import('http://127.0.0.1:5619/pointerdriver.js')

// execute motion ...
```

### Use HTTPS tunnels for https local dev

If the target page is HTTPS, the HTTP import is blocked as mixed content.
Use a Cloudflare Tunnel to wrap it in HTTPS:

```bash
cloudflared tunnel --url http://127.0.0.1:5619
```

Install via [Cloudflare Tunnel downloads][cftunnel].

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
