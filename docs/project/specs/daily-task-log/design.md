# Design: daily-task-log

## Approach

The app is one static page built with plain HTML, the approved `design-system.css`, and three small vanilla JavaScript ES modules. There is no framework and no build step. The screen has one view with a short list (up to about 200 rows), every state is already drawn as HTML in the prototype, and the data layer is a few functions around `localStorage`, so a framework or bundler would add tooling without removing any real work. The browser loads the modules directly with `<script type="module">`.

The code is split along the one boundary that matters for the next feature:

1. `src/date.js` and `src/store.js` hold all non UI logic (local date keys, Vietnamese date text, validation, the task store and persistence). They have no DOM access, run in Node for unit tests, and are what `day-navigation` will reuse unchanged.
2. `src/app.js` owns the DOM: it renders the prototype markup from `<template>` elements, wires the events, and calls the store.

The markup, class names and ARIA patterns are copied from `ux/screens/*.html`. Styling comes only from `docs/project/design-system.css`; the one addition (the swipe peek keyframe) is added to that file and documented in `design-system.md`, as the design system asks.

There is no existing code to follow yet. This feature sets the conventions: ES modules, no runtime dependencies, `textContent` for all user text, and one devDependency (`@playwright/test`).

## Files

| File | Responsibility |
| --- | --- |
| `package.json` | `"type": "module"`, scripts, the single devDependency `@playwright/test` |
| `.gitignore` | `node_modules/`, `test-results/`, `playwright-report/`, `.playwright-mcp/` |
| `README.md` | How to run, test, and where things live (short) |
| `playwright.config.js` | `webServer` (static server on port 4173), `baseURL`, `locale: 'vi-VN'`, `timezoneId: 'Asia/Ho_Chi_Minh'`, projects `desktop` (Desktop Chrome) and `mobile` (Pixel 7, touch) |
| `index.html` | Page shell from `ux/screens/today.html`: header band (title, empty nav slot, date line, progress, summary, hidden storage slip), add form with hidden error line, empty state, `<ul>`, delete `<dialog>`, and `<template>` elements for a task row and the edit form. Links `docs/project/design-system.css` and `src/app.js` |
| `src/date.js` | Local date key and Vietnamese date text (no DOM) |
| `src/store.js` | Task model, validation, in memory list for all days, load and save to `localStorage`, storage health flag (no DOM) |
| `src/app.js` | Rendering, events, focus management, edit mode, delete dialog, progress and stamp, swipe behaviour and peek hint, storage slip, day change check |
| `docs/project/design-system.css` and `.md` | Add `.task--peek` keyframe (one time swipe hint) and its row in the motion table, disabled under reduced motion |
| `tests/unit/date.test.js` | `node:test` unit tests for `date.js` |
| `tests/unit/store.test.js` | `node:test` unit tests for `store.js` with a fake storage object |
| `tests/e2e/app.spec.js` | Playwright smoke and acceptance tests |

## Data model

One `localStorage` key holds every task for every day, so `day-navigation` only needs to call `tasksFor(otherDateKey)`.

Key `daily-todo:tasks:v1`, value is a JSON array of tasks:

```js
{
  id: "3f6c0e7a-...",        // crypto.randomUUID(), with a Date.now + Math.random fallback
  text: "Đi chợ mua rau",    // trimmed, otherwise exactly as typed (no Unicode normalisation)
  done: false,
  createdAt: 1762678800000,  // epoch milliseconds
  date: "2026-11-09"         // local calendar date when created (yyyy-mm-dd)
}
```

The array is kept in creation order. A second key, `daily-todo:swipe-hint-seen` (value `"1"`), remembers that the phone swipe hint has played.

Loading rules (R27, NFR5):

1. If `localStorage` cannot be reached or `getItem` throws, start empty, set `storageOk = false`, and do not write for the rest of the session. This prevents an in memory list from overwriting earlier days that could not be read.
2. If the key is missing or empty, start empty.
3. If the value is not valid JSON or not an array, copy the raw string once to `daily-todo:tasks:v1:corrupt` (best effort), then start empty. The next save replaces the main key.
4. Items that fail the shape check (`id` non empty string, `text` string, `done` boolean, `createdAt` finite number, `date` matching `^\d{4}-\d{2}-\d{2}$`) are dropped; valid items are kept.

## Interfaces (contract between `be` and `fe` tasks)

