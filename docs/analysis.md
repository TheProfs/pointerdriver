# Pen stroke latency

Trace of the gesture system in `paper-extended.js`,
how it feeds Paper.js tool events, and how `paper-canvas`
wires those into Bitpaper's command/event model.

**Primary files:**

- **Prod snapshots (used for this analysis):**
  - [`paper-extended.js`][pe]
  - [`paper-canvas.html`][pc]
  - [`tool-marker.js`][tm]
  - [`Path.js` (attenuate injection)][pa]
  - [`item-added.js`][ia]
- **GitHub view (`origin/prod`):**
  - [`paper-extended.js`][pe-prod]
  - [`paper-canvas.html`][pc-prod]
  - [`tool-marker.js`][tm-prod]
  - [`Path.js`][pa-prod]
  - [`item-added.js`][ia-prod]

> Note: I'm intentionally linking to prod snapshots under `/tmp/bp-pen-analysis/prod/`
> to avoid accidentally reasoning from any local uncommitted workspace changes.

## Summary

Short pen strokes suffer a compound latency from two
independent mechanisms acting in sequence:

1. `paper-extended` delays tool start until the touch
   travels `toolStartPx` from its down point (tap vs tool
   vs gesture disambiguation). In **prod**, this distance
   is measured in **project units** (not pixels).
2. `tool-marker` intentionally "burns" the first two drag
   events by adding only `e.downPoint`, then uses 4-point
   averaging (`attenuate`) for subsequent points.

On a fast 20px stroke:

- In the *severe* case (e.g. `toolStartPx=15` in some dev
  builds, or effectively ~15px on prod when zoom≈3),
  the tool can activate late enough that `tool-marker`
  never accumulates visible length before lift, so ink
  "pops in" on pen-up.
- In `prod` defaults (`toolStartPx=5` at zoom=1), the
  gate is smaller and ink often starts appearing before
  pen-up, but can still appear *late* (near the tail) due
  to `tool-marker` burning the first two drags.

**Prod-specific finding:**
Prod measures the gate threshold in project units,
not screen pixels.
The effective screen deadzone scales with zoom:

`deadzonePx ≈ toolStartPx * zoom`

| zoom | `toolStartPx=5` | effect |
|------|------------------|--------|
| 0.33 | ~1.65px | near-immediate |
| 1    | ~5px | mild delay |
| 3    | ~15px | noticeably late ink |

Users who zoom in more after the gesture feature
shipped encounter a larger deadzone.
This is the strongest candidate explanation for
increased latency complaints.

**Not long-press:**
`origin/prod` has **no** long-press timer and does not
emit a `longpress` gesture at all.
So the "longpress-like" behavior cannot be the cause of
production pen latency complaints.

**Additional gap:**
No stylus discrimination exists anywhere in the
classifier. No `touch.touchType === 'stylus'` or
`pointerType === 'pen'` checks.
Apple Pencil is treated as a generic touch.

**Version note:**
This document describes both:

- **Prod (`origin/prod`)**: `toolStartPx=5`, threshold is
  in project units, and there is **no** long-press
  gesture.
- **Dev / unshipped variant**: some builds add a long-press
  timer and interpret `toolStartPx` as screen pixels
  (`distPx = dist * zoom`).

## Architecture

### Input pipelines

Two pipelines share the same DOM event stream:

- **Camera gestures** (pan / zoom / rotate)
  Implemented in `paper-extended.js` as a gesture router
  attached to each Paper.js `View` and to `document`.
  Produces: `gesturestart`, `gesturechange`,
  `gestureend`.
  (Dev / unshipped variant may also emit `longpress`.)
  `paper-canvas` subscribes per project view via
  `onGestureStart`, `onGestureChange`, `onGestureEnd`
  (~L612+).
  (Dev / unshipped variant may also wire `onLongPress`.)
- **Tools** (marker, highlighter, eraser, select, etc.)
  Also in `paper-extended.js`, translating DOM events
  into `View._handleMouseEvent` → `Tool._handleMouseEvent`
  → tool handlers (`onMouseDown`, `onMouseDrag`,
  `onMouseUp`).
  Tools are Paper.js `Tool` instances constructed via
  `ToolStack`.

**Core arbitration rules:**

- No camera gesture starts while a tool is actively
  dragging (`dragging === true`).
- Extra touches do not end a stroke once a tool drag
  is active.

### State machine

The `View` event-router closure (~L13213–13221)
maintains:

- `dragging` (boolean) — tool interaction active;
  drives mousemove→mousedrag mapping and gesture
  blocking
- `mouseDown` (boolean) — suppresses focus/hover
- `activeTouchId` (touch identifier) — tracked touch
  once tool starts
- `pendingTouch` (object|null) — single-touch started
  but not yet committed to tool stroke
- `gesture` (object|null) — active gesture session
- `gestureTimer` — wheel gesture end timer
- `pendingLongPressTimer` — longpress timer (dev / unshipped only)

