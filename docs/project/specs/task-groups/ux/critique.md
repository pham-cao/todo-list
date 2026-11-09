# task-groups UX: critique and heuristic review

Method: every screen was captured with Playwright at 1440 px and 390 px in light and dark mode, and the eight busiest screens also at 360 px. The visual-critique:critique-screen pass (hierarchy, brand, composition, typography, colour, affordance, density) was run on those captures, followed by a Nielsen heuristic walk through each flow. Horizontal overflow was measured on every capture (none found) and the new controls were measured for size (toggle, filter, group choices, colour choices, dialog buttons and Quản lý nhóm all reach 44 px, the 36 px drawn buttons extend their hit area to 44 px as Thêm does today). Highlighter contrast was calculated per colour, see design-system.md.

## Fixed in this review

| Priority | Dimension | Issue | Fix |
| --- | --- | --- | --- |
| P1 | Composition | On phones the add line broke into three lines and the pen in the margin drifted to the middle line | Input takes line one; Nhóm and Thêm share line two; the pen stays on line one |
| P1 | Affordance | Section headers and counts were underlined like links | The toggle has no text decoration; it reads as a header with a fold chevron |
| P2 | Affordance | Chuyển tất cả việc was an unfamiliar folder icon with only a tooltip | On desktop the button shows its words next to the icon; on phones it stays an icon with tooltip and accessible name, and the blocked note offers the same action in words |
| P2 | Brand, density | The blocked note had a made up title repeating its own message | The required sentence is the heading of the note, set at 17 px semibold |
| P2 | Composition | The three buttons of the blocked note broke into an uneven two row layout on desktop | One button per line, primary first: Chuyển tất cả việc, Xem các việc này, Đã hiểu |
| P2 | Hierarchy, status | In filter mode a funnel showed in both the bar and the section header, and nothing said strongly that a filter was on | The header margin is left empty; the funnel in the bar is inked in and the filter underline turns pen blue while a filter is active |
| P2 | Consistency | The ungrouped choice showed an empty dashed swatch in the add line but not in the filter | No swatch for Chưa phân nhóm anywhere; it is the neutral, colourless option |

## Remaining findings (low priority, accepted)

| Priority | Dimension | Finding | Decision |
| --- | --- | --- | --- |
| P3 | Typography | At 360 to 390 px a long choice such as "Chưa phân nhóm" is cut with an ellipsis in the closed select | Accepted: native select (NFR7); the open list shows full names and the section headers repeat them |
| P3 | Density | On phones the add form takes two lines and the group bar a third, so the first task moves down by 88 px | Accepted, allowed by R64; the group bar is the only way to filter and to reach Quản lý nhóm |
| P3 | Composition | The blank line between sections costs 44 px per group on phones | Kept: it is how sections are separated on real paper, and it keeps every row on the ruling |
| P3 | Colour | The inactive Chuyển tất cả việc uses pencil grey (3.5:1) | Inactive controls are exempt from text contrast, and the visible hint "Nhóm này chưa có việc nào." explains it at full contrast |
| P3 | Affordance | The colour preview in the margin of the Nhóm mới... line has no label | Decorative (aria-hidden); the colour can be changed later in Quản lý nhóm, as R15 asks |

## Heuristic evaluation by flow

| Flow | Heuristic | Severity | Note |
| --- | --- | --- | --- |
| Create a group on the fly | User control and freedom | 0 | Escape returns the previous choice and creates nothing |
| Create a group on the fly | Error prevention | 1 | The 20 group limit is shown as soon as Nhóm mới... is chosen, before anything is typed (see open questions) |
| Create a group on the fly | Visibility of system status | 1 | After Tạo nhóm no section appears yet, because the group has no task; the choice in the add line shows the new group with its swatch |
| Add with a group | Visibility of system status | 0 | A task added to a hidden group gets the notice, so nothing seems lost |
| Move a task | Recognition over recall | 0 | The group choice in edit starts on the current group |
| Move a task | Visibility of system status | 1 | The moved row gets a short wash in its new colour and keeps focus; under reduced motion only the focus ring marks it |
| Read by group | Consistency and standards | 0 | Days without groups look exactly as before; headers use the same margin column as checkboxes |
| Read by group | Match with the real world | 0 | Highlighted headings and a skipped line between topics are how people group notes on paper |
| Filter | Visibility of system status | 1 | Summary counts the whole day while only one group shows; the inked funnel and pen underline flag the filter |
| Manage groups | Error prevention | 0 | Deleting is impossible while tasks exist, and the note explains the counts |
| Manage groups | Help users recover | 0 | Blocked note offers the two ways out (move all, or look at the tasks) |
| Move all | Error prevention | 0 | Confirmation sentence states n, d and the target and promises dates, done state and order stay |
| Move all | Error recovery | 0 | On a failed write nothing moves and the dialog stays open with the choice kept |

## Captures

All in `screenshots/`: `<screen>-desktop.png`, `<screen>-mobile.png` (390 px), `<screen>-dark-desktop.png` and `<screen>-dark-mobile.png` for all 20 screens, plus `<screen>-mobile360.png` for sections, filter, add-new-group, edit-move, swipe, manage--edit, manage--blocked and move-all. Dialog screens are viewport captures so the scrim and the dialog show as the owner sees them.
