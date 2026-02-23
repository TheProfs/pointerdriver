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
  StrokeMotion,
  GlideMotion,
  DragMotion,
  PinchMotion,
  SwipeMotion,
  TwistMotion,
  WriteMotion,
  Keyboard,
} from 'pointerdriver'

const el = document.querySelector('#el')

await new StrokeMotion(el, [[30, 50, 0], [60, 80, 16]]).perform() // pen  
await new GlideMotion(el, [[30, 50, 0], [60, 80, 16]]).perform()  // finger  
await new DragMotion(el, [[30, 50, 0], [60, 80, 16]]).perform()   // mouse  

await new PinchMotion(el, 1.2).perform()       // 2 fingers  
await new SwipeMotion(el, 80, 0).perform()     // 2 fingers  
await new TwistMotion(el, 45).perform()        // 2 fingers  

await new WriteMotion(el, 'Hello', {
  font: 'data:image/svg+xml,...',
  fontSize: 48,
}).perform()

await new Keyboard(el).combo([['Shift', 'a']], { delay: 0 })
```

### Text strokes  

`WriteMotion` needs an SVG font URL.  
Use a `data:` URL or any hosted SVG font file.  

```js
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

const font = `data:image/svg+xml,${encodeURIComponent(svg)}`

await new WriteMotion(el, 'A', { font, fontSize: 48 }).perform()
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
