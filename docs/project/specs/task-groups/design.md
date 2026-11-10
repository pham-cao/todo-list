# Design: task-groups

## Approach

This feature extends the shipped `daily-task-log` and `day-navigation` code and keeps the same stack: one static page, `design-system.css`, vanilla ES modules, no build step and no new dependency. Tests stay on `node:test` and Playwright.

The work splits along the existing boundary between pure data modules and the UI:

1. `src/store.js` (tasks) learns an optional `groupId` on a task, can report how many tasks a group holds and on which days, and can move every task of a group in one all or nothing write. The task shape of `daily-task-log` does not change: `groupId` is only written when a task has a group.
2. `src/groups.js` (new) owns the list of groups (`daily-todo:groups:v1`) and the collapsed sections (`daily-todo:ui:v1`): name rules, colour order, the 20 group limit, load with the same "copy corrupt data aside, never overwrite after a failed read" rules as the task store. No DOM, unit tested in Node.
3. `src/app.js` renders the day as sections, and adds the group choice in the add form and the edit form, the "Nhóm mới..." line, and the filter.
4. `src/manage.js` (new) owns the "Nhóm việc" dialog and the dialogs opened from it (delete question, delete blocked, move all). It is a natural seam: its own markup, its own focus rules, and it only talks to the rest of the page through a few callbacks. This keeps `app.js` (441 lines today) readable and lets the dialog work proceed without touching the list code.

The collapsed state is stored with the groups module rather than a third module, because it is a list of group ids and is cleaned when a group is removed.

Cache busting uses one version value per release, written as `?v=<version>` on the stylesheet link, the entry script, and every internal module import, with a unit test that fails when any reference is missing or differs from the `version` in `package.json`.

### Markup follows the final design system

Markup and class names come from the "Task groups" block of `docs/project/design-system.css` and from `ux/screens/*.html`. The owner has asked UX to restyle the group label from the highlighter swipe to a paper sticker (decisions.md, last entry), so the label markup and its classes may change. This design therefore refers to components by role (section header, group label, swatch, line select, group bar, index card dialog, info slip). The FE must copy the final classes from `design-system.css` and the final screens at the time of the task, and keep the section markup in one `<template>` in `index.html` so a later restyle touches one place. The prototypes use `<a>` elements to link the static screens; production uses `<button type="button">` with the same classes (as in day-navigation). The prototype rename input is named "Sửa"; production uses "Tên nhóm" (decisions.md).

## Files to create or change

| File | Owner | Change |
| --- | --- | --- |
| `src/store.js` | be | `validateText(raw, max)`, export `newId`, `groupId` on `add` and `updateText`, `groupUsage`, `moveGroup` |
| `src/groups.js` | be | New: group rules, `createGroups(storage)` with groups and collapsed state |
| `tests/unit/store.test.js` | be | Tests for the new store behaviour; existing tests unchanged |
| `tests/unit/groups.test.js` | be | New |
| `tests/unit/version.test.js` | be | New: every asset reference carries the same version |
| `package.json` | be | `version` becomes the release value (`1.2.0`, see open questions) |
| `index.html` | be (version only), fe | `?v=` on the stylesheet and entry script (be); group choice, new group line, group bar, notice, live region, list container, templates and dialogs (fe) |
| `src/app.js` | fe | Sections, collapse, add and edit with a group, new group line, filter, notices; versioned imports |
| `src/manage.js` | fe | New: manage dialog, rename and recolour, delete, blocked, show tasks, move all |
| `tests/e2e/helpers.js` | fe | Seed groups and UI state, new locators |
| `tests/e2e/groups.spec.js` | fe | New: this feature's end to end tests |
| `tests/e2e/app.spec.js`, `tests/e2e/day-nav.spec.js` | fe | Expected Tab order and names lists only (see "Existing tests") |

No change to `design-system.css`, `design-system.md` or `playwright.config.js`.

## Data model

### Tasks, key `daily-todo:tasks:v1` (unchanged key and shape)

