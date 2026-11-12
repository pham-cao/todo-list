# Design: page-flip

## Approach

This feature changes only how a day change is drawn. The stack stays the same: one static page, `design-system.css`, vanilla ES modules, no build step, no new dependency, `node:test` and Playwright. The CSS for the leaf, the stage and the tokens is already in the "Page flip" section of `docs/project/design-system.css` (approved with the UX), so the build is mostly script.

The day change itself is untouched. `go()` and `syncFromAddress()` in `src/app.js` keep writing the address, rendering the new day, keeping focus and updating the live date line in the same task as today (R10, R18, R19, NFR1). The only change in that path is where `turnPage(from, to)` used to add a class: it now asks a small new module, `src/flip.js`, to copy the old page before the render and to build the leaves after it. The leaves are a purely visual layer on `.sheet`, `aria-hidden`, `inert` and `pointer-events: none`, removed by a timer, never by `animationend`.

It follows two patterns already in the codebase:

1. A gesture or motion with its own state lives in its own module with a small returned API, as `src/drag.js` does (`createDrag` returning `{ cancel, active }`). This keeps `src/app.js` (845 lines) under the "about 900 lines" mark in decisions.md.
2. Every rebuild of the list ends what runs over it: `renderList()` already calls `drag.cancel()` first; it now also calls `flip.end()` (R37).

The prototype's inline script (`ux/screens/flip.html`) is the reference for the stage, the leaf order, the timer and the riffle timing. The real build differs from it in four places:

1. Held key release (decisions.md 2026-11-12, amended R15): the prototype plays nothing on release; the build plays one flip or riffle for the whole distance moved during the repeats.
2. Leaf content is trimmed to the rows that reach into the window (NFR3), and the chosen `<select>` values are copied onto the leaf.
3. The tape re-press plays when a flip is allowed even if the sheet body is scrolled out of view (the tape sits in the header and may still be visible). It does not play under reduced motion, without 3D support, or on a hidden page (R12, R28, R39).
4. A dialog opening ends the flip (R37), through one capturing `toggle` listener.

## Files to create or change

| File | Owner | Change |
| --- | --- | --- |
| `src/date.js` | be | New export `daysBetween(a, b)` |
| `tests/unit/date.test.js` | be | Tests for `daysBetween` |
| `src/flip.js` | fe | New: `leafCount`, `createFlip` (copy, stage, leaves, timer, tape re-press, the listeners that end a flip) |
| `tests/unit/flip.test.js` | fe | New: `leafCount` only (the rest needs a browser) |
| `src/app.js` | fe | Remove `TURNS`, `turnPage`, `endTurn`; create the flip; one shared `changeDay` used by `go` and `syncFromAddress`; `flip.end()` in `renderList`; held key tracking (R15) |
| `tests/e2e/helpers.js` | fe | `watchFlips(page)` and `flipsSeen(page)`; row and label locators scoped to `#day-list` so leaf copies never match |
| `tests/e2e/day-nav.spec.js` | fe | The T7 page turn tests rewritten against the stage instead of the `turn--` classes |
| `tests/e2e/flip.spec.js` | fe | New: this feature's end to end tests |
| `docs/project/design-system.css`, `docs/project/design-system.md` | fe | Remove the superseded `.turn--back`, `.turn--forward`, their keyframes and `--dur-turn`; keep `.washi--restick` |
| `package.json`, `package-lock.json`, `index.html`, `src/*.js` | be | Version `1.4.0` in the release task |

No change to `index.html` markup, `store.js`, `groups.js`, `manage.js`, `drag.js`, `playwright.config.js` or the Content-Security-Policy. Inline geometry is set through the CSSOM (`style.setProperty`), which `style-src 'self'` allows, as the drag slip and the progress ring already do.

## Data model

None. No key, field or write is added, changed or delayed (R27, R40). The flip reads only the rendered DOM.

## Interfaces

### `src/date.js` (owner `be`)

```js
// Calendar days from key a to key b: positive when b is later, 0 for the same day, null when either key is invalid.
// Local midnights, rounded, so a 23 or 25 hour day still counts as 1.
export function daysBetween(a, b) {}
```

### `src/flip.js` (owner `fe`)

