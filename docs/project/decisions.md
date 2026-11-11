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

## 2026-11-09: day-navigation: What can be done on past and future days?
Options: Everything on every day, Past days tick only, Future days read only
Choice: Everything on every day (by user)
Reason: Lets the owner log yesterday late or plan tomorrow.

## 2026-11-09: day-navigation: Keep the viewed day across reload?
Options: URL hash #yyyy-mm-dd (plain address means today), Always open today, Remember in localStorage
Choice: URL hash, plain address opens today (by user)
Reason: Works on GitHub Pages, bookmarkable, predictable default.

## 2026-11-09: day-navigation: Midnight while viewing another day?
Options: Stay on the viewed date and refresh wording, Jump to the new today
Choice: Stay on the viewed date and refresh wording; viewing today still follows to the new today (by user)

## 2026-11-09: day-navigation: Add a browser history entry per day move?
Options: Yes, Back returns to the previous day, No, replace the address
Choice: Yes (by user)

## 2026-11-09: day-navigation: "Về hôm nay" button when already on today?
Options: Visible but inactive (aria-disabled), Hidden
Choice: Visible but inactive (by PM)
Reason: Keeps focus and header layout stable.

## 2026-11-09: day-navigation: Heading and placeholder on other days?
Options: "Việc cần làm" and "Bạn cần làm gì ngày này?", Keep "hôm nay" wording
Choice: "Việc cần làm" and "Bạn cần làm gì ngày này?" (by PM)
Reason: "hôm nay" would be wrong and could cause tasks to land on the wrong day.

## 2026-11-09: day-navigation: Bound the date range to years 2000 to 2099?
Options: Yes, No bound
Choice: Yes (by PM)
Reason: Guards against odd dates from typing or hand edited URLs.

## 2026-11-09: Approve day-navigation requirements?
Options: Approve, Request changes
Choice: Approve (by user)

## 2026-11-09: day-navigation UX: "Về hôm nay" wraps under the arrows at 360 px
Options: Accept the wrap, Icon only below 381 px, Let the nav row extend into the margin
Choice: Accept the right aligned wrap (by user)

## 2026-11-09: day-navigation UX: Hash that equals today on load
Options: Replace with the plain address and add no history entry, Keep the address
Choice: Replace with the plain address, no history entry (by user)
Reason: The plain address always means today.

## 2026-11-09: Approve day-navigation UX?
Options: Approve, Request changes
Choice: Approve (by user)

## 2026-11-09: day-navigation design: Remove an invalid or out of range hash from the address?
Options: Yes, replace with the plain address and no history entry, No, leave it
Choice: Yes (by PM)
Reason: The plain address then always matches what is on screen.

## 2026-11-09: day-navigation design: Typing in the picker can add one history entry per valid intermediate date
Options: Accept it, Replace instead of push for typed picker changes
Choice: Accept it (by PM)
Reason: Mouse and touch picks add one entry; reliably telling typing from picking is not worth the complexity.

## 2026-11-09: day-navigation design: Choices made in the design (recorded for the team)
Choice: An open edit stays open when midnight passes while viewing another day; day controls take their target from the day on screen before the midnight check; a bad picker value is reset when the field loses focus (by architect, accepted by PM)

## 2026-11-09: Approve day-navigation design and tasks?
Options: Approve, Request changes
Choice: Approve (by user)

## 2026-11-09: day-navigation test design: open points from QA plan
Choice (by PM):
- Hash equal to today is cleaned with replaceState and no history entry: confirmed (user decision earlier).
- NFR6 subpath hosting (T3-15): check relative URLs by code reading plus a manual run; no subpath server needed.
- Picker contradiction in design.md steps 5 and 6: the T5 owner must make the change handler ignore incomplete or out of range values while the picker has focus, and reset only on blur.
- No qa-test-generator specialist: each FE task writes its e2e tests as before, QA executes and fills gaps.

## 2026-11-09: day-navigation: Add @axe-core/playwright as a devDependency?
Options: Add it and automate axe in T7, Keep axe as a manual QA run
Choice: Keep axe as a manual QA run from the scratchpad (by PM)
Reason: Avoid a new dependency for a one screen app; QA runs axe at T7 and before release.

## 2026-11-09: day-navigation T5: Về hôm nay wraps at 390 px while the picker is focused
Options: Accept (matches the approved today--focus prototype), Change layout
Choice: Accept (by PM)
Reason: Same as the approved prototype; unfocused layout stays on one row from about 380 px.

