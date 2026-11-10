import { UNGROUPED, UNGROUPED_NAME } from "./groups.js?v=1.2.0";

// Presses here keep their own behaviour and never start a drag (R4).
const SKIP = ".check, button, a, input, select, textarea, .task__edit, .group__toggle";
const SLOP = 6; // mouse and pen: px of movement before a press becomes a drag (R1)

// Picks a task up with a mouse or pen and floats it as a slip over the drop strip. Knows nothing about storage:
// the outcome goes to onEnd(row, key, hadFocus), key null for a cancel. Touch (T5), hit testing and the drop (T4)
// and auto scroll (T6) come later; for now every release is a cancel.
// Following the pointer never rebuilds the list or reads all rows: one transform per frame (NFR1, BUG-010).
export function createDrag({ list, template, groups, canStart, onStart, onEnd }) {
  const part = (sel) => template.content.querySelector(sel).cloneNode(true);
  const html = document.documentElement;
  let s = null; // the press, then the drag
  let frame = 0;

  list.addEventListener("pointerdown", (e) => {
    if (s || !e.isPrimary || e.button !== 0 || e.pointerType === "touch") return;
    const row = e.target.closest(".task");
    if (!row || row.matches(".task--exit, .task--editing") || e.target.closest(SKIP)) return;
    const ac = new AbortController();
    s = { row, ac, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
      hadFocus: list.contains(document.activeElement), dragging: false }; // focus read before the browser moves it (R22)
    const on = (target, type, fn) => target.addEventListener(type, fn, { capture: true, signal: ac.signal });
    on(window, "pointermove", move);
    on(window, "pointerup", (e) => { if (e.pointerId === s.id) release(); });
    on(window, "pointercancel", (e) => { if (e.pointerId === s.id) end(null); });
    on(window, "blur", (e) => { if (e.target === window) end(null); }); // capture also sees every element blur
    on(document, "visibilitychange", () => { if (document.hidden) end(null); });
    on(window, "keydown", (e) => {
      if (!s.dragging || e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation(); // the Escape cancels the drag only, never an edit, a dialog or a field (R18)
      end(null);
    });
    for (const type of ["contextmenu", "selectstart"]) on(document, type, (e) => { if (s.dragging) e.preventDefault(); });
    on(document, "dragstart", (e) => e.preventDefault()); // a selected text would start the native drag instead
  });

  function move(e) {
    if (e.pointerId !== s.id) return;
    s.x = e.clientX;
    s.y = e.clientY;
    if (s.dragging) {
      frame ||= requestAnimationFrame(follow);
    } else if (Math.hypot(s.x - s.x0, s.y - s.y0) > SLOP) {
      if (canStart()) pickUp(); else end(null); // the release stays a plain click (R5, R35)
    }
  }

  function pickUp() {
    const { row } = s;
    s.dragging = true;
    onStart(row);
    s.key = row.closest(".group")?.dataset.key ?? UNGROUPED;
    html.classList.add("is-dragging");
    row.classList.add("task--placeholder");
    // Text and names as plain text only (R37).
    const slip = part(".drag-slip");
    const text = slip.querySelector(".drag-slip__text");
    text.textContent = row.querySelector(".task__label").textContent;
    slip.classList.toggle("drag-slip--done", row.querySelector(".check input").checked);
    // Every group in creation order, Chưa phân nhóm last, the own group faded (R9, R12). No tab stops (R10).
    const strip = part(".drop-strip");
    for (const g of [...groups().list(), { id: UNGROUPED, name: UNGROUPED_NAME }]) {
      const target = part(".drop-target");
      target.dataset.key = g.id;
      target.dataset.color = g.color ?? "none";
      target.classList.toggle("drop-target--home", g.id === s.key);
      target.firstElementChild.textContent = g.name;
      strip.append(target);
    }
    // The strip goes inside <main> so it sits in a landmark (axe region); the sheet has no transform, so fixed still
    // means the screen. The slip is hidden from assistive tech and stays on body, above every section.
    document.body.append(slip);
    list.closest("main").append(strip);
    s.slip = slip;
    s.strip = strip;
    getSelection()?.removeAllRanges();
    // Captured on the slip, not the row: the browser keeps :hover on the capturing element, and the placeholder
    // must not show the row hover wash.
    try { slip.setPointerCapture(s.id); } catch { /* a synthetic event has no active pointer */ }
    slip.addEventListener("lostpointercapture", () => end(null), { signal: s.ac.signal });
    // Measured once: the slip's text lands on the line's text and keeps the grab point under the pointer (R27).
    const r = row.querySelector(".task__text").getBoundingClientRect();
    s.dx = r.left - text.offsetLeft - s.x0;
    s.dy = row.getBoundingClientRect().top - s.y0;
    s.maxX = html.clientWidth - slip.offsetWidth - 8;
    s.maxY = html.clientHeight - slip.offsetHeight;
    follow();
  }

  function follow() {
    frame = 0;
    if (!s?.slip) return;
    const x = Math.max(8, Math.min(s.x + s.dx, s.maxX));
    const y = Math.max(0, Math.min(s.y + s.dy, s.maxY));
    // left and top, not transform or translate: the CSS rotate would turn a transform's offset (BUG-016), and the
    // pick-up keyframes animate translate. The slip is fixed and out of flow, so this lays out the slip only.
    s.slip.style.left = `${x}px`;
    s.slip.style.top = `${y}px`;
  }

  function release() {
    if (!s.dragging) return end(null);
    // The click that follows the release never ticks, opens or follows anything (R7).
    const swallow = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, true));
    end(null); // T4: the target under the pointer
  }

  // Every exit runs this; each step is safe to repeat, so nothing is ever left on the page (NFR4).
  function end(key) {
    if (!s) return;
    const { row, ac, dragging, hadFocus, slip, strip } = s;
    s = null;
    cancelAnimationFrame(frame);
    frame = 0;
    ac.abort();
    html.classList.remove("is-dragging");
    row.classList.remove("task--placeholder");
    slip?.remove();
    strip?.remove();
    if (dragging) onEnd(row, key, hadFocus);
  }

  return { cancel: () => end(null), active: () => !!s?.dragging };
}