```js
{ id, text, done, createdAt, date, groupId? }  // groupId: string, present only when the task has a group
```

1. A task without `groupId`, with `null`, with a non string, or with an id that matches no group is shown as ungrouped and is never rewritten or dropped (R57, R58). `isValid` in `store.js` does not look at `groupId`.
2. Taking a task out of a group deletes the field, so ungrouped tasks keep the exact `daily-task-log` shape and existing tests that compare stored objects keep passing.
3. An older copy of the app ignores the field and keeps it when it saves, because it copies tasks with `{ ...t }` (NFR3).

### Groups, key `daily-todo:groups:v1`

```js
[{ id: "uuid", name: "Công ty", color: "yellow", createdAt: 1762653600000 }, ...]  // creation order
```

1. `color` is one of `yellow`, `pink`, `green`, `blue`, `orange`, `purple` (R9, R56).
2. On load, items without a non empty string `id`, a non empty string `name`, or a finite `createdAt` are dropped. An item whose id is a reserved choice value (`all`, `none`, `new`) is dropped too, so a stored id can never be confused with a menu entry. A missing or unknown `color` becomes `yellow` in memory (R59).
3. A value that is present but is not a JSON array is copied once to `daily-todo:groups:v1:corrupt` (best effort), and the app starts with no groups (R59).

### UI state, key `daily-todo:ui:v1`

```js
{ "collapsed": ["uuid-1", "none"] }  // "none" is the code for Chưa phân nhóm
```

Missing, unreadable, or wrongly shaped values are ignored with no copy and no message (R60). Unknown ids are harmless because only shown sections are looked up.

### Section key

Everywhere in the UI a section is named by a key: the group id, or `"none"` (`UNGROUPED`) for Chưa phân nhóm and for tasks whose group no longer exists. The same key is used for `<option>` values, the filter value (plus `"all"`), the add choice (plus `"new"` for Nhóm mới...), and the collapsed list. Group ids are only ever used as values, `dataset` entries and `Map` keys, never inside a CSS selector or markup.

## Interfaces

### `src/store.js` (owner `be`)

```js
export function validateText(raw, max = MAX_LENGTH) {}  // same rules; max lets group names reuse it (30)
export const newId = () => {};                          // exported for groups.js

store.add(raw, now = new Date(), dateKey = toDateKey(now), groupId = null)
// { task } | { error }; writes groupId only when it is a non empty string

store.updateText(id, raw, groupId)
// groupId undefined: keep the group (existing callers); null: remove the field; string: set it.
// Text is validated first; on { error } neither text nor group changes (R26). One save for both (R24, R55).

store.groupUsage(groupId)
// { count, days }: number of tasks with that groupId on any day, done or not, and the distinct date keys
// that hold them, ascending. { count: 0, days: [] } for an unused id (R52, R53, R67).

store.moveGroup(fromId, toId)
// toId: group id or null (ungrouped). Builds the new array in memory (only groupId changes, R69), writes
// it with ONE setItem of the tasks key, and only then replaces the in memory list (R70).
// { moved: n } on success, { moved: 0 } with no write when the group has no tasks,
// { error: "save" } when setItem throws: memory and storage keep every task in its source group.
// When the store is locked (storage unavailable since load) the move is applied in memory only and
// returns { moved: n }, like every other change in that session (R61; see open questions).
// A failed move does not change storageOk; the error is shown in the move card.
```

`tasksFor`, `setDone` and `remove` are unchanged and return `groupId` with each task through the existing spread.

### `src/groups.js` (owner `be`)

