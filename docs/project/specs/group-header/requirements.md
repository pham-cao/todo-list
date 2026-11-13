# Requirements: group-header

## Goal

Make groups easier to find and tidier to use. The "Quản lý nhóm" button moves into the page header, under the "Về hôm nay" button, so it is reachable from the top of every day. Creating a new group moves out of the add task form and into the "Nhóm việc" (manage groups) dialog. There, a new "Thêm nhóm" control opens a small message box, in the same paper note style as the delete group confirmation, where the owner types the name of the new group. Everything else about groups stays as built in `task-groups` and `drag-drop`: global groups, 6 colours, at most 20 groups, names up to 30 characters, no duplicate names, rename, recolour, bulk move and blocked delete. Tasks stay in the browser only, there is no backend and no login, and all screen text is Vietnamese.

This feature changes four rules of `task-groups`: where the "Quản lý nhóm" button is (its R35), how a group is created (its R15 and R16), the "Nhóm mới..." choice in the add form (its R14 and R17), and what the add form chooses after a group is created. The criteria below replace those rules. In this document "the box" means the new group message box, and "the card" means the "Nhóm việc" dialog.

## User roles

1. Owner: the single person who uses the page for personal daily planning, on a desktop browser or on a phone. There are no other roles.

## User stories

1. As the owner, I want "Quản lý nhóm" in the page header under "Về hôm nay", so that I find it at the top of the page whatever day I am on.
2. As the owner, I want to create a group from the "Nhóm việc" dialog, so that all group work (create, rename, recolour, move, delete) is in one place.
3. As the owner, I want a small message box that asks only for the new group's name, so that creating a group is quick and cannot be done by accident.
4. As the owner, I want clear messages when the name is empty, too long, already used, or I have reached the limit, so that I know how to fix it.
5. As the owner, I want the add task line to be only for tasks, so that it stays short, especially on a phone.
6. As a keyboard or screen reader user, I want to reach the button, the card and the box and finish creating a group without a mouse, with focus and announcements that make sense.

## Vietnamese UI text

New and changed text is exact. Text not listed here stays as in `task-groups` (including "Nhóm việc", "Đóng", "Bạn chưa có nhóm nào.", the group error messages and the storage message).

| Key | Text |
| --- | --- |
| Manage button in the header (visible text, accessible name and tooltip) | Quản lý nhóm (unchanged text, new place) |
| Add group control in the card (visible text) | Thêm nhóm |
| Box title | Tạo nhóm mới |
| Box name input (label and accessible name) | Tên nhóm mới (unchanged) |
| Box create button | Tạo nhóm (unchanged text) |
| Box cancel button | Hủy |
| Live message after a group is created | Đã tạo nhóm "{name}". |
| Live message when the box is cancelled | none (no announcement; focus returns, see R14) |
| Error, empty name | Vui lòng nhập tên nhóm. (unchanged) |
| Error, name too long | Tên nhóm tối đa 30 ký tự. (unchanged) |
| Error, duplicate name | Tên nhóm này đã có rồi. (unchanged) |
| Error, 20 groups reached | Tối đa 20 nhóm. Hãy xóa bớt một nhóm trước khi tạo thêm. (unchanged) |

## Acceptance criteria

### The manage button in the header

R1. THE SYSTEM SHALL show the "Quản lý nhóm" button in the page header, directly under the "Về hôm nay" button, on every day, whether or not any group exists. It SHALL no longer be in the group bar of the sheet body.

R2. WHEN the owner presses the header "Quản lý nhóm" button THE SYSTEM SHALL open the "Nhóm việc" card exactly as `task-groups` R35 and R36 describe (list of groups in creation order, Sửa and Xóa, "Bạn chưa có nhóm nào." when empty). WHEN the card closes THE SYSTEM SHALL return focus to this header button.

R3. THE SYSTEM SHALL keep the header button at least 44 by 44 pixels to tap, with the name "Quản lý nhóm" as its accessible name and tooltip, and SHALL keep the existing narrow phone rule (icon only below 452 px, name kept as the accessible name and tooltip). The header SHALL fit at 360 px wide without horizontal scrolling, and the tab order SHALL stay logical: heading, previous day, next day, picker, "Về hôm nay", "Quản lý nhóm", then the add input.

R4. WHEN the group bar has nothing to show (no groups exist, so no filter) THE SYSTEM SHALL not leave an empty line or gap in the body. WHEN groups exist THE SYSTEM SHALL show the filter as before, alone on its line.

### Creating a group from the card

R5. THE SYSTEM SHALL show a "Thêm nhóm" control in the card, above the list of groups so that it stays visible without scrolling the list, also when there are no groups and also when there are 20 groups.

