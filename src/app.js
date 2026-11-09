import { toDateKey, parseDateKey, addDays, dayKind, dateLine } from "./date.js?v=1.2.0";
import { createStore, getStorage } from "./store.js?v=1.2.0";
import { createGroups, nextColor, GROUPS_KEY, MAX_GROUPS, UNGROUPED, UNGROUPED_NAME } from "./groups.js?v=1.2.0";

const $ = (id) => document.getElementById(id);
const els = {
  title: $("page-title"),
  date: $("date-line"),
  picker: $("day-picker"),
  toToday: $("to-today"),
  addLabel: $("new-task-label"),
  emptyText: $("empty-text"),
  progress: $("progress"),
  summary: $("summary"),
  count: $("summary-count"),
  slip: $("storage-slip"),
  form: $("add-form"),
  input: $("new-task"),
  addError: $("new-task-error"),
  addGroup: $("new-task-group"),
  addSwatch: $("new-task-swatch"),
  newGroupTemplate: $("new-group-template"),
  empty: $("empty"),
  list: $("day-list"),
  rowTemplate: $("task-template"),
  groupTemplate: $("group-template"),
  editTemplate: $("edit-template"),
  sheetBody: document.querySelector(".sheet__body"),
  srStatus: $("sr-status"),
  notice: $("notice"),
  noticeText: $("notice-text"),
  bar: $("group-bar"),
  filter: $("group-filter"),
  filterSwatch: $("group-filter-swatch"),
  filterParts: [document.querySelector(".group-bar__icon"), document.querySelector(".group-bar__label"), $("group-filter").parentElement],
  groupEmpty: $("group-empty"),
  groupEmptyText: $("group-empty-text"),
  dialog: $("delete-dialog"),
  quote: $("del-task"),
};

const show = (el, on) => { el.hidden = !on; };

const store = createStore(getStorage());
let groups = createGroups(getStorage());
// The add form's group: a group id or UNGROUPED. Kept while the page is open, Chưa phân nhóm after a reload (R14, R20).
let addGroup = UNGROUPED;
// The filter: "all", UNGROUPED or a group id. Display only, never stored, kept across day moves, "all" after a reload (R45, R49).
let filter = "all";
// Section key -> ul.task-list on screen. A day with no grouped task has one plain list under UNGROUPED.
let lists = new Map();
// today: the last local date the page saw. viewed: the day on screen.
let today = toDateKey();
let viewed = today;

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

// A task whose group is gone (or never existed) is shown as ungrouped and never rewritten (R57, R58).
const keyOf = (task) => (groups.get(task.groupId) ? task.groupId : UNGROUPED);
const rowOf = (id) => [...els.list.querySelectorAll(".task")].find((r) => r.dataset.id === id);

// Sections in group creation order, Chưa phân nhóm last, empty ones left out (R29, R30, R32).
// Rows already on screen are moved, not rebuilt, so an open edit and the focus survive.
function renderList() {
  const tasks = store.tasksFor(viewed);
  const focused = els.list.contains(document.activeElement) ? document.activeElement : null;
  // Headers are cloned fresh, so a focused toggle is found again by its section key.
  const focusKey = focused?.closest(".group__toggle")?.closest(".group").dataset.key;
  const old = new Map([...els.list.querySelectorAll(".task")].map((r) => [r.dataset.id, r]));
  const buckets = new Map([...groups.list().map((g) => [g.id, []]), [UNGROUPED, []]]);
  for (const t of tasks) buckets.get(keyOf(t)).push(old.get(t.id) ?? renderRow(t));
  lists = new Map();
  const shown = filter === "all" ? null : buckets.get(filter);
  // Filtered to an empty section on a day with tasks: the one line filter text; a day with no tasks keeps #empty (R44).
  show(els.groupEmpty, !!shown && !shown.length && tasks.length > 0);
  els.groupEmptyText.textContent = filter === UNGROUPED ? "Ngày này không có việc nào chưa phân nhóm."
    : `Ngày này chưa có việc nào trong nhóm "${groups.get(filter)?.name}".`;
  if (shown) {
    if (shown.length) els.list.replaceChildren(sectionOf(filter, shown, true));
    else els.list.replaceChildren();
  } else if (buckets.get(UNGROUPED).length === tasks.length) {
    // No task in a group: the plain list, exactly as before groups existed (R31).
    const ul = document.createElement("ul");
    ul.className = "task-list";
    ul.append(...buckets.get(UNGROUPED));
    lists.set(UNGROUPED, ul);
    els.list.replaceChildren(ul);
  } else {
    els.list.replaceChildren(...[...buckets].filter(([, rows]) => rows.length).map(([key, rows]) => sectionOf(key, rows)));
  }
  if (focused?.isConnected && document.activeElement !== focused) focused.focus({ preventScroll: true });
  else if (focusKey) lists.get(focusKey)?.closest(".group")?.querySelector(".group__toggle").focus({ preventScroll: true });
  updateSummary();
}

