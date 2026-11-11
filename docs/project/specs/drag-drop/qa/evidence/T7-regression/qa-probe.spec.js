import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { open, task, group, rows, storedJson, finger, passMidnight, longPressDrag, mouseDrag, KEY, GROUPS_KEY, UI_KEY } from '/home/gem/src/todo_list/tests/e2e/helpers.js';

const EV = '/home/gem/src/todo_list/docs/project/specs/drag-drop/qa/evidence/';
const GROUPS = [group('cty', 'Công ty', 'yellow', 1), group('nha', 'Nhà', 'pink', 2), group('sk', 'Sức khỏe', 'blue', 3), group('hoc', 'Học', 'green', 4)];
const TOMORROW = '2026-11-10';
const TASKS = [
  { ...task('a', 'Gửi báo cáo', true, undefined, 10), groupId: 'cty' },
  { ...task('b', 'Trả lời email', false, undefined, 20), groupId: 'cty' },
  { ...task('c', 'Tiền điện', false, undefined, 30), groupId: 'nha' },
  task('d', 'Cắt tóc', false, undefined, 40),
  { ...task('n', 'Việc ngày mai', false, TOMORROW, 50), groupId: 'cty' },
  ...Array.from({ length: 20 }, (_, i) => ({ ...task(`f${i}`, `Việc thêm ${i + 1}`, false, undefined, 100 + i), groupId: 'sk' })),
];
const row = (page, t) => rows(page).filter({ has: page.getByText(t, { exact: true }) });
const strip = (page) => page.getByRole('group', { name: 'Thả vào nhóm' });
const target = (page, n) => strip(page).locator('.drop-target').filter({ hasText: n });
const raw = (page) => page.evaluate((ks) => ks.map((k) => localStorage.getItem(k)), [KEY, GROUPS_KEY, UI_KEY]);
const LEFT = '.drag-slip, .drop-strip, .drag-edge, .task--placeholder, .task--pressing, .group--drop, .drop-target--over, html.is-dragging';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((NOP) => {
    localStorage.setItem('daily-todo:swipe-hint-seen', '1');
    // pending rAF, active listeners on window and document, announcements
    const pend = new Set(); const raf = window.requestAnimationFrame.bind(window); const caf = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { const id = raf((t) => { pend.delete(id); cb(t); }); pend.add(id); return id; };
    window.cancelAnimationFrame = (id) => { pend.delete(id); caf(id); };
    window.__raf = () => pend.size;
    const act = new Set(); const ids = new WeakMap(); let n = 0;
    const fid = (f) => { if (!ids.has(f)) ids.set(f, ++n); return ids.get(f); };
    const nm = (t) => (t === window ? 'w' : t === document ? 'd' : null);
    const cap = (o) => (typeof o === 'boolean' ? o : !!o?.capture);
    if (!location.search.includes('x') && !window.__NOPATCH) {}
    const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
    if (!NOP) EventTarget.prototype.addEventListener = function (type, fn, o) {
      const t = nm(this);
      if (t && fn) { const k = `${t}|${type}|${cap(o)}|${fid(fn)}`; if (!o?.once) { act.add(k); if (o?.signal) o.signal.addEventListener('abort', () => act.delete(k)); } }
      return add.call(this, type, fn, o);
    };
    if (!NOP) EventTarget.prototype.removeEventListener = function (type, fn, o) { const t = nm(this); if (t && fn) act.delete(`${t}|${type}|${cap(o)}|${fid(fn)}`); return rem.call(this, type, fn, o); };
    window.__lsn = () => [...act].sort();
    window.addEventListener('pointerdown', (e) => { window.__pid = e.pointerId; }, true);
    window.said = [];
    document.addEventListener('DOMContentLoaded', () => new MutationObserver(() => { const t = document.getElementById('sr-status').textContent; if (t) window.said.push(t); })
      .observe(document.getElementById('sr-status'), { childList: true, characterData: true, subtree: true }));
    window.blocked = 0;
    window.addEventListener('touchmove', (e) => { if (e.defaultPrevented) window.blocked++; }, { passive: true });
  }, !!process.env.NOP);
});

