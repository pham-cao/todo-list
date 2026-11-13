# Test Plan: page-flip

Branch: page-flip. Test basis: requirements.md (R1 to R41 with R3a and R3b, NFR1 to NFR10), design.md, tasks.md (T1 to T15), ux/flows.md, ux/screens/flip.html, docs/project/decisions.md (page-flip entries of 2026-11-11 to 2026-11-13; the latest decision applies). Format follows the ISTQB test plan template and the drag-drop plan.

## Update 2026-11-13 (final refresh before release)

The plan was written for a hinged leaf of 450 ms that stops under reduced motion. The approved feature differs, and this plan now reads as follows. The motion is an StPageFlip curl (diagonal fold from the top right corner, T11 to T14). One page lasts 700 ms and a riffle of 3 pages 950 ms (`--dur-flip`, `--dur-riffle-step` 125 ms). The flip always plays, also when the system asks for reduced motion (owner decision 2026-11-12, accepted risk against WCAG 2.3.3), so the reduced motion cases check that the curl still plays and that no other motion is added. The notebook sits on a thick stack of page edges with a back cover on the right and bottom (R8a, T15). T9 removes the superseded leaf, strip, turn and tape styles, and T10 releases 1.4.0. Cases with a superseded or dropped result are kept in the log and are not counted as executed against the final design. Test cases for T11 to T15 were added during execution; the final counts are in section 6 and in test-summary-report.md.

## 1. Objective

Show that every day change by the owner plays the right page curl (one page, or a riffle of 2 or 3 pages) in the right direction, that the day, address, focus and screen reader text change at once and never wait for the motion, that quick and held key moves always end on the correct day with no leaf left, that the owner can keep working while a leaf turns, that the flip still plays under reduced motion with no extra motion, that a hidden page, missing 3D support and any list rebuild end the motion cleanly, that the leaf never harms accessibility, layout or data, that the notebook shows a thick page stack at all times without layout change or sideways scroll at 360 px (R8a), and that the release is version 1.4.0 with every cache busting reference updated.

## 2. Scope

In scope:

1. `src/date.js` (`daysBetween`), `src/flip.js` (new: `leafCount`, `createFlip`, copy and trim, stage, timer, StPageFlip curl with pooled books, ending listeners), the vendored library in `vendor/page-flip/` with its two patches, `src/app.js` (`changeDay`, `go`, `syncFromAddress`, `flip.end()` in `renderList`, held key tracking `repeating`, `held`, `release`), the Page flip block and the thick notebook tokens (`--shadow-sheet`, `--stack-u`) of `docs/project/design-system.css`, and the removal of the old page turn, leaf, strip and tape styles (T9).
2. All entry points (arrows, picker, Về hôm nay, browser Back and Forward, hash edit), the no flip cases (load, reload, midnight, invalid hash, same day), riffle counts and timing, direction by date comparison, quick and held moves, interruptions, work during a flip, drag and long press at the day change, reduced motion (the flip still plays), hidden page, no 3D support, theme change, layout at 1440, 390 and 360 px, dark mode, speed with 200 tasks.
3. Regression of day-navigation and drag-drop day change rules (R41), storage behaviour (R27, R40) and accessibility (names, tab order, live date line, axe with a stage present).
4. Release 1.4.0: `package.json`, lockfile and every `?v=` reference including `./flip.js` and its `./date.js` import.

Out of scope (requirements "Out of scope"): sideways swipe to change day, a stack that grows with the day, flipping the header or other things, more than 3 leaves, a crossfade for reduced motion, any switch to turn the flip off, an in app switch, keyboard shortcuts, any data model change.

Not testable on this host: WebKit (Safari and iOS Safari), a real iPhone, a real mid range Android phone. These are manual cases marked `manual` in test-cases.csv (NFR8, NFR2), are logged as blocked and are listed as manual checks in release-notes.md. Edge shares Chromium. Firefox is not a Playwright project, so the Firefox spot check is a hand run.

## 3. Test levels and approach

| Level | What | Tool | Cases |
| --- | --- | --- | --- |
| Unit | `daysBetween`, `leafCount`, version and cache busting | node:test (`tests/unit/`, 88 tests in the suite) | 11 |
| End to end, desktop project | Entry points, direction, leaf counts, lifetimes, rapid and held moves, interruptions, work during a flip, layout, dark mode, speed | Playwright, Desktop Chrome | 139 e2e in total |
| End to end, mobile project | Touch taps, swipe left on a row, long press at a day change, layout at 390 and 360 px | Playwright, Pixel 7, CDP touch | part of 110 |
| Accessibility | axe with a stage present, accessibility tree, tab order, live region count, flash rate, reduced motion CSS fallback | Playwright with a11y skill | within e2e |
| Manual and exploratory | Prototype comparison, stack at 360 px, subpath and network check, mutation check of the version test, real Safari and iOS, Android, Firefox and Edge, screen reader, exploratory charters | Playwright MCP and hand testing | 35 |

