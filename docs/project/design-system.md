# Design system: daily-todo ("Paper notebook")

The tokens and base component styles live in `design-system.css` next to this file, and every screen links that file. When a feature needs something new, please extend both files rather than redefining tokens inside the feature.

Version 3 replaces the modern list look (v2), which the owner did not approve. The owner asked for the whole app to look and feel like a real paper notebook ("theme và style giống cuốn sổ note"). The tool search in ui-ux-pro-max pointed to two styles that we combined: E-Ink / Paper (paper background, high contrast ink, subtle grain, calm) and Minimalism (one column, clear hierarchy). Its scholarly navy suggestion became our blue-black pen colour.

## Direction

The page is one sheet of ruled loose-leaf paper lying on a sage desk blotter. The sheet has punched holes on the left, a double pink margin line, a short unruled header band closed by a double blue rule, and pale blue lines below. Every task is written on a line. The margin holds the marks you make with a pen: the checkbox, the pen that starts a new line, and the progress circle that turns into a red star stamp when the day is done.

The notebook feel comes from paper, lines, margin, ink and small details (a strip of washi tape holding the date, a sticky note for the delete question, a clipped slip for the storage warning, a doodled cà phê phin when the page is empty). The type stays Aptos so the page reads as a calm tool, not a gimmick.

The one memorable element is the ruling itself: the ruled line pitch is the row height and the tap target (44 px), so text, inputs, errors and buttons all sit exactly on the lines.

## Color

Light mode ("notebook by day"):

| Token | Hex | Use | Contrast on paper |
| --- | --- | --- | --- |
| `--color-desk` | #C9CEC4 | Desk blotter behind the sheet | |
| `--color-paper` | #FCF9F1 | The sheet, with grain | |
| `--color-paper-edge` | #EFE8D8 | The sheet underneath, seen as an offset edge | |
| `--color-rule` | #CAD7E6 | Ruled lines | decorative |
| `--color-rule-strong` | #8EA6C4 | Double rule under the header | decorative |
| `--color-margin` | #E3899A | Double margin line | decorative |
| `--color-ink` | #000000 | Main text | 20:1 |
| `--color-ink-muted` | #5A5446 | Summary, quoted task, ghost buttons | 7.2:1 |
| `--color-ink-done` | #6B6555 | Done task text, placeholders | 5.5:1 |
| `--color-pencil` | #8C8676 | Checkbox frame, input underline, progress track | 3.5:1 (non text) |
| `--color-pen` | #1F3A68 | Ticks, strike line, primary button, focus, links | 10.7:1, white on pen 11.3:1 |
| `--color-highlight` | yellow at 30% | Highlighter wash on the line being edited | |
| `--color-stamp` | #C23A4F | Star stamp | decorative |
| `--color-danger` | #A3242F | Field errors, Xóa, Xóa việc | 7.0:1, white on danger 7.4:1 |
| `--color-washi` / `-2` | #BFD3DD / #D3E2E8 | Date tape stripes | black on tape 13.6:1 |
| `--color-sticky` | #FBEFA6 | Delete note | black 18:1, muted 6.5:1 |
| `--color-slip` with `--color-slip-ink` | #F6E6BF with #5E3D00 | Storage warning slip | 7.9:1 |

Dark mode ("notebook at night"), applied automatically with `prefers-color-scheme: dark`: charcoal paper #22262D on a dark desk #15181C, warm white gel ink #F1EDE4 (13:1), muted ink #BDB6A6 (7.5:1), done ink #A39D8F (5.6:1), pale blue pen #A9C3EE (8.5:1, dark text on pen 9.6:1), soft red #F2959B for errors (6.9:1), dim lines #343B46 and a muted rose margin #9E4D5C.

Rules:
- In light mode the main text is black, as the organization rule requires. Dark mode uses light ink on dark paper; this is the owner's explicit decision (decision log, 2026-11-09, "Dark mode? Now, following the system setting") and is documented here as the agreed exception.
- Colour never carries state alone: done tasks get a tick and a strike line, errors get an icon and text, and the progress circle always sits next to the written summary.
- Margin red, stamp red, rules and washi are decorative only, never text and never the only signal.

## Typography

