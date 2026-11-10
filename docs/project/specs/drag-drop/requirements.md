# Requirements: drag-drop

## Goal

Let the owner pick up a task and drop it into another group, so that moving a task between groups takes one gesture instead of opening Sửa, changing the group choice, and saving. The feature works with a mouse on a laptop and with a finger on a phone. The move itself is the same move that already exists in the edit form of `task-groups`, so the same rules apply: the task keeps its text, done state, date, creation time, and id, only its group changes, and it sits by its creation time in the new section (task-groups R24 and R32). Tasks stay in the browser only, there is no backend and no login, all screen text is Vietnamese, and the paper notebook look is kept. Everything from `daily-task-log`, `day-navigation`, and `task-groups` keeps working as before, including the swipe left gesture on phones.

## User roles

1. Owner: the single person who uses the page for personal daily planning. There are no other roles.

## User stories

1. As the owner, I want to drag a task onto another group, so that I can reorganise my day quickly.
2. As the owner, I want to drag a task into a group that has no tasks on this day, or into "Chưa phân nhóm", so that I am not limited to the sections I can currently see.
3. As the owner using a phone, I want to pick up a task with a long press without losing the swipe left gesture, so that both ways of working stay available.
4. As the owner, I want to cancel a drag at any moment, so that a slip never moves a task by mistake.
5. As a keyboard or screen reader user, I want a way to move a task that does not need dragging, so that I can do everything the mouse user can.

## Decisions used

Rules marked "recommended" were chosen by the BA where `decisions.md` is silent. The open questions in the hand off report may change them.

1. Tasks keep creation order everywhere. A dropped task sits by its creation time in its new section, never at the spot where it was released (decisions: creation order, and task-groups R24, R32). The earlier "quick reorder" idea was not recommended for the same reason (recommended: drag moves a task between groups only).
2. Dragging across days is out of scope (recommended). A drag moves a task between groups on the viewed day only, and the task keeps its date.
3. The edit form group choice (task-groups R23 and R24) stays and is the non dragging alternative for keyboard, screen reader, and single pointer users (WCAG 2.5.7).
4. While a task is dragged, a drop strip lists every group, including groups that have no tasks on the viewed day, and "Chưa phân nhóm" (recommended). This covers empty sections, sections hidden by the filter, and groups far away on a long list.
5. On phones a long press picks up a task, and a swipe left keeps revealing Sửa and Xóa (recommended). On a mouse, pressing and moving the pointer on a row picks it up.

## Vietnamese UI text

New text is exact. Text not listed here stays as in the earlier features.

| Key | Text |
| --- | --- |
| Drop strip label (visible and accessible name of the strip) | Thả vào nhóm |
| Live region, task moved by dropping | Đã chuyển việc "{text}" sang nhóm "{name}". |
| Live region, drag cancelled or released where nothing changes | Đã hủy. Việc vẫn ở nhóm "{name}". |

"{name}" is "Chưa phân nhóm" when the task is ungrouped. The strip shows one drop target per group with the group name as text and its colour swatch, and "Chưa phân nhóm" last. The other texts (section names, storage message) are reused.

## Acceptance criteria

### Starting a drag

R1. WHEN the owner presses a task row with a mouse (or pen) and moves the pointer more than about 6 pixels THE SYSTEM SHALL pick the task up and start a drag. A press and release without that movement SHALL behave exactly as today.

R2. WHEN the owner presses a task row with a finger and holds it still for about 400 ms THE SYSTEM SHALL pick the task up and start a drag.

R3. IF the finger moves more than about 10 pixels before 400 ms have passed THEN THE SYSTEM SHALL not start a drag and SHALL hand the touch to the existing behaviour: a mostly horizontal move to the left reveals Sửa and Xóa as before, and a mostly vertical move scrolls the page. THE SYSTEM SHALL not change the swipe distance, direction, or feel of the existing gesture.

R4. THE SYSTEM SHALL start a drag only from the row itself. A press on the tick box, the Sửa or Xóa buttons, the revealed swipe actions, the edit form fields, or a section toggle SHALL keep its normal behaviour and SHALL never start a drag.

R5. THE SYSTEM SHALL not start a drag while any of these is true: a task is in edit mode, a dialog is open, the add or group name input is composing text with an IME, or the viewed day has no group at all (task-groups R31, there is nothing to drop on).

R6. WHEN a drag starts on a row whose swipe actions are open THE SYSTEM SHALL close the swipe strip first, and SHALL close any other open swipe strip too.

