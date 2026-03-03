[![test][test-badge]][test]

# pointerdriver

Synthesize pointer, touch, and gesture events on any page.

```bash
npx github:TheProfs/pointerdriver
```

> [!NOTE]   
> LLM Agents **must** read the `pointerdriver` skill first.  
> Ask your LLM to run: `pointerdriver --skill` and study it carefully.

## How it works:

1. Run your project however you want.
   We're assuming it's running on `localhost:3000`
2. Run a pointerdriver server with `npx github:TheProfs/pointerdriver`
3. Go in your browser console and run:

```js
const {
  DragMotion, GlideMotion, StrokeMotion,
  PinchMotion, TwistMotion, SwipeMotion
} = await import('http://127.0.0.1:5619/pointerdriver.js')
```

This loads `pointerdriver` and allows executing any of the following motions:

## Motions

Create a motion by running: `new Motion(arguments).perform()`.
    
A motion is a *human-maneuver*;  
Regardless of the arguments you use for it, a motion eventually  
generates the exact sequence of events that would be generated  
from a real device.


### `DragMotion(el, points)`

Mouse drag across a surface.

| Param    | Description                                |
|----------|--------------------------------------------|
| `el`     | target element                             |
| `points` | `[x, y, ms][]`; `ms` monotonic and `>= 0` |

```js
await new DragMotion(document.querySelector('#el'), [
  [30, 50, 0],
  [60, 80, 16],
]).perform()
```

### `GlideMotion(el, points)`

Finger draw on a surface.

| Param    | Description                                |
|----------|--------------------------------------------|
| `el`     | target element                             |
| `points` | `[x, y, ms][]`; `ms` monotonic and `>= 0` |

```js
await new GlideMotion(document.querySelector('#el'), [
  [30, 50, 0],
  [60, 80, 16],
]).perform()
```

### `StrokeMotion(el, points)`

Pen stylus stroke on a surface.

| Param    | Description                                |
|----------|--------------------------------------------|
| `el`     | target element                             |
| `points` | `[x, y, ms][]`; `ms` monotonic and `>= 0` |

```js
await new StrokeMotion(document.querySelector('#el'), [
  [30, 50, 0],
  [60, 80, 16],
]).perform()
```

### `PinchMotion(el, scale, { x, y, distance, steps })`

Two-finger pinch together or apart.

| Param      | Default | Description              |
|------------|---------|--------------------------|
| `el`       |         | target element           |
| `scale`    |         | target scale factor      |
| `x`, `y`   |         | gesture center           |
| `distance` | `100`   | initial finger gap in px |
| `steps`    | `20`    | interpolation frames     |

```js
await new PinchMotion(document.querySelector('#el'), 2, {
  x: 60, y: 80
}).perform()
```

### `TwistMotion(el, degrees, { x, y, radius, steps })`

Two-finger rotation around a center point.

| Param     | Default | Description                 |
|-----------|---------|-----------------------------|
| `el`      |         | target element              |
| `degrees` | `45`    | rotation angle              |
| `x`, `y`  |         | gesture center              |
| `radius`  | `80`    | finger distance from center |
| `steps`   | `20`    | interpolation frames        |

```js
await new TwistMotion(document.querySelector('#el'), 45, {
  x: 60, y: 80
}).perform()
```

### `SwipeMotion(el, distance, { x, y, angle, separation, steps })`

Two-finger parallel drag.

| Param        | Default | Description               |
|--------------|---------|---------------------------|
| `el`         |         | target element            |
| `distance`   |         | travel distance in px     |
| `x`, `y`     |         | gesture center            |
| `angle`      | `0`     | direction in degrees      |
| `separation` | `40`    | gap between fingers in px |
| `steps`      | `20`    | interpolation frames      |

```js
await new SwipeMotion(document.querySelector('#el'), 200, {
  x: 60, y: 80
}).perform()
```

## Notes:

- The module server only serves `/pointerdriver.js` and `/src/*/index.js`.
- It sets permissive CORS headers so you can import it from any page.

## HTTPS pages

If the target page is HTTPS,  
importing pointerdriver from HTTP is blocked as mixed content.  
Serve pointerdriver over HTTPS (see `bin/skill.md` for one approach).


## Run tests

```bash
npm test
```

## License

[MIT][license]

[test-badge]: https://github.com/TheProfs/pointerdriver/actions/workflows/test.yml/badge.svg
[test]: https://github.com/TheProfs/pointerdriver/actions/workflows/test.yml
[license]: https://opensource.org/licenses/MIT