```js
import { validateText, newId } from "./store.js?v=1.2.0";

export const GROUPS_KEY = "daily-todo:groups:v1";
export const UI_KEY = "daily-todo:ui:v1";
export const MAX_GROUPS = 20;
export const MAX_NAME = 30;
export const UNGROUPED = "none";
export const COLORS = ["yellow", "pink", "green", "blue", "orange", "purple"];
export const COLOR_NAMES = { yellow: "Vàng", pink: "Hồng", green: "Xanh lá", blue: "Xanh dương", orange: "Cam", purple: "Tím" };
export const UNGROUPED_NAME = "Chưa phân nhóm";

// Trim, then validateText(raw, MAX_NAME) for empty and length (NFC code points, R3 to R5).
// Duplicate: NFC + toLowerCase equals another group's name (ignoring selfId) or UNGROUPED_NAME (R6).
// { name } | { error: "empty" | "tooLong" | "duplicate" }; the name is kept as typed apart from the trim.
export function validateGroupName(raw, groups, selfId = null) {}

// Colour after the most recently created group's colour, wrapping; "yellow" when there are none (R10).
export function nextColor(groups) {}

export function createGroups(storage) {}
// returns {
//   storageOk,                          // false after a failed read or write (R61)
//   list(),                             // copies, creation order
//   get(id),                            // copy or undefined
//   create(raw, now = new Date()),      // { group } | { error: "tooMany" | "empty" | "tooLong" | "duplicate" }
//                                       // tooMany is checked first (R7); colour from nextColor (R10)
//   update(id, raw, color),             // { group } | { error }; an unknown color keeps the current one (R36)
//   remove(id),                         // removes the group and its collapsed entry. The CALLER must have
//                                       // checked store.groupUsage(id).count === 0 (R51, R52)
//   isCollapsed(key), setCollapsed(key, on),  // key is a group id or UNGROUPED (R40)
// }
```

Load and save follow `createStore`: one `locked` flag for the instance, set when reading storage throws, after which nothing is written this session. A failed write sets `storageOk = false` and keeps the change in memory. The groups write and the UI write are independent `setItem` calls.

### `src/manage.js` (owner `fe`)

```js
import { COLORS, COLOR_NAMES } from "./groups.js?v=1.2.0";

export const GROUP_ERRORS = { empty, tooLong, duplicate, tooMany }; // also used by the add form in app.js
export function setFieldError(input, errorEl, code, messages) {}    // shared field error helpers, used by app.js too
export function showFieldError(input, errorEl, code, messages) {}

export function createManage({ groups, store, button, refresh, notify, showGroupTasks }) {}
// returns { open(), sync() }
// groups: a getter, () => groups, because the storage listener in app.js replaces the groups instance
// store: the task store, read with groupUsage(id) for the inactive move button (R67)
// sync(): another tab changed the groups; the open card re-renders its rows unless a row is in edit
// button: the "Quản lý nhóm" button, focus target when the card closes (R38, R71)
// refresh(): app rebuilds the add choice, the filter and the day list and updates the storage slip;
//            called every time the "Nhóm việc" card closes (R37, R38, R48)
// notify(text): app shows the polite info slip (R71)
// showGroupTasks(groupId): app sets the filter and add choice and turns to the nearest day (R53)
```

### Cache busting

1. The version value is the `version` field of `package.json`. This release sets it to `1.2.0` (`1.0.0` daily-task-log, `1.1.0` day-navigation).
2. `index.html`: `href="docs/project/design-system.css?v=1.2.0"` and `src="src/app.js?v=1.2.0"`.
3. Every relative import in `src/*.js` carries the same query: `./date.js?v=1.2.0`, `./store.js?v=1.2.0`, `./groups.js?v=1.2.0`, `./manage.js?v=1.2.0`. A browser keys modules by full URL, so every import of a module must use the same query or the module would load twice; the test guarantees that.
4. `tests/unit/version.test.js` reads `package.json`, collects every `href` and `src` in `index.html` that points to a local file (skipping `data:` and `#`), and every `import ... from "..."`, `import "..."` and `import("...")` specifier in `src/*.js` that starts with `./`. Each must end with `?v=<version>` and the file it names must exist.
5. Release step (added to the release checklist): bump `version` in `package.json`, then replace the old `?v=` value in `index.html` and `src/*.js`, for example `sed -i 's/?v=1\.2\.0/?v=1.3.0/g' index.html src/*.js`. `npm test` fails if one was missed.
6. Unit tests keep importing `../../src/store.js` without a query. Node then loads `store.js` twice when `groups.js` imports it with the query; that is harmless because `store.js` keeps no module level state. Node 20 supports query strings in file imports (checked).
7. The Content-Security-Policy is unchanged; versioned URLs are still `'self'`. Python's `http.server` and GitHub Pages ignore the query.