// One section from #group-template. Under the filter it is always open and its header is a plain heading
// with the same words, no toggle, and the stored fold left as it is (R41).
function sectionOf(key, rows, fixed = false) {
  const group = groups.get(key);
  const section = els.groupTemplate.content.firstElementChild.cloneNode(true);
  const head = section.querySelector(".group__toggle");
  const collapsed = !fixed && groups.isCollapsed(key);
  section.dataset.key = key;
  section.dataset.color = group ? group.color : "none";
  section.classList.toggle("group--collapsed", collapsed);
  head.setAttribute("aria-expanded", String(!collapsed));
  section.querySelector(".group__name").textContent = group ? group.name : UNGROUPED_NAME;
  if (fixed) {
    const stat = document.createElement("span");
    stat.className = "group__static";
    stat.append(...head.childNodes);
    head.replaceWith(stat);
  }
  const ul = section.querySelector(".task-list");
  ul.append(...rows);
  lists.set(key, ul);
  return section;
}

// Collapse is a class and aria-expanded only; rows are hidden by CSS (R39, R40).
function setCollapsed(section, on) {
  section.classList.toggle("group--collapsed", on);
  section.querySelector(".group__toggle").setAttribute("aria-expanded", String(!on));
  groups.setCollapsed(section.dataset.key, on);
  updateSlip();
}

function updateSummary() {
  const tasks = store.tasksFor(viewed);
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  // Header counts are per section; the summary, progress and stamp count the whole day (R33, R50, R63).
  const counts = new Map();
  for (const t of tasks) {
    const c = counts.get(keyOf(t)) ?? { done: 0, total: 0 };
    c.total++;
    if (t.done) c.done++;
    counts.set(keyOf(t), c);
  }
  for (const [key, ul] of lists) {
    const section = ul.closest(".group");
    if (!section) continue;
    const c = counts.get(key) ?? { done: 0, total: 0 };
    // The toggle's name is "Nhóm {name} {d}/{t} việc đã hoàn thành": the visible "{name} {d}/{t}" plus hidden words
    // from #group-template, so voice control can say what it sees (WCAG 2.5.3, BUG-005).
    section.querySelector(".group__count").textContent = `${c.done}/${c.total}`;
  }
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
  show(els.slip, !store.storageOk || !groups.storageOk);
}

// yesterday and tomorrow use the past and future wording
const WORDING = {
  today: { title: "Việc cần làm hôm nay", ask: "Bạn cần làm gì hôm nay?", empty: "Hôm nay chưa có việc nào. Hãy thêm việc đầu tiên nhé!" },
  past: { title: "Việc cần làm", ask: "Bạn cần làm gì ngày này?", empty: "Ngày này chưa có việc nào được ghi lại." },
  future: { title: "Việc cần làm", ask: "Bạn cần làm gì ngày này?", empty: "Ngày này chưa có việc nào. Hãy thêm việc để chuẩn bị nhé!" },
};
const KIND = { yesterday: "past", tomorrow: "future" };

function renderWording() {
  const kind = dayKind(viewed, today);
  const w = WORDING[KIND[kind] ?? kind];
  els.title.textContent = w.title;
  document.title = w.title;
  els.date.textContent = dateLine(viewed, today);
  els.input.placeholder = w.ask;
  els.addLabel.textContent = w.ask;
  els.emptyText.textContent = w.empty;
  // Rewriting an equal value would cut off a date the owner is typing in the picker.
  if (els.picker.value !== viewed) els.picker.value = viewed;
  if (viewed === today) els.toToday.setAttribute("aria-disabled", "true");
  else els.toToday.removeAttribute("aria-disabled");
}

// Arriving on a day shows its stamp still; only the tick that finishes a day celebrates (R14).
function renderDay() {
  clearTimeout(celebrateTimer);
  els.progress.classList.remove("progress--celebrate");
  renderWording();
  renderList();
  updateSlip();
  maybePeek();
}

