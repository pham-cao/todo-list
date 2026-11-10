import { test } from "node:test";
import assert from "node:assert/strict";
import { validateText, newId, createStore, getStorage, STORAGE_KEY, MAX_LENGTH } from "../../src/store.js";

const fake = (init = {}) => {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
};
const good = (o = {}) => ({ id: "a", text: "x", done: false, createdAt: 1, date: "2026-11-09", ...o });
const day = new Date(2026, 10, 9, 10, 0);

test("validateText limits", () => {
  assert.deepEqual(validateText(""), { error: "empty" });
  assert.deepEqual(validateText("   "), { error: "empty" });
  assert.deepEqual(validateText("a".repeat(200)), { text: "a".repeat(200) });
  assert.deepEqual(validateText("a".repeat(201)), { error: "tooLong" });
  assert.equal(MAX_LENGTH, 200);
  assert.ok(validateText("😀".repeat(200)).text);
  assert.equal(validateText("😀".repeat(201)).error, "tooLong");
  assert.ok(validateText("ệ".repeat(200)).text);
  assert.ok(validateText("e\u0323\u0302".repeat(100)).text); // 100 decomposed chars normalise to 100, accepted, stored unchanged
  assert.equal(validateText("e\u0323\u0302".repeat(100)).text, "e\u0323\u0302".repeat(100));
  assert.equal(validateText("ệ".repeat(201)).error, "tooLong");
});

test("validateText trims only", () => {
  assert.equal(validateText("  <b>abc</b>  Đi  chợ ").text, "<b>abc</b>  Đi  chợ");
});

test("getStorage returns null when unavailable", () => {
  assert.equal(getStorage(), null);
});

test("add sets fields; tasksFor filters by date in creation order", () => {
  const s = createStore(fake());
  const a = s.add("one", day).task;
  s.add("other day", new Date(2026, 10, 10)).task;
  const c = s.add("two", day).task;
  assert.equal(a.date, "2026-11-09");
  assert.equal(a.createdAt, day.getTime());
  assert.equal(a.done, false);
  assert.notEqual(a.id, c.id);
  assert.deepEqual(s.tasksFor("2026-11-09").map((t) => t.text), ["one", "two"]);
  assert.deepEqual(s.add("  ").error, "empty");
  assert.equal(s.tasksFor("2026-11-09").length, 2);
});

test("tasksFor returns copies", () => {
  const s = createStore(fake());
  s.add("one", day);
  s.tasksFor("2026-11-09")[0].text = "hacked";
  assert.equal(s.tasksFor("2026-11-09")[0].text, "one");
});

test("updateText keeps done, date and position; errors leave text", () => {
  const s = createStore(fake());
  const a = s.add("one", day).task;
  s.add("two", day);
  s.setDone(a.id, true);
  assert.equal(s.updateText(a.id, "  new ").task.text, "new");
  const list = s.tasksFor("2026-11-09");
  assert.deepEqual(list.map((t) => t.text), ["new", "two"]);
  assert.equal(list[0].done, true);
  assert.equal(s.updateText(a.id, "").error, "empty");
  assert.equal(s.updateText(a.id, "a".repeat(201)).error, "tooLong");
  assert.equal(s.tasksFor("2026-11-09")[0].text, "new");
});

test("setDone and remove", () => {
  const s = createStore(fake());
  const a = s.add("one", day).task;
  assert.equal(s.setDone(a.id, true).done, true);
  assert.equal(s.setDone(a.id, false).done, false);
  s.remove(a.id);
  assert.equal(s.tasksFor("2026-11-09").length, 0);
});

test("data survives a new store on the same storage", () => {
  const st = fake();
  const s = createStore(st);
  const a = s.add("one", day).task;
  s.setDone(a.id, true);
  const again = createStore(st).tasksFor("2026-11-09");
  assert.equal(again.length, 1);
  assert.equal(again[0].done, true);
  assert.equal(again[0].text, "one");
});

