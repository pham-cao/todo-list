Charter: can a task end up on a day the owner did not intend? (R29, 4 combinations 1440 and 390, light and dark)
A typed text, move to yesterday, Enter: stored on 08/11 (the day on screen). OK
B typed text on today, silent midnight, Enter: stored 2026-11-10, screen shows 10/11 with the new wording. OK
C same on #2026-11-10: stored 10/11, the day on screen is now today. OK
D silent midnight on #2026-11-08, add: stored 08/11, wording updated to plain weekday and date. OK
E tomorrow, midnight, Back: both entries show today (plain address now means today). Observation only (Back seems to do nothing).
N two tabs open on different days: the second add overwrites the first tab's task (memory loaded once, no storage sync). Pre-existing daily-task-log design and NFR1; not caused by day-navigation. Residual risk.
Result: no wrong day found. Day identity was readable from the heading, date line and Về hôm nay state in every screenshot. Charter T7-10 still to be completed by T7.

T7 completion (30 minute session, 2026-11-09, 390 and 1440, light and dark; screenshots in evidence/T7-09/)
Task: read today, yesterday and tomorrow without the picker and name the day, then try to add on the wrong day.
- Today: title "Việc cần làm hôm nay", placeholder "Bạn cần làm gì hôm nay?", dated line "Hôm nay, ...", Về hôm nay dashed and grey. Four independent cues, no ambiguity.
- Yesterday: title plain "Việc cần làm", placeholder "...ngày này?", line "Hôm qua, Chủ Nhật, 08/11/2026", Về hôm nay filled. Name the day correct in all 4 combinations.
- Tomorrow and a far day: line "Ngày mai, Thứ Ba, ..." or a plain weekday and date; Về hôm nay filled; empty text "Ngày này chưa có việc nào" says it is not today.
- Adding: not repeated by hand in T7. Covered by the T6 session (A to D) and the e2e cases for adding on yesterday, an empty future day and after midnight, all passing.
- Weak spot noted (not a bug): the heading is identical on yesterday, tomorrow and far days, so only the date line separates them. They are always one glance apart through the date line and the stamp. Low risk.
- Observation: the swipe hint on the first task (phone) briefly shows the action strip over the first row on first load; pre-existing, unrelated.
- Residual risk N unchanged (two tabs overwrite).
Result: no wrong-day path found; day state is clear at a glance. Charter complete. Cases: pass.
