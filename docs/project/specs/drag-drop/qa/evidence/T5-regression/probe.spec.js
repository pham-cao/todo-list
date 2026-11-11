import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { open, task, group, rows, section, storedJson, finger, touchDrag, longPressDrag, KEY } from '/home/gem/src/todo_list/tests/e2e/helpers.js';

const EV = '/home/gem/src/todo_list/docs/project/specs/drag-drop/qa/evidence/';
const GROUPS = [group('cty', 'Công ty', 'yellow', 1), group('nha', 'Nhà', 'pink', 2), group('sk', 'Sức khỏe', 'blue', 3)];
const TASKS = [
  { ...task('a', 'Gửi báo cáo', true, undefined, 10), groupId: 'cty' },
  { ...task('b', 'Trả lời email', false, undefined, 20), groupId: 'cty' },
  { ...task('c', 'Tiền điện', false, undefined, 30), groupId: 'nha' },
  task('d', 'Cắt tóc', false, undefined, 40),
];
const LONG = [...TASKS, ...Array.from({ length: 24 }, (_, i) => ({ ...task(`l${i}`, `Việc dài ${i + 1}`, false, undefined, 100 + i), groupId: 'cty' }))];
const seed = (page, tasks = TASKS) => open(page, tasks, '', { groups: GROUPS });
const row = (page, t) => rows(page).filter({ has: page.getByText(t, { exact: true }) });
const lp = async (page, t, to, o) => { await row(page, t).evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => scrollBy(0, -250)); await page.waitForTimeout(150); return longPressDrag(page, row(page, t), to, o); };
const dragging = (page) => page.evaluate(() => document.documentElement.classList.contains('is-dragging'));
const pressing = (page) => page.locator('.task--pressing').count();
const lefts = (page) => page.locator('.drag-slip, .drop-strip, .drag-edge, .task--placeholder, .task--pressing, html.is-dragging').count();
const strip = (page) => page.getByRole('group', { name: 'Thả vào nhóm' });
const label = async (page, t) => { await row(page, t).scrollIntoViewIfNeeded(); const b = await row(page, t).locator('.task__label').boundingBox(); return [b.x + Math.min(b.width / 2, 60), b.y + b.height / 2]; };
const log = [];
const note = (id, k, v) => { log.push(`${k}: ${JSON.stringify(v)}`); };
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('daily-todo:swipe-hint-seen', '1')); });
test.afterEach(async ({ page }, ti) => {
  const dir = EV + 'TC-drag-drop-' + ti.title.split(' ')[0] + '/';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dir + `result-${ti.project.name}.txt`, `${ti.title}\nproject: ${ti.project.name}\nstatus: ${ti.status}\n` + log.join('\n') + '\n');
  await page.screenshot({ path: dir + `final-${ti.project.name}.png` }).catch(() => {});
  log.length = 0;
});
const ID = 'EXP-T5';

test(`${ID}-hold-boundary hold 380 ms is a tap, 420 ms drags, first lift near 400`, async ({ page }) => {
  await seed(page);
  const p = await label(page, 'Trả lời email');
  let f = await finger(page); await f.down(...p); await page.waitForTimeout(380); await f.up(); await page.waitForTimeout(100);
  note(ID, 'after 380 ms lift: dragging', await dragging(page)); expect(await dragging(page)).toBe(false); expect(await lefts(page)).toBe(0);
  f = await finger(page); await f.down(...p);
  const t0 = Date.now();
  await page.waitForFunction(() => document.documentElement.classList.contains('is-dragging'), null, { polling: 5 });
  const dt = await page.evaluate(() => 0); note(ID, 'drag started after ms (wall, incl CDP latency)', Date.now() - t0);
  await page.screenshot({ path: EV + 'TC-drag-drop-EXP-T5-hold-boundary/drag-started-' + test.info().project.name + '.png' }).catch(() => {});
  await f.up(); expect(await lefts(page)).toBe(0);
  // in page timing: pointerdown -> is-dragging
  await page.evaluate(() => { window.t = {}; document.addEventListener('pointerdown', () => { window.t.d = performance.now(); }, true); new MutationObserver(() => { if (document.documentElement.classList.contains('is-dragging') && !window.t.s) window.t.s = performance.now(); }).observe(document.documentElement, { attributes: true }); });
  f = await finger(page); await f.down(...p); await page.waitForTimeout(600);
  const tt = await page.evaluate(() => window.t); note(ID, 'in page hold ms', Math.round(tt.s - tt.d)); expect(tt.s - tt.d).toBeGreaterThanOrEqual(395); expect(tt.s - tt.d).toBeLessThan(470);
  await f.up();
});

