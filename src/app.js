import { toDateKey, formatDate } from "./date.js";
import { createStore, getStorage } from "./store.js";

const $ = (id) => document.getElementById(id);
const els = {
  date: $("date-line"),
  progress: $("progress"),
  summary: $("summary"),
  count: $("summary-count"),
  slip: $("storage-slip"),
  form: $("add-form"),
  input: $("new-task"),
  addError: $("new-task-error"),
  empty: $("empty"),
  list: $("task-list"),
  rowTemplate: $("task-template"),
  editTemplate: $("edit-template"),
  dialog: $("delete-dialog"),
  quote: $("del-task"),
};

const show = (el, on) => { el.hidden = !on; };

const store = createStore(getStorage());
const startedAt = new Date();
let shownDate = toDateKey(startedAt);

function renderRow(task) {
  const row = els.rowTemplate.content.firstElementChild.cloneNode(true);
  const textId = `task-${task.id}-text`;
  row.dataset.id = task.id;
  row.querySelector(".task__text").id = textId;
  row.querySelector(".task__label").textContent = task.text;
  const box = row.querySelector(".check input");
  box.checked = task.done;
  for (const el of row.querySelectorAll("[aria-label]")) el.setAttribute("aria-describedby", textId);
  return row;
}

function updateSummary() {
  const tasks = store.tasksFor(shownDate);
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  show(els.empty, total === 0);
  show(els.progress, total > 0);
  show(els.summary, total > 0);
  els.count.textContent = `${done}/${total}`;
  els.progress.style.setProperty("--p", total ? Math.round((done / total) * 100) : 0);
  const complete = total > 0 && done === total;
  els.progress.classList.toggle("progress--complete", complete);
  if (!complete) els.progress.classList.remove("progress--celebrate");
}

function updateSlip() {
  show(els.slip, !store.storageOk);
}

function renderAll(now) {
  els.date.textContent = `Hôm nay, ${formatDate(now)}`;
  els.list.replaceChildren(...store.tasksFor(shownDate).map(renderRow));
  updateSummary();
  updateSlip();
}

const ERRORS = {
  empty: "Vui lòng nhập nội dung công việc.",
  tooLong: "Nội dung tối đa 200 ký tự.",
};

function setFieldError(input, errorEl, code) {
  errorEl.querySelector(".field-error__text").textContent = ERRORS[code] ?? "";
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
function showFieldError(input, errorEl, code) {
  setFieldError(input, errorEl, null);
  void input.offsetWidth;
  setFieldError(input, errorEl, code);
}

const setAddError = (code) => setFieldError(els.input, els.addError, code);

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const now = new Date();
  checkDay(now);
  const result = store.add(els.input.value, now);
  if (result.error) {
    showFieldError(els.input, els.addError, result.error);
  } else {
    const row = renderRow(result.task);
    row.classList.add("task--enter");
    els.list.append(row);
    els.input.value = "";
    updateSummary();
    updateSlip();
    maybePeek();
  }
  els.input.focus();
});

let celebrateTimer;

els.list.addEventListener("change", (e) => {
  const row = e.target.closest(".task");
  if (!row || !e.target.matches(".check input")) return;
  store.setDone(row.dataset.id, e.target.checked);
  const wasComplete = els.progress.classList.contains("progress--complete");
  updateSummary();
  updateSlip();
  if (!wasComplete && els.progress.classList.contains("progress--complete")) {
    // One brief stamp and ink bloom for the tick that finishes the day.
    els.progress.classList.add("progress--celebrate");
    clearTimeout(celebrateTimer);
    celebrateTimer = setTimeout(() => els.progress.classList.remove("progress--celebrate"), 1000);
  }
});

els.input.addEventListener("input", () => {
  if (!els.addError.hidden) setAddError(null);
});

// Edit in place: one row at a time. The read-only line stays in the DOM (hidden)
// so the checkbox description and the Sửa button survive the round trip.
let editing = null;

function closeEdit(focus) {
  if (!editing) return;
  const row = editing;
  editing = null;
  row.querySelector(".task__edit").remove();
  show(row.querySelector(".task__swipe"), true);
  row.classList.remove("task--editing");
  if (focus) row.querySelector('[data-action="edit"]').focus();
}

function openEdit(row) {
  closeEdit(false);
  const id = row.dataset.id;
  const form = els.editTemplate.content.firstElementChild.cloneNode(true);
  const field = form.querySelector(".input");
  field.id = `edit-${id}`;
  form.querySelector("label").htmlFor = field.id;
  form.querySelector(".field-error").id = `edit-${id}-error`;
  field.value = row.querySelector(".task__label").textContent;
  show(row.querySelector(".task__swipe"), false);
  row.classList.add("task--editing");
  row.append(form);
  editing = row;
  field.focus();
  field.setSelectionRange(field.value.length, field.value.length);
}

els.list.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  const row = e.target.closest(".task");
  if (action === "edit") openEdit(row);
  else if (action === "cancel") closeEdit(true);
  else if (action === "remove") askDelete(row);
});

