# Tasks: day-navigation

Order: T1 and T2 can run in parallel. T3 needs T1. T4 needs T3. T5 needs T4. T6 needs T2 and T4. T7 needs T5 and T6. All existing unit and end to end tests must keep passing after every task, apart from the one expected list that T3 updates.

## T1: Date rules for any day
Owner: be
Requirements: R1, R2, R3, R9, R11, R24, NFR2
Depends on: none
Boundary: `src/date.js`, `tests/unit/date.test.js`
Done when: `MIN_YEAR`, `MAX_YEAR`, `parseDateKey`, `addDays`, `dayKind` and `dateLine` exist with the signatures in `design.md`; `npm test` passes with new tests for valid keys, impossible dates (2026-02-30, 2026-13-01), wrong formats (`2026-1-5`, empty, null, markup text), the bounds (1999-12-31 and 2100-01-01 rejected, 2000-01-01 and 2099-12-31 accepted, 2028-02-29 accepted), `addDays` across month end, year end and leap day, 400 single steps landing on the expected key, null at the bounds, all five `dayKind` values, and the four date line examples from the requirements.

## T2: New task takes a given date
Owner: be
Requirements: R16, R21
Depends on: none
Boundary: `src/store.js`, `tests/unit/store.test.js`
Done when: `store.add(raw, now = new Date(), dateKey = toDateKey(now))` saves `date = dateKey` and `createdAt = now.getTime()`; a new unit test adds to `2026-11-08` with `now` on 2026-11-09 and finds the task last in `tasksFor("2026-11-08")` and stored after a new `createStore`; every existing store test passes unchanged.

## T3: Nav markup, day wording and load from the address
Owner: fe
Screens: ux/screens/today.html, ux/screens/yesterday.html, ux/screens/past-day.html, ux/screens/past-empty.html, ux/screens/future-empty.html
Requirements: R5, R6, R10, R11, R12, R13, R14, R24, R26, R29, NFR2, NFR6
Depends on: T1
Boundary: `index.html`, `src/app.js`, `tests/e2e/day-nav.spec.js` (new), `tests/e2e/app.spec.js` (accessible names list only)
Done when: the nav row from the prototype is in `index.html` with `<button type="button">` arrows and Về hôm nay, the date stamp input (`aria-label="Chọn ngày"`, `min`, `max`), and `aria-live="polite"` on the date line; `app.js` uses `viewed` and `today` instead of `shownDate`, with `renderWording` and `renderDay` as in `design.md`; loading `#2026-11-08` shows "Việc cần làm", "Hôm qua, Chủ Nhật, 08/11/2026", the past placeholder and that day's tasks with the add input focused; `#2026-11-10` with no tasks shows the future empty text; an all done day shows `progress--complete` without `progress--celebrate`; `#2026-02-30`, `#1999-12-31`, `#abc` and `#2026-11-09` show today with no error and the address cleaned to the plain path with no new history entry (`history.length` unchanged); Về hôm nay has `aria-disabled="true"` on today; the names test in `app.spec.js` expects the three nav buttons first; all e2e tests pass.

## T4: Previous, next, back to today, and browser history
Owner: fe
Screens: ux/screens/today.html, ux/screens/yesterday.html, ux/screens/tomorrow.html, ux/screens/today--focus.html
Requirements: R1, R2, R4, R5, R7, R8, R9, R22, R23, R25
Depends on: T3
Boundary: `src/app.js`, `tests/e2e/day-nav.spec.js`
Done when: `resetTransient`, `go`, `writeAddress` and `syncFromAddress` work as in `design.md`; e2e tests show that previous and next move one day and write `#yyyy-mm-dd`, Về hôm nay returns to today and removes the hash, pressing Về hôm nay on today does nothing and keeps focus, focus stays on the pressed control after each move, browser Back and Forward retrace three moves day by day, `#2099-12-31` plus next and `#2000-01-01` plus previous change nothing, and a move drops an open edit without saving, closes an open delete note without deleting, clears the add error, and keeps typed add text.

## T5: Date picker
Owner: fe
Screens: ux/screens/picker-open.html, ux/screens/today--focus.html, ux/screens/past-day.html
Requirements: R3, R9, R27
Depends on: T4
Boundary: `src/app.js`, `tests/e2e/day-nav.spec.js`
Done when: the picker value always equals the viewed day after any move, load or midnight refresh; e2e tests set the picker with `fill('2026-10-01')` and see that day with the hash written and focus on the picker; filling an empty value or `1999-12-31` keeps the viewed day, and after blur the picker shows the viewed day again; a picked date equal to the viewed day adds no history entry.

## T6: Work on any day and the midnight rules
Owner: fe
Screens: ux/screens/tomorrow.html, ux/screens/future-empty.html, ux/screens/past-empty.html
Requirements: R14, R15, R16, R17, R18, R19, R20, R21
Depends on: T2, T4
Boundary: `src/app.js`, `tests/e2e/day-nav.spec.js`
Done when: the add handler calls `checkDay(now)` then `store.add(value, now, viewed)`, and `checkDay` follows the two branches in `design.md`; e2e tests show that adding on yesterday stores `date: "2026-11-08"` at the end of that day; tick, edit and delete on another day keep date and order and save; ticking the last task on another day celebrates; with the clock moved past midnight, viewing today follows to 10/11, viewing `#2026-11-10` stays and shows "Việc cần làm hôm nay", "Hôm nay, Thứ Ba, 10/11/2026", a muted Về hôm nay and a plain address, viewing `#2026-11-05` stays with an open edit kept, and an add right after midnight on `#2026-11-05` stores that date; every midnight test in `app.spec.js` still passes.

## T7: Page turn motion, keyboard order, size and speed checks
Owner: fe
Screens: ux/screens/today--focus.html, ux/screens/yesterday.html
Requirements: R8, R27, R28, NFR1
Depends on: T5, T6
Boundary: `src/app.js`, `tests/e2e/day-nav.spec.js`
Done when: a move adds `turn--back` or `turn--forward` on `.sheet__body` by direction and `washi--restick` on the date line, both removed on `animationend`, and none on load or midnight; e2e tests check Tab order from the page start (previous, next, Chọn ngày, Về hôm nay, add input), that each nav control is at least 44 by 44 px, no horizontal scroll at 360 px on today and on a past day, and that moving to a day with 200 tasks renders in under 100 ms timed in the page with `performance.now()`.