## UI behaviour

### Markup added to `index.html` (owner `fe`)

1. Add form: after the input, the group choice (label "Nhóm", line select `#new-task-group`, with the swatch of the chosen group before it). Under the line, the hidden new group line `#new-group-line`: swatch preview, input `#new-group-name` (placeholder and `aria-label` "Tên nhóm mới"), `button type="button"` "Tạo nhóm", and a `.field-error` `#new-group-error`.
2. Group bar after the add form: funnel in the margin, the filter (label "Lọc theo nhóm", select `#group-filter`, hidden until a group exists, R42), and the "Quản lý nhóm" button `#manage-groups`, present on every day (decisions.md).
3. The list `<ul class="task-list" id="task-list">` becomes a container `<div id="day-list">`. It holds either one plain `ul.task-list` (R31) or sections. Every list of rows keeps the class `task-list`, so `.task-list > .task` (used by the existing tests) still finds every row.
4. `#group-empty`: the filter empty state line (R44), hidden by default.
5. Header: `#notice`, the info slip (`role="status"`, hidden), and `#sr-status`, a visually hidden polite live region for the moved section name (R28).
6. Templates: `#group-template` (section with `data-color`, `h2` header containing a `button type="button"` toggle with `aria-expanded`, chevron, group label, count, then `ul.task-list`); the edit template gains the group choice (label "Nhóm") on the button line; `#group-row-template` and `#group-edit-template` for the dialog (rename input named "Tên nhóm", fieldset "Màu nhóm" with six radios named from `COLOR_NAMES`, Hủy, Lưu, field error).
7. Dialogs (native `<dialog>`, `showModal`): `#manage-dialog` (index card, title "Nhóm việc", "Đóng", rows, empty text), `#group-delete-dialog` (sticky note, `role="alertdialog"`, "Giữ lại" autofocus and "Xóa nhóm"), `#group-blocked-dialog` (sticky note with stacked "Chuyển tất cả việc", "Xem các việc này", "Đã hiểu"), `#move-dialog` (index card form: "Chuyển đến nhóm" select, sentence, warning slip for the error, "Hủy", "Chuyển việc").

All group text is set with `textContent` or `value`; `data-color` is only ever set from `COLORS` (R65, NFR2).

### App state (`src/app.js`)

```js
const groups = createGroups(getStorage());
let filter = "all";      // "all" | UNGROUPED | group id; never stored, survives day moves (R45)
let addGroup = UNGROUPED; // effective add choice; reset on reload (decision 6)
let lists = new Map();   // section key -> ul.task-list on screen
```

`keyOf(task)` returns `task.groupId` when `groups.get(task.groupId)` exists, else `UNGROUPED`.

### Rendering the day

1. **`renderList()`** builds the content of `#day-list` from `store.tasksFor(viewed)`:
   1. Bucket tasks by `keyOf`, keeping creation order inside each bucket (R32). Section order is `groups.list()` order, then `UNGROUPED` (R29).
   2. Filter on a key: only that bucket, as a section whose header has no toggle (the static header variant) and is always expanded, ignoring the collapsed state (R41, R43). An empty bucket shows `#group-empty` with the group or ungrouped text, unless the day has no tasks at all, which shows the usual `#empty` (R44).
   3. Filter "all" and no task in a group: one plain `ul.task-list`, no header (R31). It is registered in `lists` under `UNGROUPED`.
   4. Otherwise one section per non empty bucket (R30), header from `#group-template`, toggle `aria-expanded` and the collapsed class from `groups.isCollapsed(key)` (R40). Chưa phân nhóm only appears here when another section is shown, so it can only be collapsed then (R39).
   5. Rows are reused: existing `.task` elements are collected by `data-id` before the rebuild and moved into the new lists; only missing rows are created with `renderRow`. This keeps an open edit on another row. If the focused element was inside a moved row, focus is put back with `focus({ preventScroll: true })`.
   6. One shot row classes (`task--enter`, `task--moved`) are removed on `animationend` and `animationcancel`, so a reused row never replays them.
   7. Ends with `updateSummary()`.
