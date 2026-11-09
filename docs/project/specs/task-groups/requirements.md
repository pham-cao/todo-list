# Requirements: task-groups

## Goal

Let the owner create their own groups (for example "Công ty", "Nhà", "Học tiếng Nhật"), give each group a highlighter colour, and put each task into one group, so that a day's list is split into clear sections that are easier to manage. Groups are made when needed, including on the spot while adding a task. Sections can be collapsed, and the list can be filtered to one group. Tasks stay in the browser only (localStorage), there is no backend and no login, all screen text is Vietnamese, the day follows the browser's local timezone, and the paper notebook look is kept. Everything from `daily-task-log` and `day-navigation` keeps working as before, and a task that has no group behaves exactly as it does today.

## User roles

1. Owner: the single person who uses the page for personal daily planning. There are no other roles.

## User stories

1. As the owner, I want to create a group while I am adding a task, so that I do not have to leave what I am doing to set things up.
2. As the owner, I want to choose a group for a new task, so that it lands in the right section straight away.
3. As the owner, I want to move an existing task to another group or take it out of a group, so that I can fix a wrong choice or reorganise my day.
4. As the owner, I want the day list shown in coloured sections by group, so that I can see at a glance what belongs to work, home, and so on.
5. As the owner, I want to collapse sections I do not need right now, so that the page stays short.
6. As the owner, I want to show only one group, so that I can focus on it.
7. As the owner, I want to rename a group and change its colour, so that I can fix or refresh it without touching its tasks.
8. As the owner, I want to be stopped from deleting a group that still has tasks, and be shown where they are, so that no task is ever lost or hidden by mistake.
9. As the owner, I want my existing tasks to still be there after this feature arrives, so that I can trust the tool with my history.

## Decisions used

Owner and PM decisions are logged in `decisions.md`. Rules marked "recommended" were chosen by the BA where the decisions were silent, and are easy to change.

1. A group has a name and a colour chosen from 6 highlighter colours (owner).
2. Groups are global: one list of groups serves every day. A task belongs to one group or to none (owner).
3. The day list shows only the groups that have at least one task on that day (or the group selected by the filter), in the order the groups were created, with "Chưa phân nhóm" last (PM).
4. Sections are collapsible and the list can be filtered by group (owner).
5. A group that still has tasks on any day cannot be deleted (owner).
6. The add form keeps the chosen group while the page is open and resets to ungrouped on reload (PM).
7. At most 20 groups, names up to 30 characters, no duplicate names ignoring case (PM).
8. A moved task sits by its creation time in the new section (PM).
9. Stamp, progress, and summary count the whole day (PM).
10. Collapsed state is remembered per group across days and reloads. The filter is kept while moving between days but resets to all groups on reload (recommended).

## Vietnamese UI text

New text is exact. Text not listed here stays as in `daily-task-log` and `day-navigation`.

| Key | Text |
| --- | --- |
| Group choice in the add form and in edit mode (label) | Nhóm |
| Ungrouped option and section header | Chưa phân nhóm |
| Create a new group option | Nhóm mới... |
| New group name input (placeholder and accessible name) | Tên nhóm mới |
| Create group button | Tạo nhóm |
| Manage groups button | Quản lý nhóm |
| Manage groups dialog title | Nhóm việc |
| Manage groups dialog close button | Đóng |
| Manage groups empty state | Bạn chưa có nhóm nào. |
| Rename, save, cancel, delete buttons in the dialog | Sửa, Lưu, Hủy, Xóa (same as for tasks) |
| Colour choice (group label in the dialog) | Màu nhóm |
| Colour names (accessible names of the 6 choices) | Vàng, Hồng, Xanh lá, Xanh dương, Cam, Tím |
| Delete group message, group has no tasks | Xóa nhóm "{name}"? |
| Delete group confirm button | Xóa nhóm |
| Delete group cancel button | Giữ lại |
| Delete blocked message | Chưa thể xóa nhóm "{name}" vì nhóm còn {n} việc trong {d} ngày. Hãy chuyển các việc này sang nhóm khác trước. |
| Delete blocked, show tasks button | Xem các việc này |
| Delete blocked, close button | Đã hiểu |
| Move all button (in the dialog row and in the blocked delete message) | Chuyển tất cả việc |
| Move all dialog title | Chuyển tất cả việc của nhóm "{name}" |
| Move all target choice (label) | Chuyển đến nhóm |
| Move all target options | Chưa phân nhóm, then every other group (the source group is not listed) |
| Move all confirmation message | Chuyển {n} việc trong {d} ngày sang nhóm "{target}"? Ngày, trạng thái hoàn thành và thứ tự của các việc được giữ nguyên. |
| Move all confirm button | Chuyển việc |
| Move all cancel button | Hủy |
| Move all done notice | Đã chuyển {n} việc sang nhóm "{target}". |
| Move all error, nothing saved | Không thể lưu thay đổi. Chưa có việc nào được chuyển. |
| Move all, group has no tasks (button inactive hint) | Nhóm này chưa có việc nào. |
| Section header count | {done}/{total} |
| Section toggle accessible name | Nhóm {name} {done}/{total} việc đã hoàn thành (the visible "{name} {done}/{total}" stays one unbroken piece) |
| Filter label | Lọc theo nhóm |
| Filter option, all | Tất cả nhóm |
| Filter option, ungrouped | Chưa phân nhóm |
| Filter empty state, a group | Ngày này chưa có việc nào trong nhóm "{name}". |
| Filter empty state, ungrouped | Ngày này không có việc nào chưa phân nhóm. |
| Notice, task added to a group hidden by the filter | Đã thêm việc vào nhóm "{name}". Nhóm này đang được ẩn bởi bộ lọc. |
| Error, empty group name | Vui lòng nhập tên nhóm. |
| Error, group name too long | Tên nhóm tối đa 30 ký tự. |
| Error, duplicate group name | Tên nhóm này đã có rồi. |
| Error, too many groups | Tối đa 20 nhóm. Hãy xóa bớt một nhóm trước khi tạo thêm. |

