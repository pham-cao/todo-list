# Release 1.4.0: page flip

## What changes for the owner

- Changing the day now turns the whole sheet like a real notebook page. The page curls away from the top right corner with a diagonal fold, the lower corner lagging behind, and the new day is already there underneath. Going back to an earlier day plays it the other way: a page of that day uncurls flat onto the sheet.
- The number of pages that turn follows the distance: 1 page for the next or previous day, 2 pages for a jump of 2 days, and 3 pages for 3 days or more. One page takes 700 ms and a 3 page riffle takes 950 ms.
- The flip always plays, also when the system asks for reduced motion (owner decision, 2026-11-12). There is no switch to turn it off.
- The sheet now sits on a thick stack of pages with a card back cover, on the right and at the bottom, in light and dark mode.
- The day, the address, focus and the screen reader text change at once, as before. The turning page is only a picture: it cannot be clicked, focused or read out, and no data is read or written by it.
- The curl is drawn by StPageFlip 2.0.7 (MIT, copyright 2020 Nodlik), vendored in `vendor/page-flip/` with its licence and two small marked patches (its stylesheet is a linked file, so the Content Security Policy is unchanged, and its frame loop sleeps while no page turns). There is no CDN and no new npm dependency.
- Every local file reference now carries `?v=1.4.0`, so browsers load the new files.

## Manual checks before release

Automated tests cover Chromium on desktop and a Pixel 7 profile. Please check these by hand on real devices.

1. Safari on macOS and on iOS:
   - The curl shows the diagonal fold, with no seams, no clipped corners and no blank flash, in light and dark mode.
   - The same with Reduce Motion switched on (the flip still plays).
   - The page stack edges and the back cover look right at phone width, with no sideways scroll.
   - Quick taps on the arrows leave no page behind on the sheet.
   - Keyboard: Tab order and focus stay on the pressed arrow during a flip, and Enter on an arrow flips once.
2. A mid range Android phone:
   - The 950 ms riffle (a jump of 3 days or more) looks smooth.
   - Stutter on weaker phones is a known and accepted risk (see below); please note how it looks rather than block the release on it.
3. Firefox and Edge on desktop, as a smoke test: a forward flip, a back flip and a riffle play and end cleanly, in light and dark mode, and the stack shows around the sheet.

## Accepted risks (decisions.md)

- Always flip, no off switch (2026-11-12): the flip ignores the system reduced motion setting and the app has no switch for it. People sensitive to motion cannot turn it off, a known risk against WCAG 2.3.3 (Animation from Interactions, AAA). The motion is one short turn started by the person's own action, with no flashing.
- Fold shadow contrast (2026-11-13): the library's fold shadow keeps the approved strength (`maxShadowOpacity` 0.55). For the frames the moving shadow band passes over text on the page underneath, that text may drop below 4.5:1; the band is exempt from R35. Text on the turning page itself stays at 4.5:1 or better.
- Smoothness on slower devices (2026-11-13): the flip always plays at full strength, with no lighter fallback. On a scrolled day with 200 rows the first frame of a curl took 23 to 44 ms in QA's runs, and weak phones may stutter during the riffle.
