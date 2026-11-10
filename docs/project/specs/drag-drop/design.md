# Design: drag-drop

## Approach

This feature adds one gesture on top of the shipped `task-groups` code and keeps the same stack: one static page, `design-system.css`, vanilla ES modules, no build step, no new dependency, `node:test` and Playwright.

A drop is the same move as the edit form move. The drag code only decides which group the pointer was released over; the move itself goes through the existing path in `src/app.js`: a single store write, then `moveRow(row, key)`, which already expands a folded target, rebuilds with `renderList()` (row reuse through `syncChildren`), places the task by creation time, moves focus, washes the row and announces. Folded targets, the filter, focus and storage failures therefore behave exactly as in task-groups R24 and R28, with no second implementation.

The work splits like this:

1. `src/drag.js` (new, owner `fe`): everything about the gesture. Pointer Events for mouse, pen and touch (the HTML drag and drop API does not work with touch), the 400 ms long press, the slip, the placeholder, the drop strip, hit testing, auto scroll, cancel and interruptions. It knows nothing about storage. It talks to `app.js` through a few callbacks. This keeps `app.js` (799 lines) from growing past the "about 900 lines" mark agreed in decisions.md.
2. `src/store.js` (owner `be`): one new method, `setGroup(id, groupId)`, that changes only `groupId`. The edit form path `updateText` trims and validates the text, so reusing it for a drop could rewrite a hand edited text with spaces around it or refuse a stored text over 200 characters, which R36 forbids. `setGroup` is six lines and writes once, like `updateText`.
3. `src/app.js` (owner `fe`): wires `createDrag`, gives it the R5 checks, closes swipes on pick up (R6), runs the move or the cancel announcement at the end, cancels a running drag from the existing day change, storage and reset paths, and adds the info slip for a move into a group hidden by the filter (decisions.md, also for the edit form move).
4. `index.html` (owner `fe`): one `<template id="drag-template">` holding the slip, the strip and the auto scroll cue, so markup stays in one place as for `#group-template`.

Markup and classes come from the "Drag and drop" block of `docs/project/design-system.css` and from `ux/screens/*.html`. The prototypes use `<a>` for targets so the static screens link; production uses `<div>` targets with no `href` and no `tabindex`, so the strip has no tab stops (R10).

## Files to create or change

| File | Owner | Change |
| --- | --- | --- |
| `src/store.js` | be | `store.setGroup(id, groupId)` |
| `tests/unit/store.test.js` | be | Tests for `setGroup` |
| `src/drag.js` | fe | New: the gesture, slip, strip, hit testing, auto scroll, cancel; exports `createDrag` and the pure helper `scrollSpeed` |
| `tests/unit/drag.test.js` | fe | New: `scrollSpeed` only (the rest needs a browser) |
| `src/app.js` | fe | `moveRow` message and hidden target info slip; `createDrag` wiring; `drag.cancel()` in `resetTransient` and the storage listener |
| `index.html` | fe | `#drag-template` |
| `tests/e2e/helpers.js` | fe | Drag helpers: `mouseDrag`, `longPressDrag` (CDP touch), `touchDrag` moved here from the two spec files |
| `tests/e2e/drag.spec.js` | fe | New: this feature's end to end tests |
| `tests/e2e/groups.spec.js` | fe | Only if open question 1 is answered "notice only": one assertion at the filtered move test |
| `package.json`, `index.html`, `src/*.js` | be | Version `1.3.0` in the release task |

No change to `design-system.css`, `design-system.md`, `playwright.config.js` or the Content-Security-Policy. Positions are set through the CSSOM (`el.style.transform`, `el.style.top`), which the `style-src 'self'` policy allows, as the progress ring already does.

## Data model

No new key and no new field. A drop changes only `groupId` of one task in `daily-todo:tasks:v1` (one `setItem`), and the collapsed list in `daily-todo:ui:v1` only when the target section was folded (R14, R33), through the existing `groups.setCollapsed` inside `moveRow`.

## Interfaces

### `src/store.js` (owner `be`)

```js
store.setGroup(id, groupId)
// groupId: a non empty string sets the field, null removes it (same rule as updateText).
// Text, done, date, createdAt and id are never touched (R36). One save (R33).
// { task } on success, { error: "notFound" } for an unknown id (no write).
// A locked or failing store keeps the change in memory and sets storageOk false, like every other change (R34).
```

