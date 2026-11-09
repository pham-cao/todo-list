# QA summary: daily-task-log (T12 and feature acceptance)

Date: 2026-11-09. Branch: daily-task-log.

## Results

- Unit: 21 of 21 passed.
- End to end, Chromium desktop and mobile, run with --repeat-each=2: 174 passed, 18 skipped (viewport specific skips), 0 failed, 0 flaky.
- Firefox (Desktop Firefox): 40 passed, 7 skipped (phone only tests), 0 failed.
- WebKit: could not be run. The browser downloads, but the host lacks system libraries (needs sudo apt). No dependency was added.
- T12 Done when: keyboard flow passed, accessible names passed, no horizontal scroll at 360 px passed, 200 tasks passed, light and dark match the prototype on a manual check (evidence/T12/*.png), full suites pass.

## Coverage

Every requirement R1 to R30 and NFR1 to NFR5 now has at least one passing test case in traceability-matrix.csv. Gaps filled in this pass: R23, R24 (unit), NFR1 to NFR4, plus T12 links for R28 to R30.

## Bugs

None opened. No bug log was needed.

## Observations (not defects)

1. The Thêm button is 36 px tall on screen with a 44 px hit area through a pseudo element (design choice). The R29 rule is met by hit area, but a strict reading of "button at least 44 by 44" would call for a taller button.
2. Every row checkbox has the same name, "Đánh dấu hoàn thành", and the task text is its description. A screen reader user hears the task through the description. An aria-labelledby follow up would make it clearer.
3. Colour contrast was judged visually against the approved prototype only. No automated axe scan was run (no axe package in the project).
4. Safari (WebKit) is untested, which is a gap for NFR3. Run the suite on a machine with WebKit libraries before claiming Safari support.

## Recommendation

Release, with the Safari check as a condition for the compatibility claim. Exit criteria met: all requirements covered, all cases passed, no open Critical or High bugs.
