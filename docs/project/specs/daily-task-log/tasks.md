# Tasks: daily-task-log

All `fe` tasks edit `src/app.js` and `index.html`, so please run them one after another in the order below. T2 and T3 can run in parallel with each other once T1 is done. The API contract for T2 and T3 is in `design.md` under "Interfaces".

## T1: Project setup and git init
Owner: be
Requirements: none directly (enables all)
Depends on: none
Boundary: repo root only: `git init`, `.gitignore`, `package.json`, `playwright.config.js`, `README.md`, a placeholder `index.html` (title "Việc cần làm hôm nay", `lang="vi"`, links `docs/project/design-system.css`), `tests/e2e/app.spec.js`, empty `tests/unit/`
Done when: the repo is a git repository with `node_modules/`, `test-results/`, `playwright-report/` and `.playwright-mcp/` ignored; `npm start` serves the page at http://localhost:4173; `npm test` runs `node --test tests/unit/` (passes with one placeholder test); `npm run test:e2e` starts the server itself and one test asserting the page title passes on the `desktop` and `mobile` projects; the README lists these commands.

## T2: Date helpers
Owner: be
Requirements: R1, R24, R25
Depends on: T1
Boundary: `src/date.js`, `tests/unit/date.test.js`
Done when: `toDateKey` and `formatDate` match the contract in `design.md`; unit tests cover zero padding, local midnight boundary (23:59 and 00:00 give different keys), all seven weekday names, and the example "Thứ Hai, 09/11/2026" for 9 November 2026; `npm test` passes.

## T3: Task store and persistence
Owner: be
Requirements: R2, R7, R8, R9, R11, R12, R14, R15, R19, R21, R22, R23, R24, R26, R27
Depends on: T1, T2
Boundary: `src/store.js`, `tests/unit/store.test.js`
Done when: `validateText`, `getStorage`, `createStore` and the store methods match the contract and loading rules in `design.md`; unit tests with a fake storage cover every case listed under "Test strategy, Unit" (validation limits with emoji and diacritics, ordering, date filter, persistence across a new store, corrupt and non array data with backup, invalid items dropped, read failure lockout, write failure keeps memory and the old stored value, recovery sets `storageOk` back to true); `npm test` passes.

## T4: Page shell and initial render
Owner: fe
Screens: ux/screens/today.html, ux/screens/today--empty.html, ux/screens/today--all-done.html
Requirements: R1, R2, R3, R4, R5, R22, R30
Depends on: T2, T3
Boundary: `index.html`, `src/app.js`, `tests/e2e/app.spec.js`
Done when: `index.html` holds the full shell from the prototype (header band with empty nav slot, date line, progress, summary with `role="status"`, hidden storage slip, add form with hidden error line, empty state, list, delete `<dialog>`, row and edit `<template>` elements, CSP meta tag); `app.js` renders today's tasks from the store with `textContent`, shows the empty state and hides progress and summary when there are none, sets `--p` and the summary "Đã hoàn thành {done}/{total} việc", and adds `.progress--complete` without animation when all are done; e2e tests seed `localStorage` and check the date line for a fixed clock, the order of rows, a task from another date not shown, the empty state, and `<b>abc</b>` shown as text.

## T5: Add a task with validation
Owner: fe
Screens: ux/screens/today.html, ux/screens/today--add-error.html
Requirements: R5, R6, R7, R8, R9, R10, R21
Depends on: T4
Boundary: `src/app.js`, `tests/e2e/app.spec.js`
Done when: Thêm and Enter add a row at the end with `.task--enter`, clear the input and keep focus; the summary updates; empty or over 200 character input shows the matching message with `aria-invalid` and `aria-describedby`, and typing removes it; the e2e smoke test (add, reload, task still there) and the two error tests pass.

## T6: Complete, undo, progress and star stamp
Owner: fe
Screens: ux/screens/today.html, ux/screens/today--all-done.html
Requirements: R4, R5, R11, R12, R21
Depends on: T4
Boundary: `src/app.js`, `tests/e2e/app.spec.js`
Done when: ticking and unticking save through `store.setDone`, rows keep their position, the summary and `--p` update; ticking the last open task adds `.progress--complete` and `.progress--celebrate` and removes `.progress--celebrate` after about 1 second; unticking removes both; adding a task while all are done removes `.progress--complete`; e2e tests for tick, untick after reload, and the stamp classes pass.

