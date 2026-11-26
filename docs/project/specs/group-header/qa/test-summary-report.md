# Test summary report: group-header

Date: 2026-11-26. Release 1.5.0, branch group-header (T1 to T4 in commit 4d3eac8, T5 in commit c9de341).

## 1. Summary

The feature moves "Quản lý nhóm" into the page header, adds group creation through the "Thêm nhóm" box inside the card, removes the old inline creation from the add task form, and turns the four sticky note dialogs into bottom sheets on phones. All 36 cases that can be run on the build host passed. The three remaining cases are manual checks on real devices. By PM decision they are listed in the release note for the owner and are recorded here as not run.

## 2. Test results

| Measure | Count |
| --- | --- |
| Cases planned | 39 |
| Cases executed | 36 |
| Passed | 36 |
| Failed | 0 |
| Blocked | 0 |
| Not run (manual, for the owner) | 3 (TC-32, TC-33, TC-34) |

By type: 35 automated end to end cases (33 executed), 1 automated unit case (executed), 3 manual cases (not run).

Automated runs:
- Full end to end suite, after the follow ups and again after the version bump: 1035 passed, 113 skipped, 0 failed. Not rerun for this report.
- TC-39, run on 2026-11-26: `npm test` gave 88 of 88 unit tests passed, including the version tests. package.json and package-lock.json are 1.5.0, and no `?v=1.0` to `?v=1.4` reference is left in index.html or src. Output is in `evidence/qa/TC-group-header-39/npm-test.txt`.

## 3. Requirement coverage

Every requirement R1 to R33 and NFR1 to NFR7 has at least one executed case. All pass except NFR5, which is partial because its three manual cases are not run (TC-39 passed). R29 passes in automation (TC-30 and TC-31), and its real iPhone case TC-32 is not run. See `traceability-matrix.csv`.

## 4. Bugs

No bugs were opened for this feature. Open Critical: 0. Open High: 0. Open Medium or Low: 0.

## 5. Exit criteria

| Criterion | Result |
| --- | --- |
| 1. Every requirement has at least one executed case | Met |
| 2. All Critical and High cases passed, or manual ones listed as open in the release note with owner acceptance | Met on condition: TC-32 and TC-33 (High) are listed in release-notes.md, and the owner's acceptance is still to be given at release |
| 3. No open Critical or High bugs | Met |
| 4. All unit and e2e tests pass, grep guard finds nothing | Met (TC-38 and TC-39) |
| 5. No axe violations in light or dark mode | Met (TC-25) |

Exit criteria met: true, with the owner accepting the manual checks in point 2.

## 6. Residual risks

1. TC-32: the on screen keyboard on a real iPhone with Safari is only emulated in Chromium (360 by 340 viewport, TC-31 passes). Real Safari behaviour of `interactive-widget=resizes-content` is not confirmed.
2. TC-33: Telex Enter handling is covered by simulated composition events and keyCode 229 (TC-13), not by a real Vietnamese keyboard.
3. TC-34: Firefox, Safari and Edge on desktop were not tested. Automation covers Chromium only.

These three are the manual checks 1 to 3 in `release-notes.md`.
