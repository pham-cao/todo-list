# Tasks: page-flip

Order: T1 comes first, because `src/flip.js` imports `daysBetween`. The FE tasks all touch `src/flip.js`, `src/app.js` or the same spec files, so they run one after another: T2, T3, T4, T5, T6, T7, T8, T8b, T8c, T8d, T8e, T9. T10 is the release step. All existing unit and end to end tests must keep passing after every task. Leaf markup and classes come from the "Page flip" block of `docs/project/design-system.css` and from `ux/screens/flip.html`; interfaces are in `design.md`. New imports carry `?v=1.3.0` until T10. Run Playwright with `--workers=2`.

Status 2026-11-12: T1 to T8b are done and committed. T8c and T8d come from the owner scope change of 2026-11-12 (whole sheet flip, always flip, 700 ms, no tape re-press); see "Change 2026-11-12" in design.md, which overrides the older text in T2 to T8 where they differ. T8e comes from the owner decision of 2026-11-13 (soft paper bend); see "Change 2026-11-13: soft paper bend" in design.md, which overrides the flat leaf and the gradient shade.

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

## T8b: Perceptible flip motion (BUG-028) (done)
Owner: fe
Screens: ux/screens/flip.html
Requirements: R8, R3a, R9
Depends on: T8
Boundary: `src/flip.js`, `tests/e2e/flip.spec.js`, the Page flip block of `docs/project/design-system.css` and `docs/project/design-system.md` (exception chosen by the owner)
Done when: committed in 349716c; perspective origin on the hinge, an ease that moves at once, the back fading in at 70 to 92 percent, the end timer from the first frame with a 2x backstop, and the real time check TC-page-flip-T8-11 passing. Two reviewer minors are carried into T8c and T8d.

## T8c: Always flip, 700 ms, no tape re-press
Owner: fe
Screens: ux/screens/flip.html
Requirements: R3, R3a, R12, R28, R29, R39, R7, NFR4, NFR7 (as amended)
Depends on: T8b
Boundary: `src/flip.js`, `src/app.js` (the `createFlip` call only), the Page flip block of `docs/project/design-system.css` and `docs/project/design-system.md` (same exception as T8b), `tests/e2e/helpers.js`, `tests/e2e/flip.spec.js`, `tests/e2e/day-nav.spec.js` (its T7 block only)
Done when: as in design.md "Change 2026-11-12": `allowed()` is `CAN_3D && !document.hidden` with no reduced motion listener; the tape re-press, `unstick` and the `date` parameter are gone from `src/flip.js` and the call in `src/app.js`; `--dur-flip` is 700 ms and the Page flip block hides nothing under reduced motion but keeps `.flip-stage, .flip-stage *` at `--dur-flip` over the global 1 ms rule; design-system.md shows 700 ms, a 950 ms riffle, the flip playing under reduced motion (owner decision, WCAG 2.3.3 risk noted), no tape press, and the lifetime bullet names the 2x backstop until the first frame (T8b reviewer minor); `watchFlips` no longer records the tape and `resticksSeen` is gone; flip.spec.js derives every lifetime and wait from `DUR = 700` and `STEP = 125` (timer edge test at 699, 700, 701 and 717 ms); the reduced motion tests in flip.spec.js and day-nav.spec.js are inverted as listed in design.md and show a move under `reducedMotion: 'reduce'` building a stage with the normal leaf count, lifetime and animation duration, a riffle running on when the setting switches on, and the T8b real time `perceptible` check passing under reduced motion; the hidden page and no 3D tests still build no stage; all unit and e2e tests pass in both projects.

## T8d: The whole sheet flips
Owner: fe
Screens: ux/screens/flip.html
Requirements: R8, R11, R13, R18, R19, R31, R35, NFR1, NFR3 (as amended)
Depends on: T8c
Boundary: `src/flip.js` (`copy()`, `place()`), the Page flip block of `docs/project/design-system.css` and `docs/project/design-system.md`, `tests/e2e/helpers.js`, `tests/e2e/flip.spec.js`, and test only selector scoping in the other spec files (as the T2 exception: header selectors pointed at their real ids, no assertion weakened)
Done when: as in design.md "Change 2026-11-12": the copy holds the header and the trimmed body, read from `.sheet`, with `id`, `for`, `aria-live`, `role` and `progress--celebrate` removed; the stage covers the visible part of the sheet from its top, with `--flip-top` and `--flip-offset` measured from the sheet; `.leaf` is plain paper with the sheet radius, `.leaf--blank` stays ruled, and `.leaf__content` is a flex column reaching the leaf bottom so the copied body's rules fill it; design-system.md describes the whole sheet leaf and no longer says the header band never moves; e2e tests show a forward leaf holding the old title, date line and picker value and a back leaf holding the new date line, the stage top at the sheet top unscrolled and at the window top scrolled and always inside the sheet, `elementFromPoint` at the next arrow returning the real button during a flip and a second click moving again, the leaf lining up with the page measured from the sheet top (the `scrolledMove` and `linedUp` change, plus a 360 px today to tomorrow and back case where the title wraps), and T7-09 contrast passing light and dark with a 72 percent frame (T8b reviewer minor) and the copied title and date line inks included; `progress` in helpers.js is `#progress`; the T7 layout, T8 trim, NFR1 and NFR2 tests pass unchanged; all unit and e2e tests pass in both projects.