2. **`updateSummary()`** (existing) also writes each shown header's count `{done}/{total}` and the toggle name "Nhóm {name}, đã hoàn thành {done}/{total} việc" (R29, R33, R63). The summary line, progress and stamp still count the whole day, whatever the filter or collapsed state (R50).
3. **`renderDay()`** calls `renderList()` instead of building the list itself (R34).
4. **Collapse**: a click on a section toggle flips `aria-expanded` and the collapsed class and calls `groups.setCollapsed(key, collapsed)` (R39, R40). Rows are hidden by CSS; no rebuild.
5. **Tick**: unchanged, then `updateSummary()` updates the counts (R33).
6. **Delete** (existing note): the next focus target is the next live row in the whole container, else the previous one, else the add input. After the erase animation the row is removed; if its list has no other live row, `renderList()` runs (the section disappears, or the day falls back to the plain list), else `updateSummary()`.
7. `els.list` in the existing listeners (change, click, submit, keydown, input, the capturing scroll for swipe, animationend) becomes `#day-list`. Swipe and peek code is otherwise unchanged (R64).

### Add form group choice and new group line (R14 to R22)

1. **`renderChoices()`** rebuilds the add choice (Chưa phân nhóm, groups in order, Nhóm mới...), the filter (Tất cả nhóm, Chưa phân nhóm, groups) and shows the filter only when a group exists. It keeps `addGroup` and `filter` when they still exist, else sets them to `UNGROUPED` and `"all"` (R21, R48), and sets the swatches. Called on load, after a group is created, and from `refresh()`.
2. Choosing a group sets `addGroup`. Choosing "Nhóm mới..." opens the new group line with the swatch of `nextColor` and focuses the name input (R15); with 20 groups it opens with the "too many groups" error already shown (decisions.md).
3. In the name input, Enter (with `preventDefault`, since the input sits inside the add form) or "Tạo nhóm" calls `groups.create`. Success: `addGroup = group.id`, `renderChoices()`, hide the line, focus the add input; no task is created (R16). Error: keep the line open and show the message under it (R18). Typing clears the error (R8). Escape hides the line, sets the select back to `addGroup` and focuses it (R17).
4. **Add submit**: `checkDay(now)`; `groupId = groups.get(addGroup) ? addGroup : null`; if `addGroup` names a removed group, reset it to `UNGROUPED` (R21). `store.add(text, now, viewed, groupId)` (R19). On success:
   1. If the filter hides the new task's key: keep the filter, show the "hidden group" notice, `updateSummary()` (R47).
   2. Else if `lists` has the key: append the new row there (existing path, so a day without groups behaves exactly as today). Else `renderList()`. The new row gets `task--enter`; if its section was collapsed, expand it and store that (R22).
   3. Keep `addGroup` and focus the add input (R20). While the new group line is open, an add uses `addGroup` (the choice before "Nhóm mới...").

### Moving a task (R23 to R28)

