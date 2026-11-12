# Tasks: page-flip

Order: T1 comes first, because `src/flip.js` imports `daysBetween`. The FE tasks all touch `src/flip.js`, `src/app.js` or the same spec files, so they run one after another: T2, T3, T4, T5, T6, T7, T8, T9. T10 is the release step. All existing unit and end to end tests must keep passing after every task. Leaf markup and classes come from the "Page flip" block of `docs/project/design-system.css` and from `ux/screens/flip.html`; interfaces are in `design.md`. New imports carry `?v=1.3.0` until T10. Run Playwright with `--workers=2`.

## T1: Days between two date keys
Owner: be
Requirements: R3, R3a, R5
Depends on: none
Boundary: `src/date.js`, `tests/unit/date.test.js`
Done when: `daysBetween(a, b)` works as in design.md; unit tests cover the same day (0), 1 and -1, a month end, a year end, 28 February to 1 March 2028 (2 days), 2000-01-01 to 2099-12-31, and an invalid or out of range key giving null; `npm test` passes.

## T2: Flip module and one leaf on the arrows
Owner: fe
Screens: ux/screens/flip.html
Requirements: R1, R4, R6, R8, R9, R10, R11, R12, R18, R19, R41
Depends on: T1
Boundary: `src/flip.js` (new), `tests/unit/flip.test.js` (new), `src/app.js` (remove `TURNS`, `turnPage`, `endTurn`; create the flip; `changeDay`; `flip.end()` in `renderList`), `tests/e2e/helpers.js`, `tests/e2e/day-nav.spec.js` (the T7 page turn tests only), `tests/e2e/flip.spec.js` (new)
Done when: `leafCount`, `createFlip`, `changeDay` and the `renderList` hook work as in design.md (copy without the trim yet); unit tests for `leafCount` pass; `rows` and `labels` in helpers.js are scoped to `#day-list` and `watchFlips` and `flipsSeen` replace `watchTurns`; e2e tests show the next arrow building one forward stage with one non blank leaf whose copy holds the old day's task text, the previous arrow building one `flip-stage--back` stage whose copy holds the new day's text, the stage `aria-hidden="true"` and `inert` with no `id` inside, the date tape getting `washi--restick` once and losing it after its animation, the stage removed within 450 ms plus 100 ms, the heading, date line, rows, address and picker already on the new day in the same task as the click, focus still on the arrow, and no stage on load, reload, midnight (`passMidnight`) and an invalid hash; no `turn--` class is set anywhere; all unit and e2e tests pass.

## T3: Riffle and every entry point
Owner: fe
Screens: ux/screens/flip.html
Requirements: R2, R3, R3a, R3b, R4, R5, R6
Depends on: T2
Boundary: `src/flip.js` (fixes only), `src/app.js` (fixes only), `tests/e2e/flip.spec.js`
Done when: e2e tests show a picker move of 1 day building 1 leaf, 2 days 2 leaves (1 blank), 3 and 9 days 3 leaves (2 blank), the blank leaves having no `.leaf__content`, leaf `--i` values as in design.md for forward and back, removal within 575 ms and 700 ms plus 100 ms; Về hôm nay from 1 day and from 6 days away, both forward and back; browser Back and Forward choosing direction and leaf count by the two dates, not by history direction (Back from today to tomorrow flips forward); an edited hash flipping like a move; a picker or hash move to the viewed day building no stage; all e2e tests pass.

## T4: Rapid moves and interruptions
Owner: fe
Screens: ux/screens/flip.html
Requirements: R7, R14, R16, R17, R28, R29, R36, R37, R38, R39, NFR4, NFR7
Depends on: T3
Boundary: `src/flip.js`, `src/app.js` (fixes only), `tests/e2e/flip.spec.js`, `tests/e2e/day-nav.spec.js` (the reduced motion test only)
Done when: e2e tests show a move during a flip removing the old stage and building one new stage for the new distance with never two stages at once (observer log); 30 arrow presses at 100 ms ending on the right day with the address, history length, picker value and every text matching, and zero `.flip-stage` and `.leaf` nodes 800 ms after the last press; picker typing that reports several valid dates ending on the typed day with no stage left; reduced motion building no stage and no tape press, and switching it on during a flip removing the stage at once; a hidden page (`visibilitychange` with `document.hidden` true) building no stage on a move and ending a running one; a window `blur` during a flip leaving no stage after 700 ms; a storage event on the groups key and the delete note opening each ending a running flip at once; `CSS.supports` returning false for 3D (init script) building no stage and no error; a theme change during a flip leaving no stage after it; all e2e tests pass.

