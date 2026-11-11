# Test Summary Report: drag-drop

Date: 2026-11-11
Build: branch drag-drop, version 1.3.0, commit 5ebf8ce (T1 to T9 committed), final runs on HEAD
Author: QA

## 1. Scope

The feature lets the owner pick up a task with a mouse, a pen or a finger and drop it into another group. A drop strip lists the groups during a drag, the page scrolls by itself near its top and bottom edges, a long press on a phone lifts a task without breaking the swipe left gesture, and every interrupted drag ends with no change at all. The move is also possible without dragging (the edit form and the Nhóm button). Tasks and groups stay in localStorage, no new key or network call is added, and all text is Vietnamese.

In scope: requirements R1 to R37, NFR1 to NFR7, the info slip for a move into a group hidden by the filter, the drop strip and its targets, auto scroll, touch hold and swipe, interruptions (Escape, blur, hidden tab, resize, other tab, day change, dialogs), speed with 200 tasks, accessibility, visual comparison with the approved prototype at 1440 px and 390 px, the version bump to 1.3.0 with cache safety, and regression of task-groups, daily-task-log and day-navigation.
Out of scope: backend, login, sync between devices. Safari, iOS and a real Android device could not be run on this host and stay as manual checks (section 9).

## 2. Results at a glance

| Measure | Result |
| --- | --- |
| Test cases planned | 172 |
| Test cases executed | 170 |
| Passed (final result per case) | 170 |
| Failed (final result) | 0 |
| Blocked (final result) | 2 (TC-drag-drop-T5-18 real iPhone and Safari, TC-drag-drop-T5-19 real Android; no device on this host) |
| Failures found during the cycle, all fixed and retested | 11 case runs, which led to BUG-015 to BUG-024 (BUG-022 closed as designed) |
| Unit tests on HEAD (npm test) | 78 of 78 passed |
| Playwright on HEAD (npx playwright test --workers=2) | 703 passed, 105 skipped, 0 failed (desktop and mobile) |
| Requirement coverage | 51 of 51 traced items have at least one case (R1 to R37, NFR1 to NFR7, 6 regression items) |

The 105 skipped Playwright tests are skips declared in the specs (tests that apply to one project only). None of them is a planned case left unexecuted.

The default worker count is killed by the host for lack of memory, so both final runs used --workers=2 as agreed.

Execution log: 247 rows. Besides one row per planned case, it holds the exploratory probes and regression runs of each task. This report added rows for TC-drag-drop-T1-09 to T1-12 (covered by the unit tests in the final npm test run), TC-drag-drop-T9-01 to T9-07, a final row for TC-drag-drop-T7-14 (its retest had been logged under a descriptive name), the BUG-024 retest and the two release regression runs.

## 3. Cases by task

| Task | Subject | Cases | Passed | Blocked |
| --- | --- | --- | --- | --- |
| T1 | Store change that only moves a task to another group | 12 | 12 | 0 |
| T2 | Info slip for a move into a group the filter hides | 14 | 14 | 0 |
| T3 | Mouse pick up, slip, strip and cancel | 32 | 32 | 0 |
| T4 | Drop targets and the drop | 29 | 29 | 0 |
| T5 | Long press on phones next to the swipe | 21 | 19 | 2 |
| T6 | Auto scroll on long lists | 16 | 16 | 0 |
| T7 | Interruptions never leave the page stuck | 15 | 15 | 0 |
| T8 | Speed, accessibility and regression checks | 26 | 26 | 0 |
| T9 | Release version 1.3.0 | 7 | 7 | 0 |
| Total | | 172 | 170 | 2 |

No case has a failed final result.

## 4. Cases by priority

| Priority | Cases | Passed | Blocked |
| --- | --- | --- | --- |
| Critical | 69 | 69 | 0 |
| High | 75 | 74 | 1 (T5-18, real iPhone and Safari) |
| Medium | 28 | 27 | 1 (T5-19, real Android) |

By automation: 133 end to end, 22 unit, 16 manual, 1 mixed.

## 5. Requirement coverage

Source: traceability-matrix.csv, 51 rows. Every row lists at least one test case, so there is no coverage gap.