const results = {};
test.afterEach(async ({ page }, ti) => {
  const id = ti.title.split(' ')[0];
  const dir = EV + id + '/';
  fs.mkdirSync(dir, { recursive: true });
  const slug = ti.title.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 90);
  fs.writeFileSync(`${dir}${ti.project.name}-${slug}.json`, JSON.stringify({ title: ti.title, project: ti.project.name, status: ti.status, ...results[ti.title] }, null, 1));
  await page.screenshot({ path: `${dir}${ti.project.name}-${slug}.png` }).catch(() => {});
});

const setup = async (page, o = {}) => {
  await page.clock.setFixedTime(new Date('2026-11-09T09:00:00+07:00'));
  await open(page, o.tasks ?? TASKS, '', { groups: o.groups ?? GROUPS });
  await page.waitForSelector('.task');
};
const snapshot = (page) => page.evaluate(() => ({ raf: window.__raf(), lsn: window.__lsn(), scrollY }));
const focusDesc = (page) => page.evaluate(() => { const a = document.activeElement; return a === document.body ? 'body' : `${a.tagName}${a.id ? '#' + a.id : ''}${a.dataset?.action ? '[' + a.dataset.action + ']' : ''}${a.closest?.('.task') ? ' in ' + a.closest('.task').querySelector('.task__label')?.textContent : ''}`; });

// start a drag of `text` (mouse or touch). returns { f, pt }.
async function lift(page, kind, text, dy = 80) {
  if (kind === 'mouse') { const pt = await mouseDrag(page, row(page, text), 0, dy); return { pt }; }
  await page.evaluate(() => scrollTo(0, 0));
  await row(page, text).scrollIntoViewIfNeeded();
  const f = await longPressDrag(page, row(page, text), null, { release: false });
  await f.move(f.at()[0], f.at()[1] + 40);
  return { f };
}
const release = async (page, kind, d) => { if (kind === 'mouse') await page.mouse.up(); else if (d.f && !d.f.done) await d.f.up().catch(() => {}); };

// after an interruption: the checks
async function checks(page, kind, base, before, expectGroup, extra = {}) {
  const p = [];
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const n = await page.locator(LEFT).count();
  if (n) p.push(`leftovers ${n}: ${await page.locator(LEFT).evaluateAll((els) => els.map((e) => e.className || e.tagName))}`);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const s = await snapshot(page);
  if (s.raf > base.raf) p.push(`rAF pending ${s.raf} > baseline ${base.raf}`);
  const extraL = s.lsn.filter((k) => !base.lsn.includes(k));
  if (extraL.length) p.push(`listeners left: ${extraL.join(', ')}`);
  const html = await page.evaluate(() => document.documentElement.className);
  if (/dragging/.test(html)) p.push('html class ' + html);
  const said = await page.evaluate(() => window.said);
  const want = `Đã hủy. Việc vẫn ở nhóm "${expectGroup}".`;
  if (said.filter(Boolean).length !== 1 || said.at(-1) !== want) p.push(`announce ${JSON.stringify(said)} want once ${want}`);
  if (extra.keysSame !== false) { const after = await raw(page); if (JSON.stringify(after) !== JSON.stringify(before)) p.push('storage changed'); }
  return { p, said, focus: await focusDesc(page), scrollY: s.scrollY };
}

async function nextDragWorks(page, kind, text = 'Cắt tóc', to = 'Nhà') {
  await page.evaluate(() => { window.said = []; });
  const id = await row(page, text).getAttribute('data-id');
  const d = await lift(page, kind, text, 20);
  const t = await target(page, to).boundingBox();
  const x = t.x + t.width / 2, y = t.y + t.height / 2;
  if (kind === 'mouse') { await page.mouse.move(x, y, { steps: 4 }); await page.mouse.up(); }
  else { await d.f.move(x, y); await d.f.up(); }
  await expect(page.locator(LEFT)).toHaveCount(0);
  const g = (await storedJson(page, KEY)).find((x) => x.id === id).groupId;
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const said = (await page.evaluate(() => window.said)).filter(Boolean);
  return { ok: g === 'nha' && said.length === 1 && /^Đã chuyển việc/.test(said[0]), g, said };
}