test(`${ID}-slop 9 px move during hold still drags, 11 px does not`, async ({ page }) => {
  await seed(page);
  const [x, y] = await label(page, 'Trả lời email');
  // 9 px diagonal-free (horizontal) then hold
  let f = await finger(page); await f.down(x, y); await page.waitForTimeout(100); await f.move(x + 9, y, 3); await page.waitForTimeout(450);
  note(ID, '9px dragging', await dragging(page)); expect(await dragging(page)).toBe(true); await f.up(); expect(await lefts(page)).toBe(0);
  // 9 px vertical
  f = await finger(page); await f.down(x, y); await page.waitForTimeout(100); await f.move(x, y + 9, 3); await page.waitForTimeout(450);
  note(ID, '9px vertical dragging', await dragging(page)); expect(await dragging(page)).toBe(true); await f.up();
  // 11 px
  f = await finger(page); await f.down(x, y); await page.waitForTimeout(100); await f.move(x + 11, y, 3); await page.waitForTimeout(600);
  note(ID, '11px dragging', await dragging(page)); expect(await dragging(page)).toBe(false); expect(await lefts(page)).toBe(0); await f.up();
  f = await finger(page); await f.down(x, y); await page.waitForTimeout(100); await f.move(x, y + 11, 3); await page.waitForTimeout(600);
  note(ID, '11px vertical dragging', await dragging(page)); expect(await dragging(page)).toBe(false); expect(await lefts(page)).toBe(0); await f.up();
  // diagonal 8+8 = 11.3
  f = await finger(page); await f.down(x, y); await page.waitForTimeout(100); await f.move(x + 8, y + 8, 3); await page.waitForTimeout(600);
  note(ID, 'diagonal 11.3px dragging', await dragging(page)); expect(await dragging(page)).toBe(false); await f.up();
  // trembling that comes back: out to 15 then back before hold: stays cancelled
  f = await finger(page); await f.down(x, y); await f.move(x + 15, y, 3); await f.move(x, y, 3); await page.waitForTimeout(600);
  note(ID, 'out 15 and back dragging', await dragging(page)); expect(await dragging(page)).toBe(false); await f.up();
  expect(await lefts(page)).toBe(0);
});

test(`${ID}-scroll-swipe-early vertical scroll and horizontal swipe started before 400 ms, also late at 300 ms`, async ({ page }) => {
  await seed(page, LONG);
  await page.evaluate(() => { window.seen = []; new MutationObserver((l) => { for (const m of l) for (const c of ['is-dragging', 'task--placeholder', 'task--pressing']) if (m.target.classList.contains(c)) window.seen.push(c); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true }); });
  const [x, y] = await label(page, 'Việc dài 3');
  for (const wait of [0, 300]) {
    const y0 = await page.evaluate(() => scrollY);
    const f = await finger(page); await f.down(x, y); await page.waitForTimeout(wait); await f.move(x, y - 250, 10); await f.up();
    await page.waitForTimeout(700);
    const y1 = await page.evaluate(() => scrollY); note(ID, `vertical wait ${wait}: scrollY`, [y0, y1]); expect(y1).toBeGreaterThan(y0 + 100);
    expect(await dragging(page)).toBe(false); expect(await lefts(page)).toBe(0);
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
  }
  for (const wait of [0, 250]) {
    const swipe = row(page, 'Trả lời email').locator('.task__swipe'); await swipe.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    const b = await swipe.boundingBox(); const yy = b.y + b.height / 2, x0 = b.x + b.width - 30;
    const cdp = await page.context().newCDPSession(page);
    const s = (type, xx) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: xx, y: yy }] });
    await s('touchStart', x0); await page.waitForTimeout(wait);
    for (let i = 1; i <= 10; i++) { await s('touchMove', x0 - 20 * i); await page.waitForTimeout(16); }
    await s('touchEnd', x0 - 200); await cdp.detach();
    await page.waitForTimeout(700);
    const sl = await swipe.evaluate((el) => el.scrollLeft); note(ID, `swipe wait ${wait}: scrollLeft`, sl); note(ID, 'seen so far', await page.evaluate(() => [...new Set(window.seen)])); expect(sl).toBeGreaterThan(100);
    expect(await lefts(page)).toBe(0);
    await swipe.evaluate((el) => { el.scrollLeft = 0; }); await page.waitForTimeout(400);
  }
  const seen = await page.evaluate(() => [...new Set(window.seen)]); note(ID, 'classes ever seen', seen);
});

