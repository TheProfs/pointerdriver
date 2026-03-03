# Demo

- Pencil tool draws on mouse drag.
- Camera tool allows pinch-to-zoom and swipe-to-pan.
- Twist/rotation only available on macOS Safari.
- macOS trackpad gestures also supported via `GestureEvent`.

```bash
npm start
```

Then open `http://127.0.0.1:3000`.  
Use `PORT=3001 npm start` if the default port is busy.  

Meant as a testbed for validating `pointerdriver`.

> [!CAUTION]
> - Do not import pointerdriver in the demo source.
> - Do not edit the demo to test pointerdriver.
> - Instead, drive the page from the browser console,
>   as indicated in `pointerdriver` `README.md`.