- Family: Aptos, then Segoe UI Variable, Segoe UI, system-ui, Helvetica Neue, Noto Sans, Roboto, Arial. All of them render Vietnamese diacritics well, including stacked marks such as ể, ỗ, ặ. No web fonts and no handwriting font: the notebook feel comes from the paper, not the letters.
- Scale: page title 34 px bold (26 px on mobile, balanced wrapping), dialog title 18 px bold, task text and inputs 17 px (16 px on mobile so iOS does not zoom), date, summary and buttons 15 px, field errors 14 px, tooltips 13 px.
- Task text uses `line-height: var(--rule)` (44 px), so every wrapped line sits on its own ruled line. The ruling is lifted 10 px (`--rule-shift`) so the baseline sits just above the line and the dots under ạ, ệ, ộ stay clear of it.
- Weights: 700 for titles, 600 for buttons and the done count, 500 for the date and errors, 400 for body. Sentence case everywhere, no all caps labels.

## Layout

- The sheet is up to 800 px wide, centred on the desk with a 48 px gutter, with a minimum height of 880 px on desktop so the page always looks like a full sheet.
- Every row uses one two column grid: the margin column (`--margin-w`, 64 px desktop, 48 px mobile) and the writing column, after a hole strip (`--holes-w`, 56 px or 24 px). The checkbox, the add pen and the progress circle centre in the margin column; the title, date, summary, add input and task text all start right of the margin line. Keep this in later features.
- The header band is unruled and holds the title, the day navigation slot (`.app-header__nav`, top right, empty for now), the date on washi tape, the progress and summary, and the storage slip when needed. Day navigation will read as turning pages.
- The sheet body is ruled. Everything in it is a multiple of the 44 px rule: the add line, an error line, task rows, the edit row (input line plus a button line), and the empty state doodle (three lines).
- Task rows that are off screen skip rendering with `content-visibility: auto`, so a day with 200 tasks still updates within the 100 ms of NFR1. A hovered or focused row always renders in full, so its tooltips and focus ring are never clipped. A wrapped row that has not been on screen yet is sized as one 44 px line until it scrolls into view, and we accept the small scroll jump this can cause.
- Below 600 px the desk gutter is 8 px and the margins tighten. Verified with no horizontal scroll at 1440, 390 and 360 px.

## Spacing, size, radius, shadow

- Spacing uses a 4 px base: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Every tap target is at least 44 by 44 px (`--tap`). The Thêm, Hủy and Lưu buttons are drawn 36 px tall to sit inside a line, and a transparent pseudo element extends their hit area to 44 px.
- Radius: 3 px for the sheet, 6 px for buttons and swipe actions, a slightly uneven 3 to 5 px for the drawn checkbox, and a folded corner on the sticky note.
- Shadows are warm and physical: `--shadow-sheet` (a soft lift plus the offset edge of the sheet underneath) and `--shadow-note` for the sticky note. Rows and buttons have no shadow.
- Paper grain is an inline SVG noise (`--grain`), so there is no image request.

## Components

- Buttons: primary (pen fill), secondary (ink outline, used for Giữ lại), ghost (muted ink, used for Hủy), danger (red, Xóa việc only).
- Icon button: 44 px target, pencil (Sửa) and trash (Xóa) icons, accessible name from `aria-label`, tooltip on hover after 350 ms and on keyboard focus. In swipe mode it becomes a 64 px coloured block with a visible text label.
- Checkbox: native input kept for accessibility, drawn as a 20 px pencil square. When ticked, a blue-black pen tick draws itself and overshoots the box like a real mark.
- Done text: muted ink plus a 2 px pen strike that draws left to right across every wrapped line (`.task__label`, inline with `box-decoration-break: clone`).
- Input: no box. You write on the line; the underline turns pen blue on focus and red on error.
- Field error: red text with a circle icon, one rule tall, directly under the field, linked with `aria-describedby`.
- Washi tape (`.washi`): striped translucent tape with torn ends, used for the date.
- Progress (`.progress`): a dotted pencil track with a pen arc driven by `--p` (0 to 100). With `.progress--complete` the circle is replaced by a red star stamp. Add `.progress--celebrate` only at the moment the last task is ticked: the stamp presses in once (520 ms) with a single soft ink bloom (900 ms). No new text.
- Sticky note dialog: native `<dialog>` with `showModal()`, yellow note rotated 1.2 degrees, a strip of tape on top, title, quoted task in muted ink with a pencil rule, then Giữ lại and Xóa việc.
- Alert slip (`.alert--warning`): a clipped slip of warm paper with a paperclip icon, placed in the header band.
- Empty state: a pen doodle of a cà phê phin on a cup with the empty message written on the next line.
- Table: ruled table, one rule per row, reserved for later features.