## Acceptance criteria

### The group

R1. THE SYSTEM SHALL keep one list of groups shared by all days. Each group has a unique id, a name, a colour, and a creation time, and the list is kept in creation order.

R2. THE SYSTEM SHALL let each task belong to at most one group. A task with no group is called ungrouped.

R3. WHEN a group name is entered (create or rename) THE SYSTEM SHALL trim leading and trailing spaces and keep the name as typed otherwise, including Vietnamese diacritics and emoji.

R4. IF the group name is empty or only spaces THEN THE SYSTEM SHALL not save it and SHALL show the "empty group name" error.

R5. IF the group name is longer than 30 characters after trimming, counted as code points after NFC normalisation (the same rule as task text) THEN THE SYSTEM SHALL not save it and SHALL show the "group name too long" error.

R6. IF the group name equals the name of another group, ignoring upper and lower case and after NFC normalisation, or equals "Chưa phân nhóm" in the same way, THEN THE SYSTEM SHALL not save it and SHALL show the "duplicate group name" error. Renaming a group to its own current name, or to the same name with different letter case, is allowed.

R7. IF 20 groups already exist and the owner tries to create another THEN THE SYSTEM SHALL not create it and SHALL show the "too many groups" error.

R8. WHEN the owner starts typing in a group name field after an error THE SYSTEM SHALL remove that error message.

### Group colour

R9. THE SYSTEM SHALL offer exactly 6 colours for a group, in this order: yellow (Vàng), pink (Hồng), green (Xanh lá), blue (Xanh dương), orange (Cam), purple (Tím). Each is a soft highlighter tone that suits the paper notebook design. "Chưa phân nhóm" has no colour and uses the neutral notebook style.

R10. WHEN a group is created THE SYSTEM SHALL give it the next colour in the order above, continuing from the colour of the most recently created group and wrapping around after the sixth. The owner can change it later (R36). Two groups may share a colour.

R11. THE SYSTEM SHALL show a group's colour as a highlighter band or tab on its section header, and as a small swatch next to its name in the filter and in the manage dialog, where the select cannot show colour it shows the name only. The group name is always shown as text, so colour is never the only cue.

R12. THE SYSTEM SHALL keep all text on a coloured header at a contrast ratio of at least 4.5 to 1 against the colour, in light mode and in dark mode, and keep the colour swatch visible against the page with at least 3 to 1 contrast against its surroundings or an outline.

R13. THE SYSTEM SHALL give each colour choice in the dialog an accessible name from the colour table, so that the colour can be picked with the keyboard and a screen reader.

### Creating a group on the fly

R14. THE SYSTEM SHALL show a group choice next to the add input, listing "Chưa phân nhóm", then every group in creation order, then "Nhóm mới...". THE SYSTEM SHALL use "Chưa phân nhóm" as the choice when the page loads.

