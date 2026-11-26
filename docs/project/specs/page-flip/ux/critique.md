# page-flip UX: critique and heuristic review

Method: `screens/flip.html` was captured with Playwright at 1440 px and 390 px (and 360 px for the forward frame), in light and dark mode, both settled and frozen mid turn (forward and back at 225 ms, riffle of 3 at 350 ms) using the prototype's frame inspector. Twelve storyboard frames were captured for the index. The visual-critique:critique-screen pass (hierarchy, brand, composition, typography, colour, affordance, density) was run on those captures, followed by a Nielsen heuristic walk through each flow. Behaviour was checked in the browser: 30 presses at 100 ms intervals leave zero leaves and the correct day in the address and the picker; riffles build 2 and 3 leaves; Back follows the date, not the history; a held key and reduced motion build no leaf and no tape press; typing and adding during a flip land on the new day; focus stays on the arrow; the stage is aria-hidden; no horizontal scroll at any width.

## Fixed in this review

| Priority | Dimension | Issue | Fix |
| --- | --- | --- | --- |
| P2 | Composition, motion | With an ease out curve the leaf was almost edge on by 200 ms, so the turn felt like a snap followed by nothing | `--ease-flip` changed to cubic-bezier(0.5, 0.05, 0.7, 0.75): slow lift, then the turn speeds up, so the visible sweep spreads over the whole 450 ms; reversed it lands softly |
| P2 | Colour | At 0.16 the shade dropped done ink to about 4.1:1 near the leaf's free edge while text was still readable (R35) | `--flip-shade` capped at 0.10 by day (done ink 4.6:1 at the darkest point). At night the shade only raises contrast |
| P2 | Colour | In dark mode the free edge of blank riffle leaves disappeared against the charcoal page, so a riffle read as a flicker | Leaf edge drawn with a 45 percent pencil line and the cast shadow colour, visible in both modes |
| P2 | Composition | The prototype control slip pushed the sheet 400 px down on desktop, so the flip ran in a small window unlike the real app | On screens of 1360 px and wider the slip sits in the left desk gutter; on phones it is collapsed by default |
| P2 | Affordance | On phones, the frame inspector built no leaf, because the open slip pushed the sheet body out of view | Phone captures use `&closed`; the real stage correctly skips a sheet body that is not in the window |
| P3 | Affordance | The "Reduce motion" checkbox shrank when its label wrapped | `flex: none` on the prototype checkboxes |
| P3 | Composition | "Open the prototype" stretched across the whole index page | `width: fit-content` |

## Remaining findings (low priority, accepted)

| Priority | Dimension | Finding | Decision |
| --- | --- | --- | --- |
| P3 | Composition | While the leaf rises, its top edge grows past the double rule and is cut there, so the add line on the leaf is briefly cropped | Accepted: it reads as the page passing under the header band, and keeping the leaf inside the sheet body is required (R13) |
| P3 | Hierarchy | Going back, the uncovered part beside the landing leaf already shows the earlier day, so the old page is never seen being covered | Accepted: R10 requires the real new day underneath from the first frame. The landing direction still tells the owner they went back |
| P3 | Composition | The back of the leaf is shown by fading the text into darker paper rather than by the leaf passing over the rings | Accepted: a leaf past 90 degrees would leave the sheet (R13). Raised as an open question in case the owner wants the back drawn over the hole strip |
| P3 | Density | The prototype slip is wordy | Prototype only, not part of the app |

## Heuristic evaluation (Nielsen)

| Heuristic | Flow | Finding | Severity |
| --- | --- | --- | --- |
| Visibility of system status | 1, 2 | The new heading, tape and rows are in place in the first frame; the turn direction matches the date. The riffle length tells a far jump from a near one | 0 |
| Match with the real world | 1, 2 | A leaf turning on its rings, with a moving shadow and a darker back, matches a paper notebook. Blank pages in a riffle avoid showing days that were skipped | 0 |
| User control and freedom | 1, 4 | Any new press ends the running turn at once; nothing is queued; typing and ticking never wait | 0 |
| Consistency and standards | 2, 3 | Every way of changing the day (arrows, picker, Về hôm nay, Back, Forward, hash) uses the same rules. Load, midnight and same day moves never flip | 0 |
| Error prevention | 1, 5 | The leaf ignores the pointer, so a click during the turn can never hit the old page (R23). A drag is cancelled before the turn | 0 |
| Recognition over recall | All | No new control or text to learn | 0 |
| Flexibility and efficiency | 4 | A held key runs through days without a flip, and rapid presses never lag | 0 |
| Aesthetic and minimalist design | All | One motion per day change, on the sheet body only; the header stays calm | 0 |
| Accessibility | All | Reduced motion removes the flip completely; the leaf is aria-hidden and inert; focus and the live date line are untouched; no flashing (fewer than 3 changes a second for any one leaf) | 0 |
| Help and documentation | Not applicable | No help needed | 0 |

No high or medium findings remain.