All behavior follows from transitions between:

- `pendingTouch === null | object`
- `dragging === false | true`
- `gesture === null | object`

### Device path selection

The router chooses DOM event bindings at load time
(~L13762–13778):

```js
if (navigator.pointerEnabled || navigator.msPointerEnabled) {
  mousedown = 'pointerdown MSPointerDown'
  mousemove = 'pointermove MSPointerMove'
  mouseup   = 'pointerup pointercancel MSPointerUp MSPointerCancel'
} else {
  mousedown = 'touchstart'
  mousemove = 'touchmove'
  mouseup   = 'touchend touchcancel'
}
```

This is legacy IE-era detection.
`navigator.pointerEnabled` is not the modern signal
(`window.PointerEvent`).
iOS Safari falls into the **TouchEvents** path.

In the touch path, a second decision controls whether
mouse listeners also attach:

```js
if (!(
  'ontouchstart' in window &&
  navigator.userAgent.match(
    /mobile|tablet|ip(ad|hone|od)|android|silk/i
  )
))
  mousedown += ' mousedown'
  mousemove += ' mousemove'
  mouseup   += ' mouseup'
```

This does **not** consult `navigator.maxTouchPoints`.
Both conditions must be satisfied to suppress mouse
listeners.

**Listener details (iOS-relevant):**

- `DomEvent.add` sets `{ passive: false }` for
  `touchstart`/`touchmove` so `preventDefault()` works
  (~L12721–12737).
- `DomEvent.getPoint` uses `targetTouches[0]` or
  `changedTouches[0]` for touch events
  (~L12752–12762).

### Default config

`PaperScope.initialize` creates gesture settings
(~L780–823):

> Note: this section reflects **prod** defaults from the
> snapshots linked above.

**Touch:**

| key | default |
|-----|---------|
| `touch.frames.min` | 3 |
| `touch.toolStartPx` | 5 *(project units; scales with zoom)* |
| `touch.threshold.pan` | 50 |
| `touch.threshold.zoom` | 0.25 |
| `touch.threshold.rotate` | 12° |

**Trackpad:**

| key | default |
|-----|---------|
| `trackpad.frames.min` | 1 |
| `trackpad.threshold.zoom` | 0.05 |
| `trackpad.threshold.rotate` | 5° |

**Wheel:**

| key | default |
|-----|---------|
| `wheel.endDelayMs` | 160 |
| `wheel.zoomFactor` | 0.002 |

**Zoom/pan/rotation scales:**

| key | default |
|-----|---------|
| `gesture.pan.scale` | 1 |
| `gesture.zoom.pinch` | 1 |
| `gesture.zoom.wheel` | 1 |
| `gesture.zoom.min` | 0.33 |
| `gesture.zoom.max` | 3 |
| `gesture.rotation.scale` | 1 |

`getGestureConfig(view)` (~L13322–13382) flattens
these into a `cfg` object: `minFrames`,
`panThreshold`, `zoomThreshold`, `rotateThreshold`,
`toolStartPx`, `wheelEndDelayMs`,
`wheelZoomFactor`, `zoomPinch`, `zoomWheel`,
`panScale`, `rotateScale`.

**Dev / unshipped variant notes:**

- Adds `touch.longPressMs` (e.g. 300ms) and a timer that can emit `longpress`.
- Some builds set `touch.toolStartPx = 15` and compare in screen pixels
  (`distPx = dist * zoom`) instead of project units.

### Gesture classifier: 2-finger touch

1. **Start** (`touchstart` with 2+ touches, ~L13809–13825)
   1. If `dragging` is true: gesture blocked,
      `preventDefault`, return
   2. Else: clear `pendingTouch`, call
      `gestureTouchStart`
2. **Initialize session** (`gestureTouchStart`,
   ~L13469–13494)
   1. Compute 2-touch centroid in view coords,
      convert to project coords
   2. Compute `baseDist` (pinch) and
      `lastAngle` (rotation)
   3. Emit `gesturestart` with `kind = 'undecided'`
   4. Store `gesture.touch` with `kind`, `frames`,
      `initial`, `centroid`, `translationMag`,
      `baseDist`, `lastDist`, `lastAngle`,
      `rotationDeg`
3. **Classify** (`gestureTouchMove`, ~L13496–13597)
   1. Compute per frame: `translationMag`,
      `scale`/`scaleDelta`, `rotationDeg`/`rotDelta`
   2. First move while `kind === 'undecided'`:
      record `initial` snapshot, return
   3. Subsequent moves: increment `frames`;
      if `frames < minFrames` (3), return
   4. Compute deltas vs initial:
      `deltaTrans`, `deltaScale`, `deltaRot`
   5. Compare `delta / threshold` scores:
      rotate wins ties (≥), else zoom, else pan
   6. Set `gesture.kind` permanently
   7. Emit `gesturechange`:
      - pan → `delta` (project centroid movement)
      - zoom → `scaleDelta` (exponentiated by
        `zoomPinch`)
      - rotate → `rotDelta` (scaled by
        `rotateScale`)
