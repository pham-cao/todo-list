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

## Change 2026-11-13: soft paper bend

Source: decisions.md, "2026-11-13 page-flip soft paper bend" (chosen by the owner). The owner finds that the leaf turns flat like stiff card and wants the curve of soft paper, built with strips that really bend, CSS transform and opacity only, no new library. This section builds on "Change 2026-11-12" (whole sheet, always flip, 700 ms) and overrides anything above that conflicts with it: the leaf as one flat plane, the shade as one gradient across the leaf, and Q1's "simple hinged leaf". It runs as task T8e after T8d. The requirement text that changes (R8, and item 2 of Out of scope, which still names a real curl) is for the BA to amend; the design below is written against "R8 as amended: the leaf bends like soft paper".

### Approach in short

Each leaf is cut into N vertical strips that are nested inside one another. The outer `.leaf` keeps today's turn on the rings (`leaf-turn`, `--ease-flip`, unchanged). Every strip after the first is a child of the one before it, hinged on its parent's right edge, and adds the same small extra turn (a kink) to its parent's. Because each strip starts exactly where its parent ends, the strips can never come apart, and because every kink is equal, the leaf takes the shape of a smooth arc. The kink is 0 at the start and the end of the turn and largest mid turn, and it bends the outer part of the leaf back towards the page, so the free edge trails the rings. Each strip holds its own copy of the page, shifted left by the strip's position and clipped to its slice, so the words run across the strips unbroken. A flat shade on each strip follows that strip's own angle, so the light changes along the curve. Everything is still `transform` and `opacity`, and the change sits in `src/flip.js` (`play()`, `fit()`, `place()`) and the Page flip block of `design-system.css`. `src/app.js` does not change.

It follows the existing patterns: tokens in the Page flip block that the script reads with `ms()` (as `--dur-flip`), inline custom properties set by the script and turned into geometry by CSS (as `--i`, `--flip-top`, `--flip-offset`), one end path, and real time motion checks in the style of TC-page-flip-T8-11.

### How many strips, and why

| Width | Strip 0 (stiff, at the rings) | Bending strips | N | Kink at the peak | Polyline error at the peak |
| --- | --- | --- | --- | --- | --- |
| Desktop, 800 px sheet | holes plus margin column, 56 + 64 = 120 px | 7 of about 97 px | 8 | 28 / 7 = 4.0 degrees | about 0.9 px |
| Phone, 360 to 390 px (below 601 px) | 24 + 48 = 72 px | 5 of 58 to 64 px | 6 | 28 / 5 = 5.6 degrees | about 0.8 px |

1. Strip 0 is the punched hole strip and the margin column. That is where the rings hold the paper, and it carries the holes and the double margin line, which would look odd if they bent. The bend starts at the margin line.
2. N is the smallest count where the bent leaf reads as a curve and not as folds: with an arc of 28 degrees in total, the straight strips stay within 1 px of the true arc (the sagitta of each chord), so no corner is visible, and the kink between two strips stays at or under about 6 degrees, so the shade steps from strip to strip are too small to see (about 0.008 of alpha each).
3. N is also the number of page copies (below), so every extra strip is an extra copy to lay out. Doubling it would buy nothing visible and double the cost.
4. N lives in one token, `--flip-strips: 8` (6 below 601 px), which the script reads at each move. If T8e's speed tests fail on a device class, lowering the token is the first remedy, before anything cleverer.

### Structure of one leaf

```
.leaf                      turn on the rings (leaf-turn), transform-style: preserve-3d, no paint of its own
  .leaf__face  --k: 0      strip 0: paper, holes, margin line, a copy of the page, .leaf__back, .leaf__shade
  .leaf__strip             hinged on face 0's right edge, adds one kink (leaf-bend), preserve-3d
    .leaf__face  --k: 1    strip 1: paper, its copy shifted left, back, shade
    .leaf__strip
      .leaf__face --k: 2
      ...
        .leaf__face leaf__face--edge  --k: N-1   the free edge: pencil line and edge shadow
```

1. `.leaf` stays the outer element with `--i`, its delay, `leaf-turn` and `transform-origin` on the rings, so `leafCount`, the leaf order, the riffle steps, `.leaf--blank` and every `.leaf` count in the tests stay as they are. It loses its paint (background, `box-shadow`, `border-radius`, `overflow: clip`): a 3D chain must not clip, so all paint and clipping move to the faces. It gains `transform-style: preserve-3d`.
2. `.leaf__strip` (k from 1 to N-1): `position: absolute; top: 0; bottom: 0; right: 0`, with `left` at the end of the face before it (`calc(var(--holes-w) + var(--margin-w))` for the first, `var(--strip-w)` for the rest), `transform-origin: 0 50%`, `transform-style: preserve-3d`, no background and no clipping. It runs `leaf-bend`.
3. `.leaf__face`: `position: absolute; top: 0; bottom: 0; left: 0; overflow: clip`, as wide as its slice plus 1 px. The extra pixel tucks under the next strip and hides any anti aliasing hairline at the joint; since every face shows the same page at the same sheet position, the overlap shows the same pixels. `.leaf__face--edge` reaches the right end (`right: 0`, no extra pixel) and takes today's free edge `box-shadow`; face 0 and the edge face take the `--radius-paper` corners.
4. Paper on the faces: `background: var(--grain), var(--color-paper)`; on `.leaf--blank` faces, today's ruled background. Rules are horizontal, so a face needs no horizontal offset for them. The holes (`::before`) and the double margin line (`::after`) move from `.leaf` to face 0, which is always at least `--holes-w + --margin-w` wide, so they keep today's positions.
5. Per face, the script sets only `--k`. CSS derives the rest from it and from two values on the stage, `--flip-n` (strips built) and `--flip-w` (sheet width):