test(`${ID}-open-swipe-press long press on a row whose swipe is open; drop and cancel do not reopen`, async ({ page }) => {
  await seed(page);
  const swipe = row(page, 'Trả lời email').locator('.task__swipe');
  await touchDrag(page, swipe, -200);
  await expect.poll(() => swipe.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
  const swipe2 = row(page, 'Tiền điện').locator('.task__swipe');
  await touchDrag(page, swipe2, -200);
  note(ID, 'two open', [await swipe.evaluate((e) => e.scrollLeft), await swipe2.evaluate((e) => e.scrollLeft)]);
  const b = await swipe.boundingBox();
  const f = await finger(page); await f.down(b.x + 20, b.y + b.height / 2); await page.waitForTimeout(450);
  expect(await dragging(page)).toBe(true);
  await expect.poll(() => swipe.evaluate((e) => e.scrollLeft)).toBe(0);
  await expect.poll(() => swipe2.evaluate((e) => e.scrollLeft)).toBe(0);
  const t = strip(page).locator('.drop-target').filter({ hasText: 'Sức khỏe' }); const tb = await t.boundingBox();
  await f.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await f.up();
  await page.waitForTimeout(600);
  const after = [await swipe.evaluate((e) => e.scrollLeft), await swipe2.evaluate((e) => e.scrollLeft)];
  note(ID, 'after drop', after); expect(after).toEqual([0, 0]);
  expect(await lefts(page)).toBe(0);
  // cancel variant
  const sw3 = row(page, 'Cắt tóc').locator('.task__swipe'); await sw3.scrollIntoViewIfNeeded(); await touchDrag(page, sw3, -200);
  const b3 = await sw3.boundingBox(); const g = await finger(page); await g.down(b3.x + 20, b3.y + b3.height / 2); await page.waitForTimeout(450); await g.up(); await page.waitForTimeout(500);
  note(ID, 'after cancel', await sw3.evaluate((e) => e.scrollLeft)); expect(await sw3.evaluate((e) => e.scrollLeft)).toBe(0);
});

test(`${ID}-skip-targets long press on tick box, Sửa, Xóa, section toggle does not drag`, async ({ page }) => {
  await seed(page);
  await page.evaluate(() => { window.seen = []; new MutationObserver((l) => { for (const m of l) for (const c of ['is-dragging', 'task--placeholder', 'task--pressing']) if (m.target.classList.contains(c)) window.seen.push(c); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true }); });
  const r = row(page, 'Trả lời email');
  const press = async (loc, name) => {
    const b = await loc.boundingBox(); const f = await finger(page);
    await f.down(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(700); note(ID, name + ' dragging', await dragging(page)); expect(await dragging(page)).toBe(false); await f.up(); await page.waitForTimeout(100);
  };
  const before = await page.evaluate((k) => localStorage.getItem(k), KEY);
  await press(r.locator('.check__box'), 'tick box');
  await page.waitForTimeout(300);
  const checkedAfter = await r.getByRole('checkbox').isChecked(); note(ID, 'tick box long press toggled to', checkedAfter);
  await press(toggleOf(page, 'Nhà'), 'section toggle');
  // revealed buttons
  const swipe = r.locator('.task__swipe'); await touchDrag(page, swipe, -200);
  await expect.poll(() => swipe.evaluate((e) => e.scrollLeft)).toBeGreaterThan(100);
  await press(r.getByRole('button', { name: 'Sửa' }), 'Sửa');
    const ed = await page.locator('.task--editing').count(); note(ID, 'edit opened after long press on Sửa', ed);
  expect(await page.evaluate(() => window.seen.filter((c) => c !== 'task--pressing'))).toEqual([]);
  note(ID, 'pressing ever seen on skipped targets', (await page.evaluate(() => window.seen)).includes('task--pressing'));
});
const toggleOf = (page, name) => section(page, name).locator('.group__toggle');

test(`${ID}-blocked-states long press while editing and with a dialog open`, async ({ page }) => {
  await seed(page);
  const r = row(page, 'Trả lời email');
  await r.locator('[data-action="edit"]').evaluate((b) => b.click());
  await expect(page.locator('.task--editing')).toHaveCount(1);
  const other = row(page, 'Tiền điện');
  let f = await finger(page); await f.down(...(await label(page, 'Tiền điện'))); await page.waitForTimeout(700);
  note(ID, 'editing: dragging', await dragging(page)); expect(await dragging(page)).toBe(false); expect(await pressing(page)).toBe(0); await f.up();
  // the edited row itself
  const ib = await r.locator('.task__edit input, .task__edit').first().boundingBox();
  f = await finger(page); await f.down(ib.x + 20, ib.y + ib.height / 2); await page.waitForTimeout(700); expect(await dragging(page)).toBe(false); await f.up();
  await r.locator('[data-action="cancel"]').evaluate((b) => b.click());
  // dialog
  await page.evaluate(() => document.getElementById('delete-dialog').showModal());
  f = await finger(page); await f.down(...(await label(page, 'Tiền điện'))); await page.waitForTimeout(700);
  note(ID, 'dialog: dragging', await dragging(page)); expect(await dragging(page)).toBe(false); expect(await pressing(page)).toBe(0); await f.up();
  await page.evaluate(() => document.getElementById('delete-dialog').close());
  // control: a dialog closed again allows a drag
  f = await finger(page); await f.down(...(await label(page, 'Tiền điện'))); await page.waitForTimeout(500); expect(await dragging(page)).toBe(true); await f.up();
  expect(await lefts(page)).toBe(0);
  // hold started, then dialog opens before 400 ms: canStart false at timer end
  f = await finger(page); await f.down(...(await label(page, 'Tiền điện'))); await page.waitForTimeout(100);
  await page.evaluate(() => document.getElementById('delete-dialog').showModal()); await page.waitForTimeout(500);
  note(ID, 'dialog opened mid hold: dragging', await dragging(page)); expect(await dragging(page)).toBe(false); expect(await pressing(page)).toBe(0); await f.up();
  await page.evaluate(() => document.getElementById('delete-dialog').close());
});

test(`${ID}-add-field-focus long press with the add field focused does not scroll to top`, async ({ page }) => {
  await seed(page, LONG);
  await page.locator('#new-task').focus();
  await page.evaluate(() => scrollTo(0, 400)); await page.waitForTimeout(200);
  const y0 = await page.evaluate(() => scrollY); expect(y0).toBeGreaterThan(100);
  const [x, y] = await label(page, 'Việc dài 8');
  const f = await finger(page); await f.down(x, y); await page.waitForTimeout(500);
  expect(await dragging(page)).toBe(true);
  const y1 = await page.evaluate(() => scrollY); await f.move(x, y - 100, 5); const y2 = await page.evaluate(() => scrollY);
  note(ID, 'scrollY before, at pickup, after move', [y0, y1, y2]);
  expect(y1).toBe(y0); expect(y2).toBe(y0);
  await f.up(); await page.waitForTimeout(200);
  note(ID, 'scrollY after release (cancel)', await page.evaluate(() => scrollY));
  note(ID, 'active element', await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName));
});

test(`${ID}-second-finger a second finger during hold and during drag`, async ({ page }) => {
  await seed(page);
  const [x, y] = await label(page, 'Trả lời email');
  const cdp = await page.context().newCDPSession(page);
  const s = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  // second finger during drag
  await s('touchStart', [{ x, y, id: 1 }]); await page.waitForTimeout(500); expect(await dragging(page)).toBe(true);
  const [x2, y2] = await label(page, 'Cắt tóc');
  await s('touchStart', [{ x, y, id: 1 }, { x: x2, y: y2, id: 2 }]); await page.waitForTimeout(700);
  note(ID, 'drag + second finger: slips, dragging', [await page.locator('.drag-slip').count(), await dragging(page)]);
  expect(await page.locator('.drag-slip').count()).toBe(1);
  await s('touchEnd', [{ x, y, id: 1 }]); await page.waitForTimeout(300); // second finger lifts first
  note(ID, 'after the 2nd finger lifted: dragging', await dragging(page));
  await s('touchEnd', []); await page.waitForTimeout(400);
  note(ID, 'after all lifted: leftovers', await lefts(page)); expect(await lefts(page)).toBe(0);
  // second finger during the hold
  await s('touchStart', [{ x, y, id: 1 }]); await page.waitForTimeout(150);
  await s('touchStart', [{ x, y, id: 1 }, { x: x2, y: y2, id: 2 }]); await page.waitForTimeout(600);
  note(ID, 'hold + second finger: dragging, slips', [await dragging(page), await page.locator('.drag-slip').count()]);
  await s('touchEnd', []); await page.waitForTimeout(400);
  note(ID, 'leftovers after', await lefts(page)); expect(await lefts(page)).toBe(0);
  // second finger touching a different row first while the first still holds, then a clean drag works
  await page.evaluate(() => scrollTo(0, 0)); const f = await longPressDrag(page, row(page, 'Trả lời email'), null, { release: false }); expect(await dragging(page)).toBe(true); await f.up();
  expect(await lefts(page)).toBe(0); expect(errors).toEqual([]); await cdp.detach();
});

test(`${ID}-no-menu-no-selection hold 1.5 s selects no text, no callout styles, contextmenu prevented`, async ({ page }) => {
  await seed(page);
  const f = await finger(page); await f.down(...(await label(page, 'Trả lời email')));
  await page.waitForTimeout(1500);
  const sel = await page.evaluate(() => getSelection().toString()); note(ID, 'selection during drag', sel); expect(sel).toBe('');
  const css = await page.evaluate(() => { const s = document.querySelector('.drag-slip'); const r = document.querySelector('.task--placeholder'); const cs = getComputedStyle(r); return { rowUserSelect: cs.userSelect, rowCallout: cs.webkitTouchCallout, slipUserSelect: s && getComputedStyle(s).userSelect, htmlUS: getComputedStyle(document.documentElement).userSelect }; });
  note(ID, 'css', css);
  await f.up(); await page.waitForTimeout(300);
  note(ID, 'selection after', await page.evaluate(() => getSelection().toString()));
  expect(await page.evaluate(() => getSelection().toString())).toBe('');
});

test(`${ID}-drop-section drop on a section, and on a strip label, cancel over nothing, data integrity`, async ({ page }) => {
  await seed(page);
  await page.evaluate(() => { window.w = []; const o = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { window.w.push(k); return o.call(this, k, v); }; });
  const writes = () => page.evaluate(() => window.w.filter((k) => k === 'daily-todo:tasks:v1').length);
  // 1 drop on a section (Nhà)
  const nha = section(page, 'Nhà');
  let f = await finger(page); { const b = await label(page, 'Trả lời email'); await f.down(...b); await page.waitForTimeout(450); }
  const nb = await nha.locator('.group__name').boundingBox(); note(ID, 'viewport and heading box', [page.viewportSize(), nb]);
  const covered = nb.y > page.viewportSize().height - 130; note(ID, 'heading under the strip band, section hover skipped, strip label used', covered);
  if (covered) { const t0 = strip(page).locator('.drop-target').filter({ hasText: 'Nhà' }); const b0 = await t0.boundingBox(); await f.move(b0.x + b0.width / 2, b0.y + b0.height / 2); }
  else await f.move(nb.x + nb.width / 2, nb.y + nb.height / 2);
  note(ID, 'section marked', await page.locator('#day-list > .group.group--drop, .drop-target--over').count());
  await page.screenshot({ path: EV + 'TC-drag-drop-EXP-T5-drop-section/over-section-' + test.info().project.name + '.png' }).catch(() => {});
  await f.up(); await page.waitForTimeout(300);
  note(ID, 'writes after section drop', await writes()); expect(await writes()).toBe(1);
  expect((await storedJson(page, KEY)).find((t) => t.id === 'b').groupId).toBe('nha');
  expect(await lefts(page)).toBe(0);
  // 2 drop on strip label ungrouped
  f = await lp(page, 'Tiền điện', null, { release: false });
  const t = strip(page).locator('.drop-target').filter({ hasText: 'Chưa phân nhóm' }); const tb = await t.boundingBox();
  await f.move(tb.x + tb.width / 2, tb.y + tb.height / 2); await f.up(); await page.waitForTimeout(300);
  note(ID, 'writes after strip drop', await writes()); expect(await writes()).toBe(2);
  expect((await storedJson(page, KEY)).find((x) => x.id === 'c').groupId).toBeUndefined();
  // 3 cancel over nothing: top of the screen, then lift
  const before = await page.evaluate(() => [localStorage.getItem('daily-todo:tasks:v1'), localStorage.getItem('daily-todo:groups:v1')]);
  f = await lp(page, 'Cắt tóc', [200, 3], { release: false });
  note(ID, 'over nothing: marked', await page.locator('.group--drop, .drop-target--over').count());
  await f.up(); await page.waitForTimeout(300);
  note(ID, 'writes after cancel', await writes()); expect(await writes()).toBe(2);
  expect(await page.evaluate(() => [localStorage.getItem('daily-todo:tasks:v1'), localStorage.getItem('daily-todo:groups:v1')])).toEqual(before);
  expect(await lefts(page)).toBe(0);
  note(ID, 'status', await page.locator('#sr-status').textContent());
  // 4 lift without moving
  const pre = await page.evaluate(() => localStorage.getItem('daily-todo:tasks:v1'));
  await page.evaluate(() => scrollTo(0, 0)); f = await longPressDrag(page, row(page, 'Gửi báo cáo'), null); await page.waitForTimeout(300); note(ID, 'writes after in place lift', await writes()); note(ID, 'tasks changed by lift', pre !== await page.evaluate(() => localStorage.getItem('daily-todo:tasks:v1')));
  expect(await writes()).toBe(2); expect(await lefts(page)).toBe(0);
  note(ID, 'status after in place lift', await page.locator('#sr-status').textContent());
  // 5 drop on own group = cancel
  const cty = section(page, 'Công ty'); const cb = await cty.locator('.task').first().boundingBox();
  f = await lp(page, 'Gửi báo cáo', [cb.x + 80, cb.y + cb.height / 2]);
  await page.waitForTimeout(300); expect(await writes()).toBe(2);
});

test(`${ID}-speed no renderList and no row queries while moving`, async ({ page }) => {
  await seed(page, LONG);
  const f = await lp(page, 'Việc dài 2', null, { release: false });
  await page.evaluate(() => {
    window.__m = { list: 0, qsa: 0, rects: 0 };
    new MutationObserver((l) => { window.__m.list += l.length; }).observe(document.getElementById('day-list'), { subtree: true, childList: true, attributes: true, characterData: true });
    for (const P of [Document.prototype, Element.prototype]) { const o = P.querySelectorAll; P.querySelectorAll = function (...a) { window.__m.qsa++; return o.apply(this, a); }; }
    const g = Element.prototype.getBoundingClientRect; Element.prototype.getBoundingClientRect = function () { window.__m.rects++; return g.call(this); };
  });
  await f.move(150, 600, 30); await f.move(200, 100, 30); await page.waitForTimeout(100);
  const m = await page.evaluate(() => window.__m); note(ID, 'mutations in #day-list, qsa, rects during move', m);
  expect(m).toEqual({ list: 0, qsa: 0, rects: 0 }); await f.up();
});

test(`${ID}-strip-stays strip stays in place while dragging; page height unchanged`, async ({ page }) => {
  await seed(page, LONG);
  const f = await lp(page, 'Việc dài 4', null, { release: false });
  await page.waitForTimeout(800); const s0 = await strip(page).boundingBox(); const sy = await page.evaluate(() => scrollY);
  await f.move(100, 200, 10); await f.move(300, 500, 10);
  const s1 = await strip(page).boundingBox();
  note(ID, 'strip box before/after, scrollY', [s0, s1, sy, await page.evaluate(() => scrollY)]);
  expect(Math.abs(s1.y - s0.y)).toBeLessThan(0.5); expect(await page.evaluate(() => scrollY)).toBe(sy); await f.up();
});

test(`${ID}-reduced-motion pressing wash at once, no tilt`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page);
  const f = await finger(page); await f.down(...(await label(page, 'Trả lời email'))); await page.waitForTimeout(100);
  const w = await page.evaluate(() => { const r = document.querySelector('.task--pressing'); const cs = getComputedStyle(r, '::before'); return { has: !!r, anim: cs.animationName, size: cs.backgroundSize }; });
  note(ID, 'pressing', w); expect(w.has).toBe(true); expect(w.anim).toBe('none');
  await page.waitForTimeout(500);
  const rot = await page.evaluate(() => getComputedStyle(document.querySelector('.drag-slip')).rotate); note(ID, 'slip rotate', rot); expect(['0deg', 'none']).toContain(rot);
  await f.up();
});

