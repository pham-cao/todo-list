import { daysBetween } from "./date.js?v=1.3.0";

// Leaves for a move of `days` calendar days (sign ignored): 0 for 0, 1, 2, then 3 for 3 or more (R3).
// null (an invalid key) gives 0, so no stage is built.
export const leafCount = (days) => Math.min(Math.abs(days ?? 0), 3);

const div = (className) => {
  const el = document.createElement("div");
  el.className = className;
  return el;
};

// The page flip (R1 to R12): a purely visual layer of leaves on the sheet, built after the new day has rendered and
// removed by a timer, never by animationend (R9). It is aria-hidden, inert and ignores the pointer (R11).
// sheet: .sheet (the stage's positioned parent), body: .sheet__body (what is copied), date: #date-line (the tape).
export function createFlip({ sheet, body, date }) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const CAN_3D = CSS.supports("transform", "rotateY(1deg)") && CSS.supports("perspective", "1px"); // R39
  const allowed = () => !reduced.matches && CAN_3D && !document.hidden; // R7, R28
  const ms = (name) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  let stage = null;
  let timer = 0;
  let follow = null; // the ResizeObserver that keeps the stage on the page while it lives

  // A copy of the sheet body as it is now, down to the first row whose top is below the window (NFR3). Rows above the
  // window stay, so --flip-offset still lines the copy up with the page. A Range clones only that part: no row below
  // the cut is ever cloned, and the rows' ancestors come along as shallow copies holding the rows before it.
  // Cloned inputs keep value and checked state; a cloned select does not, so its value is copied over. Every id goes,
  // so no lookup, label or aria reference ever finds a leaf node, and every label's `for` goes, so a leaf label never
  // names a real control on the page (R11, R20).
  // Each copied row is as tall as its row is laid out now (fit). Rows use content-visibility: auto, and a clone has no
  // remembered size, so left alone every copied row would be a one rule placeholder and the copy would drift off the
  // page, with the rows meant for the window laid out elsewhere and never painted (R13).
  function copy() {
    const range = document.createRange();
    range.selectNodeContents(body);
    // One layout for all the reads. A row not yet laid out sits at its one rule placeholder, which is never taller than
    // the row, so the cut can only fall later than the real one, never cut a row the window shows.
    const cut = [...body.querySelectorAll(".task")].find((t) => t.getBoundingClientRect().top >= innerHeight);
    if (cut) range.setEndBefore(cut);
    const part = range.cloneContents();
    const from = body.querySelectorAll("select");
    part.querySelectorAll("select").forEach((s, i) => { s.value = from[i].value; }); // the copy's selects are a prefix
    fit(body, part)();
    for (const el of part.querySelectorAll("[id], [for]")) { el.removeAttribute("id"); el.removeAttribute("for"); }
    return [...part.childNodes];
  }

  // Reads the height of the first .task rows under `from`, as many as `copied` holds, and returns the writes that give
  // each copied row its height, so a caller can do every read before any write: one layout.
  function fit(from, copied) {
    const rows = copied.querySelectorAll(".task"), real = [...from.querySelectorAll(".task")].slice(0, rows.length);
    if (real.length !== rows.length) return () => {};
    const tall = real.map((t) => t.offsetHeight);
    return () => rows.forEach((t, i) => { t.style.height = `${tall[i]}px`; });
  }

  // Puts the stage over the part of the sheet body that is in the window; false when under 1 px of it is.
  function place(s) {
    const sr = sheet.getBoundingClientRect(), br = body.getBoundingClientRect();
    const top = Math.max(br.top, 0), bottom = Math.min(br.bottom, innerHeight); // only the part in the window
    if (bottom - top < 1) return false;
    s.style.setProperty("--flip-top", `${top - sr.top}px`);
    s.style.setProperty("--flip-h", `${bottom - top}px`);
    s.style.setProperty("--flip-offset", `${top - br.top}px`);
    return true;
  }

  // Removes the stage and clears the timer at once; all leaves go together (R9, R14, R37).
  function end() {
    clearTimeout(timer);
    follow?.disconnect();
    follow = null;
    stage?.remove();
    stage = null;
  }

  // Before the new day renders: the old page, which a forward leaf carries away. Back flips copy the new page in play().
  const snapshot = (from, to) => (to > from && allowed() ? copy() : null);

  // After the new day renders. Never throws: the day change has already happened, and a failure leaves the settled page.
  function play(from, to, page) {
    end();
    if (from === to || !allowed()) return;
    try {
      // The tape is pressed once per move, even with the sheet body scrolled away (R12).
      date.classList.remove("washi--restick");
      void date.offsetWidth;
      date.classList.add("washi--restick");
      const n = leafCount(daysBetween(from, to));
      if (!n) return;
      const back = to < from; // keys are YYYY-MM-DD, so they compare as text (R5)
      const s = div(back ? "flip-stage flip-stage--back" : "flip-stage");
      if (!place(s)) return;
      const content = back ? copy() : page; // forward shows the old page leaving, back the new one landing (R4)
      if (!content) return;
      s.setAttribute("aria-hidden", "true");
      s.inert = true;
      for (let k = 0; k < n; k++) {
        const withText = k === n - 1; // the leaf with text is always on top
        const i = back ? k : n - 1 - k; // forward: it goes first; back: it lands last
        const cast = div("leaf-cast");
        const leaf = div(withText ? "leaf" : "leaf leaf--blank");
        cast.style.setProperty("--i", i);
        leaf.style.setProperty("--i", i);
        if (withText) {
          const c = div("leaf__content");
          c.append(...content);
          leaf.append(c);
        }
        leaf.append(div("leaf__back"), div("leaf__shade"));
        s.append(cast, leaf);
      }
      sheet.append(s);
      stage = s;
      // The new rows are one rule placeholders until the browser lays out the ones near the window (content-visibility:
      // auto), which also moves the window back from a clamped scroll; that can take more than one frame. The stage
      // was placed from this task's layout, so after each layout, before paint, it is put back on the page as the
      // page now is, and a back copy (the new page) takes the rows' new heights (R13, NFR1: no row is laid out here).
      follow = new ResizeObserver(() => {
        try {
          const size = back ? fit(body, s.querySelector(".leaf__content")) : null; // reads, then place reads and writes
          place(s);
          size?.();
        } catch {
          end();
        }
      });
      follow.observe(body);
      // The animations start in the first frame that draws the stage, which can come late after a heavy render, so the
      // end timer starts there too and never cuts the last part of the turn (BUG-028). Until that frame a backstop
      // twice as long stands in, so a frame that never comes still leaves no leaf (R9).
      const life = ms("--dur-flip") + (n - 1) * ms("--dur-riffle-step") + 17;
      timer = setTimeout(end, 2 * life);
      requestAnimationFrame(() => {
        if (stage !== s) return;
        clearTimeout(timer);
        timer = setTimeout(end, life);
      });
    } catch {
      end();
    }
  }

  // Registered once, never per move (NFR4).
  // R29: under reduced motion the tape's animation is none, so no animationend would ever take its class off.
  reduced.addEventListener("change", () => { if (reduced.matches) { end(); date.classList.remove("washi--restick"); } });
  document.addEventListener("visibilitychange", () => { if (document.hidden) end(); }); // R7, R38
  document.addEventListener("toggle", (e) => { if (e.newState === "open") end(); }, true); // a dialog or popover opened (R37)
  const unstick = (e) => { if (e.target === date) date.classList.remove("washi--restick"); };
  date.addEventListener("animationend", unstick);
  date.addEventListener("animationcancel", unstick);

  return { snapshot, play, end };
}