```js
import { daysBetween } from "./date.js?v=1.3.0";

// Leaves for a move of `days` calendar days (sign ignored): 0 for 0, 1, 2, then 3 for 3 or more (R3).
export function leafCount(days) {}

export function createFlip({ sheet, body, date }) {}
// sheet: .sheet (the stage's positioned parent), body: .sheet__body (what is copied), date: #date-line (the tape)
// returns { snapshot(from, to), play(from, to, page), end() }
//
// snapshot(from, to): call BEFORE the new day renders. Returns a copy of the visible old page when a forward flip may
//   play (to > from and allowed()), else null. Back flips copy the new page in play() instead (R4).
// play(from, to, page): call AFTER the new day renders. Ends any running stage, then, when allowed() and from !== to:
//   re-presses the tape once (R12), and if any part of the sheet body is in the window builds one .flip-stage with
//   leafCount(daysBetween(from, to)) leaves and schedules its removal. Never throws: a failure is caught and ends the stage.
// end(): removes the stage and clears the timer at once. Safe to call at any time; does nothing when no stage runs.
```

`allowed()` (internal) is `!reduced.matches && CAN_3D && !document.hidden`, where `reduced` is `matchMedia("(prefers-reduced-motion: reduce)")` and `CAN_3D` is `CSS.supports("transform", "rotateY(1deg)") && CSS.supports("perspective", "1px")`, read once at `createFlip` (R7, R28, R39). The module touches no DOM at import time, so `leafCount` can be unit tested in Node.

`createFlip` registers its listeners once, never per move (NFR4):

| Listener | Action | Requirement |
| --- | --- | --- |
| `reduced` `change`, when it now matches | `end()` | R29 |
| `document` `visibilitychange`, when hidden | `end()` | R7, R38 |
| `document` `toggle` (capture), `newState === "open"` | `end()` (a dialog or popover opened) | R37 |
| `date` `animationend` and `animationcancel` on itself | remove `washi--restick` | R9, R12 |

`toggle` on `<dialog>` is supported from Chrome 132, Firefox 133 and Safari 26. On an older browser the leaf simply ends on its own timer under the modal's top layer, which is harmless.

### `src/app.js` (owner `fe`)

```js
import { createFlip } from "./flip.js?v=1.3.0";
const flip = createFlip({ sheet: document.querySelector(".sheet"), body: els.sheetBody, date: els.date });
// Created next to createDrag, before the first renderDay().

// One day change, shared by go() and syncFromAddress(). The address is written by the caller, as today.
function changeDay(key, repeat = false) {
  const from = viewed;
  const onRow = rowFocus();          // read before the drag is cancelled (drag.active() counts)
  resetTransient();
  drag.cancel();                     // R25: the drag ends before the old page is copied, so no placeholder on the leaf
  flip.end();                        // R14: the running flip or riffle goes, all leaves together
  if (repeat) held ??= { from, page: flip.snapshot(from, key) }; // R15: first repeated move remembers the start
  else held = null;                  // a non repeat move is the release, and R14 replaces its motion at once
  const page = repeat ? null : flip.snapshot(from, key);
  viewed = key;
  renderDay();                       // content, picker, live date line: unchanged and immediate (R10, R19)
  if (onRow) focusAddIfLost();       // focus as day-navigation R8 (R18)
  if (!repeat) flip.play(from, key, page);
}

function go(key, repeat = false) {}  // as today, with writeAddress(key, true) then changeDay(key, repeat)
// syncFromAddress(): as today, with changeDay(key) in place of resetTransient, turnPage, viewed, renderDay, focus.
// renderList(): flip.end() next to the existing drag.cancel() at the top (R37: storage refresh, midnight, adds).
```

### Held key repeat (R15, owner `fe`, in `src/app.js`)

```js
let repeating = false; // the last keydown was an auto repeat
let held = null;       // { from, page } while repeated moves run
document.addEventListener("keydown", (e) => { repeating = e.repeat; }, true);
function release() {
  repeating = false;
  if (!held) return;
  const { from, page } = held;
  held = null;
  if (from !== viewed) flip.play(from, viewed, page); // whole distance, R3 leaf count, R4 direction; none if back at start
}
document.addEventListener("keyup", release);
document.addEventListener("focusout", release);  // focus leaves the control
window.addEventListener("blur", release);        // the window loses focus
// existing visibilitychange listener: when hidden, release(); play() refuses on a hidden page, so no motion (R7)
```