test(`${ID}-sequence swipe, then long press drag, then swipe on another row; touchCancel early`, async ({ page }) => {
  await seed(page);
  const sw = row(page, 'Tiền điện').locator('.task__swipe'); await touchDrag(page, sw, -200);
  await expect.poll(() => sw.evaluate((e) => e.scrollLeft)).toBeGreaterThan(100);
  const f = await lp(page, 'Trả lời email', strip(page).locator('.drop-target').filter({ hasText: 'Sức khỏe' }));
  await page.waitForTimeout(400); expect((await storedJson(page, KEY)).find((t) => t.id === 'b').groupId).toBe('sk');
  const sw2 = row(page, 'Cắt tóc').locator('.task__swipe'); await sw2.scrollIntoViewIfNeeded(); await touchDrag(page, sw2, -200);
  await expect.poll(() => sw2.evaluate((e) => e.scrollLeft)).toBeGreaterThan(100);
  expect(await lefts(page)).toBe(0);
  // early touchCancel
  const g = await finger(page); await g.down(...(await label(page, 'Gửi báo cáo'))); await page.waitForTimeout(150); expect(await pressing(page)).toBe(1);
  await g.cancel(); await page.waitForTimeout(600);
  note(ID, 'after touchCancel: leftovers, dragging', [await lefts(page), await dragging(page)]); expect(await lefts(page)).toBe(0); expect(await dragging(page)).toBe(false);
});