```css
.flip-stage {
  --flip-sign: 1;  /* forward: the free edge trails towards the page */
  --strip-w: calc((var(--flip-w) - var(--holes-w) - var(--margin-w)) / max(1, var(--flip-n) - 1));
  --flip-kink: calc(var(--flip-sign) * var(--flip-bend) / max(1, var(--flip-n) - 1));
}
.flip-stage--back { --flip-sign: -1; } /* back: the free edge trails in the air */
.leaf__face {
  --x: calc(min(var(--k), 1) * (var(--holes-w) + var(--margin-w)) + max(var(--k) - 1, 0) * var(--strip-w)); /* sheet x */
  --flip-u: calc(var(--flip-sign) * var(--k) / max(1, var(--flip-n) - 1)); /* 0 at the rings, 1 at the free edge */
}
.leaf__face > .leaf__content { left: calc(-1 * var(--x)); right: auto; width: var(--flip-w); }
```

The `max(1, ...)` keeps N = 1 (the fallback) free of a division by zero; then there is no strip, face 0 is also the edge face, and the leaf is today's flat leaf.

### The copies (one per strip)

A face can only show pixels it holds, and no native feature paints one element's content into another in every browser (`element()` is Firefox only), so each strip carries its own copy of the page. This is the cost of a real bend.

