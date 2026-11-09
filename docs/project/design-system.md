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
