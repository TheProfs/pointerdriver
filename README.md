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
import { PointerDriver } from 'pointerdriver'

const driver = new PointerDriver('#el')

// Pencil
await driver.stroke([[30, 50, 0], [60, 80, 16]]) // pen drag

// Mouse
await driver.drag([[30, 50, 0], [60, 80, 16]])   // mouse drag

// Touch
await driver.glide([[
  30, 50, 0], [60, 80, 16]
]])                         // one-finger drag
await driver.pinch(2)       // two-finger pinch
await driver.swipe(80, 0)   // two-finger swipe
await driver.twist()        // two-finger twist
```

### Text strokes  

`stroke()` accepts a string,  
but you must provide an SVG font URL in the constructor.  

```js
const driver = new PointerDriver('#el', {
  font: 'http://127.0.0.1:5619/fonts/EMS_Elfin_Smooth.svg',
})

await driver.stroke('Hello', { fontSize: 48 })
```

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
