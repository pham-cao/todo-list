# Test Summary Report: page-flip

Date: 2026-11-13
Build: branch page-flip, version 1.4.0, working tree after T15, T9 and T10 (T1 to T14 committed up to a0a3cdb; the T15, T9 and T10 changes are uncommitted at test time)
Author: QA

## 1. Scope

Changing the day (arrows, date picker, Về hôm nay, browser Back and Forward, address edit) now turns the whole sheet like a notebook page. The page curls away from the top right corner with a diagonal fold (StPageFlip 2.0.7, vendored, MIT), 1 page for 1 day, 2 pages for 2 days and 3 pages for 3 days or more. One page takes 700 ms and the 3 page riffle 950 ms. The day, address, focus and live date line change at once, the turning page is an inert picture, and the flip always plays, also under reduced motion (owner decision, 2026-11-12). The sheet sits on a thick stack of page edges with a back cover on the right and bottom (R8a, T15). T9 removed the superseded leaf, strip, turn and tape styles, and T10 released 1.4.0.

In scope: R1 to R41 (with R3a, R3b and R8a), NFR1 to NFR10, regression of day-navigation, drag-drop day change rules and storage, accessibility, layout at 1440, 390 and 360 px, dark mode, speed with 200 tasks, and the version bump with cache safety.
Out of scope: sideways swipe to change day, a stack that grows with the day, flipping other things, more than 3 pages, any off switch or substitute motion. Safari, iOS, a real Android phone, Firefox and Edge could not be run on this host and stay manual checks (section 10).

## 2. Results at a glance

| Measure | Result |
| --- | --- |
| Test cases planned | 194 |
| Test cases executed (final design) | 168 |
| Passed (final result per case) | 168 |
| Failed (final result) | 0 |
| Blocked (final result) | 11 |
| Superseded by later owner decisions (run earlier, no longer valid) | 14 |
| Dropped (state unreachable, decision 2026-11-12) | 1 (T7-12) |
| Failures found during the cycle, all fixed and retested | BUG-025 to BUG-029 (5 bugs) |
| Unit tests (npm test) | 88 of 88 passed |
| Playwright (npx playwright test --workers=2), this round | 968 passed, 112 skipped, 0 failed (desktop and mobile, 9.2 minutes) |
| Requirement coverage | 54 of 54 matrix rows have at least one case (R1 to R41, R3a, R3b, R8a, NFR1 to NFR10) |

Blocked cases are the 8 earlier manual cases that need a device or a long hand session (T6-18, T6-21, T7-14, T7-15, T7-16, T7-17, T8-08, T8-09) and the 3 manual release checks of release-notes.md that this round added as cases (T10-09 Safari and iOS, T10-10 Android, T10-11 Firefox and Edge). Planned equals executed plus blocked plus superseded plus dropped (168 + 11 + 14 + 1 = 194).

The 112 skipped Playwright tests are skips declared in the specs (tests that apply to one project only). None is a planned case left unexecuted. As agreed, the run used --workers=2.

Execution log: 360 rows. This round added 23 rows (T15-01 to T15-08, T9-01 to T9-04, T10-01 to T10-11).

## 3. Cases by task

| Task | Subject | Cases | Passed | Blocked | Superseded or dropped |
| --- | --- | --- | --- | --- | --- |
| T1 | daysBetween and unit tests | 11 | 11 | 0 | 0 |
| T2 | Flip on the day change and the no flip cases | 15 | 14 | 0 | 1 |
| T3 | Directions, riffle counts and timing | 16 | 16 | 0 | 0 |
| T4 | Interruptions, reduced motion, hidden page | 19 | 17 | 0 | 2 |
| T5 | Quick and held key moves | 17 | 17 | 0 | 0 |
| T6 | Working during a flip, accessibility, storage | 22 | 19 | 2 | 1 |
| T7 | Layout, dark mode, phones, real devices | 18 | 11 | 4 | 3 (2 superseded, 1 dropped) |
| T8 | Speed, real time perception, curl rework (T8b to T8e) | 33 | 23 | 2 | 8 |
| T9 | Remove superseded styles | 4 | 4 | 0 | 0 |
| T10 | Release 1.4.0 | 11 | 8 | 3 | 0 |
| T11 to T13 | Curl, idle loop patch, pooled books | 8 | 8 | 0 | 0 |
| T14 | Curl tests, 200 row alignment | 12 | 12 | 0 | 0 |
| T15 | Thick notebook stack (R8a) | 8 | 8 | 0 | 0 |
| Total | | 194 | 168 | 11 | 15 |

## 4. Cases by priority

| Priority | Cases | Passed | Blocked | Superseded or dropped |
| --- | --- | --- | --- | --- |
| Critical | 66 | 60 | 0 | 6 |
| High | 96 | 83 | 5 (T6-21, T7-14, T7-15, T7-16, T10-09) | 8 |
| Medium | 32 | 25 | 6 (T6-18, T7-17, T8-08, T8-09, T10-10, T10-11) | 1 (dropped T7-12) |

By automation column: 139 end to end, 35 manual, 11 unit, 9 marked superseded.

## 5. Requirement coverage