async function touchScrolls(page) {
  await page.evaluate(() => { window.blocked = 0; scrollTo(0, 0); });
  const b = await rows(page).first().locator('.task__label').boundingBox();
  const g = await finger(page);
  await g.down(b.x + 20, b.y + b.height / 2); await g.move(b.x + 20, b.y + b.height / 2 - 300, 10); await g.up();
  await page.waitForTimeout(200);
  return { scrolled: await page.evaluate(() => scrollY), blocked: await page.evaluate(() => window.blocked) };
}

const hide = (page) => page.evaluate(() => {
  for (const [k, v] of [['hidden', true], ['visibilityState', 'hidden']]) Object.defineProperty(document, k, { value: v, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  delete document.hidden; delete document.visibilityState;
});
const storageEv = (key, val) => (page) => page.evaluate(([k, v]) => { if (v != null) localStorage.setItem(k, v); window.dispatchEvent(new StorageEvent('storage', { key: k })); }, [key, val]);

const INTERRUPTS = [
  ['T7-03 hidden', (p) => hide(p)],
  ['T7-04 blur', (p) => p.evaluate(() => window.dispatchEvent(new Event('blur')))],
  ['T7-05 back', async (p) => { await p.goBack(); }, { dayChange: true, pre: async (p) => { await p.locator('#prev-day').click(); await p.locator('#next-day').click(); } }],
  ['T7-05 picker', (p) => p.locator('#day-picker').fill('2026-11-08'), { dayChange: true }],
  ['T7-05 arrow next', (p) => p.locator('#next-day').evaluate((b) => b.click()), { dayChange: true }],
  ['T7-05 arrow prev', (p) => p.locator('#prev-day').evaluate((b) => b.click()), { dayChange: true }],
  ['T7-06 midnight focus', (p) => passMidnight(p, 'focus'), { dayChange: true, next: 'Việc ngày mai' }],
  ['T7-06 midnight visibilitychange', (p) => passMidnight(p, 'visibilitychange'), { dayChange: true, next: 'Việc ngày mai' }],
  ['T7-07 groups changed', storageEv(GROUPS_KEY, JSON.stringify([...GROUPS, group('x', 'Mới', 'blue', 9)])), { keysChange: true }],
  ['T7-12 tasks key', storageEv(KEY)],
  ['T7-12 ui key', storageEv(UI_KEY)],
  ['T7-07 storage clear (key null)', (p) => p.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: null }))), {}],
  ['T7-08 dialog', async (p, kind) => { await p.evaluate(() => document.getElementById('delete-dialog').showModal()); await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); }, { dialog: true }],
  ['T7-02 pointercancel', (p, kind) => p.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.__pid, bubbles: true }))), { mouseOnly: true }],
  ['T7-02 lostpointercapture', (p) => p.evaluate(() => { document.querySelector('.drag-slip').releasePointerCapture(window.__pid); }), { mouseOnly: true }],
  ['T7-01 touchCancel', (p, kind, d) => d.f.cancel(), { touchOnly: true }],
  ['T7-00 noop', async () => {}, { noop: true }],
  ['T7-08 dialog then move', async (p, kind, d) => { await p.evaluate(() => document.getElementById('delete-dialog').showModal()); if (kind === 'mouse') await p.mouse.move(300, 400, { steps: 2 }); else await d.f.move(d.f.at()[0], d.f.at()[1] + 30, 2); }, { dialog: true }],
  ['T7-09 resize-no-cancel', null],
];

for (const [name, run, o = {}] of INTERRUPTS) {
  if (!run) continue;
  test(`${name} ${'mouse'}`, async ({ page, isMobile }) => {
    test.skip(isMobile || o.touchOnly, 'mouse');
    await interruption(page, 'mouse', name, run, o);
  });
  test(`${name} ${'touch'}`, async ({ page, isMobile }) => {
    test.skip(!isMobile || o.mouseOnly, 'touch');
    await interruption(page, 'touch', name, run, o);
  });
}

