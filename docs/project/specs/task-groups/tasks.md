# Tasks: task-groups

Order: T1 and T2 can run in parallel. T3 needs T2. The FE tasks all touch `src/app.js` or `index.html`, so they run one after another: T4, T5, T6, T7, T8, T9, T10, then T11. All existing unit and end to end tests must keep passing after every task, apart from the expected lists and Tab counts named in a task. Markup and class names come from the final "Task groups" block of `docs/project/design-system.css` and the final `ux/screens` (the group label may change to the paper sticker style; see design.md).

## T1: Version every asset reference
Owner: be
Requirements: NFR5
Depends on: none
Boundary: `package.json` (`version` only), `index.html` (the stylesheet `<link>` and the entry `<script>` only), import lines in `src/*.js`, `tests/unit/version.test.js` (new)
Done when: `package.json` has `"version": "1.2.0"`; `index.html` loads `docs/project/design-system.css?v=1.2.0` and `src/app.js?v=1.2.0`; every relative import in `src/*.js` ends with `?v=1.2.0`; `tests/unit/version.test.js` checks every local `href` and `src` in `index.html` and every `./` import, static or dynamic, in `src/*.js` against the `package.json` version and that each named file exists, and fails when one reference is changed to another value or loses its query (try it once by hand); `npm test` and all e2e tests pass; the release step from design.md is added to the release checklist note in the PR description.

## T2: Tasks remember their group
Owner: be
Requirements: R2, R19, R24, R26, R52, R53, R55, R57, R58, R67, R69, R70, NFR3, NFR4
Depends on: none
Boundary: `src/store.js`, `tests/unit/store.test.js`
Done when: `validateText(raw, max)`, exported `newId`, `store.add(raw, now, dateKey, groupId)`, `store.updateText(id, raw, groupId)`, `store.groupUsage(groupId)` and `store.moveGroup(fromId, toId)` behave as in design.md; new unit tests cover: no `groupId` field on ungrouped tasks; set, keep (undefined) and remove (null) in `updateText`; nothing changes on invalid text; `groupUsage` count and sorted distinct days across past, today and future, done and not done; `moveGroup` changes only `groupId` of the source tasks, calls `setItem` exactly once, returns `{ moved: 0 }` without a write for an empty group, and on a throwing `setItem` returns `{ error: "save" }` with `tasksFor` and the stored string unchanged; a locked store moves in memory; stored tasks without, with null, and with an unknown `groupId` load and are not rewritten; every existing store test passes unchanged.

## T3: Groups and collapsed state module
Owner: be
Requirements: R1, R3, R4, R5, R6, R7, R9, R10, R40, R55, R56, R59, R60, R61, NFR2
Depends on: T2
Boundary: `src/groups.js` (new), `tests/unit/groups.test.js` (new)
Done when: `src/groups.js` exports the constants, `validateGroupName`, `nextColor` and `createGroups` with the interface in design.md and imports `./store.js?v=1.2.0`; unit tests cover: trim and names kept as typed (diacritics, emoji, `<b>abc</b>`); empty and spaces only; 30 code points after NFC accepted, 31 rejected, decomposed input counted after NFC; duplicates ignoring case and NFC, "chưa phân nhóm" rejected, renaming to the same name in another case accepted; the 20 group limit returned before name errors; colour order, wrap after purple, continuation from the latest group after a deletion; load of missing, empty array, non JSON and non array values (corrupt copy written once to `daily-todo:groups:v1:corrupt`), bad items dropped, reserved ids dropped, unknown colour shown as yellow; a throwing `getItem` sets `storageOk` false and blocks writes; a throwing `setItem` keeps the change in memory with `storageOk` false; collapsed state saved as `{ "collapsed": [...] }` and read back, garbage UI values ignored, `remove` drops the collapsed entry; `npm test` passes.

