import { UNGROUPED, UNGROUPED_NAME } from "./groups.js?v=1.3.0";

// Presses here keep their own behaviour and never start a drag (R4).
const SKIP = ".check, button, a, input, select, textarea, .task__edit, .group__toggle";
const SLOP = 6; // mouse and pen: px of movement before a press becomes a drag (R1)
const TOUCH_SLOP = 10; // touch: more movement than this during the hold hands the touch to the swipe or the scroll (R3)
const HOLD = 400; // touch: ms of holding still before a pick up (R2)
const ABOVE = 60; // touch: the slip's bottom edge this far above the finger, so the finger never hides it
const EDGE = 64; // auto scroll zones: under the screen top, and above the strip's top edge (the strip never scrolls)

// Auto scroll speed in px per frame for a pointer at clientY (R31). Negative scrolls up, positive down, 0 outside the
// zones. The strip always wins: 0 over it, and no zone at all when it fills the screen (BUG-020). Up zone
// [0, min(edge, stripTop / 2)), down zone [max(stripTop - edge, stripTop / 2), stripTop): when the strip starts above
// 2 * edge the two share the space evenly. Each ramps from 1 to max across its own height, in whole px.
export function scrollSpeed(y, stripTop, edge = EDGE, max = 18) {
  if (y >= stripTop || stripTop <= 0) return 0;
  const up = Math.min(edge, stripTop / 2), down = Math.max(stripTop - edge, stripTop / 2);
  const ramp = (depth, height) => Math.max(1, Math.ceil(max * Math.min(1, depth / height)));
  if (y < up) return -ramp(up - y, up);
  return y >= down ? ramp(y - down, stripTop - down) : 0;
}