## 2026-11-09: day-navigation T5-09 (native calendar popup in headed Chrome, Firefox, Edge)
Choice: Owner checks it manually on the deployed site after release; logged as blocked, not holding the task (by PM)

## 2026-11-09: Next feature after day-navigation
Options: BA ranked list (backup-export-import, carry-over-unfinished, week-overview, search-tasks, offline-install, task-notes-and-priority), Owner's own idea
Choice: task-groups, user created groups to organise tasks, requested by the owner (by user)
Reason: The owner wants to split tasks into groups for easier management. The BA ranked list stays in the backlog for later.

## 2026-11-09: task-groups D2: Global or per day groups?
Options: Global, Per day
Choice: Global, one list of groups for every day (by user)

## 2026-11-09: task-groups D4: Collapsible sections and filter by group?
Options: Neither for now, Filter only, Collapsible and filter
Choice: Collapsible sections and a filter by group (by user)

## 2026-11-09: task-groups D6: Deleting a group that has tasks
Options: Move tasks to ungrouped after confirmation, Delete the tasks too, Block deleting a group that has tasks
Choice: Block deleting a group that still has tasks on any day; the owner moves them first (by user)

## 2026-11-09: task-groups D1: Colour per group?
Options: Name only, Choose from about 6 colours
Choice: Choose from about 6 colours per group (by user)

## 2026-11-09: task-groups: Defaults set by PM for the remaining open questions
Choice (by PM):
- D3: "Chưa phân nhóm" shown last; groups with no tasks that day are hidden (unless the filter selects them).
- D5: the add form keeps the chosen group while the page is open and resets to ungrouped on reload.
- D7: at most 20 groups, names up to 30 characters, no duplicate names ignoring case.
- Placement: group select next to the add input and inside the edit form; rename, colour and delete in a "Quản lý nhóm" dialog.
- A moved task sits by its creation time in the new section (creation order kept everywhere).
- Stamp, progress and summary stay whole day; section headers show group counts.
- Add cache busting (version query on CSS and JS links) in this feature so stale cached CSS cannot break the page after a release.

## 2026-11-09: task-groups: Bulk move before deleting a group
Options: One by one for now, Add "move all tasks of this group to..." now
Choice: Add the bulk move action now, in the "Quản lý nhóm" dialog (by user)

## 2026-11-09: task-groups: Keep the group filter across reloads?
Options: Reset to all groups on reload, Remember it
Choice: Reset on reload (by user)

## 2026-11-09: Approve task-groups requirements?
Options: Approve, Request changes
Choice: Approve, with the bulk move action added (by user)

## 2026-11-09: task-groups UX: Keep the group bar line on days with no groups?
Options: Keep it, Move "Quản lý nhóm" next to the title
Choice: Keep it (by user)

## 2026-11-09: task-groups UX: Accessible name of the rename input
Options: "Tên nhóm" (add to the text table), "Sửa"
Choice: "Tên nhóm" (by user)

## 2026-11-09: task-groups UX: defaults by PM
Choice: At 20 groups the limit error shows as soon as "Nhóm mới..." is chosen; on phones "Chuyển tất cả việc" in a manage row is icon only with tooltip and accessible name (by PM)

## 2026-11-09: Approve task-groups UX?
Options: Approve, Request changes
Choice: Approve (by user)

## 2026-11-09: task-groups UX change after approval: group label style
Options: Highlighter swipe (approved), Paper sticker
Choice: Group labels look like paper stickers stuck on the page, to match the notebook style (by user)
Reason: Owner feedback; UX revises the group label look only, flows and behaviour unchanged.

## 2026-11-09: task-groups UX: sticker review
Options: Approve, Request changes
Choice: Request changes: labels should look like torn paper labels with jagged, sawtooth edges (by user)

## 2026-11-09: task-groups UX: live preview sticker when renaming or recolouring?
Options: No, Yes
Choice: No (by user)

