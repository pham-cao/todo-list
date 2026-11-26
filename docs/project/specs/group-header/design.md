# Design: group-header

## Approach

This feature moves things that already work rather than adding new machinery. It keeps the same stack: one static page, `design-system.css`, vanilla ES modules, no build step, no new dependency, `node:test` and Playwright. It is built on its own branch after page-flip ships as 1.4.0.

1. The existing `#manage-groups` button moves from the group bar into the header, inside a new end column under "Về hôm nay". Its id, its click handler and the `button` that `createManage` returns focus to stay the same, so R2 needs no logic change. The group bar is hidden as a whole while no group exists (R4).
2. Group creation moves into `src/manage.js`, which already owns the card and the two sticky notes stacked over it (delete confirm, blocked note). The new box is a third note built the same way: a native `<dialog>` opened with `showModal()`, a sibling of the card in `index.html` (not nested in it, so the card's own `submit`, `keydown` and `cancel` listeners for rename never see the box's events). Creation reuses `groups.create()`, `nextColor()`, `GROUP_ERRORS`, `setFieldError()` and `showFieldError()` exactly as the old inline line did. No change to `src/groups.js` or `src/store.js` (R31).
3. The old inline "Nhóm mới..." line is deleted from `index.html`, `src/app.js`, the design system and the tests (R18, NFR7).
4. Phones: the three sticky note dialogs get the `.dialog--sheet` class from the UX proposal, and the viewport meta gains `interactive-widget=resizes-content`, so a bottom docked sheet rides above the on screen keyboard with no script (R29).
5. Page flip: the flip already copies the whole sheet, header included, with ids stripped and the copy inert (R24 holds with no change), and already ends when any dialog opens through its `toggle` listener. Two one line additions finish R22 and R23 (see below).

Markup and classes come from `ux/screens/*.html` and `ux/group-header.css`. The prototype uses links for click through; production uses real `<button>` elements.

## Files to create or change

| File | Task | Change |
| --- | --- | --- |
| `index.html` | T1 | `#manage-groups` moves into `<div class="day-nav__end">` with `#to-today`; classes `btn btn--ghost header-manage`, label span `header-manage__label`, no `data-tip`. `#group-bar` starts `hidden`; its inner parts lose their own `hidden` |
| `src/app.js` | T1 | `renderChoices()` shows or hides `els.bar` as a whole; `els.filterParts` goes. The `#manage-groups` click calls `drag.cancel(); flip.end();` before `manage.open()` |
| `src/flip.js` | T1 | `allowed()` also requires `!document.querySelector("dialog[open]")` (R23) |
| `docs/project/design-system.css`, `.md` | T1 | Merge UX section 1 (header end column, `.header-manage`) without the icon only block; delete `.group-bar__manage*` rules |
| `index.html` | T2 | In the card: `<button class="group-add" type="button" data-action="add">` before `#group-rows`, and a visually hidden live region `#manage-status`. New `<dialog id="new-group-dialog">` (markup below) |
| `src/manage.js` | T2 | The box: open, validate, create, cancel, sync, and close with the card |
| `docs/project/design-system.css`, `.md` | T2 | Merge UX sections 2 and 3 (`.group-add`, `.group-add + .group-rows`, `.group-row--new`, `.new-group*`, `.sticker--blank`) |
| `index.html`, `docs/project/design-system.css`, `.md` | T3 | `.dialog--sheet` on `#new-group-dialog`, `#group-delete-dialog`, `#group-blocked-dialog`; `@keyframes sheet-up`; viewport meta `width=device-width, initial-scale=1, interactive-widget=resizes-content` |
| `index.html`, `src/app.js`, design system | T4 | Delete `#new-group-template`, `newLine`, `openNewGroup`, `closeNewGroup`, `createGroup`, the three `els.form` listeners for the line, the `"new"` option, the `refresh()` swatch line, `.add-form__newgroup*` CSS and its design-system.md sentence |
| `tests/e2e/helpers.js` | T2 | `createGroup(page, name)`: open the card if closed, Thêm nhóm, fill, Enter, wait for the box to close |
| `tests/e2e/groups.spec.js`, `day-nav.spec.js`, `drag.spec.js` | T1 to T4 | See Test strategy |
| `package.json`, `package-lock.json`, `index.html`, `src/*.js` | T5 | Version 1.5.0 |

## Header and group bar (R1 to R4)

```html
<div class="day-nav__end">
  <button class="today-tab" id="to-today" ...>...Về hôm nay</button>
  <button class="btn btn--ghost header-manage" id="manage-groups" type="button"><svg class="icon" ... aria-hidden="true">tag</svg><span class="header-manage__label">Quản lý nhóm</span></button>
</div>
```