async function interruption(page, kind, name, run, o) {
  test.setTimeout(70000);
  const T = test.info().title; results[T] = {};
  await setup(page);
  if (o.pre) await o.pre(page);
  const base = await snapshot(page);
  const before = await raw(page);
  const d = await lift(page, kind, 'Trả lời email');
  expect(await page.evaluate(() => document.documentElement.classList.contains('is-dragging'))).toBe(true);
  const during = await snapshot(page);
  await page.screenshot({ path: `${EV}${name.split(' ')[0]}/${test.info().project.name}-${name.replace(/ /g, '_')}-during.png` }).catch(() => {});
  await run(page, kind, d);
  const c = await checks(page, kind, base, before, 'Công ty', { keysSame: !o.keysChange });
  if (o.keysChange) { const a = await raw(page); if (a[0] !== before[0] || a[2] !== before[2]) c.p.push('tasks or ui key changed'); }
  results[T] = { during: { listeners: during.lsn.length - base.lsn.length, raf: during.raf }, ...c };
  if (o.dialog) { // dialog stays open: release is a cancel; then close
    await release(page, kind, d);
    await page.evaluate(() => document.getElementById('delete-dialog').close());
  } else await release(page, kind, d);
  if (kind === 'mouse') { /* pointerup after the end must do nothing */ }
  const after = await raw(page);
  if (!o.keysChange && JSON.stringify(after) !== JSON.stringify(before)) c.p.push('storage changed after release');
  if (o.dayChange) {
    if (name.includes('back')) await page.goForward();
    else if (name.includes('picker')) await page.locator('#day-picker').fill('2026-11-09');
    else if (name.includes('next')) await page.locator('#prev-day').evaluate((b) => b.click());
    else if (name.includes('prev')) await page.locator('#next-day').evaluate((b) => b.click());
    await page.waitForTimeout(300);
  }
  if (kind === 'touch' && !process.env.NOSCROLL) { results[T].scroll = await touchScrolls(page); if (results[T].scroll.scrolled < 100 && !name.includes('midnight')) c.p.push('page did not scroll after cancel'); if (results[T].scroll.blocked) c.p.push('touchmove still blocked ' + results[T].scroll.blocked); }
  if (o.dayChange && !name.includes('back')) { await page.locator(`#next-day`).count(); }
  const nx = await nextDragWorks(page, kind, o.next ?? 'Cắt tóc', 'Nhà').catch((e) => ({ ok: false, err: String(e).slice(0, 200) }));
  results[T].next = nx; if (!nx.ok) c.p.push('next drag failed ' + JSON.stringify(nx));
  const al = await Promise.race([page.evaluate(() => 1).then(() => 'alive'), new Promise((r) => setTimeout(() => r('hung'), 6000))]);
  if (al === 'hung') { const cdp = await page.context().newCDPSession(page); await cdp.send('Debugger.enable'); const paused = new Promise((r) => cdp.on('Debugger.paused', r)); await cdp.send('Debugger.pause'); const ev = await Promise.race([paused, new Promise((r) => setTimeout(() => r(null), 5000))]); results[T].hangStack = ev ? ev.callFrames.slice(0, 8).map((c) => `${c.functionName} ${c.url.split('/').pop()}:${c.location.lineNumber + 1}`) : 'no pause'; console.log('PROBE HUNG', JSON.stringify(results[T].hangStack)); }
  const fin = await snapshot(page); const extraL = fin.lsn.filter((k) => !base.lsn.includes(k));
  if (extraL.length) c.p.push('listeners after next drag: ' + extraL);
  results[T].problems = c.p;
  expect(c.p).toEqual([]);
}

// ---------- extra probes ----------
const frames = (page, n = 2) => page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const kinds = (isMobile) => (isMobile ? 'touch' : 'mouse');
const mv = async (page, kind, d, x, y) => (kind === 'mouse' ? page.mouse.move(x, y, { steps: 4 }) : d.f.move(x, y, 4));