els.list.addEventListener("submit", (e) => {
  e.preventDefault();
  const row = e.target.closest(".task");
  const field = e.target.querySelector(".input");
  const result = store.updateText(row.dataset.id, field.value);
  updateSlip();
  if (result.error && result.error !== "notFound") {
    showFieldError(field, e.target.querySelector(".field-error"), result.error);
    field.focus();
    return;
  }
  if (result.task) row.querySelector(".task__label").textContent = result.task.text;
  closeEdit(true);
});

els.list.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && e.target.closest(".task__edit")) closeEdit(true);
});

els.list.addEventListener("input", (e) => {
  const form = e.target.closest(".task__edit");
  const errorEl = form?.querySelector(".field-error");
  if (errorEl && !errorEl.hidden) setFieldError(e.target, errorEl, null);
});

// Delete: a sticky note confirmation. Xóa is hidden on an editing row, so the
// row being deleted is never the one in edit mode; any other open edit stays.
let pendingDelete = null;

function askDelete(row) {
  pendingDelete = row;
  els.quote.textContent = row.querySelector(".task__label").textContent;
  els.dialog.showModal();
}

function confirmDelete() {
  const row = pendingDelete;
  pendingDelete = null;
  els.dialog.close();
  if (!row?.isConnected) return;
  if (editing === row) closeEdit(false);
  store.remove(row.dataset.id);
  updateSlip();
  // Skip rows still erasing from an earlier delete.
  const live = (el, dir) => { while (el?.classList.contains("task--exit")) el = el[dir]; return el; };
  const next = live(row.nextElementSibling, "nextElementSibling") ?? live(row.previousElementSibling, "previousElementSibling");
  (next?.querySelector(".check input") ?? els.input).focus();
  const finish = () => { row.remove(); updateSummary(); };
  row.classList.remove("task--enter");
  row.classList.add("task--exit");
  const anim = row.getAnimations()[0];
  if (anim) anim.finished.then(finish, finish); else finish();
}

els.dialog.addEventListener("click", (e) => {
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "delete") return confirmDelete();
  if (action === "keep") return els.dialog.close();
  // Clicks on the note's own padding also target the dialog; only the backdrop closes it.
  if (e.target !== els.dialog) return;
  const r = els.dialog.getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (!inside) els.dialog.close();
});

// Giữ lại, Escape and the backdrop all end here with the task kept.
els.dialog.addEventListener("close", () => {
  const row = pendingDelete;
  pendingDelete = null;
  if (!row?.isConnected) return;
  // The dialog may have restored focus already, without scrolling the phone row open.
  const btn = row.querySelector('[data-action="remove"]');
  btn.focus();
  btn.scrollIntoView({ block: "nearest", inline: "nearest" });
});

// Phones: CSS scroll snap does the swipe. Script only keeps one line open:
// opening another line, or a tap or focus anywhere outside the open line, closes it.
let openSwipe = null;

// Reads scrollLeft rather than trusting scroll events, which arrive a frame late.
function closeSwipes(keep) {
  for (const s of els.list.querySelectorAll(".task__swipe")) if (s.scrollLeft > 0 && !keep?.contains(s)) s.scrollLeft = 0;
}

els.list.addEventListener("scroll", (e) => {
  const swipe = e.target;
  if (!swipe.classList?.contains("task__swipe") || swipe.scrollLeft <= 0 || swipe === openSwipe) return;
  openSwipe = swipe;
  closeSwipes(swipe);
}, true);

const closeOutside = (e) => { openSwipe = null; closeSwipes(e.target.closest?.(".task")); };
document.addEventListener("pointerdown", closeOutside);
document.addEventListener("focusin", closeOutside);

// One time swipe hint: the first line peeks open once, the first time tasks exist on a phone.
const HINT_KEY = "daily-todo:swipe-hint-seen";
const phoneLayout = matchMedia("(hover: none), (max-width: 600px)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let hintSeen = false;

function maybePeek() {
  const first = els.list.querySelector(".task");
  if (hintSeen || !first || !phoneLayout.matches) return;
  hintSeen = true;
  const storage = getStorage();
  try {
    if (storage?.getItem(HINT_KEY)) return;
    storage?.setItem(HINT_KEY, "1");
  } catch { /* storage blocked: the hint may replay next load, which is fine */ }
  if (!reducedMotion.matches) first.classList.add("task--peek");
}

const endPeek = (e) => { if (e.animationName === "peek") e.target.closest(".task")?.classList.remove("task--peek"); };
els.list.addEventListener("animationend", endPeek);
els.list.addEventListener("animationcancel", endPeek);

// Day change (R25): a page left open past midnight moves to the new day when the
// owner comes back or adds a task. Earlier days stay in the store untouched.
function checkDay(now = new Date()) {
  const today = toDateKey(now);
  if (today === shownDate) return;
  shownDate = today;
  editing = null; // the unsaved edit goes with the old rows
  pendingDelete = null;
  els.dialog.close();
  openSwipe = null;
  clearTimeout(celebrateTimer);
  els.progress.classList.remove("progress--celebrate");
  renderAll(now);
  // Focus that sat on an old row or the note is gone; start the fresh page at the add field.
  if (!document.activeElement || document.activeElement === document.body) els.input.focus();
}

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkDay(); });
window.addEventListener("focus", () => checkDay());

setAddError(null);
renderAll(startedAt);
els.input.focus();
maybePeek();