// The address names the viewed day; a plain address means today. The hash only ever goes through parseDateKey.
function readHash() {
  const key = location.hash.slice(1);
  return parseDateKey(key) ? key : null;
}

function writeAddress(key, push) {
  const url = location.pathname + location.search + (key === today ? "" : `#${key}`);
  history[push ? "pushState" : "replaceState"](null, "", url);
}

const ERRORS = {
  empty: "Vui lòng nhập nội dung công việc.",
  tooLong: "Nội dung tối đa 200 ký tự.",
};

const GROUP_ERRORS = {
  empty: "Vui lòng nhập tên nhóm.",
  tooLong: "Tên nhóm tối đa 30 ký tự.",
  duplicate: "Tên nhóm này đã có rồi.",
  tooMany: "Tối đa 20 nhóm. Hãy xóa bớt một nhóm trước khi tạo thêm.",
};

function setFieldError(input, errorEl, code, messages = ERRORS) {
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
function showFieldError(input, errorEl, code, messages) {
  setFieldError(input, errorEl, null);
  void input.offsetWidth;
  setFieldError(input, errorEl, code, messages);
}

const setAddError = (code) => setFieldError(els.input, els.addError, code);

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const now = new Date();
  checkDay(now);
  // R21 (a chosen group removed elsewhere) is covered by the storage listener, which resets addGroup.
  const result = store.add(els.input.value, now, viewed, addGroup === UNGROUPED ? null : addGroup);
  if (result.error) {
    showFieldError(els.input, els.addError, result.error);
  } else {
    const key = keyOf(result.task);
    if (filter !== "all" && key !== filter) {
      // Saved where chosen; the filter stays and the slip says where it went (R47).
      notify(`Đã thêm việc vào nhóm "${groups.get(key)?.name ?? UNGROUPED_NAME}". Nhóm này đang được ẩn bởi bộ lọc.`);
      renderList(); // the day may have gone from no tasks (#empty) to the filter empty text (R44)
    } else {
      notify(null);
      if (lists.has(key)) {
        lists.get(key).append(renderRow(result.task));
        updateSummary();
      } else {
        renderList();
      }
      const row = rowOf(result.task.id);
      row.classList.add("task--enter");
      // A task added to a folded section opens it, so the new row is seen.
      const section = row.closest(".group--collapsed");
      if (section) setCollapsed(section, false);
    }
    els.input.value = "";
    updateSlip();
    maybePeek();
  }
  els.input.focus();
});

let celebrateTimer;

