[![test][test-badge]][test]

# pointerdriver

Synthesize pointer, touch, and gesture events on any page.

```bash
npx github:TheProfs/pointerdriver
```

## Import in browser console

Open your project in the browser,
then paste in the DevTools console:

```js
const {
  DragMotion, GlideMotion, StrokeMotion,
  PinchMotion, TwistMotion
} = await import('http://127.0.0.1:5619/pointerdriver.js')
```

## Drive the page

```js
await new DragMotion(document.querySelector('#el'), [
  [30, 50, 0],
  [60, 80, 16],
]).perform()

await new PinchMotion(document.querySelector('#el'), 2, {
  x: 60, y: 80
}).perform()

await new TwistMotion(document.querySelector('#el'), 45, {
  x: 60, y: 80
}).perform()
```

| Motion | Device | Gesture |
|--------|--------|---------|
| `DragMotion` | mouse | drag across surface |
| `GlideMotion` | finger | finger draw on surface |
| `StrokeMotion` | pen | stylus stroke on surface |
| `PinchMotion` | 2 fingers | pinch together/apart |
| `TwistMotion` | 2 fingers | rotate around center |

- `DragMotion`, `GlideMotion` and `StrokeMotion`
  take points as `[x, y, ms]`.
- `ms` is the timestamp offset since the start of the motion;
  must be *monotonically increasing* and *non-negative*.
- `PinchMotion` takes `scale` and `{ x, y, distance, steps }`.
- `TwistMotion` takes `degrees` and `{ x, y, radius, steps }`.

## Demo

A PaperJS sketch-pad for testing motions visually.

1. Start the pointerdriver server: `npx github:TheProfs/pointerdriver`
2. Start the demo: `cd docs/demo && npm start`
3. Open the demo in a browser.
4. Import `pointerdriver` in the browser console (see above).
5. Drive the `<canvas>` with motions.

## Spec

Full spec: `docs/spec/spec.md`.

## Run tests

```bash
npm test
```

## License

[MIT][license]

[test-badge]: https://github.com/TheProfs/pointerdriver/actions/workflows/test.yml/badge.svg
[test]: https://github.com/TheProfs/pointerdriver/actions/workflows/test.yml
[license]: https://opensource.org/licenses/MIT
