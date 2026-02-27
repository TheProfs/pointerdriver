# pointerdriver skill

Synthesize realistic pointer, touch, and gesture event sequences on a DOM element.
Pointerdriver is a testing utility, not a drawing library.
It dispatches events as a human-controlled browser would.

This skill is written for an agent that can:
- run the `pointerdriver` module server locally, and
- execute JavaScript in a real page context, such as DevTools console.

## Mental model

Pointerdriver has two core concepts:

- `Pointer`: per-contact state, emits `PointerEvent` and mouse compatibility events.
- `Motion`: a human movement, implemented as a sequence of pointer lifecycle calls.

You use motions directly.
Motions are the public API.

## Quick start

1. Start the module server:

   ```bash
   npx github:TheProfs/pointerdriver
   ```

   It prints the URL to import from.
   Default: `http://127.0.0.1:5619/pointerdriver.js`.

2. In the target page DevTools console, import the motions:

   ```js
   const {
     DragMotion, GlideMotion, StrokeMotion,
     PinchMotion, TwistMotion,
   } = await import('http://127.0.0.1:5619/pointerdriver.js')
   ```

3. Drive an element:

   ```js
   const el = document.querySelector('#el')

   await new DragMotion(el, [
     [30, 50, 0],
     [60, 80, 16],
   ]).perform()
   ```

## Motions

Available motions exported from `pointerdriver.js`:

| Motion | Device | Events |
|--------|--------|--------|
| `DragMotion` | mouse | Pointer + Mouse |
| `GlideMotion` | touch | Pointer + Touch |
| `StrokeMotion` | pen | Pointer + Touch |
| `PinchMotion` | 2-finger | Pointer + Touch + Gesture? |
| `TwistMotion` | 2-finger | Pointer + Touch + Gesture? |

### `DragMotion`, `GlideMotion`, `StrokeMotion` points

Constructor signature:

```js
new DragMotion(el, points, opts).perform()
new GlideMotion(el, points, opts).perform()
new StrokeMotion(el, points, opts).perform()
```

`points` must be `[[x, y, ms], ...]`.

- `x`, `y`, `ms` must be finite numbers.
- `ms` must be `>= 0`.
- `ms` must be monotonically non-decreasing across points.
- `ms` is relative to the motion start.
  A point with the same `ms` as the previous point causes no delay.

### `PinchMotion`

Constructor signature:

```js
new PinchMotion(el, scale, {
  x, y,
  distance = 100,
  steps = 20,
  ...opts
}).perform()
```

Constraints:
- `scale` must be finite and `> 0`.
- `x` and `y` are required and must be finite.
- `distance` must be finite and `> 0`.
- `steps` must be a positive integer.

### `TwistMotion`

Constructor signature:

```js
new TwistMotion(el, degrees = 45, {
  x, y,
  radius = 80,
  steps = 20,
  ...opts
}).perform()
```

Constraints:
- `degrees` must be finite.
- `x` and `y` are required and must be finite.
- `radius` must be finite and `> 0`.
- `steps` must be a positive integer.

## Coordinates, hit-testing, and common failures

All hit-testing is based on `document.elementFromPoint(x, y)`.
Each motion validates that the hit target is contained within `el`.
If not, it throws:

`RangeError: hit-test missed: (x,y) outside element`

Practical rules:
- Pass the element you want to drive as `el`.
  For canvas, this is usually the `<canvas>`.
- Ensure all coordinates are in viewport client coordinates.
- Use `getBoundingClientRect()` to generate safe points inside the element.

Example point builder:

```js
const el = document.querySelector('#el')
const r = el.getBoundingClientRect()
const p = (nx, ny, ms = 0) => [
  r.left + 1 + nx * (r.width - 2),
  r.top + 1 + ny * (r.height - 2),
  ms,
]

await new GlideMotion(el, [
  p(0.2, 0.2, 0),
  p(0.8, 0.8, 32),
]).perform()
```

## Timing and realism

For point-based motions, the delay between points is:
`points[i].ms - points[i - 1].ms`.

Use cases:
- Fast, deterministic: keep all `ms` at `0`.
- Realistic frame pacing: use `0, 16, 32, ...`.

`PinchMotion` and `TwistMotion` advance using `requestAnimationFrame`.
`steps` controls the number of frames and the number of move events per pointer.

## Environment requirements

Motions execute in a DOM environment.
Common missing APIs fail loudly:

- `PointerEvent` must exist.
- `crypto.getRandomValues` must exist.
- Touch and pen motions require `Touch` and `TouchEvent`.
  If `TouchEvent` is missing, touch dispatch throws.
- `GestureEvent` is optional.
  If it does not exist, gesture dispatch is skipped, but touch events still fire.

If you are running in a test environment, install DOM globals first.
This repo includes a JSDOM harness in `test/utils/index.js`.

## HTTPS and mixed content

If the target app runs on HTTPS, importing pointerdriver from HTTP will fail.
This is a browser mixed-content restriction:

- Page: `https://…`
- Import: `http://127.0.0.1:5619/pointerdriver.js`

Fix by serving pointerdriver over HTTPS.

### Cloudflare Tunnel approach

Use a Cloudflare Tunnel to wrap the local HTTP server in an HTTPS URL.

1. Start pointerdriver locally:

   ```bash
   npx github:TheProfs/pointerdriver
   ```

2. In another terminal, create a tunnel to the local server:

   ```bash
   cloudflared tunnel --url http://127.0.0.1:5619
   ```

   Cloudflare prints an `https://…` URL.

3. Import from the HTTPS tunnel URL:

   ```js
   const { DragMotion } = await import(
     'https://<your-tunnel-host>/pointerdriver.js'
   )
   ```

Notes:
- This also makes the module reachable from real devices, such as iOS Safari.
- If the target page has a strict CSP, it may block module imports from
  unknown origins.
  In that case, host pointerdriver on an allowed origin, ideally the same
  origin as the app.

## CLI server knobs

The module server is `bin/pointerdriver.js`.
It serves `pointerdriver.js` plus internal `src/` modules and sets CORS headers.

Configuration via environment variables:

```bash
HOST=127.0.0.1 PORT=5619 npx github:TheProfs/pointerdriver
```

Use `HOST=0.0.0.0` if you need LAN access.
For HTTPS pages, prefer the Cloudflare Tunnel method instead of raw LAN HTTP.

## What pointerdriver does not do

- It does not synthesize browser default actions.
  There is no `click` event synthesis, scrolling, text input, or focus behavior.
- It does not bypass CSP, cross-origin iframes, or browser security policies.

## Reference

For the event ordering and semantics this library targets, read:
- `docs/spec/spec.md`