## T4: Day list in sections with collapse
Owner: fe
Screens: ux/screens/no-groups.html, ux/screens/sections.html, ux/screens/sections--collapsed.html
Requirements: R11, R29, R30, R31, R32, R33, R34, R39, R40, R50, R57, R58, R63, R65, NFR1
Depends on: T1, T3
Boundary: `index.html` (list container, `#group-template`), `src/app.js`, `tests/e2e/helpers.js`, `tests/e2e/groups.spec.js` (new)
Done when: `#task-list` is replaced by `#day-list` and `renderList()` works as in design.md (bucketing, plain list when no task has a group, row reuse with focus kept, one shot classes cleared); `updateSummary()` writes header counts and toggle names; the delete flow uses the whole container for the next focus and rebuilds when a list empties; tick, delete, swipe and peek work inside sections; `helpers.js` can seed `daily-todo:groups:v1` and `daily-todo:ui:v1` in the same init script; e2e tests show section order with Chưa phân nhóm last, empty groups hidden, a day with only ungrouped tasks and a task with an unknown group both shown as the plain list, header heading role and accessible name, counts after a tick, collapse with Enter and Space remembered across reload and on another day, a collapsed section still counted in the summary, a group named `<b>abc</b>` shown as text, and the last grouped task deleted turning the day back into the plain list; all existing e2e tests pass unchanged.

## T5: Group choice and new group in the add form
Owner: fe
Screens: ux/screens/no-groups.html, ux/screens/add-new-group.html, ux/screens/add-new-group--created.html, ux/screens/add-new-group--added.html
Requirements: R3, R4, R5, R6, R7, R8, R10, R14, R15, R16, R17, R18, R19, R20, R21, R22, R55, R62
Depends on: T4
Boundary: `index.html` (add form), `src/app.js`, `tests/e2e/groups.spec.js`, `tests/e2e/app.spec.js` and `tests/e2e/day-nav.spec.js` (Tab counts only)
Done when: the add choice, the new group line and `renderChoices()` (add choice part) work as in design.md; e2e tests show the choice on "Chưa phân nhóm" after load and reload, "Nhóm mới..." focusing the name input with the next colour swatch, Enter and "Tạo nhóm" creating and selecting the group without adding a task and focusing the add input, the three name errors and the 20 group error on choosing, typing clearing an error, Escape restoring the previous choice with focus on it, an add saving `groupId` on the viewed day at the end of its section with the choice kept, a removed group (deleted from storage in another context, then add) saving ungrouped and resetting the choice, and an add to a collapsed section expanding it; the keyboard only test in `app.spec.js` and the 200 rows Tab test in `day-nav.spec.js` gain one Tab stop for the group choice; all e2e tests pass.

## T6: Move a task through the edit form
Owner: fe
Screens: ux/screens/edit-move.html, ux/screens/edit-move--saved.html, ux/screens/swipe.html
Requirements: R23, R24, R25, R26, R27, R28, R32, R64
Depends on: T5
Boundary: `index.html` (edit template), `src/app.js`, `tests/e2e/groups.spec.js`
Done when: the edit group choice and the move flow work as in design.md; e2e tests show the current group preselected, Lưu and Enter saving text and group in one go with the row placed by creation time in the new section, the section expanded, focus on the moved row's Sửa and the target section name in the live region, Hủy and Escape keeping text and group, invalid text changing neither, a move on a past and a future day, a move to Chưa phân nhóm removing `groupId` from storage, and on a phone the swipe and Sửa reaching the edit form inside a section; all e2e tests pass.

## T7: Group bar and filter
Owner: fe
Screens: ux/screens/sections.html, ux/screens/filter.html, ux/screens/no-groups.html
Requirements: R41, R42, R43, R44, R45, R46, R47, R48, R49, R50, R62
Depends on: T6
Boundary: `index.html` (group bar, `#group-empty`, `#notice`), `src/app.js`, `tests/e2e/groups.spec.js`, `tests/e2e/app.spec.js` and `tests/e2e/day-nav.spec.js` (names list and Tab counts only)
Done when: the group bar with the filter and a "Quản lý nhóm" button (wired in T8) is in place and the filter works as in design.md; e2e tests show no filter before the first group and the button on every day, the option list, one section without a toggle while filtered with a stored collapsed state kept, both filter empty texts and the usual empty state on a day with no tasks, the filter kept across previous, next and Back and reset on reload, the add choice following a group or Chưa phân nhóm but not "Tất cả nhóm", an add to a hidden group saved with the notice in a polite status, the summary counting the whole day while filtered, a move under the filter sending focus to the next row (T6 rule), and storage unchanged by filtering; the names test in `app.spec.js` expects "Quản lý nhóm" after "Thêm"; the keyboard only and 200 rows Tab tests gain one more stop; all e2e tests pass.

