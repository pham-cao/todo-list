import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GROUPS_KEY, UI_KEY, COLORS, UNGROUPED_NAME, MAX_GROUPS,
  validateGroupName, nextColor, createGroups,
} from "../../src/groups.js";

const fake = (init = {}) => {
  const data = { ...init };
  const s = {
    data, sets: 0,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { s.sets++; data[k] = String(v); },
  };
  return s;
};
const g = (o = {}) => ({ id: "a", name: "A", color: "pink", createdAt: 1, ...o });
const now = new Date(2026, 10, 9);

test("name: trim, kept as typed", () => {
  assert.deepEqual(validateGroupName("  Công ty  ", []), { name: "Công ty" });
  assert.equal(validateGroupName("Cà phê ☕😀", []).name, "Cà phê ☕😀");
  assert.equal(validateGroupName("<b>abc</b>", []).name, "<b>abc</b>");
  assert.deepEqual(validateGroupName("", []), { error: "empty" });
  assert.deepEqual(validateGroupName("   ", []), { error: "empty" });
  assert.deepEqual(validateGroupName(undefined, []), { error: "empty" });
});

test("name: 30 code points after NFC", () => {
  assert.ok(validateGroupName("a".repeat(30), []).name);
  assert.equal(validateGroupName("a".repeat(31), []).error, "tooLong");
  assert.ok(validateGroupName("😀".repeat(30), []).name);
  assert.equal(validateGroupName("😀".repeat(31), []).error, "tooLong");
  assert.ok(validateGroupName("ệ".repeat(30), []).name);
  assert.equal(validateGroupName("ệ".repeat(31), []).error, "tooLong");
});

test("name: duplicates", () => {
  const list = [g({ id: "a", name: "Việc nhà" })];
  assert.equal(validateGroupName("VIỆC NHÀ", list).error, "duplicate");
  assert.equal(validateGroupName("Việc nhà", list).error, "duplicate"); // decomposed
  assert.equal(validateGroupName("chưa phân nhóm", []).error, "duplicate");
  assert.equal(validateGroupName(UNGROUPED_NAME.toUpperCase(), []).error, "duplicate");
  assert.equal(validateGroupName("việc nhà", list, "a").name, "việc nhà");
  assert.equal(validateGroupName("việc nhà", list, "other").error, "duplicate");
});

test("create: 20 group limit comes before name errors", () => {
  const s = fake();
  const groups = createGroups(s);
  for (let i = 0; i < MAX_GROUPS; i++) assert.ok(groups.create(`G${i}`, now).group);
  assert.deepEqual(groups.create("new one"), { error: "tooMany" });
  assert.deepEqual(groups.create(""), { error: "tooMany" });
  assert.deepEqual(groups.create("G1"), { error: "tooMany" });
  assert.equal(groups.list().length, 20);
});

test("colour order, wrap, continuation after deletion", () => {
  const s = fake();
  const groups = createGroups(s);
  assert.equal(nextColor([]), "yellow");
  const made = Array.from({ length: 7 }, (_, i) => groups.create(`G${i}`, now).group);
  assert.deepEqual(made.map((x) => x.color), [...COLORS, "yellow"]);
  groups.remove(made[6].id); // latest is purple again: continues after it
  assert.equal(groups.create("X").group.color, "yellow");
  groups.remove(made[1].id); // deleting a middle group does not change the latest
  assert.equal(groups.create("Y").group.color, "pink");
  assert.deepEqual(JSON.parse(s.data[GROUPS_KEY]).map((x) => x.name).slice(-2), ["X", "Y"]);
});

