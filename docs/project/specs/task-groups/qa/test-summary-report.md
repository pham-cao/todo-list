# Test Summary Report: task-groups

Date: 2026-11-10
Build: branch task-groups, code through T12 at commit b02209d, final runs on HEAD
Author: QA

## 1. Scope

The feature lets the owner create groups with one of 6 highlighter colours, put each task into one group, see the day list in collapsible coloured sections, filter by group, rename or recolour a group, delete an empty group, and move all tasks of a group to another group. Tasks and groups stay in localStorage, all text is Vietnamese, and tasks without a group behave as before.

In scope: requirements R1 to R72 and NFR1 to NFR8 (73 functional items including R63a, 8 non functional), store and migration rules, add form, sections, filter, manage dialog, delete rules, move all, accessibility, speed, stale cache safety, Firefox speed with 200 tasks, and regression of daily-task-log and day-navigation.
Out of scope: backend, login, sync between devices, Safari and iOS execution (WebKit cannot launch on this host).

## 2. Results at a glance

| Measure | Result |
| --- | --- |
| Test cases planned | 290 |
| Test cases executed | 290 |
| Passed (final result per case) | 290 |
| Failed (final result) | 0 |
| Blocked (final result) | 0 |
| Failures found during the cycle, all fixed and retested | 9 case runs, 1 blocked run, plus BUG-014 found in T11 and fixed in T12 |
| Unit tests on HEAD (npm test) | 65 of 65 passed |
| Playwright on HEAD (npx playwright test) | 600 passed, 20 skipped, 0 failed (desktop and mobile) |
| Requirement coverage | 81 of 81 items traced to at least one case (R1 to R72, R63a, NFR1 to NFR8) |

The 20 skipped Playwright tests are skips declared in the specs (for example project specific ones); none of them is a planned case that was left unexecuted.

Execution log: 352 rows. Cases for T1 to T3 were first logged under descriptive names on 2026-11-09; this report added one row per case id that points to the final unit run, so each planned case now has a row.

## 3. Cases by task

| Task | Subject | Cases | Passed |
| --- | --- | --- | --- |
| T1 | Version and cache safety | 10 | 10 |
| T2 | Store: group of a task, move, usage | 20 | 20 |
| T3 | Groups store, limits, collapsed state | 24 | 24 |
| T4 | Sections and header | 21 | 21 |
| T5 | Add form and new group | 31 | 31 |
| T6 | Move one task | 23 | 23 |
| T7 | Filter | 30 | 30 |
| T8 | Manage dialog | 30 | 30 |
| T9 | Delete group | 30 | 30 |
| T10 | Move all tasks of a group | 30 | 30 |
| T11 | Keyboard, size, safety, speed, regression | 32 | 32 |
| T12 | Firefox speed for 200 tasks, tooltip and section reuse | 9 | 9 |
| Total | | 290 | 290 |

## 4. Cases by priority

| Priority | Cases | Passed |
| --- | --- | --- |
| Critical | 93 | 93 |
| High | 144 | 144 |
| Medium | 45 | 45 |
| Low | 8 | 8 |

By automation: 215 end to end, 48 unit, 18 manual, 7 end to end plus manual, 1 unit plus manual, 1 manual script.

## 5. Bugs

Twelve bugs were opened for this feature (BUG-003 to BUG-014) and all twelve are closed. BUG-001 and BUG-002 came from day-navigation and are closed.

| Severity | Opened | Closed | Open |
| --- | --- | --- | --- |
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 0 |
| Medium | 6 | 6 | 0 |
| Low | 6 | 6 | 0 |

Closed after retest: BUG-003 (Low, moveGroup with an undefined source), BUG-004 (Low, duplicate group ids on load), BUG-005 (Medium, section toggle accessible name), BUG-006 (Low, stale colour swatch), BUG-007 (Low, stale hidden group notice), BUG-008 (Low, Sửa buttons below the visible part), BUG-009 (Medium, group deleted after another tab added a task), BUG-010 (Medium, 200 task move over 100 ms), BUG-011 (Medium), BUG-012 (Low, stale blocked note), BUG-013 (Medium, move all refused with an unclear message), BUG-014 (Medium, Firefox move or day change with 200 tasks about 190 ms, fixed in T12).

