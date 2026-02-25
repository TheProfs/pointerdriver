# Pointer + Motion spec

## Entities

Two domain entities:

1. **Pointer** — per-contact, stateful, dispatches
   PointerEvents
2. **Motion** — a human movement, converts input into
   Pointer lifecycle calls

No Driver. Motions are the public API.

## Observed WebKit behavior

This library aims to match what WebKit (Safari) dispatches.  
The traces below are captured from iOS Safari using the event-capture demo.  

- `docs/spec/ios-sensor.json`  
- `docs/spec/traces/1-finger-drag.json`  
- `docs/spec/traces/2-finger-pinch.json`  
- `docs/spec/traces/2-finger-rotate.json`  

### Trace format

Trace files contain `{ meta, events }`.  
Each `events[]` entry is `{ type, props }`.  

`props.target` is a string label from the demo (`a`, `b`, `stage`, `HTML`, ...).  

`gotpointercapture` / `lostpointercapture` entries are missing pointer fields  
(`pointerId`, `pointerType`, `hasCapture`) due to the recorder.  
Treat them as ordering-only signals.  

### Implicit capture for touch

On iOS Safari, touch pointers are implicitly captured on `pointerdown`.  
In the traces:  

- `pointerdown.hasCapture` is already `true`.  
- `gotpointercapture` still fires after `touchstart`.  
  For multi-touch, capture events can be interleaved between pointers.  
  Each pointer's `gotpointercapture` happens before its first `pointermove`.  
- `lostpointercapture` fires after `pointerup` and before `pointerout`.  
- `pointermove` does not retarget mid-gesture.  
  The event `target` stays the initial hit target until the contact ends.  
- `pointerover` / `pointerout` do not fire during the gesture.  
- `pointerenter` / `pointerleave` fire for the full ancestor chain.  
  This includes `HTML`, `BODY`, and every container up to the hit target.  

### Multi-touch targeting

Each finger is its own pointer with its own stable target.  
`touchstart` fires once per finger.  
The second `touchstart` includes both touches in `touches`.  

### Scale/rotation on TouchEvent

WebKit includes `scale` and `rotation` on `TouchEvent`.  
This is true even for 1-finger drags (`scale: 1`, `rotation: 0`).  

During pinch/rotate, touch events carry the current gesture values.  
After the gesture ends and only one touch remains,  
`scale` and `rotation` reset back to `1` and `0`.  

### GestureEvent exists on iOS

iOS Safari emits `gesturestart` / `gesturechange` / `gestureend` for touch  
pinch and rotate gestures.  
These are not macOS-only events.  

In the 2-finger traces, gesture events are dispatched on both touched targets.  

- The first `gesturestart` is on the first touch's target.  
  It happens right before the second touch's pointer events begin.  
  Its values are `scale: 1`, `rotation: 0`.  
- The second `gesturestart` is on the second touch's target.  
  Its values match the first `gesturechange` on the first target  
  (same timestamp, same `scale`/`rotation`).  
- After that, `gesturechange` alternates targets (`a`, `b`, `a`, `b`, ...).  
  In traces, it often appears as adjacent events on the second target  
  then the first target, with identical `scale`/`rotation` values.  
- `gestureend` is dispatched on both targets with the final values.  

## Pointer

Per-contact stateful entity. Tracks current target,
entered state, pressed state. Extension point for
new device types.

### Public API

```
static id() → number
constructor({ id = Pointer.id(), primary })
enter(target, point)
down(target, point, i, total)
move(target, point, i, total)
up(target, point, i, total)
leave(target, point)
cancel(target, point)
capture(target)
release(target)
touch(target, point) → Touch | null
get id → number
get target → Element | null
get type → string
get emitsTouch → boolean
get implicitCapture → boolean
```

`Pointer.id()` returns a random 32-bit integer.
Constructor auto-assigns an ID when omitted.

**Override point:** `props(i, total)` returns
device-specific PointerEvent init properties.

### State

```
idle → entered       (enter)
entered → pressed    (down)
pressed → pressed    (move; target transitions internal)
pressed → entered    (up)
entered → idle       (leave)
pressed → idle       (cancel)
```

### Events per method

