# Test Plan: task-groups

Branch: task-groups. Test basis: requirements.md (R1 to R72, NFR1 to NFR8), design.md, tasks.md (T1 to T11), ux/flows.md, ux/screens/*.html (20 screens, torn paper label style), decisions.md (latest decisions apply). Format follows the ISTQB test plan template.

## 1. Objective

Show that the owner can create groups (also on the fly while adding a task), colour them, put each task in one group, see a day in coloured sections, collapse sections, filter by group, manage groups in the "Nhóm việc" dialog, and delete a group only when it is empty, with all text in Vietnamese. Also show that nothing is lost or changed for data saved before this feature, that day navigation, midnight, storage failure and speed still behave as before, and that the new cache busting rule works so a release never mixes old and new files.

## 2. Scope

In scope:

1. `src/store.js` (`groupId` on tasks, `groupUsage`, `moveGroup`, `validateText` with a limit), `src/groups.js` (names, colours, limit, load rules, collapsed state), `src/manage.js` and the UI in `index.html` and `src/app.js`: sections, collapse, add form group choice and new group line, edit move, filter, manage dialog, delete and blocked delete, show tasks, move all.
2. Data migration and backward compatibility: tasks saved before the feature (no `groupId`), unknown `groupId`, corrupt groups and UI values, an older app copy reading new data.
3. Cache busting (NFR5): `?v=1.2.0` on the stylesheet, the entry script and every module import, with `tests/unit/version.test.js`.
4. Regression of daily-task-log and day-navigation behaviour (plain day looks as before, day navigation, midnight, storage failure, 200 tasks speed) by running the existing unit and e2e suites plus extra runs with groups present.
5. Accessibility (names, roles, focus order, live regions, axe), target size 44 px, 360 px layout, light and dark contrast, reduced motion, the 100 ms speed target, security (text only rendering, no network).

Out of scope: items listed in requirements "Out of scope" (full colour picker, collapse all, remembered filter, search, drag and drop, backup of groups, undo). The later `backup-export-import` feature is only noted.

## 3. Test levels and approach

| Level | What | Tool | Cases |
| --- | --- | --- | --- |
| Unit | version test, store (`groupId`, `groupUsage`, `moveGroup`, all or nothing write), groups module (names, colours, limit, load and corrupt rules, collapsed state) | node:test (`tests/unit/version.test.js`, `store.test.js`, `groups.test.js`) | 49 (T1 to T3) |
| End to end | Sections, collapse, add form, edit move, filter, dialog, delete, move all, compatibility, storage failure, size, motion, speed, security, regression | Playwright, new `tests/e2e/groups.spec.js` plus the existing specs, projects `desktop` and `mobile` | 173 |
| Accessibility | axe scan, names, tab order, live regions | Playwright with the a11y skill | inside the e2e count |
| Manual and exploratory | Prototype comparison (1440 and 390 px, light and dark), cache busting by hand, release step rehearsal, older app copy, Firefox or Edge smoke, exploratory charter for multi tab and rapid actions | Playwright MCP and hand testing | 14 manual and 5 mixed |

Total 241 cases. By priority: Critical 90, High 117, Medium 30, Low 4. Counts per task (test-cases.csv ID prefix): T1 10, T2 20, T3 24, T4 21, T5 26, T6 18, T7 22, T8 23, T9 20, T10 25, T11 32.

Techniques: equivalence partitioning and boundary value analysis for group names (0, 1, 29, 30, 31 code points, NFD input), the 20 group limit, colour wrap at 7, width 380 and 381 px, and 44 px targets; decision tables for the delete outcome, the day chosen by "Xem các việc này", the filter empty texts and the add choice following the filter; state transitions for collapse, filter across days, the add choice, row edit and the move card (success and failure); use cases for each user story; error guessing for markup in names, stale ids, double Enter, two tabs, failing `setItem`, corrupt values and an older app copy; checklist for Vietnamese text (exact strings) and for control sizes.

Task mapping (test-cases.csv columns `tasks` and ID prefix): T1 cache busting, T2 store, T3 groups module, T4 sections and collapse, T5 add form and new group, T6 edit move, T7 group bar and filter, T8 manage dialog, T9 delete, blocked delete and show tasks, T10 move all, T11 keyboard, size, safety, speed, compatibility and regression. A case whose steps need a later task also lists it after the primary task (for example the filter rename case lists T8 and T9) and is executed when those are done. Each case marks its level in `automated`: `unit`, `e2e`, `manual`, or a mix such as `e2e + manual`. Execute mode runs only the cases of the task being tested plus the full relevant suite. The 20 prototype screens map to the cases of the task that lists them in tasks.md (the "Matches the approved prototype" manual cases).

## 4. Environment and test data

1. Host: Linux, Node 18 or newer, `npm start` serves the app on port 4173, Playwright projects `desktop` (Desktop Chrome) and `mobile` (Pixel 7), locale vi-VN, timezone Asia/Ho_Chi_Minh.
2. Clock fixed at `2026-11-09T09:00+07:00` as in `tests/e2e/helpers.js` (`open`, `task`, `NOW`, `passMidnight`). The helper must also seed `daily-todo:groups:v1` and `daily-todo:ui:v1` in the same init script (T4 task). Existing helper locators `.task-list > .task` keep working.
3. Data sets: (a) legacy: tasks in the exact daily-task-log shape over 5 days, no groups key and no UI key; (b) grouped: groups Công ty (yellow), Nhà (pink), Học tiếng Nhật (green) with tasks on 08/11, 09/11, 10/11 and past and future days, done and not done; (c) 20 groups with 30 character names; (d) 200 tasks on one day in 20 groups, and 200 tasks of one group over 60 days; (e) hostile values: names `<b>abc</b>` and an `<img onerror>` string, ids with quotes, colour `"red; x"`, corrupt JSON in groups and UI keys, a task with an unknown `groupId`.
4. Failure injection: stubbing `Storage.prototype.setItem` to throw for the tasks key only, for the groups key only, and `getItem` throwing; a counting wrapper for write counts.
5. Cache busting by hand: build the 1.1.0 tree from `main`, serve, load, then serve the 1.2.0 tree on the same URL and reload normally, watching the network panel.
6. Older app check: serve `main` against localStorage that already holds `groupId` values.
7. WebKit cannot run on this host. Safari and iOS behaviour (native select look, `<dialog>`, date input, swipe feel) is not tested here. It is recorded as a residual risk in section 8 and carried into the release note, as decided for the earlier features.

## 5. Entry criteria

1. Design approved (done, decisions.md), test cases reviewed.
2. For execute mode: the owning task reported `implemented`, `npm test` green before the QA run, and the dependencies of the task done: T1 and T2 can start at once, T3 needs T2, T4 needs T1 and T3, then T5, T6, T7, T8, T9, T10 one after another, T11 needs T1 and T10.
3. The prototypes in `ux/screens/` and the final "Task groups" block of `design-system.css` are available for visual comparison.

## 6. Exit criteria

1. Every requirement R1 to R72 and NFR1 to NFR8 has at least one executed case (see traceability-matrix.csv).
2. All Critical and High cases passed.
3. No open Critical or High bugs; Medium and Low bugs documented with a decision.
4. Full unit and e2e suites green on desktop and mobile; linter clean; the existing tests pass unchanged apart from the Tab count and names list changes named in tasks.md.
5. The cache busting check passes both as the unit test and as the manual stale cache run.
6. Data saved before the feature loads with every task present and ungrouped and the stored tasks string unchanged.
7. Accessibility scan has no serious or critical violation on every new screen and state, light and dark.
8. Evidence saved for every executed case.

Suspension: stop executing a task when its page does not load or the whole suite is broken by an environment fault.

## 7. Regression focus

| Existing behaviour | What could break | Cases |
| --- | --- | --- |
| Tasks without a group load and look as before, no rewrite (daily-task-log, day-navigation) | Loading adds `groupId` or rewrites the string; plain list gets headers | T2-02, T2-06, T2-20, T4-03, T4-04, T11-07, T11-08, T11-28 |
| Day navigation (previous, next, picker, hash, Back and Forward, Về hôm nay) | Filter or collapsed state leaks or resets wrongly; history entries doubled by "Xem các việc này" | T7-09, T9-08 to T9-12, T11-24 |
| Midnight rule | Dialog open or filter on at midnight; edit not dropped | T11-25 |
| Storage failure (blocked, quota, failed first read) | New groups and UI keys overwrite data after a failed read; move all half applied | T3-17, T3-18, T10-13 to T10-17, T11-11, T11-12, T11-17, T11-26 |
| 200 tasks speed under 100 ms | Sections and row reuse slower | T4-21, T11-16, T11-27 |
| Existing keyboard, names and Tab count tests | Wrong Tab counts after new controls | T5-26, T7-21 |
| Cache safety | A release mixes cached old css with new markup | T1-01 to T1-09, T11-31 |

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Data loss or hiding of tasks by a group action, especially move all and delete | Medium | Critical | T2-09 to T2-12, T9-06, T9-07, T10-13 to T10-15, T10-21 |
| Move all not all or nothing (more than one write, partial memory change) | Medium | Critical | T2-10, T2-12, T10-13 to T10-15 |
| Old data rewritten or a task with an unknown group dropped | Low | Critical | T2-06, T4-04, T11-07 |
| Version query missing on one import so a module loads twice or from cache | Medium | High | T1-03, T1-04, T1-06, T1-08 |
| Group names or stored values used as markup or inside selectors | Low | High | T3-15, T3-16, T4-13, T11-13, T11-15 |
| Focus and live region mistakes after moves (keyboard and screen reader users) | Medium | Medium | T6-04, T6-14, T7-17, T9-02 |
| Filter and add choice state leaks (adding to a hidden group, stale choice) | Medium | Medium | T5-15, T7-12, T7-13, T10-12 |
| Narrow phone layout (360 px, icon only "Quản lý nhóm" below 381 px, truncation) | Medium | Medium | T7-19, T11-03 |
| Contrast of six colours in light and dark, torn label style | Medium | Medium | T11-05, T11-06, T11-23 |
| Two tabs overwrite each other's groups (last writer wins) | Low | Medium | T11-30 exploratory; recorded as residual risk |
| Safari and WebKit untested (native select, dialog, swipe) | Medium | Medium | Not runnable here; owner checks on a real device; listed in the release note |

## 9. Open points found while planning (for the PM to confirm, none blocks the build)

1. R47 notice wording when the added task is ungrouped but the filter hides it: the text table only has `{name}`. T7-13 expects the name "Chưa phân nhóm"; confirm.
2. `moveGroup(from, to)` with the same id or an unknown id has no stated result (T2-19). The expectation is no data change; confirm.
3. R3 says names are kept as typed, so the stored name is not NFC normalised (only the length and duplicate checks are). T3-04 tests this; confirm this is intended.

## 10. Deliverables and reporting

test-plan.md, test-cases.csv, traceability-matrix.csv, test-execution-log.csv (one row per executed case), evidence per case under `qa/evidence/<TC-ID>/`, bugs under `docs/project/bugs/`, and test-summary-report.md in report mode. Progress is reported per task: planned, executed, passed, failed, blocked, and open bugs by severity.

## 11. Roles and notes

QA executes and logs; QA does not fix production code. Suggested specialists: `sdlc:qa-test-generator` to turn the e2e cases of T4 to T11 into Playwright specs in `tests/e2e/groups.spec.js`. No API exists, so no API specialist is needed. Test code is not written in plan mode.