## T7: Edit a task in place
Owner: fe
Screens: ux/screens/today--edit.html
Requirements: R13, R14, R15, R16, R17
Depends on: T4
Boundary: `src/app.js`, `tests/e2e/app.spec.js`
Done when: Sửa opens the edit form in the row with `.task--editing`, prefilled and focused with the caret at the end; Lưu and Enter save valid text and keep done state and position; invalid text keeps edit mode with the matching error; Hủy and Escape restore the old text; opening Sửa on another row closes the first without saving; adding a task and ticking other rows still work while editing; focus returns to the row's Sửa button; e2e tests for save, error, cancel and one edit at a time pass.

## T8: Delete with sticky note confirmation
Owner: fe
Screens: ux/screens/today--delete.html
Requirements: R5, R18, R19, R20
Depends on: T4
Boundary: `src/app.js`, `index.html` (dialog markup only), `tests/e2e/app.spec.js`
Done when: Xóa opens the native dialog with `showModal()`, the question as title, the task quoted with `textContent`, and focus on Giữ lại; Giữ lại, Escape and a backdrop click keep the task and return focus to Xóa; Xóa việc plays `.task--exit`, removes the task from the store and the list, updates the summary, shows the empty state when the list is empty, and moves focus to the next row's checkbox or the add input; e2e tests for all three exits pass.

## T9: Phone row actions and one time swipe hint
Owner: fe
Screens: ux/screens/today--swipe.html
Requirements: R28, R29
Depends on: T7, T8
Boundary: `src/app.js`, `docs/project/design-system.css` (add `.task--peek` keyframe and its reduced motion rule), `docs/project/design-system.md` (motion table row), `tests/e2e/app.spec.js`
Done when: on the phone layout only one row stays swiped open (others reset to `scrollLeft = 0` when one opens or the list is tapped); Tab to Sửa scrolls the row open; the first row peeks once the first time tasks exist and `daily-todo:swipe-hint-seen` is then set, and it does not play again after reload or under reduced motion; e2e tests on the `mobile` project for the peek playing once and for no horizontal scroll at 360 px pass.

## T10: Storage unavailable slip
Owner: fe
Screens: ux/screens/today--storage-error.html
Requirements: R26, R27
Depends on: T5, T6
Boundary: `src/app.js`, `tests/e2e/app.spec.js`
Done when: the slip is shown whenever `store.storageOk` is false (on load or after any failed save) and hidden after the next successful save; the app keeps working in memory; e2e tests pass for a blocked `setItem` (slip shown, add and tick still work), a throwing `localStorage` getter (slip shown on load), and a corrupt stored value (empty state, no slip, no console error).

## T11: Day change while the page is open
Owner: fe
Screens: ux/screens/today--new-day.html
Requirements: R24, R25
Depends on: T7, T8
Boundary: `src/app.js`, `tests/e2e/app.spec.js`
Done when: `checkDay()` runs on `visibilitychange` (visible), window `focus`, and before every add; when the date changed it drops any open edit, closes the dialog, refreshes the date line and shows the new day's list; an e2e test with `page.clock.setFixedTime` moved past midnight plus a `visibilitychange` event shows the new date and the empty state, and the previous day's tasks are still in `localStorage`.

## T12: Keyboard, layout and final acceptance pass
Owner: fe
Screens: all files in ux/screens/
Requirements: R28, R29, R30, NFR performance
Depends on: T9, T10, T11
Boundary: `tests/e2e/app.spec.js`, small fixes in `src/app.js` and `index.html` only
Done when: an e2e test completes add, tick with Space, edit with Enter, cancel with Escape and delete using only the keyboard; every button and checkbox has its Vietnamese accessible name; there is no horizontal scroll at 360 px with a long task; seeding 200 tasks renders and a tick updates without visible delay; light and dark mode match the prototype screenshots on a manual check; `npm test` and `npm run test:e2e` pass in full.