1. `openEdit` fills the edit group choice with Chưa phân nhóm and every group, selecting `row.dataset.group` (set by `renderRow` from `keyOf`) (R23).
2. Submit: `store.updateText(id, text, key === UNGROUPED ? null : key)`. Invalid text: unchanged behaviour (R26). Escape and Hủy: unchanged, the select is discarded with the form (R25).
3. Same group: unchanged path. Changed group: before rebuilding, note the next and previous live rows. Then expand the target section (store it), `renderList()`, and:
   1. Target shown: add `task--moved` to the row, focus its Sửa button, write the target header name to `#sr-status` (R28).
   2. Filter hides the target: focus the next row's checkbox, else the previous one, else the add input (R28).

   The task lands where its `createdAt` puts it, because sections are always built in creation order (R24, R32). Works on any day (R27).

### Filter (R41 to R49)

1. A change of `#group-filter` sets `filter` and calls `renderList()` (R43). Choosing a group or Chưa phân nhóm also sets `addGroup` and the add choice to it; "Tất cả nhóm" leaves it (R46). The group bar gets its filtered modifier while `filter !== "all"`.
2. `filter` is not touched by `go`, `syncFromAddress` or `checkDay`, so it follows the owner across days (R45), and starts as `"all"` on every load. It never writes to storage (R49).
3. `resetTransient()` also hides `#notice`. Otherwise the notice stays until the next notice replaces it or the next successful add hides it.

### Manage dialog (`src/manage.js`, R35 to R38, R51 to R54, R67 to R72)

1. `open()` renders a row per group with swatch, name, Sửa, "Chuyển tất cả việc" and Xóa, or "Bạn chưa có nhóm nào." (R35). The move button is `aria-disabled="true"` with the hint "Nhóm này chưa có việc nào." (linked by `aria-describedby`) when `store.groupUsage(id).count === 0`; it stays focusable (R67).
2. **Rename and recolour**: Sửa turns that row into the edit form (any other open row edit is cancelled first). Lưu or Enter calls `groups.update`; an error shows under the input and the row stays in edit (R36, R4 to R6, R8); success re-renders the rows and focuses that row's Sửa. Hủy or Escape restores the row and focuses Sửa. Escape is handled in the dialog's `cancel` event: while a row is in edit it calls `preventDefault()` and cancels the edit instead of closing the card.
3. **Close**: "Đóng" or Escape closes the card, calls `refresh()` and focuses "Quản lý nhóm" (R37, R38). The card does not close on a backdrop click, because it holds forms.
4. **Delete** (R51, R52): Xóa reads `store.groupUsage(id)`.
   1. `count === 0`: the delete note with "Xóa nhóm "{name}"?". "Xóa nhóm" calls `groups.remove(id)`, re-renders the rows and focuses the next row's Sửa, else the previous, else "Đóng". "Giữ lại" or Escape focuses that Xóa again.
   2. `count > 0`: the blocked note with n = `count` and d = `days.length`. "Đã hiểu" or Escape focuses Xóa again. Xóa is never disabled.
5. **Xem các việc này** (R53): closes the note and the card (which runs `refresh()`), then `showGroupTasks(id)`. In `app.js`: `filter = addGroup = id`, `renderChoices()`, `day = days.findLast((d) => d <= today) ?? days[0]`, then `go(day)`, or `renderList()` when `day === viewed`. `go` writes the hash and history entry as any move (day-navigation R22 to R25). Focus goes to the "Quản lý nhóm" button.
6. **Move all** (R67 to R72), from the row button or the blocked note: the move card with title "Chuyển tất cả việc của nhóm "{name}"", the target choice (Chưa phân nhóm selected first, then every other group), and the sentence with n, d and the target name, rebuilt on each change of the target (R68). "Hủy" or Escape closes it with no change and focuses the button that opened it.
   1. "Chuyển việc" calls `store.moveGroup(id, target)`.
   2. `{ error }`: the card stays open with the target kept and shows "Không thể lưu thay đổi. Chưa có việc nào được chuyển." (R70).
   3. Success: `groups.setCollapsed(targetKey, false)`, close the move card and the "Nhóm việc" card (which runs `refresh()`), `notify("Đã chuyển {n} việc sang nhóm "{target}".")`, focus "Quản lý nhóm" (R71). The source group, its colour, its order and `addGroup` are untouched; a filter on the source stays and shows its empty state (R71, R72).

