import { test } from "node:test";
import assert from "node:assert/strict";
import { toDateKey, formatDate } from "../../src/date.js";

test("toDateKey pads month and day", () => {
  assert.equal(toDateKey(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(toDateKey(new Date(2026, 10, 9)), "2026-11-09");
});

test("toDateKey uses local midnight boundary", () => {
  assert.notEqual(toDateKey(new Date(2026, 10, 9, 23, 59)), toDateKey(new Date(2026, 10, 10, 0, 0)));
  assert.equal(toDateKey(new Date(2026, 10, 10, 0, 0)), "2026-11-10");
});

test("toDateKey and formatDate default to now", () => {
  assert.match(toDateKey(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(formatDate(), /^.+, \d{2}\/\d{2}\/\d{4}$/);
});

test("formatDate example", () => {
  assert.equal(formatDate(new Date(2026, 10, 9)), "Thứ Hai, 09/11/2026");
});

test("formatDate gives all seven weekday names", () => {
  const names = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];
  names.forEach((n, i) => assert.equal(formatDate(new Date(2026, 10, 9 + i)), `${n}, ${String(9 + i).padStart(2, "0")}/11/2026`));
});