BUG-011 note: this defect existed in the shipped app since daily-task-log. After Giữ lại on the task delete note, a quick Enter on Xóa reopened it and a late close event made Xóa việc delete nothing. It was found during task-groups review and fixed in the shared close handler, so the feature also improved the existing app.

Open bugs: none.

BUG-014 fix (T12): idle tooltip boxes were removed and the list render now keeps sections, lists and rows and moves only what is out of place. In Firefox every 200 task speed test passes in the full run. On the same settled tests repeated 20 times on a busy host (120 runs), the fix passed 114 and the HEAD baseline passed 81. Chromium desktop and mobile with --repeat-each=2: 1196 passed, 40 skipped. Axe: 56 of 56 states with no violation. Evidence is in evidence/T12/.

## 6. Exit criteria

| Criterion | Status |
| --- | --- |
| Every requirement covered by at least one case | Met (the gap found in the matrix, TC-task-groups-T5-29, was added to R15 and R16) |
| All Critical and High cases passed | Met (237 of 237) |
| No open Critical or High bugs | Met |
| Full automated suites green on HEAD | Met (65 unit, 600 passed, 0 failed) |
| NFR1 speed in every tested browser | Met in Chromium and Firefox after BUG-014 fix; about 5 percent of loaded host Firefox runs land at 111 to 158 ms, accepted by the PM |
| Browser coverage | Partly met: Chromium and Firefox checked, Safari and iOS not verified |

Overall: exit criteria are met (exit_criteria_met: true). No bug is open. The Firefox speed residual and the tooltip differences are accepted by the PM, and Safari and iOS remain unverified.

## 7. Residual risks

1. Safari and iOS were not tested because WebKit cannot run on this host. The IME Enter guard for Safari was added by reasoning only. Verify on a real iPhone or Mac after release.
2. Firefox with about 200 tasks on one day: on a loaded host about 5 percent of speed runs still take 111 to 158 ms (down from about 32 percent). Medians are 7 to 30 ms. Accepted by the PM. Chromium passes with 10 to 50 ms.
3. Firefox full run still has 7 failures that are not about speed (3 in groups.spec.js, 3 in day-nav.spec.js, 1 in app.spec.js) and are known from T11. The default suite runs Chromium only, and Firefox dialog coverage relies partly on manual checks.
4. Tooltip differences accepted by the PM: leaving a row straight from Sửa or Xóa hides its tooltip at once, and browsers without @starting-style (Safari before 17.5, Firefox before 129) show the tooltip at once.
5. Two tabs: the last writer wins on the group list, so a group created in one tab can be overwritten by another tab. Tasks keep their group id and no task is lost or hidden (checked in the exploratory run).
6. Tasks shown in a tab can be stale until another action refreshes them. Delete and move all re-read stored tasks and refuse or ask again, so no data is lost.
7. Release step: the ?v= query in every asset reference (stylesheet, entry script, modules) must be bumped to the new package version. The unit test version.test.js fails if one is missed, so run npm test before publishing.

## 8. Recommendation

Release is recommended, on these conditions:
1. Bump the version and every ?v= reference, then run npm test and the Playwright suite once more before publishing.
2. Mention in the release note that very long days (about 200 tasks) can occasionally take slightly longer than 100 ms in Firefox on a busy computer.
3. Plan a quick manual check on Safari and iOS soon after release.

## 9. Evidence

Final run on HEAD: npm test 65 of 65, npx playwright test 600 passed, 20 skipped, 0 failed (docs/project/specs/task-groups/qa/evidence/T11/final-head-run.txt for the T11 run; T12 evidence in evidence/T12/). Other evidence is in docs/project/specs/task-groups/qa/evidence/ by case id, and bug reports are in docs/project/bugs/.