R7. WHEN a drag ends by dropping THE SYSTEM SHALL not also tick the task, open a menu, or select text. WHILE a drag is in progress THE SYSTEM SHALL suppress text selection, the browser context menu, and the phone callout on the dragged row.

### Drop targets

R8. WHILE a task is dragged THE SYSTEM SHALL accept a drop on any of these, and treat each as "move to that group": the header of a visible section (open or folded), any task row of a visible section, the empty space inside a visible section, and any target in the drop strip.

R9. WHILE a task is dragged THE SYSTEM SHALL show the drop strip, with one target for every existing group in creation order and "Chưa phân nhóm" last, whether or not the group has tasks on the viewed day, and whether or not the filter hides it. The strip is always inside the visible screen, so that every group can be reached without scrolling on a long list.

R10. THE SYSTEM SHALL not show the drop strip when no drag is in progress, and SHALL not add it to the normal tab order or reading order of the page.

R11. WHEN the pointer is over a valid target THE SYSTEM SHALL show that target as the current drop target (R19). WHEN the pointer is over no target THE SYSTEM SHALL show no current target, and a release there SHALL cancel the drag.

R12. IF the task is released over the group it is already in THEN THE SYSTEM SHALL change nothing, write nothing, and treat it as a cancel (R22).

R13. WHEN a drop moves the task THE SYSTEM SHALL apply the same rules as the edit form move: only `groupId` changes, the task takes its place by creation time in the target section, the target section is expanded, the section counts and summary are updated, and storage is written straight away (task-groups R24, R28, R32, R33, R55).

R14. WHEN a task is dropped on a section that is folded THE SYSTEM SHALL move the task, expand that section, and keep the remembered state in line with it (task-groups R28 and R40). THE SYSTEM SHALL not expand folded sections while the pointer only hovers over them.

R15. IF the filter shows one group and the task is dropped on another group THEN THE SYSTEM SHALL move the task, keep the filter, let the task leave the view, and move focus as task-groups R28 states (next visible row, else previous, else the add input).

R16. THE SYSTEM SHALL work on every viewed day, past, today, or future (task-groups R27).

R17. THE SYSTEM SHALL move one task per drag. Dragging several tasks at once is not offered.

### Cancel, interruption, and focus

R18. WHEN the owner presses Escape during a drag THE SYSTEM SHALL cancel it: the task stays where it was, nothing is written, and that Escape SHALL not also cancel an edit, close a dialog, or clear a field. WHEN the touch or pointer is interrupted by the browser (for example an incoming call or a pointer cancel event) THE SYSTEM SHALL cancel the drag the same way.

R19. WHILE a drag is in progress THE SYSTEM SHALL show the visual feedback in the notebook style described in R27 to R30.

R20. IF the viewed day changes, a dialog is opened, the page becomes hidden, or the window loses focus during a drag THEN THE SYSTEM SHALL cancel the drag without changes.

R21. IF another tab changes the groups during a drag (a storage event) THEN THE SYSTEM SHALL cancel the drag and refresh as the existing multi tab sync does (T9 and T10 patterns). IF the target group no longer exists at the moment of dropping THEN THE SYSTEM SHALL not move the task and SHALL treat it as a cancel.

R22. WHEN a drag ends without a move (cancel, release outside a target, release on the same group) THE SYSTEM SHALL return keyboard focus to the row's Sửa button if focus had been inside the list, announce the "cancelled" live region text with the task's current group, and leave the list exactly as before the drag.

R23. WHEN a drag ends with a move THE SYSTEM SHALL keep focus on the task's Sửa button in its new place (or follow R15), and announce the "moved" live region text in the polite live region that already exists for task-groups R28.

### Alternative without dragging (WCAG 2.5.7)

R24. THE SYSTEM SHALL keep the group choice in the edit form (task-groups R23 to R26) working exactly as today, as the way to move a task without dragging. It needs only a single tap or key press and no path based gesture.

R25. THE SYSTEM SHALL make no feature of the page depend on dragging: every move that can be done by dragging can be done through Sửa.

R26. THE SYSTEM SHALL not give task rows a role, name, or tab stop that changes how a screen reader reads them today, and SHALL not use the deprecated `aria-grabbed`. The accessible names stay as in task-groups R63a.

### Visual feedback