test("corrupt JSON and non array start empty and back up raw value", () => {
  for (const raw of ["{not json", '{"a":1}', "42", "null", '"x"']) {
    const st = fake({ [STORAGE_KEY]: raw });
    const s = createStore(st);
    assert.equal(s.storageOk, true);
    assert.equal(s.tasksFor("2026-11-09").length, 0);
    assert.equal(st.data[`${STORAGE_KEY}:corrupt`], raw);
    s.add("new", day);
    assert.equal(JSON.parse(st.data[STORAGE_KEY]).length, 1);
  }
});

test("missing or empty value starts empty without backup", () => {
  for (const st of [fake(), fake({ [STORAGE_KEY]: "" })]) {
    assert.equal(createStore(st).tasksFor("2026-11-09").length, 0);
    assert.equal(`${STORAGE_KEY}:corrupt` in st.data, false);
  }
});

test("invalid items are dropped, valid kept", () => {
  const items = [
    good(), null, "x", good({ id: "" }), good({ id: 5 }), good({ text: 1 }),
    good({ done: "yes" }), good({ createdAt: "1" }), good({ createdAt: Infinity }),
    good({ date: "2026-1-9" }), good({ id: "b", text: "kept" }),
  ];
  const s = createStore(fake({ [STORAGE_KEY]: JSON.stringify(items) }));
  assert.deepEqual(s.tasksFor("2026-11-09").map((t) => t.id), ["a", "b"]);
});

test("read failure: memory only, no writes", () => {
  const writes = [];
  const st = { getItem() { throw new Error("blocked"); }, setItem: (k, v) => writes.push(k) };
  const s = createStore(st);
  assert.equal(s.storageOk, false);
  s.add("one", day);
  assert.equal(s.tasksFor("2026-11-09").length, 1);
  assert.equal(s.storageOk, false);
  assert.deepEqual(writes, []);
  assert.equal(createStore(null).storageOk, false);
});

test("write failure keeps memory and old stored value; recovery restores storageOk", () => {
  const st = fake();
  const s = createStore(st);
  s.add("one", day);
  const before = st.data[STORAGE_KEY];
  let fail = true;
  st.setItem = (k, v) => { if (fail) throw new Error("full"); st.data[k] = v; };
  s.add("two", day);
  assert.equal(s.storageOk, false);
  assert.equal(s.tasksFor("2026-11-09").length, 2);
  assert.equal(st.data[STORAGE_KEY], before);
  fail = false;
  s.add("three", day);
  assert.equal(s.storageOk, true);
  assert.equal(JSON.parse(st.data[STORAGE_KEY]).length, 3);
});

test("unknown id: updateText notFound, setDone undefined, remove harmless", () => {
  const s = createStore(fake());
  s.add("one", day);
  assert.equal(s.updateText("nope", "x").error, "notFound");
  assert.equal(s.setDone("nope", true), undefined);
  s.remove("nope");
  assert.equal(s.tasksFor("2026-11-09").length, 1);
});

test("write failure on remove and setDone keeps memory change", () => {
  const st = fake();
  const s = createStore(st);
  const a = s.add("one", day).task;
  st.setItem = () => { throw new Error("full"); };
  s.setDone(a.id, true);
  assert.equal(s.storageOk, false);
  assert.equal(s.tasksFor("2026-11-09")[0].done, true);
  s.remove(a.id);
  assert.equal(s.tasksFor("2026-11-09").length, 0);
});

test("corrupt backup failing does not throw or lock the store", () => {
  const st = { getItem: () => "{bad", setItem() { throw new Error("full"); } };
  const s = createStore(st);
  assert.equal(s.tasksFor("2026-11-09").length, 0);
  assert.equal(s.add("x", day).task.text, "x");
});