Callers pass the flag:

1. Arrows: `click` passes `repeating && e.detail === 0` (a keyboard click; a mouse click has `detail >= 1`).
2. Picker: `change` passes `repeating` (a held arrow key in the date field steps the date with `repeat` true).
3. Về hôm nay, popstate and hashchange never repeat.

Enter activates a button on keydown, after the capturing listener has set the flag. Space activates on keyup: `release()` runs in the keyup dispatch, before the click, so a Space press is never mistaken for a repeat. A non repeat move during a hold clears `held` in `changeDay` and plays its own flip from the day on screen, which is what "release, then R14" amounts to.

## How the flip works

### Copy of a page (`copy()`, internal)

1. Clone each child of `.sheet__body` with `cloneNode(true)`. Inputs keep their value and checked state (HTML cloning steps); `<select>` does not, so each cloned select gets the original's `value`.
2. Remove every `id` in the copy, so `getElementById`, labels and `aria-*` references never find a leaf node.
3. Trim (NFR3): walk the original `.task` rows in order with `getBoundingClientRect()`; from the first row whose top is below `innerHeight`, remove the matching cloned rows. Rows above the window stay, so `--flip-offset` still lines the copy up with the page. With 200 rows a leaf holds about the 15 visible ones.
4. Nothing is built with `innerHTML` and nothing comes from the address or from stored text as markup (NFR6).

### Stage (`play()`)

Taken from the prototype `startFlip`:

1. Measure `.sheet` and `.sheet__body`; the visible part is `max(body.top, 0)` to `min(body.bottom, innerHeight)`. Under 1 px: no stage (the tape still re-presses).
2. `back = to < from` (keys compare as text, R5). `n = leafCount(daysBetween(from, to))`. Back: `page = copy()` of the new page.
3. One `div.flip-stage` (`flip-stage--back` when back) with `aria-hidden="true"`, `inert`, and `--flip-top`, `--flip-h`, `--flip-offset` set inline (R11, R13).
4. For `k` in `0..n-1`: a `.leaf-cast` then a `.leaf` (`.leaf--blank` unless `k === n - 1`), both with `--i = back ? k : n - 1 - k`. The top leaf holds `.leaf__content` with the copy. Every leaf gets `.leaf__back` and `.leaf__shade` (R3, R4, R8).
5. Append to `.sheet`. Tape: remove `washi--restick`, read `offsetWidth`, add it (once per move, R12).
6. `setTimeout(end, durFlip + (n - 1) * durStep + 17)`, with both durations read from the `--dur-flip` and `--dur-riffle-step` tokens (R3a, R9, NFR7).

### What ends a flip

| Event | Path | Requirement |
| --- | --- | --- |
| Timer | `end()` | R9 |
| A new move | `changeDay` calls `flip.end()` | R14, R16, R17 |
| A held key repeat | `changeDay` with `repeat` | R15 |
| Any list rebuild (add, delete, storage refresh, filter, midnight) | `renderList` calls `flip.end()` | R37 |
| A dialog or popover opens | `toggle` listener | R37 |
| Reduced motion on | media query listener | R29 |
| Page hidden | `visibilitychange` | R7, R38 |
| Window blur | nothing: the timer finishes within 700 ms while the page is visible | R38 |
| System theme change | nothing: the leaf reads the tokens live, so it repaints in the new theme | R36 |

## Error handling and security

1. The flip is cosmetic (NFR7). `play()` wraps its work in `try` and calls `end()` on any error, so a failure leaves the settled page and never stops the day change, which has already happened.
2. The stage can never block the page: `pointer-events: none`, `inert`, `aria-hidden`, `user-select: none`, clipped to the sheet with `overflow: clip`, removed by a timer that does not depend on animation events (R11, R13, R31, R37).
3. Reduced motion is checked in script (no stage is built) and in CSS (any stage is hidden), as the design system specifies (R28).
4. No data is read or written by the flip (R27, R40). The copy comes from the app's own rendered DOM.

## Test strategy

