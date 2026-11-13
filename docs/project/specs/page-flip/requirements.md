# Requirements: page-flip

## Changed on 2026-11-12

After the owner saw the flip, the decision log entry "2026-11-12 page-flip scope change after the owner saw the flip" changed this document:

1. Reduced motion: the flip always plays. The system setting `prefers-reduced-motion` is ignored for the page flip, and there is no in app off switch (R28, R29, R39, NFR5, out of scope).
2. Flip area: the whole sheet flips, header included (title, arrows, date tape, "Về hôm nay"), together with the body, hinged on the binder holes. The separate date tape re-press is dropped (R8, R10 to R13, scope section).
3. Durations: 700 ms per flip, 125 ms riffle step, 950 ms total budget for a 3 leaf riffle (R3, R3a, R9, NFR7).

## Goal

Make moving between days feel like turning the page of a paper notebook. Today the app only slides the lines 18 px sideways (`.turn--back`, `.turn--forward`, from `day-navigation`). This feature replaces that slide with a real page flip: the whole sheet, header and body, turns like a leaf hinged at the punched holes on the left, and the new day is revealed underneath. The flip is only a visual response. The data, the address, the focus and the screen reader text change at once, exactly as they do now, and the owner can keep working while the leaf is still turning. Tasks stay in the browser only, there is no backend, all screen text is Vietnamese, and the day follows the browser's local timezone.

Decisions: the owner answered every open question (decision log, 2026-11-11 "page-flip requirements"). All answers are settled below. For a move of more than one day, the owner chose a short riffle of quick pages, capped at 3 leaves.

## User roles

1. Owner: the single person who uses the page for personal daily planning, on a desktop browser or on a phone. There are no other roles.

## User stories

1. As the owner, I want the page to flip when I press the previous or next day arrow, so that moving between days feels like turning a notebook page.
2. As the owner, I want the flip to turn the right way for the date I choose (forward for a later day, back for an earlier day), so that the motion tells me which way in time I went.
3. As the owner, I want the flip to play when I pick a date or press "Về hôm nay", so that every way of changing the day feels the same.
4. As the owner, I want to press the arrows many times quickly without the screen stuttering or lagging behind, so that I can move several days fast.
5. As the owner, I want to type, tick or edit tasks straight away while the page is still turning, so that the animation never makes me wait.
6. As the owner, I want the flip to play even when my computer reports that animation is reduced or off, so that I always see the page turn.
7. As a screen reader or keyboard user, I want focus and announcements to stay as they are today, so that the flip never takes me out of place.

## Scope of the flip (which actions flip)

The flip surface is the whole sheet: the header (title, navigation controls, date tape, "Về hôm nay", progress and summary) and the body (add form, group bar, empty state and day list). The real header and body update at once underneath, as in `day-navigation`, and the leaf is an inert copy.

| Way the day changes | Flips | Direction |
| --- | --- | --- |
| Next day arrow | Yes | Forward |
| Previous day arrow | Yes | Back |
| Date picker, chosen date later than the viewed day | Yes | Forward |
| Date picker, chosen date earlier than the viewed day | Yes | Back |
| Date picker or Về hôm nay, move of more than 1 day | Yes, a riffle of 2 or 3 quick leaves (R2 and R3) | By comparison of the two dates |
| Về hôm nay when today is later than the viewed day | Yes | Forward |
| Về hôm nay when today is earlier than the viewed day | Yes | Back |
| Browser Back or Forward (hash `#yyyy-mm-dd`) | Yes | By comparison of the two dates, not by the history direction |
| Page load, reload, opening a bookmark | No | None |
| Midnight refresh (`checkDay`) | No | None |
| Invalid or out of range hash, or hash equal to today on load, cleaned from the address | No | None |
| A move to the day already viewed | No | None |

## Acceptance criteria

In this document "viewed day" means the day whose tasks are on screen, "flip" means the page flip motion described here, and "leaf" means the moving visual copy of the old page during a flip.