test("add with a dateKey uses it as date, keeps real createdAt, persists", () => {
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const s = createStore(storage);
  const now = new Date(2026, 10, 9, 9, 0);
  s.add("first", new Date(2026, 10, 8, 8, 0), "2026-11-08");
  const t = s.add("Việc A", now, "2026-11-08").task;
  assert.equal(t.date, "2026-11-08");
  assert.equal(t.createdAt, now.getTime());
  const list = createStore(storage).tasksFor("2026-11-08");
  assert.equal(list.at(-1).id, t.id);
  assert.equal(s.tasksFor("2026-11-09").length, 0);
  assert.equal(s.add("x", now).task.date, "2026-11-09");
  assert.equal(s.add(" ", now, "2026-11-08").error, "empty");
});

test("add with a dateKey: too long saves nothing; failing write keeps task in memory and old stored value", () => {
  const mem = new Map();
  let fail = false;
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => { if (fail) throw new Error("full"); mem.set(k, v); } };
  const s = createStore(storage);
  const now = new Date(2026, 10, 9, 9, 0);
  s.add("keep", now, "2026-11-08");
  const stored = mem.get(STORAGE_KEY);
  assert.equal(s.add("a".repeat(201), now, "2026-11-08").error, "tooLong");
  assert.equal(mem.get(STORAGE_KEY), stored);
  fail = true;
  const t = s.add("lost write", now, "2026-11-08").task;
  assert.equal(s.storageOk, false);
  assert.equal(s.tasksFor("2026-11-08").at(-1).id, t.id);
  assert.equal(mem.get(STORAGE_KEY), stored);
});

test("validateText max argument and exported newId", () => {
  assert.equal(validateText("a".repeat(31), 30).error, "tooLong");
  assert.ok(validateText("a".repeat(30), 30).text);
  assert.notEqual(newId(), newId());
});

test("groupId is written only when set; updateText sets, keeps and removes it", () => {
  const s = createStore(fake());
  const a = s.add("a", day, "2026-11-09").task;
  assert.ok(!("groupId" in a));
  assert.ok(!("groupId" in s.add("b", day, "2026-11-09", "").task));
  const g = s.add("g", day, "2026-11-09", "g1").task;
  assert.equal(g.groupId, "g1");
  assert.equal(s.updateText(a.id, "a2", "g2").task.groupId, "g2");
  assert.equal(s.updateText(a.id, "a3").task.groupId, "g2");
  const r = s.updateText(a.id, "a4", null).task;
  assert.ok(!("groupId" in r));
  assert.ok(!("groupId" in s.tasksFor("2026-11-09")[0]));
});

test("invalid text changes neither text nor group", () => {
  const mem = fake();
  const s = createStore(mem);
  const t = s.add("a", day, "2026-11-09", "g1").task;
  const stored = mem.data[STORAGE_KEY];
  assert.equal(s.updateText(t.id, "  ", null).error, "empty");
  assert.equal(s.updateText(t.id, "x".repeat(201), "g2").error, "tooLong");
  assert.equal(s.tasksFor("2026-11-09")[0].groupId, "g1");
  assert.equal(mem.data[STORAGE_KEY], stored);
});

const seeded = () => fake({ [STORAGE_KEY]: JSON.stringify([
  good({ id: "1", groupId: "g", date: "2026-11-10" }),
  good({ id: "2", groupId: "g", date: "2026-11-01", done: true }),
  good({ id: "3", groupId: "g", date: "2026-11-10" }),
  good({ id: "4", groupId: "h", date: "2026-12-25" }),
  good({ id: "5" }),
]) });

test("groupUsage counts tasks and lists sorted distinct days", () => {
  const s = createStore(seeded());
  assert.deepEqual(s.groupUsage("g"), { count: 3, days: ["2026-11-01", "2026-11-10"] });
  assert.deepEqual(s.groupUsage("h"), { count: 1, days: ["2026-12-25"] });
  assert.deepEqual(s.groupUsage("zz"), { count: 0, days: [] });
});

