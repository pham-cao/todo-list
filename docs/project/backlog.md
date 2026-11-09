# Backlog: daily-todo

## Product summary

Problem: The owner needs a simple place on the web to log the things they need to do each day, and today there is no single place for it.
Target user: One person using it for personal daily planning (single user, no sharing).
Success measures:
1. The user can add a task for today in a few seconds, with no setup.
2. The user can see today's tasks at a glance and tick them off as done.
3. The user can look back at what was planned on any earlier day.
4. Tasks are still there after closing and reopening the browser.
5. The owner can recover their log if the browser data is lost (added in revision 2).

## Status of the first two features

Both MVP features are shipped and live at https://pham-cao.github.io/todo-list/.

## Features in priority order

1. `daily-task-log`
   - Goal: Add, view, complete, edit, and delete tasks for the current day on one screen.
   - Scope: MVP, shipped
   - has_ui: true
   - Dependencies: none

2. `day-navigation`
   - Goal: Move to a previous or next day (or pick a date) to see and add tasks for that day.
   - Scope: MVP, shipped
   - has_ui: true
   - Dependencies: daily-task-log

3. `task-groups` (in progress, requested by the owner)
   - Goal: Let the owner create their own coloured groups when needed (also while adding a task), put each task in one group, and see each day's list in collapsible sections that can be filtered by group. A group with tasks cannot be deleted.
   - Why it helps: The owner wants tasks split into groups so they are easier to manage.
   - Size: M to L
   - Scope: later, now in progress (chosen by the owner ahead of the ranked list below)
   - has_ui: true
   - Dependencies: daily-task-log, day-navigation
   - Backend: not needed.
   - Note: Adds an optional `groupId` to tasks and a new `daily-todo:groups:v1` key. Existing tasks load as ungrouped with no migration. Backup files (feature 4) should carry both keys.

4. `backup-export-import` (recommended next after task-groups)
   - Goal: Download all tasks as one file and restore them from that file, so the log survives a cleared browser, a new phone, or a new laptop.
   - Why it helps: All data lives in one browser's localStorage and there is no copy anywhere else. This is the biggest risk to the owner's trust in the tool, and it also gives a manual way to move data between devices without any backend.
   - Size: S to M
   - Scope: later (next up)
   - has_ui: true
   - Dependencies: daily-task-log
   - Backend: not needed (file download and file picker in the browser).
   - Note: Import needs a clear rule for what happens to tasks already in the browser (see open questions).

5. `carry-over-unfinished`
   - Goal: Offer to move unfinished tasks from a past day to today.
   - Why it helps: The most common daily routine is "what did I not finish yesterday". Today the owner must retype each task.
   - Size: S to M
   - Scope: later
   - has_ui: true
   - Dependencies: day-navigation
   - Backend: not needed.

6. `week-overview`
   - Goal: Show the current week (and earlier weeks) as a simple list of days with the done and total count for each, and open a day with one tap.
   - Why it helps: Answers "what did I do this week" for stand ups and weekly reports, which is the main reason to keep a daily log. Replaces pressing the previous day button many times.
   - Size: M
   - Scope: later
   - has_ui: true
   - Dependencies: day-navigation
   - Backend: not needed (data is already in memory).

7. `search-tasks`
   - Goal: Type a word and see matching tasks from all days, each with its date, and open that day.
   - Why it helps: Finds "when did I do the invoice thing" without scrolling day by day. Becomes more useful as the log grows.
   - Size: M
   - Scope: later
   - has_ui: true
   - Dependencies: day-navigation
   - Backend: not needed.

8. `offline-install`
   - Goal: Let the owner install the page on a phone or laptop home screen and open it with no network.
   - Why it helps: Opening the log quickly from the phone is the main daily use. The data is already local, so offline use costs little.
   - Size: S to M
   - Scope: later
   - has_ui: false (an install button is optional; the browser provides its own prompt)
   - Dependencies: daily-task-log
   - Backend: not needed (web manifest and service worker on GitHub Pages, under the /todo-list/ subpath).
   - Note: This reverses the earlier out of scope line about offline mode, so it needs the owner's confirmation. Safari and iOS behaviour has never been tested and should be checked first.

9. `task-notes-and-priority`
   - Goal: Let each task carry an optional note and a simple priority label.
   - Why it helps: Useful for detail, but the owner has not asked for it, so it ranks below the items that protect or reuse the existing log.
   - Size: M
   - Scope: later
   - has_ui: true
   - Dependencies: daily-task-log
   - Backend: not needed. Changes the stored task shape, so backup files should carry a version number if backup ships first.

## Ideas considered and not recommended now

1. Recurring daily tasks: needs repeat rules and a decision on how to show missed days. Carry over covers most of the need at a fraction of the cost. Revisit after carry-over is used for a few weeks.
2. Short daily review line: small, but not requested. Easy to add later as part of task-notes-and-priority.
3. Quick reorder of tasks: the owner chose creation order for a stable list (see decisions.md). Revisit only if priority is added.
4. Sync across devices and login: needs a backend, which conflicts with the decisions to keep data in the browser and have no login. This is a separate product decision. Backup export and import is the no backend alternative.

## Out of scope

1. User accounts, login, and multi user sharing.
2. Automatic syncing across devices (needs a backend). Manual file backup and restore is in the backlog.
3. Reminders, notifications, and calendar integration.
4. Tags, projects, and reporting dashboards beyond the simple week overview. (Owner created task groups are the one exception, see `task-groups`.)
5. Native mobile apps (the web page should still be usable on a phone browser, and offline install is a candidate).

## Decisions

1. Data is stored in the browser only (localStorage); there is no backend.
2. No login.
3. All screen text is in Vietnamese.
4. The day boundary follows the browser's local timezone.

## Follow ups after daily-task-log

1. Give each row checkbox an accessible name that includes the task text (aria-labelledby), so VoiceOver users hear which task they tick.
2. Run the e2e suite on WebKit (Safari) on a machine with the WebKit system libraries.

## Follow ups after day-navigation

1. Check the native calendar popup (TC-day-navigation-T5-09) in headed Chrome, Firefox, and Edge on the deployed site.
2. Spot check Safari and iOS on the deployed site.
3. Two browser tabs on the same day overwrite each other because storage is read and written whole. A small fix (reload data when the storage event fires) is worth doing before or with backup-export-import, since import makes data loss more costly.
