# day-navigation UX: critique and heuristic review

Method: every screen was captured with Playwright in a vi-VN context at 1440 px and 390 px, in both light and dark mode. Today, yesterday, past-empty and picker-open were also captured at 360 px. The visual-critique:critique-screen pass (hierarchy, brand, composition, typography, colour, affordance, density) was run on those captures, followed by a Nielsen heuristic walk through each flow. Horizontal overflow was measured on every capture (none found), every nav control was measured at 44 px or more, and the real Tab order was checked in the browser.

## Fixed in this review

| Priority | Dimension | Issue | Fix |
| --- | --- | --- | --- |
| P1 | Affordance, colour | The visible native date field printed the date in the browser's locale (11/08/2026 on an English browser) next to the washi tape's 08/11/2026, which could make the owner think they were on the wrong day | At rest the stamp shows only a calendar mark; the date lives on the washi tape only. The native field appears only while it has keyboard focus with a fine pointer |
| P2 | Density | The date was written twice in the header (stamp and tape) | Same fix as above |
| P2 | Hierarchy | Tooltips on the arrows opened above and covered the heading | Nav tooltips open below, with 16 px of room above the tape on desktop |
| P2 | Affordance | The stamp had no visible name while its sibling arrows had tooltips | Stamp tooltip "Chọn ngày" via `data-tip`, same look and delay as the icon buttons |
| P2 | Composition | Chevrons sat about 18 px right of the title's left edge | `.day-nav__step` pulled left 11 px for optical alignment, keeping 44 px targets |
| P2 | Typography | At 360 px "Bạn cần làm gì ngày này?" was cut off | Placeholder at 14 px below 381 px wide |
| P2 | Affordance | The picker-open mock widened the stamp on phones, which the product does not do on touch | Widening shown on desktop only; phones keep the small stamp |
| P2 | Composition | The page turning arrows and the stamp were one stepper, so widening the stamp on focus moved the next arrow | Order is now previous, next, stamp, so widening never moves an arrow |
| P3 | Affordance | The Về hôm nay link showed a text underline | `text-decoration: none` on `.today-tab` |

## Remaining findings (low priority, accepted)

| Priority | Dimension | Finding | Decision |
| --- | --- | --- | --- |
| P3 | Composition | At 360 px Về hôm nay wraps onto its own line under the arrows (it fits on one row from about 380 px) | Accepted: the wrap is graceful, right aligned, and keeps 44 px targets. Raised as an open question |
| P3 | Typography | When widened by keyboard focus, Chromium formats the native field from the browser's UI language, so an English Chrome shows mm/dd/yyyy | Accepted: native behaviour (NFR4), keyboard only, and the tape confirms the day in dd/mm/yyyy straight after the change |
| P3 | Hierarchy | On other days the pen filled Về hôm nay tab and the Thêm button have equal weight | Intentional: the tab is the strongest "not today" signal (R29) |
| P3 | Brand | The calendar itself is the browser's and does not match the notebook | Required by NFR4; the stamp that opens it is on brand |

## Heuristic evaluation by flow

| Flow | Heuristic | Severity | Note |
| --- | --- | --- | --- |
| Turn one page | Visibility of system status | 0 | Heading, tape wording, placeholder and tab all change; the page turn shows the direction; the date line is announced |
| Turn one page | User control and freedom | 0 | Browser Back retraces each move; Về hôm nay is one step home |
| Pick a date | Error prevention | 1 | `min` and `max` bound the picker; bad values reset silently to the viewed day (R9). A silent reset is fine because nothing changed |
| Pick a date | Recognition over recall | 1 | The stamp is an icon until hovered; the tooltip and the calendar mark make it recognisable |
| Back to today | Consistency and standards | 0 | Stays in place on every day, so muscle memory works; inactive state stays focusable |
| Work on another day | Error prevention (wrong day) | 1 | Three cues: the heading drops "hôm nay", the tape names the day, and the placeholder says "ngày này". The filled tab adds a fourth on desktop and phone |
| Load and bookmark | Match with the real world | 0 | The plain address is always today, and a bookmark opens its day |
| Midnight | Visibility of system status | 1 | The wording updates when the owner returns; no notice is shown, as the requirements ask |

## Captures

All in `screenshots/`: `<screen>-desktop.png`, `<screen>-mobile.png` (390 px) and `<screen>-dark-*.png` for every screen; `-mobile360.png` for today, yesterday, past-empty and picker-open; and the close ups `today--next-keyboard-desktop.png`, `today--stamp-keyboard-desktop.png` and `yesterday--stamp-hover-desktop.png`.