for (const mode of ['mouse', 'touch']) {
  test(`T7-16 resize and rotation keep the drag and the slip inside ${mode}`, async ({ page, isMobile }) => {
    test.setTimeout(70000); test.skip(kinds(isMobile) !== mode); const T = test.info().title; results[T] = {};
    await setup(page); const before = await raw(page);
    const d = await lift(page, mode, 'Trả lời email', 60);
    const out = [];
    for (const [w, h] of mode === 'mouse' ? [[800, 560], [1100, 400], [1280, 720]] : [[915, 412], [360, 640], [412, 839]]) {
      await page.setViewportSize({ width: w, height: h }); await frames(page, 3);
      await mv(page, mode, d, w - 5, h - 5); await frames(page, 2);
      const st = await page.evaluate(() => { const s = document.querySelector('.drag-slip'), t = document.querySelector('.drop-strip'); return s && t ? { right: s.offsetLeft + s.offsetWidth, cw: document.documentElement.clientWidth, bottom: s.offsetTop + s.offsetHeight, stripTop: t.offsetTop, ch: document.documentElement.clientHeight, dragging: document.documentElement.classList.contains('is-dragging') } : { dragging: false }; });
      out.push({ w, h, ...st });
    }
    results[T].sizes = out;
    for (const o of out) { expect(o.dragging).toBe(true); expect(o.right).toBeLessThanOrEqual(o.cw); expect(o.bottom).toBeLessThanOrEqual(Math.min(o.stripTop, o.ch) + 1); }
    if (mode === 'mouse') await page.mouse.up(); else await d.f.up();
    await frames(page, 2);
    const said = await page.evaluate(() => window.said);
    results[T].said = said; expect(await page.locator(LEFT).count()).toBe(0); expect(said.length).toBe(1);
    expect(JSON.stringify(await raw(page))).toBe(JSON.stringify(before));
    const nx = await nextDragWorks(page, mode); results[T].next = nx; expect(nx.ok).toBe(true);
  });

  for (const grp of ['cty', 'hoc']) test(`T7-17 keyboard add during a drag into ${grp === 'cty' ? 'a group with a section' : 'a group without a section'} ${mode}`, async ({ page, isMobile }) => {
    test.setTimeout(70000); test.skip(kinds(isMobile) !== mode); const T = test.info().title; results[T] = {};
    await setup(page); const base = await snapshot(page); const before = await storedJson(page, KEY);
    await page.locator('#new-task-group').selectOption(grp);
    const d = await lift(page, mode, 'Trả lời email', 60);
    await page.locator('#new-task').focus(); await page.keyboard.type('Đi bộ'); await page.keyboard.press('Enter');
    await frames(page, 3);
    const c = await checks(page, mode, base, null, 'Công ty', { keysSame: false }); results[T] = c;
    const after = await storedJson(page, KEY);
    if (JSON.stringify(after.slice(0, before.length)) !== JSON.stringify(before) || after.length !== before.length + 1 || after.at(-1).text !== 'Đi bộ' || after.at(-1).groupId !== grp) c.p.push('storage: only the new task expected');
    if (mode === 'mouse') await page.mouse.up(); else await d.f.up();
    await frames(page, 2); results[T].rowStill = await row(page, 'Trả lời email').count();
    if (results[T].rowStill !== 1) c.p.push('row missing');
    if (mode === 'touch') { results[T].scroll = await touchScrolls(page); if (results[T].scroll.blocked) c.p.push('touchmove blocked after'); }
    const nx = await nextDragWorks(page, mode); results[T].next = nx; if (!nx.ok) c.p.push('next drag failed');
    expect(c.p).toEqual([]);
  });

  test(`T7-18 interruption during auto scroll leaves no frame loop ${mode}`, async ({ page, isMobile }) => {
    test.setTimeout(150000); test.skip(kinds(isMobile) !== mode); const T = test.info().title; results[T] = { cases: {} };
    const cases = { hidden: hide, blur: (p) => p.evaluate(() => window.dispatchEvent(new Event('blur'))), escape: (p) => p.keyboard.press('Escape'), groups: storageEv(GROUPS_KEY, JSON.stringify([...GROUPS, group('x', 'Mới', 'blue', 9)])), tasks: storageEv(KEY), day: (p) => p.locator('#next-day').evaluate((b) => b.click()), midnight: (p) => passMidnight(p, 'focus'), dialog: (p) => p.evaluate(() => document.getElementById('delete-dialog').showModal()), cancel: (p, k, d) => d.f.cancel(), pointercancel: (p) => p.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: window.__pid, bubbles: true }))) };
    const probs = [];
    for (const [name, run] of Object.entries(cases)) {
      if ((name === 'cancel' && mode === 'mouse')) continue;
      await setup(page); const base = await snapshot(page);
      const d = await lift(page, mode, 'Trả lời email', 20);
      const st = await page.locator('.drop-strip').boundingBox(); const y = st.y - 20; const x = mode === 'mouse' ? 300 : 200;
      await mv(page, mode, d, x, y);
      await page.waitForTimeout(500);
      const s1 = await page.evaluate(() => scrollY);
      const scrolling = s1 > 0;
      await run(page, mode, d); await page.waitForTimeout(150);
      const s2 = await page.evaluate(() => scrollY); await page.waitForTimeout(400); const s3 = await page.evaluate(() => scrollY);
      await frames(page, 3); const sn = await snapshot(page); const left = await page.locator(LEFT).count();
      const rec = { scrollingBefore: s1, scrollAfterRun: s2, scrollLater: s3, raf: sn.raf, baseRaf: base.raf, left };
      results[T].cases[name] = rec;
      if (!scrolling) probs.push(`${name}: auto scroll never started`);
      if (s3 !== s2 && name !== 'dialog') probs.push(`${name}: page kept scrolling ${s2}->${s3}`);
      if (sn.raf > base.raf) probs.push(`${name}: rAF ${sn.raf}`);
      if (left && name !== 'dialog') probs.push(`${name}: leftovers ${left}`);
      if (name === 'dialog') { // dialog: ends at the next frame (the loop is running here)
        if (left) probs.push(`dialog under auto scroll: leftovers ${left}`);
        await page.evaluate(() => document.getElementById('delete-dialog').close());
      }
      if (mode === 'mouse') await page.mouse.up(); else if (name !== 'cancel') await d.f.up().catch(() => {});
    }
    results[T].problems = probs; expect(probs).toEqual([]);
  });
}

