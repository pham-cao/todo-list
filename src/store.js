import { toDateKey } from "./date.js?v=1.2.0";

export const STORAGE_KEY = "daily-todo:tasks:v1";
export const MAX_LENGTH = 200;
const CORRUPT_KEY = `${STORAGE_KEY}:corrupt`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateText(raw, max = MAX_LENGTH) {
  const text = String(raw ?? "").trim();
  if (!text) return { error: "empty" };
  if ([...text.normalize("NFC")].length > max) return { error: "tooLong" };
  return { text };
}

export function getStorage() {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

const isValid = (t) =>
  t && typeof t === "object" &&
  typeof t.id === "string" && t.id !== "" &&
  typeof t.text === "string" &&
  typeof t.done === "boolean" &&
  Number.isFinite(t.createdAt) &&
  typeof t.date === "string" && DATE_RE.test(t.date);

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function createStore(storage) {
  let all = [];
  let locked = false; // read failed: never write this session
  const store = { storageOk: true };

  try {
    if (!storage) throw new Error("no storage");
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      let data;
      try { data = JSON.parse(raw); } catch { data = null; }
      if (Array.isArray(data)) {
        all = data.filter(isValid).map((t) => ({ ...t }));
      } else {
        try { storage.setItem(CORRUPT_KEY, raw); } catch { /* best effort */ }
      }
    }
  } catch {
    locked = true;
    store.storageOk = false;
  }

  function save() {
    if (locked) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(all));
      store.storageOk = true;
    } catch {
      store.storageOk = false;
    }
  }

  const find = (id) => all.find((t) => t.id === id);

  store.tasksFor = (dateKey) => all.filter((t) => t.date === dateKey).map((t) => ({ ...t }));

  store.add = (raw, now = new Date(), dateKey = toDateKey(now), groupId = null) => {
    const v = validateText(raw);
    if (v.error) return v;
    const task = { id: newId(), text: v.text, done: false, createdAt: now.getTime(), date: dateKey };
    if (typeof groupId === "string" && groupId) task.groupId = groupId;
    all.push(task);
    save();
    return { task: { ...task } };
  };

  store.updateText = (id, raw, groupId) => {
    const v = validateText(raw);
    if (v.error) return v;
    const task = find(id);
    if (!task) return { error: "notFound" };
    task.text = v.text;
    if (typeof groupId === "string" && groupId) task.groupId = groupId;
    else if (groupId === null) delete task.groupId;
    save();
    return { task: { ...task } };
  };

  store.setDone = (id, done) => {
    const task = find(id);
    if (!task) return undefined;
    task.done = !!done;
    save();
    return { ...task };
  };

  store.remove = (id) => {
    all = all.filter((t) => t.id !== id);
    save();
  };

  store.groupUsage = (groupId) => {
    const hit = all.filter((t) => t.groupId === groupId);
    return { count: hit.length, days: [...new Set(hit.map((t) => t.date))].sort() };
  };

  store.moveGroup = (fromId, toId) => {
    if (typeof fromId !== "string" || !fromId) return { moved: 0 };
    const next = all.map((t) => {
      if (t.groupId !== fromId) return t;
      const c = { ...t };
      if (typeof toId === "string" && toId) c.groupId = toId;
      else delete c.groupId;
      return c;
    });
    const moved = all.filter((t) => t.groupId === fromId).length;
    if (!moved) return { moved: 0 };
    if (!locked) {
      try { storage.setItem(STORAGE_KEY, JSON.stringify(next)); store.storageOk = true; } catch { return { error: "save" }; }
    }
    all = next;
    return { moved };
  };

  return store;
}