## Row actions

- Desktop with a mouse: Sửa and Xóa sit at the end of the line, hidden until the row is hovered or anything inside it has keyboard focus (`:focus-within`). The hovered line gets a faint pen wash.
- Phones and touch screens (`hover: none` or below 600 px): swipe the line left to reveal Sửa (pen blue) and Xóa (red) as 64 px blocks with text labels. The recommended build is native CSS scroll snap on `.task__swipe` (no gesture script): the text is a snap point at the start and the actions are a snap point at the end. Because the buttons stay in the DOM and in the tab order, keyboard focus scrolls the row open by itself, and screen readers reach both buttons by swiping through the row as usual. Only one row should stay open: when another row opens or the list is tapped, scroll the others back to the start.

## Motion

Motion answers something the owner did. The stamp is still a response, and the swipe hint plays only once, when the first line appears on a phone:

| Moment | Motion | Duration |
| --- | --- | --- |
| Tick a task | Pen tick draws, then the strike line draws across the text | 360 ms |
| Add a task | New line is written in from left to right (`.task--enter`) | 220 ms |
| Delete a task | Line slides 8 px left and fades (`.task--exit`), then is removed | 220 ms |
| Error | Message rises in, the underline nudges sideways once | 220 to 260 ms |
| Progress | Pen arc eases to the new share | 360 ms |
| All done | Star stamp presses in with one ink bloom (`.progress--celebrate`) | 520 to 900 ms |
| Delete note | Note drops in with a small rotation | 360 ms |
| Swipe hint (phones, once) | First line slides left to show Sửa, holds, then settles back (`.task--peek`), after a 400 ms pause | 1100 ms |

Everything is reduced to an instant change under `prefers-reduced-motion`; the bloom and the swipe hint are removed.

## Accessibility

- Focus: 2 px pen outline with a 2 px offset on everything interactive; the checkbox square gets the same ring. Inside swipe blocks the outline sits inset in the button text colour.
- Contrast: all text meets 4.5:1 in both modes (see the tables above); non text controls meet 3:1.
- The progress circle and stamp are `aria-hidden`; the summary in `role="status"` is the real status.

## Day navigation (added for day-navigation)

This section only adds to the system; no existing token or component changed. The CSS lives at the end of `design-system.css` under "Day navigation".

- Placement: `.app-header__nav` becomes `<nav class="app-header__nav day-nav">` in its own header row, after the h1 and before the date tape, instead of sitting beside the title. The order is Xem ngày trước, Xem ngày sau, Chọn ngày, then Về hôm nay. On desktop the tab sits at the far right; at 360 px it wraps under the arrows, and from about 380 px everything fits on one row.
- Page turning arrows (`.day-nav__turn` on `.icon-btn`): pen chevrons, 44 px, tooltip from `aria-label`. Tooltips in the nav open below the controls so the heading stays readable. The arrow pair is pulled left 11 px so the chevron lines up with the title.
- Date stamp (`.date-stamp`): a 3 px double pen border rotated 2 degrees, like a rubber date stamp, wrapping a calendar icon and a native `<input type="date">`. At rest the input text is hidden, because the native format follows the browser locale and the date is already on the tape; mouse or touch anywhere on the stamp opens the browser's calendar. With a fine pointer and focus, the stamp widens to show the native field for typing. Tooltip text comes from `data-tip`.
- Back to today (`.today-tab`): an index tab with a return mark. It is pen filled on other days and drawn as a dashed pencil outline in done ink (5.5:1 light, 5.9:1 dark) when `aria-disabled="true"` on today. On phones it drops the icon and uses 14 px text so it fits beside the arrows. When it changes state, its background and text colour fade together, so the label stays readable throughout. The fade is skipped on first render, so a page opened on another day shows the filled tab straight away.
- Page turn motion: `.turn--back` or `.turn--forward` on the sheet body (lines slide 18 px in from the side turned towards, 240 ms, new token `--dur-turn`) and `.washi--restick` on the date tape (360 ms). These are added once per day change and removed on reduced motion.
- Narrow phones: below 381 px the add line placeholder is 14 px, so "Bạn cần làm gì ngày này?" stays whole.

## Task groups (added for task-groups)