| Method  | Dispatches                                  |
|---------|---------------------------------------------|
| enter   | pointerover, pointerenter                   |
| down    | pointerdown                                 |
| move    | [out/leave → over/enter if target changed], |
|         | pointermove                                 |
| up      | pointerup                                   |
| leave   | pointerout, pointerleave                    |
| cancel  | pointercancel, pointerout, pointerleave     |
| capture | gotpointercapture                           |
| release | lostpointercapture                          |

`enter` dispatches `pointerover` (bubbles) then
`pointerenter` (no bubble).
`leave` dispatches `pointerout` (bubbles) then
`pointerleave` (no bubble).

`pointerenter` / `pointerleave` are dispatched on the full ancestor chain.  
`pointerover` / `pointerout` are dispatched on the deepest target only.  

Target transitions inside `move` apply only when the pointer is not captured.  
For captured pointers, `move` keeps targeting the capture target.  

### Mouse compatibility events

Out of scope. iOS Safari sensor data
(`ios-sensor.json`, 1205 events) confirms mouse
compat events fire only after a quick tap — the
browser's own click synthesis at the end of the
interaction. Continuous gestures (stroke, glide,
drag, pinch, swipe, twist) never trigger them.
The browser handles this; we don't replicate it.

### Hierarchy

```
Pointer
├── PenPointer
│   type: 'pen'
│   emitsTouch: true
│   implicitCapture: false
│   props: pressure, tiltX/Y, altitude, azimuth,
│          tangentialPressure, twist, 0.5×0.5
│   touch: returns Touch
│   └── IosPenPointer
│       props: sin⁸ pressure (0.08–0.6, noise ±0.02),
│              tiltX 22–35, tiltY 20–30,
│              altitude 0.86–1.04, azimuth 0.47–0.83,
│              phase-randomized sinusoidal drift
│
├── TouchPointer
│   type: 'touch'
│   emitsTouch: true
│   implicitCapture: true
│   props: no pressure, no tilt, no angles, large contact
│   touch: returns Touch
│   └── IosTouchPointer
│       props: contact ~42px (from iOS Safari traces)
│
├── MousePointer
│   type: 'mouse'
│   emitsTouch: false
│   implicitCapture: false
│   props: 1×1, no pressure, no tilt
│   Tracks movementX/Y delta between moves.
│   touch: null
│   └── IosMousePointer
│       (no overrides currently)
│
└── GesturePointer
    Overrides lifecycle to dispatch GestureEvent or
    wheel instead of PointerEvent.
    touch: null, implicitCapture: false
    ├── WebKitTrackpadPointer → GestureEvent(scale, rotation)
    └── ChromiumTrackpadPointer → wheel(ctrlKey, deltaY),
                                  noop on twist
```

Type defines physics (what properties exist).
Platform defines values (what those properties contain).

## Platform

A platform maps device types to Pointer constructors.
Motions receive a platform instead of hardcoding
a specific Pointer leaf.

```js
{
  pen:   IosPenPointer,
  touch: IosTouchPointer,
  mouse: IosMousePointer
}
```

Each platform is a plain object keyed by device type.
Adding a platform means adding an object — no existing
code changes.

Default platform: `webkit`.

## Motion

The human movement itself. Converts raw input into
a sequence of Pointer lifecycle calls. Extension point
for custom movements.

### Base

```
constructor(el, { platform = webkit })
perform() → async   (subclass must implement)
get device → string (subclass must override)
```

**Protected (shared infrastructure):**

```
get el → Element
get platform → object
pointer(opts) → Pointer
  creates via this.platform[this.device](opts)
hit(point) → Element
  resolves document.elementFromPoint(point.x, point.y),
  validates containment within el,
  throws RangeError on miss
delay(ms) → Promise
touchstart(pointer, point, gesture)
touchmove(pointer, point, gesture)
touchend(pointer, point, gesture)
touchcancel(pointer, point, gesture)
gesturestart(target, gesture)
gesturechange(target, gesture)
gestureend(target, gesture)
```

`gesture` is `{ scale, rotation }` (defaults: `1`, `0`).  

Touch methods call `pointer.touch(target, point)`
and dispatch TouchEvents that match iOS Safari semantics.  

