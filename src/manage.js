import { COLORS, COLOR_NAMES, UNGROUPED, UNGROUPED_NAME } from "./groups.js?v=1.2.0";

const MOVE_ERROR = "Không thể lưu thay đổi. Chưa có việc nào được chuyển.";
const MOVE_STALE = "Một tab khác vừa thay đổi việc của nhóm này. Hãy tải lại trang rồi thử lại."; // BUG-013

export const GROUP_ERRORS = {
  empty: "Vui lòng nhập tên nhóm.",
  tooLong: "Tên nhóm tối đa 30 ký tự.",
  duplicate: "Tên nhóm này đã có rồi.",
  tooMany: "Tối đa 20 nhóm. Hãy xóa bớt một nhóm trước khi tạo thêm.",
};

const show = (el, on) => { el.hidden = !on; };

export function setFieldError(input, errorEl, code, messages = {}) {
  errorEl.querySelector(".field-error__text").textContent = messages[code] ?? "";
  show(errorEl, !!code);
  if (code) {
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", errorEl.id);
  } else {
    input.removeAttribute("aria-invalid");
    input.removeAttribute("aria-describedby");
  }
}

// Re-show on repeat submits so the alert is announced and the nudge replays.
export function showFieldError(input, errorEl, code, messages) {
  setFieldError(input, errorEl, null);
  void input.offsetWidth;
  setFieldError(input, errorEl, code, messages);
}