This section only adds to the system; no existing token or component changed. The CSS lives at the end of `design-system.css` under "Task groups". The ui-ux-pro-max search again pointed to Minimalism with strict contrast, keyboard and colour-not-alone rules, so the groups are written into the existing sheet rather than drawn as cards.

### Direction

Group labels are torn paper labels, like a label torn off a strip (owner decision, replacing first the highlighter look and then the die cut sticker). The label is a strip of coloured paper with the paper grain whose left and right ends are torn into an irregular sawtooth (răng cưa, teeth 1 to 6 px deep), with a small tilt and a soft lift shadow that follows the torn edges. Labels keep 15 px of padding at each end, so a tooth never reaches the text. A section header is one ruled line: the fold chevron in the margin column (where the checkboxes are), the torn label with the group name, and the done and total count at the end of the line. Headers tilt alternately (-1.4 and 1.1 degrees), like labels stuck on by hand. One blank line separates sections, as you would skip a line on paper. "Chưa phân nhóm" is a blank white label torn the same way, with pencil dashes along its straight edges and muted ink, so it still reads as a group without a colour.

### Label colours

Pick a colour with `data-color` on any element (`yellow`, `pink`, `green`, `blue`, `orange`, `purple`); it sets `--hl` (the label fill behind text) and `--hl-mark` (the thin outline of a mini label). An unknown or missing code, or `none`, gives the blank label, so a raw value from storage is never used as a style.

| Name | Code | Light label, black text | Light mark on paper | Dark label, ink #F1EDE4 | Dark mark on night paper |
| --- | --- | --- | --- | --- | --- |
| Vàng | yellow | #FCE57E, 16.7:1 | #9C7A00, 3.8:1 | #5A4A12, 7.4:1 | #E8C64A, 9.1:1 |
| Hồng | pink | #F9C0D3, 13.5:1 | #C2457A, 4.5:1 | #6B2C45, 8.7:1 | #F09AB9, 7.3:1 |
| Xanh lá | green | #C6E7A8, 15.4:1 | #4E8A2E, 4.0:1 | #2E4F2A, 7.9:1 | #9DD07A, 8.5:1 |
| Xanh dương | blue | #BCDCF5, 14.7:1 | #2F74B5, 4.7:1 | #23466B, 8.3:1 | #8EC0EE, 7.9:1 |
| Cam | orange | #FBCB96, 14.1:1 | #C26516, 3.9:1 | #6A3A16, 8.1:1 | #F2A766, 7.6:1 |
| Tím | purple | #DCCBF3, 13.9:1 | #7C55C2, 5.1:1 | #4B3570, 8.8:1 | #BBA2EE, 6.9:1 |