| Group | Items | Covered | Notes |
| --- | --- | --- | --- |
| R1 to R37 (functional) | 37 | 37 | All cases passed |
| NFR1 Performance | 1 | 1 | Passed in Chromium and Firefox, see section 8 |
| NFR2 Input support (mouse, pen, touch) | 1 | 1 | Passed (touch through CDP, pen synthetic) |
| NFR3 Security, no new key, CSP unchanged | 1 | 1 | Passed, including the 1.3.0 version checks (T9) |
| NFR4 Reliability, the page is never stuck | 1 | 1 | Passed; BUG-021 found and fixed |
| NFR5 Accessibility | 1 | 1 | Passed; screen reader half still manual |
| NFR6 Compatibility | 1 | 1 | Partly: Chromium and Firefox done, Safari, iOS and real Android open (T5-18, T5-19) |
| NFR7 Language | 1 | 1 | Passed |
| Regression (collapse, dialogs, edit move, filter, speed, swipe, version) | 6 | 6 | All passed |

Requirements with a bug found during testing: R9 (BUG-018), R15 (BUG-015), R18 (BUG-023), R21 and R22 (BUG-022, BUG-017, BUG-018), R27 (BUG-016), R31 (BUG-019, BUG-020), NFR4 (BUG-021), NFR6 (BUG-024). All are closed.

## 6. Bugs

Ten bugs were opened for this feature (BUG-015 to BUG-024) and all ten are closed. BUG-001 to BUG-014 belong to earlier features and are closed.

| Severity | Opened | Closed | Open |
| --- | --- | --- | --- |
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 0 |
| Medium | 4 | 4 | 0 |
| Low | 6 | 6 | 0 |