Touch events are per changed touch, not per motion step.  
Each touch has a stable `Touch.target` for its entire lifetime.  
In traces, `pointermove` can outnumber `touchmove`.  

When multiple touches are active:  

- `touches` contains all active touches  
- `targetTouches` contains touches whose target is the event target  
- `changedTouches` contains only the touches that changed for this event  

### StrokeMotion

Pen drags across surface.

```
constructor(el, points, opts)   // points: [x, y, ms][]
get device → 'pen'
```

Constructor validates and normalizes raw points
to `{ x, y, createdAt }[]`.

**Sequence:**

```
pointer = this.pointer({ primary: true })
target = hit(p0)
pointer.enter(target, p0)
pointer.down(target, p0, 0, n)
touchstart(pointer, p0)

for i = 1..n-1:
  await delay(p[i].createdAt - p[i-1].createdAt)
  target = hit(p[i])
  pointer.move(target, p[i], i, n)
  touchmove(pointer, p[i])

pointer.up(target, pLast, n-1, n)
pointer.leave(target, pLast)
touchend(pointer, pLast)
```

**On error mid-stroke:**

```
pointer.cancel(lastTarget, lastPoint)
touchcancel(pointer, lastPoint)
throw Error('stroke aborted: <cause>')
```

### GlideMotion

Finger draws on surface.

```
constructor(el, points, opts)
get device → 'touch'
```

**Sequence:**

```
pointer = this.pointer({ primary: true })
target = hit(p0)
pointer.enter(target, p0)
pointer.down(target, p0, 0, n)
touchstart(pointer, p0)

for i = 1..n-1:
  await delay(p[i].createdAt - p[i-1].createdAt)
  hit(p[i])
  pointer.move(target, p[i], i, n)
  touchmove(pointer, p[i])

pointer.up(target, pLast, n-1, n)
pointer.leave(target, pLast)
touchend(pointer, pLast)
```

Touch pointers are implicitly captured on `pointerdown`.  
`gotpointercapture` is dispatched after `touchstart` and before the first move.  
`lostpointercapture` is dispatched after `pointerup` and before `pointerout`.  

### DragMotion

Mouse drags on surface.

```
constructor(el, points, opts)
get device → 'mouse'
```

**Sequence:**

```
pointer = this.pointer({ primary: true })
target = hit(p0)
pointer.enter(target, p0)
pointer.down(target, p0, 0, n)

for i = 1..n-1:
  await delay(p[i].createdAt - p[i-1].createdAt)
  target = hit(p[i])
  pointer.move(target, p[i], i, n)

pointer.up(target, pLast, n-1, n)
pointer.leave(target, pLast)
```

No touch events. No capture.

### PinchMotion

Fingers together/apart.

```
constructor(el, scale, { x, y, distance = 100, steps = 20, ...opts })
get device → 'touch'
```

Validates: steps must be positive integer.

**Geometry:**

```
for i = 0..steps:
  t = i / steps
  d = distance * lerp(1, scale, t) / 2
  positions[i] = [
    { x: center.x - d, y: center.y },
    { x: center.x + d, y: center.y }
  ]
```

**Sequence:**

```
pos = computed positions    // Point[][]
n = pos.length
a0 = hit(pos[0][0])
b0 = hit(pos[0][1])

a = this.pointer({ primary: true })
b = this.pointer({ primary: false })

a.enter(a0, pos[0][0])
a.down(a0, pos[0][0], 0, n)
touchstart(a, pos[0][0], { scale: 1, rotation: 0 })

gesturestart(a0, { scale: 1, rotation: 0 })

b.enter(b0, pos[0][1])
b.down(b0, pos[0][1], 0, n)
touchstart(b, pos[0][1], { scale: 1, rotation: 0 })

for i = 1..n-1:
  await frameDelay()
  hit(pos[i][0]); hit(pos[i][1])
  a.move(a0, pos[i][0], i, n)
  touchmove(a, pos[i][0], { scale, rotation })
  b.move(b0, pos[i][1], i, n)
  touchmove(b, pos[i][1], { scale, rotation })

  if i === 1:
    gesturestart(b0, { scale, rotation })
    gesturechange(a0, { scale, rotation })
  else:
    gesturechange(b0, { scale, rotation })
    gesturechange(a0, { scale, rotation })

gestureend(b0, { scale, rotation })
gestureend(a0, { scale, rotation })

a.up(a0, pos[n-1][0], n-1, n)
a.leave(a0, pos[n-1][0])
touchend(a, pos[n-1][0], { scale, rotation })

b.up(b0, pos[n-1][1], n-1, n)
b.leave(b0, pos[n-1][1])
touchend(b, pos[n-1][1], { scale: 1, rotation: 0 })
```

