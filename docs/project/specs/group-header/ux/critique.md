# group-header UX: critique and heuristic review

## Method

All 14 screens were captured with Playwright at 1440 by 900 and 390 by 844 in light and dark mode (`screenshots/<screen>-desktop.png`, `-mobile.png`, `-dark-desktop.png`, `-dark-mobile.png`), and the busiest ones again at 360 by 640 (`-mobile360.png`), including the phone keyboard mock. The visual-critique:critique-screen pass (hierarchy, brand, composition, typography, colour, affordance, density) was run on the captures, followed by a Nielsen heuristic walk through each flow in flows.md. Every capture was measured for horizontal overflow (none) and every new control for size (the header button, Thêm nhóm, the field and both box buttons are at least 44 px to tap; the header button is drawn 36 px tall on wide screens with its hit area extended to 44 px, like the other header and card buttons).

## Fixed in this review

| Priority | Dimension | Issue | Fix |
| --- | --- | --- | --- |
| P1 | Composition | With 20 groups the new Thêm nhóm line (56 px) pushed the card past the bottom of the screen, hiding the last rows | The rows give that height back (`.group-add + .group-rows` max height `100dvh - 12.5rem`); the card now ends 21 px above the bottom at 1440 by 900 and 26 px at 360 by 640 |
| P2 | Affordance | Below 452 px the icon only tag button floated alone under Về hôm nay and read as a decoration | It is drawn as a small tab with a 1.5 px pen outline, matching the shape of Về hôm nay; the name stays the accessible name and tooltip |
| P2 | Composition | The extra row under Về hôm nay plus the old 16 px nav margin pushed the date tape too far down on desktop | The nav margin is dropped when the end column exists, because the column already leaves room for the tooltips below the arrows |
| P2 | Hierarchy | The two right hand labels started at different points | Quản lý nhóm uses the tab's side padding (16 px desktop, 12 px phone), so both labels end on one vertical line |
| P2 | Brand | A bottom sheet could lose the sticky note look | The sheet keeps the yellow paper, grain, tape and corner label, and loses only the tilt; the corner label moves inside the screen edge |

## Remaining findings (low priority, accepted)

| Priority | Dimension | Finding | Decision |
| --- | --- | --- | --- |
| P3 | Density | The header is about 44 px taller on every day, because the end column stacks two controls | Required by R1 (directly under Về hôm nay); on a phone the date tape still sits above the fold with room to spare |
| P3 | Hierarchy | At 20 groups, Tạo nhóm stays the strongest button while it cannot create anything | Owner decision Q4 (open the box and show the limit at once, button not disabled); the red message with an icon sits right above it |
| P3 | Colour | The orange corner label and swatch carry the colour preview with no text | Decorative and aria-hidden, as the old inline preview was; the colour can be changed later with Sửa. See open question on naming the colour |
| P3 | Affordance | The colour wash on the new row disappears after 2.4 s and is removed under reduced motion | The row is also last in the list, and the live message confirms it; focus on Thêm nhóm is visible in every mode |

## Heuristic walk (Nielsen)

| Heuristic | Flow | Finding | Severity |
| --- | --- | --- | --- |
| Visibility of status | 2 | Success shows as the new row plus a live message; failure as the storage slip inside the card | 0 |
| Match with the real world | 2 | The note and the blank line at the top of the card follow the notebook metaphor the owner already knows from delete | 0 |
| User control | 2 | Hủy, Escape and a click outside all cancel; Escape closes only the box | 0 |
| Consistency | 1, 2 | The box copies the delete note on desktop; on phones the box is a bottom sheet while the delete note is still centred | 2, see open question |
| Error prevention | 2 | Duplicates are checked again at the moment of pressing Tạo nhóm; a double press creates one group | 0 |
| Recognition over recall | 2 | The next colour is shown before creating | 0 |
| Error recovery | 2 | Every message says how to fix it, the typed text is kept and typing clears it | 0 |
| Minimalist design | 3 | The add line lost "Nhóm mới..." and the inline line, so it is only for tasks | 0 |

## Proposed design system changes (to merge after page-flip)

All of these live in `ux/group-header.css` and use only existing tokens. No token is added or changed.

1. `.day-nav { align-items: flex-start; }`, a new `.day-nav__end` column (margin-left auto, column flex, right aligned, 8 px gap) holding `.today-tab` and the header button, and `margin-bottom: 0` on the nav above 600 px.
2. `.header-manage`: replaces `.group-bar__manage` (to be removed with the old group bar button). Ghost pen button with the tag icon, padding matched to the tab, 36 px drawn with a 44 px hit area; below 452 px icon only (44 by 44) with a pen outline and a tooltip below from `data-tip`.
3. `.group-add` with `.group-add__plus`: the Thêm nhóm line in the card; `.group-add + .group-rows` shortens the scroll box by its height.
4. `.group-row--new`: the colour wash of `.task--moved` applied to a card row, removed under reduced motion.
5. `.new-group` with `__field`, `__label`, `__line`: the field inside the note; `.sticker--corner.sticker--blank`: a corner label without text.
6. `.dialog--sheet`: below 600 px a note docks to the bottom (full width, no tilt, 16 px top corners, safe area padding, `sheet-up` motion). If the owner agrees, add it to the delete and blocked notes too (open question).
7. Remove `.add-form__newgroup` and its children with the old inline line (NFR7).
8. design-system.md: describe the header column, Thêm nhóm, the box and the sheet under a new "Group header" section, and update the Group bar entry (filter only, hidden with no groups).

## Notes for the Frontend Developer

- The box is a native `<dialog>` with `showModal()` opened on top of the card, which makes the card inert. Use `role="dialog"` (not alertdialog: it holds a form) with `aria-labelledby` on "Tạo nhóm mới".
- Put the input and buttons in a `<form method="dialog" novalidate>` handled by script, so Enter submits only the box; ignore Enter while `isComposing` or `keyCode === 229`.
- Phones: add `interactive-widget=resizes-content` to the viewport meta, or position the sheet with `visualViewport`, so the sheet rides above the keyboard (`new-group--keyboard.html`). Manual check on iOS Safari for the release note.
- The header button stays a real `<button>` (the prototype uses links only to click through).