Unit (`node --test`):

1. `daysBetween`: same day, 1 and -1, month and year ends, 29 February 2028, 2000-01-01 to 2099-12-31, invalid keys giving null.
2. `leafCount`: 0, 1, 2, 3, 4, 30 and negative values.
3. `version.test.js` after the release bump (it already covers the new `./flip.js` import).

End to end (Playwright, Chromium desktop and Pixel 7 projects, run with `--workers=2`):

1. `watchFlips(page)`: an init script with a `MutationObserver` that records every `.flip-stage` added (time, back or forward, leaf count, blank count, `aria-hidden`, `inert`) and its removal time, so a 450 ms stage cannot slip between two checks. It replaces `watchTurns`.
2. Entry points, direction and leaf count by distance; no flip on load, reload, midnight, invalid hash and same day.
3. Lifetimes: removal at 450, 575 and 700 ms plus a tolerance; zero `.flip-stage` and `.leaf` nodes after 30 presses.
4. Held key with `keyboard.down` repeated (Playwright sets `repeat` true on the second `down` of the same key) and `keyboard.up`.
5. Work during a flip: typing, adding, ticking, focus, tab order, axe with a stage present.
6. Interruptions: storage event, dialog, reduced motion switched on, hidden page, drag at the day change, no 3D support (an init script making `CSS.supports` return false for `rotateY`).
7. Layout: no horizontal scroll and no growth of the scroll height at 360, 390 and 1440 px during a flip; dark mode leaf back colour from the dark token.
8. Speed: the existing day-navigation NFR1 test passes unchanged with the flip on; a 3 leaf riffle between two 200 task days records no `longtask` entry, median frame time at most 18.2 ms and no frame over 50 ms (Chromium, median of 3 runs as accepted for drag-drop).

Manual (release note): Safari and iOS, and a mid range Android phone for NFR2.

## Requirement mapping

| Requirement | Satisfied by |
| --- | --- |
| R1, R2, R3, R3a | `leafCount`, `daysBetween`, `play()` timing from the tokens |
| R3b, R5 | `syncFromAddress` through `changeDay`; direction by key comparison |
| R4 | `play()`: `flip-stage--back`, leaf order and `--i`; back copies the new page |
| R6 | `play()` is only called from `changeDay`; load and `checkDay` never call it; `go` returns early on the same day |
| R7, R38 | `allowed()` checks `document.hidden`; `visibilitychange` ends; blur lets the timer finish |
| R8 | Design system leaf CSS; `copy()` |
| R9 | Timer removal; `end()` removes the whole stage; restick cleared on its own animation end |
| R10, R18, R19, R20 | `changeDay` renders, focuses and announces before `play()`; the stage is `aria-hidden` and `inert` |
| R11 | Stage attributes; ids removed from the copy |
| R12 | Tape re-press once in `play()` |
| R13, R33 | Stage geometry inside `.sheet`, `overflow: clip`, `contain` |
| R14, R16, R17 | `flip.end()` at the start of every `changeDay` |
| R15 | `repeating`, `held`, `release()` in `app.js` |
| R21 to R24 | Nothing waits for the flip; the stage ignores pointer and focus |
| R25, R26 | `drag.cancel()` in `changeDay` before `snapshot()`; drag-drop's own cancel paths |
| R27, R40 | The flip never touches the store |
| R28, R29, R39 | `allowed()`; reduced motion listener; CSS fallback |
| R30, R31, R32 | One code path for every pointer type; no swipe added |
| R34, R35, R36 | Design system tokens (UX measured contrast); live tokens on theme change |
| R37 | `flip.end()` in `renderList`; `toggle` listener |
| R41 | `go`, `syncFromAddress`, `checkDay` and drag behaviour unchanged apart from the motion call |
| NFR1, NFR2, NFR3, NFR4 | Copy trimmed to the window; stage built in the same task; listeners registered once; zero nodes after the timer |
| NFR5 | R11, R18 to R21, R28 |
| NFR6 | No new dependency; DOM clone only |
| NFR7 | Timer plus `try`; every end path above |
| NFR8 | Manual Safari and iOS checks in the release note |
| NFR9 | New `flip.js` import carries the version query |
| NFR10 | No new text |