## T8: Manage dialog with rename and colour
Owner: fe
Screens: ux/screens/manage--empty.html, ux/screens/manage.html, ux/screens/manage--edit.html, ux/screens/manage--edit-error.html
Requirements: R4, R5, R6, R8, R11, R12, R13, R35, R36, R37, R38, R55, R62, R65
Depends on: T7
Boundary: `index.html` (manage dialog and its templates), `src/manage.js` (new), `src/app.js` (wiring, `refresh`), `tests/e2e/groups.spec.js`
Done when: `createManage` opens the "Nhóm việc" card from "Quản lý nhóm" with rows or the empty text, the move buttons are rendered (inactive with the hint when the group has no tasks; the action itself comes in T10), and rename and colour work as in design.md; e2e tests show the rename input named "Tên nhóm", six colour radios named Vàng to Tím with the current one checked and usable with arrow keys, Lưu and Enter saving with the new name and colour shown in headers, the add choice and the filter after closing, the three name errors and typing clearing them, Hủy and Escape cancelling the row edit without closing the card, only one row in edit at a time, "Đóng" and Escape closing with focus back on "Quản lý nhóm", and a filtered group renamed staying selected; all e2e tests pass.

## T9: Delete a group, blocked delete and show its tasks
Owner: fe
Screens: ux/screens/manage--delete.html, ux/screens/manage--blocked.html, ux/screens/show-tasks.html
Requirements: R48, R51, R52, R53, R54, R62
Depends on: T8
Boundary: `index.html` (delete and blocked notes), `src/manage.js`, `src/app.js` (`showGroupTasks`), `tests/e2e/groups.spec.js`
Done when: delete, blocked and show tasks work as in design.md; e2e tests show the delete question with "Giữ lại" focused, "Xóa nhóm" removing the group from storage and the dialog with focus moving to the next row, "Giữ lại" and Escape keeping it, a filter on a deleted group resetting to "Tất cả nhóm", the blocked message with the right n and d for tasks on past, today and future days, done and not done, no task changed, Xóa still focusable, "Đã hiểu" and Escape closing, "Xem các việc này" picking the latest day up to today and otherwise the earliest later day, with the filter and add choice on the group, the hash written and Back returning to the previous day; all e2e tests pass.

## T10: Move all tasks of a group
Owner: fe
Screens: ux/screens/manage.html, ux/screens/manage--blocked.html, ux/screens/move-all.html, ux/screens/move-all--error.html, ux/screens/move-all--done.html
Requirements: R61, R67, R68, R69, R70, R71, R72
Depends on: T9
Boundary: `index.html` (move card), `src/manage.js`, `tests/e2e/groups.spec.js`
Done when: the move card works as in design.md from the row button and from the blocked note; e2e tests show the inactive button doing nothing, the title, the target list without the source and with "Chưa phân nhóm" first, the sentence updating with the target, "Hủy" and Escape changing nothing, "Chuyển việc" moving every task of the group on every day with id, text, done, date and `createdAt` unchanged, the notice, the target section expanded, focus on "Quản lý nhóm", the source group kept and now deletable, a filter on the source showing its empty state, the add choice on the source kept; with `setItem` throwing for the tasks key the card stays open with the error, the target kept, and every task still in its source group in the page and in storage; all e2e tests pass.

## T11: Keyboard, size, safety and speed checks
Owner: fe
Screens: all `ux/screens/*.html`
Requirements: R9, R12, R59, R60, R61, R62, R64, R65, R66, NFR1, NFR2, NFR3, NFR4, NFR6, NFR7, NFR8
Depends on: T1, T10
Boundary: `tests/e2e/groups.spec.js`, small fixes in `src/app.js`, `src/manage.js` and `index.html` only
Done when: e2e tests show a full keyboard only path (create a group on the fly, add, collapse, filter, move a task, open the dialog, rename and recolour, move all, delete) with Enter and Escape; every new control at least 44 by 44 px; no horizontal scroll at 360 px with the new group line, the edit choice and each dialog open; collapse and the moved wash with no animation under reduced motion; data saved before the feature loading with every task present and ungrouped and the stored tasks string unchanged after load; corrupt groups and UI values loading with no message and the corrupt copy written; storage blocked showing the slip while groups still work in memory; a stored colour code of `"red; x"` shown as yellow; with 200 tasks in 20 groups, add, move, collapse and filter each update in under 100 ms timed in the page; all unit and e2e tests pass in both projects.
