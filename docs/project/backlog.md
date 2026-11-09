# Backlog: daily-todo

## Product summary

Problem: The owner needs a simple place on the web to log the things they need to do each day, and today there is no single place for it.
Target user: One person using it for personal daily planning (single user, no sharing).
Success measures:
1. The user can add a task for today in a few seconds, with no setup.
2. The user can see today's tasks at a glance and tick them off as done.
3. The user can look back at what was planned on any earlier day.
4. Tasks are still there after closing and reopening the browser.

## Features in priority order

1. `daily-task-log`
   - Goal: Add, view, complete, edit, and delete tasks for the current day on one screen.
   - Scope: MVP
   - has_ui: true
   - Dependencies: none

2. `day-navigation`
   - Goal: Move to a previous or next day (or pick a date) to see and add tasks for that day.
   - Scope: MVP
   - has_ui: true
   - Dependencies: daily-task-log

3. `carry-over-unfinished`
   - Goal: Offer to move unfinished tasks from a past day to today.
   - Scope: later
   - has_ui: true
   - Dependencies: day-navigation

4. `task-notes-and-priority`
   - Goal: Let each task carry an optional note and a simple priority label.
   - Scope: later
   - has_ui: true
   - Dependencies: daily-task-log

## Out of scope

1. User accounts, login, and multi user sharing.
2. Syncing across devices and offline mode.
3. Reminders, notifications, and calendar integration.
4. Recurring tasks, tags, projects, and reporting dashboards.
5. Native mobile apps (the web page should still be usable on a phone browser).

## Decisions

1. Data is stored in the browser only (localStorage); there is no backend.
2. No login.
3. All screen text is in Vietnamese.
4. The day boundary follows the browser's local timezone.

## Follow ups after daily-task-log

1. Give each row checkbox an accessible name that includes the task text (aria-labelledby), so VoiceOver users hear which task they tick.
2. Run the e2e suite on WebKit (Safari) on a machine with the WebKit system libraries.