### When and which way the page flips

R1. WHEN the owner presses the previous day button, the next day button, or "Về hôm nay", AND the viewed day changes, THE SYSTEM SHALL play a flip or a riffle, by the distance rules of R2 and R3. The two arrows always move exactly 1 day, so they always play one flip.

R2. WHEN the owner picks a date in the date picker or presses "Về hôm nay" AND the new viewed day is exactly 1 day from the old one THE SYSTEM SHALL play one flip, as for an arrow. WHEN the new viewed day is more than 1 day from the old one THE SYSTEM SHALL play a riffle (R3), whatever the distance.

R3. THE SYSTEM SHALL set the number of leaves in a riffle from the distance in calendar days between the old and the new viewed day: 2 days gives 2 leaves, and 3 days or more gives 3 leaves (never more than 3). The leaves turn in the same direction (R4), each one lasts 700 ms (`--dur-flip`), and each one starts 125 ms after the one before it (a new token `--dur-riffle-step`), so the leaves overlap like fanned pages. The first leaf is the copy of the old page, and the later leaves are plain blank ruled paper without text.

R3a. THE SYSTEM SHALL keep the whole riffle within a total time budget of 950 ms from the start of the first leaf to the end of the last one (700 ms plus at most 2 steps of 125 ms). The total SHALL not grow with the distance. A single flip for a move of 1 day lasts 700 ms.

R3b. WHEN the viewed day changes because of the browser Back or Forward button or a hash edit THE SYSTEM SHALL play the same flip or riffle as for any other move, chosen by the distance in days (R2, R3).

R4. WHEN the new viewed day is later than the old one THE SYSTEM SHALL flip forward: the leaf is the old page and it turns away from the right edge towards the left, hinged at the left edge, and the new day shows beneath it. WHEN the new viewed day is earlier THE SYSTEM SHALL flip back: the old page is covered by the leaf of the earlier day turning in from the left towards the right. In a riffle every leaf turns the same way.

R5. THE SYSTEM SHALL decide the direction only by comparing the old and the new viewed day (the keys compare as text, as the current code does), for every entry point in the table above, including "Về hôm nay" and browser Back and Forward.

R6. WHEN the page loads, WHEN the local date changes at midnight and the page refreshes the wording or the viewed day, WHEN an invalid hash is cleaned, or WHEN a move targets the day already viewed THE SYSTEM SHALL NOT play a flip.

R7. IF the page is hidden (the tab is in the background) when the viewed day changes THEN THE SYSTEM SHALL change the day without a flip.

### What the owner sees during and after the flip

R8. WHEN a flip starts THE SYSTEM SHALL show the leaf as a copy of the old whole sheet (header and body, including the title, arrows, date tape and "Về hôm nay"), in the paper look of the notebook (ruled lines, margin line, punched hole side), turning with a visible hinge on the left edge, a soft shadow that moves with the turn, and a slightly darker back of the leaf during the second half of the turn. The turn SHALL be clearly perceptible in real time playback, not only in paused frames: the leaf visibly sweeps from the free edge to the hinge over most of the duration, and its text stays visible through most of the turn.

R9. THE SYSTEM SHALL make each leaf last 700 ms, taken from one design token (a new `--dur-flip`, replacing the use of `--dur-turn`), and SHALL remove every leaf and every helper class and style when the flip or riffle ends or is cancelled, so that the page looks and behaves exactly as before after it.

R10. WHEN a flip or riffle starts THE SYSTEM SHALL show the real new day beneath the leaves from the first frame, with the real header and body updated at once (its heading, date line, placeholder, rows, empty state, summary and progress, as in R6 of `day-navigation`), and SHALL write the address and the history entry, keep focus and announce the date line at once (R18, R19). Neither a flip nor a riffle SHALL delay, hold back or replay any of these updates, however many leaves play. A riffle SHALL never show an in between day: the leaves are visual only.

