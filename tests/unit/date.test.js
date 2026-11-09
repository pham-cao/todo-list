import { test } from "node:test";
import assert from "node:assert/strict";
import { toDateKey, formatDate, MIN_YEAR, MAX_YEAR, parseDateKey, addDays, dayKind, dateLine } from "../../src/date.js";

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

test("bounds constants", () => {
  assert.equal(MIN_YEAR, 2000);
  assert.equal(MAX_YEAR, 2099);
});

test("parseDateKey accepts valid keys as local midnight", () => {
  for (const k of ["2026-11-08", "2026-12-31", "2000-01-01", "2099-12-31", "2028-02-29"]) {
    const d = parseDateKey(k);
    assert.equal(toDateKey(d), k);
    assert.equal(d.getHours() + d.getMinutes(), 0);
  }
});

test("parseDateKey rejects impossible dates, wrong formats and out of range years", () => {
  const bad = ["2026-02-30", "2026-13-01", "2026-00-10", "2026-04-31", "2027-02-29", "2026-1-5", "20261108", "", null, undefined,
    20261108, "<b>x</b>", "2026-11-08 ", "2026-11-08\n", "1999-12-31", "2100-01-01"];
  for (const k of bad) assert.equal(parseDateKey(k), null, String(k));
});

test("addDays across month end, year end and leap day", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2027-01-01", -1), "2026-12-31");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2028-03-01", -1), "2028-02-29");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("addDays 400 single steps match a UTC calendar", () => {
  const utc = (i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
  let k = "2026-01-01";
  for (let i = 1; i <= 400; i++) { k = addDays(k, 1); assert.equal(k, utc(i)); }
  for (let i = 399; i >= 0; i--) { k = addDays(k, -1); assert.equal(k, utc(i)); }
});

test("addDays is null at the bounds and for invalid keys", () => {
  assert.equal(addDays("2099-12-31", 1), null);
  assert.equal(addDays("2000-01-01", -1), null);
  assert.equal(addDays("bad", 1), null);
  assert.equal(addDays(null, -1), null);
  assert.equal(addDays("2099-12-30", 1), "2099-12-31");
  assert.equal(addDays("2000-01-02", -1), "2000-01-01");
});

test("dayKind gives all five kinds", () => {
  const t = "2026-11-09";
  const got = ["2026-11-09", "2026-11-08", "2026-11-10", "2026-11-07", "2026-11-11", "2000-01-01", "2099-12-31"].map((k) => dayKind(k, t));
  assert.deepEqual(got, ["today", "yesterday", "tomorrow", "past", "future", "past", "future"]);
});

test("dayKind and dateLine across month and year ends", () => {
  assert.equal(dayKind("2026-11-30", "2026-12-01"), "yesterday");
  assert.equal(dayKind("2026-12-31", "2027-01-01"), "yesterday");
  assert.equal(dayKind("2027-01-02", "2027-01-01"), "tomorrow");
  assert.equal(dateLine("2026-12-31", "2027-01-01"), "Hôm qua, Thứ Năm, 31/12/2026");
});

test("dateLine requirement examples", () => {
  const t = "2026-11-09";
  assert.equal(dateLine("2026-11-09", t), "Hôm nay, Thứ Hai, 09/11/2026");
  assert.equal(dateLine("2026-11-08", t), "Hôm qua, Chủ Nhật, 08/11/2026");
  assert.equal(dateLine("2026-11-10", t), "Ngày mai, Thứ Ba, 10/11/2026");
  assert.equal(dateLine("2026-11-06", t), "Thứ Sáu, 06/11/2026");
});

test("dateLine and dayKind never throw or echo invalid input", () => {
  for (const k of [null, "<img src=x>"]) {
    assert.equal(dateLine(k, "2026-11-09"), "");
    assert.doesNotThrow(() => dayKind(k, "2026-11-09"));
  }
  // fallback is string order when either key is invalid
  assert.equal(dayKind(null, "bad"), "future");
  assert.equal(dayKind("bad", "bad"), "future");
  assert.equal(dayKind("<img src=x>", "2026-11-09"), "future");
  assert.equal(dayKind("1999-12-31", "2026-11-09"), "past");
  assert.equal(dayKind("2026-11-09", null), "future");
});
