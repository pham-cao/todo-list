# Tasks: drag-drop

Order: T1 can run in parallel with T2 and T3. The FE tasks all touch `src/drag.js` or `src/app.js`, so they run one after another: T2, T3, T4, T5, T6, T7, T8. T9 is the release step. All existing unit and end to end tests must keep passing after every task. Markup and classes come from the "Drag and drop" block of `docs/project/design-system.css` and from `ux/screens/*.html`; interfaces are in `design.md`. New imports carry `?v=1.2.0` until T9.

## T1: Store change that only moves a task to another group
Owner: be
Requirements: R13, R33, R34, R36
Depends on: none
Boundary: `src/store.js`, `tests/unit/store.test.js`
Done when: `store.setGroup(id, groupId)` works as in design.md; unit tests show the group set, replaced and removed (no `groupId` field left), a stored text with spaces around it and a 250 character stored text kept byte for byte, `done`, `date`, `createdAt` and `id` unchanged, exactly one `setItem` call, an unknown id returning `{ error: "notFound" }` with no write, a throwing `setItem` keeping the change in memory with `storageOk` false, and a locked store moving in memory; `npm test` passes.

## T2: Info slip for a move into a group the filter hides
Owner: fe
Screens: ux/screens/filtered--dropped.html
Requirements: R15, R23
Depends on: none
Boundary: `src/app.js` (`moveRow` only), `tests/e2e/groups.spec.js` (one new test; the one assertion named in open question 1 only if that option is chosen)
Done when: `moveRow(row, key, message)` takes an optional live region message (default unchanged) and, when the filter hides the target, also shows the info slip "Đã chuyển việc "{text}" sang nhóm "{name}"." (decisions.md); a new e2e test moves a task through the edit form into a hidden group and sees the slip text, the filter kept and focus on the next row; all e2e tests pass.

## T3: Mouse pick up, slip, strip and cancel
Owner: fe
Screens: ux/screens/resting.html, ux/screens/lifted.html, ux/screens/cancelled.html
Requirements: R1, R4, R5, R6, R7, R9, R10, R17, R18, R22, R26, R27, R29, R30, R35, R37
Depends on: T2 (both change src/app.js)
Boundary: `src/drag.js` (new), `index.html` (`#drag-template`), `src/app.js` (`createDrag` wiring, `composing` flag, `dropOrCancel` cancel branch only), `tests/e2e/helpers.js` (`mouseDrag`), `tests/e2e/drag.spec.js` (new)
Done when: the press, the 6 px threshold, pick up, follow and the cancel paths work as in design.md for mouse and pen, with every release treated as a cancel for now; e2e tests (desktop) show a click on a row changing nothing and a tick still working, a press on the tick box, Sửa, Xóa, a section toggle and an edit field never starting a drag, no drag while a row is in edit, while the delete note is open, or on a day with no group stored, `html.is-dragging`, the dashed placeholder and the slip with the task text as plain text (a task named `<b>abc</b>`), the strip named "Thả vào nhóm" listing every group in creation order plus "Chưa phân nhóm" last with the own group faded, no strip element and no new tab stop at rest, Escape cancelling with nothing written (stored string compared before and after), focus back on the row's Sửa and "Đã hủy. Việc vẫn ở nhóm "{name}"." in the live region, Escape during a drag not reaching anything else, the open swipe closed on pick up (mobile project, by setting the tracked strip open first), and reduced motion showing no tilt; all e2e tests pass.

## T4: Drop targets and the drop
Owner: fe
Screens: ux/screens/hover-section.html, ux/screens/hover-strip.html, ux/screens/dropped.html, ux/screens/dropped--strip.html, ux/screens/folded.html, ux/screens/folded--dropped.html, ux/screens/filtered.html, ux/screens/filtered--dropped.html
Requirements: R8, R11, R12, R13, R14, R15, R16, R19, R21, R23, R28, R33, R34, R36
Depends on: T1, T2, T3
Boundary: `src/drag.js`, `src/app.js` (`dropOrCancel`), `tests/e2e/drag.spec.js`
Done when: hit testing and the drop work as in design.md; e2e tests (desktop) show the section frame and the target name on the slip over a header, a row and the empty space of a section, the strip label marked over a group with no task today, no mark over the own section or the faded label, a release there and over nothing cancelling with nothing written, a drop moving the task by creation time with id, text, done, date and `createdAt` unchanged and exactly one write of the tasks key and none of the groups key (counted with a `setItem` spy), counts and summary updated, focus on Sửa and "Đã chuyển việc "{text}" sang nhóm "{name}"." announced, a drop into a group with no section creating it, a hovered folded section staying folded and opening on drop with the collapsed state stored, a drop under the filter into a hidden group keeping the filter with the info slip and focus on the next row, a drop on a past and a future day, a drop to "Chưa phân nhóm" removing `groupId`, a target group removed in storage before release treated as a cancel, and `setItem` throwing for the tasks key keeping the move on screen with the storage slip shown; all e2e tests pass.