### `src/drag.js` (owner `fe`)

```js
import { UNGROUPED, UNGROUPED_NAME } from "./groups.js?v=1.2.0";

// Auto scroll speed in px per frame for a pointer at clientY (R31). Negative scrolls up, positive down, 0 outside the zones.
// Up zone: y < edge. Down zone: y > stripTop - edge (the 64 px above the strip, decisions.md). Linear, max at the edge.
export function scrollSpeed(y, stripTop, edge = 64, max = 18) {}

export function createDrag({ list, template, groups, canStart, onStart, onEnd }) {}
// list:      #day-list; drags start only from a .task inside it
// template:  #drag-template
// groups:    () => groups, a getter (the storage listener replaces the instance)
// canStart:  () => boolean, the R5 and R35 checks, asked at the moment of pick up
// onStart:   (row) => void, app closes every open swipe strip (R6)
// onEnd:     (row, key, hadFocus) => void
//            key: the target section key, or null for a cancel (Escape, release on nothing or on the own group,
//            interruption). hadFocus: focus was inside #day-list when the press began (R22).
// returns { cancel(), active() }
//            cancel(): ends a running drag as a cancel; safe to call when nothing runs
```

The task's current key is read from the row: `row.closest(".group")?.dataset.key ?? UNGROUPED`. A row in the plain list is ungrouped by definition (task-groups R31), and a filtered section's key is the filter, which is the row's own group.

### `src/app.js` (owner `fe`)

```js
function moveRow(row, key, message = `Đã chuyển việc "${text}" sang nhóm "${name(key)}".`) {}
// text is the row label after the save. The same message is used for drop and edit form moves (decisions.md).
// Filter hides the target: focus the next row, else the previous one, else the add input; clear #sr-status and
// write the message only to the info slip, notify(message), so screen readers hear it once.
// Target visible: notify(null) clears an older slip, then the wash, focus on Sửa, and the message in #sr-status.

const drag = createDrag({
  list: els.list, template: $("drag-template"), groups: () => groups,
  canStart: () => !editing && !document.querySelector("dialog[open]") && !composing && groups.list().length > 0,
  onStart: () => closeSwipes(),
  onEnd: dropOrCancel,
});

function dropOrCancel(row, key, hadFocus) {}
// key null, the own key, or a group that no longer exists (R12, R21): announce
//   `Đã hủy. Việc vẫn ở nhóm "${name(own)}".` in #sr-status (cleared, then written a frame later, as moveRow does)
//   and focus the row's Sửa with preventScroll when hadFocus (R22). Nothing is written (R36).
// Otherwise: store.setGroup(id, key === UNGROUPED ? null : key), updateSlip(), then
//   moveRow(row, key, `Đã chuyển việc "${text}" sang nhóm "${name(key)}".`) (R13 to R15, R23, R33, R34).
```

`composing` is a flag set by `compositionstart` and cleared by `compositionend` on `document` (R5). `resetTransient()` calls `drag.cancel()` first, so a day move (Back, picker, arrows, midnight) ends a drag (R20). The storage listener calls `drag.cancel()` before `refresh()` for a groups change (R21).

### Markup: `#drag-template` in `index.html` (owner `fe`)

```html
<template id="drag-template">
  <div class="drag-slip" aria-hidden="true"><span class="drag-slip__box"></span><span class="drag-slip__text"></span></div>
  <div class="drop-strip" role="group" aria-label="Thả vào nhóm"><span class="drop-strip__label" aria-hidden="true">Thả vào nhóm</span></div>
  <div class="drop-target"><span class="sticker"></span></div>
  <div class="drag-edge" aria-hidden="true"><svg class="icon" viewBox="0 0 24 24">(chevron from autoscroll.html)</svg></div>
</template>
```

Slip, strip and cue are appended to `body` at pick up and removed at the end (flows.md FE note), so no section paints over the slip and nothing is in the reading order at rest (R10). Task text and group names are set with `textContent` only (R37). `data-color` on a target comes from the group's stored colour, which `groups.js` already maps to `COLORS`.

