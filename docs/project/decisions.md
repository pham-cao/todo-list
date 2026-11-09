# Decision Log

Append only. One entry per answered question.

<!-- ## YYYY-MM-DD: <question>
Options: <a>, <b>, <c>
Choice: <choice> (by <user or PM>)
Reason: <one line> -->

## 2026-11-09: Where should task data be stored?
Options: Browser local storage only, Small server with a database
Choice: Browser local storage only (by user)
Reason: Simplest MVP with no backend.

## 2026-11-09: Is a login needed?
Options: No login, Simple single password login
Choice: No login (by user)
Reason: Personal single user tool.

## 2026-11-09: Which language should the UI text use?
Options: Vietnamese, English, Both
Choice: Vietnamese (by user)
Reason: Owner is a Vietnamese speaker.

## 2026-11-09: Mirror progress to Trello?
Options: No Trello, New board, Existing board
Choice: No Trello (by user)
Reason: status.yaml is enough for a personal project.

## 2026-11-09: Which timezone defines the "day" boundary?
Options: Browser local timezone, Fixed Asia/Ho_Chi_Minh
Choice: Browser local timezone (by PM)
Reason: Natural default for a browser only app; no server clock involved.

## 2026-11-09: Approve the backlog?
Options: Approve MVP only, Approve all four features, Request changes
Choice: Approve, build the two MVP features only (by user)
Reason: Ship daily-task-log and day-navigation first; later features stay in the backlog.

## 2026-11-09: daily-task-log: How should deleting a task work?
Options: Ask for confirmation, Delete immediately with undo, Delete immediately
Choice: Ask for confirmation with "Xóa việc" and "Giữ lại" (by user)
Reason: No backend copy to recover from.

## 2026-11-09: daily-task-log: How are tasks ordered?
Options: Creation order with done tasks in place, Done tasks move to bottom, Newest first
Choice: Creation order, oldest first, done tasks stay in place (by user)
Reason: Stable list layout.

## 2026-11-09: daily-task-log: What happens at midnight while the page is open?
Options: Refresh to the new day when the owner returns, Timer at midnight, Manual reload only
Choice: Refresh to the new day when the owner returns to the page (by user)
Reason: Avoids saving tasks to the wrong day without a timer.

## 2026-11-09: daily-task-log: How is editing done?
Options: In place with Sửa, Lưu, Hủy buttons, Double click, Edit dialog
Choice: In place with Sửa, Lưu, Hủy buttons (by user)
Reason: Works well on phones.

## 2026-11-09: daily-task-log: Maximum task length?
Options: 200 characters, 100 characters, No limit
Choice: 200 characters (by PM)
Reason: Sensible default already in the spec; easy to change later.

## 2026-11-09: daily-task-log: Show the weekday in the date line?
Options: Yes ("Hôm nay, Thứ Hai, 09/11/2026"), Date only
Choice: Yes, as specified (by PM)
Reason: Friendlier display; reused by day-navigation.

## 2026-11-09: Approve daily-task-log requirements?
Options: Approve, Request changes
Choice: Approve (by user)
Reason: Scope and defaults accepted.

## 2026-11-09: daily-task-log UX: Show a character counter?
Options: No counter, Show from 180 characters, Always show
Choice: No counter, rely on the error message (by user)
Reason: Cleaner screen.

## 2026-11-09: daily-task-log UX: Edit input for long tasks?
Options: Single line input with Enter to save, Growing text box
Choice: Single line input, Enter saves (by user)
Reason: Simple and matches the requirements.

## 2026-11-09: daily-task-log UX: Unsaved edit when the day changes?
Options: Drop the unsaved edit, Hold the day switch until save or cancel
Choice: Drop the unsaved edit (by PM)
Reason: Rare edge case; simplest defined behavior.

## 2026-11-09: daily-task-log UX: First design review
Options: Approve, Request changes
Choice: Request changes (by user): the user found the visual design unattractive and asked whether a UI/UX skill was used. Redesign required.
Reason: Visual quality below expectation.

## 2026-11-09: daily-task-log UX: Visual direction for the redesign
Options: Modern like Todoist / Things, Bold cards with gradients, Minimal dark mode, Playful pastel
Choice: Modern like Todoist / Things (by user)
Reason: Clean, generous whitespace, refined typography, round animated checkboxes, icon actions on hover or swipe.

## 2026-11-09: daily-task-log UX: Row actions on phones?
Options: Two muted icons, Swipe left to reveal, One "Tùy chọn" overflow button
Choice: Swipe left to reveal (by user)
Reason: Wider rows on small screens.

## 2026-11-09: daily-task-log UX: Celebrate when all tasks are done?
Options: Brief glow on the full ring, No
Choice: Brief glow on the full ring, no new text (by user)
Reason: Small moment of delight at the end of the day.

## 2026-11-09: daily-task-log UX: Dark mode?
Options: Later, Now
Choice: Now, following the system light or dark setting (by user)
Reason: User preference.

## 2026-11-09: daily-task-log UX: Second design review
Options: Approve, Request changes
Choice: Request changes (by user); details pending.
Details (by user): the theme and style should look like a paper notebook (sổ ghi chú).

