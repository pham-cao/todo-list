import { toDateKey, formatDate } from "./date.js";
import { createStore, getStorage } from "./store.js";

const $ = (id) => document.getElementById(id);
const els = {
  date: $("date-line"),
  progress: $("progress"),
  summary: $("summary"),
  count: $("summary-count"),
  slip: $("storage-slip"),
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

show(els.addError, false);
renderAll();
els.input.focus();