// Picks a task up with a mouse or pen and floats it as a slip over the drop strip. Knows nothing about storage:
// the outcome goes to onEnd(row, key, hadFocus, home), key null for a cancel, home the group the task was lifted from.
// A finger picks up after a 400 ms hold; the browser's own swipe and scroll keep the touch when it moves first (they
// send pointercancel).
// Following the pointer never rebuilds the list or reads all rows: one scroll step, one position and one hit test per
// frame (NFR1, BUG-010).
export function createDrag({ list, template, groups, canStart, onStart, onEnd }) {
  const part = (sel) => template.content.querySelector(sel).cloneNode(true);
  const html = document.documentElement;
  let s = null; // the press, then the drag
  let frame = 0;

  // The only scroll lock: touch-action stays as it is, so the swipe and the page scroll keep their feel. The hold left
  // the first move cancelable, so blocking it while a drag runs keeps the page still under the finger (R32).
  list.addEventListener("touchmove", (e) => { if (s?.dragging) e.preventDefault(); }, { passive: false });

  list.addEventListener("pointerdown", (e) => {
    if (s || !e.isPrimary || e.button !== 0) return;
    const row = e.target.closest(".task");
    if (!row || row.matches(".task--exit, .task--editing") || e.target.closest(SKIP)) return;
    const ac = new AbortController();
    s = { row, ac, id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY,
      hadFocus: list.contains(document.activeElement), dragging: false, touch: e.pointerType === "touch" }; // focus read before the browser moves it (R22)
    const on = (target, type, fn) => target.addEventListener(type, fn, { capture: true, signal: ac.signal });
    on(window, "pointermove", move);
    // A second finger during the hold is a pinch or a two finger scroll, never a pick up. Once lifted it changes nothing.
    on(window, "pointerdown", (e) => { if (s.touch && !s.dragging && e.pointerId !== s.id) end(null); });
    on(window, "pointerup", (e) => { if (e.pointerId === s.id) release(e); });
    on(window, "pointercancel", (e) => { if (e.pointerId === s.id) end(null); });
    on(window, "blur", (e) => { if (e.target === window) end(null); }); // capture also sees every element blur
    on(document, "visibilitychange", () => { if (document.hidden) end(null); });
    on(window, "keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!s.dragging) return end(null); // a press or a hold ends quietly; the Escape goes on to whatever it was for
      e.preventDefault();
      e.stopImmediatePropagation(); // the Escape cancels the drag only, never an edit, a dialog or a field (R18)
      end(null);
    });
    // No long press menu or word selection on a phone, from the press on; a mouse keeps its own until the drag (R7).
    for (const type of ["contextmenu", "selectstart"]) on(document, type, (e) => { if (s.dragging || s.touch) e.preventDefault(); });
    on(document, "dragstart", (e) => e.preventDefault()); // a selected text would start the native drag instead
    on(window, "scroll", () => { if (s.dragging) frame ||= requestAnimationFrame(follow); }); // a wheel moves the targets
    // A resize or a rotation keeps the drag: the screen and the strip are measured again, so the slip stays inside
    // them. A phone's address bar showing or hiding fires resize too, and must not end a drag (decisions.md, T7).
    on(window, "resize", () => { if (s.dragging) { measure(); frame ||= requestAnimationFrame(follow); } });
    if (s.touch) {
      row.classList.add("task--pressing");
      s.timer = setTimeout(() => {
        row.classList.remove("task--pressing");
        if (canStart()) pickUp(); else end(null); // the touch goes on as today (R5, R35)
      }, HOLD);
    }
  });

  function move(e) {
    if (e.pointerId !== s.id) return;
    s.x = e.clientX;
    s.y = e.clientY;
    if (s.dragging) {
      frame ||= requestAnimationFrame(follow);
    } else if (s.touch) {
      if (Math.hypot(s.x - s.x0, s.y - s.y0) > TOUCH_SLOP) end(null); // the swipe or the scroll has it (R3)
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
    s.to = document.createElement("span"); // the target's name on the slip's corner, never colour alone (R28)
    s.to.className = "drag-slip__to sticker";
    // Only a real selection is cleared: clearing the caret of the focused add field scrolls the page to the top.
    const sel = getSelection();
    if (sel && !sel.isCollapsed) sel.removeAllRanges();
    // A finger lifts the task where it is, and the strip may appear right under it: no target until the finger moves
    // past the slop, so a lift in place is always a cancel (BUG-018).
    if (s.touch) s.still = [s.x, s.y];
    // Captured on the slip, not the row: the browser keeps :hover on the capturing element, and the placeholder
    // must not show the row hover wash.
    // A finger is already held by its row, and moving the capture off it would hand the touch back to the scroller.
    if (!s.touch) {
      try { slip.setPointerCapture(s.id); } catch { /* a synthetic event has no active pointer */ }
      slip.addEventListener("lostpointercapture", () => end(null), { signal: s.ac.signal });
    }
    // Measured once: the slip's text lands on the line's text and keeps the grab point under the pointer (R27).
    const r = row.querySelector(".task__text").getBoundingClientRect();
    s.dx = r.left - text.offsetLeft - s.x0;
    s.dy = row.getBoundingClientRect().top - s.y0;
    s.edge = part(".drag-edge");
    measure();
    follow();
  }

  // The screen and the strip, at pick up and on every resize.
  // The slip rides on the strip's top edge, never over it, so the label under the pointer stays readable
  // (hover-strip.html). offsetTop: the strip's place without its entry animation.
  function measure() {
    s.maxX = html.clientWidth - s.slip.offsetWidth - 8;
    s.h = s.slip.offsetHeight;
    s.stripTop = s.strip.offsetTop;
    s.maxY = Math.min(html.clientHeight, s.stripTop) - s.h;
  }

  // One frame: an auto scroll step, the slip, the hit test. The loop goes on only while a step really moved the page,
  // so it stops when the pointer leaves the zone, at the page ends and (through end) when the drag ends (R31).
  function follow() {
    frame = 0;
    if (!s?.slip) return;
    if (document.querySelector("dialog[open]")) return end(null); // a dialog opened under the drag (R20)
    const v = held() ? 0 : scrollSpeed(s.y, s.stripTop);
    const top = scrollY;
    if (v) scrollBy(0, v);
    const scrolled = scrollY !== top;
    cue(scrolled ? v : 0);
    const x = Math.max(8, Math.min(s.x + s.dx, s.maxX));
    const y = Math.max(0, Math.min(s.touch ? s.y - ABOVE - s.h : s.y + s.dy, s.maxY));
    // left and top, not transform or translate: the CSS rotate would turn a transform's offset (BUG-016), and the
    // pick-up keyframes animate translate. The slip is fixed and out of flow, so this lays out the slip only.
    s.slip.style.left = `${x}px`;
    s.slip.style.top = `${y}px`;
    hit(); // after the step, so a section the scroll brings under a still pointer is the target
    if (scrolled) frame = requestAnimationFrame(follow);
  }

  // The cue band: under the screen top, or right on the strip's top edge. The stylesheet turns the chevron up.
  function cue(v) {
    const { edge } = s;
    if (!v) return edge.remove();
    edge.classList.toggle("drag-edge--up", v < 0);
    edge.classList.toggle("drag-edge--down", v > 0);
    edge.style.top = v > 0 ? `${s.stripTop - EDGE}px` : "";
    if (!edge.isConnected) document.body.append(edge);
  }

  // A lifted finger that has not left its lift point by more than the slop neither marks a target nor scrolls, so a
  // lift in place is always a cancel and never runs the page away (BUG-018).
  function held() {
    if (s.still && Math.hypot(s.x - s.still[0], s.y - s.still[1]) > TOUCH_SLOP) s.still = null;
    return !!s.still;
  }

  // The target under the pointer: a strip label, else a visible section (header, rows or its space, open or folded).
  // The own group is no target (R12). Classes change only when the target does; hovering never unfolds (R14).
  function hit() {
    if (held()) return;
    const el = document.elementFromPoint(s.x, s.y); // the slip is pointer-events: none
    let over = el?.closest(".drop-target[data-key]") ?? el?.closest("#day-list > .group");
    if (over?.dataset.key === s.key) over = null;
    if (over === s.over) return;
    s.over?.classList.remove("group--drop", "drop-target--over");
    s.over = over;
    if (!over) return s.to.remove();
    over.classList.add(over.matches(".group") ? "group--drop" : "drop-target--over");
    const g = groups().get(over.dataset.key);
    s.to.dataset.color = g?.color ?? "none";
    s.to.textContent = g?.name ?? UNGROUPED_NAME;
    s.slip.append(s.to);
  }

  function release(e) {
    if (!s.dragging || document.querySelector("dialog[open]")) return end(null);
    s.x = e.clientX;
    s.y = e.clientY;
    // The click that follows the release never ticks, opens or follows anything (R7).
    const swallow = (e) => { e.preventDefault(); e.stopImmediatePropagation(); };
    window.addEventListener("click", swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener("click", swallow, true));
    hit(); // at the release point itself, not the last frame's
    end(s.over?.dataset.key ?? null);
  }

  // Every exit runs this; each step is safe to repeat, so nothing is ever left on the page (NFR4).
  function end(key) {
    if (!s) return;
    const { row, ac, dragging, hadFocus, slip, strip, edge, over, timer, key: home } = s;
    s = null;
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    frame = 0;
    ac.abort();
    html.classList.remove("is-dragging");
    row.classList.remove("task--placeholder", "task--pressing");
    over?.classList.remove("group--drop", "drop-target--over");
    slip?.remove();
    strip?.remove();
    edge?.remove();
    if (dragging) onEnd(row, key, hadFocus, home); // home: the group read at pick up, even if the row has gone since
  }

  return { cancel: () => end(null), active: () => !!s?.dragging };
}
