# Design: day-navigation

## Approach

This feature extends the shipped `daily-task-log` code and keeps its stack and conventions: one static page, the approved `design-system.css`, and the three vanilla ES modules with no build step and no new dependency. The data model does not change, because every task already carries its local `date` key and `store.tasksFor(dateKey)` already returns any day.

The work splits along the same boundary as before:

1. `src/date.js` gains the pure date rules: parse and validate a `yyyy-mm-dd` key (real date, years 2000 to 2099), add days, classify a day against today, and build the Vietnamese date line. No DOM, unit tested in Node.
2. `src/store.js` gets one optional argument so a new task can take the viewed day as its date. The existing call shape keeps working.
3. `src/app.js` replaces its single `shownDate` with two values, `viewed` and `today`, adds the navigation controls, keeps the viewed day in the URL hash, and splits rendering into "wording" (header text that depends on viewed versus today) and "day" (the list and summary).

The address is the source of truth on load and on browser Back or Forward. In app moves write the address with `history.pushState`, so one move is one history entry (R25), and the page never reloads (R22). Plain address means today (R23).

The nav markup, class names and motion classes come from `ux/screens/*.html` and the "Day navigation" section of `design-system.css`, which is already in place. The prototype uses `<a>` elements so the static screens link to each other; production uses `<button type="button">` for the arrows and Về hôm nay, with the same classes.

## Files to change

| File | Change |
| --- | --- |
| `src/date.js` | Add `MIN_YEAR`, `MAX_YEAR`, `parseDateKey`, `addDays`, `dayKind`, `dateLine` |
| `src/store.js` | `store.add(raw, now = new Date(), dateKey = toDateKey(now))` |
| `index.html` | Add the `<nav class="app-header__nav day-nav">` row after `.app-header__top` (and remove the empty placeholder nav inside it), add `aria-live="polite"` to `#date-line`, give the empty text and the add label ids so app.js can update them |
| `src/app.js` | `viewed` and `today` state, `renderWording`, `renderDay`, `go`, address sync, picker handling, midnight rules, add on viewed day, page turn classes |
| `tests/unit/date.test.js` | Tests for the new date functions |
| `tests/unit/store.test.js` | Test for the new `dateKey` argument |
| `tests/e2e/day-nav.spec.js` | New file for this feature's end to end tests, reusing the seeding approach from `app.spec.js` |
| `tests/e2e/app.spec.js` | One expected list changes (see "Existing tests") |

No change to `design-system.css`, `design-system.md`, `package.json` or `playwright.config.js`.

## Interfaces

### `src/date.js` (owner `be`)

```js
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2099;

// "2026-11-08" -> local Date at 00:00 of that day, or null when the text is not
// exactly yyyy-mm-dd, is not a real calendar date (2026-02-30), or the year is
// outside MIN_YEAR..MAX_YEAR. Accepts any input type; non strings give null.
export function parseDateKey(text) {}

// ("2026-11-09", -1) -> "2026-11-08"; null when key is invalid or the result is out of range.
// Uses new Date(y, m - 1, d + n) so month ends, leap years and DST are handled by the platform.
export function addDays(key, n) {}

// Compare two valid keys: 'today' | 'yesterday' | 'tomorrow' | 'past' | 'future'.
// yesterday = addDays(todayKey, -1), tomorrow = addDays(todayKey, 1); otherwise string order.
export function dayKind(key, todayKey) {}

// Date line text from the requirements table:
// today "Hôm nay, Thứ Hai, 09/11/2026", yesterday "Hôm qua, ...", tomorrow "Ngày mai, ...",
// other days formatDate(parseDateKey(key)) only.
export function dateLine(key, todayKey) {}
```

`toDateKey`, `formatDate` and `WEEKDAYS` stay as they are.

### `src/store.js` (owner `be`)

```js
store.add(raw, now = new Date(), dateKey = toDateKey(now))
// { task } | { error }; task.date = dateKey, task.createdAt = now.getTime()
```

The store trusts `dateKey`; app.js only passes `viewed`, which is always a value produced by `parseDateKey`, `addDays` or `toDateKey`. `tasksFor`, `updateText`, `setDone` and `remove` already keep date and position (R17) and need no change.

### Day wording in `src/app.js` (owner `fe`)

One small table keyed by kind, with `yesterday` and `tomorrow` mapping to `past` and `future` wording:

| Kind | Heading and `document.title` | Placeholder and add label | Empty text |
| --- | --- | --- | --- |
| today | Việc cần làm hôm nay | Bạn cần làm gì hôm nay? | Hôm nay chưa có việc nào. Hãy thêm việc đầu tiên nhé! |
| past | Việc cần làm | Bạn cần làm gì ngày này? | Ngày này chưa có việc nào được ghi lại. |
| future | Việc cần làm | Bạn cần làm gì ngày này? | Ngày này chưa có việc nào. Hãy thêm việc để chuẩn bị nhé! |