4. **End** (`gestureTouchEnd`, ~L13599–13606)
   1. Touch count drops below 2: gesture ends

**`paper-canvas` wiring** (`_setupGestureHandlers`,
~L612–679):

- `onGestureStart`: cancels current tool, clears
  selection
- `onGestureChange`: applies pan/zoom/rotate to all
  project views for multi-canvas alignment
- `onGestureEnd`: commits view state if changed

### Gesture classifier: wheel and trackpad

**Wheel** (`viewEvents.wheel`, ~L13857–13917):

1. Block if `dragging` is active
2. Kind: `'zoom'` if `ctrlKey`, `'pan'` otherwise
3. Emit `gesturechange` per tick
4. End after `wheelEndDelayMs` (160ms) inactivity

**WebKit trackpad** (non-touch devices,
~L14106–14145, helpers ~L13608–13709):

1. Classifier picks between zoom and rotate (no pan)
2. Uses `trackpadMinFrames`,
   `trackpadZoomThreshold`, `trackpadRotateThreshold`

### Single-touch gate

This is the mechanism directly responsible for
pen stroke latency.

This code exists in both prod and dev, but there are
two materially different variants.

#### Single-touch gate (prod: deployed)

1. **Touchstart with 1 touch** (~L13764 on prod)
   1. Set `pendingTouch = { view, downPoint, touchId }`
   2. `preventDefault`, return
   3. Tool does **not** receive `onMouseDown` yet
2. **Touchmove while pending** (~L13889 on prod)
   1. If touch count ≥ 2 and `dragging` is false:
      clear `pendingTouch`, start `gestureTouchStart`
   2. If still 1 touch:
      1. Compute `dist = |point - downPoint|`
         (project coords)
      2. If `dist < toolStartPx`: swallow, return
      3. Else commit to tool stroke:
         1. Set `activeTouchId`
         2. Clear `pendingTouch`
         3. Set `dragging = true`, `mouseDown = true`
         4. Call `view._handleMouseEvent('mousedown', event, downPoint)`
         5. Call `view._handleMouseEvent('mousemove', event, point)` → becomes `mousedrag`
3. **Touchend while pending** (~L13960 on prod)
   1. If tap is allowed: synthesize `mousedown` + `mouseup` at down point
   2. Clear `pendingTouch`, reset state

There is **no long-press** in prod.

#### Single-touch gate (dev / unshipped: long-press + screen-px gate)

1. **Touchstart with 1 touch** (~L13826–13844 in dev)
   1. Set `pendingTouch = { view, downPoint, touchId, time, event, longPressFired: false }`
   2. Schedule long-press timer (`longPressMs`, 300ms)
   3. `preventDefault`, return
   4. Tool does **not** receive `onMouseDown` yet
2. **Long-press** (`schedulePendingLongPress`, ~L13235–13269 in dev)
   1. After 300ms, if still pending, not dragging, no gesture:
      1. Emit `longpress` GestureEvent
      2. Set `pendingTouch.longPressFired = true`
   2. In `paper-canvas`, `onLongPress` opens the tool flyout (~L662–671, ~L1113–1131)
3. **Touchmove while pending** (~L13932–13998 in dev)
   1. If `longPressFired`: swallow, return
   2. If touch count ≥ 2 and `dragging` is false:
      clear `pendingTouch`, start `gestureTouchStart`, return
   3. If still 1 touch:
      1. Compute `dist = |point - downPoint|` (project coords)
      2. Compute `distPx = dist * zoom`
      3. If `distPx < toolStartPx`: swallow, return
      4. Else commit to tool stroke (same as prod)

**Tap allowlist:**

- `tapBehavior !== 'none'` (default: allowed)
- `tool.name !== 'tool-shape'` (hard-coded exclusion)

### Tool event flow

1. `View._handleMouseEvent` (~L14236)
   1. If `mousemove` while `dragging` is true and
      something responds to `mousedrag`:
      convert type to `mousedrag` (~L14248–14249)
   2. Hit-test items for item mouse events
   3. Call `tool._handleMouseEvent(type, event,`
      `point, mouse)`
2. `Tool._handleMouseEvent` (~L14855–14912)
   1. Update `_downPoint` on mousedown
   2. Update `_point`, `_lastPoint` per
      move/drag/up
   3. Update counts (`_downCount`, `_moveCount`)
   4. Emit `ToolEvent` with: `downPoint`, `point`,
      `lastPoint`, `middlePoint`, `delta`
      (~L14709+)

### Marker tool behavior

`selectedToolName` defaults to `'tool-marker'`
(~L326–330). "Pen tool selected" means `tool-marker`.

**`onMouseDown`** (~L29–51):

1. Create `tool.path = new paper.Path()`
2. Add to `teflon` items layer (scratch layer)
3. Set stroke style (`selectedStroke.write`,
   round cap/join)
4. Add **zero** points