R15. WHEN the owner chooses "Nhóm mới..." THE SYSTEM SHALL show a name input and a "Tạo nhóm" button next to the choice and move focus to the name input. The colour is assigned by R10, so no colour picker is shown here.

R16. WHEN the owner presses "Tạo nhóm" or the Enter key in the name input with a valid name THE SYSTEM SHALL create the group, select it as the group choice, hide the name input, and move focus to the add input. It SHALL not create a task.

R17. WHEN the owner presses the Escape key in the name input THE SYSTEM SHALL hide the name input, return the group choice to its previous value, and move focus to the group choice. Nothing is created.

R18. IF the name is not valid THEN THE SYSTEM SHALL keep the name input open with the matching error and create nothing (R4 to R7).

### Adding a task with a group

R19. WHEN the owner adds a task THE SYSTEM SHALL save it with the group currently chosen in the add form (or no group), with every other rule unchanged: date is the viewed day (day-navigation R16), text is validated as before, and the new task goes to the end of its section.

R20. WHEN a task has been added THE SYSTEM SHALL keep the same group chosen in the add form, so that several tasks can be added to the same group, and keep focus on the add input.

R21. IF the chosen group no longer exists THEN THE SYSTEM SHALL save the new task as ungrouped and set the choice back to "Chưa phân nhóm".

R22. WHEN a task is added to a collapsed section THE SYSTEM SHALL expand that section so the new task is visible.

### Moving a task between groups

R23. WHEN the owner presses Sửa on a task THE SYSTEM SHALL show, in the edit form, a group choice with the task's current group selected, next to the text input, in addition to the Save and Cancel buttons.

R24. WHEN the owner presses Lưu or Enter in edit mode with valid text THE SYSTEM SHALL save the new text and the chosen group together, keep the task's done state and date, and show the task in its new section. Within a section tasks are always in creation order, so a moved task takes the place its creation time gives it, not the end of the section.

R25. WHEN the owner presses Hủy or Escape in edit mode THE SYSTEM SHALL keep the old text and the old group.

R26. IF the text is not valid when saving THEN THE SYSTEM SHALL keep the task in edit mode and change neither the text nor the group (same as `daily-task-log` R15).

R27. THE SYSTEM SHALL allow moving a task on any viewed day, past, today, or future.

R28. WHEN a task is moved to another group THE SYSTEM SHALL expand the section it lands in, keep keyboard focus on the Sửa button of that task in its new place, and announce the new section name to screen readers. IF the filter is on and the new group is not the filtered one THEN the task leaves the view and focus moves to the next visible row, else the previous one, else the add input.

### Showing groups in the day list

R29. WHEN a day is shown THE SYSTEM SHALL list that day's tasks in sections. Each section has a header with the group name, its colour, the count of done and total tasks of that group on that day, and a toggle button. Sections follow the order the groups were created. The "Chưa phân nhóm" section comes last.

R30. THE SYSTEM SHALL show a section only if it has at least one task on the viewed day, and SHALL not show empty sections, except as stated in R44.

R31. IF none of the tasks of the viewed day belongs to a group and the filter is on "Tất cả nhóm" THEN THE SYSTEM SHALL show the list without any section header, looking exactly as it does today.

R32. THE SYSTEM SHALL keep tasks inside each section in creation order, oldest first, with done tasks staying in place. The creation order of tasks never depends on their group.

R33. WHEN a task is ticked or unticked THE SYSTEM SHALL update the count in its section header and the summary line, and keep the task in its place.

R34. WHEN the day changes by moving, picking a date, or loading THE SYSTEM SHALL build the sections for the new day only, using the same rules.

### Colour and rename in the manage dialog

R35. THE SYSTEM SHALL provide a "Quản lý nhóm" button that opens a dialog titled "Nhóm việc". The dialog lists every group in creation order, each showing its colour swatch and name with Sửa and Xóa buttons, and shows "Bạn chưa có nhóm nào." when there are none. The button is reachable on every day.

R36. WHEN the owner presses Sửa on a group in the dialog THE SYSTEM SHALL turn the name into an input with the current name, show the 6 colour choices (labelled "Màu nhóm") with the current colour selected, and show Lưu and Hủy buttons. Lưu or Enter saves a valid name (R3 to R6) and the chosen colour, Hủy or Escape keeps the old name and colour. Only one group is edited at a time.

R37. WHEN a group is renamed or recoloured THE SYSTEM SHALL show the new name and colour everywhere (headers, choices, filter) for all its tasks on all days, and SHALL not change the tasks.