## How the gesture works

### State machine

```
idle --pointerdown on a row (R4)--> pressed --(mouse/pen: moved > 6 px | touch: 400 ms still)--> dragging
pressed --(release | touch moved > 10 px | pointercancel)--> idle, no drag, the browser does what it does today
dragging --release over a target--> onEnd(row, key)       dragging --anything else--> onEnd(row, null)
```

1. **Press** (`pointerdown` on `#day-list`, primary button only). Ignored unless `e.target.closest(".task")` is a live row (not `.task--exit`, not `.task--editing`) and the target is not inside `.check, button, a, input, select, textarea, .task__edit, .group__toggle` (R4). Remember the row, the start point, `pointerType`, and `hadFocus = list.contains(document.activeElement)` (read now, before the browser moves focus).
2. **Mouse and pen** (R1): a `pointermove` further than 6 px from the start asks `canStart()`; if false the press is dropped and the release is a normal click. No `preventDefault` on `pointerdown`, so a press and release without movement is exactly today's click.
3. **Touch** (R2, R3): add `.task--pressing` (the pen wash, design system) and start a 400 ms `setTimeout`. A move further than 10 px, a `pointerup` or a `pointercancel` before then clears the timer and the class and does nothing else. When the browser starts its own horizontal swipe or vertical scroll it sends `pointercancel`, so the native scroll snap swipe and the page scroll keep their exact distance, direction and feel (R3). When the timer fires, `canStart()` decides.
4. **Pick up** (R6, R7, R9, R27, R29): `onStart(row)` closes every open swipe strip through the existing tracked `closeSwipes()`; `html.is-dragging`; `.task--placeholder` on the row; build the slip (text, `--done` when ticked) and the strip (one target per `groups().list()` in creation order, then Chưa phân nhóm, `--home` on the own key); `window.getSelection().removeAllRanges()`; for mouse and pen `row.setPointerCapture(pointerId)` (in a `try`, a synthetic event in a test has no active pointer). Measure the row rectangle, the slip width and the strip top once.
5. **Follow** (R11, R19, R28): `pointermove` only stores the coordinates and requests one animation frame. The frame sets the slip `transform` (mouse: the grab offset kept; touch: the slip bottom 60 px above the finger; both clamped inside the viewport so there is no horizontal scroll), then hit tests (below), then runs auto scroll.
6. **Release** (`pointerup`): hit test once more at the release point, then end with that key or null. A capturing `click` listener on `window`, added for the next task turn only, swallows the click that follows a drag, so a drop never ticks, opens or follows anything (R7).

### Hit testing

`document.elementFromPoint(x, y)` with the slip and cue at `pointer-events: none` (design system). The target is `el.closest(".drop-target[data-key]")`, else `el.closest("#day-list > .group")` (header, rows, or the empty space of a section, open or folded, R8). A key equal to the row's own key is no target (R12; its strip label is the faded `--home`). Only when the target changes: remove `.group--drop` or `.drop-target--over` from the old one, add it to the new one, and set or remove the `.drag-slip__to` label (a `.sticker[data-color]` with the group name, R28). Hovering never expands a folded section (R14).

### Long press, swipe and page scroll together

1. `touch-action` is left as it is on every element. Changing it after the 400 ms has no effect on a gesture that is already running in Chrome (the value is taken at touch start), and setting `touch-action: none` up front would kill the swipe and the scroll. This replaces the flows.md FE note about `touch-action`.
2. Instead, `#day-list` gets one `touchmove` listener with `{ passive: false }` that calls `preventDefault()` only while a drag runs (R32). Because the finger stayed within 10 px for 400 ms, the browser has not started a scroll, so that first `touchmove` is still cancelable and the page does not move; `pointermove` keeps arriving and no `pointercancel` is sent. Touch events stay targeted at the row where the touch began, so the listener on the list sees them even over the strip. When no drag runs the listener returns at once, and once a native scroll has begun the browser sends the rest of the moves without waiting, so the swipe feel is unchanged.
3. Touch pointers are captured to their start element by the browser already; no explicit capture is needed for touch.
4. `contextmenu` and `selectstart` are prevented while pressing or dragging, so the Android long press menu and text selection do not appear (R7). The existing `-webkit-touch-callout: none` covers the iPhone callout.

