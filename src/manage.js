import { COLORS, COLOR_NAMES } from "./groups.js?v=1.2.0";

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
export function createManage({ groups, store, button, refresh }) {
  const $ = (id) => document.getElementById(id);
  const dialog = $("manage-dialog");
  const list = $("group-rows");
  const empty = $("group-rows-empty");
  const rowTemplate = $("group-row-template");
  const editTemplate = $("group-edit-template");
  const clone = (t) => t.content.firstElementChild.cloneNode(true);
  // The group whose row is in edit; one at a time (R36).
  let editId = null;

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
    if (!focusId) return;
    const row = [...list.children].find((r) => r.dataset.id === focusId);
    (row?.querySelector(`[data-action="${action}"]`) ?? dialog.querySelector('[data-action="close"]')).focus();
  }

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
    // move (T10) and delete (T9) come later.
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
    editId = null;
    refresh();
    button.focus();
  });

  return {
    open() {
      editId = null;
      render(null);
      dialog.showModal();
    },
    // Groups changed in another tab: rows follow unless one is in edit, which keeps the typed name.
    sync() {
      if (dialog.open && !editId) render();
    },
  };
}