R38. WHEN the owner closes the dialog with "Đóng" or Escape THE SYSTEM SHALL return focus to the "Quản lý nhóm" button and refresh the day list, the group choices, and the filter.

### Collapsing sections

R39. WHEN the owner presses the toggle button of a section header THE SYSTEM SHALL collapse the section (hide its task rows, keep the header with name and counts) or expand it again. THE SYSTEM SHALL mark the button with `aria-expanded` and make it usable with Enter and Space. "Chưa phân nhóm" can be collapsed too, but only when at least one other section is shown.

R40. THE SYSTEM SHALL remember the collapsed or expanded state of each section per group, the same on every day, across page reloads. New groups start expanded. A collapsed section still counts in the summary line, the progress mark, and the stamp (R50).

R41. WHILE the filter selects one group THE SYSTEM SHALL show that group's section always expanded and without a toggle, and SHALL leave the remembered collapsed state unchanged.

### Filter by group

R42. THE SYSTEM SHALL show a filter ("Lọc theo nhóm", a native select) directly above the task list, below the summary, once at least one group exists. Its options are "Tất cả nhóm", "Chưa phân nhóm", then every group in creation order. The default is "Tất cả nhóm". Before any group exists the filter is not shown.

R43. WHEN the owner chooses a group or "Chưa phân nhóm" THE SYSTEM SHALL show only that section's tasks of the viewed day. WHEN the owner chooses "Tất cả nhóm" THE SYSTEM SHALL show all sections again.

R44. IF the filter is on a group or on "Chưa phân nhóm" and the viewed day has no task in it THEN THE SYSTEM SHALL show the matching filter empty state text (a group with its name, or ungrouped), even when other groups have tasks on that day. IF the viewed day has no tasks at all THEN THE SYSTEM SHALL show the usual empty state of that kind of day.

R45. THE SYSTEM SHALL keep the chosen filter while the owner moves between days, so that a group can be followed across days, and SHALL reset it to "Tất cả nhóm" when the page is reloaded.

R46. WHEN the owner chooses a group in the filter THE SYSTEM SHALL also set the group choice of the add form to that group, so that new tasks go where the owner is looking. Choosing "Tất cả nhóm" leaves the add choice as it is.

R47. IF the owner adds a task to a group that the filter hides THEN THE SYSTEM SHALL save the task as chosen, keep the filter, and show the "task added to a hidden group" notice in a polite live region.

R48. IF the filtered group is renamed THEN THE SYSTEM SHALL keep it selected with the new name. IF it is removed (see R51, possible only when it has no tasks) THEN THE SYSTEM SHALL reset the filter to "Tất cả nhóm".

R49. THE SYSTEM SHALL apply the filter to the display only. It SHALL not change any task or the stored data.

### Summary, progress, and stamp

R50. THE SYSTEM SHALL keep the summary line "Đã hoàn thành {done}/{total} việc", the progress mark, and the star stamp as whole day measures that count all tasks of the viewed day, in every group and ungrouped, whatever the filter or the collapsed state. Section counts are shown only in the section headers. WHEN every task of the viewed day is done THE SYSTEM SHALL show the day stamp as in `day-navigation` R14. THE SYSTEM SHALL not show a stamp for a single group.

### Deleting groups

R51. WHEN the owner presses Xóa on a group that has no tasks on any day THE SYSTEM SHALL ask for confirmation with the "delete group" message and the buttons "Xóa nhóm" and "Giữ lại". "Xóa nhóm" removes the group. "Giữ lại" or Escape closes the confirmation and keeps the group.

R52. WHEN the owner presses Xóa on a group that still has at least one task on any day, past, today, or future, done or not done, THE SYSTEM SHALL not delete the group and SHALL show the "delete blocked" message with the number of tasks (n) and the number of different days that hold them (d), with the buttons "Xem các việc này", "Chuyển tất cả việc" (R67), and "Đã hiểu". The Xóa button stays available to the keyboard (it is not removed), and the dialog closes with Escape or "Đã hiểu".

R53. WHEN the owner presses "Xem các việc này" THE SYSTEM SHALL close the dialogs, set the filter to that group (R46 also applies), and show the day closest to today that holds a task of the group: the most recent such day up to and including today, else the earliest such day after today. The address hash is updated as for any day move (day-navigation R22 to R25).

R54. THE SYSTEM SHALL let the owner empty a group by moving its tasks one by one (R23 to R24) or all at once (R67 to R72). WHEN the last task has left the group THE SYSTEM SHALL allow Xóa as in R51. THE SYSTEM SHALL never delete or move tasks as a side effect of deleting a group.