R11. THE SYSTEM SHALL keep the leaf a purely visual copy that is not a second page: it SHALL be hidden from assistive technology (`aria-hidden="true"`), SHALL NOT be reachable by Tab, SHALL ignore pointer events so that clicks and taps reach the real controls and rows underneath (including the arrows, the picker and "Về hôm nay" in the header), and SHALL NOT be selectable text. Keyboard focus SHALL stay on the control that was pressed.

R12. THE SYSTEM SHALL NOT play a separate date tape re-press (`.washi--restick`) any more. The date tape turns with the rest of the sheet, and the real tape shows the new date at once.

R13. THE SYSTEM SHALL keep the page free of horizontal scroll bars and of any layout shift during and after the flip, at 360 px wide and above. The stage that holds the leaves SHALL be bounded by the whole sheet (header and body), the leaf SHALL stay inside that stage, and it SHALL NOT enlarge the scrollable area of the page.

### Quick repeated moves

R14. WHEN the owner starts a new move while a flip or a riffle is still playing THE SYSTEM SHALL end the running flip or riffle at once (all its leaves removed together), change to the newest day at once, and start one new flip or riffle for it, from the day that was on screen at that moment to the newest day, with the leaf count of R3 for that distance. No moves are queued, and nothing plays one after another once the owner has stopped pressing.

R15. WHEN a move comes from a repeated key (for example Enter or Space held down on a focused arrow, with `event.repeat` true) THE SYSTEM SHALL change the day at once and play no motion for it, and SHALL end any flip or riffle still running. The first press of the key (`event.repeat` false) is an ordinary move under R14. WHEN the held key is released after one or more repeated moves THE SYSTEM SHALL play one flip or riffle for the whole distance moved during the repeats, from the day that was on screen before the first repeated move to the day on screen at the release, in the direction of R4, with the leaf count of R3 (1 day gives 1 flip, 2 days 2 leaves, 3 days or more 3 leaves, never more than 3) and within the budget of R3a. IF the repeats ended on the day they started from THEN no motion plays. A release is detected by the `keyup` of the held key, or by the first move after the repeats with `event.repeat` false, whichever comes first. IF the focus leaves the control, the window loses focus or the page is hidden during the hold THEN the hold ends as a release.

R16. WHEN the owner makes many moves in a row (for example 30 presses in 3 seconds) THE SYSTEM SHALL end on the correct final day, with the address, the history, the picker value and every text matching that day, and with no leaf left on screen after the last flip ends.

R17. WHEN the owner types a date into the picker and the picker reports several valid dates on the way THE SYSTEM SHALL handle each as a move under R14 and R15. The final day SHALL be the day typed.

### Focus and screen readers

R18. WHEN a flip plays THE SYSTEM SHALL keep keyboard focus exactly where `day-navigation` R8 puts it today: on the control the owner used, and in the add input when focus was on a row that the day change removed. The flip SHALL NOT move focus, steal focus, or cause a focus ring to flicker. Because the whole sheet flips, the leaf may cover the focused nav control for up to 700 ms (950 ms in a riffle). The owner accepted this on 2026-11-13, because it clears on its own and clicks still reach the real control (R11).

R19. WHEN the viewed day changes THE SYSTEM SHALL announce the new date line to screen readers at the moment of the change, not at the end of the flip, using the existing `aria-live="polite"` date line. The flip SHALL NOT add a second announcement, and the leaf SHALL NOT be announced or read (R11).

R20. WHILE a flip plays THE SYSTEM SHALL keep the reading order, the tab order and the names of all controls the same as on a settled page, so that a screen reader reads only the new day during and after the flip.

R21. IF the owner presses Tab, Shift plus Tab, or any key during the flip THEN THE SYSTEM SHALL handle it as it does on a settled page, without waiting for the flip to end.

### Input during the flip