```js
// src/date.js
export const WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
export function toDateKey(date = new Date()) {}   // "2026-11-09", local time, zero padded
export function formatDate(date = new Date()) {}  // "Thứ Hai, 09/11/2026"
// app.js builds the date line as "Hôm nay, " + formatDate(now).
// day-navigation can reuse formatDate for other days without the "Hôm nay" prefix.

// src/store.js
export const STORAGE_KEY = 'daily-todo:tasks:v1';
export const MAX_LENGTH = 200;
export function validateText(raw) {}   // { text } | { error: 'empty' | 'tooLong' }
export function getStorage() {}        // window.localStorage, or null if access throws
export function createStore(storage) {} // storage: { getItem, setItem } or null

// Store returned by createStore
store.storageOk            // boolean: false after a failed read or the last write failed
store.tasksFor(dateKey)    // Task[] copies for that date, oldest first
store.add(raw, now = new Date())  // { task } | { error }; date = toDateKey(now)
store.updateText(id, raw)  // { task } | { error }; keeps done, date, position
store.setDone(id, done)    // Task
store.remove(id)           // void
```

Rules inside the store:

1. Length is counted in Unicode code points after trimming (`[...text].length`), so an emoji or a precomposed Vietnamese letter counts as one character. `validateText` trims with `String.prototype.trim()`.
2. Every mutation changes the in memory array first, then calls `save()` synchronously. `save()` runs `setItem(STORAGE_KEY, JSON.stringify(all))` in a try block and sets `storageOk` to true on success and false on failure. Because it is synchronous, the change is stored before the next event is handled (R21). A failed `setItem` leaves the previous stored value intact (NFR5).
3. The store never touches the DOM and never formats text for display.

## UI behaviour (`src/app.js`)

State kept in the module: `shownDate` (date key on screen), `editingId`, `pendingDeleteId`.

1. Start: `store = createStore(getStorage())`, `shownDate = toDateKey()`, `renderAll()`. If every task is done, add `.progress--complete` only (no animation). Focus the add input.
2. `renderAll()`: set the date line, clear and rebuild the list from `store.tasksFor(shownDate)`, toggle the empty state, update the summary and progress, and show or hide the storage slip. Used on load and on day change only.
3. Small updates after each action: add appends one row, delete removes one row, tick changes nothing in the row (CSS `:has()` draws the done style), edit swaps one row. Then `updateSummary()` and `updateSlip()` run. This keeps focus stable and lets the CSS motion play.
4. Rows are cloned from `<template>`; task text is set with `textContent` only (R30). Element ids use `task-<id>-text` for `aria-describedby`. Sửa and Xóa are real `<button>` elements.
5. Add: the form `submit` handler calls `checkDay()` first, then `store.add`. On error it sets `aria-invalid="true"`, shows the field error line with `role="alert"` and the matching message, and links it with `aria-describedby`; the next `input` event removes both (R10). On success it appends the row with `.task--enter`, clears the input, and keeps focus. No `maxlength` attribute.
6. Complete: the checkbox `change` handler calls `store.setDone`. If done now equals total and total is above zero, add `.progress--complete` and `.progress--celebrate`, and remove `.progress--celebrate` after 1000 ms. Unticking removes both. After a delete or add, the complete class is recalculated without the celebrate class.
7. Edit: Sửa closes any other open edit without saving, replaces the row's `.task__swipe` with the edit form template, prefills, focuses with the caret at the end, and adds `.task--editing`. Enter or Lưu calls `store.updateText`; on error the row stays in edit mode with the field error. Escape or Hủy restores the row. Focus returns to the row's Sửa button after save or cancel.
8. Delete: Xóa stores `pendingDeleteId`, fills the quote with `textContent`, and calls `dialog.showModal()`; Giữ lại has `autofocus`. Giữ lại, Escape (`cancel` event) and a backdrop click close it and return focus to the Xóa button. Xóa việc closes it, calls `store.remove`, plays `.task--exit`, removes the row on `animationend` (or straight away under reduced motion), updates the summary, and moves focus to the next row's checkbox, else the previous one, else the add input.
9. Phones (`matchMedia('(hover: none), (max-width: 600px)')`): scroll snap in CSS does the swipe. Script only resets `scrollLeft = 0` on other rows when one scrolls open or when the list is tapped. Peek hint: the first time at least one row exists on a phone layout and `daily-todo:swipe-hint-seen` is not set, add `.task--peek` to the first row once, remove it on `animationend`, and set the flag. Skip the animation (but still set the flag) under `prefers-reduced-motion`. If storage is not available the hint may replay on the next load, which is acceptable.
10. Storage slip: shown when `store.storageOk` is false, hidden again when it turns true after a successful save (R26).
11. Day change: `checkDay()` runs on `visibilitychange` (when visible), on window `focus`, and before every add. If `toDateKey()` differs from `shownDate`, it drops any open edit, closes the dialog, sets `shownDate`, and calls `renderAll()` (R25). Earlier days stay in the store.