**`onMouseDrag`** (~L53–94):

1. If `segments.length ≤ 1`:
   `path.add(e.downPoint)`, return
2. Else:
   `path.attenuate(e, samples)`
   `.smooth({ type: 'catmull-rom', factor: 0.5 })`

**`attenuate`** ([`Path.js`][pa], `samples = 1`):

- Adds the average of 4 values:
  `(lastSegmentPoint + event.point +`
  `event.middlePoint + event.lastPoint) / 4`
- Deliberately smooths/lags behind raw pointer
  points.

**`onMouseUp`** (~L96–115):

1. If `path.length < 2`: add two points near the
   up point (+1, +2 px) as a Safari workaround
2. Else: `path.simplify(0.1)`
3. Fire `item-added` with the path

### Commit and persistence

`item-added` command ([`item-added.js`][ia]):

1. `execute(item)`: move path from `teflon` to
   `main` project items layer, mark as user item
2. `serialize()`: store `item.exportJSON()` as
   event payload

On mouseup:

1. Tool fires `item-added`
2. `CommandExecutor.observe(tool)` executes
   `ItemAddedCommand`
3. `paper-canvas` re-emits serialized event
   name/data as DOM event (~L599–603)

## Evidence

### Scenario: 20px stroke, zoom=1, Pen tool

**Conditions:**
iOS 26.3 Safari, Apple Pencil, new board, zoom=1.
iOS Safari uses the TouchEvents path (legacy
`navigator.pointerEnabled` detection misses it).

Let `P0` = down point, `P_end` = lift point,
20px apart.
At zoom=1, project units ≈ screen pixels.

**Sequence (TouchEvents path, prod defaults):**

1. Pencil down (`touchstart`)
   1. Sets `pendingTouch` with `P0`
   2. No tool activation yet (`onMouseDown` is delayed)
   3. **No ink on contact**
2. Movement below threshold (< 5 project units from `P0`)
   1. Each `touchmove` computes `dist = |point - P0|` in project coords
   2. Below `toolStartPx`: swallowed
   3. **No ink while moving**
3. First `touchmove` crossing the gate (≥ 5)
   1. Clears `pendingTouch`, sets
      `dragging = true`
   2. Fires synthetic `mousedown` at `P0`
   3. Fires `mousedrag` at current point
   4. `onMouseDown`: creates path with
      **0 segments**
   5. First `onMouseDrag`: `segments.length === 0`,
      adds only `downPoint` (`P0`), returns
   6. **Stroke still invisible**
      (path is degenerate at down point)
4. Remaining movement (after tool start)
   1. Fast stroke: only 1–2 drags total after activation
      1. Activation drag adds `P0` (segments=1)
      2. Next drag adds `P0` again (segments=2, identical)
      3. If lift happens here: **no visible line**
   2. Typical stroke: 3+ drag events
      1. `attenuate` starts, adds averaged points
      2. Line appears late, trails pencil
5. Pencil up (`touchend`)
   1. Fires `onMouseUp`
   2. If `path.length < 2`: marker injects points
      near `P_end`; **ink appears suddenly**
   3. If `path.length ≥ 2`: simplified, committed
      from `teflon` to `main`; subtle settling

**What the user likely sees at zoom=1 (prod):**

- During the first few pixels: nothing (pending touch + marker burn).
- Often, ink only begins showing near the tail of a 20px fast stroke
  (once the 3rd drag point lands and smoothing catches up).
- On pen-up: the line finalizes and may "pop" slightly more if the path was
  still nearly-degenerate (Safari single-segment workaround).

**Severe case at zoom≈3 (prod) / `toolStartPx=15`:**

Because the screen deadzone grows to ~15px, the tool often starts so late that
`tool-marker` never gets a non-degenerate segment before lift.
Result: **no ink during the stroke, then a short line appears on pen-up**.

**PointerEvents path (if active):**

If `navigator.pointerEnabled` were true on iOS Safari:

- No `pendingTouch` delay; tool starts on
  `pointerdown`
- Marker still burns first two drags, but a full
  20px of movement after start makes visible ink
  more likely during the stroke

### Experimental confirmation (`toolStartPx=15`)

**Setup:**

- Deployed staging page, zoom=1, rotation=0
- `paper.settings.gesture.touch.toolStartPx = 15`
- Tool: `tool-marker`
- Autopen stroke: 6 points, dt=4ms, horizontal
  20px (`x = 0, 4, 8, 12, 16, 20`)
- `pauseAtPoint = 5` (pauses after x=16)

**Tool event log:**

1. Moves at 4, 8, 12px: no tool events
   (still `pendingTouch`)
2. At 16px:
   1. `onMouseDown` fires; underlying DOM event
      type: **`touchmove`** (not `touchstart`)
   2. `onMouseDrag` fires immediately
      (also `touchmove`)
3. At 20px: another `onMouseDrag`
4. On lift: `onMouseUp` with **`touchend`**