## T5: Held key repeat and release
Owner: fe
Screens: ux/screens/flip.html
Requirements: R15, R7, R14
Depends on: T4
Boundary: `src/app.js` (`repeating`, `held`, `release`, the arrow and picker handlers, the visibilitychange listener), `tests/e2e/flip.spec.js`
Done when: held key tracking works as in design.md; e2e tests (Playwright `keyboard.down` repeated on a focused arrow, then `keyboard.up`) show the first down building one stage as an ordinary move, every repeated down changing the day, address and date line at once with no stage and ending a running one, the release building one stage from the day before the first repeat to the day at release with the R3 leaf count (2 repeats give 2 leaves, 5 repeats give 3) and the R4 direction, a hold on the previous arrow flipping back, focus moving away during a hold and a window `blur` each acting as the release, a hidden page during a hold playing no motion, a single Space press on an arrow still flipping (not taken as a repeat), and a mouse click after a hold flipping normally; all e2e tests pass.

## T6: Working on the page during a flip
Owner: fe
Screens: ux/screens/flip.html
Requirements: R11, R18, R20, R21, R22, R23, R24, R25, R26, R27, R31, R40, NFR5
Depends on: T5
Boundary: `src/flip.js`, `src/app.js` (fixes only), `tests/e2e/flip.spec.js`
Done when: e2e tests started right after a move (stage present) show typed add text kept across the move with the caret not jumping, a task added saved with the new day's date, a tick, an edit with save, and a delete through the note all applying to the new day's rows only, a click on a point covered by the leaf reaching the real row beneath, Tab and Shift plus Tab following the settled order with no leaf node ever focused, focus on a removed row moving to the add input, the accessibility tree containing no leaf text, axe with a stage present reporting no violation (Chromium), a mouse drag active at a Back move cancelled first with no slip, strip or `is-dragging` left and the stage built without a placeholder in its copy, a touch long press held during a move leaving no stuck scroll lock (mobile project), a new drag starting on the new day's rows during a flip, and the stored task, group and ui strings unchanged byte for byte after 20 moves; all e2e tests pass.

## T7: Layout, phones and dark mode
Owner: fe
Screens: ux/screens/flip.html
Requirements: R13, R30, R32, R33, R34, R35, R36
Depends on: T6
Boundary: `src/flip.js` (fixes only), `docs/project/design-system.css` (Page flip block, fixes only), `tests/e2e/flip.spec.js`
Done when: e2e tests at 1440, 390 and 360 px show no horizontal scroll and an unchanged `documentElement.scrollHeight` while a 3 leaf riffle plays and after it, the stage inside the `.sheet` box, the same leaf count and lifetimes in the mobile project as on desktop, a swipe left on a row still opening Sửa and Xóa with no day change, every nav control still at least 44 by 44 px, and in dark mode the `.leaf__back` background equal to the dark `--color-leaf-back` and the leaf never using the light paper colour; a scrolled page (sheet body partly above the window) shows the copy lined up with the page through `--flip-offset`; all e2e tests pass.

## T8: Speed with 200 tasks
Owner: fe
Screens: ux/screens/flip.html
Requirements: NFR1, NFR2, NFR3, NFR4
Depends on: T7
Boundary: `src/flip.js` (the trim in `copy()`), `tests/e2e/flip.spec.js`, `tests/e2e/day-nav.spec.js` (no change expected)
Done when: `copy()` trims rows below the window as in design.md; e2e tests show the existing day-navigation "under 100 ms" tests passing unchanged with the flip on, a leaf copy of a 200 task day holding no more rows than reach into the window, and (Chromium, median of 3 runs) a 3 leaf riffle between two 200 task days recording no `longtask` entry, a median frame time of at most 18.2 ms and no frame over 50 ms; all e2e tests pass.

## T9: Remove the superseded page turn styles
Owner: fe
Requirements: R9, R41
Depends on: T8
Boundary: `docs/project/design-system.css`, `docs/project/design-system.md`
Done when: `--dur-turn`, `.turn--back`, `.turn--forward`, `@keyframes turn-back` and `turn-forward`, and their reduced motion entry are gone, while `.washi--restick` and `@keyframes restick` stay with their reduced motion rule; the design-system.md page turn bullet points to the Page flip section and the "Superseded" note is removed; `grep -r "turn--\|dur-turn" src index.html docs/project/design-system.*` finds nothing; all unit and e2e tests pass.

## T10: Release version 1.4.0
Owner: be
Requirements: NFR8, NFR9
Depends on: T9
Boundary: `package.json` and `package-lock.json` (`version` only), the `?v=` values in `index.html` and `src/*.js`
Done when: `version` is `1.4.0` in package.json and the lockfile root, and every `?v=1.3.0` in `index.html` and `src/*.js` (including the new `./flip.js` import in app.js and the `./date.js` import in flip.js) is `?v=1.4.0`; `tests/unit/version.test.js` passes and fails when one reference is changed back by hand; a short release note lists the manual checks (Safari and iOS: the leaf turns on the holes, no leaf left after quick taps, no flash in dark mode; a mid range Android phone: the riffle looks smooth); all unit and e2e tests pass in both projects.