R22. WHILE a flip plays THE SYSTEM SHALL accept typing in the add input at once. The text already typed SHALL be kept across the day change (as in R7 of `day-navigation`), and the focus caret SHALL not jump.

R23. WHILE a flip plays THE SYSTEM SHALL let the owner add a task, tick or untick, edit, save, cancel, delete and open the delete note on the rows of the new day at once. These actions SHALL apply to the new viewed day only, and never to a row of the old page shown on the leaf.

R24. WHEN a task is added while a flip plays THE SYSTEM SHALL save it with the new viewed day as its date (R16 of `day-navigation`).

R25. IF a drag was active when the day changes THEN THE SYSTEM SHALL cancel it first, as `drag-drop` R20 already requires, and then start the flip. WHILE a flip plays THE SYSTEM SHALL allow a new drag to start on the new day's rows (mouse move or 400 ms long press), and a flip that starts during a drag SHALL not happen because the day change cancels the drag first.

R26. IF a second flip would start while the owner is holding a touch long press THEN THE SYSTEM SHALL handle the press as `drag-drop` does (cancel on day change) and SHALL NOT leave a stuck scroll lock or a stuck leaf.

R27. THE SYSTEM SHALL not write to storage differently because of the flip: a flip SHALL never change, delay or duplicate any save, and a failed save SHALL show the same storage slip as today.

### Reduced motion setting

R28. THE SYSTEM SHALL play the flip and the riffle whatever the value of the system setting `prefers-reduced-motion`. The page flip SHALL ignore that setting, and the app SHALL offer no switch to turn the flip off. (Other motion in the app keeps following the setting as before.)

R29. WHEN the value of `prefers-reduced-motion` changes while a flip or riffle is playing, or between moves, THE SYSTEM SHALL change nothing: the running flip continues and the next move flips as usual.

### Phones and desktop

R30. THE SYSTEM SHALL play the same flip on phones and on desktop, with the hinge on the left edge, at the same durations, riffle included.

R31. THE SYSTEM SHALL work with touch and mouse alike: a tap on an arrow, the picker or "Về hôm nay" flips; a flip SHALL NOT block vertical scrolling, pinch zoom, or any touch the owner makes on the new page.

R32. THE SYSTEM SHALL NOT change the day by swiping or dragging the page sideways in this feature. A swipe left on a task row still opens Sửa and Xóa as before.

R33. THE SYSTEM SHALL keep every control at least 44 by 44 pixels and keep the layout at 360 px wide without horizontal scrolling, as `day-navigation` R28 requires.

### Dark mode

R34. WHILE the system theme is dark THE SYSTEM SHALL draw the leaf, its back and its shadow from the dark paper tokens (charcoal paper, dim lines, muted rose margin). No bright white or light flash SHALL appear at any frame, and the shadow SHALL stay visible on the dark desk.

R35. THE SYSTEM SHALL keep the text on the leaf and on the new page at the contrast of the existing tables (4.5:1 for text) in light and dark mode at every frame where text is readable. The leaf back may be plain paper without text.

R36. WHEN the system theme changes during a flip THE SYSTEM SHALL finish or end the flip without a broken look, and the next flip SHALL use the new theme.

### Interruptions and safety

R37. IF anything re-renders or removes the sheet or its body during a flip or riffle (for example a storage event from another tab, a dialog opening, or the midnight refresh) THEN THE SYSTEM SHALL end the flip or riffle at once, all leaves together, and leave the correct page with no leaf. The page SHALL never be stuck, dimmed, covered, or unable to take clicks.

R38. IF the page is hidden or the window loses focus during a flip THEN THE SYSTEM SHALL finish or end it so that no leaf remains when the owner returns.

R39. IF the browser does not support the features the flip needs (for example 3D transforms) THEN THE SYSTEM SHALL change the day at once with no flip and no error. This is the only fallback besides R7 (hidden page).