### Auto scroll (R31, R32)

While dragging, each frame computes `v = scrollSpeed(y, stripTop)`. When `v` is not 0: show the cue (`.drag-edge--up` at the top, or `.drag-edge--down` with `style.top = stripTop - 64 px`), `window.scrollBy(0, v)`, and hit test again; keep requesting frames while the pointer stays in the zone. When `scrollY` does not change (page end) or `v` is 0, hide the cue and stop. A `scroll` event during a drag (mouse wheel) also requests a hit test. The strip is `position: fixed`, so it never moves with the scroll.

### Cancel and interruptions (R18, R20, R21, NFR4)

While dragging, these all call the same `end(null)`:

1. `keydown` Escape, in a capturing `window` listener with `preventDefault()` and `stopImmediatePropagation()`, so it cannot also reach an edit, a dialog or a field (R18).
2. `pointercancel` and `lostpointercapture` (a call, the OS taking the touch) (R18).
3. `visibilitychange`, window `blur` (R20).
4. A dialog found open (`dialog[open]`) in a frame or at release (R20).
5. `drag.cancel()` from `resetTransient()` (day change) and from the storage listener (R20, R21).

`end` always, in this order: clears the timer and the frame, removes every listener it added, removes `html.is-dragging`, `.task--pressing`, `.task--placeholder`, the target classes, the slip, the strip and the cue, sets the state to idle, and only then calls `onEnd`. Each step is idempotent, so a second `end` or a `cancel()` with nothing running does nothing. This is what keeps a page from staying stuck (NFR4).

## Performance (NFR1, BUG-010, BUG-014)

1. A drag never calls `renderList()` and never queries all rows. Following the pointer touches only the slip `transform`, one `elementFromPoint`, and at most two class changes when the target changes. The e2e test checks that no child is added or removed in `#day-list` while moving (a `MutationObserver` on `childList`, subtree).
2. No geometry is read per move: the row rectangle, the slip width and the strip top are read once at pick up. No `scrollLeft` is read anywhere; swipes close through the tracked `openSwipe` in `closeSwipes()` (BUG-010).
3. Pick up costs one style pass for `html.is-dragging` plus building at most 21 strip targets. `.task--placeholder` turns off `content-visibility` on that one row only.
4. The drop is the settled move path already measured at 10 to 50 ms in Chromium after BUG-010 and BUG-014.
5. The test seeds 200 tasks in 20 groups, waits for the page to settle as the BUG-010 test does, and times pick up and drop in the page with `performance.now()` plus a forced layout, using synthetic `PointerEvent`s dispatched in `page.evaluate`. It also runs the existing add, collapse, filter and move timings again.

## Error handling and security

1. **Storage** (R34): `setGroup` behaves like every store change: a failed or locked write keeps the move in memory and `updateSlip()` shows the existing storage slip. A failed read never leads to a write (task-groups R61).
2. **No partial state** (R36): the drag writes nothing until release on a valid target, and the target's existence is checked at that moment (R21). A cancel touches no storage key.
3. **Untrusted text** (R37, NFR3): task text and group names reach the slip and the strip through `textContent` only. Group ids are used only as `dataset` values and `Map` keys, never in a selector.
4. **CSP**: unchanged. No inline style attributes in markup; positions go through the CSSOM.

## Testing

### How Playwright drives the gestures

1. **Mouse** (desktop project): `page.mouse.move` to the row text, `mouse.down()`, `mouse.move(x, y, { steps: 8 })` to the target, assert the hover state, `mouse.up()`. A plain `click()` on a row is the "no movement" case. Escape is `page.keyboard.press("Escape")` while the button is held.
2. **Touch** (mobile project, Pixel 7, Chromium): a CDP session with `Input.dispatchTouchEvent`, as the existing `touchDrag` helper in `app.spec.js` and `groups.spec.js` does. `longPressDrag(page, from, to)` sends `touchStart`, waits 450 ms (`page.clock.setFixedTime` fixes only the date; timers keep running, Playwright docs), sends `touchMove` in steps to the target and `touchEnd`. A `touchCancel` covers R18 interruption. The existing `touchDrag` (fast horizontal move) checks that the swipe still opens and no drag starts; a fast vertical CDP move checks that the page scrolls and no drag starts. Both helpers move to `helpers.js` so the three spec files share them.
3. **Speed**: synthetic `PointerEvent`s in `page.evaluate`, so the timing is measured inside the page.

