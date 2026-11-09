# Test Summary Report: day-navigation

Date: 2026-11-09. Branch: day-navigation. Prepared by QA.

## 1. Scope

The feature lets the owner move to the previous or next day, pick a date, return to today, and work on any day, with the day kept in the address, Vietnamese wording, and the midnight rules. Test basis: requirements R1 to R29 and NFR1 to NFR6, the approved design and UX prototype, tasks T1 to T7. Levels covered: unit, end to end (desktop and mobile Chromium profiles, plus Firefox), accessibility (manual axe run), visual comparison with the prototype at 1440 px and 390 px, and performance checks.

## 2. Final run on current HEAD

| Suite | Result |
| --- | --- |
| npm test (Node unit tests) | 33 passed, 0 failed, 0 skipped |
| npx playwright test | 242 passed, 10 skipped, 0 failed (30.7 s) |

The numbers match the expected values after the refactor into tests/e2e/helpers.js. The 10 skipped tests are viewport specific by design (for example phone layout only or desktop hover only tests skipped on the other project) and are not failures.

## 3. Test cases

89 cases planned, 89 executed. Final status: 88 passed, 0 failed, 1 blocked.

| Task | Planned | Passed | Blocked |
| --- | --- | --- | --- |
| T1 | 11 | 11 | 0 |
| T2 | 4 | 4 | 0 |
| T3 | 18 | 18 | 0 |
| T4 | 16 | 16 | 0 |
| T5 | 9 | 8 | 1 (T5-09) |
| T6 | 19 | 19 | 0 |
| T7 | 12 | 12 | 0 |

| Priority | Planned | Passed | Blocked |
| --- | --- | --- | --- |
| Critical | 26 | 26 | 0 |
| High | 41 | 41 | 0 |
| Medium | 21 | 20 | 1 |
| Low | 1 | 1 | 0 |

The execution log holds 94 rows: 89 case rows (one with an earlier fail, TC-day-navigation-T7-07, re-run and passed after the fix of BUG-002) and 5 retest rows for BUG-001 and BUG-002. Every executed case has evidence under qa/evidence/.

Blocked case: TC-day-navigation-T5-09 (native calendar popup in headed Chrome, Firefox and Edge). It cannot be shown in headless runs. The PM decided the owner checks it on the deployed site after release, so it does not hold the feature.

## 4. Requirement coverage

All 29 functional requirements (R1 to R29) and all 6 NFRs have at least one test case in traceability-matrix.csv, so there are no coverage gaps. Every requirement has its covering cases passed. The only requirement touched by the blocked case is the native popup part of the date picker behaviour, which is also covered by the automated picker cases (typing, min and max, invalid values, keyboard).

NFR results: NFR1 (200 tasks, response under 100 ms) passed after the BUG-002 fix, settled moves 5 to 48 ms. NFR2 to NFR5 passed. NFR6 (subpath hosting) was checked by code reading of relative URLs plus a manual run, as agreed in decisions.md. Accessibility: automated keyboard and accessible name checks pass, and the manual axe run at T7 reported no violations.

## 5. Defects

| Bug | Severity | Status | Summary |
| --- | --- | --- | --- |
| BUG-001 | Low | Closed | The "Về hôm nay" tab text flashed faintly for about 170 ms when opening a non today address. Verified with 40 frame samples across 4 combinations. |
| BUG-002 | Medium | Closed | Moving to a day with 200 tasks took 150 to 190 ms against the 100 ms limit of NFR1. Fixed with content-visibility on .task, verified, and regression checked. |

Opened: 2. Closed: 2. Open: 0 (no Critical, High, Medium or Low bugs open).

## 6. Residual risks

1. WebKit and Safari were not run. Chromium (desktop and mobile profiles) and Firefox were. Recommend a manual check on Safari and iOS.
2. TC-day-navigation-T5-09: the native calendar popup needs a manual check in headed Chrome, Firefox and Edge on the deployed site after release.
3. Two browser tabs overwrite each other on the same day because storage is read and written whole. This existed before the feature and is accepted.
4. Side effect of the BUG-002 fix: off screen wrapped task rows are sized as one line until scrolled in, so the scroll position can jump slightly with long wrapped tasks. Low impact, accepted.
5. A Firefox test query issue at tests/e2e/app.spec.js:869 is a test side problem, not a product defect, and the suite passes.

## 7. Exit criteria assessment

| Criterion | Status |
| --- | --- |
| Every requirement covered by at least one case | Met (R1 to R29, NFR1 to NFR6) |
| All Critical and High cases passed | Met (26 of 26 and 41 of 41) |
| No open Critical or High bugs | Met (no open bugs) |
| All automated suites green on HEAD | Met (33 unit, 242 e2e passed) |
| All planned cases executed | Met with one accepted exception (T5-09 blocked, Medium, manual after release) |

## 8. Recommendation

Release is recommended. The one blocked case and the listed residual risks are low impact and have owners: the native popup check and a Safari spot check should be done on the deployed site right after release.
