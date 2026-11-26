# Tasks: group-header

Order: T1, T2, T3, T4, T5, one after another, since they share `index.html`, `src/app.js`, the design system and `tests/e2e/groups.spec.js`. Work starts on a new branch from main after page-flip is released as 1.4.0. Interfaces and markup are in `design.md`; styles come from `ux/group-header.css` (merged piece by piece below, without its icon only block). New imports carry `?v=1.4.0` until T5. Run Playwright with `--workers=2`. All unit and e2e tests must pass after every task.

## T1: "Quản lý nhóm" in the header, group bar hidden with no groups
Owner: fe
Screens: ux/screens/day.html, ux/screens/day--no-groups.html, ux/screens/manage.html
Requirements: R1, R2, R3, R4, R22, R23, R24, R25, R33
Depends on: none
Boundary: `index.html` (header nav, group bar), `src/app.js` (`renderChoices`, `els`, the `#manage-groups` click), `src/flip.js` (`allowed()` only), `docs/project/design-system.css` and `.md` (UX section 1, removal of `.group-bar__manage*`, the Group bar entry), `tests/e2e/groups.spec.js` (manage button and group bar tests, the `ICON_ONLY_BELOW` loop), `tests/e2e/day-nav.spec.js` (tab order), `tests/e2e/flip.spec.js` (one new test)
Done when: the button sits under "Về hôm nay" with its label visible and equal to its accessible name at 360, 390, 412, 452 and 1440 px (the `ICON_ONLY_BELOW` constant and its icon only branch are removed from `groups.spec.js`), its hit area is at least 44 by 44 px, there is no horizontal scroll at 360 px, and the filter choice still shows "Chưa phân nhóm" and "Học tiếng Nhật" in full; tab order is heading, previous, next, picker, Về hôm nay, Quản lý nhóm, add input; `#group-bar` is hidden with no groups and shows the filter alone after the first group; closing the card returns focus to the header button; pressing it during a flip leaves no flip stage; Back with the card open changes the day, builds no stage, and leaves the card open; design-system.md has a "Group header" section for the header column and the Group bar entry says filter only, hidden with no groups; all unit and e2e tests pass.

## T2: "Thêm nhóm" and the new group box
Owner: fe
Screens: ux/screens/manage.html, manage--empty.html, manage--created.html, manage--save-error.html, new-group.html, new-group--first.html, new-group--typed.html, new-group--empty.html, new-group--too-long.html, new-group--duplicate.html, new-group--limit.html
Requirements: R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16, R17, R19, R23, R26, R27, R28, R30, R31, R32, NFR1, NFR2, NFR3, NFR4, NFR6
Depends on: T1
Boundary: `index.html` (the card, `#new-group-dialog`), `src/manage.js`, `docs/project/design-system.css` and `.md` (UX sections 2 and 3), `tests/e2e/helpers.js` (`createGroup`), `tests/e2e/groups.spec.js` (new describe "new group box")
Done when: the box behaves as the table in design.md "The box"; the e2e describe covers every point in design.md Test strategy T2 (open with the next colour, create by Enter and by click with one live message "Đã tạo nhóm "{name}"." and focus on Thêm nhóm, no task created and the add choice unchanged, the four error messages with `aria-invalid` and `aria-describedby`, the limit shown at once and kept while typing, IME Enter and `keyCode` 229, Escape and backdrop closing only the box, double Enter creating one group, another tab updating the swatch and causing a duplicate at press time, storage failure text in the card, Back with the box open keeping the typed name and building no stage, axe clean in light and dark, open and create under 100 ms with 20 groups and 200 tasks); existing rename tests pass unchanged (R17); `createGroup(page, name)` is exported from helpers.js; all unit and e2e tests pass.

## T3: Sticky note dialogs as bottom sheets on phones
Owner: fe
Screens: ux/screens/new-group--keyboard.html, new-group--limit.html (360 px captures)
Requirements: R29, R30, NFR5
Depends on: T2
Boundary: `index.html` (viewport meta, `dialog--sheet` on `#new-group-dialog`, `#group-delete-dialog`, `#group-blocked-dialog`), `docs/project/design-system.css` and `.md` (UX `.dialog--sheet` block and `sheet-up`), `tests/e2e/groups.spec.js` (one describe)
Done when: the viewport meta is `width=device-width, initial-scale=1, interactive-widget=resizes-content`; at 390 by 844 and 360 by 640 the box, the delete group note and the blocked note dock to the bottom edge, full width, untilted, with the tape and corner sticker inside the screen and no horizontal scroll; at 1440 px they stay centred notes as before; at 360 by 340 (keyboard simulated) the box's input, Hủy and Tạo nhóm are all in view; a 30 character name without spaces wraps inside the box at 360 px; screenshots of the three sheets light and dark at 360 px in `qa/evidence/T3-fe/`; all unit and e2e tests pass.

## T4: Remove the old inline group creation
Owner: fe
Screens: ux/screens/day.html (add choice picture)
Requirements: R18, R20, R21, R31, NFR7
Depends on: T2
Boundary: `index.html` (`#new-group-template`), `src/app.js` (inline line code and the `"new"` option), `docs/project/design-system.css` and `.md` (`.add-form__newgroup*` and its sentence), `tests/e2e/groups.spec.js`, `tests/e2e/drag.spec.js` (the line at about 362)
Done when: `grep -rn "Nhóm mới\|newLine\|new-group-template\|add-form__newgroup\|openNewGroup\|closeNewGroup" src index.html docs/project/design-system.*` finds nothing; the add select lists only "Chưa phân nhóm" and the groups; Enter in the add input adds a task and never creates a group; a deleted add choice falls back to "Chưa phân nhóm"; every e2e test that used the inline line now uses `createGroup()` or is deleted with a one line reason where the T2 describe already covers it; a guard test asserts there is no `"new"` option; all unit and e2e tests pass.

## T5: Release version 1.5.0
Owner: be
Requirements: NFR5, NFR7
Depends on: T3, T4
Boundary: `package.json` and `package-lock.json` (`version` only), the `?v=` values in `index.html` and `src/*.js`, the release note in the pull request text
Done when: `version` is `1.5.0` in package.json and the lockfile root, and every `?v=1.4.0` in `index.html` (stylesheets, `vendor/page-flip/page-flip.css`, `src/app.js`) and in every import in `src/*.js` (including `../vendor/page-flip/page-flip.module.js` in flip.js) is `?v=1.5.0`; `grep -rn "?v=1\.[34]\.0" index.html src` finds nothing; `tests/unit/version.test.js` passes; a short release note says "Quản lý nhóm" moved to the header, groups are created only from "Thêm nhóm" in the card, and the sticky notes are bottom sheets on phones, and lists the manual checks (iOS Safari: the box stays above the on screen keyboard at 360 by 640, the sheets light and dark, the IME Enter guard with Vietnamese Telex input); all unit and e2e tests pass in both projects.
