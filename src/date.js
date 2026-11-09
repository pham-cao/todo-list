export const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const pad = (n) => String(n).padStart(2, "0");

// "2026-11-09", local time, zero padded
export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "Thứ Hai, 09/11/2026"
export function formatDate(date = new Date()) {
  return `${WEEKDAYS[date.getDay()]}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export const MIN_YEAR = 2000;
export const MAX_YEAR = 2099;

// "2026-11-08" -> local Date at 00:00, or null (bad format, not a real date, year out of range, non string)
export function parseDateKey(text) {
  const m = typeof text === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  const date = new Date(y, mo - 1, d);
  return date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

// key moved by n days, or null when key is invalid or the result is out of range
export function addDays(key, n) {
  const d = parseDateKey(key);
  if (!d) return null;
  const out = toDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
  return parseDateKey(out) ? out : null;
}

// 'today' | 'yesterday' | 'tomorrow' | 'past' | 'future'. Invalid input does not throw (falls to string order).
export function dayKind(key, todayKey) {
  if (!parseDateKey(key) || !parseDateKey(todayKey)) return key < todayKey ? "past" : "future";
  if (key === todayKey) return "today";
  if (key === addDays(todayKey, -1)) return "yesterday";
  if (key === addDays(todayKey, 1)) return "tomorrow";
  return key < todayKey ? "past" : "future";
}

const PREFIX = { today: "Hôm nay, ", yesterday: "Hôm qua, ", tomorrow: "Ngày mai, " };

// "Hôm nay, Thứ Hai, 09/11/2026"; "" when key is invalid (nothing from input is echoed)
export function dateLine(key, todayKey) {
  const d = parseDateKey(key);
  return d ? (PREFIX[dayKind(key, todayKey)] ?? "") + formatDate(d) : "";
}
