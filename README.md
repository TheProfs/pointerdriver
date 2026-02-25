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
import { DragMotion } from 'pointerdriver'

const el = document.querySelector('#el')

await new DragMotion(el, [
  [30, 50, 0],
  [60, 80, 16],
]).perform()
```

`DragMotion` points are `[x, y, ms]`.  
`ms` is the timestamp offset since the start of the motion.  
Timestamps must be non-decreasing.  

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
