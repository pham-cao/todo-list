import { validateText, newId } from "./store.js?v=1.3.0";

export const GROUPS_KEY = "daily-todo:groups:v1";
export const UI_KEY = "daily-todo:ui:v1";
export const MAX_GROUPS = 20;
export const MAX_NAME = 30;
export const UNGROUPED = "none";
export const COLORS = ["yellow", "pink", "green", "blue", "orange", "purple"];
export const COLOR_NAMES = { yellow: "Vàng", pink: "Hồng", green: "Xanh lá", blue: "Xanh dương", orange: "Cam", purple: "Tím" };
export const UNGROUPED_NAME = "Chưa phân nhóm";
const RESERVED = ["all", UNGROUPED, "new"];

const fold = (s) => s.normalize("NFC").toLowerCase();

export function validateGroupName(raw, groups, selfId = null) {
  const v = validateText(raw, MAX_NAME);
  if (v.error) return v;
  const key = fold(v.text);
  if (key === fold(UNGROUPED_NAME) || groups.some((g) => g.id !== selfId && fold(g.name) === key)) {
    return { error: "duplicate" };
  }
  return { name: v.text };
}

export function nextColor(groups) {
  const last = groups[groups.length - 1];
  const i = last ? COLORS.indexOf(last.color) : -1;
  return COLORS[(i + 1) % COLORS.length];
}

const isGroup = (g) =>
  g && typeof g === "object" &&
  typeof g.id === "string" && g.id !== "" && !RESERVED.includes(g.id) &&
  typeof g.name === "string" && g.name !== "" &&
  Number.isFinite(g.createdAt);

export function createGroups(storage) {
  let all = [];
  let collapsed = new Set();
  let locked = false; // read failed: never write this session
  const api = { storageOk: true };

  const parse = (raw) => { try { return JSON.parse(raw); } catch { return undefined; } };

  try {
    if (!storage) throw new Error("no storage");
    const raw = storage.getItem(GROUPS_KEY);
    if (raw) {
      const data = parse(raw);
      if (Array.isArray(data)) {
        const seen = new Set();
        all = data.filter((g) => isGroup(g) && !seen.has(g.id) && seen.add(g.id)).map((g) => ({
          id: g.id, name: g.name, createdAt: g.createdAt,
          color: COLORS.includes(g.color) ? g.color : "yellow",
        }));
      } else {
        try { storage.setItem(`${GROUPS_KEY}:corrupt`, raw); } catch { /* best effort */ }
      }
    }
    const ui = parse(storage.getItem(UI_KEY) ?? "");
    if (ui && Array.isArray(ui.collapsed)) {
      collapsed = new Set(ui.collapsed.filter((k) => typeof k === "string" && k !== ""));
    }
  } catch {
    locked = true;
    api.storageOk = false;
  }

  function write(key, value) {
    if (locked) return;
    try {
      storage.setItem(key, JSON.stringify(value));
      api.storageOk = true;
    } catch {
      api.storageOk = false;
    }
  }
  const saveGroups = () => write(GROUPS_KEY, all);
  const saveUi = () => write(UI_KEY, { collapsed: [...collapsed] });

  api.list = () => all.map((g) => ({ ...g }));
  api.get = (id) => {
    const g = all.find((x) => x.id === id);
    return g && { ...g };
  };

  api.create = (raw, now = new Date()) => {
    if (all.length >= MAX_GROUPS) return { error: "tooMany" };
    if (typeof raw !== "string") return { error: "empty" };
    const v = validateGroupName(raw, all);
    if (v.error) return v;
    const group = { id: newId(), name: v.name, color: nextColor(all), createdAt: now.getTime() };
    all.push(group);
    saveGroups();
    return { group: { ...group } };
  };

  api.update = (id, raw, color) => {
    const g = all.find((x) => x.id === id);
    if (!g) return { error: "notFound" };
    if (typeof raw !== "string") return { error: "empty" };
    const v = validateGroupName(raw, all, id);
    if (v.error) return v;
    g.name = v.name;
    if (COLORS.includes(color)) g.color = color;
    saveGroups();
    return { group: { ...g } };
  };

  api.remove = (id) => {
    all = all.filter((g) => g.id !== id);
    saveGroups();
    if (collapsed.delete(id)) saveUi();
  };

  api.isCollapsed = (key) => collapsed.has(key);
  api.setCollapsed = (key, on) => {
    if (typeof key !== "string" || key === "") return;
    if (on) collapsed.add(key); else collapsed.delete(key);
    saveUi();
  };

  return api;
}