test('T7-11 focus follows the rules on a cancel mouse and touch', async ({ page, isMobile }) => {
  test.setTimeout(70000); const mode = kinds(isMobile); const T = test.info().title; results[T] = {};
  const run = async (label, prep, interrupt) => {
    await setup(page); await prep();
    const d = await lift(page, mode, 'Trả lời email', 60);
    await interrupt(d); await frames(page, 3);
    results[T][label] = await focusDesc(page);
    if (mode === 'mouse') await page.mouse.up(); else await d.f.up().catch(() => {});
  };
  const focusEdit = () => row(page, 'Gửi báo cáo').locator('[data-action="edit"]').focus();
  const focusAdd = () => page.locator('#new-task').focus();
  await run('list-focus, hidden', focusEdit, () => hide(page));
  await run('list-focus, blur', focusEdit, () => page.evaluate(() => window.dispatchEvent(new Event('blur'))));
  await run('list-focus, groups storage', focusEdit, () => storageEv(GROUPS_KEY, JSON.stringify(GROUPS))(page));
  await run('list-focus, tasks storage', focusEdit, () => storageEv(KEY)(page));
  await run('list-focus, Escape', focusEdit, () => page.keyboard.press('Escape'));
  await run('add-field focus, hidden', focusAdd, () => hide(page));
  await run('add-field focus, storage groups', focusAdd, () => storageEv(GROUPS_KEY, JSON.stringify(GROUPS))(page));
  await run('no focus, hidden', async () => {}, () => hide(page));
  await run('list-focus, day change', focusEdit, () => page.locator('#next-day').evaluate((b) => b.click()));
  const r = results[T];
  expect(r['list-focus, hidden']).toBe('BUTTON[edit] in Trả lời email');
  expect(r['list-focus, blur']).toBe('BUTTON[edit] in Trả lời email');
  expect(r['list-focus, groups storage']).toBe('BUTTON[edit] in Trả lời email');
  expect(r['list-focus, tasks storage']).toBe('BUTTON[edit] in Trả lời email');
  expect(r['list-focus, Escape']).toBe('BUTTON[edit] in Trả lời email');
});