### Persistence, migration, and compatibility

R55. WHEN a group is created, renamed, recoloured, or deleted, or a task is added or moved, THE SYSTEM SHALL save the change to localStorage straight away, before the next user action is accepted.

R56. THE SYSTEM SHALL store groups under a new key `daily-todo:groups:v1` as a JSON array of `{ id, name, color, createdAt }`, where `color` is one of six fixed codes. It SHALL store a task's group as an optional `groupId` field on the task in the existing key `daily-todo:tasks:v1`. The task shape of `daily-task-log` stays valid and unchanged. It SHALL store the collapsed state in a small separate key `daily-todo:ui:v1`, as a list of group ids (and a code for ungrouped) that are collapsed.

R57. WHEN the page loads and a stored task has no `groupId`, or a null `groupId` THE SYSTEM SHALL treat it as ungrouped. No migration step is needed and no stored task is rewritten, changed, or dropped because it has no group.

R58. WHEN the page loads and a stored task has a `groupId` that matches no group THE SYSTEM SHALL show the task as ungrouped and keep it. The task is never dropped.

R59. IF the stored groups value is missing, empty, or cannot be read as valid data THEN THE SYSTEM SHALL start with no groups and no error message, and keep every task. IF the value is present but not valid THEN THE SYSTEM SHALL copy the raw value once to `daily-todo:groups:v1:corrupt` (best effort), as the task store does. Group items that fail the shape check (`id` non empty string, `name` non empty string, `createdAt` finite number) are dropped. A group whose `color` is missing or not one of the six codes is kept and shown with the first colour (yellow).

R60. IF the stored `daily-todo:ui:v1` value is missing or unreadable, or lists ids that match no group, THEN THE SYSTEM SHALL ignore it, show all sections expanded, and show no error.

R61. IF localStorage is unavailable, full, or blocked THEN THE SYSTEM SHALL behave as in `daily-task-log` R26 for groups too: keep working in memory, show the storage message, and never overwrite stored data after a failed read.

### Moving all tasks of a group

R67. THE SYSTEM SHALL show a "Chuyển tất cả việc" button on each group row in the "Quản lý nhóm" dialog, and in the "delete blocked" message (R52) next to "Xem các việc này" and "Đã hiểu". IF the group has no tasks THEN the button in the dialog row is inactive (`aria-disabled="true"`, with the "Nhóm này chưa có việc nào." hint) and the blocked message does not occur.

R68. WHEN the owner presses "Chuyển tất cả việc" THE SYSTEM SHALL open a dialog titled "Chuyển tất cả việc của nhóm "{name}"" with a target choice labelled "Chuyển đến nhóm". The target choice lists "Chưa phân nhóm" and every group except the source group, with "Chưa phân nhóm" selected first. THE SYSTEM SHALL ask for confirmation with the "move all" message stating the number of tasks (n), the number of different days (d) and the target name, and the buttons "Chuyển việc" and "Hủy". "Hủy" or Escape closes the dialog and changes nothing.

R69. WHEN the owner presses "Chuyển việc" THE SYSTEM SHALL move every task of the source group, on every day, past, today, or future, done or not done, to the chosen target (a group or ungrouped). Each task keeps its text, done state, date, creation time, and id, and only its `groupId` changes. Because tasks are shown in creation order, the moved tasks take the places their creation times give them in the target section (R24 and R32).

R70. THE SYSTEM SHALL make the move all or nothing. THE SYSTEM SHALL prepare the whole change in memory and write it with a single write of the tasks key, and SHALL only accept the change in memory and on screen when that write succeeds. IF the write fails THEN THE SYSTEM SHALL leave every task in its source group, in memory and in storage, and SHALL show the "move all error" message.

R71. WHEN the move succeeded THE SYSTEM SHALL close the dialogs, refresh the day list, the group choices, and the filter, show the "move all done" notice in a polite live region, expand the target section if it is shown, and return focus to the "Quản lý nhóm" button. The source group is kept, now empty, so the owner can delete it with Xóa (R51). IF the filter was on the source group THEN the filter stays on it and shows its empty state (R44).

R72. IF the group chosen in the add form was the source group THEN THE SYSTEM SHALL keep it chosen (the group still exists). Moving all tasks never deletes or renames a group and never changes the colour or the order of groups.

### Usability