R6. WHEN the owner presses "Thêm nhóm" THE SYSTEM SHALL open the box on top of the card (the card stays open behind it), in the same paper note style as the delete group confirmation: the same dialog surface, corner sticker, title style and button row, with the title "Tạo nhóm mới", a name input labelled "Tên nhóm mới", and the buttons "Hủy" and "Tạo nhóm". It SHALL move focus to the name input.

R7. WHEN the box opens THE SYSTEM SHALL show the colour the new group will get (the next colour, as `task-groups` R10 sets it) as a swatch beside the name input, and SHALL keep that swatch correct if another tab adds a group while the box is open. No colour picker is shown in the box (see the open question on colour). The owner can change the colour later with Sửa.

R8. WHEN the owner presses "Tạo nhóm", or presses Enter in the name input, with a valid name THE SYSTEM SHALL create the group at the end of the list (creation order, `task-groups` R1 and R10), save it straight away, close the box, show the new group in the card's list, announce "Đã tạo nhóm "{name}"." through a live region (once), and return focus to the "Thêm nhóm" control. The new row SHALL be scrolled into view if the list scrolls. It SHALL not create a task.

R9. WHEN the owner presses Enter in the name input THE SYSTEM SHALL create the group and SHALL NOT submit any form or add any task. An Enter that ends an IME composition (including `keyCode` 229 in Safari) SHALL NOT create the group.

R10. WHEN the owner presses "Hủy", presses Escape, or clicks outside the box (as the delete group confirmation does) THE SYSTEM SHALL close the box without creating a group, and that Escape SHALL NOT also close the card. Focus SHALL return to "Thêm nhóm".

R11. WHEN the card closes, a storage failure happens, or another dialog opens THE SYSTEM SHALL close the box and drop what was typed, creating nothing, and SHALL never leave the box stuck open or the page covered.

### Validation

R12. IF the name is empty or only spaces THEN THE SYSTEM SHALL not create a group, keep the box open, show "Vui lòng nhập tên nhóm." under the input in the field error style, mark the input invalid and linked to the message (`aria-invalid`, `aria-describedby`), announce the message, and keep focus in the input.

R13. IF the name is longer than 30 characters (counted after trimming, in code points after NFC normalisation, as `task-groups` does) THEN THE SYSTEM SHALL not create a group and show "Tên nhóm tối đa 30 ký tự." in the same way as R12.

R14. IF the name is the same as an existing group name, or "Chưa phân nhóm", ignoring upper and lower case and NFC differences THEN THE SYSTEM SHALL not create a group and show "Tên nhóm này đã có rồi." in the same way as R12. The check SHALL run again at the moment of pressing "Tạo nhóm", against the groups as they are then (another tab may have added one).

R15. IF 20 groups already exist, THEN WHEN the owner opens the box THE SYSTEM SHALL show "Tối đa 20 nhóm. Hãy xóa bớt một nhóm trước khi tạo thêm." at once, before any typing, and "Tạo nhóm" SHALL not create a group while 20 exist (see the open question on the limit).

R16. WHEN the owner types in the name input after an error THE SYSTEM SHALL clear the error, except the limit message of R15, which stays while 20 groups exist. A repeated failed attempt SHALL show and announce the message again.

R17. THE SYSTEM SHALL keep the validation rules and the messages for rename (Sửa) in the card exactly as they are in `task-groups`.

### The add task form

R18. THE SYSTEM SHALL remove the "Nhóm mới..." choice from the group select next to the add input, and SHALL remove the inline name input and "Tạo nhóm" button that it opened. The select SHALL list only "Chưa phân nhóm" and every group in creation order (default, see the open question on a shortcut).

R19. WHEN a group is created in the card THE SYSTEM SHALL NOT change the group chosen in the add form, because the owner was managing groups, not writing a task (default, see the open question on what the add form chooses). The new group SHALL appear in the add select, in the filter and in the edit forms at once, in creation order, and the add input text, an open edit and the filter SHALL be kept as they are.

R20. IF the group chosen in the add form is deleted or does not exist any more THEN THE SYSTEM SHALL use "Chưa phân nhóm", as it does now.

R21. THE SYSTEM SHALL keep the add form working as before for adding a task, with Enter in the add input adding a task and never creating a group.

### Page flip and the header

R22. WHEN the owner presses the header "Quản lý nhóm" button while a flip or riffle is playing THE SYSTEM SHALL open the card at once (the leaf ignores pointer events, `page-flip` R11) and SHALL end the flip at once with no leaf left (`page-flip` R37).

R23. WHILE the card or the box is open THE SYSTEM SHALL not start a flip behind it. IF the viewed day changes meanwhile (for example by browser Back) THEN THE SYSTEM SHALL change the day without a flip, and the open card and box SHALL stay as they are with the owner's typed text kept.

