# Requirements: day-navigation

## Goal

Let the owner move to the previous or next day, pick any date, and jump back to today, so that they can look at what they did on an earlier day (for example "what did I do yesterday?") and plan ahead for a later day. On every day the owner can do the same things as on today: add, tick, edit, and delete tasks. Tasks stay in the browser only, there is no backend and no login, all screen text is Vietnamese, and the day follows the browser's local timezone. This feature reuses the data saved by `daily-task-log`, where every task already carries its local calendar date, so no data migration is needed.

## User roles

1. Owner: the single person who uses the page for personal daily planning. There are no other roles.

## User stories

1. As the owner, I want to move to the previous day, so that I can see what I did yesterday.
2. As the owner, I want to move to the next day, so that I can see or prepare what is planned for tomorrow.
3. As the owner, I want to pick a date from a calendar, so that I can reach a day far from today without pressing a button many times.
4. As the owner, I want a quick way back to today, so that I can return to my current day in one step.
5. As the owner, I want to add and change tasks on the day I am viewing, so that I can fix up a past day or plan a future day.
6. As the owner, I want the day I am viewing to stay the same when I reload the page, so that I do not lose my place.

## Vietnamese UI text

New and changed text is exact. Text not listed here stays as in `daily-task-log` (summary line, Add button, Edit, Save, Cancel, Delete, delete dialog, error messages, storage message, weekday names).

| Key | Text |
| --- | --- |
| Previous day button (accessible name and tooltip) | Xem ngày trước |
| Next day button (accessible name and tooltip) | Xem ngày sau |
| Back to today button (visible text) | Về hôm nay |
| Date picker (accessible name) | Chọn ngày |
| Page title and heading, today | Việc cần làm hôm nay |
| Page title and heading, any other day | Việc cần làm |
| Date line, today | Hôm nay, {weekday}, {dd}/{mm}/{yyyy} (example: Hôm nay, Thứ Hai, 09/11/2026) |
| Date line, yesterday | Hôm qua, {weekday}, {dd}/{mm}/{yyyy} (example: Hôm qua, Chủ Nhật, 08/11/2026) |
| Date line, tomorrow | Ngày mai, {weekday}, {dd}/{mm}/{yyyy} (example: Ngày mai, Thứ Ba, 10/11/2026) |
| Date line, any other day | {weekday}, {dd}/{mm}/{yyyy} (example: Thứ Sáu, 06/11/2026) |
| Input placeholder, today | Bạn cần làm gì hôm nay? |
| Input placeholder, any other day | Bạn cần làm gì ngày này? |
| Empty state, today | Hôm nay chưa có việc nào. Hãy thêm việc đầu tiên nhé! |
| Empty state, past day | Ngày này chưa có việc nào được ghi lại. |
| Empty state, future day | Ngày này chưa có việc nào. Hãy thêm việc để chuẩn bị nhé! |

## Acceptance criteria

This feature changes four rules of `daily-task-log`: the page load view (its R1 to R3), the date given to a new task (its R6 and R24), and the midnight rule (its R25). The criteria below replace those rules. Everything else in `daily-task-log` stays as it is. In this document "viewed day" means the day whose tasks are on screen, and "today" means the current local calendar date of the browser.

### Moving between days

R1. WHEN the owner presses the previous day button THE SYSTEM SHALL show the day before the viewed day.

R2. WHEN the owner presses the next day button THE SYSTEM SHALL show the day after the viewed day. There is no limit to how far into the future the owner can move, apart from R9.

R3. WHEN the owner picks a date in the date picker THE SYSTEM SHALL show that day. The picker SHALL open on the viewed day.

R4. WHEN the owner presses the back to today button THE SYSTEM SHALL show today.

R5. WHILE the viewed day is today THE SYSTEM SHALL keep the back to today button visible but inactive (marked `aria-disabled="true"`, no action, and a muted look), so that keyboard focus is never lost.

R6. WHEN the viewed day changes THE SYSTEM SHALL update the heading, the date line, the input placeholder, the task list, the empty state, the summary line, and the progress mark to match the new day, using the text table above.

R7. WHEN the viewed day changes THE SYSTEM SHALL drop any unsaved edit, close any open delete confirmation, remove any error message under the add input, and keep the text the owner has already typed in the add input.

R8. WHEN the viewed day changes THE SYSTEM SHALL keep keyboard focus on the control the owner used (previous, next, back to today, or the picker), and SHALL announce the new date line to screen readers.

R9. IF the picker value is cleared or is not a real calendar date, or the day would fall outside the years 2000 to 2099, THEN THE SYSTEM SHALL keep showing the current viewed day and change nothing.

### Showing a day

R10. WHEN a day is shown THE SYSTEM SHALL list all tasks saved for that day, and only that day, in the order they were created (oldest first), with the same row look and the same done or not done difference as today.

R11. THE SYSTEM SHALL build the date line from the viewed day compared with today: "Hôm nay" for today, "Hôm qua" for the day before today, "Ngày mai" for the day after today, and only the weekday and date for every other day.