test("create and update save straight away", () => {
  const s = fake();
  const groups = createGroups(s);
  const { group } = groups.create(" Nhà ", now);
  assert.equal(group.createdAt, now.getTime());
  assert.deepEqual(JSON.parse(s.data[GROUPS_KEY]), [group]);
  assert.deepEqual(groups.update(group.id, "Nhà", "blue").group.color, "blue");
  assert.equal(groups.update(group.id, "Nhà", "nope").group.color, "blue");
  assert.equal(groups.update(group.id, "", "red").error, "empty");
  assert.equal(groups.update("zzz", "A").error, "notFound");
  assert.equal(groups.get(group.id).color, "blue");
  assert.equal(groups.get("zzz"), undefined);
  groups.get(group.id).name = "hack";
  groups.list()[0].name = "hack";
  assert.equal(groups.get(group.id).name, "Nhà");
  assert.equal(createGroups(s).list()[0].color, "blue");
});

test("load: missing, empty, corrupt", () => {
  for (const raw of [undefined, "", "[]"]) {
    const s = fake(raw === undefined ? {} : { [GROUPS_KEY]: raw });
    const groups = createGroups(s);
    assert.deepEqual(groups.list(), []);
    assert.equal(groups.storageOk, true);
    assert.equal(s.sets, 0);
  }
  for (const raw of ["not json", "{}", "42", "null", '"x"']) {
    const s = fake({ [GROUPS_KEY]: raw });
    const groups = createGroups(s);
    assert.deepEqual(groups.list(), []);
    assert.equal(s.data[`${GROUPS_KEY}:corrupt`], raw);
    assert.equal(s.sets, 1);
    assert.equal(s.data[GROUPS_KEY], raw); // not overwritten on load
    assert.equal(groups.storageOk, true);
  }
});

test("load: bad items dropped, reserved ids dropped, colour fallback", () => {
  const s = fake({
    [GROUPS_KEY]: JSON.stringify([
      g({ id: "ok", color: "nope" }), g({ id: "nocolor", color: undefined }), g({ id: "blue1", color: "blue" }),
      g({ id: "" }), g({ id: 5 }), g({ name: "" }), g({ id: "b", name: 3 }), g({ id: "c", createdAt: "1" }),
      g({ id: "d", createdAt: NaN }), null, 7, "x",
      g({ id: "all" }), g({ id: "none" }), g({ id: "new" }),
    ]),
  });
  const groups = createGroups(s);
  assert.deepEqual(groups.list().map((x) => [x.id, x.color]), [["ok", "yellow"], ["nocolor", "yellow"], ["blue1", "blue"]]);
  assert.equal(s.sets, 0);
});

test("throwing getItem locks writes", () => {
  let sets = 0;
  const s = { getItem() { throw new Error("blocked"); }, setItem() { sets++; } };
  const groups = createGroups(s);
  assert.equal(groups.storageOk, false);
  assert.ok(groups.create("A").group);
  groups.setCollapsed("none", true);
  assert.equal(groups.list().length, 1);
  assert.equal(groups.isCollapsed("none"), true);
  assert.equal(sets, 0);
  assert.equal(groups.storageOk, false);
  assert.equal(createGroups(null).storageOk, false);
});

test("throwing setItem keeps the change in memory", () => {
  const s = { getItem: () => null, setItem() { throw new Error("full"); } };
  const groups = createGroups(s);
  assert.equal(groups.storageOk, true);
  assert.ok(groups.create("A").group);
  assert.equal(groups.storageOk, false);
  assert.equal(groups.list().length, 1);
  groups.setCollapsed("x", true);
  assert.equal(groups.isCollapsed("x"), true);
});

test("collapsed state round trip and cleaning", () => {
  const s = fake();
  const groups = createGroups(s);
  const { group } = groups.create("A");
  assert.equal(groups.isCollapsed(group.id), false);
  groups.setCollapsed(group.id, true);
  groups.setCollapsed("none", true);
  assert.deepEqual(JSON.parse(s.data[UI_KEY]), { collapsed: [group.id, "none"] });
  const again = createGroups(s);
  assert.equal(again.isCollapsed(group.id), true);
  assert.equal(again.isCollapsed("none"), true);
  again.setCollapsed("none", false);
  assert.deepEqual(JSON.parse(s.data[UI_KEY]), { collapsed: [group.id] });
  again.remove(group.id);
  assert.deepEqual(JSON.parse(s.data[UI_KEY]), { collapsed: [] });
  assert.equal(again.get(group.id), undefined);
  assert.equal(createGroups(s).isCollapsed(group.id), false);
});

