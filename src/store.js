import { toDateKey } from "./date.js";

export const STORAGE_KEY = "daily-todo:tasks:v1";
export const MAX_LENGTH = 200;
const CORRUPT_KEY = `${STORAGE_KEY}:corrupt`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateText(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return { error: "empty" };
  if ([...text.normalize("NFC")].length > MAX_LENGTH) return { error: "tooLong" };
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

const newId = () =>
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

  store.add = (raw, now = new Date(), dateKey = toDateKey(now)) => {
    const v = validateText(raw);
    if (v.error) return v;
    const task = { id: newId(), text: v.text, done: false, createdAt: now.getTime(), date: dateKey };
    all.push(task);
    save();
    return { task: { ...task } };
  };

  store.updateText = (id, raw) => {
    const v = validateText(raw);
    if (v.error) return v;
    const task = find(id);
    if (!task) return { error: "notFound" };
    task.text = v.text;
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

  return store;
}
