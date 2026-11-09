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

const ADD_ERRORS = {
  empty: "Vui lòng nhập nội dung công việc.",
  tooLong: "Nội dung tối đa 200 ký tự.",
};

function setAddError(code) {
  els.addError.querySelector(".field-error__text").textContent = ADD_ERRORS[code] ?? "";
  show(els.addError, !!code);
  if (code) {
    els.input.setAttribute("aria-invalid", "true");
    els.input.setAttribute("aria-describedby", els.addError.id);
  } else {
    els.input.removeAttribute("aria-invalid");
    els.input.removeAttribute("aria-describedby");
  }
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const result = store.add(els.input.value);
  if (result.error) {
    // Re-show on repeat submits so the alert is announced and the nudge replays.
    setAddError(null);
    void els.input.offsetWidth;
    setAddError(result.error);
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

setAddError(null);
renderAll();
els.input.focus();
