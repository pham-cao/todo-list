# Release 1.5.0: group header

## What changes for the owner

- "Quản lý nhóm" now sits in the header, under "Về hôm nay", with its label always visible and a comfortable touch size on phones and on desktop. Closing the card returns focus to that button.
- The group bar no longer shows a manage button. It shows the filter alone, and it stays hidden until the first group exists.
- Groups are now created only from "Thêm nhóm" inside the "Quản lý nhóm" card, using a new group box. The old inline creation is gone. The box checks for an empty name, a name that is too long, a duplicate name and the group limit, and shows a clear message for each. A Vietnamese Telex input that is still composing no longer creates a group when Enter is pressed.
- On phones, the sticky notes (the new group box, the delete group note, the blocked delete note and the task delete note) open as bottom sheets, full width and straight, with the controls kept above the on screen keyboard. On desktop they stay centred as before.
- Every local file reference now carries `?v=1.5.0`, so browsers load the new files. There are no new dependencies.

## Manual checks before release

Automated tests cover Chromium on desktop and a Pixel 7 profile. Please check these by hand on real devices.

1. TC-32, iPhone with Safari: open the new group box at 360 by 640 with the on screen keyboard showing. The input and both buttons must stay visible above the keyboard. Look at the three sheets in light and dark mode, and save screenshots in `qa/evidence/T3-fe`.
2. TC-33, iOS Safari with Vietnamese Telex input: type a name such as "nhaf" in the new group box. Enter during composition must not create a group, and the final Enter must create it.
3. TC-34, Firefox, Safari and Edge on desktop, as a smoke test: the header button, creating a group, cancelling, an error message and the sheet layout should behave as in Chrome, with no layout break.