- The visible text is the accessible name at every width (R3, owner 2026-11-13). The UX block "Below 452 px: tag icon only" in `ux/group-header.css` is not merged, and no tooltip is drawn, since the label is always visible (see open question 1).
- Below 601 px the tag icon hides and the label uses `--fs-small`, matching how `.today-tab` already drops its icon on phones, so the column stays narrow. If the column cannot sit beside the picker at 360 px it wraps to its own right aligned line, as "Về hôm nay" already does at 360 px (decisions.md 2026-11-09). Either way there is no horizontal scroll; T1 measures it.
- 36 px drawn, 44 px hit area through `::before`, as in the UX CSS.
- Tab order falls out of DOM order: picker, Về hôm nay, Quản lý nhóm, then the add input.
- `renderChoices()`: `show(els.bar, groups.list().length > 0)`. The existing rule that moves focus from a vanishing filter to the add input stays.

## Page flip interplay (R22 to R25)

- R22: the header button click runs `drag.cancel(); flip.end();` then `manage.open()`. The flip's own `toggle` listener would also end it a task later; the explicit call makes it immediate.
- R23: `allowed()` in `flip.js` returns false while any `dialog[open]`, which covers `snapshot()` and `play()` in one place, including the held key release. `changeDay()` closes only the task delete note in `resetTransient()` before the snapshot, so a Back press behind the card or box changes the day with no flip, and the card, the box and the typed name are untouched (they are not part of the sheet).
- R24: no change. `copy()` clones the header with the button, strips ids, `for` and roles, and the stage is inert and aria-hidden. The real button never moves.
- R25: `showModal()` puts every dialog in the top layer, above the flip stage and the stack shadow. No z-index work.

## The box (R5 to R16, R26 to R28, R30)

Markup, a sibling of `#manage-dialog`:

```html
<dialog class="dialog new-group" id="new-group-dialog" aria-labelledby="new-group-title">
  <span class="sticker sticker--corner sticker--blank" aria-hidden="true"></span>
  <h2 class="dialog__title" id="new-group-title">Tạo nhóm mới</h2>
  <form novalidate>
    <div class="new-group__field">
      <label class="new-group__label" for="new-group-name">Tên nhóm mới</label>
      <div class="new-group__line">
        <span class="swatch" aria-hidden="true"></span>
        <input class="input" id="new-group-name" type="text" autocomplete="off" enterkeyhint="done">
      </div>
      <p class="field-error" id="new-group-error" role="alert" hidden><svg ...></svg><span class="field-error__text"></span></p>
    </div>
    <div class="dialog__actions">
      <button class="btn btn--secondary" type="button" data-action="cancel">Hủy</button>
      <button class="btn btn--primary" type="submit">Tạo nhóm</button>
    </div>
  </form>
</dialog>
```

A native `<dialog>` has role dialog; with `showModal()` the card behind is inert and Tab stays inside the box (R26, R27). Not `alertdialog`, because it holds a form.

Behaviour in `createManage()` (all inside the existing closure, using `groups()`, `refresh`, `render`, `showSaveResult`):

| Event | Action |
| --- | --- |
| Card click on `data-action="add"` | `openBox()`: clear the input and the error, set `data-color` on the swatch and the corner sticker to `nextColor(groups().list())`, `showModal()`, focus the input. At `MAX_GROUPS` call `setFieldError(input, error, "tooMany")` at once (R15) |
| Box `submit` | `preventDefault()`. Ignore if the box is not open (NFR3). `groups().create(input.value)`. On error: `showFieldError()` (replays the alert and nudge, R16) and focus the input. On success: close the box, `showSaveResult()`, `refresh()`, `render(null)`, add `group-row--new` to the new last row and `scrollIntoView({ block: "nearest" })`, announce, focus `.group-add` (R8) |
| Box `keydown` Enter with `isComposing` or `keyCode === 229` | `preventDefault()` only: no submit (R9, the existing Safari guard) |
| Box `input` | Clear the error unless it is `tooMany` and 20 groups still exist (R16) |
| Hủy, Escape (native `cancel` on the top dialog), backdrop click | Close the box. Backdrop uses the same bounding rect check as the delete note. The card stays open because Escape only reaches the topmost modal (R10) |
| Box `close` | Clear the input and the error; focus `.group-add` if the card is still open. No announcement |
| Card `close` | Close the box first if open (R11), then the existing handler |
| `sync()` (another tab) | If the box is open, update the swatch and sticker colour (R7). The duplicate and limit checks run again in `create()` at press time (R14) |