R40. THE SYSTEM SHALL never delete, duplicate or change a task, a group, a collapsed state or the filter because of the flip. Stored data SHALL be unchanged byte for byte by any number of flips.

R41. THE SYSTEM SHALL keep every rule of `day-navigation` and `drag-drop` about the day change as it is (R1 to R9 and R19 to R26 of `day-navigation`, and R20 of `drag-drop`); this feature changes only how the change is drawn.

## Non functional requirements

1. Performance, update: WHEN the owner moves to another day with up to 200 tasks, the screen content for the new day SHALL be updated in under 100 ms, as in NFR1 of `day-navigation`. The flip or riffle SHALL not add to this time: the leaves are made in the same frame or the next one.
2. Performance, frame rate: during a flip or a full 3 leaf riffle with 200 tasks on the old day and 200 on the new day, the median frame rate SHALL be at least 55 frames per second on a mid range phone and on a desktop, and no frame SHALL take longer than 50 ms. The browser SHALL record no long task (over 50 ms) between the start and the end of the flip.
3. Performance, method: the flip SHALL animate only properties the browser can run off the main thread (`transform` and `opacity`) and SHALL NOT trigger layout or paint of the whole list on every frame. The first leaf SHALL NOT be a full live copy of 200 rows if that costs more than the budget in NFR 1 and 2; it MAY show only the part of the old page that is visible in the window. The extra leaves of a riffle are blank ruled paper, so a riffle costs no more than a flip plus two light layers.
4. Performance, repeats: 30 moves in 3 seconds SHALL leave no growing memory, no leftover leaf nodes and no leftover listeners (a count of leaf elements in the page after the last flip SHALL be zero).
5. Accessibility: all of R11 and R18 to R21 hold. The flip SHALL not flash more than three times in any one second (WCAG 2.3.1). Known and accepted risk (owner decision, 2026-11-12): because the flip ignores `prefers-reduced-motion` and has no off switch, it does not meet WCAG 2.3.3 (AAA level, animation from interactions can be disabled), so people sensitive to motion cannot turn it off. The flip stays short (700 ms, 950 ms for a riffle), plays only on a day change the owner caused, and never plays on load or at midnight.
6. Security and data protection: no data leaves the browser. The leaf is built from the app's own rendered page, never from the address or from stored text inserted as markup. No new dependency and no external library or image is needed (the flip is CSS and a little vanilla JavaScript, as the stack decision requires).
7. Reliability: the app works the same with the flip failing, because it is cosmetic. Every flip ends within 700 ms plus one frame, and every riffle within 950 ms plus one frame, or is ended by R14, R37 or R38.
8. Compatibility: works in the current versions of Chrome, Safari, Firefox and Edge on desktop and mobile, using the same `animationend` and `animationcancel` care as today. Safari and iOS cannot be tested on the build host, so they are listed as a manual check in the release note, as earlier releases did.
9. Hosting: the feature adds no file path that breaks the GitHub Pages subpath, and no asset except CSS and JS, which carry the release version query.
10. Language: no new visible text. Existing Vietnamese text and accessible names stay unchanged.

## Out of scope

1. Swipe or drag sideways on the page to change the day on phones (a possible later feature).
2. A real curl of the page corner with bending paper and lighting (a full physical simulation), page stack edges that grow thinner or thicker, and sound or vibration.
3. Turning pages of other things, for example a flip when changing the group filter or opening the "Nhóm việc" dialog.
4. More than 3 leaves in a riffle, a leaf for every day passed, and showing the days passed on the leaves.
5. Any switch to turn the flip off, in the app or through the system reduced motion setting, and any substitute motion such as a crossfade.
6. Keyboard shortcuts for changing the day, a month or week overview, and any other navigation change.
7. Any change to the data model, storage, groups, or drag and drop behaviour.

## Open questions

None. All questions are answered in the decision log (2026-11-11 "page-flip requirements", and the 2026-11-12 entries, which replace the earlier reduced motion, flip area and duration answers).
