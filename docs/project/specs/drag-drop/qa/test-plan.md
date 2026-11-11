# Test Plan: drag-drop

Branch: drag-drop. Test basis: requirements.md (R1 to R37, NFR1 to NFR7), design.md, tasks.md (T1 to T9), ux/flows.md, ux/screens/*.html (14 screens), docs/project/decisions.md (the latest decision applies). Format follows the ISTQB test plan template.

## 1. Objective

Show that the owner can pick up a task and drop it into another group with a mouse or a finger, that every drag ends either in one clean move or in no change at all, that the swipe left gesture and page scroll on phones keep working, and that no page is ever left stuck. Also show that the move is the same move as the edit form move, that every move can still be done without dragging (WCAG 2.5.7), that task-groups behaviour, speed and data stay intact, and that the release is version 1.3.0 with all cache busting references updated.

## 2. Scope

In scope:

1. `src/store.js` (`setGroup`), `src/drag.js` (new: gesture, slip, strip, hit testing, auto scroll, cancel, `scrollSpeed`), `src/app.js` (`createDrag` wiring, `dropOrCancel`, `moveRow` message and the info slip), `index.html` (`#drag-template`).
2. Mouse, pen and touch drags, the 400 ms long press, the cancel and interruption paths, auto scroll, drop targets (section header, row, empty space, folded section, strip), the filter and the folded section cases, storage failure.
3. Regression of task-groups: edit form move, filter, collapse, Nhóm việc dialog and delete note, swipe left on phones, page scroll, day navigation and midnight, and the settled 200 task speed (Chromium, with a Firefox spot check).
4. Accessibility (strip and slip not in the reading order, names and Tab order unchanged, axe on dragging states, 3 to 1 target contrast, 44 px targets, reduced motion) and the plain text rendering of task text and group names.
5. Release 1.3.0: `package.json` version and every `?v=` reference, including `./drag.js` and its `./groups.js` import.

Out of scope (requirements "Out of scope"): reordering inside a group, dragging to another day, several tasks at once, a keyboard drag mode, a drag handle, undo, hints, auto expanding folded sections on hover.

Not testable on this host: WebKit (Safari and iOS Safari). The iPhone long press callout and scroll lock are a manual check after release (NFR6, cases T5-18 and T8-16). Edge shares the Chromium engine, so it is covered by Chromium runs.

## 3. Test levels and approach

| Level | What | Tool | Cases |
| --- | --- | --- | --- |
| Unit | `store.setGroup` (T1), `scrollSpeed` (T6), version and cache busting (T9) | node:test (`tests/unit/`) | 22 |
| End to end, desktop project | Mouse and pen drag, drop targets, filter, folded, storage failure, speed, accessibility checks | Playwright, Desktop Chrome | most of 125 |
| End to end, mobile project | Long press with CDP touch next to swipe and scroll, auto scroll on touch, `touchCancel` | Playwright, Pixel 7, CDP `Input.dispatchTouchEvent` | part of 125 |
| Manual and exploratory | Prototype comparison at 1440 and 390 px in light and dark, Firefox spot check, Safari and iOS checklist, screen reader pass, two exploratory charters, cache upgrade rehearsal, mutation check of the version test | Playwright MCP and hand testing | 16 manual, 1 mixed |

Total 164 cases. By priority: Critical 69, High 71, Medium 24. Counts per task (id prefix): T1 12, T2 10, T3 28, T4 29, T5 21, T6 16, T7 15, T8 26, T9 7. Skills for later steps: `playwright-e2e-testing` for specs, `a11y-playwright-testing` for every `fe` task, `qa-investigation` for any unclear failure.

Techniques: equivalence partitioning (press targets, pointer types, drop target types, days), boundary value analysis (6 px, 10 px, 350 and 450 ms, 64 px zones, 44 px targets, 200 and 250 character texts, 20 groups), decision tables (R5 reasons for no drag, filter focus after a move, storage state), state transitions (idle, pressed, dragging, ended; storage ok, failing, locked), use cases (one per flow in `ux/flows.md`), error guessing (IME, second pointer, stale target group, markup in names), exploratory sessions.

Drag gestures in Playwright: mouse with `down`, stepped `move`, `up`; touch with CDP, a 450 ms hold, then stepped moves (as designed in design.md). Existing helpers: `open`, `section`, `toggle`, `stored`, `storedJson`, `passMidnight`, `touchDrag` (currently inside `app.spec.js` and `groups.spec.js`, to move to `helpers.js` in T5). New helpers `mouseDrag` (T3) and `longPressDrag` (T5) are part of the tasks, not of this plan.

## 4. Environment and test data

1. Static page served by `npm start` (python3 http.server on 4173); Playwright config has projects `desktop` (Desktop Chrome) and `mobile` (Pixel 7), both Chromium. No Firefox project exists, so the Firefox spot check uses a temporary config or a hand run.
2. Fixed clock: `TODAY` 2026-11-09, `NOW` 2026-11-09 09:00 +07:00, `AFTER_MIDNIGHT` from `helpers.js`.
3. Data sets: (a) 2 to 3 groups with a group that has no task on the day, an ungrouped task and a done task; (b) a folded section; (c) filter on one group; (d) 200 tasks in 20 groups, settled; (e) a day with no group stored; (f) hand edited stored texts (spaces around, 250 characters); (g) names and texts with markup (`<b>abc</b>`, `<i>x</i>`), a 30 character name without spaces; (h) two tasks with the same text; (i) a long day for auto scroll; (j) a stored group removed from another context.
4. Evidence per case under `qa/evidence/<TC-ID>/` at execution time.

## 5. Entry criteria

1. Requirements, UX and design approved (decisions.md, three approvals on 2026-11-10).
2. For each task, the owner reports `implemented` and all existing unit and e2e tests pass before QA starts (`npm test`, `npx playwright test`).
3. T4 onwards need `store.setGroup` (T1) and the T2 info slip merged; T5 to T8 run after the previous FE task in order.

## 6. Exit criteria

1. Every requirement R1 to R37 and NFR1 to NFR7 has at least one executed case (traceability-matrix.csv shows no gap).
2. All Critical and High cases pass; the few Medium and manual cases that cannot run (WebKit, real iPhone) are listed as residual risk with the manual check.
3. No open Critical or High bug.
4. All existing and new unit and e2e tests pass in both projects, the linter passes if present.
5. Settled 200 task speed under 100 ms in Chromium for pick up, drop, add, collapse, filter and move; Firefox spot check median under 100 ms, with the known loaded host residual already accepted in decisions.md.
6. `package.json` and every `?v=` reference read 1.3.0 and the version test passes (and fails when one reference is changed back).

## 7. Regression focus (task-groups)

| Area | Why at risk | Cases |
| --- | --- | --- |
| Edit form move (Sửa) | Live text and info slip change in T2; the five groups.spec.js assertions move; it is the WCAG 2.5.7 alternative | T2-04, T2-08, T2-10, T4-28, T8-12, T8-22 |
| Filter | Drop into a hidden group, focus rule, filter not remembered | T2-01 to T2-06, T4-15, T4-16, T8-19 |
| Collapse and remembered state | Drop opens a folded section and writes the ui key once | T4-02, T4-13, T4-14, T4-29, T8-18 |
| Swipe left on phones | Long press timer and `touchmove` listener share the row with the native swipe; swipe distance and feel must not change | T5-04, T5-16, T5-20, T8-21 |
| Page scroll on phones | Non passive `touchmove` must prevent only during a drag | T5-05, T5-07, T7-13 |
| Dialogs, delete note, storage slip | No drag behind a dialog; Escape must not leak | T3-09, T5-11, T7-08, T8-20 |
| Speed with 200 tasks | BUG-010 and BUG-014 history; Firefox slower | T8-01 to T8-05 |
| Accessibility names and Tab order | No role, tabindex or attribute change on rows | T3-15, T3-21, T8-09, T8-13 |
| Day navigation, midnight | Drag cancel hooks in `resetTransient` | T7-05, T7-06, T8-23 |
| Release and cache busting | New `drag.js` module and its imports | T9-01 to T9-07 |

## 8. Risks

| Risk | Impact | Likelihood | Mitigation |
| --- | --- | --- | --- |
| Long press timer or non passive `touchmove` interfering with the native swipe or scroll | High | Medium | Boundary cases at 350, 450 ms and 8, 12 px; swipe and scroll cases next to every drag case; existing touch tests rerun |
| A cancel path that leaves the page stuck (slip, strip, scroll lock) | High | Medium | T7 runs every interruption and then a normal drag; exploratory charters |
| Data loss or text rewrite by the drop | High | Low | `setGroup` unit cases (byte for byte text), stored string comparison on every cancel |
| Drag slows the list (rebuild per move, geometry reads) | Medium | Medium | MutationObserver case, timed pick up and drop, existing speed tests, Firefox spot check |
| Safari and iOS behaviour unknown (callout, scroll lock) | Medium | Medium | Cannot run WebKit here; manual checklist after release |
| Colour only cue or low contrast target frame | Medium | Low | Contrast script on computed colours, name on the slip |
| Stale or hidden target group (other tab, filter) | Medium | Medium | T4-18, T7-07, T7-12 |
| Tall strip with 20 groups on 360 px | Low | Medium | Accepted in decisions.md; T8-26 checks reach |
| Changed live text breaks existing assertions | Low | High | Updated in T2 per decisions.md; T2-10 runs the whole suite |

## 9. Open points found while planning (for the PM to confirm, none blocks the build)

1. `setGroup(id, groupId)` with the group the task already has: design.md does not say whether it writes. T1-11 only requires no data change and no error. Confirm if a write must or must not happen.
2. R21 covers a storage event for the groups key. A storage event for only the tasks key or only the ui key during a drag is not stated. T7-12 records the observed behaviour; confirm the intended one (the page must in any case not stay stuck).
3. R3 hand over for the touch press: a move of 8 px then holding to 400 ms still drags (the 10 px abort applies only above 10 px, measured from the start). T5-03 tests this reading; confirm.
4. Firefox is not a Playwright project. T8-05 and T8-16 need either a temporary config or a hand run; confirm that this is acceptable instead of adding a Firefox project.

## 10. Deliverables and reporting

test-plan.md, test-cases.csv, traceability-matrix.csv, test-execution-log.csv (one row per executed case), evidence per case under `qa/evidence/<TC-ID>/`, bugs under `docs/project/bugs/`, and test-summary-report.md in report mode. Progress is reported per task: planned, executed, passed, failed, blocked.

## 11. Roles and notes

QA executes and logs; QA does not fix production code. Suggested specialist: `sdlc:qa-test-generator` to turn the e2e cases of T3 to T8 into Playwright specs in `tests/e2e/drag.spec.js` (the FE owner writes the tests named in tasks.md; the generator can add the cases not named there). No API exists, so no API specialist is needed. Test code is not written in plan mode.