R27. WHILE a task is dragged THE SYSTEM SHALL show the task as a lifted paper slip that follows the pointer (a slight shadow and a small tilt), keep the original spot as a dashed outline placeholder so the list does not jump, and show the cursor as a hand that grabs on a mouse.

R28. WHILE the pointer is over a valid target THE SYSTEM SHALL show it with a clear ink style outline and a light fill, and show the target group's name as text on the dragged slip or the target, so that the target is never shown by colour alone. The outline SHALL have at least 3 to 1 contrast against its surroundings in light and dark mode.

R29. THE SYSTEM SHALL show the drop strip in the notebook style (for example as a taped paper strip with group stickers), with each target at least 44 by 44 pixels, and with the strip label "Thả vào nhóm". The design is agreed in the UX step.

R30. IF the user prefers reduced motion THEN THE SYSTEM SHALL turn off the tilt and any lift or return animation and keep the outline and fill changes only.

### Auto scroll on long lists

R31. WHILE a task is dragged and the pointer is within about 64 pixels of the top or bottom edge of the visible screen THE SYSTEM SHALL scroll the page in that direction, faster the closer the pointer is to the edge, and stop when the pointer leaves the zone, the drag ends, or the page reaches its end. Targets under the pointer are worked out again after each scroll step.

R32. THE SYSTEM SHALL not scroll the page by finger movement during a touch drag (the move belongs to the drag), and SHALL not move the drop strip with the scroll.

### Persistence and storage problems

R33. WHEN a drop moves a task THE SYSTEM SHALL write the tasks key once and not touch the groups key or the collapsed state key more than the expand in R14 needs.

R34. IF localStorage is unavailable, full, or blocked when a task is dropped THEN THE SYSTEM SHALL behave as for the edit form move and `daily-task-log` R26: keep the move in memory for the session, show the existing storage message, and never overwrite stored data after a failed read (task-groups R61).

R35. IF the page has no groups stored and no group exists THEN THE SYSTEM SHALL offer no drag (R5).

### Data safety

R36. THE SYSTEM SHALL never delete, duplicate, or change the text, done state, date, creation time, or id of a task by dragging. A cancelled or interrupted drag SHALL leave stored data byte for byte unchanged.

R37. THE SYSTEM SHALL show task text and group names during a drag as plain text only (task-groups R65), including the floating slip.

## Non functional requirements

1. Performance: WHEN the owner drags with up to 200 tasks on the viewed day and up to 20 groups, picking up a task SHALL take under 100 ms, following the pointer SHALL not rebuild the task list (only the dragged slip and the current target change), and a drop SHALL update the screen in under 100 ms on a typical laptop or phone (task-groups NFR1). The test checks add, collapse, filter, and move times again after the feature is added.
2. Input support: the drag works with mouse, pen, and touch through one pointer based approach. The browser's built in HTML drag and drop is not enough, because it does not work with touch on phones.
3. Security and data protection: no data leaves the browser, no network calls, no new storage key, and the Content-Security-Policy stays unchanged.
4. Reliability: an interrupted drag never leaves the page stuck (dragged slip left on screen, scrolling locked, or the drop strip still showing). Pressing Escape or ending the touch always restores the normal page.
5. Accessibility: colour is never the only cue for a target (R28), contrast and target sizes follow the values above, every move can be done without dragging (R24), and the live region announces results (R22, R23).
6. Compatibility: works in the current Chrome, Safari, Firefox, and Edge, on desktop and mobile. Safari and iOS cannot be tested on this host, so the iPhone behaviour (long press callout, scroll lock during a drag) is listed as a manual check after release.
7. Language: all visible text and accessible names are Vietnamese, in Unicode.

## Out of scope

Ideas left out to keep this feature small. Each can be added later.

1. Putting a task in a chosen position inside a group (reordering). This needs a stored order field and changes the creation order rule. See open question 1.
2. Dragging a task to another day, for example onto the date line or the next day button. The task keeps its date.
3. Dragging several tasks at once, or dragging a whole group section to reorder groups.
4. A keyboard drag mode (pick up with Space, move with the arrow keys). The edit form move is the alternative for now. See open question 4.
5. Dragging a task onto "Quản lý nhóm" or onto a new group that does not exist yet.
6. Undo after a drop. A moved task is moved back by dragging it again or through Sửa.
7. Sound, vibration, or a first time hint that explains the long press.
8. Auto expanding a folded section while hovering during a drag.
9. A drag handle icon on every row. See open question 3.

## Open questions

See the hand off report. Each has a recommended answer used in the rules above.