### Vietnamese text

All new strings are taken word for word from the requirements table, plus "Tên nhóm" for the rename input (decisions.md). Messages with values are built by small functions in the module that shows them, for example `blocked(name, n, d)`, so each string lives in one place. Errors map `empty`, `tooLong`, `duplicate`, `tooMany` to the four group errors.

## Error handling and security

1. **Storage** (R55, R61): every create, rename, recolour, delete, add and move saves at once. A failed write keeps the change in memory and shows the existing storage slip, which now reads `!store.storageOk || !groups.storageOk`. A failed read locks that module against writes for the session, as the task store does today.
2. **All or nothing move** (R70, NFR3): `moveGroup` never mutates the live array before `setItem` succeeds, so a throw leaves memory and storage untouched.
3. **No task loss** (R54, NFR3): deleting a group is only possible when `groupUsage` reports zero tasks, and `groups.remove` never touches tasks. Unknown `groupId` values are displayed as ungrouped and never cleaned up.
4. **Untrusted stored data** (NFR2): group names and ids go through `textContent`, `value`, `dataset` and `Map` keys only; colour codes are mapped through `COLORS` before reaching `data-color`. Reserved ids are dropped on load.
5. **CSP** unchanged; no inline scripts or styles are added (`style.setProperty` on custom properties, already used for progress, is allowed by the policy as before).

## Performance (NFR1)

A day with 200 tasks in up to 21 sections is built with one pass over the day's tasks and, after the first render, reuses its row elements, so add, move and filter only move existing nodes. Collapse is a class change. Row `content-visibility` already limits layout to visible rows. The e2e test times each action in the page with `performance.now()` plus a forced layout, as the day-navigation test does.

## Existing tests

1. `tests/unit/*`: all keep passing. New parameters are optional, ungrouped tasks keep their exact shape, and `validateText(raw)` keeps its default.
2. `tests/e2e/app.spec.js`, "every button and checkbox has its Vietnamese accessible name": the `main` list gains "Quản lý nhóm" after "Thêm" (T7). The edit row list is unchanged, because the edit group choice is a select.
3. `tests/e2e/app.spec.js`, "keyboard only ...": after the add input, Tab now reaches the group choice (T5) and "Quản lý nhóm" (T7) before the first checkbox, so the test gains those Tab stops.
4. `tests/e2e/day-nav.spec.js`, "200 rows: Tab from the add field into rows scrolled away ...": presses Tab twice to reach the first row; it needs four presses after T7 (input, group choice, Thêm, Quản lý nhóm, first checkbox).
5. `tests/e2e/day-nav.spec.js`, Tab order from the page start ends at `new-task` and does not change.
6. No test uses `#task-list`; the row helper `.task-list > .task` keeps working because every list of rows keeps that class.

## Test strategy

Unit (`node:test`):

1. `store`: `add` with and without a group (no `groupId` field when ungrouped); `updateText` sets, keeps and removes the group, and changes nothing on invalid text; `groupUsage` counts across days, done and not done, with distinct sorted days; `moveGroup` moves only the source group's tasks, keeps every other field, writes exactly once (counting `setItem` calls), and on a throwing `setItem` leaves `tasksFor` and the stored value unchanged; stored tasks without, with null, and with an unknown `groupId` load and are not rewritten.
2. `groups`: name rules (trim, emoji and diacritics kept, 30 code points after NFC accepted and 31 rejected, case and NFC insensitive duplicates, "chưa phân nhóm" rejected, renaming to own name in another case accepted); `nextColor` order, wrap and continuation after a deletion; the 20 group limit checked first; corrupt, non array, and bad item loads (drop, colour fallback, reserved ids, corrupt copy once); a throwing `getItem` locks writes; collapsed state round trip, garbage UI value ignored, `remove` cleans the collapsed entry.
3. `version`: as described under cache busting.

