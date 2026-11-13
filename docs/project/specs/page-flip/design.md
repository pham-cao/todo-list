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

## Change 2026-11-12: whole sheet flip, always flip, 700 ms

Source: decisions.md, "2026-11-12 page-flip motion fix" and "2026-11-12 page-flip scope change after the owner saw the flip" (both chosen by the owner). This section overrides anything above that conflicts with it: the stage over the sheet body only, the tape re-press, every reduced motion check, and the 450 and 600 ms timings. Requirement numbers below are the ones the BA is amending in parallel (R8, R12, R28, R29, R39, R3, R3a, NFR5, NFR7).

### What changes, in short

1. The whole sheet turns: the header band (title, nav, date tape, progress, summary, slips) and the sheet body, as one leaf hinged on the punched holes.
2. The flip always plays. `prefers-reduced-motion` is ignored for the flip, and there is no off switch. A hidden page and a browser without 3D transforms still change the day with no flip (R7, R39).
3. The date tape re-press is gone, with its class, listeners and tests.
4. `--dur-flip` is 700 ms; `--dur-riffle-step` stays 125 ms, so a 3 leaf riffle lasts 950 ms and the end timer is 967 ms.

The day change path in `src/app.js` (`changeDay`, held key repeat, `renderList` hook) does not change. All of the work is in `src/flip.js`, the Page flip block of `design-system.css` and the tests.

### What is copied

`copy()` takes the contents of `.sheet` instead of `.sheet__body`: `range.selectNodeContents(sheet)`, ended before the first row below the window as today. The result is the full `<header class="app-header">` followed by a shallow `.sheet__body` holding the rows above the cut, so the trim (NFR3) and the row heights (`fit`) work exactly as now. At copy time `.sheet` holds only the header and the body: `flip.end()` has removed any stage and `drag.cancel()` any slip.

Changes inside `copy()`:

1. The select values are read from `sheet.querySelectorAll("select")`, the same root as the range (the header has no select today, so the prefix rule still holds).
2. The attribute strip also removes `aria-live` and `role`, so the copied date line, summary, status and storage slip can never announce, even in a browser that leaks an `aria-hidden` subtree (R11, R19). `id` and `for` are removed as now.
3. `progress--celebrate` is removed from the copy, so the stamp and bloom never replay on the leaf when the owner ticks the last task and moves within 520 ms. It is the only header class with a one shot animation.
4. The cloned date input keeps its value (HTML cloning copies an input's value), so the old page's picker shows the old date on a forward leaf.

The header copy is a few dozen nodes, so NFR1 and NFR2 are unaffected; T8's timing tests confirm it.

### How the stage covers the sheet and stays inside it

`place(s)` measures only `.sheet`:

```js
const sr = sheet.getBoundingClientRect();
const top = Math.max(sr.top, 0), bottom = Math.min(sr.bottom, innerHeight); // the part of the sheet in the window
s.style.setProperty("--flip-top", `${top - sr.top}px`);    // stage top in sheet coordinates
s.style.setProperty("--flip-h", `${bottom - top}px`);
s.style.setProperty("--flip-offset", `${top - sr.top}px`); // how much of the sheet is above the window
```

1. The stage stays `position: absolute; left: 0; right: 0` on `.sheet` with `overflow: clip` and `contain: layout paint style`, so it can never be wider or taller than the visible part of the sheet, never covers the desk, and adds no scroll area (R13).
2. Unscrolled, the stage starts at the sheet top (`--flip-top: 0`) and covers the header band. Scrolled, it starts at the window top, and the copy is shifted up by `--flip-offset` as now.
3. `--flip-top` and `--flip-offset` now always hold the same value. Both stay, because the CSS uses them for different things (the stage position and the holes, the content and rule shift) and merging them would only churn the CSS and tests.
4. The leaf takes `border-radius: var(--radius-paper)` (3 px), so its top corners match the sheet when the stage starts at the sheet top. When the stage starts mid sheet the 3 px rounding at the window top is invisible.
5. `z-index: 3` stays. No header element has a z-index, so the leaf is drawn over the whole header; nothing in the header can poke through it.

### `--flip-offset`, the ResizeObserver and a sheet that starts at the top

1. `--flip-offset` is measured from the sheet top, not the body top. The copy starts with the header, so the copy's rows sit exactly where the page's rows sat; `.leaf__content` is shifted up by the same amount as today.
2. The ResizeObserver keeps observing `.sheet__body`. The header is rendered in the move's own task and holds no `content-visibility` rows, so it never changes size after `play()` measured it. The rows growing out of their placeholders resize the body, which resizes or moves the sheet, and the callback then re-runs `place()` (now on the sheet rect) and, for a back flip, `fit()`. Observing `.sheet` as well would add nothing, because the sheet's height follows the body.
3. The punched holes on the leaf keep `0 calc(22px - var(--flip-top))`, which now lines up with the sheet's holes in every position.

### Header height differences between days

The header can be a different height on the old and new day: the title wraps on today at 360 px, the progress and summary show only when the day has tasks, and a slip may be open. This needs no measuring:

1. A forward leaf holds the old header and old rows, laid out in the leaf at the sheet width, so it is the old page exactly as it stood, however tall its header was. The new page beneath may have its rows higher or lower; that is a different page being revealed.
2. A back leaf holds the new header and new rows, so when it lands it matches the page beneath exactly.
3. Ruled lines: the leaf background becomes plain paper (grain and `--color-paper`), and the rules come from the copied `.sheet__body`, which keeps its class and so its ruled background, placed right under the copied header. To make the copied body reach the bottom of the leaf on a short day (the real body stretches with `flex: 1`), `.leaf__content` becomes `display: flex; flex-direction: column; min-height: calc(100% + var(--flip-offset, 0px))`; the copied `.sheet__body` already has `flex: 1`. So the unruled header band, its double rule and the ruled body on the leaf all come from the copy at the right height, with no header height variable.
4. Blank riffle leaves (`.leaf--blank`) keep the ruled paper background over their whole height, as today. They have no header band; they are blank pages flashing past at 125 ms steps. If the owner wants a header band on blank pages, it is a later CSS change with a `--flip-head` variable.
5. `.leaf__back` keeps its faded rules over the whole leaf (the back of a page).

### Tape re-press: removed

1. `src/flip.js`: remove the three `washi--restick` lines in `play()`, the `unstick` function and its `animationend` and `animationcancel` listeners, and the `date` parameter. `createFlip({ sheet, body })` is the new signature; `src/app.js` stops passing `date`.
2. `docs/project/design-system.css`: `.washi--restick`, `@keyframes restick` and their reduced motion rule sit in the Day navigation block next to the superseded `.turn--*` rules. Nothing uses them after this change, so T9 removes them with the turn rules.
3. Tests: `watchFlips` stops recording `__resticks`, `resticksSeen` is removed from `helpers.js`, and every assertion on the tape press is deleted (listed below). A grep in T9 proves `restick` is gone from `src`, `index.html`, the design system and the tests.

### Reduced motion: removed, fallbacks kept

1. `src/flip.js`: remove `reduced`, its `change` listener and the reduced motion part of `allowed()`, which becomes `CAN_3D && !document.hidden`. The `visibilitychange` and capturing `toggle` listeners stay. Listeners are still registered once (NFR4).
2. `design-system.css`, Page flip block: remove `@media (prefers-reduced-motion: reduce) { .flip-stage { display: none; } }`.
3. The global reduced motion rule near the top of the file sets `animation-duration: 1ms !important` on every element, which would end every leaf in 1 ms. The Page flip block adds the one override that keeps the flip whole:

```css
@media (prefers-reduced-motion: reduce) {
  .flip-stage, .flip-stage * { animation-duration: var(--dur-flip) !important; } /* the flip always plays (owner, 2026-11-12) */
}
```

Both declarations are `!important`, and `.flip-stage *` is more specific than `*`, so it wins whatever the order. The global rule does not touch `animation-delay`, so the riffle steps are unchanged. Every other reduced motion rule in the app (the swipe hint, the bloom, the drag tilt, the moved row wash) stays as it is.

4. Kept: no stage on a hidden page (R7), no stage without 3D support (R39), the `try` and `end()` around `play()`, the timer with its 2x backstop until the first frame, and every other end path in "What ends a flip" except the reduced motion row, which goes.

### Focus under the leaf

The real nav sits under a forward leaf for up to 700 ms (950 ms in a riffle), so the focus ring on the arrow the owner pressed is covered while the leaf lifts away. Focus itself never moves (R18) and clicks pass through to the real controls, so a second press lands on the real arrow. See the open question in the hand-off; the recommendation is to accept it, because the cover lasts under a second and ends on its own.

### Timing

`--dur-flip: 700ms` in the Page flip block. Everything else reads the token: the end timer is `700 + (n - 1) * 125 + 17` ms, so 717, 842 and 967 ms, with the 2x backstop until the first frame. Tests stop hard coding 600 and 850: `flip.spec.js` gets `DUR = 700` and `STEP = 125` at the top and derives every lifetime and wait from them.

### Files to change

| File | Task | Change |
| --- | --- | --- |
| `src/flip.js` | T8c | Drop `reduced`, its listener, the tape re-press, `unstick` and the `date` parameter |
| `src/app.js` | T8c | `createFlip({ sheet, body })`; comment on the flip line |
| `docs/project/design-system.css` (Page flip block) | T8c | `--dur-flip: 700ms`, comments for 950 ms, reduced motion hide replaced by the duration override |
| `src/flip.js` | T8d | `copy()` and `place()` on the whole sheet; strip `aria-live`, `role` and `progress--celebrate` in the copy |
| `docs/project/design-system.css` (Page flip block) | T8d | `.leaf` paper only, `.leaf--blank` ruled, `.leaf__content` flex column with min-height, leaf radius, block comment |
| `docs/project/design-system.md` (Page flip section) | T8c, T8d | Tokens table, motion text, stage, tape, lifetime and reduced motion lines; the backstop clause |
| `docs/project/design-system.css`, `.md` (Day navigation block) | T9 | Remove `.turn--*`, `--dur-turn`, their keyframes, `.washi--restick`, `@keyframes restick` and their reduced motion rule |

### Tests that must change

`tests/e2e/helpers.js`:

1. `watchFlips`: drop the `__resticks` recording; remove `resticksSeen` and its imports in both spec files.
2. `progress = page.locator('.progress')` becomes `#progress`, so the leaf copy never matches it.

`tests/e2e/flip.spec.js` (T8c, always flip and 700 ms):

1. Every lifetime and wait derived from `DUR` and `STEP`: `lifetime(n)`, the "within 700 ms" first test, the 30 press wait, the blur and theme waits, and the timer edge test (presses at 699, 700 and 701 ms, then at the 717 ms edge).
2. "the date tape is pressed once per move" is deleted; tape assertions in the no stage on load, hidden page, no 3D, scrolled page and swipe tests are deleted, leaving their stage assertions.
3. "reduced motion switched on during a riffle removes it at once" becomes: reduced motion switched on during a riffle leaves it running to its normal end, and a move under reduced motion builds a stage with the normal leaf count and lifetime.
4. "under reduced motion CSS hides a stage injected by hand" becomes: under reduced motion a real move's stage is displayed and every leaf animation has a duration of `DUR` (`getAnimations` timing).
5. The T8b `perceptible` real time check runs once more with `reducedMotion: 'reduce'` emulated (one forward flip and one riffle at 1440 px).

`tests/e2e/flip.spec.js` (T8d, whole sheet):

1. New: a forward leaf's copy holds the old title, the old date line text and the picker value of the old day; a back leaf's copy holds the new date line; the copy has no `id`, `for`, `aria-live` or `role`.
2. New: unscrolled, the stage top equals the sheet top and its height is the visible part of the sheet; scrolled, it starts at the window top; in both it stays inside the sheet box (the T7 `inside` check already does this and keeps passing).
3. New: with the stage present, `document.elementFromPoint` at the centre of the next arrow returns the real `#next-day`, and a second click there moves the day again (R31, R14).
4. New: a move from today at 360 px (the title wraps) to tomorrow and back: the forward leaf's labels line up with the old page's labels measured from the sheet top, and the back leaf's with the new page's.
5. Changed: `scrolledMove` measures boxes from the sheet top instead of the body top, and `linedUp` compares `--flip-offset` with `-sheet.top`.
6. Changed (T7-09, contrast, with the T8b reviewer minor): add a 72 percent frame (28 percent for back), and sample the copied title ink on paper and the date line ink on the darker washi stripe, with the same shade and back layers, at 4.5:1 while the back is under 1.
7. T8 trim and select tests keep passing unchanged (the header holds no `.task` and no select).

`tests/e2e/day-nav.spec.js` (T7 block only):

1. "after midnight ... no page turn plays": `.flip-stage` only, no restick locator or log.
2. "a move flips a leaf by direction and the stage and tape class go": the tape assertions go.
3. "loading a day plays no page flip": the restick assertion goes.
4. "with reduced motion a move changes the day and plays no page flip" becomes: with reduced motion a move changes the day at once and plays one flip by direction.

Other spec files: any unscoped header selector or `getByText` that would match the leaf copy while a stage is present is pointed at the real id (`#page-title`, `#date-line`, `#summary`, `#progress`), as the T2 exception did for the body. Run the whole suite to find them; none may weaken an assertion.

### Requirement mapping for this change

| Requirement (as amended) | Satisfied by |
| --- | --- |
| R8 whole sheet leaf on the holes | `copy()` and `place()` on `.sheet`; leaf CSS (paper, flex copy, radius) |
| R3, R3a 700 ms, 950 ms riffle | `--dur-flip: 700ms`; timer from the tokens |
| R12 tape re-press dropped | Restick code, listeners, tests and CSS removed (T8c, T9) |
| R28, R29 always flip | `allowed()` without reduced motion; the CSS duration override; reduced motion tests inverted |
| R7, R39 fallbacks kept | `allowed()` keeps `document.hidden` and `CAN_3D` |
| R11, R19 copy is never read or announced | `aria-hidden`, `inert`; `id`, `for`, `aria-live`, `role` stripped |
| R13 inside the sheet | Stage on the visible part of `.sheet`, `overflow: clip` |
| R18, R31 focus and clicks | Real header under an inert, pointer free leaf; `elementFromPoint` test |
| R35 contrast | T7-09 with the header inks and the 72 percent frame |
| NFR1 to NFR4 | Copy trim unchanged; header copy is small; T8 tests rerun |
