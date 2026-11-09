# Requirements: daily-task-log

## Goal

Give the owner one screen where they can add, view, complete, edit, and delete the tasks for the current day. Tasks are kept in the browser only (localStorage), there is no backend and no login, all screen text is in Vietnamese, and the day follows the browser's local timezone.

## User roles

1. Owner: the single person who uses the page for personal daily planning. There are no other roles.

## User stories

1. As the owner, I want to add a task for today in a few seconds, so that I do not forget it.
2. As the owner, I want to see all of today's tasks on one screen, so that I know what is planned at a glance.
3. As the owner, I want to mark a task as done and undo it, so that I can track my progress during the day.
4. As the owner, I want to edit the text of a task, so that I can fix typos or change plans.
5. As the owner, I want to delete a task, so that I can remove things I no longer need.
6. As the owner, I want my tasks to still be there after I close and reopen the browser, so that I can rely on the page.

## Vietnamese UI text

All text below is exact. Everything the user can see or hear (including placeholders, button names, and accessible labels) uses Vietnamese.

| Key | Text |
| --- | --- |
| Page title | Việc cần làm hôm nay |
| Date line | Hôm nay, {weekday}, {dd}/{mm}/{yyyy} (example: Hôm nay, Thứ Hai, 09/11/2026) |
| Input placeholder | Bạn cần làm gì hôm nay? |
| Add button | Thêm |
| Empty state | Hôm nay chưa có việc nào. Hãy thêm việc đầu tiên nhé! |
| Complete checkbox label | Đánh dấu hoàn thành |
| Edit button | Sửa |
| Save button (in edit mode) | Lưu |
| Cancel button (in edit mode) | Hủy |
| Delete button | Xóa |
| Delete confirmation message | Bạn có chắc muốn xóa việc này không? |
| Delete confirm button | Xóa việc |
| Delete cancel button | Giữ lại |
| Error, empty text | Vui lòng nhập nội dung công việc. |
| Error, text too long | Nội dung tối đa 200 ký tự. |
| Error, storage unavailable | Không thể lưu dữ liệu trên trình duyệt này. Công việc có thể bị mất khi bạn tải lại trang. |
| Summary line | Đã hoàn thành {done}/{total} việc |

Weekday names: Chủ Nhật, Thứ Hai, Thứ Ba, Thứ Tư, Thứ Năm, Thứ Sáu, Thứ Bảy.

## Acceptance criteria

### Viewing

R1. WHEN the page loads THE SYSTEM SHALL show the page title and the date line for the current day in the browser's local timezone.

R2. WHEN the page loads and today has saved tasks THE SYSTEM SHALL list all of today's tasks, and only today's tasks, in the order they were created (oldest first).

R3. WHEN the page loads and today has no tasks THE SYSTEM SHALL show the empty state message and no task rows.

R4. THE SYSTEM SHALL show for each task its text and its done or not done state, with a visible difference between the two (for example a ticked checkbox and struck through text).

R5. THE SYSTEM SHALL show the summary line with the number of completed tasks and the total number of today's tasks, and update it after every add, complete, undo, and delete.

### Adding

R6. WHEN the owner types text in the input and presses the Add button or the Enter key THE SYSTEM SHALL create a new not done task for today, place it at the end of the list, clear the input, and keep the input focused for the next task.

R7. IF the input is empty or contains only spaces when the owner tries to add THEN THE SYSTEM SHALL not create a task and SHALL show the "empty text" error message.

R8. IF the input text is longer than 200 characters after trimming leading and trailing spaces THEN THE SYSTEM SHALL not create a task and SHALL show the "text too long" error message.

R9. WHEN a task is created THE SYSTEM SHALL save the text trimmed of leading and trailing spaces, as typed otherwise (including Vietnamese diacritics and emoji).

R10. WHEN the owner starts typing again after an error message THE SYSTEM SHALL remove that error message.

### Completing

R11. WHEN the owner ticks the checkbox of a not done task THE SYSTEM SHALL mark it as done and keep it in its current position in the list.

R12. WHEN the owner unticks the checkbox of a done task THE SYSTEM SHALL mark it as not done.

### Editing

R13. WHEN the owner presses the Edit button on a task THE SYSTEM SHALL turn that task's text into an input prefilled with the current text, focus it, and show the Save and Cancel buttons.

R14. WHEN the owner presses Save or the Enter key in edit mode with valid text THE SYSTEM SHALL update the task text (trimmed), keep its done state and its position, and leave edit mode.