R12. WHEN a day has no tasks THE SYSTEM SHALL show the empty state text for that kind of day (today, past, or future) and no task rows.

R13. THE SYSTEM SHALL show the summary line and the progress mark for the viewed day only, counting only that day's tasks. The progress mark and summary stay hidden when the viewed day has no tasks.

R14. WHEN every task of the viewed day is done THE SYSTEM SHALL show the star stamp on any day, past, today, or future. WHEN the owner arrives on a day whose tasks are all done by moving, picking, or loading THE SYSTEM SHALL show the stamp without animation. The celebration animation plays only when a tick makes the viewed day complete.

### Working on any day

R15. THE SYSTEM SHALL allow the owner to add, tick, untick, edit, and delete tasks on any viewed day, past, today, or future, with the same rules, messages, and confirmation as in `daily-task-log`.

R16. WHEN the owner adds a task THE SYSTEM SHALL save it with the viewed day as its date (not the date of the moment of adding), place it at the end of that day's list, and keep its creation time as the real time of adding.

R17. WHEN the owner ticks, unticks, edits, or deletes a task THE SYSTEM SHALL change only that task and keep its date and its position unchanged.

R18. THE SYSTEM SHALL save every change on another day straight away, with the same storage failure behavior as in `daily-task-log`.

### Day change at midnight

R19. WHEN the local date changes while the page stays open and the owner returns to the page, AND the viewed day was the old today, THE SYSTEM SHALL show the new today, as `daily-task-log` does. Tasks of the old day remain stored.

R20. WHEN the local date changes while the page stays open and the owner returns to the page, AND the viewed day was not the old today, THE SYSTEM SHALL keep showing the same viewed day and SHALL recompute the heading, the date line wording, the placeholder, the empty state, and the back to today button state, because "Hôm qua", "Ngày mai", and "today" have moved. For example, a viewer of the next day who returns after midnight now sees the day as today with the today wording.

R21. WHEN the owner adds a task THE SYSTEM SHALL use the viewed day as the date (R16), even if midnight passed while the page was open. The wording check of R20 runs first so the screen is current before the task is added.

### Reload and address

R22. WHEN the owner moves to a day other than today THE SYSTEM SHALL put that date in the page address as a hash, in the form `#yyyy-mm-dd` (example: `#2026-11-08`), without reloading the page.

R23. WHEN the owner moves to today THE SYSTEM SHALL remove the hash so that the plain address always means today.

R24. WHEN the page loads or the hash changes (for example the owner reloads, opens a bookmark, or uses the browser Back button) THE SYSTEM SHALL show the day in the hash. IF the hash is missing, is not a real calendar date, or is outside the years 2000 to 2099 THEN THE SYSTEM SHALL show today and SHALL not show an error.

R25. WHEN the owner moves between days THE SYSTEM SHALL add one browser history entry for each move to a different day, so that the browser Back button returns to the day seen before.

R26. WHEN the page loads with a day in the hash THE SYSTEM SHALL focus the add input, as on today.

### Usability

R27. THE SYSTEM SHALL make previous day, next day, back to today, and the date picker usable with the keyboard alone (Tab to reach, Enter or Space to press, the native picker keys for the calendar), in a logical order after the heading and before the add input, each with its accessible name from the text table.

R28. THE SYSTEM SHALL keep the controls at least 44 by 44 pixels to tap and SHALL fit the screen at 360 pixels wide without horizontal scrolling.

R29. THE SYSTEM SHALL make it visible at a glance whether the owner is on today or on another day, through the heading, the date line wording, and the state of the back to today button (see R5, R6, R11), so that a task is not added to the wrong day by mistake.

## Non functional requirements

1. Performance: WHEN the owner moves to another day with up to 200 tasks on that day, the screen updates in under 100 ms. The data for all days is already in memory, so no extra storage read is needed.
2. Security and data protection: no data leaves the browser. The hash is read as text and validated as a date before use, and never inserted into the page as markup. Dates shown on screen are always built by the app, not copied from the address.
3. Reliability: moving between days never changes or deletes saved tasks. A failed save never removes tasks saved earlier.
4. Compatibility: works in the current versions of Chrome, Safari, Firefox, and Edge, on desktop and mobile. The native date picker is used, so the look of the calendar follows each browser.
5. Language: all visible text and accessible names are Vietnamese, in Unicode.
6. Hosting: the hash approach works on the GitHub Pages subpath with no server setting.

## Out of scope

1. Carrying unfinished tasks to another day (feature `carry-over-unfinished`).
2. Moving or copying a task to another day, dragging tasks between days, and bulk actions.
3. A month or week overview, calendar grid with task counts, search, and filters.
4. Keyboard shortcuts for changing the day (for example arrow keys on the page).
5. Showing tasks of several days at once.
6. Swipe left or right to change the day on phones.
7. Notes, priority, reminders, and notifications.

## Open questions

The defaults used above are listed in the hand off report so that they are easy to change.