`scale` and `rotation` are derived from the 2 touch positions.  
On iOS Safari, GestureEvents are dispatched on both targets.  

**On hit-test failure mid-gesture:**

```
gestureend(b0, { scale, rotation })
gestureend(a0, { scale, rotation })

a.cancel(a0, lastPos[0])
touchcancel(a, lastPos[0])

b.cancel(b0, lastPos[1])
touchcancel(b, lastPos[1])
throw Error('pinch aborted: <cause>')
```

### SwipeMotion

Fingers drag parallel.
Same dual-touch pointer + touch lifecycle as PinchMotion.  
Does not attempt to dispatch GestureEvent.

```
constructor(el, dx, dy, { x, y, spread = 50, steps = 20, ...opts })
get device → 'touch'
```

**Geometry:**

```
for i = 0..steps:
  t = i / steps
  positions[i] = [
    { x: cx + dx*t, y: cy - spread/2 + dy*t },
    { x: cx + dx*t, y: cy + spread/2 + dy*t }
  ]
```

### TwistMotion

Fingers rotate around center.
Same dual-touch pointer + touch lifecycle as PinchMotion.  
Dispatches GestureEvent like PinchMotion.

```
constructor(el, degrees = 45, { x, y, radius = 80, steps = 20, ...opts })
get device → 'touch'
```

**Geometry:**

```
for i = 0..steps:
  angle = degrees * π/180 * (i / steps)
  positions[i] = [
    { x: cx + cos(angle) * r, y: cy + sin(angle) * r },
    { x: cx + cos(angle+π) * r, y: cy + sin(angle+π) * r }
  ]
```

### WriteMotion

Pen writes text. Multiple strokes with lifts.

```
constructor(el, text, { font, fontSize, x, y, ...opts })
get device → 'pen'
```

**Sequence:**

```
font = await Font.from(fontUrl)
strokes = font.trace(text, { fontSize, x, y })
if no x/y: center strokes within el

for each stroke:
  await new StrokeMotion(el, stroke, opts).perform()
  if not last: await delay(LIFT)
```

## Keyboard

Not a Motion. Standalone class for key dispatch.

```
constructor(el)
combo(groups, { delay }) → async
press(keys) → this
release(keys) → this
```

## Project structure

The runtime is intentionally small and OOP-focused.  
Each file represents a domain concept, not a generic helper.  

```
pointerdriver/
├── index.js
├── src/
│   ├── pointer/
│   │   └── index.js   // Pointer + iOS/WebKit platform
│   ├── motion/
│   │   └── index.js   // Motion base
│   ├── motions/
│   │   ├── glide/
│   │   │   ├── index.js
│   │   │   └── test/
│   │   │       └── main.test.js
│   │   ├── pinch/
│   │   │   ├── index.js
│   │   │   └── test/
│   │   │       └── main.test.js
│   │   └── ...
│   ├── keyboard.js
│   └── font.js
├── test/
│   └── utils/
│       └── index.js
└── bin/
    └── pointerdriver.js
```

## Testing

### Strategy

Each pointer and motion has colocated unit tests.

All tests discovered via: `node --test "**/*.test.js"`

Shared JSDOM harness: `test/utils/index.js`.

### Per-motion test expectations

**stroke.test.js:**
- pointerType 'pen' on all pointer events
- enter before down (hover in)
- pointerdown dispatched
- pointermove for each intermediate point
- pointerup at end
- leave after up (hover out)
- touchstart, touchmove, touchend dispatched
- no gotpointercapture / lostpointercapture
- cancel + touchcancel on mid-stroke hit-test failure