## UI behaviour (`src/app.js`)

State: `today` (the last local date key the page saw) and `viewed` (the key on screen). `shownDate` is removed; every reader of it uses `viewed`.

1. **Address helpers.** `readHash()` returns `parseDateKey(location.hash.slice(1)) ? thatKey : null`. `writeAddress(key, push)` builds `location.pathname + location.search` plus `#key` when `key !== today`, and calls `history.pushState` or `history.replaceState` with it. Both use relative paths only, so the GitHub Pages subpath works (NFR6). The hash is only ever passed to `parseDateKey`, never to the DOM (NFR2).
2. **`renderWording()`** sets the h1, `document.title`, the date line (`dateLine(viewed, today)`), the input placeholder and its label, the empty text, the picker `value` (`viewed`), and `aria-disabled` on Về hôm nay (`"true"` when `viewed === today`, removed otherwise). All with `textContent`, `value` or attributes.
3. **`renderDay(direction)`** clears the celebrate timer and class, calls `renderWording()`, rebuilds the list from `store.tasksFor(viewed)`, calls `updateSummary()` (which shows the stamp without the celebrate class, R14) and `updateSlip()`, then `maybePeek()`. When `direction` is `"back"` or `"forward"` it adds `turn--back` or `turn--forward` to `.sheet__body` and `washi--restick` to the date line, and removes them on `animationend` (CSS turns them off under reduced motion). The old `renderAll` becomes `renderDay`.
4. **`resetTransient()`** is the existing body of `checkDay`'s cleanup, extracted: drop the open edit, set `pendingDelete = null` and close the dialog (the `close` handler then does nothing because no row is pending), clear the swipe state, and clear the add error with `setAddError(null)`. The add input value is left alone (R7).
5. **`go(key)`**: if `key` is null or equals `viewed`, set the picker back to `viewed` and stop (R9). Otherwise `resetTransient()`, `writeAddress(key, true)` (one entry per move, R22, R23, R25), set `viewed = key`, and `renderDay(key < oldViewed ? "back" : "forward")`. Focus is not touched, so it stays on the control the owner used, and the `aria-live` date line announces the new day (R8).
6. **Controls** (all call `checkDay()` after computing their target from the day on screen, then `go(target)`):
   1. Xem ngày trước: `addDays(viewed, -1)` (R1). Xem ngày sau: `addDays(viewed, 1)` (R2). Null at the year bounds, so nothing happens (R9).
   2. Về hôm nay: if `aria-disabled="true"`, return; else `go(today)` (R4, R5).
   3. Picker `change`: `go(parseDateKey(value) ? value : null)` (R3). Picker `blur`: set `value = viewed`, so a cleared or partial value goes back to the viewed day once the owner leaves the field (R9). The value is not reset while the field has focus, because Chromium reports partial years such as `0202-11-08` while the owner is still typing, and resetting then would break typing.
7. **Address changes** (`popstate` and `hashchange`, both call `syncFromAddress()`; the second call is a no-op): run `checkDay()`, then `key = readHash() ?? today`. If the hash is not empty and does not name a day other than today (equal to today, invalid, or out of range), clean it with `writeAddress(today, false)`, which adds no history entry. If `key !== viewed`, `resetTransient()`, set `viewed`, and `renderDay(direction)` (R24, R25).
8. **Load:** `today = toDateKey(now)`, `viewed = readHash() ?? today`, clean the address as in step 7, `setAddError(null)`, `renderDay()` with no direction, focus the add input (R26).
9. **Add:** the submit handler calls `checkDay(now)` first (R21), then `store.add(value, now, viewed)` (R16). The rest of the add flow is unchanged.
10. **`checkDay(now = new Date())`:** `key = toDateKey(now)`; if `key === today` return. Remember `wasToday = viewed === today`, set `today = key`.
    1. If `wasToday`: `resetTransient()`, `viewed = today`, `renderDay()`, and focus the add input if focus fell to the body, exactly as before (R19).
    2. Otherwise keep `viewed` and the list (an open edit on that day stays open), call `renderWording()` only, and if `viewed` now equals `today` clean its hash with `writeAddress(today, false)` (R20).

    It still runs on `visibilitychange` (visible) and window `focus`, plus before every add, nav control and address change.

Ticks, edits, deletes, the dialog, swipe and the storage slip work on whatever rows are shown and need no change (R15, R17, R18).

## Error handling and security

1. Every value from the address or the picker goes through `parseDateKey` before use. Bad values fall back to today (address) or are ignored (picker), with no message (R9, R24).
2. The date line and all wording are built by the app from the key and fixed strings; nothing from the address is inserted as text or markup (NFR2).
3. Moving never writes to storage. Only add, tick, edit and delete save, as before (NFR3).
4. `history.pushState` and `replaceState` are same document calls with a relative URL; they cannot throw for these values, so no try block is added.