R24. WHEN the sheet flips THE SYSTEM SHALL show the "Quản lý nhóm" button on the leaf as an inert copy with the rest of the header (`page-flip` R8 and R11), and the real button SHALL be at the same place and keep focus if it had it.

R25. THE SYSTEM SHALL keep the card and the box above the flip layer and the page stack, so that they are never covered by or cut off by the leaf, the stack edges or the back cover, in light and dark mode.

### Keyboard and screen readers

R26. THE SYSTEM SHALL make every step usable with the keyboard alone: Tab to the header button and Enter or Space to open the card, Tab to "Thêm nhóm" and Enter or Space to open the box, type, Enter to create, Escape to cancel, and Tab or Shift plus Tab to move between the input, "Hủy" and "Tạo nhóm" inside the box without leaving it (focus stays inside the open modal box).

R27. THE SYSTEM SHALL give the box the role and name of a dialog (`aria-labelledby` the title "Tạo nhóm mới"), SHALL mark the card behind it as not reachable while the box is open (as a modal dialog does), and SHALL give each error `role="alert"` in the field error pattern of the add form.

R28. THE SYSTEM SHALL show a visible focus ring (2 px pen outline) on the header button, the "Thêm nhóm" control, the input and both box buttons, and SHALL keep the contrast rules of the design system (4.5:1 for text, 3:1 for controls) in light and dark mode.

### Phones and desktop

R29. THE SYSTEM SHALL show the box as a bottom sheet on phones and as a centred note on desktop, the same as the delete group confirmation, with the on screen keyboard not hiding the name input or the buttons at 360 by 640 pixels (the box scrolls or moves up so the input stays visible).

R30. THE SYSTEM SHALL keep all box controls at least 44 by 44 pixels to tap, and show a name of 30 characters without spaces whole, wrapping if needed, at 360 pixels wide without horizontal scrolling.

### Data and safety

R31. THE SYSTEM SHALL create a group only through the box, and SHALL store it exactly as `task-groups` does (id, name, colour, creation time). Existing groups, tasks, collapsed state and the filter SHALL be unchanged by this feature, and no data migration is needed.

R32. IF the group cannot be saved (storage failure) THEN THE SYSTEM SHALL show the existing storage slip text inside the card (as `task-groups` T11 does) and keep the group in memory for the session, with the same behaviour as today.

R33. THE SYSTEM SHALL keep drag and drop, the group filter, collapsing sections, "Xem các việc này", bulk move and blocked delete working as they are. A drop strip or drag in progress SHALL be cancelled when the card opens, as `drag-drop` R20 requires for a dialog.

## Non functional requirements

1. Performance: opening the card and the box SHALL take under 100 ms with 20 groups and 200 tasks on the day, and creating a group SHALL update the choices, the filter and the list in under 100 ms (as NFR1 of `task-groups`). Opening the box SHALL cause no long task (over 50 ms).
2. Security and data protection: no data leaves the browser. Group names reach the page only as text, never as markup (`task-groups` R65), including in the live message.
3. Reliability: a failed or cancelled creation SHALL never change or delete saved groups or tasks. Two quick presses of "Tạo nhóm" or Enter SHALL create at most one group.
4. Accessibility: WCAG 2.2 AA for the header button, the card and the box, including focus order (2.4.3), focus visible (2.4.7), target size (2.5.8), name, role, value (4.1.2) and status messages (4.1.3).
5. Compatibility: works in the current versions of Chrome, Safari, Firefox and Edge on desktop and mobile. Safari and iOS cannot be tested on the build host, so the on screen keyboard behaviour (R29) is a manual check in the release note.
6. Language: all visible text and accessible names are Vietnamese, in Unicode.
7. Maintainability: the old inline new group code and markup (template, handlers, keyboard and colour preview for the inline line) SHALL be removed, not left unused, and the end to end tests for the old inline line SHALL be replaced by tests for the box.

## Out of scope

1. Choosing the colour inside the box (the colour is automatic; Sửa changes it later) unless the owner picks that option in the open question.
2. Reordering groups, nested groups, a different limit than 20, and longer names than 30 characters.
3. Creating a group from anywhere else (the add form, the filter, the drop strip or by drag).
4. Moving the group filter, or any other change to the group bar beyond removing the manage button.
5. Changes to rename, recolour, bulk move, blocked delete, drag and drop, or the data model and storage format.
6. A keyboard shortcut for opening the card or the box.
7. Changes to the page flip itself, beyond the interaction rules in R22 to R25.

## Open questions

See the hand off report. They are listed there with options and a recommendation:

- Q1: what the add form chooses after a group is created in the card (R19).
- Q2: whether the add form keeps a shortcut to the box (R18).
- Q3: colour in the box, automatic with a swatch or a colour choice (R7).
- Q4: how the box behaves at the 20 group limit (R15).
- Q5: what the group bar shows when there are no groups (R4).
