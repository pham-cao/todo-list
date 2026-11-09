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