Source: traceability-matrix.csv. The gap found for R8a (the thick notebook was added to the requirements after the plan) is closed: eight T15 cases now trace to R8a (T15-01 to T15-08), and T15 cases also trace to R13, R28, R33 and R34. The three release manual cases trace to NFR8 and NFR2.

| Group | Items | Covered | Notes |
| --- | --- | --- | --- |
| R1 to R41 with R3a, R3b | 43 | 43 | All executed cases passed; cases superseded by the curl are replaced by later ones on the same requirement |
| R8a Thick notebook | 1 | 1 | T15-01 to T15-08 passed (stack always present, 12 layers, light and dark, inside the 8 px gutter at 390 and 360 px, no scroll, no layout change, still present during a riffle) |
| NFR1 to NFR10 | 10 | 10 | NFR2 and NFR8 are partly manual: Chromium done, real Safari, iOS and Android blocked |

Requirements with a bug found during testing: R1 and R8 (BUG-028), R11 and R20 (BUG-025), R12 and R13 (BUG-026, BUG-029), R41 (BUG-027). All are closed.

## 6. Bugs

Five bugs were opened for this feature (BUG-025 to BUG-029) and all five are closed. No Critical bug was found.

| Severity | Opened | Closed | Open |
| --- | --- | --- | --- |
| Critical | 0 | 0 | 0 |
| High | 2 | 2 | 0 |
| Medium | 3 | 3 | 0 |
| Low | 0 | 0 | 0 |

| Bug | Severity | Found in | Subject | Status |
| --- | --- | --- | --- | --- |
| BUG-025 | Medium | T6 | A flip stage present gave form controls on the real page a doubled accessible name | Closed, verified (T6-09) |
| BUG-026 | Medium | T7 | On a scrolled phone page the leaf copy landed up to 246 px off the page | Closed, verified (T7-11) |
| BUG-027 | High | T7 | The measure class made a 200 task day move take about 210 ms, breaking the 100 ms day navigation test | Closed, verified (T2-15) |
| BUG-028 | High | T8 | The flip was not perceptible in real time playback; paused frame tests missed it | Closed, verified in T8b, still green on the curl |
| BUG-029 | Medium | T14 | Back flip copy 24 px below the page on a 200 wrapping row day, in full suite runs only | Closed, verified (T14-11, two full runs green; green again in this round) |

Open bugs: none. No new bug was found in the T15, T9 and T10 round.

## 7. Round T15, T9 and T10 (this run)

| Check | Result |
| --- | --- |
| npm test | 88 of 88 passed (evidence/T15-qa/npm-test.txt) |
| Playwright full suite, --workers=2, desktop and mobile | 968 passed, 112 skipped, 0 failed (evidence/T15-qa/full-run-1.txt). The FE ran it twice green; QA ran it once as agreed |
| T15 tests (shadow layers in 4 scheme and width combinations, reach inside the gutter, no scroll, stack during a riffle) | Passed in both projects |
| Stack at 360, 390 and 1440 px, light and dark (Playwright MCP) | No horizontal scroll; --stack-u 0.7 px under 601 px and 1.8 px above; 12 layers in both schemes (evidence/T15-qa/manual-360px-stack.txt) |
| Look against the approved thick prototype | Matches: same stack width, colours and fold (evidence/T15-qa/manual-screenshot-compare.txt). The FE 1440 px shot is cut at the 900 px viewport, so the bottom edge is not in it; this is a crop |
| T9 grep of removed classes over src, index.html, design-system.* | No match (evidence/T15-qa/grep-removed.txt) |
| T9 design-system.md | Day change bullet points to Page flip, Superseded note gone, reduced motion line names the flip as the one exception |
| T10 version | package.json and lockfile 1.4.0; no 1.3.0 left; every ?v= is 1.4.0 including flip.js, date.js and the vendored library |
| T10 mutation | One reference set back to 1.3.0 made version.test.js fail; restored, it passes (evidence/T15-qa/version-mutation.txt) |
| T10 subpath and network | Served under /sub/: 11 requests, one host, no 4xx or 5xx, no console or CSP error, flip plays and ends (evidence/T15-qa/manual-subpath-network.txt) |
| Servers | The two temporary servers on port 4999 were stopped; ports 8080 and 8090 were not touched |

The retest of the two minor items the reviewer folded into this round (a half built pooled book on a library throw, and end() guarding quiet() and pfSleep() per book) is covered by the full run being green; no separate case was planned for them.

## 8. Accessibility

Axe runs on Chromium with a stage present (T6 cases), and the accessibility tree, tab order and live region count tests pass in the full run. The stage stays aria-hidden and inert, focus stays on the pressed arrow, and the live date line announces once. BUG-025 (doubled accessible name) was found and fixed in T6. The fold shadow can lower contrast of text under the moving band below 4.5:1 for a few frames; this is exempt by decision 2026-11-13 (section 11). The screen reader half of T6-21 was not run (blocked).

## 9. Speed

