# drag-drop: design critique

Screens were captured with Playwright at 1440 by 900, 390 by 844 and 360 by 780, in light and dark mode (`screenshots/`). Each round was reviewed with `visual-critique:critique-screen` (hierarchy, brand, composition, typography, colour, affordance, density) and a heuristic walk through of the three flows. Horizontal scroll was checked on every capture: none.

## Round 1 (fixed)

| Priority | Issue | Dimension | Fix |
| --- | --- | --- | --- |
| P1 | Group names in the strip were cut with an ellipsis on phones ("Học tiếng ...", "Chưa phân..."), which the owner has rejected before | Typography | Labels wrap and are never cut; the strip keeps its full height |
| P1 | The strip could clip groups when there are many (max height with hidden overflow), breaking R9 | Affordance | Removed the clipping; the strip grows upward |
| P1 | The prototype slip ran past the screen on phones and caused horizontal scroll | Composition | Slip clamped inside the screen; the FE note says to clamp it too |
| P2 | The strip looked see through in captures because its entrance motion was still running | Colour | Motion turned off in the prototype captures only |

## Round 2 (fixed)

| Priority | Issue | Dimension | Fix |
| --- | --- | --- | --- |
| P1 | On a folded target at 390 px dark, the next section's label painted over the slip | Hierarchy | Slip lives on `body` above everything (FE note); prototype stacking fixed |
| P1 | In "Row lifted" the pointer rested on the Công ty header, which is a target, while the state means "no target" | Affordance | Pointer moved to the filter line |
| P2 | The auto scroll band crossed the whole desk like a glitch and its chevron was hidden behind the slip | Composition | Band limited to the sheet width; chevron at the line end |
| P2 | Focus on the next row's tick box was not visible after a move to a hidden group | Affordance | Focus ring drawn on the tick box square, as the design system already does |
| P2 | At 1440 px "Chưa phân nhóm" wrapped alone onto a second strip line | Density | Strip as wide as the sheet; all five groups fit on one line |

## Heuristic evaluation (Nielsen)

| Heuristic | Finding | Severity | Status |
| --- | --- | --- | --- |
| Visibility of system status | Placeholder, slip, framed target and the label on the slip show what will happen before release | 0 | ok |
| User control and freedom | Escape, release on nothing or on the own group cancels; nothing is written | 0 | ok |
| Error prevention | A press without movement stays a click; on phones a swipe or scroll wins before 400 ms | 0 | ok |
| Recognition over recall | Every group is listed in the strip, even empty or hidden ones | 0 | ok |
| Visibility of status after a move to a hidden group | The task disappears; the info slip says where it went | 1 | ok, see open question 2 |
| Discoverability of the long press | Nothing tells a phone user that a long press picks up a line (a first time hint is out of scope, item 7) | 2 | accepted, Sửa still works |
| Consistency | Same torn labels, wash and slip language as task-groups | 0 | ok |

## Remaining (P3, accepted)

- The task's own group is faded in the strip (0.45 opacity). It is inactive, so the contrast rule does not apply, but colour and fading are the only cue. See open question 3.
- The finger and cursor drawings in the prototype are illustrations only and are not part of the product.
- The slip covers one or two lines under the pointer while dragging; this is expected and is why the target is also named on the slip.