test("moveGroup changes only groupId, one write; to null removes the field", () => {
  const mem = seeded();
  let writes = 0;
  const storage = { getItem: mem.getItem, setItem: (k, v) => { writes++; mem.setItem(k, v); } };
  const s = createStore(storage);
  const before = JSON.parse(mem.data[STORAGE_KEY]);
  assert.deepEqual(s.moveGroup("g", "h"), { moved: 3 });
  assert.equal(writes, 1);
  const after = JSON.parse(mem.data[STORAGE_KEY]);
  assert.deepEqual(after.map(({ groupId, ...r }) => r), before.map(({ groupId, ...r }) => r));
  assert.deepEqual(after.map((t) => t.groupId), ["h", "h", "h", "h", undefined]);
  assert.deepEqual(s.moveGroup("h", null), { moved: 4 });
  assert.ok(JSON.parse(mem.data[STORAGE_KEY]).every((t) => !("groupId" in t)));
  assert.ok(s.tasksFor("2026-11-10").every((t) => !("groupId" in t)));
});

test("moveGroup on an empty group does not write", () => {
  let writes = 0;
  const s = createStore({ getItem: () => null, setItem: () => { writes++; } });
  assert.deepEqual(s.moveGroup("none", "h"), { moved: 0 });
  assert.equal(writes, 0);
});

test("moveGroup write failure returns save error and changes nothing", () => {
  const mem = seeded();
  let fail = false;
  const s = createStore({ getItem: mem.getItem, setItem: (k, v) => { if (fail) throw new Error("full"); mem.setItem(k, v); } });
  s.add("w", day, "2026-11-09"); // a real write first
  const stored = mem.data[STORAGE_KEY];
  const tasks = s.tasksFor("2026-11-10");
  fail = true;
  assert.deepEqual(s.moveGroup("g", "h"), { error: "save" });
  assert.deepEqual(s.tasksFor("2026-11-10"), tasks);
  assert.equal(mem.data[STORAGE_KEY], stored);
  assert.equal(s.storageOk, true);
});

test("locked store moves in memory without writing", () => {
  let writes = 0;
  const s = createStore({ getItem: () => { throw new Error("denied"); }, setItem: () => { writes++; } });
  s.add("a", day, "2026-11-09", "g");
  assert.deepEqual(s.moveGroup("g", "h"), { moved: 1 });
  assert.equal(s.tasksFor("2026-11-09")[0].groupId, "h");
  assert.equal(writes, 0);
});

test("stored tasks with missing, null or unknown groupId load and are not rewritten", () => {
  const mem = fake({ [STORAGE_KEY]: JSON.stringify([
    good({ id: "1" }), good({ id: "2", groupId: null }), good({ id: "3", groupId: "gone" }),
  ]) });
  const raw = mem.data[STORAGE_KEY];
  const s = createStore(mem);
  assert.equal(s.tasksFor("2026-11-09").length, 3);
  assert.equal(mem.data[STORAGE_KEY], raw);
});

test("non string group ids are ignored by add and updateText", () => {
  const s = createStore(fake());
  assert.ok(!("groupId" in s.add("a", day, "2026-11-09", 5).task));
  const t = s.add("b", day, "2026-11-09", "g1").task;
  for (const bad of [5, {}, [], true, ""]) assert.equal(s.updateText(t.id, "b", bad).task.groupId, "g1");
});

test("moveGroup with a missing fromId moves nothing and does not write", () => {
  const mem = seeded();
  let writes = 0;
  const s = createStore({ getItem: mem.getItem, setItem: (k, v) => { writes++; mem.setItem(k, v); } });
  for (const bad of [undefined, null, ""]) assert.deepEqual(s.moveGroup(bad, "h"), { moved: 0 });
  assert.equal(writes, 0);
  assert.ok(!("groupId" in s.tasksFor("2026-11-09")[0]));
});

test("a successful moveGroup write restores storageOk", () => {
  const mem = seeded();
  let fail = false;
  const s = createStore({ getItem: mem.getItem, setItem: (k, v) => { if (fail) throw new Error("full"); mem.setItem(k, v); } });
  fail = true;
  s.add("w", day, "2026-11-09");
  assert.equal(s.storageOk, false);
  fail = false;
  assert.deepEqual(s.moveGroup("g", "h"), { moved: 3 });
  assert.equal(s.storageOk, true);
});