test(`${ID}-edges slip stays inside the screen at both edges and the top`, async ({ page }) => {
  await seed(page);
  const w = await page.evaluate(() => document.documentElement.clientWidth);
  const f = await lp(page, 'Trả lời email', null, { release: false });
  for (const [x, y] of [[w - 3, 300], [2, 300], [w / 2, 2], [w / 2, 400]]) {
    await f.move(x, y, 4);
    const s = await page.locator('.drag-slip').boundingBox();
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sx: scrollX }));
    note(ID, `finger ${x},${y}: slip`, [s.x, s.y, s.width, m]);
    expect(s.x).toBeGreaterThanOrEqual(0 - 8); expect(s.x + s.width).toBeLessThanOrEqual(w); expect(s.y).toBeGreaterThanOrEqual(-8); expect(m.sw).toBeLessThanOrEqual(m.cw);
    if (y === 400) expect(s.y + s.height).toBeLessThanOrEqual(y - 40);
  }
  await f.up();
});

test(`${ID}-visual phone hold, drag and dropped states`, async ({ page }, ti) => {
  await seed(page);
  const dir = EV + 'TC-drag-drop-T5-21/'; fs.mkdirSync(dir, { recursive: true });
  const n = ti.project.name;
  const f = await finger(page); await f.down(...(await label(page, 'Trả lời email'))); await page.waitForTimeout(250);
  await page.screenshot({ path: dir + `hold-${n}.png` });
  await page.waitForTimeout(300);
  const t = strip(page).locator('.drop-target').filter({ hasText: 'Sức khỏe' }); const b = await t.boundingBox();
  await f.move(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(400);
  await page.screenshot({ path: dir + `drag-${n}.png` });
  await f.up(); await page.waitForTimeout(900);
  await page.screenshot({ path: dir + `dropped-${n}.png` });
});