## 2026-11-09: task-groups UX: group choice cut short at 390 px on the add line
Choice: Fix so the full name shows (by PM; the owner's answer to this question was the torn label request)

## 2026-11-09: task-groups design: Bulk move when storage was unavailable from page load
Options: Move in memory like every other change in that session, Always show the move error
Choice: Move in memory (R61); show the error only when a real write fails (by PM)

## 2026-11-09: task-groups design: Version value for cache busting
Options: package.json version (1.2.0 now, bumped each release), Date stamp, npm bump script
Choice: package.json version, set to 1.2.0 now and bumped each release; the unit test catches any reference left behind (by PM)

## 2026-11-09: task-groups design: Filter "Chưa phân nhóm" also sets the add choice to ungrouped?
Options: Yes, the add choice follows any single filter choice, No
Choice: Yes (by PM)
Reason: New tasks go where the owner is looking.

## 2026-11-09: Approve task-groups UX (torn paper labels)?
Options: Approve, Request changes
Choice: Approve (by user)

## 2026-11-09: task-groups UX: filter choice truncated at 360 px
Options: "Quản lý nhóm" icon only on narrow screens, Accept truncation
Choice: "Quản lý nhóm" icon only below 381 px, keeping its accessible name and tooltip (by user); FE applies this in T7

## 2026-11-09: Approve task-groups design and 11 tasks?
Options: Approve, Request changes
Choice: Approve (by user)

## 2026-11-09: task-groups T3 review: duplicate names differing only in case or NFC in a hand edited store
Options: Drop later duplicates on load, Accept as out of scope
Choice: Accept as out of scope (by PM)
Reason: The UI can never create such names; only a hand edited store can.

## 2026-11-09: task-groups QA plan open points
Choice (by PM):
- R47 hidden group notice for an ungrouped add uses the name "Chưa phân nhóm": confirmed.
- moveGroup(from, to) with from equal to to, or an unknown id: no data change and no loss: confirmed.
- Group names are stored as typed (not NFC normalised); only the length and duplicate checks use NFC: confirmed, intended.
- Two tabs, last writer wins on the groups key: accepted as a residual risk; the existing backlog follow up for multi tab sync covers it.
- No qa-test-generator specialist: each FE task writes its own e2e tests in a new tests/e2e/groups.spec.js using tests/e2e/helpers.js; QA executes and fills gaps.

## 2026-11-09: task-groups BUG-005: section toggle name conflicts with WCAG 2.5.3 (label in name)
Options: Change the name so it starts with or contains the visible text, Waive the axe rule, Move the count outside the button
Choice: Fix it: the toggle's accessible name must contain its visible text ("{name} {d}/{t}") so axe label-content-name-mismatch passes, while still telling screen reader users it is a group and its progress (for example the visible text as the name plus a description). R63 wording is amended accordingly; FE picks the simplest markup that passes axe and reads well in Vietnamese (by PM)
Reason: Accessibility is not waived; the change is small and reused by later tasks.

## 2026-11-10: task-groups T5: Safari IME Enter guard
Options: Add `e.keyCode === 229` guard, Skip
Choice: Add the guard (by PM)
Reason: The owner may use an iPhone; the guard is one condition and Safari cannot be tested on this host.

## 2026-11-10: task-groups T5: Enter twice quickly when creating a group
Choice: Accepted as normal add behaviour, no change (by PM, on QA's judgement)

## 2026-11-10: task-groups T5 review: split app.js now?
Options: Move group UI to src/groups-ui.js before T7, Keep the design plan (src/manage.js from T8)
Choice: Keep the design plan; T8 creates src/manage.js for the dialog work and may move the add choice and filter helpers there if app.js passes about 900 lines (by PM)
Reason: Avoid an extra refactor task; the planned split already covers the biggest piece.

## 2026-11-10: task-groups T6 QA optional points
Choice (by PM):
- Edit select named "Nhóm" (same as the add select): keep as is, consistent with the edit textbox "Sửa"; no extra aria-label.
- Repeated live region message for two moves to the same group: make it reliably announced by clearing the text and setting it again on the next frame (small change, done with the T6 review fixes).

## 2026-11-10: task-groups T7: filter choice truncated from 381 to about 412 px
Options: Raise the icon only breakpoint for "Quản lý nhóm" to about 413 px, Accept the ellipsis
Choice: Raise the breakpoint so the full filter choice fits on common phones (390 to 412 px); the button keeps its accessible name and tooltip (by PM)
Reason: The owner already asked to avoid truncated group names on phones (add line, 360 px filter).
Follow up (2026-11-10): measured breakpoint is 452 px, not 413 px; "Quản lý nhóm" is icon only below 452 px so "Chưa phân nhóm" and "Học tiếng Nhật" fit in full on phones up to 451 px (by PM, from FE measurement).

## 2026-11-10: task-groups T7 QA observations
Choice (by PM):
- Open edit dropped when the filter hides its row, and the new group line kept open on a filter change: accepted.
- Announce the filter empty state: yes, give #group-empty role="status" so screen readers hear the empty text when the filter shows nothing.
- If the focused filter disappears because all groups were removed in another tab, move focus to the add input.
- A move into a hidden collapsed group still expands and stores it (R28): accepted.

## 2026-11-10: task-groups T8: design system changes outside the boundary
Choice: Accept the three design-system.css changes (card dialog full prototype width, scrolling group rows inside the card, row tooltips anchored to stay unclipped) and the app.spec.js selector change to #delete-dialog; FE adds the matching line to design-system.md with the review fixes (by PM)

## 2026-11-10: task-groups T8: storage failure slip hidden behind the modal card
Choice: Accept for now; T11 (safety checks) decides whether the card should also announce a failed write, reusing the existing storage message text (by PM)

## 2026-11-10: task-groups T9 bugs
Choice (by PM):
- BUG-009: yes, at "Xóa nhóm" confirm time re-read the stored tasks and show the blocked note if the group now has tasks on any day. Wider stale tasks across tabs stays out of scope (existing multi tab follow up).
- BUG-010: fix the forced layout in closeSwipes (skip scrollLeft reads when no swipe strip is open) so a settled move with 200 tasks stays under 100 ms, then remove the fixme; T11 rechecks add, collapse and filter on a settled page.

## 2026-11-10: task-groups T9 review minors
Choice (by PM):
- storedUsage must count only entries the store would load (filter with the store's validity check), so a damaged entry cannot block a delete or produce a bad hash: fix before commit.
- After "Xem các việc này" on the BUG-009 path, the day may look empty because this tab's tasks are not reloaded: accepted as the existing cross tab stale tasks limit (multi tab follow up in the backlog).

## 2026-11-10: task-groups: carry to T11
Choice (by PM): T11 checks that a stored task with a well formed but impossible date (e.g. 2026-13-45) in a group cannot make "Xem các việc này" move to an invalid day (go() or showGroupTasks must use parseDateKey).

## 2026-11-10: task-groups T10 bugs
Choice (by PM):
- BUG-013: keep refusing the move when another tab stored more tasks of the group (no data loss), but show a distinct message instead of the write failure text: "Một tab khác vừa thay đổi việc của nhóm này. Hãy tải lại trang rồi thử lại." Added to the Vietnamese label table. Full cross tab task reload stays out of scope.
- BUG-012: when the blocked note's group is removed in another tab, sync closes the blocked note and returns focus to the card's row or "Đóng".

## 2026-11-10: task-groups T10: stale check by task id
Choice: The move is refused (other tab message) when any valid stored task of the group has an id this tab does not hold. Accepted rare case: after a failed delete save in this tab, the move is also refused until reload; nothing is lost (by PM)

## 2026-11-10: task-groups T11
Choice (by PM):
- Carry over (b): yes, a failed write while the "Nhóm việc" card is open is announced inside the card, reusing the storage slip text.
- Move card title overflow with a 30 character name without spaces at 360 px: approve `.dialog__title { overflow-wrap: anywhere; }` in design-system.css and turn the fixme into a normal test.
- Corner sticker on the move card extending past the screen edge on phones: accepted, same as the approved prototype, causes no scroll.

## 2026-11-10: task-groups: BUG-014 before release?
Options: Release and record the risk, Fix before release
Choice: Fix before release (by user). New task T12 "Firefox speed for 200 tasks" (owner fe); it also covers the same slow class in day navigation if the cause is shared.

## 2026-11-10: task-groups T12: Firefox speed test residual on a loaded host
Options: Accept, Retry once or median of three in Firefox
Choice: Accept (by PM)
Reason: The suite runs Chromium only; Firefox medians are 7 to 30 ms; about 5 percent of loaded host Firefox runs land at 111 to 158 ms, down from about 32 percent.

## 2026-11-10: task-groups T12 review: tooltip differences accepted
Choice: Accepted (by PM): leaving a row straight from Sửa or Xóa hides its tooltip at once (no fade out); browsers without @starting-style (Safari before 17.5, Firefox before 129) show the tooltip at once when the pointer lands straight on a button. design-system.md wording corrected.

## 2026-11-10: Next feature after task-groups
Choice: drag-drop, pick up a task and drag it between groups, requested by the owner (by user)

## 2026-11-10: drag-drop: scope
Options: Between groups only, Also reorder inside a group, Reorder within one day only
Choice: Between groups only; tasks keep creation order (by user)

## 2026-11-10: drag-drop: drop targets for empty, hidden or filtered groups
Options: Drop strip listing every group during a drag, Visible sections only, Show empty sections while dragging
Choice: Drop strip with every group's torn label, shown only during a drag (by user)

## 2026-11-10: drag-drop: how a drag starts
Options: Whole row (mouse move on desktop, 400 ms long press on phones, swipe left unchanged), Grip handle on every row, Handle on phones only
Choice: Whole row; long press on phones; swipe left unchanged (by user)

## 2026-11-10: drag-drop: keyboard and screen reader alternative
Options: Keep the Sửa move, Keyboard drag mode, Alt plus arrow shortcut
Choice: Keep the existing Sửa move as the WCAG 2.5.7 alternative (by user)

## 2026-11-10: drag-drop: defaults by PM
Choice (by PM): no drag across days (the task keeps its date); dragging is not available while a row is in edit mode.

## 2026-11-10: Approve drag-drop requirements?
Options: Approve, Request changes
Choice: Approve (by user)

## 2026-11-10: drag-drop UX: visible message when a task moves into a group hidden by the filter
Options: Show the info slip "Đã chuyển việc "{text}" sang nhóm "{name}".", Live region only
Choice: Show the info slip; applies to the edit form move too (by user)

## 2026-11-10: drag-drop UX: the task's current group in the drop strip
Options: Faded, a release there cancels, Hidden, Extra text "Đang ở đây"
Choice: Faded, a release there cancels (by user)

## 2026-11-10: drag-drop UX: defaults by PM
Choice (by PM): the bottom auto scroll zone is the 64 px above the strip's top edge (hovering the strip never scrolls); a tall strip with 20 groups on a 360 px phone is accepted.

## 2026-11-10: Approve drag-drop UX?
Options: Approve, Request changes
Choice: Approve (by user)

## 2026-11-10: drag-drop design: open points
Choice (by PM):
- Move into a group hidden by the filter: write only the info slip (role="status"), not #sr-status too, so screen readers hear it once.
- Use the same live text "Đã chuyển việc "{text}" sang nhóm "{name}"." for drop and edit form moves; the five affected groups.spec.js assertions are updated in the task that changes it.
- Accepted design choices: new store.setGroup(id, groupId) (never touches text); one passive:false touchmove listener on #day-list instead of a late touch-action change; drag never calls renderList or reads all rows.

## 2026-11-10: Approve drag-drop design and 9 tasks?
Options: Approve, Request changes
Choice: Approve (by user)

## 2026-11-10: drag-drop QA plan open points
Choice (by PM):
- store.setGroup with the task's current group: no data change and no error is enough; a redundant write is acceptable.
- A storage event for the tasks or ui key during a drag: cancel the drag through the same end step as the groups key, so the page is never stuck.
- R3 reading confirmed: up to 10 px of movement during the 400 ms hold still starts a drag; more than 10 px gives way to swipe or scroll.
- Firefox spot check uses a temporary config or a hand run; no Firefox project is added to playwright.config.js.
- No qa-test-generator: each FE task writes its e2e tests in tests/e2e/drag.spec.js; QA executes and fills gaps.

## 2026-11-10: drag-drop T2 QA findings
Choice (by PM):
- BUG-015 (info slip does not wrap long unbroken text at 360 px): fix in T2 with `.alert p { min-width: 0; overflow-wrap: anywhere; }` in design-system.css (authorised); covers the older add notice too.
- Stale slip after a later visible move: clear it (notify(null)) on a visible move, so the slip never describes an older move.

## 2026-11-10: drag-drop T3: axe scrollable-region-focusable on the placeholder row at 390 px
Options: Accept as a drag only state, Small CSS change in T8
Choice: Fix in T8 with a small design-system.css change (e.g. hide placeholder actions with opacity instead of visibility), PM authorised (by PM)
Also accepted: strip appended inside <main>; pointer captured on the slip, not the row.

## 2026-11-10 drag-drop T3: review minor findings deferred
- The cancel announcement reads the group from `row.closest(".group")` at drag end, so a row removed mid-drag would announce "Chưa phân nhóm". Fix it in T7 by passing the group key from pick up to `onEnd`, together with `drag.cancel()` in resetTransient.
- The slip's screen bounds are measured once at pick up, so a resize mid-drag can let the slip go past the new edge. This is accepted as cosmetic; re-measure on resize only if T6 or T7 touch it.

## 2026-11-10 drag-drop T4: the slip never covers the strip
- This follows the approved hover-strip screens: the slip rests on the strip's top edge, so the hovered label stays readable. The cap is measured once at pick up. A row picked up where the strip appears jumps above the strip; this is accepted.
- The T4 drop tests run at 1440x900 because at 1280x720 the fixed strip covers the lower rows. That is correct behaviour, and only the test viewport changes.
- Review minor finding: the target-name sticker hangs about 16 px over the strip's top edge. QA's visual check matched hover-strip at 1440 and 390, so this is accepted. It will be re-checked in the T8 visual pass.

## 2026-11-11 drag-drop T5: review findings
- A second finger during the 400 ms hold must cancel the hold, so that a pinch never lifts a task. FE will fix this in T5 after QA, together with a two-finger CDP test.
- If the row is re-rendered during a touch drag, touch events go to the detached node and the scroll lock is lost. T7 covers this by cancelling the drag before any renderList.
- BUG-018: a lifted task with no finger movement must not drop on whatever the strip puts under the finger. This is fixed in T5: after a touch pick up, hit testing stays off until the finger has moved more than the 10 px slop, so a release before then is a cancel.

## 2026-11-11 drag-drop T6: review findings
- scrollSpeed must return 0 over the strip even when a tall strip starts above 64 px. FE fixes this in T6 after QA, with a unit case for stripTop < 64.
- The up chevron flip (`style.rotate` in drag.js) moves to design-system.css as `.drag-edge--up .icon { rotate: 180deg }` in T8, together with the placeholder CSS fix.
- Auto scroll stays on under reduced motion. R30 covers only the tilt and the lift and return animations.
- BUG-020 zone sharing: the strip wins, so the speed is 0 for y >= stripTop. When stripTop < 128, the two zones split the space above the strip evenly. The up zone is [0, min(64, stripTop/2)) and the down zone is [max(stripTop-64, stripTop/2), stripTop), each with full speed range across its own height. When stripTop <= 0 there is no zone.
- BUG-019: the flaky T4 target test is fixed in test code by keeping hovered rows clear of the bottom zone. FE runs the T4 drop tests with --repeat-each=5 to confirm.
- The bottom zone includes its first pixel, so the speed is 1 at stripTop - 64. This is accepted under R31's "about 64 px", and TC-drag-drop-T6-03 is read with that tolerance.

## 2026-11-11 drag-drop T7: interruptions
- A resize during a drag re-measures the bounds rather than cancelling, because a phone's address bar showing or hiding fires resize during auto scroll. This also closes the T3 resize finding.
- `drag.cancel()` goes at the top of `renderList` as well, so every re-render path, such as adding a task by keyboard during a mouse drag, cancels first. This is safe because `end` clears the state before `onEnd`. The PM authorises this app.js change beyond the T7 Boundary.
- A dialog that opens during a drag ends it (design.md cancel path 4).
- Correction: `drag.cancel()` lives in renderList and in the storage listener, not in resetTransient. Every day change path reaches renderList. design.md is updated to match.
- Review finding: after a day change cancels a drag, focus can fall to body. go() and syncFromAddress() fall back to the add field when focus is on body, as checkDay already does. FE fixes this in T7 after QA.
- The per-frame `dialog[open]` query is measured in T8, and a cached list of dialogs is used only if it shows up as a cost.
- BUG-021: fix it. Any keyboard add during a drag cancels the drag, including an add into an existing section.
- BUG-022: works as intended, so close it. R22 announces the group the task is in now. After another tab renames or deletes the group, "Công ty mới" or "Chưa phân nhóm" is the true current group.
- BUG-023: fix it. Escape during the 400 ms touch hold cancels the press, the same as blur and hidden.
- A dialog that opens under a still finger ends the drag on the next move or release. This is accepted, because a dialog cannot open from a touch while a finger is holding a drag.
- Storage events on the tasks and ui keys cancel the drag. This is confirmed as intended.