End to end (`tests/e2e/groups.spec.js`, desktop and mobile projects, the fixed clock and seeding of `helpers.js`, extended to seed the groups and UI keys):

1. Sections: order, hidden empty groups, plain list without headers, counts and names on headers, tick updates counts and summary, collapse remembered across reload and days, filter and collapsed state together, a section disappearing when its last task is deleted.
2. Add form: create on the fly (success, the three name errors, 20 groups error on choosing, Escape), add to a group, keep the choice, deleted group falls back, add to a collapsed section expands it, add to a hidden group shows the notice.
3. Edit move: choice preselected, save moves by creation time with focus on Sửa and the live region text, cancel keeps the group, invalid text changes nothing, move under a filter moves focus.
4. Filter: options, empty states, follows day moves, resets on reload, sets the add choice, never writes storage.
5. Manage: empty state, rename and recolour shown everywhere, errors, Escape cancels the edit without closing, delete confirm, blocked counts, show tasks picks the nearest day and writes the hash, move all success and notice, move all failure (stub `Storage.prototype.setItem` to throw for the tasks key) leaves every task in place, storage unavailable.
6. Compatibility and safety: data saved before the feature loads unchanged, corrupt groups and UI values, a group named `<b>abc</b>`, unknown colour shown as yellow.
7. Usability: Tab order and Enter or Escape on every new control, 44 by 44 px targets, no horizontal scroll at 360 px, swipe inside a section, reduced motion, and 200 tasks in 20 groups with add, move, collapse and filter each under 100 ms.

QA runs axe and the light and dark contrast checks manually, as in day-navigation.

## Requirement mapping

| Req | Satisfied by |
| --- | --- |
| R1, R2 | `createGroups` list in creation order; `groupId` on tasks |
| R3 to R6, R8 | `validateGroupName`; error clearing on input in the add form and the dialog |
| R7 | `create` checks `MAX_GROUPS` first; error shown on choosing "Nhóm mới..." |
| R9 to R13 | `COLORS`, `nextColor`, `data-color` from `COLORS` only, design system colours, radios named from `COLOR_NAMES` |
| R14 to R18 | Add choice, new group line, `renderChoices` |
| R19 to R22 | Add submit with `addGroup`; expand on add |
| R23 to R28 | Edit group choice, `updateText(id, raw, groupId)`, rebuild with focus rules, `#sr-status` |
| R29 to R34 | `renderList`, `updateSummary` counts, `renderDay` |
| R35 to R38 | `manage.js` rows, rename and colour form, close with `refresh()` |
| R39 to R41 | Section toggle, `isCollapsed` and `setCollapsed`, static header under a filter |
| R42 to R49 | Filter select, `filter` state, `#group-empty`, notice, `renderChoices` reset |
| R50 | `updateSummary` counts the whole day |
| R51 to R54 | `groupUsage` check, delete and blocked notes, `showGroupTasks`, `go` |
| R55 | Immediate save in every store and groups mutation |
| R56 to R60 | Keys and shapes, tolerant load, corrupt copy, colour fallback, UI value ignored when bad |
| R61 | `locked` and `storageOk` in both modules, shared slip |
| R62 | Native buttons and selects, Enter and Escape handlers, `cancel` event, focus rules |
| R63 | `h2` header with the toggle and its accessible name |
| R64 | Design system layouts, swipe code unchanged inside sections |
| R65 | `textContent` and `value` only |
| R66 | Design system styles and reduced motion rules |
| R67 to R72 | Move button state, move card, `moveGroup` single write, success and error handling |
| NFR1 | Row reuse, one pass bucketing, timed e2e |
| NFR2 | Text only rendering, `COLORS` mapping, CSP unchanged |
| NFR3 | No mutation before write in `moveGroup`, no task removal, optional `groupId` |
| NFR4 | Tolerant load of old data |
| NFR5 | `?v=` on every asset and import, `version.test.js` |
| NFR6 to NFR8 | Design system, native selects, Vietnamese strings from the table |
