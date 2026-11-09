# Test Plan: day-navigation

Branch: day-navigation. Test basis: requirements.md (R1 to R29, NFR1 to NFR6), design.md, tasks.md (T1 to T7), ux/flows.md, ux/screens/*.html, decisions.md. Format follows the ISTQB test plan template.

## 1. Objective

Show that the owner can move to the previous or next day, pick a date, return to today, and work on any day, with the day kept in the address, correct Vietnamese wording, and the midnight rules working. Also show that the four daily-task-log rules this feature changes (page load view, date given to a new task, midnight rule) still behave as the new requirements say, and that nothing else in daily-task-log has regressed.

## 2. Scope

In scope:

1. Date rules in `src/date.js` (parse, add days, day kind, date line), the `dateKey` argument of `store.add`, and the UI in `index.html` and `src/app.js`: nav row, wording per day kind, address hash and browser history, picker, working on any day, midnight handling, motion classes.
2. Regression of daily-task-log behaviour that is amended (page load view, new task date, midnight) and of the full existing unit and e2e suites.
3. Accessibility (names, focus order, live region, axe scan), target size (44 px), 360 px layout, and the 100 ms speed target.

Out of scope: carry over, moving tasks between days, month view, search, shortcuts, swipe between days, notifications (see requirements out of scope). Unchanged daily-task-log features are covered only by running the existing suite.

## 3. Test levels and approach

| Level | What | Tool | Cases |
| --- | --- | --- | --- |
| Unit | parseDateKey, addDays, dayKind, dateLine, store.add with dateKey | node:test (`tests/unit/date.test.js`, `store.test.js`) | 15 (T1, T2) |
| End to end | Navigation, wording, hash and history, picker, work on any day, midnight, usability, speed | Playwright, `tests/e2e/day-nav.spec.js` plus existing `app.spec.js` | 63 plus 4 shared with manual |
| Accessibility | axe scan, names, tab order, live region | Playwright with the a11y skill | inside the e2e count |
| Manual and exploratory | Prototype comparison at 1440 and 390 px (light and dark), native calendar look, wrong day charter, Firefox or Edge smoke | Playwright MCP and hand testing | 7 plus 4 shared |

Total 89 cases. By priority: Critical 26, High 41, Medium 21, Low 1.

Techniques: equivalence partitioning and boundary value analysis for keys, hashes and picker values (year 2000 and 2099, impossible dates, wrong formats); decision tables for day kind, date line and wording per kind and for midnight with the viewed day; state transitions for move, reset of transient state, history Back and Forward, and the midnight branches; use cases for each user story; error guessing for markup in the hash, partial year typing in the picker, DST and failed storage; checklist for Vietnamese text.

Task mapping (test-cases.csv column `tasks`): T1 date rules, T2 store argument, T3 markup, wording, load from address, T4 arrows, back to today, history, T5 picker, T6 work on any day and midnight, T7 motion, keyboard order, size and speed. Execute mode runs only the cases of the task being tested, plus the full relevant suite.

## 4. Environment and test data

1. Host: Linux, Node 18 or newer, `npm start` serves the app on port 4173, Playwright projects `desktop` (Desktop Chrome) and `mobile` (Pixel 7), locale vi-VN, timezone Asia/Ho_Chi_Minh.
2. Clock fixed at `2026-11-09T09:00+07:00` with the same approach as `app.spec.js` (Playwright clock), moved to 2026-11-10 00:00 for midnight cases.
3. Data: localStorage seeded through the same helper as `app.spec.js`. Standard set: 08/11 with 2 to 3 tasks (one set all done), 09/11 with 3 tasks (2 done), 10/11 empty or with a few tasks, 05/11 and 01/10 with tasks, and a 200 task day. One case seeds data in the exact shape saved by daily-task-log to prove no migration is needed.
4. Unit cases for DST run with `TZ=America/New_York` as well as the default zone.
5. WebKit cannot run on this host. Safari and iOS behaviour (native date input look, partial year events, hash and pushState) is not tested here. It is recorded as a residual risk in section 8 and is carried into the release note, as was decided for daily-task-log.

## 5. Entry criteria

1. Design approved, test cases reviewed.
2. For execute mode: the owning task reported `implemented`, `npm test` green before the QA run, dependencies of the task done (T3 needs T1, T4 needs T3, T5 needs T4, T6 needs T2 and T4, T7 needs T5 and T6).
3. The prototypes in `ux/screens/` are available for visual comparison.

## 6. Exit criteria

1. Every requirement R1 to R29 and NFR1 to NFR6 has at least one executed case (see traceability-matrix.csv).
2. All Critical and High cases passed.
3. No open Critical or High bugs; Medium and Low bugs documented with a decision.
4. Full unit and e2e suites green on desktop and mobile; linter clean.
5. Accessibility scan has no serious or critical violation on the day screens.
6. Evidence saved for every executed case.

Suspension: stop executing a task when its page does not load or the whole suite is broken by an environment fault.

## 7. Regression focus (amended daily-task-log rules)

| Old rule | New behaviour | Cases |
| --- | --- | --- |
| Page load shows only today (old R1 to R3) | Page shows the day in the hash, today when missing or invalid | T3-01, T3-02, T3-07, T3-08, T3-14 |
| New task takes today's date (old R6, R24) | Takes the viewed day, `createdAt` is real time | T2-01 to T2-03, T6-01, T6-02 |
| Midnight switches to the new day (old R25) | Follows only when the viewed day was the old today, otherwise recompute wording | T6-12 to T6-18 |

The existing midnight tests, the names test (one list updated), the keyboard test and the 200 task performance test must pass unchanged apart from that list. Cases T3-14 and T6-17 run them as a named regression step.

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Picker reset race: `go(null)` sets the picker back to the viewed day, while the design says not to reset while the field has focus (partial years in Chromium) | Medium | High (cannot type a date) | T5-07 types digit by digit; report as a bug if typing jumps |
| Hash and history: cleaning a hash with replaceState, double handling of popstate and hashchange, extra history entries | Medium | High | T3-07, T3-08, T4-06, T4-13, T5-05 count `history.length` |
| Midnight branches (viewed day vs old today), wording not recomputed | Medium | High (task added to the wrong day) | T6-12 to T6-16 |
| Wrong day mistakes by the owner (R29) | Low | High | T3-10, T3-11, T7-10 exploratory |
| DST or month and year end errors in date math | Low | High | T1-05, T1-06, T1-09 |
| Hash used as markup (XSS) | Low | High | T1-03, T3-07, T3-09 |
| Safari and WebKit untested | Medium | Medium | Not runnable here; manual check by the owner on a real device, listed in the release note |
| Transient state leaks across a move (open edit, delete note, swipe, error) | Medium | Medium | T4-09 to T4-12 |
| Native picker differs per browser (NFR4) | Medium | Low | T5-09 and T7-11 manual |

## 9. Deliverables and reporting

test-plan.md, test-cases.csv, traceability-matrix.csv, test-execution-log.csv (one row per executed case), evidence per case under `qa/evidence/<TC-ID>/`, bugs under `docs/project/bugs/`, and test-summary-report.md in report mode. Progress is reported per task: planned, executed, passed, failed, blocked, and open bugs by severity.

## 10. Roles and notes

QA executes and logs; QA does not fix production code. Suggested specialists: `sdlc:qa-test-generator` can turn the e2e cases of T3 to T7 into Playwright specs. No API exists, so no API specialist is needed. Test code is not written in plan mode.