| Bug | Severity | Found in | Subject | Status |
| --- | --- | --- | --- | --- |
| BUG-015 | Medium | T2 | Info slip ran off a 360 px screen with 200 characters and no space | Closed, verified (CSS wrap rule) |
| BUG-016 | Medium | T3 | Lifted slip drifted from the pointer and stuck out past the right edge | Closed, verified |
| BUG-017 | Low | T4 | Firefox only: a T3 test released the pointer above the screen (test only) | Closed, verified |
| BUG-018 | Medium | T5 | Long press under the strip lifted without moving silently moved the task | Closed, verified (lift in place is a cancel) |
| BUG-019 | Medium | T6 | T4 target test intermittently failed once auto scroll existed (test only) | Closed, verified (repeat 5) |
| BUG-020 | Low | T6 | Pointer over the strip scrolled the page up on short screens with 20 groups | Closed, verified at 360x640, 320x568, 360x440 |
| BUG-021 | Low | T7 | Keyboard add into a group with a section did not end a running mouse drag | Closed, verified |
| BUG-022 | Low | T7 | Cancel after another tab renamed or deleted the group names the current group | Closed as designed (PM decision, Won't fix) |
| BUG-023 | Low | T7 | Escape during the 400 ms touch hold did not cancel the press | Closed, verified |
| BUG-024 | Low | T8 | Two auto scroll tests compared scrollY to a whole number and failed in Firefox (1363.8 against 1364); test only | Closed, verified in this report |

BUG-024 retest (2026-11-11, build 1.3.0): the fix in tests/e2e/drag.spec.js (lines 673 and 678) compares scrollY with a tolerance under 1 px. Both T6 tests pass on Chromium (all 5 auto scroll tests pass) and in Firefox with docs/project/specs/drag-drop/qa/evidence/T8/ff8.config.mjs (2 of 2). Evidence is in evidence/TC-drag-drop-BUG-024-retest/. The bug is Verified and Closed in BUG-024.md and bug-log.csv.

BUG-022 note: R22 announces the group the task is in now, so after a rename or delete in another tab the new name or Chưa phân nhóm is the correct text. The PM closed it as designed, and TC-drag-drop-T7-07 and the exploratory oracle were updated.

Product defects were found in T2, T3, T5, T6 and T7 and no Critical or High defect was found at any point. BUG-017, BUG-019 and BUG-024 were defects in test code only.

Open bugs: none.

## 7. Accessibility (axe)

Axe runs on Chromium only (decisions.md, drag-drop T8: headless Firefox crashes now and then with axe, but not without it).

| Run | Scans | Violations |
| --- | --- | --- |
| Own run over the drag states: resting, lifted, hover section, hover strip, auto scroll, cancelled, dropped, strip drop, folded, filtered, info slip, phone hold, phone drag, at 1440 px and 390 px, light and dark | 52 | 0 |
| Own run over day view, info slip, yesterday, manage dialog and delete note | 20 | 0 |
| Axe tests in drag.spec.js (6 states at 1440 px and 390 px, light and dark) | 4 tests | 0, all pass in the final full run |

The T3 finding (scrollable region focusable on the placeholder row at 390 px) was fixed in T8 and Tab no longer lands inside the placeholder at 1440 px or 390 px. Other accessibility checks passed: every strip target is at least 44 by 44 px and fully inside the screen at 1440, 390 and 360 px (and with 20 groups at 360 px), frame contrast is at least 3 to 1 (light: section 10.7 outside and 9.5 inside, strip 11.1 and 9.8; dark: 8.5 and 7.0, 7.8 and 6.4), reduced motion removes the tilt and the lift animations and keeps the outline and fill, the strip is a labelled group Thả vào nhóm with no tab stop, and the live region texts are correct with straight quotes. A move by keyboard through Sửa and Nhóm works and announces the result.

The screen reader half of the keyboard check (listening with NVDA, VoiceOver or TalkBack) was not run; only the live region text was checked. It is listed in section 9.

## 8. Speed

NFR1: 200 tasks on the viewed day and 20 groups, pick up and drop each under 100 ms, no list rebuild while following the pointer.

| Browser | Pick up | Drop | Notes |
| --- | --- | --- | --- |
| Chromium (T8, 3 runs) | 10 to 15 ms | 13 to 19 ms | Add, collapse, filter, move, tick and day change speed tests: 11 of 11 pass, 3 repeats |
| Firefox (T8, scratch config) | 21 to 30 ms | 26 to 56 ms | Settled add, move, filter and collapse tests with 200 tasks pass 3 of 3 runs |

Following the pointer adds or removes no row (a MutationObserver on the day list saw 0 child changes while 8 sections passed under the pointer). The per frame dialog query costs about 37 microseconds at 200 tasks, so no cache was added. In the final full run on 1.3.0 every speed test passed in Chromium desktop and mobile.

## 9. Firefox notes

1. The e2e suite runs on Chromium only, and no Firefox project is in playwright.config.js. Firefox is checked with a temporary config (evidence/T8/ff8.config.mjs). That config has no web server, so a server on port 4173 must be running (npm start).
2. T8 Firefox spot check: 54 of 56 drag.spec tests passed; the 2 failures were the BUG-024 assertions, now fixed. After the fix both T6 tests pass in Firefox.
3. The axe tests crash headless Firefox now and then, which is a known item in decisions.md. They are not part of any Firefox claim.
4. Firefox only, load dependent failures accepted in decisions.md (drag-drop T8): the BUG-020 short screen strip test and the 3 section count in the NFR1 drag test. During this retest the BUG-020 short screen test (drag.spec.js line 736) failed in 3 of 4 Firefox runs because the strip did not appear before the 30 s test timeout, and it passes on Chromium. The product behaviour for BUG-020 was verified in T6 on Chromium and Pixel 7. Output is in evidence/TC-drag-drop-BUG-024-retest/firefox-all-5-auto-scroll.txt.
5. Firefox with about 200 tasks: a move can take slightly over 100 ms on a busy computer (the known task-groups residual, 104 to 122 ms in T8). It is accepted and goes into the release note.
6. Firefox before 129 and Safari before 17.5 show the tooltip at once (accepted in task-groups).

## 10. Manual checks still open

These cannot be run on this host and need a person with the device. The release note carries the steps (decisions.md, drag-drop T8).

| Check | Case | What to verify |
| --- | --- | --- |
| Real iPhone and Safari | TC-drag-drop-T5-18 (High) | A long press shows no callout or text selection menu and lifts the task after about 0.4 s; the page does not scroll under the finger during a drag and scrolls normally after the drop or a cancel; a fast swipe left still opens Sửa and Xóa. |
| Real Android Chrome | TC-drag-drop-T5-19 (Medium) | Long press, swipe, scroll and drag behave as in the CDP touch tests |
| Screen reader | TC-drag-drop-T8-12 (screen reader half) | The live region reads the move and cancel messages and the strip group is announced during a drag |
| 20 minute mixed session | TC-drag-drop-T8-25 (manual half) | A scripted mixed run passed (12 desktop drags, 8 phone drags, filter, collapse, 200 tasks in 20 groups, 0 leftovers, 0 console messages); the 20 minute hand session was not run |

## 11. Known risks accepted in decisions.md

1. BUG-022: after another tab renames or deletes the group, the cancel message names the group the task is in now. Accepted as designed.
2. Firefox only, load dependent test failures (BUG-020 short screen test, 3 section count in the NFR1 drag test), and Firefox 200 task moves at 104 to 122 ms. Accepted; the suite officially runs on Chromium.
3. Tooltip differences from task-groups: leaving a row straight from Sửa or Xóa hides its tooltip at once, and older Safari and Firefox show it at once.
4. The slip never covers the strip, and a row picked up where the strip appears jumps above it. The target name sticker hangs about 16 px over the strip's top edge. Accepted after the visual check matched the prototype.
5. A resize during a drag re-measures the bounds and does not cancel. Auto scroll stays on under reduced motion, because R30 covers only the tilt and the lift animations.
6. A dialog that opens under a still finger ends the drag on the next move or release. A dialog cannot open from a touch while a finger holds a drag.
7. The bottom scroll zone includes its first pixel (speed 1 at 64 px above the strip), read as "about 64 px" in R31.
8. Axe runs on Chromium only. WebKit cannot launch on this host, so Safari and iOS are unverified by QA.
9. Two tabs: a storage event for the tasks, groups or ui key during a drag cancels the drag. The last writer wins on the group list, as in task-groups.

## 12. Exit criteria

| Criterion | Status |
| --- | --- |
| Every requirement covered by at least one case | Met (51 of 51 traced items) |
| All Critical and High cases passed | Met with one exception: 143 of 144 passed; the High case TC-drag-drop-T5-18 (real iPhone and Safari) cannot run on this host and stays a manual release check agreed with the PM (decisions.md, drag-drop T8) |
| No open Critical or High bugs | Met (no Critical or High bug was ever opened; 0 open bugs) |
| Full automated suites green on HEAD | Met (npm test 78 of 78; Playwright 703 passed, 105 skipped, 0 failed) |
| Version and cache safety for 1.3.0 | Met (T9: version test, every import and asset ?v=1.3.0, no 1.2.0 left, a mutation test fails as expected, an upgrade from 1.2.0 loads only 1.3.0 files and keeps stored data) |
| NFR1 speed | Met in Chromium and Firefox; the Firefox residual on a busy host is accepted |
| Accessibility (axe) | Met (0 violations in 72 scans); screen reader check open |
| Browser coverage | Partly met: Chromium and Firefox checked; Safari, iOS and real Android are manual checks |

Overall: exit criteria are met (exit_criteria_met: true), on the condition that the open manual checks in section 10 are carried in the release note and done on a real iPhone and a real Android phone soon after release.

## 13. Residual risks

1. Safari and iOS behaviour (long press callout, scroll lock during a drag, swipe) is verified only through Chromium touch emulation. This is the largest remaining risk.
2. The screen reader experience and the 20 minute real session have not been done by a person.
3. Firefox runs of two timing sensitive tests are unreliable on a loaded host, so adding a Firefox project to the default config would show red runs that are not product defects.
4. Firefox with 200 tasks can take slightly over 100 ms for a move on a busy computer.

## 14. Recommendation

Release 1.3.0 is recommended, on these conditions:
1. Put the Safari and iOS check steps and the Firefox 200 task note in the release note and the pull request text.
2. Run the Safari, iOS and Android checks on real devices soon after release.
3. Keep the Firefox failures of the BUG-020 short screen test and the 3 section count in mind before any Firefox project is added to the suite.

## 15. Evidence

Final run on HEAD: docs/project/specs/drag-drop/qa/evidence/release/npm-test.txt (78 of 78) and evidence/release/playwright.txt (703 passed, 105 skipped, 0 failed, --workers=2). BUG-024 retest: evidence/TC-drag-drop-BUG-024-retest/. T9 evidence: evidence/TC-drag-drop-T9-04/ (mutation), T9-05/ (grep) and T9-06/ (upgrade from 1.2.0). Other evidence is in docs/project/specs/drag-drop/qa/evidence/ by case id and task, and bug reports are in docs/project/bugs/.