test("garbage UI values ignored without a copy or an error", () => {
  for (const raw of ["junk", "null", "[]", "{}", '{"collapsed":"x"}', '{"collapsed":{}}']) {
    const s = fake({ [UI_KEY]: raw });
    const groups = createGroups(s);
    assert.equal(groups.isCollapsed("none"), false);
    assert.equal(groups.storageOk, true);
    assert.equal(s.sets, 0);
  }
  const s = fake({ [UI_KEY]: '{"collapsed":["a",1,null,"",{},"none"]}' });
  const groups = createGroups(s);
  assert.equal(groups.isCollapsed("a"), true);
  assert.equal(groups.isCollapsed("none"), true);
  assert.equal(groups.isCollapsed(1), false);
});

test("update: non string, reserved and unknown ids give notFound and write nothing", () => {
  const s = fake();
  const groups = createGroups(s);
  groups.create("A", now);
  const before = s.sets;
  for (const id of [undefined, null, 5, {}, "all", "none", "new", "missing"]) {
    assert.deepEqual(groups.update(id, "B"), { error: "notFound" });
  }
  assert.doesNotThrow(() => { groups.remove(undefined); groups.remove(null); groups.remove({}); });
  assert.equal(groups.get(undefined), undefined);
  assert.equal(groups.list().length, 1);
  assert.equal(s.sets, before + 3); // the three no-op removes rewrite the same list
});

test("update: only palette colours are applied, others keep the current colour", () => {
  const groups = createGroups(fake());
  const { group } = groups.create("A", now);
  assert.equal(groups.update(group.id, "A", "purple").group.color, "purple");
  for (const bad of ["#fff", "constructor", ["blue"], null, undefined, 3]) {
    assert.equal(groups.update(group.id, "A", bad).group.color, "purple");
  }
});

test("create: NFC duplicate of an existing name is rejected", () => {
  const groups = createGroups(fake());
  assert.ok(groups.create("Á", now).group);
  assert.deepEqual(groups.create("Á", now), { error: "duplicate" });
  assert.deepEqual(groups.update(groups.list()[0].id, "CHƯA PHÂN NHÓM"), { error: "duplicate" });
});

test("collapsed key none (ungrouped section) is kept on load and on remove of other groups", () => {
  const s = fake({ [UI_KEY]: JSON.stringify({ collapsed: ["none", 5, ""] }) });
  const groups = createGroups(s);
  assert.equal(groups.isCollapsed("none"), true);
  groups.remove("other");
  assert.equal(groups.isCollapsed("none"), true);
  assert.equal(s.sets, 1); // groups only; UI key untouched
});

test("load: duplicate ids keep the first and do not rewrite storage", () => {
  const s = fake({ [GROUPS_KEY]: JSON.stringify([g({ id: "a", name: "X" }), g({ id: "a", name: "Y" }), g({ id: "b", name: "Z" })]) });
  const groups = createGroups(s);
  assert.deepEqual(groups.list().map((x) => x.name), ["X", "Z"]);
  assert.equal(s.sets, 0);
});

test("setCollapsed ignores non string and empty keys; create rejects non string names", () => {
  const s = fake();
  const groups = createGroups(s);
  for (const k of [undefined, null, 5, "", {}]) groups.setCollapsed(k, true);
  assert.equal(s.sets, 0);
  assert.equal(groups.isCollapsed(""), false);
  for (const n of [undefined, null, 5, {}, ["a"]]) assert.deepEqual(groups.create(n), { error: "empty" });
  assert.equal(groups.list().length, 0);
  assert.equal(s.sets, 0);
  const { group } = groups.create("A");
  const before = s.sets;
  for (const n of [123, {}, ["x"], undefined, null]) assert.deepEqual(groups.update(group.id, n, "blue"), { error: "empty" });
  assert.equal(groups.get(group.id).name, "A");
  assert.equal(groups.get(group.id).color, "yellow");
  assert.equal(s.sets, before);
});