R62. THE SYSTEM SHALL make every group control usable with the keyboard alone: the group choice (native select), the name input, "Tạo nhóm", "Quản lý nhóm", the colour choices, the filter, the section toggles, and the dialog buttons, in a logical Tab order, with Enter to confirm and Escape to cancel, each with its Vietnamese accessible name from the table.

R63. THE SYSTEM SHALL give each section header a heading role containing the toggle button, with the accessible name "Nhóm {name} {done}/{total} việc đã hoàn thành" (for example "Nhóm Công ty 1/3 việc đã hoàn thành"). The name is the visible text "{name} {done}/{total}" with visually hidden words added before and after it, and the visible text stays one unbroken piece of the name, so that a screen reader user can jump between sections and a voice control user can activate the toggle by saying what they see.

R63a. THE SYSTEM SHALL give every control an accessible name that contains its visible text as one unbroken piece (WCAG 2.5.3 Label in Name). Extra context is added around the visible text, never in place of it or in the middle of it.

R64. THE SYSTEM SHALL fit a 360 pixel wide phone screen without horizontal scrolling, with all new controls (toggle, filter, colour choices, buttons) at least 44 by 44 pixels to tap. On a phone the group choice and the add input may sit on two lines. The swipe actions of task rows keep working inside sections.

R65. THE SYSTEM SHALL show group names and every other group text safely as plain text, so that a name such as `<b>abc</b>` is displayed exactly as typed.

R66. THE SYSTEM SHALL show the section headers, colours, filter, and dialog in the paper notebook style of the approved design, in light and dark mode, with the visual design to be agreed in the UX step. Collapse and expand motion is disabled under reduced motion.

## Non functional requirements

1. Performance: WHEN the owner performs any action (including collapse, filter, and move) with up to 200 tasks on the viewed day and up to 20 groups, the screen updates in under 100 ms on a typical laptop or phone.
2. Security and data protection: no data leaves the browser, no network calls, no tracking. Group names are always rendered with `textContent` or `value`, never as markup. The colour code from storage is only used to pick one of six known styles, never inserted as markup or a raw style. The existing Content-Security-Policy stays unchanged.
3. Reliability: a failed save never removes or corrupts tasks or groups saved earlier. No action in this feature can delete a task, except the existing task delete. An older copy of the app that does not know `groupId` must not crash on the new data.
4. Backward compatibility: data saved before this feature loads with all tasks present and ungrouped. The backup file of the later `backup-export-import` feature should carry the groups and tasks keys, and this is noted in the backlog.
5. Cache safety: THE SYSTEM SHALL load its stylesheet and scripts through links that carry a version query (for example `design-system.css?v=1.3.0`, and the entry script the same way), and the version SHALL change with every release, so that a release never mixes a cached old stylesheet with new markup. Internal module imports use the same version value so that no old module is reused beside a new one. A test or release check confirms that every asset reference in `index.html` carries the same version value.
6. Accessibility: colour is never the only cue for a group, and text contrast meets the values in R12 in light and dark mode.
7. Compatibility: works in the current versions of Chrome, Safari, Firefox, and Edge, on desktop and mobile. Native selects are used for the group choice and the filter, so the look of their lists follows each browser.
8. Language: all visible text and accessible names are Vietnamese, in Unicode.

## Out of scope

Ideas left out to keep this feature small for a personal tool. Each can be added later.

1. Choosing any colour from a full picker, more than 6 colours, custom colours, and icons.
2. A "collapse all" and "expand all" button.
3. Remembering the filter across reloads, and a filter on more than one group at once.
4. Searching tasks by text (feature `search-tasks`) and a filter on done or not done.
5. Reordering groups or tasks by drag and drop, and sorting groups by name.
6. Groups per day, or a different set of groups for each day.
7. Putting one task in several groups, sub groups, and nested groups.
8. Moving a chosen subset of tasks at once, and merging groups as a separate action (moving all tasks of a group, R67 to R72, covers the practical need).
9. Group progress stamps, group level reports, and per group statistics beyond the done and total count in the header.
10. Default group per weekday, recurring groups, and carry over by group (belongs to `carry-over-unfinished`).
11. Showing groups with no tasks on a day (except when selected in the filter).
12. Undo after deleting a group, and a trash bin.
13. Backup, export, and import of groups (belongs to `backup-export-import`).
14. Listing every day that holds a group's tasks in the blocked delete message. Only the counts and a jump to the nearest day are shown.

## Open questions

Remaining items are small and have recommended defaults. See the hand off report.
