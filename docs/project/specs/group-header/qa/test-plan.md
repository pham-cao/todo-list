# Test plan: group-header

Date: 2026-11-13. Owner of the plan: QA. Status: draft for the build tasks T1 to T5.

## 1. Scope

In scope: the "Quản lý nhóm" button in the page header (R1 to R4), the "Thêm nhóm" control and the new group box in the "Nhóm việc" card (R5 to R17), the add task form without "Nhóm mới..." (R18 to R21), interaction with page flip (R22 to R25), keyboard and screen reader behaviour (R26 to R28), phone bottom sheets for the four sticky note dialogs (R29, R30), data and safety (R31 to R33) and NFR1 to NFR7.

Out of scope: colour choice in the box, reordering or nesting groups, changes to rename, recolour, bulk move, blocked delete, drag and drop or the storage format, keyboard shortcuts, and the page flip itself beyond R22 to R25. These are covered only by running the existing tests as regression (TC-group-header-09 and 22).

## 2. Approach

Risk based, with the fewest cases that cover every requirement. 39 cases in total: 35 automated e2e, 1 automated unit, 3 manual.

Test design techniques: use case and state transition for the box lifecycle, decision table for the empty name rule, equivalence partitioning and boundary values for the name length (29, 30, 31), the group count (19, 20) and the widths (360, 390, 412, 452, 1440), error guessing for IME Enter, double press, markup in a name and another tab, and a checklist for accessibility and the removal of old code.

Test levels:

| Level | What | Tool |
| --- | --- | --- |
| Unit | Version check (T5) | node:test in tests/unit |
| End to end | Header, card, box, add form, sheets, flip interaction, performance | Playwright, Desktop Chrome and Pixel 7, `--workers=2` |
| Accessibility | axe in light and dark on header, card, box and error states | Playwright with axe |
| Manual | iOS Safari keyboard, Telex IME Enter, Firefox, Safari and Edge smoke | Real devices, evidence as notes and screenshots |

No API testing, since there is no backend.

## 3. Risk ranking

| Risk | Likelihood | Impact | Cases |
| --- | --- | --- | --- |
| Box creates a group by accident or twice (Enter, IME, double press) | Medium | High | 12, 13, 29 |
| Add form choice or typed text disturbed by group creation | Medium | High | 23, 35 to 37 |
| Header layout breaks on phones (label, 44 px, scroll, tab order) | High | High | 03, 04 |
| Flip interaction leaves a stage or covers the card | Medium | High | 06, 07, 08 |
| Focus and dialog semantics wrong (trap, inert card, Escape closing the card) | Medium | High | 14, 24, 25 |
| Bottom sheets hidden by the on screen keyboard | Medium | High | 30 to 32 |
| Old inline code left behind or existing group features regress | Medium | Medium | 09, 22, 38 |
| Markup in a group name | Low | High | 28 |

## 4. Environment and test data

Local static server of the current branch, Chromium (Desktop Chrome) and Pixel 7 emulation, light and dark colour schemes. Each test seeds localStorage itself: 0, 2, 3, 19 and 20 groups, and a day with 200 tasks for performance. A second page in the same browser context stands in for "another tab". The storage failure is simulated by making localStorage writes throw. The keyboard at 360 by 340 is simulated by the viewport size. Manual checks need a real iPhone with Safari and Vietnamese Telex input.

Constraint: Safari and iOS cannot be tested on the build host, so cases 32 to 34 are manual and go in the release note (NFR5).

## 5. Entry criteria

Per task: the FE or BE owner reports `implemented`, the task is on the branch cut from main after page-flip 1.4.0, and all existing unit and e2e tests passed before the task started. The page-flip suite must not be running at the same time on the same host.

## 6. Exit criteria

1. Every requirement R1 to R33 and NFR1 to NFR7 has at least one executed case (see traceability-matrix.csv).
2. All Critical and High cases passed, including the three manual ones, or the manual ones are listed as open in the release note with the owner's acceptance.
3. No open Critical or High bugs.
4. All unit and e2e tests pass in both projects, and the grep guard in case 38 finds nothing.
5. No axe violations in light or dark mode.

## 7. Task to case map

| Task | Cases |
| --- | --- |
| T1 | 01 to 09 (07 and 08 shared with T2) |
| T2 | 07, 08, 10 to 29, 33 (33 completed in T5 notes) |
| T3 | 25, 30 to 32 |
| T4 | 09, 35 to 38 |
| T5 | 33, 34, 39 |

Case ids are TC-group-header-NN. Execution evidence goes in `evidence/<TC-ID>/` and rows in `test-execution-log.csv`, created in execute mode. T3 screenshots also go in `evidence/T3-fe/` as the task requires.

## 8. Deliverables and metrics

test-cases.csv, traceability-matrix.csv, test-execution-log.csv, bug reports, and test-summary-report.md in report mode. Metrics: cases planned, executed, passed, failed, blocked; requirement coverage; bugs by severity and status.

## 9. Assumptions and open points

1. The defaults for Q1 to Q5 are the owner's answers recorded in decisions.md on 2026-11-13.
2. Case 33 needs a human with a Telex keyboard; the automated IME case 13 only simulates composition events.
3. Cases 03 and 30 reuse the Pixel 7 project for phone widths and set explicit viewports for the other widths.