**glide.test.js:**
- pointerType 'touch'
- implicit capture: pointerdown hasCapture true
- enter, down, touchstart, gotpointercapture in order
- pointermove + touchmove targets stay the initial hit target
- pointerup, lostpointercapture, leave, touchend in order
- no pointerover/out or enter/leave during the drag

**drag.test.js:**
- pointerType 'mouse'
- movementX/Y computed on pointermove
- enter before down, leave after up
- no touch events dispatched
- no capture events dispatched

**pinch.test.js:**
- 2 pointerdown events (different IDs, different targets)
- gotpointercapture for each pointer (before its first pointermove)
- touchstart fires once per finger
- touchmove fires once per changed finger; touches includes both touches
- gesturestart/change/end dispatched on both targets (WebKit)
- first gesturestart: `scale: 1`, `rotation: 0`
- second gesturestart values match the first gesturechange values
- gesturechange alternates targets and includes scale + rotation
- 2 pointerup, 2 lostpointercapture
- first touchend happens while 1 touch remains
- last touchend resets `scale: 1`, `rotation: 0`
- cancel + touchcancel on mid-gesture hit-test failure
- rejects non-positive steps

**swipe.test.js:**
- same dual-touch pointer/touch assertions as pinch
- no GestureEvent dispatched
- positions follow translation geometry

**twist.test.js:**
- same multi-pointer assertions as pinch
- positions follow rotation geometry

**write.test.js:**
- accepts string + font URL
- multiple pointerdown per glyph stroke
- touchstart, touchend per sub-stroke

**keyboard.test.js:**
- modifier states (shiftKey, ctrlKey) correct
- combo: keydown/keyup in order
- press/release: hold and release keys

### Per-pointer test expectations

**pen.test.js:**
- props returns pressure, tilt, angles
- IosPenPointer pressure in 0.08–0.6 range
- contact 0.5×0.5
- touch() returns Touch object

**touch.test.js:**
- props returns large contact, no pressure
- IosTouchPointer contact ~42px (from traces)
- touch() returns Touch object with correct radius

**mouse.test.js:**
- props returns 1×1, no pressure, no tilt
- movementX/Y tracks deltas across moves
- touch() returns null

**gesture.test.js:**
- deferred (extension point, not needed yet)

## Migration

| Old                    | New                                           |
|------------------------|-----------------------------------------------|
| `PointerDriver`        | removed                                       |
| `.stroke(points)`      | `new StrokeMotion(el, pts).perform()`         |
| `.stroke('text', opts)`| `new WriteMotion(el, 'text', opts).perform()` |
| `.glide(points)`       | `new GlideMotion(el, pts).perform()`          |
| `.drag(points)`        | `new DragMotion(el, pts).perform()`           |
| `.pinch(scale, opts)`  | `new PinchMotion(el, scale, opts).perform()`  |
| `.swipe(dx, dy, opts)` | `new SwipeMotion(el, dx,dy, opts).perform()`  |
| `.twist(deg, opts)`    | `new TwistMotion(el, deg, opts).perform()`    |
| `.keycombo(grps, opts)`| `new Keyboard(el).combo(grps, opts)`          |
| `.press(keys)`         | `kbd.press(keys)`                             |
| `.release(keys)`       | `kbd.release(keys)`                           |
| `SyntheticPointer`     | `Pointer` base                                |
| `IosPenProfile`        | `IosPenPointer.props()`                       |
| `IosTouchProfile`      | `IosTouchPointer.props()`                     |
| `IosMouseProfile`      | `IosMousePointer.props()`                     |
| `SyntheticTouch`       | `Motion.touchstart/move/end` (tracked)        |
| `SyntheticDualTouch`   | removed (multi-touch is first-class)          |
| `SyntheticMouse`       | out of scope (browser click synthesis)        |
| `SyntheticKeyboard`    | `Keyboard`                                    |
| `BreakGlass`           | standalone utility (optional)                 |

## Extension points

**New device:** add a Pointer leaf.
No existing code changes.

**New platform:** add a platform object mapping
device types to Pointer constructors.
No existing code changes.

**New movement:** extend Motion, implement perform().
No existing code changes.

**Trackpad gestures:** new GesturePointer leaves
+ new Motion types or adapt existing.
Existing touchscreen motions untouched.
