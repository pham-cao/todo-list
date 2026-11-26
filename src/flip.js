import { daysBetween } from "./date.js?v=1.5.0";
import { PageFlip } from "../vendor/page-flip/page-flip.module.js?v=1.5.0";

// Leaves for a move of `days` calendar days (sign ignored): 0 for 0, 1, 2, then 3 for 3 or more (R3).
// null (an invalid key) gives 0, so no stage is built.
export const leafCount = (days) => Math.min(Math.abs(days ?? 0), 3);

const div = (className) => {
  const el = document.createElement("div");
  el.className = className;
  return el;
};

// The page flip (R1 to R12): a purely visual layer over the sheet, built after the new day has rendered and removed by
// a timer or the library's end of turn (R9). It is aria-hidden, inert and ignores the pointer (R11). The curl is drawn
// by the vendored StPageFlip library (R8 as amended, owner 2026-11-13).
// sheet: .sheet (the stage's positioned parent and what is copied: the header and the body, R8), body: .sheet__body
// (the rows; its size changes as they lay out).
// The flip always plays, also under prefers-reduced-motion (owner decision 2026-11-12; R28, R29 as amended).
//
// Library internals used (not in its documented API; check them when upgrading vendor/page-flip):
// getRender().drawFrame (wrapped, to punch after each frame, and called when a turn starts), getRender().animation, setBottomPage(null),
// setFlippingPage(null), clearShadow(), getFlipController().reset(), setState("read"), getCalculation(),
// book.isUserTouch, getPageCollection().getPages()[i].getElement(), the clear page's inline clipPath (polygon) and
// transform (translate3d), and the patched getRender().pfWake(), pfSleep(), pfLoop and pfRunning.
export function createFlip({ sheet, body }) {
  const CAN_3D = CSS.supports("transform", "rotateY(1deg)") && CSS.supports("perspective", "1px");
  const CAN_CURL = CAN_3D && CSS.supports("clip-path", "polygon(evenodd, 0 0, 1px 0, 0 1px)"); // R39: punch() needs it
  const allowed = () => CAN_CURL && !document.hidden && !document.querySelector("dialog[open]"); // R7; group-header R23: never behind a dialog
  const ms = (name) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
  let stage = null;
  let timer = 0;
  let follow = null; // the ResizeObserver that keeps the stage on the page while it lives

  // A copy of the whole sheet as it is now, the header and then the body down to the first row whose top is below the
  // window (R8, NFR3). Rows above the window stay, so --flip-offset still lines the copy up with the page. A Range
  // clones only that part: no row below the cut is ever cloned, and the rows' ancestors come along as shallow copies
  // holding the rows before it. At copy time the sheet holds only the header and the body (no stage, no drag slip).
  // Cloned inputs keep value and checked state (the picker keeps its day); a cloned select does not, so its value is
  // copied over. Every id goes, so no lookup, label or aria reference ever finds a leaf node; every label's `for` goes,
  // so a leaf label never names a real control; aria-live and role go, so the copied date line, summary and slips can
  // never announce (R11, R19, R20). progress--celebrate goes, so the stamp never replays on the leaf.
  // Each copied row is as tall as its row is laid out now (fit). Rows use content-visibility: auto, and a clone has no
  // remembered size, so left alone every copied row would be a one rule placeholder and the copy would drift off the
  // page, with the rows meant for the window laid out elsewhere and never painted (R13).
  function copy() {
    const range = document.createRange();
    range.selectNodeContents(sheet);
    // One layout for all the reads. A row not yet laid out sits at its one rule placeholder, which is never taller than
    // the row, so the cut can only fall later than the real one, never cut a row the window shows.
    const cut = [...body.querySelectorAll(".task")].find((t) => t.getBoundingClientRect().top >= innerHeight);
    if (cut) range.setEndBefore(cut);
    const part = range.cloneContents();
    const from = sheet.querySelectorAll("select");
    part.querySelectorAll("select").forEach((s, i) => { s.value = from[i].value; }); // the copy's selects are a prefix
    fit(body, part)();
    for (const el of part.querySelectorAll("[id], [for], [aria-live], [role]")) {
      for (const a of ["id", "for", "aria-live", "role"]) el.removeAttribute(a);
    }
    for (const el of part.querySelectorAll(".progress--celebrate")) el.classList.remove("progress--celebrate");
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

  // Puts the stage over the part of the sheet that is in the window; false when under 1 px of it is (R13).
  // --flip-top (the stage top) and --flip-offset (how much of the sheet is above the window) hold the same value; the
  // CSS uses the first for the stage and its holes and the second for the copy and its rules.
  function place(s) {
    const sr = sheet.getBoundingClientRect();
    const top = Math.max(sr.top, 0), bottom = Math.min(sr.bottom, innerHeight); // only the part in the window
    if (bottom - top < 1) return false;
    s.style.setProperty("--flip-top", `${top - sr.top}px`);
    s.style.setProperty("--flip-h", `${bottom - top}px`);
    s.style.setProperty("--flip-offset", `${top - sr.top}px`);
    return true;
  }

  // StPageFlip draws each turn. A riffle (R3: 1, 2 or 3 pages) is a stack of books, one per page, each turning one
  // page, started --dur-riffle-step apart, because one book turns one page at a time. Books are pooled for the session
  // (at most 3) and reused, because each book has its own frame loop and listeners (NFR4).
  // Each book holds [front, clear]: the front is the page that turns and the clear page is what the turn uncovers. The
  // library still draws the whole front under the turn and expects an opaque page over the uncovered part; here the
  // front is cut along that part instead (punch), so the uncovered part is see-through and the next page down shows,
  // already turning. Forward, top to bottom: the old day, then blank ruled pages, over the real new day. Back, top to
  // bottom: the new day, blank pages, over a copy of the old day; they start curled away and uncurl, the lowest first.
  const host = div("flip-stage flip-stage--curl");
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  const pool = []; // { wrap, book }
  let lastBook = null; // the book whose end ends the stage: the last one to start
  let run = 0; // bumped by end(); the stage node is reused, so frame callbacks of an earlier move check this instead

  // Cuts the uncovered part out of the front page, after the library has drawn a frame. The clear page's clip polygon is
  // in its own box, which the library moves with translate3d (and rotates by 0 for the uncovered page).
  function punch(book) {
    const [front, under] = book.getPageCollection().getPages().map((p) => p.getElement());
    const clip = under.style.clipPath;
    if (book.getCurrentPageIndex() !== 0 || under.style.display === "none" || !clip.startsWith("polygon")) return;
    const [, dx = 0, dy = 0] = /translate3d\(([-\d.e]+)px, ([-\d.e]+)px/.exec(under.style.transform) ?? [];
    const pts = clip.slice(clip.indexOf("(") + 1, -1).split(",").map((p) => {
      const [x, y] = p.trim().split(/\s+/).map(parseFloat);
      return `${x + +dx}px ${y + +dy}px`;
    });
    const { width: w, height: h } = front.style;
    front.style.clipPath = `polygon(evenodd, 0 0, ${w} 0, ${w} ${h}, 0 ${h}, 0 0, ${pts.join(", ")}, ${pts[0]})`;
  }

  function bookAt(i, settings, pages) {
    if (!pool[i]) {
      const wrap = div("flip-layer"), el = div("flip-book");
      wrap.append(el);
      host.append(wrap);
      let book;
      try {
        book = new PageFlip(el, settings);
        book.loadFromHTML(pages);
        // loadFromHTML fixes the block's min size to this first stage; the books are reused for stages of other
        // sizes, and the library centres the page in its block, so a stale min size moves the page off the stage
        // (BUG-029).
        el.style.minWidth = el.style.minHeight = "";
        const r = book.getRender(), draw = r.drawFrame.bind(r), loop = r.pfLoop;
        r.pfSleep(); // no frame loop until drive() wakes it (NFR4; patch 2 in the vendored module)
        r.drawFrame = () => {
          draw();
          try { punch(book); } catch { end(); }
        };
        // A throw in the library's frame stops its loop with pfRunning still set, so pfWake() would never restart it.
        r.pfLoop = (t) => {
          try { loop(t); } catch { r.pfRunning = false; end(); }
        };
        book.on("changeState", (e) => { if (e.data === "read" && stage && book === lastBook) end(); });
      } catch (err) {
        // A book that failed half way is never pooled; its loop, if it started, stops after its next frame.
        try {
          const r = book?.getRender();
          r?.pfSleep();
          if (r) r.pfRunning = false;
          window.removeEventListener("resize", book?.ui?.onResize); // the library's UI adds it when it is made
        } catch { /* nothing more to stop */ }
        wrap.remove();
        throw err; // play() ends the stage
      }
      pool[i] = { wrap, book };
    } else {
      Object.assign(pool[i].book.getSettings(), settings);
      pool[i].book.updateFromHtml(pages);
    }
    return pool[i];
  }

  // Drops a turn cut short (a new move, a dialog, a hidden tab), so the book starts clean next time. The library has no
  // public cancel.
  function quiet({ book }) {
    const r = book.getRender(), fc = book.getFlipController();
    r.animation = null;
    r.setBottomPage(null);
    r.setFlippingPage(null);
    r.clearShadow();
    fc.reset();
    fc.setState("read");
    book.isUserTouch = false;
  }

  // Removes the stage and clears the timer at once; all pages go together (R9, R14, R37).
  function end() {
    run++;
    clearTimeout(timer);
    follow?.disconnect();
    follow = null;
    stage?.remove();
    stage = null;
    // Each book on its own, so one that throws cannot keep the others awake or let the throw out of play().
    for (const b of pool) {
      try { quiet(b); } catch { /* the book is reset on its next turn */ }
      try { b.book.getRender().pfSleep(); } catch { /* no loop to stop */ } // the loop stops after its next frame
    }
  }

  // Before the new day renders: the old page, which forward curls away and back is curled over.
  const snapshot = (from, to) => (from !== to && allowed() ? copy() : null);

  // kind "front" is the page that turns; the library turns a clone of it, drawn as the back of the sheet (CSS).
  const leaf = (nodes, kind) => {
    const el = div(nodes ? `leaf leaf--${kind}` : `leaf leaf--blank leaf--${kind}`);
    if (nodes) {
      const c = div("leaf__content");
      c.append(...nodes);
      el.append(c);
    }
    return el;
  };

  // One turn, drawn as if a hand pulled the top corner: flipNext() slides the corner along the top edge, which keeps the
  // fold nearly upright. Here the corner dips down as it travels left, so the fold runs diagonally and the lower corner
  // lags behind (owner's reference photo). Forward runs the path out and the library finishes the turn past the left
  // edge (userStop). Back runs the same path home: the page starts curled away and uncurls flat.
  // Points are in block coordinates: the page spans x 0 to w.
  function drive({ wrap, book }, w, h, span, back, delay) {
    const dip = 0.4 * Math.min(w, h);
    const at = (t) => ({ x: w - 2 - t * 1.85 * w, y: 2 + Math.sin(Math.PI * t) * dip });
    const r = run;
    let t0 = 0;
    if (back) wrap.style.visibility = "hidden"; // a back page lies flat until its turn starts, so it waits unseen
    const step = (now) => { try { stepAt(now); } catch { end(); } };
    const stepAt = (now) => {
      if (run !== r) return;
      t0 ||= now + delay;
      if (now < t0) return requestAnimationFrame(step);
      if (wrap.style.visibility) wrap.style.visibility = "";
      const begin = !book.isUserTouch && !book.getFlipController().getCalculation();
      if (begin) {
        // The library takes the direction from the first fold point, so the fold always starts at the right edge (a
        // forward turn); back then jumps to the far end of the path in the same frame, before anything is painted.
        book.getRender().pfWake();
        book.startUserTouch(at(0));
        book.userMove(at(0.03), true);
      }
      const p = Math.min(1, (now - t0) / span), e = p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) ** 2; // ease in and out
      const t = back ? 1 - e : e;
      book.userMove(at(t), true);
      // The turn's first move makes the clone that is drawn as the back of the sheet, a copy of the whole front page.
      // The library draws in its own frame callback, which may already have run this frame, so the clone would show
      // unclipped over the whole page for one frame (a blank flash); this frame is drawn here instead.
      if (begin) book.getRender().drawFrame();
      if (p < 1) requestAnimationFrame(step);
      else book.userStop(at(t)); // forward: past the left edge, so it turns; back: at the corner, so it settles flat
    };
    requestAnimationFrame(step);
  }

  // After the new day renders. Never throws: the day change has already happened, and a failure leaves the settled page.
  function play(from, to, page) {
    end();
    const n = leafCount(daysBetween(from, to));
    if (from === to || !allowed() || !page || !n) return;
    try {
      const back = to < from; // keys are YYYY-MM-DD, so they compare as text (R5)
      host.classList.toggle("flip-stage--back", back);
      if (!place(host)) return;
      // Top to bottom: forward the old day then blanks; back the new day then blanks (both copied with the rows' sizes).
      const fronts = [leaf(back ? copy() : page, "front"), ...Array.from({ length: n - 1 }, () => leaf(null, "front"))];
      host.replaceChildren();
      if (back) host.append(leaf(page, "base")); // the old day, under the pages that fall back onto it
      sheet.append(host);
      stage = host;
      const w = host.clientWidth, h = host.clientHeight;
      const dur = ms("--dur-flip") || 700, gap = ms("--dur-riffle-step") || 125;
      // Forward: 85% of dur draws the corner nearly across (so no flat strip lingers) and the library animates the last
      // 0.15 w of points; it runs one point per pixel and shortens a run below 1000 points, which this undoes. Back: the
      // whole dur is the path.
      const span = back ? dur : 0.85 * dur;
      const settings = {
        width: w, height: h, size: "fixed", autoSize: false, usePortrait: true, showCover: false,
        flippingTime: ((dur - span || 50) * 1000) / Math.min(1000, 0.15 * w), drawShadow: true, maxShadowOpacity: 0.55,
        useMouseEvents: false, mobileScrollSupport: false, startPage: 0,
      };
      // Books go in bottom first, so the top page is last in the stage. Forward the top page turns first; back the
      // lowest page falls first and the new day lands last, on top.
      for (let k = n - 1; k >= 0; k--) {
        const layer = bookAt(k, settings, [fronts[k], div("leaf--clear")]);
        // The library measures its block lazily and centres the page in it, so a stage that grows before the first
        // frame (rows laying out) would push the page down by half the growth. The block keeps this move's height.
        layer.wrap.firstElementChild.style.height = `${h}px`;
        host.append(layer.wrap);
        layer.book.update();
        layer.book.turnToPage(0);
        // A pooled book draws nothing while its loop sleeps, and its pages are hidden until drawn, so a forward page
        // waiting for its turn would let the new day show through; it is drawn settled once here. A back page waits
        // unseen anyway (drive).
        if (!back) layer.book.getRender().drawFrame();
        const delay = (back ? n - 1 - k : k) * gap;
        if (delay === (n - 1) * gap) lastBook = layer.book;
        drive(layer, w, h, span, back, delay);
      }
      // The new rows are one rule placeholders until the browser lays out the ones near the window (content-visibility:
      // auto), which also moves the window back from a clamped scroll; that can take more than one frame. The stage
      // was placed from this task's layout, so after each layout, before paint, it is put back on the page as the
      // page now is, and a back copy (the new page) takes the rows' new heights (R13, NFR1: no row is laid out here).
      follow = new ResizeObserver(() => {
        try {
          const size = back ? fit(body, fronts[0]) : null; // reads, then place reads and writes
          place(host);
          size?.();
        } catch {
          end();
        }
      });
      follow.observe(body);
      // The turns start in the first frame after the stage is drawn, which can come late after a heavy render, so the
      // end timer starts there too and never cuts the last part (BUG-028). Until that frame a backstop twice as long
      // stands in, so a frame that never comes still leaves no page (R9). The last book's "read" ends it earlier.
      const life = dur + (n - 1) * gap + 17;
      timer = setTimeout(end, 2 * life);
      const r = run;
      requestAnimationFrame(() => {
        if (run !== r) return;
        clearTimeout(timer);
        timer = setTimeout(end, life);
      });
    } catch {
      end();
    }
  }

  // Registered once, never per move (NFR4).
  document.addEventListener("visibilitychange", () => { if (document.hidden) end(); }); // R7, R38
  document.addEventListener("toggle", (e) => { if (e.newState === "open") end(); }, true); // a dialog or popover opened (R37)

  return { snapshot, play, end };
}