## 2026-11-09: daily-task-log UX: One time swipe hint on phones?
Options: Single peek animation on the first row the first time tasks exist, No hint
Choice: Single peek animation, no new text (by user)
Reason: Closes the swipe discoverability gap.

## 2026-11-09: daily-task-log UX: Line spacing for wrapped tasks on phones?
Options: Keep 44 px ruling, Tighter wrapped lines
Choice: Keep 44 px so text stays on the ruled lines (by user)
Reason: True to the notebook look.

## 2026-11-09: daily-task-log UX: Third design review (paper notebook v3)
Options: Approve, Request changes
Choice: Approve (by user)

## 2026-11-09: daily-task-log design: Which stack?
Options: Plain HTML, CSS and vanilla ES modules with no build, Minimal Vite
Choice: Plain HTML, CSS and vanilla ES modules, no build (by user)
Reason: One screen, least to maintain.

## 2026-11-09: daily-task-log design: Hosting after this feature?
Options: Local only, GitHub Pages
Choice: GitHub Pages (by user)
Reason: Open the app from a phone. All asset paths must be relative so the site works under a /<repo>/ subpath; deploy happens at release.

## 2026-11-09: daily-task-log design: Write to localStorage after a failed first read?
Options: No, memory only for the session, Yes
Choice: No, memory only for that session (by PM)
Reason: Protects earlier days' data (NFR5).

## 2026-11-09: daily-task-log design: Star stamp when a delete leaves all tasks done?
Options: Show the stamp without animation, Full celebration
Choice: Show the stamp without animation (by PM)
Reason: Celebration belongs to the tick that finishes the day.

## 2026-11-09: Approve daily-task-log design and tasks?
Options: Approve, Request changes
Choice: Approve, start coding (by user)

## 2026-11-09: daily-task-log T3: How to count task length for the 200 limit?
Options: Code points as is, Code points after NFC normalisation, Grapheme clusters (Intl.Segmenter)
Choice: Code points after NFC normalisation, store the trimmed original unchanged (by PM)
Reason: Pasted decomposed Vietnamese text would otherwise hit the limit early; one line fix. Grapheme counting for ZWJ emoji skipped as an edge case.

## 2026-11-09: daily-task-log T4: Handle QA low findings (favicon 404, missing [hidden] rule)?
Options: Fix now in T4, Defer to later FE tasks, Ignore
Choice: Fix now in T4: add `[hidden]{display:none !important}` to design-system.css and drop the inline workaround; add `<link rel="icon" href="data:,">` (by PM)
Reason: The [hidden] gap would silently break T5 and T7 error lines; both fixes are one line.

## 2026-11-09: QA plan mode pass before T5?
Options: Yes, No
Choice: No (by PM)
Reason: Each task's Done when plus per task QA is enough for a one screen app.

## 2026-11-09: daily-task-log T4 review note carried to T7
Options: Fix in T7, Fix now
Choice: Fix in T7: give each cloned edit input an id and set the label's htmlFor so the edit field has an accessible name (by PM)
Reason: The edit template is only used from T7.

## 2026-11-09: daily-task-log T6: Add `.check__box { pointer-events: none; }` to design-system.css?
Options: Add it (e.g. in T9), Skip
Choice: Skip (by PM)
Reason: QA found no user impact (mouse, touch, keyboard, screen reader); only Playwright's check() is affected, and clicking the box like a real user is a valid test.

## 2026-11-09: daily-task-log T7: Editing row shows hover grey instead of highlighter on desktop
Options: Fix now in design-system.css, Defer
Choice: Fix now: make `.task--editing` win over `.task:hover` (by PM)
Reason: Visible bug right after clicking Sửa; one selector change.

## 2026-11-09: daily-task-log T8: Delete dialog stuck at top left (global margin reset beats dialog margin:auto)
Options: Fix now in T8 via design-system.css, Move to another task
Choice: Fix now in T8: add `margin: auto` to the `.dialog` rule, keeping the mobile bottom sheet position (by PM)
Reason: Visible layout bug; one line.

## 2026-11-09: daily-task-log T9: Close a swiped row when focus moves back to its own tick box?
Options: Keep it open, Close it
Choice: Keep it open (by PM)
Reason: Focus stays on the same line and everything is usable; matches the "outside the open line closes" rule.

## 2026-11-09: daily-task-log T12: Thêm button is 36 px tall with a 44 px hit area
Options: Accept hit area for R29, Make the button 44 px tall
Choice: Accept the 44 px hit area (by PM)
Reason: Matches the approved prototype and meets the tap target size.

## 2026-11-09: daily-task-log release: How to push and deploy?
Options: User creates the repo and sends the URL, Install gh CLI, Local merge only
Choice: User creates an empty GitHub repo and sends the URL; PM adds the remote and pushes (by user)

## 2026-11-09: daily-task-log release: Test on Safari (WebKit) first?
Options: Release and note the risk, Install libs and test
Choice: Release and note the risk in the PR (by user)
Reason: Chrome and Firefox pass; WebKit cannot launch on this host.

## 2026-11-09: Checkbox accessible name including task text (aria-labelledby)?
Options: Later, Now
Choice: Later, add to backlog (by user)

## 2026-11-09: Continue with day-navigation after release?
Options: Yes, Stop here
Choice: Stop here for now (by user)