test('T7-19 group renamed or deleted in another tab: the cancel names the group read at pick up', async ({ page, isMobile }) => {
  test.setTimeout(70000); const mode = kinds(isMobile); const T = test.info().title; results[T] = {};
  const cases = { renamed: GROUPS.map((g) => (g.id === 'cty' ? { ...g, name: 'Công ty mới' } : g)), deleted: GROUPS.filter((g) => g.id !== 'cty') };
  for (const [k, gs] of Object.entries(cases)) {
    await setup(page);
    const d = await lift(page, mode, 'Trả lời email', 60);
    await storageEv(GROUPS_KEY, JSON.stringify(gs))(page); await frames(page, 4);
    results[T][k] = { said: await page.evaluate(() => window.said), left: await page.locator(LEFT).count(), strip: null };
    if (mode === 'mouse') await page.mouse.up(); else await d.f.up().catch(() => {});
  }
  for (const k of Object.keys(cases)) { expect(results[T][k].left).toBe(0); expect(results[T][k].said).toEqual(['Đã hủy. Việc vẫn ở nhóm "Công ty".']); }
});

test('T7-10 repeated cancels are idempotent: no double announcement, no exception', async ({ page, isMobile }) => {
  test.setTimeout(70000); const mode = kinds(isMobile); const T = test.info().title; results[T] = {};
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await setup(page); const before = await raw(page);
  const d = await lift(page, mode, 'Trả lời email', 60);
  await hide(page); await hide(page);
  await page.evaluate(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('blur')); });
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await storageEv(KEY)(page); await storageEv(KEY)(page);
  await frames(page, 3);
  if (mode === 'mouse') { await page.mouse.up(); await page.mouse.up(); } else await d.f.up().catch(() => {});
  await frames(page, 3);
  results[T] = { said: await page.evaluate(() => window.said), errs, left: await page.locator(LEFT).count() };
  expect(errs).toEqual([]); expect(results[T].said).toEqual(['Đã hủy. Việc vẫn ở nhóm "Công ty".']); expect(results[T].left).toBe(0);
  expect(JSON.stringify(await raw(page))).toBe(JSON.stringify(before));
  // an Escape after the end still reaches its field (clears nothing of ours): typed text stays, Escape does nothing to the page
  const nx = await nextDragWorks(page, mode); results[T].next = nx; expect(nx.ok).toBe(true);
});