Path length remained 0 until mouseup because
`tool-marker` added only `downPoint` on the first
two drags.

**Screenshot evidence:**

- Mid-stroke (paused at 16px): [mid-stroke-15][ms15]
- After pen-up: [after-stroke-15][as15]
- Pixel diff bbox: `(900, 806) → (952, 818)`

Viewport pixels change **only at pen-up**.

**Canvas state after pen-up:**

- 1 `Path`: segments=4, length≈22.44,
  strokeColor=#222222, strokeWidth=4

## Prod differences

### Config: `toolStartPx=5`, no long-press

Prod `paper-extended.js` (~L802):

- `toolStartPx` defaults to **5** (not 15)
- `pendingTouch` gating exists:
  - sets on 1-finger `touchstart` (~L13764)
  - commits to tool on `touchmove` once
    `dist ≥ toolStartPx` (~L13889)
- **No** `longPressMs`, no `longpress` event,
  no timers

Prod `paper-canvas.html`:

- Wires `onGestureStart`/`onChange`/`onEnd` only
- **No** `onLongPress` wiring

The `pendingTouch` gate can cause latency complaints
even though the long-press feature never shipped.

### Deadzone scales with zoom

Prod measures the threshold in **project units**:

```js
dist = |point - downPoint|   // project coords
if (dist < toolStartPx) return
```

Screen deadzone: `deadzonePx ≈ toolStartPx * zoom`

| zoom | deadzone | perception |
|------|----------|------------|
| 0.33 | ~1.65px | near-immediate |
| 1    | ~5px | mild delay |
| 3    | ~15px | noticeably late |

Once users zoom in more often (after gesture feature
shipped), the deadzone grows in screen pixels.

### Experimental confirmation (`toolStartPx=5`)

Same Autopen stroke (20px, 6 points, 4ms).

**Paused after 12px** (`pauseAt=4`):

- Still no visible ink
- Screenshots: [mid-5-p4][m5p4], [after-5-p4][a5p4]
- Diff: [stitch-5-p4][s5p4], [diff-5-p4][d5p4]

**Paused after 16px** (`pauseAt=5`):

- Ink starts to appear before pen-up
- Screenshots: [mid-5-p5][m5p5], [after-5-p5][a5p5]
- Diff: [stitch-5-p5][s5p5], [diff-5-p5][d5p5]

With `toolStartPx=5` the problem is reduced but not
eliminated.
`tool-marker` still burns the first two drags, so
fast short strokes remain non-degenerate only near
the tail.

## Apple Pencil gaps

- No `touch.touchType === 'stylus'` checks anywhere
  in `paper-extended`
- No `pointerType === 'pen'` checks
- Pencil enters via TouchEvents (legacy detection),
  treated as generic finger touch
- The `pendingTouch` + `toolStartPx` gate is optimized
  for "tap = dot" and "second finger claims gesture",
  not for stylus strokes
- This affects finger drawing too, but it's far more
  noticeable with Pencil (fast short strokes + strong
  expectation of immediate ink)
- `tool-marker` averaging (`attenuate`) compounds
  gate delay for short stylus strokes

## Appendix: Autopen

### Purpose

Autopen is a test probe, not product behavior.
It dispatches realistic DOM input sequences for
pen-like strokes.

- Local copy: `/tmp/bp-pen-analysis/autopen/index.js`
- Sample strokes: `/tmp/bp-pen-analysis/autopen/hello.json`

**Capabilities:**

- Pause mid-stroke (`pauseAtPoint`) to snapshot
  state during `pendingTouch` / `dragging` transitions
- Fire hooks (`register`) at any point in the
  sequence
- Emits PointerEvent + MouseEvent + TouchEvent
  cascades for compatibility testing

**Caveat:**
If `paper-extended` attaches both touch and mouse
listeners, Autopen's MouseEvents cause duplicated
tool starts/drags.
Device detection spoofing is a prerequisite for
clean experiments.

### Import pattern

GitHub Gist raw URLs serve `text/plain` MIME.
Dynamic `import()` rejects non-JS MIME types.
Use fetch → Blob → dynamic import:

```js
const srcUrl =
  'https://gist.githubusercontent.com/nicholaswmin/'
  + '697fdc8d9546544027ea2874d927d9bd/raw/'
  + '53f787d7cc36f49b5bab02efc42f40f71d96b0f1/'
  + 'index.js'

const code = await (await fetch(srcUrl)).text()
const blob = new Blob(
  [code], { type: 'text/javascript' }
)
const blobUrl = URL.createObjectURL(blob)
const mod = await import(blobUrl)
URL.revokeObjectURL(blobUrl)

window.__Autopen = mod.Autopen
```

Load sample strokes:

```js
const strokesUrl =
  'https://gist.githubusercontent.com/nicholaswmin/'
  + '697fdc8d9546544027ea2874d927d9bd/raw/'
  + 'e2967fba01eca10b442cb9561aa20b629c3d9681/'
  + 'hello.json'

window.__helloStrokes =
  await (await fetch(strokesUrl)).json()
```