NFR1 to NFR3 with 200 tasks on each of two days, Chromium, median of 3 (T8d and T14-09): no longtask, median frame time 16.0 ms (budget 18.2 ms), no frame over 50 ms (maximum 17 to 24 ms), first frame 25 to 44 ms in the median runs. On a scrolled day with 200 rows the first frame took 31 to 57 ms in testing; accepted in decisions.md (2026-11-13). Day navigation with 200 tasks stays under 100 ms (BUG-027 fixed). The Firefox riffle (T8-08) and the Android phone (T8-09) were not run and are blocked.

## 10. Manual checks still open (counted as blocked)

These cannot be run on this host. release-notes.md carries the steps.

| Check | Case | What to verify |
| --- | --- | --- |
| Safari on macOS and iOS | T10-09 (High), T7-14 to T7-16 (High) | Curl with diagonal fold and no seams, clipped corners or blank flash, light and dark, also with Reduce Motion on; stack edges and back cover at phone width without sideways scroll; quick taps leave no page; Tab order stays on the pressed arrow; Enter on an arrow flips once |
| Mid range Android phone | T10-10, T8-09 (Medium) | The 950 ms riffle looks smooth; stutter is an accepted risk, note how it looks |
| Firefox and Edge on desktop | T10-11, T8-08 (Medium) | Forward, back and riffle play and end cleanly in light and dark; the stack shows around the sheet |
| Screen reader | T6-21 (High) | Move and listen: the day change is announced once, the page is not read out |
| Mixed work session | T6-18, T7-17 (Medium) | 15 minute exploratory charter of work during flips, and a held key session on a device |

## 11. Known risks accepted in decisions.md and release-notes.md

1. Always flip, no off switch (2026-11-12): the flip ignores the system reduced motion setting. A known risk against WCAG 2.3.3 (AAA). It is one short turn started by the person, with no flashing.
2. Fold shadow contrast (2026-11-13): text under the moving fold shadow band may drop below 4.5:1 for a few frames; maxShadowOpacity stays 0.55. Text on the turning page stays at 4.5:1 or better. Measured: new page ink under the darkest fold point 1.81 to 4.10 in light, 5.97 to 6.72 in dark (T14-10).
3. Smoothness on slower devices (2026-11-13): no lighter fallback; weak phones may stutter in the riffle, and the first frame on a scrolled 200 row day took 31 to 57 ms.
4. T7-12 dropped (2026-11-12): the sheet body cannot be scrolled fully out of view; R13 stays covered by T7-01 and T7-11.
5. Library patches: two small marked patches to StPageFlip (linked stylesheet, frame loop sleep while idle) are carried in vendor/page-flip/.

## 12. Exit criteria

| Criterion | Status |
| --- | --- |
| Every requirement and NFR covered by at least one case | Met (R8a gap closed in this round) |
| All Critical and High cases passed | Met with one exception: all 60 Critical and 83 High cases that can run here passed; 5 High cases need a real Safari, iOS device or a screen reader (T7-14, T7-15, T7-16, T6-21, T10-09) and stay manual release checks, as in drag-drop. No Critical case is blocked |
| No open Critical or High bugs | Met (BUG-027 and BUG-028 closed; 0 open bugs) |
| Full automated suites green | Met (npm test 88 of 88; Playwright 968 passed, 112 skipped, 0 failed) |
| Speed with 200 tasks | Met in Chromium; Firefox and Android blocked, residual accepted in decisions.md |
| Version and cache safety for 1.4.0 | Met (T10-01 to T10-07 passed, mutation check fails as expected) |
| Browser coverage | Partly met: Chromium desktop and Pixel 7 profile; Safari, iOS, real Android, Firefox and Edge are manual checks |

Overall: exit criteria are met (exit_criteria_met: true), on the condition that the manual checks in section 10 are done from release-notes.md on real devices soon after release.

## 13. Residual risks

1. Safari and iOS 3D and clip behaviour of the curl is verified only through Chromium. This is the largest remaining risk.
2. Weak phones may stutter during the riffle and the first frame on a scrolled 200 row day is slow (accepted).
3. People sensitive to motion cannot turn the flip off (accepted).
4. The fold shadow band can lower the contrast of text under it for a few frames (accepted).
5. Screen reader behaviour and the long hand sessions were not done by a person.
6. The T15, T9 and T10 changes are uncommitted at the time of this report; the final run should be repeated on the committed HEAD if the reviewer asks for changes.

## 14. Recommendation

Release 1.4.0 is recommended, on these conditions:
1. Keep the manual checks and accepted risks of release-notes.md in the release note and the pull request text.
2. Run the Safari, iOS, Android, Firefox and Edge checks on real devices soon after release and note the look of the riffle on weak phones.
3. Commit T15, T9 and T10 and confirm npm test and the full suite on HEAD.

## 15. Evidence

This round: docs/project/specs/page-flip/qa/evidence/T15-qa/ (npm-test.txt, full-run-1.txt, grep-removed.txt, grep-130.txt, version-mutation.txt, manual-subpath-network.txt, manual-360px-stack.txt, manual-screenshot-compare.txt, diff-nonversion-lines.txt, summary.txt). FE screenshots: evidence/T15-fe/ (12 files). Earlier evidence is under qa/evidence/ by case id, task and bug, and bug reports are in docs/project/bugs/.