### Unit (`node:test`)

1. `store.setGroup`: sets, replaces and removes the group; text with surrounding spaces and a 250 character text are kept byte for byte; `done`, `date`, `createdAt` and `id` unchanged; exactly one `setItem`; unknown id writes nothing; throwing `setItem` keeps memory with `storageOk` false; locked store moves in memory.
2. `scrollSpeed`: 0 in the middle, negative under the top edge, positive in the 64 px above the strip, 0 on the strip itself, larger closer to the edge, capped at `max`.

### End to end (`tests/e2e/drag.spec.js`)

Listed per task in `tasks.md`. QA runs axe on the dragging states and the light and dark contrast check by hand, as in task-groups. Safari and iOS are a manual check after release (NFR6).

### Existing tests

All existing unit and e2e tests keep passing unchanged, apart from the one assertion named in open question 1 if that option is chosen. Clicks in existing tests have no movement after the press, and the existing swipe helper moves 20 px per step, beyond the 10 px abort, so neither can start a drag. No tab stop, accessible name or row attribute changes at rest (R26).

## Requirement mapping

| Req | Satisfied by |
| --- | --- |
| R1 | Mouse and pen 6 px threshold, no `preventDefault` on press |
| R2, R3 | Touch 400 ms timer, 10 px abort, `pointercancel` hands over to native swipe and scroll |
| R4 | Excluded targets list in the press handler |
| R5, R35 | `canStart()` in app.js |
| R6 | `onStart` calls `closeSwipes()` |
| R7 | Click swallow after a drag, `contextmenu` and `selectstart` prevented, `.is-dragging` styles |
| R8, R11 | Hit testing on `.group` and `.drop-target[data-key]` |
| R9, R10 | Strip built at pick up from `groups().list()` plus Chưa phân nhóm, on `body`, removed at the end, no tab stops |
| R12 | Own key is no target; release there is a cancel |
| R13, R14, R15, R16 | `store.setGroup` then `moveRow` (expand, `renderList`, filter focus, any viewed day) |
| R17 | One row per press |
| R18, R20, R21 | Cancel paths, `drag.cancel()` from `resetTransient` and the storage listener, existence check at release |
| R19, R27 to R30 | Design system classes: slip, placeholder, `.group--drop`, strip, `--over`, `--home`, `.drag-slip__to`, reduced motion rules |
| R22, R23 | `dropOrCancel`: announcements in `#sr-status`, focus to Sửa; `moveRow` focus rules |
| R24, R25 | Edit form move unchanged |
| R26 | No row attributes added, no `aria-grabbed` |
| R31, R32 | `scrollSpeed`, auto scroll frame loop, non passive `touchmove` during a drag, fixed strip |
| R33, R34, R36 | `setGroup` single write, storage slip, no write before a valid release |
| R37 | `textContent` only |
| NFR1 | No list rebuild while moving, one time measurements, timed e2e |
| NFR2 | Pointer Events for every input type |
| NFR3 | No network, no new key, CSP unchanged |
| NFR4 | Idempotent `end` that removes everything it added |
| NFR5, NFR7 | Live region texts and Vietnamese strings from the requirements table |
| NFR6 | Standard Pointer and Touch Events; Safari and iOS listed as a manual check |
| Decision: info slip | `moveRow` calls `notify` when the filter hides the target, for both drop and edit form |

## Open questions

1. A move into a group the filter hides now shows the info slip (`role="status"`) and also writes `#sr-status`, so a screen reader may hear the sentence twice. Recommended: in that case write only the info slip, which changes one existing assertion in `groups.spec.js` (the filtered move test). Alternative: keep both and accept the repeat.
2. The edit form move keeps its current live text "Đã chuyển việc sang nhóm "{name}"." while a drop says "Đã chuyển việc "{text}" sang nhóm "{name}".". Recommended: keep it as is (no existing test changes). Alternative: use the longer text for both, which changes five assertions in `groups.spec.js`.
