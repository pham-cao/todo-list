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

  // A copy of the sheet body as it is now. Cloned inputs keep value and checked state; a cloned select does not, so
  // its value is copied over. Every id goes, so no lookup, label or aria reference ever finds a leaf node (R11).
  // ponytail: copies every row; T8 trims rows below the window (NFR3).
  function copy() {
    return [...body.children].map((node) => {
      const clone = node.cloneNode(true);
      const from = node.querySelectorAll("select");
      clone.querySelectorAll("select").forEach((s, i) => { s.value = from[i].value; });
      clone.removeAttribute("id");
      for (const el of clone.querySelectorAll("[id]")) el.removeAttribute("id");
      return clone;
    });
  }

  // Removes the stage and clears the timer at once; all leaves go together (R9, R14, R37).
  function end() {
    clearTimeout(timer);
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
      const sr = sheet.getBoundingClientRect(), br = body.getBoundingClientRect();
      const top = Math.max(br.top, 0), bottom = Math.min(br.bottom, innerHeight); // only the part in the window
      if (!n || bottom - top < 1) return;
      const back = to < from; // keys are YYYY-MM-DD, so they compare as text (R5)
      const content = back ? copy() : page; // forward shows the old page leaving, back the new one landing (R4)
      if (!content) return;
      const s = div(back ? "flip-stage flip-stage--back" : "flip-stage");
      s.setAttribute("aria-hidden", "true");
      s.inert = true;
      s.style.setProperty("--flip-top", `${top - sr.top}px`);
      s.style.setProperty("--flip-h", `${bottom - top}px`);
      s.style.setProperty("--flip-offset", `${top - br.top}px`);
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
      timer = setTimeout(end, ms("--dur-flip") + (n - 1) * ms("--dur-riffle-step") + 17);
    } catch {
      end();
    }
  }

  // Registered once, never per move (NFR4).
  reduced.addEventListener("change", () => { if (reduced.matches) end(); }); // R29
  document.addEventListener("visibilitychange", () => { if (document.hidden) end(); }); // R7, R38
  document.addEventListener("toggle", (e) => { if (e.newState === "open") end(); }, true); // a dialog or popover opened (R37)
  const unstick = (e) => { if (e.target === date) date.classList.remove("washi--restick"); };
  date.addEventListener("animationend", unstick);
  date.addEventListener("animationcancel", unstick);

  return { snapshot, play, end };
}
