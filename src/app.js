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
};

const show = (el, on) => { el.hidden = !on; };

const store = createStore(getStorage());
let shownDate = toDateKey();

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

function renderAll() {
  els.date.textContent = `Hôm nay, ${formatDate()}`;
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
  const result = store.add(els.input.value);
  if (result.error) {
    showFieldError(els.input, els.addError, result.error);
  } else {
    const row = renderRow(result.task);
    row.classList.add("task--enter");
    els.list.append(row);
    els.input.value = "";
    updateSummary();
    updateSlip();
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

setAddError(null);
renderAll();
els.input.focus();
