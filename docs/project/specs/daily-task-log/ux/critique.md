# daily-task-log UX v3 ("Paper notebook"): critique and heuristic review

Method: every screen was captured with Playwright at 1440 px and 390 px in light mode, and today, empty, all done, delete and swipe also in dark mode. The visual-critique:critique-screen pass (hierarchy, brand, composition, typography, colour, affordance, density) was run on those screenshots, followed by a Nielsen heuristic walk through each flow. Horizontal overflow was checked at 1440, 390 and 360 px (none found), and keyboard focus on a mobile row was tested (Tab to Sửa scrolls the row open).

## Fixed in this pass

| Priority | Dimension | Issue | Fix |
| --- | --- | --- | --- |
| P1 | Colour, affordance | Unticked checkboxes showed a stray dot of ink (tick dash length shorter than the path) | Tick path uses `pathLength="100"` and a 101 dash, so nothing shows until ticked |
| P2 | Typography | Text floated well above the ruled line | Ruling lifted to `--rule-shift: -10px`; baseline now sits just above the line and Vietnamese under dots stay clear |
| P2 | Composition | The storage slip in the ruled body broke the 44 px rhythm, pushing every line off the ruling | Slip moved into the unruled header band |
| P2 | Affordance | On mobile the placeholder was cut off ("hôm nay" without "?") | Mobile input and task text at 16 px, tighter Thêm padding |
| P2 | Hierarchy | Complete state showed the closed blue circle and the red stamp together, which read as busy | The circle fades out once the stamp lands |
| P2 | Density | Empty state showed a lone dotted circle with no summary, which meant nothing | Progress mark is hidden when there are no tasks, the same as the summary |
| P2 | Brand | The editing line used a grey pen wash that looked dull on cream paper | Editing line uses a highlighter wash (`--color-highlight`) |
| P3 | Colour | Dark sticky note looked olive and muddy | Warmer dark note colour #433A2A (text 9:1) |
| n/a | Process | Row actions looked always visible in desktop error and edit captures | Verified this was a Playwright full page capture artifact (hover media); captures now resize the viewport instead |

## Remaining findings (low priority, accepted)

| Priority | Dimension | Finding | Decision |
| --- | --- | --- | --- |
| P3 | Density | On phones, long tasks wrap onto several 44 px lines, so a long list scrolls further than in v2 | Accepted: it is what makes text sit on real lines, and each row stays a 44 px target. See open question on mobile line pitch |
| P3 | Affordance | Swipe is not discoverable on first use | Raised as an open question (one time peek hint) |
| P3 | Hierarchy | The 36 px progress circle is quiet at low completion | Intentional; the written summary next to it carries the status |

## Heuristic evaluation by flow

| Flow | Heuristic | Severity | Note |
| --- | --- | --- | --- |
| Open page | Visibility of system status | 0 | Date on tape and summary are the first things after the title |
| Add | Error prevention and recovery | 0 | Message is under the line, names the problem, clears on typing |
| Complete | Match with the real world | 0 | Tick and strike match how people mark a paper list |
| Complete | Aesthetic and minimalist | 0 | Celebration is a stamp only, no new text |
| Edit | User control | 0 | Hủy and Escape always available, one row at a time |
| Edit, delete on phone | Recognition over recall | 2 | Swipe is hidden until learned; mitigated by focus reveal and SR access, open question on a hint |
| Delete | Error prevention | 0 | Sticky note confirmation, focus starts on Giữ lại |
| Storage | Help users recognise errors | 0 | Plain message, stays until a save succeeds |
| New day | Consistency | 0 | Same empty page with the new date, earlier days kept |

No high or medium priority findings remain.