## T8e: Soft paper bend
Owner: fe
Screens: ux/screens/flip.html
Requirements: R8 (as amended for the soft bend), R3, R4, R11, R13, R34, R35, R39, NFR1, NFR2, NFR4, NFR7
Depends on: T8d
Boundary: `src/flip.js` (`play()`, `fit()`, `place()`, the `flat` flag and `CAN_BEND`), the Page flip block of `docs/project/design-system.css` and `docs/project/design-system.md` (same exception as T8b), `tests/e2e/helpers.js`, `tests/e2e/flip.spec.js`
Done when: as in design.md "Change 2026-11-13: soft paper bend": each leaf is `.leaf` (turn only, `preserve-3d`, no paint) holding face 0 and a nested chain of `.leaf__strip` elements, each holding one `.leaf__face` and the next strip, with `--flip-strips` 8 (6 below 601 px) and `--flip-bend: 28deg` as tokens, `--flip-n` and `--flip-w` on the stage and `--k` on each face; the text leaf has one trimmed copy per face (clones of the first, select values copied), blank leaves have faces and no copy; `leaf-bend` and the per face flat `leaf-shade` keyframes are as written in design.md, back flips use `--flip-sign: -1` and the reverse selector includes the strips and shades; `fit(from, copies)` refits every copy from one set of reads; a first frame over 50 ms makes later flips in the session flat (N = 1), as does no `preserve-3d`; e2e tests T8e-01 to T8e-08 pass (real time bend with the spread under 2 degrees at the ends, at least 15 degrees between 40 and 60 percent and at least 10 degrees for 35 percent of `DUR`, equal kinks, free edge trailing forward and back, riffle leaves bending, strips joined on every frame, the back only on strips turned 55 degrees or more, drawn widths, shade monotonic along the strips in light and dark, the slow frame and no `preserve-3d` fallbacks, resize and scrolled refit, copies without ids and with the page's select values); the tests that read inside the leaf scope to its first copy with unchanged assertions; T7-09 contrast passes light and dark under the darkest face shade, including the 72 and 28 percent frames; the T7 dark test reads the faces; the T8 NFR1 and NFR2 tests pass unchanged and each NFR2 run asserts N faces per leaf (8 at 1440 px, 6 at 390 px); the T8b `perceptible` checks pass; design-system.md describes the bend, the two tokens, the faces and the fallback; FE reports the frame medians and the first frame time with N copies; all unit and e2e tests pass in both projects.

## T9: Remove the superseded page turn and tape styles
Owner: fe
Requirements: R9, R12, R41
Depends on: T8e
Boundary: `docs/project/design-system.css`, `docs/project/design-system.md`
Done when: `--dur-turn`, `.turn--back`, `.turn--forward`, `@keyframes turn-back` and `turn-forward`, `.washi--restick`, `@keyframes restick` and their reduced motion rule are gone from the Day navigation block; the design-system.md page turn bullet points to the Page flip section and no longer mentions the tape press, the "Superseded" note in the Page flip section is removed, and the general motion line ("Everything is reduced to an instant change under prefers-reduced-motion") names the page flip as the one exception; `grep -rn "turn--\|dur-turn\|restick" src index.html docs/project/design-system.*` finds nothing, and `grep -rn restick tests` finds nothing (T8c removed the tape checks; the guard test that no `turn--` class is ever set stays); all unit and e2e tests pass.

## T10: Release version 1.4.0
Owner: be
Requirements: NFR8, NFR9
Depends on: T9
Boundary: `package.json` and `package-lock.json` (`version` only), the `?v=` values in `index.html` and `src/*.js`
Done when: `version` is `1.4.0` in package.json and the lockfile root, and every `?v=1.3.0` in `index.html` and `src/*.js` (including the new `./flip.js` import in app.js and the `./date.js` import in flip.js) is `?v=1.4.0`; `tests/unit/version.test.js` passes and fails when one reference is changed back by hand; a short release note says the whole sheet now turns on a day change, always, also when the system asks for reduced motion (owner decision, 2026-11-12), and lists the manual checks (Safari and iOS: the whole sheet, header included, turns on the holes in 700 ms, also with Reduce Motion on, and bends like soft paper mid turn with the free edge trailing and no seam lines between strips, light and dark; no leaf left after quick taps; no flash in dark mode; a mid range Android phone: the 950 ms riffle looks smooth); all unit and e2e tests pass in both projects.