R15. IF the edited text is empty, only spaces, or longer than 200 characters THEN THE SYSTEM SHALL keep the task in edit mode, keep the old saved text unchanged, and show the matching error message from the table above.

R16. WHEN the owner presses Cancel or the Escape key in edit mode THE SYSTEM SHALL leave edit mode and keep the old text.

R17. WHILE a task is in edit mode THE SYSTEM SHALL still allow the owner to add new tasks and to work with other tasks, and SHALL allow only one task to be in edit mode at a time (opening edit on another task closes the first without saving).

### Deleting

R18. WHEN the owner presses the Delete button on a task THE SYSTEM SHALL ask for confirmation with the delete confirmation message and the two buttons "Xóa việc" and "Giữ lại".

R19. WHEN the owner presses "Xóa việc" THE SYSTEM SHALL remove that task permanently and update the list and the summary line.

R20. WHEN the owner presses "Giữ lại" or the Escape key in the confirmation THE SYSTEM SHALL close the confirmation and keep the task.

### Persistence and day boundary

R21. WHEN a task is added, edited, completed, undone, or deleted THE SYSTEM SHALL save the change to localStorage straight away, before the next user action is accepted.

R22. WHEN the owner closes and reopens the browser tab or window on the same browser and profile THE SYSTEM SHALL show the same tasks for the same day with the same text and done state.

R23. THE SYSTEM SHALL store each task with a unique id, its text, its done state, its creation time, and the local calendar date (format yyyy-mm-dd) of the day it belongs to, so that the day-navigation feature can reuse the same data.

R24. WHEN a task is created THE SYSTEM SHALL set its date to the current local calendar date of the browser at that moment.

R25. WHEN the local date changes while the page stays open (for example after midnight) and the owner returns to the page THE SYSTEM SHALL refresh the date line and show the list for the new current day, which will be empty if no tasks exist for it. Tasks of the previous day remain stored and are not deleted.

R26. IF localStorage is unavailable, full, or blocked (for example private browsing restrictions) THEN THE SYSTEM SHALL keep working with the tasks in memory for the current page session and SHALL show the "storage unavailable" error message in a visible place until the problem no longer occurs.

R27. IF the stored data is missing, empty, or cannot be read as valid data THEN THE SYSTEM SHALL start with an empty list and SHALL not show a technical error or crash.

### Usability

R28. THE SYSTEM SHALL be fully usable with the keyboard alone (Tab to move, Enter to add or save, Space to tick, Escape to cancel) and SHALL give every button and checkbox an accessible name from the Vietnamese text above.

R29. THE SYSTEM SHALL be usable on a phone browser screen width of 360 pixels without horizontal scrolling, with buttons large enough to tap (at least 44 by 44 pixels).

R30. THE SYSTEM SHALL show task text safely as plain text, so that text such as `<b>abc</b>` is displayed exactly as typed and never run as markup.

## Non functional requirements

1. Performance: WHEN the owner performs any action with up to 200 tasks for the day, the screen updates in under 100 ms on a typical laptop or phone, and the first view appears in under 1 second on a normal connection.
2. Security and data protection: no data leaves the browser. The page makes no network calls for task data, uses no login, and sets no tracking. Task text is always rendered as plain text (see R30).
3. Compatibility: works in the current versions of Chrome, Safari, Firefox, and Edge, on desktop and mobile.
4. Language: all visible text, labels, and messages are Vietnamese. The text is stored and displayed in Unicode so that Vietnamese diacritics are never corrupted.
5. Reliability: a failed save never removes or corrupts tasks that were saved earlier.

## Out of scope

1. Moving to other days, picking a date, and seeing or adding tasks for another day (feature `day-navigation`).
2. Carrying unfinished tasks to another day (feature `carry-over-unfinished`).
3. Notes, priority, tags, due times, and reordering of tasks (feature `task-notes-and-priority` and later).
4. Undo after delete, trash bin, and bulk actions such as "clear all done".
5. Accounts, sync across devices, import, export, reminders, and notifications.
6. Any language other than Vietnamese.

## Open questions

See the list in the hand off report. The defaults used in this document are marked below so that they are easy to change.

1. Maximum task length is 200 characters (R8, R15).
2. Tasks are ordered by creation time, oldest first, and done tasks stay in place (R2, R11).
3. Delete asks for confirmation (R18 to R20).
4. After midnight, the page switches to the new day when the owner returns to it (R25).
5. Editing is done in place with Save and Cancel buttons (R13 to R16).