## T5: Long press on phones next to the swipe
Owner: fe
Screens: ux/screens/phone-hold.html, ux/screens/phone-drag.html
Requirements: R2, R3, R6, R7, R32
Depends on: T4
Boundary: `src/drag.js`, `tests/e2e/helpers.js` (`longPressDrag`, `touchDrag` moved here and imported by `app.spec.js` and `groups.spec.js` with no other change), `tests/e2e/drag.spec.js`
Done when: the touch path works as in design.md (pressing wash, 400 ms timer, 10 px abort, non passive `touchmove` only during a drag, no `touch-action` change, `contextmenu` and `selectstart` prevented, slip 60 px above the finger and inside the screen); e2e tests (mobile, CDP touch) show `.task--pressing` during the hold, a long press then a move onto a strip label dropping the task, the page not scrolling while the finger moves during a drag, a fast horizontal swipe still opening Sửa and Xóa with no drag and no class left, a fast vertical move scrolling the page with no drag, a short tap behaving as today, a long press on a row whose swipe is open closing it before the drag, no context menu event reaching the page default and no text selected after a long press, and no horizontal scroll at 360 px while dragging; all e2e tests pass.

## T6: Auto scroll on long lists
Owner: fe
Screens: ux/screens/autoscroll.html
Requirements: R31, R32
Depends on: T5
Boundary: `src/drag.js` (`scrollSpeed` and the frame loop), `tests/unit/drag.test.js` (new), `tests/e2e/drag.spec.js`
Done when: auto scroll works as in design.md; unit tests cover `scrollSpeed` (0 in the middle and on the strip, negative near the top, positive in the 64 px above the strip, faster nearer the edge, capped); e2e tests on a long day show the page scrolling down with the down cue while the pointer rests above the strip and up near the top, no scroll while the pointer is over the strip, scrolling stopping at the page end and when the pointer leaves the zone, the strip staying in place, and a section brought under the pointer by the scroll becoming the marked target; `npm test` and all e2e tests pass.

## T7: Interruptions never leave the page stuck
Owner: fe
Screens: ux/screens/cancelled.html
Requirements: R18, R20, R21, R22, NFR4
Depends on: T6
Boundary: `src/drag.js`, `src/app.js` (`drag.cancel()` in `resetTransient` and the storage listener), `tests/e2e/drag.spec.js`
Done when: every cancel path in design.md runs the same idempotent end; e2e tests show a CDP `touchCancel` (mobile), a `visibilitychange`, a window `blur`, a day change through Back during a drag, the midnight check, and a groups change from another context (storage event) each ending the drag with no slip, strip, cue, `is-dragging`, `task--pressing` or placeholder left, the page still scrollable on the phone, stored data unchanged, and a following drag working normally; all e2e tests pass.

## T8: Speed, accessibility and regression checks
Owner: fe
Screens: all `ux/screens/*.html`
Requirements: R10, R26, R28, R29, R30, NFR1, NFR2, NFR5, NFR6, NFR7
Depends on: T7
Boundary: `tests/e2e/drag.spec.js`, small fixes in `src/drag.js`, `src/app.js` and `index.html` only
Done when: with 200 tasks in 20 groups on a settled page, pick up and drop each take under 100 ms timed in the page with synthetic pointer events, and moving the pointer over several sections adds or removes no child in `#day-list` (`MutationObserver`); the existing add, collapse, filter and edit move speed tests still pass; strip targets are at least 44 by 44 px at 1440, 390 and 360 px with names never cut; the target frame has at least 3 to 1 contrast in light and dark mode (checked by script on computed colours); the accessible names and Tab order tests in `app.spec.js` pass unchanged; a short release note lists the Safari and iOS manual checks (long press callout, scroll lock); all unit and e2e tests pass in both projects.

## T9: Release version 1.3.0
Owner: be
Requirements: NFR3
Depends on: T8
Boundary: `package.json` (`version` only), the `?v=` values in `index.html` and `src/*.js`
Done when: `version` is `1.3.0` and every `?v=1.2.0` in `index.html` and `src/*.js` (including the new `./drag.js` and its `./groups.js` import) is `?v=1.3.0`; `tests/unit/version.test.js` passes and fails when one reference is changed back by hand; all unit and e2e tests pass.