Rules: only the group name sits on a label, always in main ink (muted ink on the blank label: 7.5:1 light, 5.7:1 dark); counts and hints sit on paper in muted ink. Marks are non text and meet 3:1. Torn label tokens: `--torn` (the clip-path polygon for labels), `--torn-mini` (a simpler two tooth polygon for mini labels), `--label-blank` (#FFFFFF by day, #353A43 at night) and `--label-shadow` (a drop-shadow filter, so the shadow follows the teeth; darker at night). No images are used. Other new tokens: `--color-notice` and `--color-notice-ink` (info slip, 9.6:1 light, 8.7:1 dark), `--color-card` and `--color-card-rule` (index card dialog), `--dur-fold` (200 ms chevron turn).

### Components

- Torn label (`.sticker[data-color]`): the group label described above. The paper is a `::before` layer clipped with `--torn`, and the label itself carries the drop-shadow filter. Used for section headers (`.group__name.sticker`), the names in the Quản lý nhóm rows, and `.sticker--corner`, a small decorative label of the group stuck on the top right corner of the delete, blocked and move notes (aria-hidden).
- Mini label (`.swatch`): a 20 by 13 px torn label without text, tilted 6 degrees, with two teeth per end so it stays crisp at that size. Four 1 px drop-shadows in the mark colour draw an outline that follows the teeth, for 3:1 against the page. Shown before the chosen value in the add, edit, filter and move choices (blank for Chưa phân nhóm, none for Tất cả nhóm), and in the margin of the Nhóm mới... line as a preview of the next colour. Below 381 px it is hidden inside the add line and filter selects so the name has room.
- Line select (`.select`): a native `<select>` written on the line like the inputs (pencil underline, pen on hover and focus, pen chevron), with an optional swatch before it showing the chosen group's colour. Native lists cannot show colour, so the options are names only.
- Add line group choice (`.add-form__group`): "Nhóm" label plus the line select, between the input and Thêm on desktop. On phones the input takes line one and the choice with Thêm share line two; the word "Nhóm" is visually hidden there (it stays the accessible label) so the full "Chưa phân nhóm" fits at 360 and 390 px. `.add-form__newgroup` adds one line under it with the swatch preview, the "Tên nhóm mới" input and a secondary "Tạo nhóm" button; errors use the existing `.field-error` line.
- Group bar (`.group-bar`): one ruled line directly above the list, with the funnel in the margin, "Lọc theo nhóm" and its select on the left (shown from the first group on) and "Quản lý nhóm" (ghost pen button with a tag icon) on the right, present on every day. On phones the filter label is visually hidden and the funnel stands for it. `.group-bar--filtered` inks the funnel and the select underline while a filter is on.
- Section (`.group[data-color]` with `.group__head`, `.group__toggle`, `.group__chev`, `.group__name`, `.group__count`): an `h2` holding a full width `button` with `aria-expanded` and the accessible name "Nhóm {name}, đã hoàn thành {done}/{total} việc". The whole line is the 44 px target. `.group--collapsed` hides the rows and turns the chevron to point right. When the filter shows one group, use `.group__static` instead of the button (no toggle, the margin stays empty).
- Filter empty state (`.group-empty`): the one line message on the ruling, in muted ink, without the doodle (the doodle stays for a day with no tasks at all).
- Edit line group choice (`.task__edit-group`): "Nhóm" and the line select at the start of the Hủy and Lưu line; on phones it takes its own line above the buttons.
- Moved row (`.task--moved`): a wash in the new group's label colour behind the row that fades once (1.8 s after a 0.6 s hold). Removed under reduced motion; focus on Sửa still marks the row.
- Info slip (`.alert--info`): the clipped slip of the storage warning in pen blue with a check icon, placed in the header band, `role="status"`, for "Đã chuyển ..." and "Đã thêm việc vào nhóm ... đang được ẩn bởi bộ lọc."
- Index card dialog (`.dialog--card` with `.dialog__head`): native `<dialog>` like the sticky note, but a white ruled card with a red head line and only 0.4 degrees of tilt, because it holds a form. Used for "Nhóm việc" (close with "Đóng") and "Chuyển tất cả việc của nhóm ...". Up to 520 px wide; 8 px from the screen edges on phones.
- Group rows (`.group-rows`, `.group-row`): the group's torn label (with the "Nhóm này chưa có việc nào." hint when empty), then Sửa, Chuyển tất cả việc and Xóa as 44 px icon buttons. On desktop Chuyển tất cả việc also shows its words. With no tasks it is `aria-disabled="true"`, pencil grey, and stays focusable.
- Group edit (`.group-row--editing`, `.colour-pick`): the row gets the highlighter wash used for task editing, the name becomes a line input, then the "Màu nhóm" fieldset with six 44 px radio choices drawn as small torn labels in each colour, named Vàng, Hồng, Xanh lá, Xanh dương, Cam, Tím. The chosen one is lifted 2 px, framed in ink and ticked, so colour is not the only cue. Then Hủy and Lưu.
- Notes on top of the card: the delete question and the blocked message use the approved sticky note. `.dialog__title--message` sets a full sentence heading at 17 px semibold; `.dialog__actions--stack` gives one button per line (primary first).
- Move form (`.move-field`): "Chuyển đến nhóm" label and a line select, then the confirmation sentence (`.dialog__text`) that updates with the chosen target. A failed write shows the warning slip inside the card.

### Motion

| Moment | Motion | Duration |
| --- | --- | --- |
| Fold or open a section | Chevron turns 90 degrees; rows appear or hide at once | 200 ms |
| Task moved to another group | Wash in the new group colour fades | 1.8 s after 0.6 s |
| Dialogs | Same drop in as the sticky note | 360 ms |

All of it is removed under `prefers-reduced-motion`.

### Accessibility

- Every section header is a heading with a toggle button (R63); Enter and Space work natively.
- Every new control is at least 44 by 44 px; the drawn 36 px buttons extend their hit area like Thêm.
- Group names are text in every place they appear; colour is supporting only.
- Verified without horizontal scroll at 1440, 390 and 360 px in both modes.