### Device detection spoofing

Two conditions must be met to suppress mouse
listeners in the touch path:

1. `'ontouchstart' in window` must be `true`
2. UA must match
   `/mobile|tablet|ip(ad|hone|od)|android|silk/i`

`navigator.maxTouchPoints` alone is not consulted.

**Procedure (Chrome DevTools MCP):**

1. Emulate iPad Safari UA
2. Add init script **before page scripts run**:
   define `window.ontouchstart`,
   set `navigator.maxTouchPoints = 1`
3. Reload

Changing these after page load has no effect;
`paper-extended` has already chosen event strings
and installed listeners.

### Experiment design template

**Variables:**

| variable | values |
|----------|--------|
| `toolStartPx` | 0, 5, 15 |
| stroke length | 10px, 20px, 40px |
| duration | 20ms, 80ms, 200ms |
| point count | 6, 20, 60 |

**Outputs per run:**

1. First tool activation time
   (first `onMouseDown` timestamp)
2. First visible ink time
   (sample `#main`/`#teflon` `getImageData()` in
   a small ROI, detect non-background pixels)
3. Commit semantics
   (does `item-added` fire only on pen-up?
   does path have non-zero length before pen-up?)

**Confound avoidance:**

1. Ensure `paper-extended` does not install mouse
   listeners (see device detection spoofing above)
2. Clear the page (`cleared-canvas`) between runs
3. Force view to known state (`recenterView`)
   between runs

## Addendum: sensor capture evidence + fix risk notes (2026-02-21)

This addendum writes down additional evidence gathered from real-device sensor
logs and expands on fix paths / risk, without changing the core conclusions
above.

### Sensor captures (Desktop)

Sorted by recent creation time on disk:

- `/Users/nicholaswmin/Desktop/ios-sensor.json`
  - 1.5MB
  - captured from `https://local.bitpaper.io/docs/sensor.html`
  - meta timestamp: `2025-12-19T17:17:11.519Z`
  - iPadOS Safari reporting a macOS-like UA (`platform = MacIntel`)
- `/Users/nicholaswmin/Desktop/sensor.raw.json`
  - 5.1MB
  - captured from `https://lab.bitpaper.io/docs/sensor.html`
  - Windows + Edge/Chrome (`Win32`)

These logs are not Bitpaper production captures; they are "sensor pages" meant
to show which browser events the hardware is emitting.

### iPadOS Safari sensor log (`ios-sensor.json`)

**Meta summary:**