test('T7-14 early touch press then Escape or blur never starts a drag later', async ({ page, isMobile }) => {
  test.skip(!isMobile); test.setTimeout(70000); const T = test.info().title; results[T] = {};
  for (const how of ['escape', 'blur', 'hidden']) {
    await setup(page);
    await page.evaluate(() => scrollTo(0, 0));
    const b = await row(page, 'Trả lời email').locator('.task__label').boundingBox();
    const f = await finger(page); await f.down(b.x + 40, b.y + b.height / 2); await page.waitForTimeout(150);
    const pressing = await page.locator('.task--pressing').count();
    if (how === 'escape') await page.keyboard.press('Escape'); else if (how === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur'))); else await hide(page);
    await page.waitForTimeout(700);
    results[T][how] = { pressingBefore: pressing, dragging: await page.evaluate(() => document.documentElement.classList.contains('is-dragging')), left: await page.locator(LEFT).count() };
    await f.up().catch(() => {});
  }
  expect(results[T].blur.dragging).toBe(false); expect(results[T].blur.left).toBe(0);
  expect(results[T].hidden.dragging).toBe(false); expect(results[T].hidden.left).toBe(0);
  // Escape before the lift: the press has no Escape rule (only a lifted drag does); the lift may still follow. Recorded.
});

test('T7-13 after a touchCancel the page swipes and scrolls normally', async ({ page, isMobile }) => {
  test.skip(!isMobile); test.setTimeout(70000); const T = test.info().title; results[T] = {};
  await setup(page);
  const d = await lift(page, 'touch', 'Trả lời email', 60);
  await d.f.cancel(); await frames(page, 2);
  results[T].scroll = await touchScrolls(page);
  // swipe a row open (the strip must still react): drag a fresh row's label sideways
  const sw = row(page, 'Cắt tóc'); await page.evaluate(() => scrollTo(0, 0)); await sw.scrollIntoViewIfNeeded();
  const b = await sw.locator('.task__label').boundingBox(); const g = await finger(page);
  await g.down(b.x + b.width - 10, b.y + b.height / 2); await g.move(b.x + 20, b.y + b.height / 2, 10); await g.up(); await page.waitForTimeout(400);
  results[T].swiped = await page.evaluate(() => { const s = [...document.querySelectorAll('.task')].find((r) => r.textContent.includes('Cắt tóc')).querySelector('.task__swipe, .task__row, [class*="swipe"]'); return s ? Math.round(s.scrollLeft) : null; });
  results[T].blockedMoves = await page.evaluate(() => window.blocked);
  expect(results[T].scroll.scrolled).toBeGreaterThan(100); expect(results[T].scroll.blocked).toBe(0);
});

test('T7-15 chaos: rapid mixed actions leave no stuck state mouse', async ({ page, isMobile }) => {
  test.skip(isMobile); test.setTimeout(300000); const T = test.info().title; results[T] = { steps: 0, violations: [] };
  const errs = []; page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await setup(page); const base = await snapshot(page);
  let seed = 12345; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const names = ['Trả lời email', 'Cắt tóc', 'Tiền điện', 'Gửi báo cáo'];
  let down = false;
  const acts = [
    async () => { if (down) { await page.mouse.up(); down = false; } const r = row(page, names[rnd(4)]); if (await r.count()) { await mouseDrag(page, r, 0, 30 + rnd(60)); down = true; } },
    async () => { await page.keyboard.press('Escape'); },
    async () => { if (down) { const t = await strip(page).locator('.drop-target').nth(rnd(4)).boundingBox().catch(() => null); if (t) await page.mouse.move(t.x + 20, t.y + 10, { steps: 3 }); await page.mouse.up(); down = false; } },
    async () => { await hide(page); },
    async () => { await page.evaluate(() => window.dispatchEvent(new Event('blur'))); },
    async () => { await storageEv([KEY, GROUPS_KEY, UI_KEY][rnd(3)])(page); },
    async () => { await page.locator(rnd(2) ? '#next-day' : '#prev-day').evaluate((b) => b.click()); },
    async () => { await page.locator('#day-picker').fill(['2026-11-09', '2026-11-10', '2026-11-08'][rnd(3)]); },
    async () => { await page.goBack().catch(() => {}); },
    async () => { await page.goForward().catch(() => {}); },
    async () => { await passMidnight(page, rnd(2) ? 'focus' : 'visibilitychange'); },
  ];
  const t0 = Date.now();
  while (Date.now() - t0 < 150000) {
    await acts[rnd(acts.length)]().catch((e) => { results[T].violations.push({ step: results[T].steps, actionError: String(e).slice(0, 150) }); }); results[T].steps++;
    if (rnd(4) === 0) {
      if (down) { await page.mouse.up(); down = false; }
      if (!(await page.evaluate(() => !!window.__raf).catch(() => false))) { await page.goto('./'); await page.waitForSelector('.task'); }
      await frames(page, 3);
      const left = await page.locator(LEFT).count(); const raf = (await snapshot(page)).raf;
      if (left || raf > base.raf) results[T].violations.push({ step: results[T].steps, left, raf });
      const j = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('daily-todo:tasks:v1')).length; } catch { return -1; } });
      if (j !== TASKS.length) results[T].violations.push({ step: results[T].steps, tasks: j });
    }
  }
  if (down) await page.mouse.up();
  await page.goto('./#' + '2026-11-09'); results[T].errs = errs;
  await frames(page, 3);
  expect(results[T].violations).toEqual([]); expect(errs).toEqual([]);
});