Total 194 cases (see section 6). By priority: Critical 66, High 96, Medium 32. Counts per task (id prefix): T1 11, T2 15, T3 16, T4 19, T5 17, T6 22, T7 18, T8 33, T9 4, T10 11, T11 4, T12 2, T13 2, T14 12, T15 8 (the original plan had 140 cases for T1 to T10; the rest were added when the design changed). T1 cases 08 to 10 cover `leafCount`, which the tasks file builds in T2, so they are tagged T1 and T2.

Techniques: equivalence partitioning (entry points, pointer types, themes), boundary value analysis (1, 2, 3 and 9 day distances, 699, 700 and 701 ms and the 950 ms riffle, 100 ms presses, 200 tasks, 360 and 390 px, 44 px targets), decision tables (which way, how many leaves, what ends a flip, focus on a removed row, held key release triggers), state transitions (settled, flipping, interrupted, held, hidden, reduced motion), use cases (one per flow in `ux/flows.md`), error guessing (exception in `play()`, quota error, same text on both days, select values on the copy), exploratory charters.

Motion timing method (as agreed): no pixel exact screenshots. Timing and presence are checked with `watchFlips(page)` (a MutationObserver log of stage add and removal times, leaf count, blank count, `--i`, class and attributes) and with frame sampling (rAF timestamps, `PerformanceObserver` for `longtask`, computed styles and `getAnimations()` at sampled frames). Visual comparison with the prototype is manual at 1440 and 390 px, by eye, at the 20, 50 and 80 percent frames. Lifetime assertions use the budgets 700 ms (one page), 825 ms (2 pages) and 950 ms (3 pages) plus a 100 ms tolerance, never exact values. Curl shape is checked from the library's computed clip and transform at sampled frames, not by pixel comparison.

## 4. Environment and test data

1. Static page served by `npm start` on port 4173; Playwright projects `desktop` (Desktop Chrome) and `mobile` (Pixel 7). Run every Playwright command with `--workers=2`.
2. Fixed clock from `helpers.js` (`TODAY` 2026-11-09, `NOW`, `AFTER_MIDNIGHT`, `passMidnight`). New helpers `watchFlips` and `flipsSeen` come from T2. Row and label locators are scoped to `#day-list` so leaf copies never match.
3. Data sets: (a) three consecutive days with different task text, one with a done task; (b) same task text on two days; (c) 200 tasks on two days, in groups, settled; (d) empty day (both empty state texts); (e) a day with a long list so the sheet body can scroll; (f) task and group names with markup (`<b>x</b>`) to confirm plain text copy; (g) quota error on `localStorage.setItem`.
4. Environment switches: `emulateMedia` for reduced motion and colour scheme, init scripts for `document.hidden`, `CSS.supports` returning false for `rotateY`, and a forced exception in `play()`; `TZ=Europe/Berlin` for the unit DST cases.
5. Evidence per case under `qa/evidence/<TC-ID>/` at execution time (runner output, console and network logs, screenshots for manual cases, the observer log for motion cases).

## 5. Entry and exit criteria

Entry:

1. Requirements, UX, design and tasks approved (decisions.md, 2026-11-11 and 2026-11-12).
2. For each task, the owner reports `implemented` and all existing unit and e2e tests pass before QA starts.
3. T2 needs `daysBetween` from T1. T3 to T9 run in order, as in tasks.md.

Exit:

1. Every requirement R1 to R41 (with R3a, R3b and R8a) and NFR1 to NFR10 has at least one executed case (the matrix has no gap after the R8a cases of T15 were added).
2. All Critical and High cases pass. Manual cases that cannot run here (real iPhone, Android, Safari) are listed as residual risk with the manual check from the release note.
3. No open Critical or High bug.
4. All unit and e2e tests pass in both projects, and the linter passes if present.
5. Speed with 200 tasks: update under 100 ms; 3 leaf riffle with no `longtask`, median frame time at most 18.2 ms and no frame over 50 ms (Chromium, median of 3 runs); Firefox spot check reported with the loaded host residual already accepted in decisions.md (the first frame on a scrolled 200 row day took 31 to 57 ms; accepted 2026-11-13).
6. `package.json`, lockfile and every `?v=` reference read 1.4.0, and the version test passes and fails when one reference is changed back.

## 6. Counts and coverage

194 cases: unit 11, e2e 139, manual 35, superseded 9 (automation column; counts per final result are in the report). Final results: 168 passed, 11 blocked (real devices and browsers not on this host), 14 superseded by later owner decisions, 1 dropped (T7-12, state unreachable), 0 failed. 41 requirements plus R3a, R3b and R8a and 10 NFRs are all mapped in `traceability-matrix.csv`; there is no uncovered requirement. UX screen inventory states are each covered: settled day (T2-09, T2-10), forward and back flip (T2-01, T2-02), riffle of 2 and 3 (T3-02 to T3-07), interrupted (T4-01 to T4-05), held key (T5), working during a flip (T6), reduced motion (T4-07, T4-08), hidden page (T4-09, T4-10), dark mode (T7-07 to T7-10), phone 390 and 360 px (T7-01 to T7-06), thick stack settled and during a flip (T15-01 to T15-08).