Announcement: `#manage-status` inside the card, written with the existing "clear, then set on the next frame" pattern so a repeat is heard. The header `#sr-status` is behind the modal card and may be ignored by screen readers, the same reason T11 put the save error inside the card. The text is set with `textContent` only (NFR2).

The add form is not touched on success: `refresh()` rebuilds the choices but keeps `addGroup`, the typed text, an open edit and the filter (R19, R20 already hold through `renderChoices()`).

## Data model and interfaces

No new storage key, field or migration (R31). `groups.create(name)` returns `{ group }` or `{ error: "empty" | "tooLong" | "duplicate" | "tooMany" }` and saves at once, keeping the group in memory with `storageOk` false on a failed write (R32), as today. `createManage()` keeps its signature and return value (`open`, `sync`).

## Error handling and security

- Validation errors keep the box open with the typed text; nothing is written (NFR3).
- A failed write still closes the box, shows the new row (in memory) and the storage text inside the card through `showSaveResult()` (R32).
- Group names reach the DOM only through `textContent` and option text (NFR2). No `innerHTML` is added.
- The Content-Security-Policy is unchanged; the sheet motion is CSS only.

## Test strategy

- Unit: none new. The logic that changes lives in the DOM wiring; `validateGroupName`, `nextColor` and `create()` keep their existing unit tests in `tests/unit/groups.test.js`. `version.test.js` guards the release.
- End to end (Playwright, both projects, `--workers=2`):
  - T1: header placement, label visible and named at 360, 390, 412, 452 and 1440 px (replaces the `ICON_ONLY_BELOW` loop in `groups.spec.js`, which is deleted), 44 px targets, no horizontal scroll at 360 px, the filter choice still not cut, tab order in `day-nav.spec.js` line 828 and the group bar order test in `groups.spec.js`, bar hidden with no groups and back after the first, focus returns to the header button, press during a flip leaves no stage, Back with the card open changes the day with no stage and the card still open.
  - T2: one describe "new group box" in `groups.spec.js` covering R5 to R17, R26 to R28, R30 to R32: open, swatch colour (first group yellow, next after orange), Enter and click create, live message once, focus on Thêm nhóm, row scrolled into view, no task made, add choice unchanged, each error with `aria-invalid` and `aria-describedby`, the limit at once and kept while typing, IME Enter (CDP composition and `keyCode` 229), Escape closes only the box, backdrop click, double Enter makes one group, another tab adding a group updates the swatch and a duplicate found at press time, storage failure message in the card, Back with the box open keeps the typed name, axe on the open box in light and dark, 100 ms open and create with 20 groups and 200 tasks.
  - T3: at 390 and 360 by 640 the three notes dock to the bottom, full width, inside the screen, no horizontal scroll; at 1440 they stay centred; with a 360 by 340 viewport (keyboard simulated by resizing) the input and both buttons of the box are in view. iOS keyboard is a manual check (NFR5).
  - T4: the old inline line tests in `groups.spec.js` (about 40 call sites listed by `grep -n "Nhóm mới" tests/e2e`) are rewritten to `createGroup()` or deleted when the box describe already covers them; `drag.spec.js` line 362 (Escape closes only the drag) uses the open box instead of the line, or is dropped since `canStart` refuses while a dialog is open; a guard test asserts the add select has no `"new"` option and `#new-group-template` is gone.

## Requirement mapping

| Requirement | Components |
| --- | --- |
| R1, R3, R4 | `index.html` header end column, `.header-manage`, `renderChoices()` bar toggle (T1) |
| R2 | Unchanged `manage.open()` and card close focus (T1 moves the button only) |
| R5 to R16 | `.group-add`, `#new-group-dialog`, box handlers in `src/manage.js` (T2) |
| R17 | Rename code untouched; existing rename tests keep passing (T2) |
| R18 to R21 | Removal in `index.html` and `src/app.js` (T4); `renderChoices()` fallback unchanged |
| R22 | Header click `drag.cancel(); flip.end();` (T1) |
| R23 | `allowed()` in `src/flip.js` (T1), tested with the box in T2 |
| R24, R25 | Existing `copy()` and top layer dialogs; tests in T1 |
| R26 to R28 | Native modal dialog, field error pattern, focus ring from the design system (T2) |
| R29 | `.dialog--sheet`, viewport meta (T3) |
| R30 | 44 px controls and `overflow-wrap` in the box (T2), checked again at 360 px in T3 |
| R31, R32 | `groups.create()` unchanged, `showSaveResult()` (T2) |
| R33 | Existing drag cancel on dialog open plus the explicit `drag.cancel()` (T1) |
| NFR1 to NFR4, NFR6 | T2 tests (speed, double press, textContent, axe) |
| NFR5 | Manual iOS and Safari checks in the release note (T5) |
| NFR7 | T4 |