- `userAgent`:
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ... Version/26.1 Safari/605.1.15`
- `platform`: `MacIntel`
- `dpr`: `2`
- `screen`: `1024 × 1366`

This confirms the "UA is masked" reality: iPadOS often presents itself as a
desktop Safari.

**Event types observed (counts):**

| event type | count |
|------------|------:|
| `pointermove` | 678 |
| `touchmove` | 386 |
| `pointerdown` | 16 |
| `touchstart` | 16 |
| `pointerup` | 9 |
| `touchend` | 9 |
| `pointercancel` | 7 |
| `touchcancel` | 7 |

So iPadOS Safari is emitting **both PointerEvents and TouchEvents** for the
same interactions in this sensor page.

**PointerEvents: stylus vs finger is distinguishable**

PointerEvents include `pointerType`, and in this capture:

| `pointerType` | count |
|--------------|------:|
| `pen` | 551 |
| `touch` | 231 |

Further, pen vs touch looks *very* different:

- `pressure`:
  - `pen`: variable (188 unique values rounded to 3 decimals; p50≈0.093, max≈0.567)
  - `touch`: constant 0.0 in this capture
- `width`/`height`:
  - `pen`: ~0.5
  - `touch`: ~104.27

This supports the idea that on modern iPadOS Safari, a stylus fast-path is
possible *if* Bitpaper is listening to PointerEvents (or if TouchEvent
`touchType` is available).

**TouchEvents: stylus data not recorded**

In this JSON, TouchEvents do not include `touches[]` / `changedTouches[]`, so
we cannot confirm whether `Touch.touchType === 'stylus'` is present on iPadOS
26.x from this capture alone.

If we want to pursue a TouchEvents-only stylus fast path, the sensor page
logger needs to explicitly serialize at least:

- `touches[0].identifier`
- `touches[0].clientX/clientY`
- `touches[0].touchType` *(if present)*

### Windows sensor log (`sensor.raw.json`) (for comparison)

This capture shows PointerEvents behaving as expected on Windows:

- Pointer event mix includes `pointerrawupdate` and `pointermove`, with
  `pointerType` values `pen` / `touch` / `mouse`.
- Pressure clearly separates:
  - `pen`: variable (p50≈0.867, max≈0.968)
  - `touch`: constant 0.5

This is mostly useful as a sanity check that the logger captures pen/touch
separation when PointerEvents are used.

### Quantifying the tool-start gate delay (from `ios-sensor.json`)

**Reminder of the production mechanism** (from the main analysis above):

- In prod, tool start is delayed until the touch has moved
  `toolStartPx` **project units** from the down point.
- Effective on-screen deadzone scales with zoom:
  `deadzonePx ≈ toolStartPx * zoom`.

So at zoom=3, prod's `toolStartPx=5` behaves like **~15px** of "no tool yet".

To estimate how long it takes a Pencil stroke to clear the deadzone, I measured
pen PointerEvent sessions in `ios-sensor.json` using `clientX/clientY` deltas
as a proxy for "view pixels".

**Pen sessions in the capture:**

- 16 pointer sessions total (by `pointerId`)
- 6 pen sessions (`pointerType === 'pen'`)
- Of those 6:
  - 3 were essentially taps / micro-moves (max distance ≤ 3.6px) and never
    crossed a 5px threshold
  - 3 were real strokes (max distance 28.6px, 63.2px, 273.9px)

**Time-to-cross thresholds (pen, view px):**

For the 3 stroke-like pen sessions:

| max distance | duration | dt to ≥5px | dt to ≥15px |
|------------:|---------:|-----------:|------------:|
| 273.9px | 1288ms | 25ms | 41ms |
| 63.2px | 384ms | 192ms | 234ms |
| 28.6px | 338ms | 79ms | 204ms |

Summary stats across pen sessions:

- Threshold **5px**:
  - crossed in 3/6 sessions
  - dt min/p50/max ≈ 25ms / 79ms / 192ms
- Threshold **15px**:
  - crossed in 3/6 sessions
  - dt min/p50/max ≈ 41ms / 204ms / 234ms

**Why this matters:**

- If prod is effectively using a **15px** deadzone (zoom≈3), then for a
  non-trivially-slow stroke, it's easy to see ~200ms before the tool activates.
- When the tool finally activates, `tool-marker` still burns the first two
  drags by repeatedly adding only `e.downPoint`. So even after tool activation,
  visible ink can lag further and can still "pop" on pen-up for short strokes.

This aligns with the controlled Autopen experiments above where the visible
pixels changed only on pen-up once the gate was large enough and the stroke was
short/fast.

### Direct answers to the "exact reason / zoom / iOS / pens" questions

**"Prod has complaints since a month ago; longpress + toolStartPx=15 doesn't exist there."**

Correct: prod has **no long-press** and defaults to `toolStartPx=5`.
The production latency complaints are still explained by:

1. The **pending-touch gate** (tap vs tool vs gesture disambiguation), *plus*
2. The **marker tool's early-drag behavior + smoothing**, *plus*
3. A prod-specific unit mismatch: the gate compares **project units**, making
   the effective deadzone grow with zoom.

So it's not "a discrepancy" so much as a real design (pending-touch) with a
real bug (unit mismatch) that becomes very visible once users work at higher
zoom levels.

**"So the more zoomed out you are the worst?"**

In current prod: **no, zoomed-in is worse** (deadzone grows with zoom).

If we fix the unit mismatch to make the threshold screen-pixel based, the
deadzone becomes consistent across zoom, which is the behavior most gesture
routers aim for.

**"Does this affect only iOS? Does it affect pens in general?"**

- Not strictly iOS-only: any platform that hits the TouchEvents + pending-touch
  gate + marker burn path can show it.
- But it's *particularly* iPadOS + Apple Pencil today because:
  - Bitpaper's event-path selection is legacy (`navigator.pointerEnabled`),
    so iPadOS Safari falls into the TouchEvents classifier even though it emits
    PointerEvents.
  - No stylus discrimination exists in the TouchEvents path, so Pencil is
    treated like a generic touch, including the gate delay.
- "Pens in general": on platforms where Bitpaper receives pen input as
  MouseEvents (or correctly uses PointerEvents), the pending-touch gate may not
  be involved at all, so the symptom can be different.

### Why the `pendingTouch` gate exists (driving reason)

It's intentional arbitration, not an arbitrary delay:

- **Tap semantics** (#5 in `testing.md`):
  touch-down + touch-up without meaningful movement should create a dot/spot,
  not a tiny line or accidental drag.
- **Gesture priority** (#1, #3):
  a two-finger gesture frequently begins as "one finger touches first, second
  finger touches shortly after".
  If the tool started immediately on the first touch, every pinch-zoom would
  begin by drawing a dot/stroke before the gesture is recognized.
- **Tool/gesture lifecycle safety** (#2, #4):
  once a tool drag is active (`dragging === true`), the router blocks gestures
  and prevents extra touches from ending the stroke.

The bug is that prod measures the gate in project units, unintentionally
coupling "how soon the tool starts" to zoom level.

### Fix paths and risk (recommended order)

#### Lowest-risk fix (I would start here)

**Make the touch gate threshold screen-pixel based in prod**, matching the dev
variant described earlier:

```js
dist = point.getDistance(downPoint)      // project units
distPx = dist * view.zoom                // approx screen px
if (distPx < toolStartPx) return         // toolStartPx interpreted as px
```

This:

- Keeps the pending-touch arbitration model intact (protects invariants).
- Removes the zoom-amplified deadzone that best explains the "recent" iPad
  complaints.
- Makes behavior consistent across zoom (a 5px threshold is 5px everywhere).

**Primary regression risk:** it reduces the "gesture claim window" at high zoom
(you have fewer pixels of movement before the tool commits). In practice 5px is
still a small threshold, and it's the more standard disambiguation unit.

Validate explicitly against `app/elements/paper-canvas/testing.md` invariants,
especially:

- Gesture start should not create dots/strokes.
- Gesture → immediate dot should work (no "stuck" tool).
- Draw → add 2nd finger should continue drawing (no camera movement).

#### Medium-risk next steps (only if needed)

1. **Stylus fast-path**
   - *TouchEvents approach:* if iPadOS provides `touch.touchType === 'stylus'`,
     reduce `toolStartPx` for stylus (or bypass pendingTouch entirely).
   - *PointerEvents approach:* modernize detection (`window.PointerEvent`) and
     use `pointerType === 'pen'`.

   Either way, iPadOS Safari emits **both** touch and pointer events in the
   sensor page, so any change here must be careful to avoid double-handling
   the same physical input.

2. **Marker/highlighter early-drag behavior**
   - Reducing the "burn" period (or adding `e.point` earlier) can make ink show
     sooner *even after the gate fix*.
   - This changes stroke feel/shape and should be treated as a UX change, not
     a pure bug fix.

#### Higher-risk fixes (I wouldn't start here)

These can work, but they're much more likely to break invariants or introduce
cross-platform regressions:

1. **Remove the pending-touch gate entirely**
   - High risk of violating **"Camera gestures never draw"** because the first
     finger of a pinch will immediately create a dot/stroke.
   - Also breaks tap-vs-drag disambiguation for multiple tools.

2. **Speculative "draw immediately, cancel if gesture starts"**
   - Requires buffering/discarding tool actions, and deciding what happens if a
     remote event arrives mid-speculation.
   - Interacts poorly with undo/redo and the "item-added on mouseup" commit
     model.

3. **Rewrite gesture + tool routing on PointerEvents**
   - Requires tracking multiple pointer streams (`pointerId`) to replicate
     current 2-finger classification (`touches[0]`/`touches[1]`).
   - Must solve the iPadOS "pointer + touch both fire" duplication problem.
   - Must preserve `preventDefault`/scroll suppression and multi-canvas
     alignment invariants.

4. **Change or remove the Safari mouseup workaround**
   - The "add two points on mouseup" hack exists to paper over a Safari render
     behavior for very short/single-segment paths.
   - Removing it can make the symptom *worse* (nothing shows even on pen-up) on
     the affected Safari versions.

[pe]: /tmp/bp-pen-analysis/prod/paper-extended.js
[pc]: /tmp/bp-pen-analysis/prod/paper-canvas.html
[tm]: /tmp/bp-pen-analysis/prod/tool-marker.js
[pa]: /tmp/bp-pen-analysis/prod/Path.js
[ia]: /tmp/bp-pen-analysis/prod/item-added.js

[pe-prod]: https://github.com/TheProfs/bitpaper/blob/prod/app/elements/paper-canvas/canvas/lib/paper-extended.js
[pc-prod]: https://github.com/TheProfs/bitpaper/blob/prod/app/elements/paper-canvas/paper-canvas.html
[tm-prod]: https://github.com/TheProfs/bitpaper/blob/prod/app/elements/paper-canvas/tools/tool-marker.js
[pa-prod]: https://github.com/TheProfs/bitpaper/blob/prod/app/elements/paper-canvas/canvas/paper-classes/inject/Path/Path.js
[ia-prod]: https://github.com/TheProfs/bitpaper/blob/prod/app/elements/paper-canvas/commands/item-added.js
[ms15]: /tmp/bp-pen-analysis/mid-stroke-toolStart15-clear.png
[as15]: /tmp/bp-pen-analysis/after-stroke-toolStart15-clear.png
[m5p4]: /tmp/bp-pen-analysis/mid-stroke-toolStart5-pause4.png
[a5p4]: /tmp/bp-pen-analysis/after-stroke-toolStart5-pause4.png
[s5p4]: /tmp/bp-pen-analysis/stitch-mid-after-toolStart5-pause4.png
[d5p4]: /tmp/bp-pen-analysis/stitch-mid-after-diff-toolStart5-pause4.png
[m5p5]: /tmp/bp-pen-analysis/mid-stroke-toolStart5-pause5.png
[a5p5]: /tmp/bp-pen-analysis/after-stroke-toolStart5-pause5.png
[s5p5]: /tmp/bp-pen-analysis/stitch-mid-after-toolStart5-pause5.png
[d5p5]: /tmp/bp-pen-analysis/stitch-mid-after-diff-toolStart5-pause5.png