## 7. Regression focus

| Area | Why at risk | Cases |
| --- | --- | --- |
| Day change rules of day-navigation (focus, live date line, address, history, picker) | `go` and `syncFromAddress` now share `changeDay` | T2-03 to T2-05, T3-10 to T3-14, T4-03 |
| Drag and long press at a day change | `drag.cancel()` must run before the copy, and scroll lock must not stick | T6-12 to T6-14 |
| List rebuild paths (add, delete, filter, storage, midnight) | `renderList` now ends the flip; adding during a flip cuts the page short by decision | T2-13, T4-12 to T4-14, T6-02 |
| Reduced motion | The curl must still play (owner decision) and nothing else must move | T8c-02, T8c-03, T8c-08, T8c-09, T9-04 |
| Swipe left on phones | Must stay a row action, never a day change | T7-04, T7-05 |
| Accessibility names, tab order, live region | Stage must stay invisible to assistive technology | T6-07 to T6-10, T6-21, T6-22 |
| Storage | The flip must never write or delay a save | T6-15, T6-16 |
| Speed with 200 tasks | Copy trim and frame budget | T8 |
| Thick stack | Shadow reach must stay inside the gutter and add no scroll | T15-01 to T15-05 |
| Release and cache busting | New `flip.js` module, vendored library and imports | T10-01 to T10-04 |

## 8. Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| A path that leaves a stage on screen (timer, hidden page, rebuild) | High | Medium | Observer log after every interruption case; zero node count after 30 moves; exploratory charter 1 |
| Held key logic: `repeat` flag and release detection differ by key (Enter on keydown, Space on keyup) and by browser | High | Medium | T5 covers Enter, Space, mouse click, picker repeat, focusout, blur, hidden; Firefox and Safari manual |
| A flip that delays or reorders the day change, focus or live announcement | High | Low | Same task read of heading, address, focus and live region right after the click (T2-03, T2-04, T6-22) |
| Frame budget missed with 200 tasks | Medium | Medium | Copy trim, longtask and frame sampling, median of 3, Android manual |
| Leaf reachable by assistive technology or pointer | High | Low | Attribute, tab walk, accessibility tree, axe and click through cases |
| Flash or light frames in dark mode | Medium | Low | Frame sampling and real iPhone dark check |
| Safari and iOS 3D transform behaviour unknown | Medium | Medium | Manual checks in the release note (NFR8) |
| Dialog `toggle` not supported in older browsers (design note) | Low | Low | The timer ends the leaf under the modal; accepted in design.md |
| Timing assertions flaky on a loaded host | Medium | Medium | Tolerance of 100 ms, observer log rather than polling, retries analysed with qa-investigation |

## 9. Open points found while planning (all settled by the owner decisions of 2026-11-12 and 2026-11-13; kept for the audit trail)

1. Add, edit save and delete rebuild the list, so they end the flip (decision 2026-11-12: any `renderList` ends it), but R23 says these actions must work "at once". T6-02 and T6-04 accept either outcome for the leaf only if the action is applied to the new day. Confirm that an add or save within 450 ms may cut the page short, and whether edit save and tick are meant to rebuild (a tick does not, per the decision).
2. R15 held key in the date picker: the decision says follow R15. A repeat in the picker means `event.repeat` on a `keydown` in the date field. T5-14 assumes the arrow keys in the field raise `change` with `repeat` true in Chromium. If the browser does not raise `change` per step, the case is reported as not applicable for that browser.
3. R38 window blur: the design lets the timer finish (up to 700 ms) while R38 says "finish or end". T4-11 asserts no stage after 700 ms plus a frame. Confirm this reading.
4. R17 and R15 with a typed date: a typed digit sequence may report no valid intermediate dates in some browsers. T4-06 records the observed sequence.
5. Firefox is not a Playwright project. T8-08 needs a temporary config or a hand run. Confirm that this is acceptable instead of adding a project.
6. R15 for Về hôm nay (T5-16): the tab is muted on today, so the hold can only move once. Confirm that no motion on repeated Enter is expected there.

## 10. Deliverables and reporting

test-plan.md, test-cases.csv, traceability-matrix.csv, test-execution-log.csv (one row per executed case), evidence per case under `qa/evidence/<TC-ID>/`, bugs under `docs/project/bugs/`, and test-summary-report.md in report mode. Progress is reported per task: planned, executed, passed, failed, blocked.

## 11. Roles and notes

QA executes and logs and does not fix production code. Suggested specialist: `sdlc:qa-test-generator` to turn the e2e cases of T3 to T8 into Playwright specs in `tests/e2e/flip.spec.js` (the FE owner writes the tests named in tasks.md, the generator can add the cases not named there). `sdlc:qa-test-planner` is not needed. No API exists, so no API specialist is needed. Test code is not written in plan mode.
