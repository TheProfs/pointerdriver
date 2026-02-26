[![test][test-badge]][test]  

# pointerdriver  

> Synthesizes and dispatches events.  
> Mimics the event stream as if it were executed  
> by an actual human driving the interaction.  

```sh
npm i github:TheProfs/pointerdriver
```

## Usage  

```js
import { 
  DragMotion, GlideMotion, StrokeMotion, 
  PinchMotion, TwistMotion 
} from 'pointerdriver'

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

- `DragMotion`, `GlideMotion` and `StrokeMotion` take points as `[x, y, ms]`.  
- `ms` is the timestamp offset since the start of the motion; and must be 
  *monotonically increasing* and *non-negative*.
- `PinchMotion` takes `scale` and `{ x, y, distance, steps }`.  
- `TwistMotion` takes `degrees` and `{ x, y, radius, steps }` (can be negative).  

## Spec  

Full spec: `docs/spec/spec.md`.  

## Server  

Run a local static server:  

```bash
npx github:TheProfs/pointerdriver
```

Open `http://127.0.0.1:5619/`.  

## Test  

```bash
npm test
```

## License  

MIT  

[test-badge]: https://github.com/TheProfs/pointerdriver/actions/workflows/test.yml/badge.svg  
[test]: https://github.com/TheProfs/pointerdriver/actions/workflows/test.yml