1. `copy()` is unchanged: one Range clone of the sheet, trimmed below the window (NFR3), `fit()` heights, ids, `for`, `aria-live`, `role` and `progress--celebrate` stripped.
2. `play()` puts it in face 0's `.leaf__content`, then fills faces 1 to N-1 with `first.cloneNode(true)`. A clone keeps inline row heights, input values and checked state, but not a select's chosen value, so the selects of each clone take the values of the first copy's selects (the same loop `copy()` already runs). No clone gets an id back, since the first copy has none.
3. Blank riffle leaves get the same strips and faces with no copy, so a riffle adds 2 x N light faces and no text.
4. Cost against the budgets:
   1. NFR1 (under 100 ms in the move's task): N - 1 `cloneNode` calls of the trimmed copy, a few hundred nodes each at most (header plus the rows that reach into the window). That is well under a millisecond each on desktop; T8e reruns the existing "under 100 ms" tests unchanged.
   2. First frame: the browser lays out N copies instead of one. This is the main cost and it grows with N. Paint does not grow much: each face is clipped to its slice, so the painted area of a leaf stays about one page.
   3. NFR2 (median frame at or below 18.2 ms, no frame over 50 ms, no long task): after the first frame only transforms and opacities change, all on the compositor, so the turn itself costs what it costs today plus N - 1 more 3D layers per leaf (about 45 layers in a full riffle at N = 8). T8e reruns the T8 frame tests and also checks that every measured run really used N strips, so a run that quietly fell back to one strip cannot pass for a bent one.
   4. NFR4: the faces and strips live inside the stage, so `end()` still removes everything at once, and no listener is added per strip.

### How the curve moves over time

The turn angle of `.leaf` (θ, from 0 to 92 degrees, eased by `--ease-flip`) is unchanged. The total bend B (the sum of all kinks) follows θ so that it is 0 at the start and the end, largest mid turn, and never large enough to push the free edge through the page or past the rings: with p = θ / 92, B = 28 x 16 p² (1 - p)² degrees, sampled from the eased turn every 10 percent of `--dur-flip` and written as keyframes of a fraction of the peak. A new token `--flip-bend: 28deg` holds the peak.

```css
@keyframes leaf-bend { /* one kink; linear between these samples of the eased turn */
  0%, 100% { transform: rotateY(0deg); }
  10%, 90% { transform: rotateY(calc(0.01 * var(--flip-kink))); }
  20%, 80% { transform: rotateY(calc(0.10 * var(--flip-kink))); }
  30%, 70% { transform: rotateY(calc(0.39 * var(--flip-kink))); }
  40%, 60% { transform: rotateY(calc(0.80 * var(--flip-kink))); }
  50%      { transform: rotateY(var(--flip-kink)); }
}
```

What the owner sees, forward (the old page turning away):

| Time | Turn at the rings | Total bend | Free edge | Reads as |
| --- | --- | --- | --- | --- |
| 0 to 10 percent | 0 to 2 degrees | 0 | with the rings | the page lifts flat |
| 30 percent | 18 degrees | 11 degrees | 7 degrees | the rings side rises, the free edge drags on the page |
| 50 percent | 46 degrees | 28 degrees | 18 degrees | a full soft bow |
| 70 percent | 74 degrees | 11 degrees | 63 degrees | the free edge catches up |
| 90 to 100 percent | 90 to 92 degrees | 0 | with the rings | the page stands flat, edge on, and goes |

1. Forward: each kink turns back towards the page (`--flip-sign: 1`, a positive `rotateY` against the leaf's negative turn), so each strip is turned a little less than the one before it and the free edge trails. The free edge is never below the page (lowest point 1.8 degrees above it at 10 percent).
2. Back (a leaf of the earlier day landing): `--flip-sign: -1`, so each strip is turned a little more than the one before it and the free edge trails in the air while the rings side lands first. The stage already plays every animation with `animation-direction: reverse`; `.leaf__strip` and the new shade join that selector. Because the bend is symmetric in time, reversing it changes nothing but the sign. The free edge reaches at most 90.2 degrees, so it is never drawn past the rings (the T8b "drawn past the hinge" check holds).
3. The leaf back keeps `leaf-back` (fading in at 70 to 92 percent) on every face. At 70 percent every strip is turned at least 63 degrees, so the back still only shows on a strip that is nearly edge on (the T8b rule of 60 degrees holds for every strip, not only the first).
4. Strips, faces, backs and shades use `--dur-flip`, the leaf's `--i` delay and `animation-fill-mode: both`, so a riffle leaf bends on its own clock. The reduced motion override `.flip-stage, .flip-stage *` already covers them. `leaf-bend` and `leaf-shade` use `animation-timing-function: linear`, because their keyframes are already samples of the eased turn.
5. `.leaf-cast` (the shadow on the page under the leaf) is unchanged.

### Shading that follows the curve

The light is taken as coming from the owner's side: a strip turned further from the page is a little darker. The shade on each face is a flat `--flip-shade` fill (no gradient any more) whose opacity follows that face's own angle, reaching full at 52 degrees, which is where today's shade reaches full:

```css
.leaf__shade { background: var(--flip-shade); animation-name: leaf-shade; animation-timing-function: linear; }
@keyframes leaf-shade { /* opacity = clamp(0, (turn - kinks so far) / 52, 1); --flip-u is the face's share of the bend, signed */
  0%   { opacity: 0; }
  10%  { opacity: clamp(0, 2 / 52, 1); }
  20%  { opacity: clamp(0, (8 - 3 * var(--flip-u)) / 52, 1); }
  30%  { opacity: clamp(0, (18 - 11 * var(--flip-u)) / 52, 1); }
  40%  { opacity: clamp(0, (31 - 22 * var(--flip-u)) / 52, 1); }
  50%  { opacity: clamp(0, (46 - 28 * var(--flip-u)) / 52, 1); }
  60%  { opacity: clamp(0, (61 - 22 * var(--flip-u)) / 52, 1); }
  70%  { opacity: clamp(0, (74 - 11 * var(--flip-u)) / 52, 1); }
  80%  { opacity: clamp(0, (84 - 3 * var(--flip-u)) / 52, 1); }
  90%, 100% { opacity: 1; }
}
```

1. Forward mid turn the strips near the rings are darker and the trailing free edge, still facing the owner, is lighter (at 50 percent: 0.88 at the rings, 0.35 at the free edge). Back, the free edge is the darker one. This is the opposite of today's fixed gradient (darker towards the free edge), which only faked a direction of light.
2. The shade never exceeds one full `--flip-shade` (0.10 by day, 0.08 at night), the same cap that keeps done ink at 4.5:1 today, so R35 holds by construction. T7-09 proves it (below).
3. The numbers in `leaf-bend` and `leaf-shade` come from the same samples (θ and B at each 10 percent) and must change together if `--flip-bend` or `--ease-flip` change. The Page flip block says so in a comment.

`var()` inside keyframe values is standard CSS and resolves per element. If an engine ever ignored it, the bend would simply be flat and the shade would fall back to its neighbouring keyframes; the leaf would still turn. Safari and iOS are a manual check in the T10 release note.

### Dark mode

No new colour. Faces use `--color-paper`, `--color-leaf-back`, `--flip-shade` and `--flip-cast`, which already switch in the dark block, and the joints overlap by 1 px over a page of the same dark paper, so a gap could only ever show more dark paper: no light line, no flash (R34). The T7 dark test reads the faces' backgrounds instead of `.leaf`'s, which no longer paints.

### Following the page: ResizeObserver, `--flip-offset` and the width

1. `place()` also sets `--flip-w` (the sheet width in px) on the stage, so every strip width and face offset follows the sheet if the window is resized during a flip. It already runs from the ResizeObserver after each layout; no per face write is ever needed.
2. `--flip-offset` and `--flip-top` are unchanged and inherited: every copy is shifted up by the same `--flip-offset`, so all copies line up with the page and with each other.
3. `fit()` changes shape so one set of reads serves every copy: `fit(from, copies)` reads the real rows' heights once and returns one write function that sets them on the rows of each copy. `copy()` calls it with one copy, as now; the observer, for a back flip, calls it with all `.leaf__content` of the stage. Reads still come before writes.

### Fallback on a slow device

1. Built in, no setting: after the stage is built, `play()` already waits for the first animation frame (for the end timer). It now also notes that frame's time and the next frame's time. If the frame that laid out the copies took more than 50 ms (the NFR2 limit for one frame), the module sets a `flat` flag, and every later flip in this page session builds N = 1: one face, no strip, the flat leaf with today's look (the shade then follows the turn alone). The flip that was slow carries on as it is. A reload tries the bend again.
2. Without `transform-style: preserve-3d` (`CAN_BEND = CSS.supports("transform-style", "preserve-3d")`, read once next to `CAN_3D`), N is 1 from the start.
3. Everything else stays: no stage on a hidden page or without 3D (R7, R39), the `try` and `end()` around `play()`, the timer and its backstop.

ponytail: the slow check is one frame, once per session; a device that is only slow now and then keeps the bend. Upgrade path, if the owner reports jank: lower `--flip-strips` on phones, or measure over several flips.

### Error handling and security

No new input, storage or markup from data. The clones come from the app's own already stripped copy, inside the `aria-hidden`, `inert`, pointer free stage, so R11, R19 and R20 hold for every copy, and axe sees nothing new. Any failure while building faces is caught by the existing `try` in `play()` and ends the stage.

### Files to change

| File | Change |
| --- | --- |
| `src/flip.js` | `play()` builds faces and strips per leaf and the clones; reads `--flip-strips`; sets `--flip-n` on the stage and `--k` on each face; the `flat` flag and its two frame check; `CAN_BEND` read once; `fit(from, copies)`; `place()` sets `--flip-w` |
| `docs/project/design-system.css` (Page flip block) | Tokens `--flip-strips` (8, 6 below 601 px) and `--flip-bend: 28deg`; `--flip-sign`, `--strip-w`, `--flip-kink` on the stage; `.leaf` without paint and with `preserve-3d`; `.leaf__strip`, `.leaf__face`, `.leaf__face--edge`; holes and margin line on face 0; ruled blank faces; flat shade; `leaf-bend` and the new `leaf-shade` keyframes; `.leaf__strip` and the shade in the reverse selector; a comment tying the keyframe numbers to `--flip-bend` and `--ease-flip` |
| `docs/project/design-system.md` (Page flip section) | Direction paragraph (the leaf bends like soft paper, the free edge trailing), the two new tokens, the strip and face components, the shade following the curve, the slow device fallback |
| `tests/e2e/helpers.js` | `watchFlips` keeps reading the first `.leaf__content` (unchanged); add `angles(leaf)` if shared by more than one test |
| `tests/e2e/flip.spec.js` | The new T8e block and the changes listed below |

### Tests

New, `test.describe('T8e: soft paper bend')` in `flip.spec.js`. Real time tests sample on every animation frame with nothing paused, as T8b does. A strip's angle is read by walking from `.leaf` down the `.leaf__strip` chain and adding each element's `rotateY` from its computed `transform` (`atan2(m13, m11)`); the spread is the free edge's angle minus face 0's.

1. T8e-01 (1440 and 390 px, forward, back and a 3 leaf riffle; real time): every leaf has 8 faces at 1440 px and 6 at 390 px, and the text leaf has exactly that many `.leaf__content` (blank leaves none); the spread is under 2 degrees in the first sample and in every sample after 90 percent of `DUR`; every sample between 40 and 60 percent of `DUR` (from the first sample) has a spread of at least 15 degrees with the free edge trailing (forward turned less than face 0, back more); the spread is at least 10 degrees for at least 35 percent of `DUR` in total, so the bend is visible in real time and not a one frame blip; all kinks of a sample are equal within 0.5 degrees and of one sign (one smooth arc, no fold); the free edge is never turned the wrong way (forward) and never past 93 degrees (back); and the T8b `perceptible` check still passes on the same run. Each blank riffle leaf shows the same spread rules on its own clock.
2. T8e-02 (real time, every sample): the strips stay joined. Each face's projected box (`getBoundingClientRect`) reaches at least to the next face's left edge minus 0.5 px, and the next face starts inside the face before it, so there is never a gap or an overlap beyond the 1 px tuck.
3. T8e-03 (real time): the leaf back shows (opacity 0.05 or more) only on samples where every strip is turned at least 55 degrees.
4. T8e-04 (paused at 50 percent of `DUR`): forward, the drawn width of the last face is at least 15 percent wider than the drawn width of face 1 (they have the same flat width, so the trailing edge is flatter on screen); back (paused at 50 percent) at least 15 percent narrower.
5. T8e-05 (paused at 40 percent forward and 60 percent back, light and dark): each face's `.leaf__shade` opacity changes monotonically along the strips (forward falling towards the free edge, back rising), the difference between face 0 and the edge face is at least 0.3, every shade opacity is at most 1, and the shade colour is `--flip-shade`.
6. T8e-06 (fallback): a move whose first frame is made slow (the test busy waits 80 ms inside a `requestAnimationFrame` queued right after the click) still plays bent to its end; the next move builds one face per leaf and no `.leaf__strip`, and passes the T8b `perceptible` check; after a reload a move bends again. With `CSS.supports` reporting no `preserve-3d` (init script), a move builds one face per leaf, with no error.
7. T8e-07 (resize and scroll): resizing the window from 1440 to 1000 px during a flip makes `--flip-w` equal the new sheet width after the next frame, and the edge face's flat right edge (`--x` plus its width) equal the sheet width; on a scrolled 200 row back flip every `.leaf__content` holds the same number of rows with the same heights as the first, after the observer has refitted them.
8. T8e-08 (copies): every copy holds the same select values as the page (`copiedSelects` reads each copy), and no copy has an `id`, `for`, `aria-live` or `role`.

Changed:

1. Tests that count or read inside the text leaf scope to its first copy (`.leaf:not(.leaf--blank) .leaf__content`, the first match): `trimmed` (T8 row trim), `copiedSelects`, the row edit form case, the T8d header tests and T7-09. Their assertions stay as they are. `watchFlips` already reads the first copy.
2. T7-09 contrast: the leaf text is checked under the darkest shade among the faces at that frame (the largest computed `.leaf__shade` opacity, with `--flip-shade` as colour), the back opacity as now, at the same 8 frames including 72 and 28 percent, light and dark. The cast check takes the leaf's drawn right edge as the largest `right` among its faces.
3. The T7 dark test reads the faces' backgrounds and their `.leaf__back` instead of `.leaf`'s background.
4. T8 speed (NFR1, NFR2) and the T8b checks run unchanged, and each NFR2 run also records the face count per leaf and asserts it is N (8 at 1440 px, 6 at 390 px), so the fallback did not hide a slow run. FE logs the frame medians and the first frame time with N copies in the hand-off.

Manual (T10 release note): Safari and iOS show the bend (the soft bow mid turn, the free edge trailing, no seam lines at the joints), in light and dark.

### Requirement mapping for this change

| Requirement | Satisfied by |
| --- | --- |
| R8 as amended (soft paper bend, free edge trailing, shading along the curve) | Nested `.leaf__strip` chain, `leaf-bend`, per face `leaf-shade`; T8e-01 to T8e-05 |
| R4 both directions | `--flip-sign` and the reverse selector; T8e-01, T8e-04, T8e-05 back cases |
| R3 riffle, blank leaves | Blank leaves get the same strips and no copy; T8e-01 riffle |
| R11, R19, R20 copies never read | Clones of the stripped copy inside the inert, hidden stage; T8e-08, existing axe and tree tests |
| R13 inside the sheet, lined up | `--flip-w`, `--flip-offset`, `fit(from, copies)` from the observer; T8e-07, T7 tests |
| R34 dark mode | Faces on the dark tokens, joints over dark paper; T7 dark test on faces, T8e-05 dark |
| R35 contrast | Shade capped at one `--flip-shade` per face; T7-09 on the darkest face |
| NFR1, NFR2, NFR3 | One trimmed copy cloned N - 1 times; compositor only motion; slow frame fallback; T8 tests with the N check, T8e-06 |
| NFR4 | Faces and strips inside the stage, removed by `end()`; listener count test unchanged |
| R39, NFR7 fallbacks | `CAN_BEND`, the `flat` flag; T8e-06 |

## Change 2026-11-13: StPageFlip curl and thick notebook

Source: decisions.md, "2026-11-13 page-flip curl style" (chosen by the owner), including the two owner previews of the same day: the StPageFlip prototype with the riffle was approved, and the thick notebook stack was approved ("oki"). This section replaces "Change 2026-11-13: soft paper bend" as a whole (the strips, faces, `leaf-bend`, `leaf-shade`, `--flip-strips`, `--flip-bend`, the slow device fallback and the T8e tests) and overrides anything above that conflicts with it. It keeps "Change 2026-11-12" (whole sheet, always flip, 700 ms, 125 ms step, no tape re-press) and the day change path in `src/app.js` unchanged.

Requirement text for the BA to amend: R8 ("no library", "narrow vertical strips"), NFR6 ("no new dependency and no external library"), and item 2 of Out of scope (a page corner curl and a flip library). The design below is written against "R8 as amended: the page curls like a real book page, with a diagonal fold, drawn by the vendored StPageFlip library".

### Approach in short

The approved prototype (worktree `agent-ac97ef2fd3696d839`, diff against cb310c3; screenshots in `qa/evidence/proto-stpageflip/`) becomes the build almost as it is. StPageFlip 2.0.7 (MIT) is vendored under `vendor/page-flip/`, loaded as a local ES module and a local stylesheet, so there is no CDN, no npm runtime dependency and no CSP change. `src/flip.js` keeps its API (`leafCount`, `createFlip({ sheet, body })` returning `{ snapshot, play, end }`), its copy of the sheet, its `place()`, its end paths and its listeners. Only the inside of `play()` and `end()` changes: instead of CSS animated leaves it drives one small library "book" per riffle page along a dipping corner path, so the fold runs diagonally with the lower corner lagging, as in the owner's reference photo.

The thick notebook is a design system change only: `--shadow-sheet` becomes a stack of offset paper edges, a card back cover and a soft shadow, all box shadows, so no layout or scroll area changes.

It follows the existing patterns: one module with a small returned API (`createFlip`, like `createDrag`), tokens read with `ms()`, inline geometry through the CSSOM only, one end path, a stage that is `aria-hidden`, `inert` and pointer free, and real time motion checks in the style of TC-page-flip-T8-11.

### Vendored library

| File | Content |
| --- | --- |
| `vendor/page-flip/page-flip.module.js` | npm `page-flip@2.0.7`, `dist/js/page-flip.module.js`, with two marked patches (below) and a header comment naming the version, the source path and the SHA-256 of the unpatched file |
| `vendor/page-flip/page-flip.css` | The library CSS, which the library would otherwise inject as an inline `<style>` |
| `vendor/page-flip/LICENSE` | The MIT licence, copyright 2020 Nodlik, unchanged |

1. Pinned version. The version lives in the header comment and nowhere else; there is no `package.json` entry, because nothing installs or builds it. Upgrading means vendoring a new file, re-applying the two patches and re-running the curl tests, which are the guard for the internals listed below.
2. Patch 1, CSP. The call that injected the library CSS as an inline `<style>` element is removed, because `style-src 'self'` blocks it. The same CSS is `page-flip.css`, linked from `index.html` before the design system. Everything else the library styles goes through `element.style` and `style.cssText`, which the CSP allows (the CSSOM rule already used by the drag slip and the progress ring). The Content-Security-Policy meta tag does not change.
3. Patch 2, idle loop. `Render.start()` runs `requestAnimationFrame` forever, and `destroy()` does not stop it, so every book would draw a frame 60 times a second for the life of the page, also while no flip plays. The patch makes the loop stop when asked and restart on demand:

```js
// original
start(){this.update();const t=e=>{this.render(e),requestAnimationFrame(t)};requestAnimationFrame(t)}
// patched (names prefixed so they cannot clash with the library's own members)
start(){this.update();this.pfLoop=e=>{this.render(e),this.pfAsleep?this.pfRunning=!1:requestAnimationFrame(this.pfLoop)};this.pfWake()}
pfWake(){this.pfAsleep=!1,this.pfRunning||(this.pfRunning=!0,requestAnimationFrame(this.pfLoop))}
pfSleep(){this.pfAsleep=!0}
```

   `flip.js` calls `getRender().pfSleep()` right after creating a book and in `end()` for every pooled book, and `getRender().pfWake()` when a book starts its turn in `drive()`. The library's own end animation (the forward tail after `userStop`) runs inside that window, because the stage only ends when the last book reports `read` or the end timer fires. With no flip playing, no library frame callback is queued.
4. Version query. `index.html` links `vendor/page-flip/page-flip.css?v=1.3.0` and `src/flip.js` imports `../vendor/page-flip/page-flip.module.js?v=1.3.0`, because `tests/unit/version.test.js` requires every local reference in `index.html` and `src/*.js` to carry the package version (the prototype left both bare, which fails that test). T10 bumps them with the rest. The vendored module has no imports of its own.
5. Hosting. `vendor/` is a plain folder at the repository root next to `src/`, reached by relative paths, so the GitHub Pages subpath works as before (NFR9).

### Library internals the build relies on

The library has no public cancel and no hook after a frame is drawn, so `flip.js` uses a few members that are not in its documented API. They are listed in one comment at the top of `createFlip` and here, so an upgrade knows what to check:

| Member | Used for |
| --- | --- |
| `getRender().drawFrame` (wrapped) | Calls `punch(book)` after every drawn frame |
| `getRender().animation`, `setBottomPage(null)`, `setFlippingPage(null)`, `clearShadow()` | `quiet()`: drops a turn cut short |
| `getFlipController().reset()`, `setState("read")`, `getCalculation()` | `quiet()`, and in `drive()` whether a fold has started |
| `book.isUserTouch` | Reset in `quiet()`, read in `drive()` |
| `getPageCollection().getPages()[i].getElement()` | The front and clear page elements in `punch()` |
| The clear page's inline `clipPath` (`polygon(...)`) and `transform` (`translate3d(...)`) | The uncovered area that `punch()` cuts out of the front page |
| `pfWake()`, `pfSleep()` | Patch 2 |

Documented members used as documented: `new PageFlip(el, settings)`, `loadFromHTML`, `updateFromHtml`, `getSettings`, `update`, `turnToPage`, `getCurrentPageIndex`, `startUserTouch`, `userMove`, `userStop`, `on("changeState")`.

Any exception from these lands in the existing `try` in `play()` (or the one around the observer) and ends the stage, so a broken internal means no curl, never a stuck page (NFR7).

### Stage structure

```
div.flip-stage.flip-stage--curl[.flip-stage--back]   aria-hidden, inert; --flip-top, --flip-h, --flip-offset (place())
  div.leaf.leaf--base                    back only: copy of the old day, under the pages that fall back onto it
  div.flip-layer  (bottom page first)    one per riffle page, n = leafCount(days)
    div.flip-book                        the library root, sized to the stage
      .stf__* library markup, holding:
        div.leaf.leaf--front             the page that turns (forward: old day; back: new day; or .leaf--blank)
        div.leaf.leaf--front (clone)     drawn by the library as the back of the sheet; content hidden by CSS
        div.leaf--clear                  what the turn uncovers; see-through, its clip drives punch()
```

1. `flip-stage--back` is set when `to < from`, as before, so `watchFlips` and the CSS keep one way to tell the direction. The prototype dropped it; the build puts it back.
2. Forward, top to bottom: the old day, then blank ruled pages, over the real new day. Back, top to bottom: the new day, then blank pages, over the `.leaf--base` copy of the old day; they start curled away and uncurl, the lowest first, so the new day lands last.
3. Books are pooled (at most 3, one per riffle depth) and reused with `updateFromHtml`, because creating a book per move would add a loop and listeners per move (NFR4). The stage node itself is reused too and is detached by `end()`, so between flips there is no `.flip-stage`, `.flip-layer` or `.leaf` in the document.
4. `punch(book)` cuts the uncovered part out of the front page with an `evenodd` polygon after each drawn frame, so the next page down (already turning, or the real new day) shows through it. Without it the library expects an opaque page there.
5. `snapshot(from, to)` now copies the old day for both directions (forward it is the turning page, back it is `.leaf--base`). The back front page is `copy()` of the new day in `play()`, as before, and the ResizeObserver keeps refitting its rows with `fit()` as in T8d, so a back page lines up with the new day once its rows lay out (the prototype dropped this refit; the build keeps it so the T8d `linedUp` tests hold).

### Motion and timing

1. `drive()` moves the touch point along `x = w - 2 - 1.85 w t`, `y = 2 + sin(pi t) * 0.4 min(w, h)`, eased in and out. The dip makes the fold diagonal with the lower corner lagging. Forward drives 85 percent of `--dur-flip` by hand and lets the library animate the last part past the left edge (`userStop`); back drives the whole `--dur-flip` from the far end home and stops at the corner, so the page settles flat.
2. Riffle: book k starts `k * --dur-riffle-step` after the first (forward top first, back lowest first), so a 3 page riffle still lasts 700 plus 2 x 125 = 950 ms (R3, R3a).
3. The library animates its tail at one point per pixel and shortens runs under 1000 points; `flippingTime` is set per move from the stage width so the tail takes the remaining 15 percent of `--dur-flip` at every width. This is approximate (a frame or two either way), which is why the end timer stays the authority.
4. End timer, as BUG-028: `life = dur + (n - 1) * step + 17`, a backstop of `2 * life` until the first animation frame, then `life` from that frame. The last book's `changeState` to `read` ends the stage earlier when the library finishes first. So NFR7 (every flip ends within its time plus one frame) holds by construction; the prototype's `2 * life + 300` backstop goes.
5. The library animates with script, not CSS animations, so the global reduced motion rule (`animation-duration: 1ms`) does not touch it and the flip keeps playing under `prefers-reduced-motion` (R28, R29). The old duration override for `.flip-stage *` becomes dead and T9 removes it.
6. Accepted limit (ponytail): the book size is taken from the stage once per move. If the visible part of the sheet grows during the turn (rows laying out on a short day), a strip at the bottom shows the new day without a curl until the turn ends; the stage is clipped, so it never overflows. Upgrade path, if the owner notices: call `getSettings()` plus `update()` with the new height from the ResizeObserver.

### Fallbacks

`allowed()` becomes `CAN_CURL && !document.hidden`, where `CAN_CURL = CAN_3D && CSS.supports("clip-path", "polygon(evenodd, 0 0, 1px 0, 0 1px)")`, read once. A hidden page and a browser without these features change the day with no flip and no error (R7, R39). The `visibilitychange` and capturing `toggle` listeners stay, and `end()` now also runs `quiet()` and `pfSleep()` on every pooled book.

### Design system

1. Page flip block of `design-system.css`: the prototype's "Page curl prototype" rules move into the Page flip block as its curl part (no "prototype" label): `.flip-stage--curl`, `.flip-layer`, `.flip-book`, `.flip-book .stf__wrapper`, the back of sheet rule on the second `.leaf--front`, the hidden content of that clone, and the unclipped `.stf__outerShadow` and `.stf__innerShadow` with the reason in a comment. The `.flip-stage--curl .leaf { animation: none }` override stays until T9 removes the leaf animations it overrides.
2. Thick notebook: the prototype's "Thick notebook prototype" block moves into the Tokens section. `--shadow-sheet` is defined once from `--stack-u`, `--color-paper-edge`, `--color-stack-line`, `--color-cover` and `--stack-soft`; the dark block sets only `--color-stack-line`, `--color-cover` and `--stack-soft` (and drops its own `--shadow-sheet`); `--stack-u` is 1.8 px, and 0.7 px below 601 px so the stack fits the 8 px desk gutter at 390 px. Box shadows draw outside the layout, so no scroll bar or shift is added (R13, R33).
3. `design-system.md`: the Page flip section describes the curl (diagonal fold, lower corner lagging, the back of the sheet, the fold shadows, the riffle as stacked books), the vendored library and its licence; "Spacing, size, radius, shadow" describes the page stack and its tokens.

### Error handling and security

1. No data is read or written (R27, R40). Pages come from the app's own stripped copy (no `id`, `for`, `aria-live`, `role`), inside the `aria-hidden`, `inert`, pointer free stage, so R11, R19 and R20 hold; `useMouseEvents: false` means the library listens to no pointer input.
2. The library is local, MIT licensed, pinned and reviewed as two small patches; no network request, no `eval`, no inline style element, and the CSP is unchanged (NFR6 as amended).
3. Every failure path ends the stage and leaves the settled page (NFR7).

### Files to change

| File | Task | Change |
| --- | --- | --- |
| `vendor/page-flip/page-flip.module.js`, `page-flip.css`, `LICENSE` | T11, T12 | New, from the prototype; header comment with version and hash (T11); idle loop patch (T12) |
| `index.html` | T11 | Link `vendor/page-flip/page-flip.css?v=1.3.0` before the design system |
| `src/flip.js` | T11, T12 | The prototype's `play()`, `end()`, `bookAt`, `punch`, `quiet`, `drive`, with `flip-stage--back`, the back refit, the BUG-028 end timer, `CAN_CURL`, the internals comment (T11); `pfWake` and `pfSleep` calls (T12) |
| `docs/project/design-system.css`, `.md` | T11, T15 | Curl rules in the Page flip block (T11); page stack tokens (T15) |
| `tests/e2e/helpers.js`, `tests/e2e/flip.spec.js`, `tests/e2e/day-nav.spec.js` (T7 block) | T13, T14 | Tests for the curl (below) |
| `docs/project/design-system.css`, `.md`, `src/flip.js` | T9 | Dead leaf, strip and turn styles; anything in flip.js no longer called |
| `package.json`, lockfile, `?v=` in `index.html` and `src/*.js` | T10 | 1.4.0 |

The uncommitted T8e work in the main working tree (`src/flip.js`, `design-system.css`, `design-system.md`, `tests/e2e/flip.spec.js`, `tests/e2e/helpers.js`) is discarded back to HEAD (cb310c3) at the start of T11. `requirements.md`, `decisions.md` and `status.yaml` are not touched by that reset.

### Tests

Unit: `leafCount` and `daysBetween` unchanged; `version.test.js` passes with the two new `?v=` references and fails if one is removed.

End to end, harness (T13):

1. `watchFlips` records per stage: `back` from `flip-stage--back`, `leaves` as the number of `.flip-layer`, `blank` as the layers whose own `.leaf--front` is `.leaf--blank`, `text` from the first non blank `.leaf--front .leaf__content`, `first` (the first animation frame after the stage was added, kept from the T8e helper), and `removed`. Because the stage node is reused, removal is matched to the latest open record (`removed === null`), not the first record for that node.
2. Lifetimes are measured from `first`: removed no earlier than `life - 60` ms and no later than `life + 100` ms, with `life` from `DUR = 700` and `STEP = 125`. The old edge test at 699, 700, 701 and 717 ms is replaced by these bounds.
3. Every test that reads `.leaf`, `.leaf-cast`, `.leaf__back`, `.leaf__shade`, `--i` or CSS animations (the T8b `perceptible` checks, T7-09 contrast, the T7 dark test, the reduced motion animation duration test) is rewritten for the curl as below or deleted where the curl has no such part; no assertion on behaviour is weakened.

End to end, behaviour kept (T13), each passing on the new harness: entry points and direction, page counts 1, 2 and 3 by distance (2 days: 1 blank; 3 and 9 days: 2 blank), no flip on load, reload, midnight, invalid hash and same day, 30 presses ending on the right day with zero `.flip-stage`, `.flip-layer` and `.leaf` nodes after the last lifetime, interrupts (a new move, a storage event, the delete note and the "Nhóm việc" dialog each end a running stage at once, all layers together), a hidden page building no stage and ending a running one, window blur, held key repeat and release, theme change, no support (`CSS.supports` false for `clip-path` with `evenodd`, init script) building no stage and no error, work during a flip (typing, adding, ticking, focus, tab order, `elementFromPoint` at the next arrow returning the real button, axe with a stage present, the accessibility tree holding no copy text), copies with no `id`, `for`, `aria-live` or `role`, and the stored strings unchanged byte for byte.

End to end, curl (T14), real time with nothing paused, sampling every animation frame, at 1440 and 390 px:

1. Curl visible: in a forward flip, a back flip and a 3 page riffle, the turning page (the second `.leaf--front` of each layer) is displayed and has a fold (its inline `clip-path` is a polygon) on samples covering at least 50 percent of `DUR` per page; on at least 30 percent of `DUR` its rotation from the computed `transform` is between 5 and 60 degrees from upright, so the fold is diagonal and not vertical; forward, the leftmost x of its drawn box moves from the right half to the left quarter of the stage, and back the other way.
2. See-through: while a forward fold is drawn, the top `.leaf--front` has an `evenodd` polygon clip (the punch), so the next page or the new day shows.
3. Riffle: each layer starts its fold `STEP` (within one frame plus 20 ms) after the one before, in the order of R4, and blank pages turn like the text page.
4. Idle loop (T12, may live in T14's block): an init script counts `requestAnimationFrame` callbacks queued by the vendored module (wrap `requestAnimationFrame` and tag calls whose stack names `page-flip.module.js`); after load with no move, and from 100 ms after a stage ends, no such callback runs for 1 second; during a flip they do.
5. CSP: a `securitypolicyviolation` listener records nothing on load and through a forward flip, a back flip and a riffle.
6. Dark mode: the turning page's back (`.leaf--front ~ .leaf--front`) computes `--color-leaf-back` from the dark block, the front pages use the dark paper, and no sampled pixel in a screenshot at 30 and 60 percent of `DUR` is lighter than the light paper threshold used by the T7 dark test (no light flash, R34).
7. Contrast (R35): the copied text on the front page, at 30 and 60 percent of `DUR`, light and dark, at 4.5:1 or better against its paper. The fold shadows are measured and reported for the new page text under them (open question in the hand-off).
8. Layout at 1440, 390 and 360 px: no horizontal scroll and an unchanged `scrollHeight` during and after a riffle; every `.flip-layer` inside the sheet box; the T8d stage top and scrolled cases unchanged.
9. Speed (NFR1, NFR2): the day-navigation "under 100 ms" tests unchanged; a 3 page riffle between two 200 task days, Chromium, median of 3 runs: no `longtask`, median frame at most 18.2 ms, no frame over 50 ms. FE reports the medians and the first frame time. If they fail, FE reports the numbers and does not tune the curl; the owner's accepted stutter risk (2026-11-13 T8e entry) is for the PM to apply.
10. Reduced motion: the T8c inverted tests pass (a move under `reducedMotion: 'reduce'` builds a stage with the normal page count and lifetime, and a riffle runs on when the setting switches on), and check 1 passes once under reduced motion.

Thick notebook (T15): at 390 px the sheet's box shadow reach (largest offset plus blur) stays inside the right gutter and adds no horizontal scroll; at 1440 and 390 px light and dark, `--shadow-sheet` computes to the stack (12 shadow layers) with the dark colours in dark mode; screenshots of the settled sheet and a mid curl in `qa/evidence/T15-fe/`.

Manual (T10 release note): Safari and iOS show the curl with the diagonal fold and no seams or clipped corners, light and dark, also with Reduce Motion on; the stack edges look right at the phone width; a mid range Android phone plays the 950 ms riffle smoothly.

### Requirement mapping for this change

| Requirement (as amended) | Satisfied by |
| --- | --- |
| R8 curl with a diagonal fold | Vendored StPageFlip, `drive()` dip path, `punch()`; T14 checks 1 and 2 |
| R3, R3a riffle, 700 and 950 ms | One pooled book per page, step from the token, end timer from the first frame; T13 counts and lifetimes, T14 check 3 |
| R4 direction | `flip-stage--back`, back path driven home, `.leaf--base`; T13 direction tests |
| R7, R38, R39 fallbacks | `allowed()` with `CAN_CURL`; `visibilitychange`; T13 |
| R9, NFR4, NFR7 cleanup | `end()` detaches the stage, `quiet()` and `pfSleep()` on every book, pool capped at 3; T13 node counts, T14 check 4 |
| R11, R18 to R21 | Stage attributes, stripped copies, `useMouseEvents: false`; T13 focus and axe tests |
| R13, R33 | Stage on the visible sheet, `overflow: clip`, stack as box shadows; T14 check 8, T15 |
| R14 to R17, R37 | `end()` from every existing path, unchanged in `app.js`; T13 |
| R28, R29 always flip | Script driven motion outside the CSS reduced motion rule; T14 check 10 |
| R34, R35 | Dark tokens on pages and back; T14 checks 6 and 7 |
| NFR1 to NFR3 | Same trimmed copy, idle loop stopped, frame tests; T14 check 9 |
| NFR6 (as amended), NFR9 | Local vendored files with licence, CSP patch, `?v=` on both references; T14 check 5, `version.test.js` |