els.list.addEventListener("change", (e) => {
  if (e.target.matches(".task__edit select")) {
    e.target.closest(".select").querySelector(".swatch").dataset.color = colorOf(e.target.value);
    return;
  }
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

// Group names only ever reach the page as option text (R65).
const option = (value, text) => Object.assign(document.createElement("option"), { value, textContent: text });
const groupOptions = () => [option(UNGROUPED, UNGROUPED_NAME), ...groups.list().map((g) => option(g.id, g.name))];
const colorOf = (key) => groups.get(key)?.color ?? "none";

// Add choice: Chưa phân nhóm, every group in creation order, then Nhóm mới... (R14).
// Filter: Tất cả nhóm, Chưa phân nhóm, every group; shown from the first group on, back to "all" if its group is gone (R42, R48).
function renderChoices() {
  if (!groups.get(addGroup)) addGroup = UNGROUPED;
  els.addGroup.replaceChildren(...groupOptions(), option("new", "Nhóm mới..."));
  els.addGroup.value = newLine ? "new" : addGroup;
  els.addSwatch.dataset.color = colorOf(addGroup);
  els.addSwatch.hidden = !!newLine;
  const any = groups.list().length > 0;
  if (!any || (filter !== UNGROUPED && !groups.get(filter))) filter = "all";
  els.filter.replaceChildren(option("all", "Tất cả nhóm"), ...groupOptions());
  els.filter.value = filter;
  for (const el of els.filterParts) show(el, any);
  els.bar.classList.toggle("group-bar--filtered", filter !== "all");
  els.filterSwatch.dataset.color = colorOf(filter);
  show(els.filterSwatch, filter !== "all");
}

// The info slip: shown empty, then written a frame later, so a repeat of the same text is announced again.
function notify(message) {
  els.noticeText.textContent = "";
  show(els.notice, !!message);
  if (message) requestAnimationFrame(() => { els.noticeText.textContent = message; });
}

// A group or Chưa phân nhóm also becomes the add choice, so new tasks go where the owner looks (R43, R46).
els.filter.addEventListener("change", () => {
  notify(null); // a "hidden group" notice may no longer be true (BUG-007)
  filter = els.filter.value;
  if (filter !== "all") addGroup = filter;
  renderChoices();
  renderList();
  if (editing && !editing.isConnected) editing = null; // an open edit on a row the filter hid is dropped
  maybePeek();
});

// The Nhóm mới... line exists only while it is open, from #new-group-template.
let newLine = null;
const newName = () => newLine.querySelector(".input");
const setNewError = (code) => setFieldError(newName(), newLine.querySelector(".field-error"), code, GROUP_ERRORS);

function openNewGroup() {
  newLine = els.newGroupTemplate.content.firstElementChild.cloneNode(true);
  newLine.querySelector(".swatch").dataset.color = nextColor(groups.list());
  els.form.append(newLine);
  els.addSwatch.hidden = true;
  newName().focus();
  // At the limit the error shows at once, before any typing (decisions.md).
  if (groups.list().length >= MAX_GROUPS) setNewError("tooMany");
}

function closeNewGroup() {
  newLine?.remove();
  newLine = null;
  els.addGroup.value = addGroup;
  els.addSwatch.hidden = false;
}

function createGroup() {
  const result = groups.create(newName().value);
  updateSlip();
  if (result.error) {
    showFieldError(newName(), newLine.querySelector(".field-error"), result.error, GROUP_ERRORS);
    newName().focus();
    return;
  }
  // The group is chosen, no task is made, and the owner goes on writing the task (R16).
  addGroup = result.group.id;
  closeNewGroup();
  renderChoices();
  els.input.focus();
}

els.addGroup.addEventListener("change", () => {
  if (els.addGroup.value === "new") return openNewGroup();
  addGroup = els.addGroup.value;
  closeNewGroup();
  renderChoices();
});

els.form.addEventListener("click", (e) => {
  if (e.target.closest("#create-group")) createGroup();
});
els.form.addEventListener("input", (e) => {
  if (newLine?.contains(e.target) && !newLine.querySelector(".field-error").hidden) setNewError(null);
});
els.form.addEventListener("keydown", (e) => {
  // isComposing or keyCode 229: a key that ends an IME composition (Safari reports only 229).
  if (!newLine?.contains(e.target) || e.isComposing || e.keyCode === 229) return;
  if (e.key === "Escape") {
    // Nothing is created; the choice goes back to what it was (R17).
    closeNewGroup();
    els.addGroup.focus();
  } else if (e.key === "Enter" && e.target === newName()) {
    e.preventDefault(); // the name input sits inside the add form: Enter creates the group, never a task
    createGroup();
  }
});

// Another tab changed the groups: take its list, so a removed group is never offered or saved (R21).
window.addEventListener("storage", (e) => {
  // A session that could not save keeps its groups in memory; another tab's list would drop them.
  if ((e.key !== GROUPS_KEY && e.key !== null) || !groups.storageOk) return;
  groups = createGroups(getStorage());
  const onFilter = document.activeElement === els.filter;
  updateSlip();
  renderChoices();
  // The last group went: the filter is hidden, so its focus moves to the add input.
  if (onFilter && !groups.list().length) els.input.focus();
  // The open Nhóm mới... line previews the colour the group will get now (R10, R15, BUG-006).
  newLine?.querySelector(".swatch").setAttribute("data-color", nextColor(groups.list()));
  renderList();
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
  // The task's current section is preselected and remembered, so an unchanged choice never rewrites groupId (R23, R58).
  const select = form.querySelector("select");
  const task = store.tasksFor(viewed).find((t) => t.id === id);
  select.id = `edit-${id}-group`;
  form.querySelector(".task__edit-group label").htmlFor = select.id;
  select.replaceChildren(...groupOptions());
  select.value = select.dataset.from = task ? keyOf(task) : UNGROUPED;
  form.querySelector(".swatch").dataset.color = colorOf(select.value);
  show(row.querySelector(".task__swipe"), false);
  row.classList.add("task--editing");
  row.append(form);
  editing = row;
  field.focus();
  field.setSelectionRange(field.value.length, field.value.length);
}

els.list.addEventListener("click", (e) => {
  const toggle = e.target.closest(".group__toggle");
  if (toggle) {
    const section = toggle.closest(".group");
    setCollapsed(section, !section.classList.contains("group--collapsed"));
    return;
  }
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
  const select = e.target.querySelector("select");
  const moved = select.value !== select.dataset.from;
  // Text and group are saved together; invalid text changes neither (R24, R26). A group removed meanwhile saves ungrouped.
  const result = store.updateText(row.dataset.id, field.value, moved ? (groups.get(select.value) ? select.value : null) : undefined);
  updateSlip();
  if (result.error && result.error !== "notFound") {
    showFieldError(field, e.target.querySelector(".field-error"), result.error);
    field.focus();
    return;
  }
  if (result.task) row.querySelector(".task__label").textContent = result.task.text;
  if (!moved || !result.task) return closeEdit(true);
  closeEdit(false);
  moveRow(row, keyOf(result.task));
});

// A moved row lands by creation time in its new section (renderList keeps that order), which opens if folded,
// washes once in the new colour, keeps focus on Sửa and has its section name announced (R24, R28, R32).
function moveRow(row, key) {
  // A target the filter hides takes the row out of view: focus the next row, else the previous one, else the add input.
  const all = [...els.list.querySelectorAll(".task:not(.task--exit)")];
  const i = all.indexOf(row);
  const near = all[i + 1] ?? all[i - 1];
  if (groups.isCollapsed(key)) groups.setCollapsed(key, false);
  renderList();
  updateSlip();
  if (filter !== "all" && key !== filter) {
    (near?.querySelector(".check input") ?? els.input).focus();
  } else {
    row.classList.remove("task--moved");
    void row.offsetWidth; // a second move in a row replays the wash
    row.classList.add("task--moved");
    // On a phone the line stays closed, as in the approved screen; only the row is scrolled into view.
    row.querySelector('[data-action="edit"]').focus({ preventScroll: true });
    row.scrollIntoView({ block: "nearest" });
  }
  // Cleared first and written a frame later, so a second move to the same group is announced again.
  const message = `Đã chuyển việc sang nhóm "${groups.get(key)?.name ?? UNGROUPED_NAME}".`;
  els.srStatus.textContent = "";
  requestAnimationFrame(() => { els.srStatus.textContent = message; });
}

els.list.addEventListener("keydown", (e) => {
  // isComposing or keyCode 229: a key that ends an IME composition (Safari reports only 229).
  if (!e.target.closest(".task__edit")) return;
  if (e.isComposing || e.keyCode === 229) {
    if (e.key === "Enter" && !e.isComposing) e.preventDefault(); // Safari: no implicit submit on the commit Enter
    return;
  }
  if (e.key === "Escape") closeEdit(true);
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
  // Next row across every section, else the previous one; skip rows still erasing and rows in folded sections.
  const all = [...els.list.querySelectorAll(".task")];
  const i = all.indexOf(row);
  const live = (r) => !r.classList.contains("task--exit") && !r.closest(".group--collapsed");
  const next = all.slice(i + 1).find(live) ?? all.slice(0, i).findLast(live);
  (next?.querySelector(".check input") ?? els.input).focus();
  // A list left without rows rebuilds the day: its section goes, or the day falls back to the plain list.
  const finish = () => {
    const ul = row.parentElement;
    row.remove();
    if (ul?.isConnected && !ul.querySelector(".task:not(.task--exit)")) renderList(); else updateSummary();
  };
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
  const first = els.list.querySelector(":scope > .task-list > .task, .group:not(.group--collapsed) .task");
  if (hintSeen || !first || !phoneLayout.matches) return;
  hintSeen = true;
  const storage = getStorage();
  try {
    if (storage?.getItem(HINT_KEY)) return;
    storage?.setItem(HINT_KEY, "1");
  } catch { /* storage blocked: the hint may replay next load, which is fine */ }
  if (!reducedMotion.matches) first.classList.add("task--peek");
}

// One shot classes go when their animation ends, so a row moved by renderList never replays them.
const ONE_SHOT = { peek: "task--peek", "write-in": "task--enter", "moved-fade": "task--moved" };
const endPeek = (e) => { if (ONE_SHOT[e.animationName]) e.target.closest(".task")?.classList.remove(ONE_SHOT[e.animationName]); };
els.list.addEventListener("animationend", endPeek);
els.list.addEventListener("animationcancel", endPeek);

// Leaving the viewed day (R7): the unsaved edit and any open swipe go with the old rows,
// the delete note closes with nothing deleted, the add error clears, typed add text stays.
function resetTransient() {
  editing = null;
  pendingDelete = null;
  els.dialog.close();
  openSwipe = null;
  closeSwipes();
  setAddError(null);
  notify(null);
}

// Page turn (R8): only a move plays it, never a load or a midnight refresh. Keys are YYYY-MM-DD, so they compare as strings.
const TURNS = ["turn--back", "turn--forward", "washi--restick"];
function turnPage(from, to) {
  if (reducedMotion.matches) return; // the CSS drops the animation, so animationend would never clear the class
  els.sheetBody.classList.remove(...TURNS);
  els.date.classList.remove(...TURNS);
  void els.sheetBody.offsetWidth; // restart the animation on quick repeated moves
  els.sheetBody.classList.add(to < from ? "turn--back" : "turn--forward");
  els.date.classList.add("washi--restick");
}
// Row animations bubble up to the sheet body; only its own turn ends here.
const endTurn = (e) => { if (e.target === e.currentTarget) e.target.classList.remove(...TURNS); };
for (const el of [els.sheetBody, els.date]) {
  el.addEventListener("animationend", endTurn);
  el.addEventListener("animationcancel", endTurn);
}

// One move is one history entry (R22, R25). Focus is left on the control used (R8).
function go(key) {
  if (!key || key === viewed) { if (els.picker.value !== viewed) els.picker.value = viewed; return; }
  resetTransient();
  writeAddress(key, true);
  turnPage(viewed, key);
  viewed = key;
  renderDay();
}

// Back, Forward or an edited hash on a loaded page (R24). popstate and hashchange both
// arrive for a hash entry; the second call finds nothing to do.
function syncFromAddress() {
  checkDay();
  const key = readHash() ?? today;
  if (key === today && location.href.includes("#")) writeAddress(today, false);
  if (key === viewed) return;
  resetTransient();
  turnPage(viewed, key);
  viewed = key;
  renderDay();
}

// Targets come from the day on screen, before the midnight check.
for (const [id, n] of [["prev-day", -1], ["next-day", 1]]) {
  $(id).addEventListener("click", () => { const key = addDays(viewed, n); checkDay(); go(key); });
}
// checkDay first: after a silent midnight the muted tab still means "show the new today".
els.toToday.addEventListener("click", () => {
  checkDay();
  if (els.toToday.getAttribute("aria-disabled") === "true") return;
  go(today);
});
// Picker (R3, R9): Chromium reports partial years such as 0202-11-08 while the owner types,
// so a bad value is ignored while the field has focus and put back to the viewed day on blur.
els.picker.addEventListener("change", () => {
  const key = els.picker.value;
  if (!parseDateKey(key)) {
    if (document.activeElement !== els.picker) els.picker.value = viewed;
    return;
  }
  checkDay();
  go(key);
});
els.picker.addEventListener("blur", () => { if (els.picker.value !== viewed) els.picker.value = viewed; });
window.addEventListener("popstate", syncFromAddress);
window.addEventListener("hashchange", syncFromAddress);

// Day change (R25): a page left open past midnight moves to the new day when the
// owner comes back or adds a task. Earlier days stay in the store untouched.
function checkDay(now = new Date()) {
  const key = toDateKey(now);
  if (key === today) return;
  const wasToday = viewed === today;
  today = key;
  if (!wasToday) {
    // Another day stays on screen with its rows; only the wording against the new today changes.
    renderWording();
    if (viewed === today) writeAddress(today, false);
    return;
  }
  resetTransient();
  viewed = today;
  renderDay();
  // Focus that sat on an old row or the note is gone; start the fresh page at the add field.
  if (!document.activeElement || document.activeElement === document.body) els.input.focus();
}

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkDay(); });
window.addEventListener("focus", () => checkDay());

viewed = readHash() ?? today;
// A hash that is bad, out of range or today (even a bare "#") becomes the plain address, with no history entry.
if (viewed === today && location.href.includes("#")) writeAddress(today, false);
setAddError(null);
renderChoices();
// BUG-001: the markup starts muted; settle the real Về hôm nay look before any transition can run.
els.toToday.style.transition = "none";
renderDay();
void els.toToday.offsetWidth;
els.toToday.style.transition = "";
els.input.focus();