## Error handling and security

1. Every `localStorage` call is inside try and catch in `store.js`; failures only flip `storageOk` and never throw to the UI. No technical message is ever shown (R27).
2. User text is only ever written with `textContent` or `value`. The code uses no `innerHTML`, `insertAdjacentHTML` or string templates for task text (R30). Static icons live in the `<template>` markup.
3. No network calls, no analytics, no third party scripts or fonts. A `Content-Security-Policy` meta tag (`default-src 'self'; img-src 'self' data:; style-src 'self'`) is added to `index.html` to keep it that way. The grain texture is an inline data URI, which `img-src data:` allows; the implementer should confirm in the browser console that the CSS SVG variables load under this policy and relax only the specific directive if not.
4. Multiple tabs open at once are not synchronised; the last tab to save wins. This is acceptable for a single owner and is noted for later.

## Running locally

```bash
npm install
npx playwright install chromium   # once, for e2e tests
npm start        # python3 -m http.server 4173, then open http://localhost:4173
npm test         # unit tests: node --test tests/unit/
npm run test:e2e # Playwright, starts the server itself
```

Modules need `http://` (not `file://`). Any static server pointed at the repo root works if Python is not available. `index.html` sits at the repo root and links `docs/project/design-system.css` directly, so the design system stays one file.

## Test strategy

Unit (Node built in test runner, no extra dependency), covering all non UI rules:

1. `date.test.js`: `toDateKey` pads months and days, uses local time (`new Date(2026, 10, 9, 23, 59)` and `new Date(2026, 10, 10, 0, 0)` give different keys), and `formatDate` returns each of the seven weekday names and `dd/mm/yyyy`.
2. `store.test.js` with an in memory fake storage and a throwing fake: validation (empty, spaces only, exactly 200, 201, emoji and diacritics counted as one, trimming kept otherwise), add sets date and createdAt, `tasksFor` filters by date and keeps creation order, `updateText` keeps done and order, `setDone`, `remove`, data survives a new `createStore` on the same storage, corrupt JSON and non array values start empty and back up the raw value, invalid items are dropped, `getItem` throwing gives `storageOk = false` and no later writes, `setItem` throwing keeps the change in memory and the previous stored value intact, a later successful save sets `storageOk` back to true.

End to end (Playwright, Chromium desktop plus a Pixel 7 project for touch):

1. Smoke: load, empty state, add two tasks, tick one, summary reads "Đã hoàn thành 1/2 việc", reload, same tasks and states.
2. Add errors for empty and 201 characters, message cleared on typing.
3. Edit save, edit error, Escape cancel, one edit at a time.
4. Delete dialog with Giữ lại, Escape, and Xóa việc.
5. All done adds the stamp classes; untick removes them.
6. `<b>abc</b>` shows as text.
7. Storage blocked through `page.addInitScript` (setItem throws) shows the slip and keeps working.
8. Corrupt stored value shows the empty state with no error.
9. Day change with `page.clock.setFixedTime` then a `visibilitychange` event shows the new date and an empty list; reload on the old date still shows old tasks.
10. Keyboard only flow, 360 px width has no horizontal scroll, swipe peek plays once on the mobile project.

Cross browser checks in Safari and Firefox (NFR3) are done by hand before release; adding WebKit and Firefox projects later is a one line change each.

## Requirement mapping

| Req | Satisfied by |
| --- | --- |
| R1 | `date.js` `formatDate`, `app.js` start and `renderAll` |
| R2 | `store.tasksFor`, `app.js` `renderAll` |
| R3 | `app.js` empty state toggle |
| R4 | Row template, design system `:has()` done style |
| R5 | `app.js` `updateSummary` after every action |
| R6 | `app.js` add handler, `store.add` |
| R7, R8 | `store.validateText`, `app.js` field error |
| R9 | `store.validateText` trim only |
| R10 | `app.js` input listener |
| R11, R12 | `app.js` checkbox handler, `store.setDone`, no reordering |
| R13 to R17 | `app.js` edit mode, `store.updateText` |
| R18 to R20 | `index.html` dialog, `app.js` delete handlers, `store.remove` |
| R21 | Synchronous `save()` in every store mutation |
| R22 | `store` load from `localStorage` |
| R23, R24 | Task shape in `store.add` with `toDateKey(now)` |
| R25 | `app.js` `checkDay` |
| R26 | `store.storageOk`, read failure lockout, `app.js` slip |
| R27 | Store loading rules, no thrown errors |
| R28 | Native form, checkbox, buttons and dialog, ARIA from the prototype, focus rules |
| R29 | Design system responsive CSS, swipe rows, peek hint |
| R30 | `textContent` only, template cloning |