## Existing tests

1. `tests/unit/*`: all keep passing. `store.add(raw, now)` keeps its meaning because `dateKey` defaults to `toDateKey(now)`.
2. `tests/e2e/app.spec.js`, "every button and checkbox has its Vietnamese accessible name": the first expected list for `main` gains the three nav buttons at the front: `['Xem ngày trước', 'Xem ngày sau', 'Về hôm nay', 'Thêm', ...]`. The picker is an input of type date, so it is not in that selector. This is the only expected change.
3. The midnight tests (daily-task-log R25) stay valid as written, because they view today when midnight passes, which is the R19 case. The "adding right after midnight" test still saves to the new day, because the viewed day follows to the new today before the add.
4. The keyboard only test starts on the add input and tabs forward, so the new controls before it do not affect it.

## Test strategy

Unit (`node:test`):

1. `parseDateKey`: valid key gives the right local date; `2026-02-30`, `2026-13-01`, `2026-1-5`, `20261108`, `""`, `null`, `"<b>"`, `1999-12-31` and `2100-01-01` give null; `2000-01-01`, `2099-12-31` and `2028-02-29` are valid.
2. `addDays`: across a month end, a year end, 29 February, and a run of 400 single steps that lands on the expected key (this covers any DST change in the test machine's zone, because the code uses date components, not milliseconds). Null past `2099-12-31` and before `2000-01-01`, null for an invalid key.
3. `dayKind` for all five kinds; `dateLine` for the four examples in the requirements table.
4. `store.add` with a `dateKey` saves that date and the real `createdAt`, and the task lands at the end of that day's `tasksFor`.

End to end (`tests/e2e/day-nav.spec.js`, desktop and mobile projects, clock fixed at `2026-11-09T09:00+07:00` like `app.spec.js`):

1. Arrows and Về hôm nay: wording, list, summary and stamp for yesterday, tomorrow and far days; focus stays on the control; Về hôm nay `aria-disabled` on today and pressing it does nothing.
2. Address: a move writes `#yyyy-mm-dd`, back to today removes it, browser Back and Forward retrace each day, reload keeps the day and focuses the add input, invalid and out of range hashes show today with a clean address and no error, a hash equal to today is cleaned without adding a history entry.
3. Picker: choosing a date shows it and writes the hash; a cleared value or `1999-12-31` changes nothing and the field shows the viewed day after blur; arrows do nothing at the year bounds.
4. Working on another day: add on yesterday saves `date: "2026-11-08"` and keeps typed add text across a move; tick, edit and delete on another day; open edit dropped and delete note closed on a move; add error cleared.
5. Midnight: viewing today follows to the new today; viewing tomorrow stays and turns into today wording with a muted Về hôm nay and a clean address; viewing an older day stays with plain wording; an add right after midnight on another day saves to the viewed day.
6. Stamp shows without the celebrate class when arriving on an all done day; ticking the last task on another day celebrates.
7. Usability: Tab order heading area to previous, next, picker, Về hôm nay, then add input; every nav control at least 44 by 44 px; no horizontal scroll at 360 px; switching to a day with 200 tasks takes under 100 ms (timed in the page with `performance.now()`).

## Requirement mapping

| Req | Satisfied by |
| --- | --- |
| R1, R2 | Arrow handlers with `addDays`, `go` |
| R3 | Picker `change`, `parseDateKey`, picker `value = viewed` in `renderWording` |
| R4, R5 | Về hôm nay handler, `aria-disabled` in `renderWording`, existing `.today-tab[aria-disabled]` CSS |
| R6 | `renderWording` and `renderDay` |
| R7 | `resetTransient` |
| R8 | `go` leaves focus alone; `aria-live="polite"` on the date line |
| R9 | `parseDateKey` and `addDays` return null; `go(null)` resets the picker; picker `blur`; `min` and `max` on the input |
| R10, R12, R13 | `renderDay` with `store.tasksFor(viewed)`, wording table, existing `updateSummary` |
| R11 | `dateLine`, `dayKind` |
| R14 | `renderDay` clears the celebrate class; existing tick handler celebrates |
| R15, R17, R18 | Existing row, dialog and store code, unchanged |
| R16, R21 | `store.add(value, now, viewed)` after `checkDay(now)` |
| R19, R20 | `checkDay` split on `wasToday` |
| R22, R23, R25 | `writeAddress(key, true)` in `go` |
| R24 | `syncFromAddress` on `popstate` and `hashchange`, load step |
| R26 | Load focuses the add input |
| R27, R28, R29 | Nav markup order and buttons in `index.html`, existing day nav CSS, wording table |
| NFR1 | In memory `tasksFor`, one list rebuild per move |
| NFR2 | Address only read through `parseDateKey`; text via `textContent` |
| NFR6 | Relative URLs in `writeAddress` |