// The "Nhóm việc" card (R35 to R38). groups() returns the live groups instance, which the storage listener may replace.
// refresh() rebuilds the add choice, the filter and the day list behind the card.
// notify(text) shows the info slip (T10). showGroupTasks(id) puts the filter on the group and turns to its nearest day (R53).
// storedUsage(id) reads the group's tasks from storage again, read only (BUG-009).
export function createManage({ groups, store, button, refresh, notify, showGroupTasks, storedUsage }) {
  const $ = (id) => document.getElementById(id);
  const dialog = $("manage-dialog");
  const list = $("group-rows");
  const empty = $("group-rows-empty");
  const rowTemplate = $("group-row-template");
  const editTemplate = $("group-edit-template");
  const clone = (t) => t.content.firstElementChild.cloneNode(true);
  // The group whose row is in edit; one at a time (R36).
  let editId = null;
  // The sticky notes stacked over the card for Xóa (R51, R52), and the group they are about.
  const deleteNote = $("group-delete-dialog");
  const blockedNote = $("group-blocked-dialog");
  let noteId = null;
  // The storage slip sits behind the modal card, so a failed write is also said inside it, in the slip's own words (T11).
  const saveError = $("manage-save-error");
  function showSaveResult() {
    const text = saveError.querySelector("p");
    text.textContent = "";
    show(saveError, !groups().storageOk);
    if (!groups().storageOk) requestAnimationFrame(() => { text.textContent = $("storage-slip").textContent.trim(); });
  }

  function viewRow(g, i) {
    const row = clone(rowTemplate);
    row.dataset.id = g.id;
    const name = row.querySelector(".group-row__name");
    name.id = `group-row-${i}`; // index based: a stored id may hold spaces, which would break an idref
    const sticker = row.querySelector(".sticker");
    sticker.textContent = g.name;
    sticker.dataset.color = g.color;
    // No task on any day: the move button stays focusable but inactive, with the hint shown (R67).
    if (store.groupUsage(g.id).count) row.querySelector(".group-row__hint").remove();
    else row.querySelector('[data-action="move"]').setAttribute("aria-disabled", "true");
    for (const b of row.querySelectorAll("button")) b.setAttribute("aria-describedby", name.id);
    return row;
  }

  function editRow(g) {
    const row = clone(editTemplate);
    row.dataset.id = g.id;
    row.querySelector(".input").value = g.name;
    const pick = row.querySelector(".colour-pick__list");
    const first = pick.firstElementChild;
    pick.replaceChildren(...COLORS.map((c) => {
      const label = first.cloneNode(true);
      Object.assign(label.querySelector("input"), { value: c, checked: c === g.color });
      label.querySelector(".swatch").dataset.color = c;
      label.querySelector(".visually-hidden").textContent = COLOR_NAMES[c];
      return label;
    }));
    return row;
  }

  // Rebuilds the rows. Focus on a row button is put back on the same button of the same group, else on Đóng.
  function render(focusId, action) {
    const f = document.activeElement;
    if (focusId === undefined && list.contains(f)) [focusId, action] = [f.closest(".group-row")?.dataset.id, f.dataset.action];
    const all = groups().list();
    if (!all.some((g) => g.id === editId)) editId = null;
    list.replaceChildren(...all.map((g, i) => (g.id === editId ? editRow(g) : viewRow(g, i))));
    show(empty, !all.length);
    if (focusId) focusRow(focusId, action);
  }

  function focusRow(id, action) {
    const row = [...list.children].find((r) => r.dataset.id === id);
    (row?.querySelector(`[data-action="${action}"]`) ?? dialog.querySelector('[data-action="close"]')).focus();
  }

  // Xóa: an empty group asks first; a group with a task on any day is never deleted (R51, R52). Xóa is never disabled.
  function askDelete(id, usage = store.groupUsage(id)) {
    if (editId) { editId = null; render(id, "delete"); } // an open row edit is dropped, as Sửa does (R36)
    const g = groups().get(id);
    if (!g) return render(null); // gone in another tab
    const { count, days } = usage;
    const note = count ? blockedNote : deleteNote;
    note.querySelector(".dialog__title").textContent = count
      ? `Chưa thể xóa nhóm "${g.name}" vì nhóm còn ${count} việc trong ${days.length} ngày. Hãy chuyển các việc này sang nhóm khác trước.`
      : `Xóa nhóm "${g.name}"?`;
    const sticker = note.querySelector(".sticker");
    sticker.textContent = g.name;
    sticker.dataset.color = g.color;
    noteId = id;
    note.showModal();
  }

  // Ends a note's errand: the close event then has nothing left to put back.
  function takeNote(note) {
    const id = noteId;
    noteId = null;
    note.close();
    return id;
  }

  // Xóa nhóm: tasks are never touched; focus goes to the next row's Sửa, else the previous one, else Đóng.
  function removeGroup() {
    const id = takeNote(deleteNote);
    // Another tab may have given the group a task while the question was open: read the stored tasks again (BUG-009).
    const fresh = storedUsage(id);
    if (fresh.count) return askDelete(id, fresh);
    const rows = [...list.children];
    const i = rows.findIndex((r) => r.dataset.id === id);
    const next = rows[i + 1] ?? rows[i - 1];
    groups().remove(id);
    showSaveResult();
    refresh(); // a filter or add choice on it falls back at once (R48, R21)
    render(null);
    focusRow(next?.dataset.id, "rename");
  }

  // Xem các việc này (R53): both dialogs close (the card's close runs refresh() and focuses Quản lý nhóm), then the day turns.
  function showTasks() {
    const id = takeNote(blockedNote);
    dialog.close();
    showGroupTasks(id);
  }

  deleteNote.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "remove") removeGroup();
    else if (action === "keep") deleteNote.close();
  });
  blockedNote.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "show") showTasks();
    else if (action === "keep") blockedNote.close();
    else if (action === "move") openMove(noteId, e.target.closest("button"));
  });
  // Giữ lại, Đã hiểu, Escape and the backdrop, as on the task note: the group stays and focus goes back to its Xóa.
  for (const note of [deleteNote, blockedNote]) {
    note.addEventListener("click", (e) => {
      if (e.target !== note) return; // the note's own padding also targets the dialog
      const r = note.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) note.close();
    });
    note.addEventListener("close", () => {
      // The close event is queued: a quick Enter may have opened this note again, or Xóa nhóm may have handed over
      // to the blocked note (BUG-009). Either way the open note owns noteId now.
      if (deleteNote.open || blockedNote.open) return;
      const id = noteId;
      noteId = null;
      if (id) focusRow(id, "delete");
    });
  }

  // Chuyển tất cả việc (R67 to R72): the move card, stacked over the card or the blocked note that opened it.
  const moveCard = $("move-dialog");
  const target = $("move-target");
  const moveAlert = moveCard.querySelector(".alert");
  let moveId = null; // the source group while the card is open; null once it has acted, so its close event does nothing
  let moveUsage = null; // the counts the sentence states
  let opener = null;
  let refreshed = false; // a move has refreshed the page already: the card's close need not do it again

  const colorOf = (key) => groups().get(key)?.color ?? "none";
  const nameOf = (key) => groups().get(key)?.name ?? UNGROUPED_NAME;
  const option = (value, text) => Object.assign(document.createElement("option"), { value, textContent: text });

  // Chưa phân nhóm first, then every group but the source; the chosen target is kept if it still exists (R68).
  function renderTargets() {
    const keep = target.value;
    target.replaceChildren(option(UNGROUPED, UNGROUPED_NAME),
      ...groups().list().filter((g) => g.id !== moveId).map((g) => option(g.id, g.name)));
    target.value = [...target.options].some((o) => o.value === keep) ? keep : UNGROUPED;
    renderSentence();
  }

  function renderSentence() {
    target.closest(".select").querySelector(".swatch").dataset.color = colorOf(target.value);
    $("move-text").textContent = `Chuyển ${moveUsage.count} việc trong ${moveUsage.days.length} ngày sang nhóm "${nameOf(target.value)}"? `
      + "Ngày, trạng thái hoàn thành và thứ tự của các việc được giữ nguyên.";
  }

  function openMove(id, from) {
    const g = groups().get(id);
    if (!g) return render(null); // gone in another tab
    if (editId) { editId = null; render(id, "move"); from = document.activeElement; } // an open row edit is dropped (R36)
    moveId = id;
    opener = from;
    moveUsage = store.groupUsage(id);
    $("move-title").textContent = `Chuyển tất cả việc của nhóm "${g.name}"`;
    const sticker = moveCard.querySelector(".sticker");
    sticker.textContent = g.name;
    sticker.dataset.color = g.color;
    target.value = UNGROUPED;
    show(moveAlert, false);
    renderTargets();
    moveCard.showModal();
  }

  // Shown empty, then written a frame later, so a second failure is announced again.
  function showMoveError(message = MOVE_ERROR) {
    const text = moveAlert.querySelector("p");
    text.textContent = "";
    show(moveAlert, true);
    requestAnimationFrame(() => { text.textContent = message; });
  }

  function confirmMove() {
    const id = moveId;
    const to = target.value;
    // Another tab may have stored tasks of this group that this tab does not hold: one write of this tab's
    // list would drop them, so nothing is written and a reload is asked for (BUG-009, BUG-013). Locked storage reads this tab's copy.
    // Ids, not counts: another tab may have added one task and moved another out (review).
    const mine = new Set(store.groupUsage(id).days.flatMap((d) => store.tasksFor(d)).filter((t) => t.groupId === id).map((t) => t.id));
    if (storedUsage(id).ids?.some((x) => !mine.has(x))) return showMoveError(MOVE_STALE);
    const result = store.moveGroup(id, to === UNGROUPED ? null : to);
    if (result.error) return showMoveError(); // all or nothing: every task is still in its group (R70)
    if (groups().isCollapsed(to)) groups().setCollapsed(to, false); // the target section opens (R71)
    moveId = null;
    // The list, choices and filter follow before the dialogs go, so the page lays out once (200 tasks, NFR1).
    refresh();
    refreshed = true;
    moveCard.close();
    if (blockedNote.open) takeNote(blockedNote);
    dialog.close(); // its close event focuses Quản lý nhóm (R71)
    notify(`Đã chuyển ${result.moved} việc sang nhóm "${nameOf(to)}".`);
  }

  target.addEventListener("change", renderSentence);
  moveCard.addEventListener("submit", (e) => {
    e.preventDefault();
    confirmMove();
  });
  moveCard.addEventListener("click", (e) => {
    if (e.target.closest("[data-action]")?.dataset.action === "cancel") moveCard.close();
  });
  // Hủy or Escape: nothing changes, focus goes back to the button that opened the card (R68).
  moveCard.addEventListener("close", () => {
    if (moveCard.open) return; // queued event of a card that was opened again straight away
    const id = moveId;
    moveId = null;
    if (!id) return;
    if (opener?.isConnected) opener.focus();
    else focusRow(id, "move");
  });

  const nameInput = () => list.querySelector(".group-row--editing .input");
  const nameError = () => list.querySelector(".group-row--editing .field-error");

  function startEdit(id) {
    editId = id;
    render(null);
    const input = nameInput();
    // A stale row: its group went in another tab while another row was in edit, so render dropped it.
    if (!input) return dialog.querySelector('[data-action="close"]').focus();
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    // A lower row grows in the scrolling list: bring Hủy and Lưu into view too (BUG-008).
    list.querySelector(".group-row__edit-actions").scrollIntoView({ block: "nearest" });
  }

  // Hủy or Escape: the old name and colour stay, focus goes back to that row's Sửa (R36).
  function cancelEdit() {
    const id = editId;
    editId = null;
    render(id, "rename");
  }

  dialog.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "close") dialog.close();
    else if (action === "rename") startEdit(e.target.closest(".group-row").dataset.id);
    else if (action === "cancel") cancelEdit();
    else if (action === "delete") askDelete(e.target.closest(".group-row").dataset.id);
    else if (action === "move") {
      const button = e.target.closest("button");
      // Inactive (R67): focusable with its hint, but a press does nothing.
      if (button.getAttribute("aria-disabled") !== "true") openMove(button.closest(".group-row").dataset.id, button);
    }
  });

  dialog.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = nameInput();
    const result = groups().update(editId, input.value, e.target.querySelector("input:checked")?.value);
    if (result.error && result.error !== "notFound") {
      showFieldError(input, nameError(), result.error, GROUP_ERRORS);
      input.focus();
      return;
    }
    // Saved at once (R55); the page behind shows the new name and colour straight away (R37).
    const id = editId;
    editId = null;
    showSaveResult();
    refresh();
    render(id, "rename");
  });

  dialog.addEventListener("input", (e) => {
    if (e.target === nameInput() && !nameError().hidden) setFieldError(e.target, nameError(), null);
  });

  dialog.addEventListener("keydown", (e) => {
    if (!editId || (e.key !== "Escape" && e.key !== "Enter")) return;
    // isComposing or keyCode 229: a key that ends an IME composition (Safari reports only 229).
    if (e.isComposing || e.keyCode === 229) {
      if (e.key === "Escape" || !e.isComposing) e.preventDefault(); // keep the card open; Safari: no submit on the commit Enter
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault(); // the Escape cancels the row edit, not the card
      cancelEdit();
    }
  });
  // Backup for a close request that skips keydown: while a row is in edit, it cancels the edit instead.
  dialog.addEventListener("cancel", (e) => {
    if (!editId) return;
    e.preventDefault();
    cancelEdit();
  });

  // Đóng or Escape (R38). A backdrop click does nothing: the card holds forms.
  dialog.addEventListener("close", () => {
    if (dialog.open) return; // queued event of a card that was opened again straight away: keep its focus
    editId = null;
    if (!refreshed) refresh();
    refreshed = false;
    button.focus();
  });

  return {
    open() {
      editId = null;
      show(saveError, false);
      render(null);
      dialog.showModal();
    },
    // Groups changed in another tab: rows follow unless one is in edit, which keeps the typed name.
    sync() {
      if (dialog.open && !editId) render();
      if (moveCard.open) {
        if (groups().get(moveId)) renderTargets(); // a target removed in another tab falls back to Chưa phân nhóm
        else {
          if (blockedNote.open) moveId = null; // the note under it goes too: no focus on its button
          moveCard.close();
        }
      }
      // The blocked note's group went in another tab (BUG-012): its close event focuses the row's Xóa, else Đóng.
      if (blockedNote.open && !groups().get(noteId)) blockedNote.close();
    },
  };
}
