import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { open, task, group, rows, finger, storedJson, KEY } from '/home/gem/src/todo_list/tests/e2e/helpers.js';
const EV = '/home/gem/src/todo_list/docs/project/specs/drag-drop/qa/evidence/TC-drag-drop-BUG-018-retest/';
fs.mkdirSync(EV, { recursive: true });
const GROUPS = [group('cty', 'Công ty', 'yellow', 1), group('nha', 'Nhà', 'pink', 2), group('sk', 'Sức khỏe', 'blue', 3)];
const TASKS = [{ ...task('a', 'Gửi báo cáo', true, undefined, 10), groupId: 'cty' },{ ...task('b', 'Trả lời email', false, undefined, 20), groupId: 'cty' },{ ...task('c', 'Tiền điện', false, undefined, 30), groupId: 'nha' },task('d', 'Cắt tóc', false, undefined, 40)];
const row = (page, t) => rows(page).filter({ has: page.getByText(t, { exact: true }) });
const dragging = (page) => page.evaluate(() => document.documentElement.classList.contains('is-dragging'));
const lefts = (page) => page.locator('.drag-slip, .drop-strip, .drag-edge, .task--placeholder, .task--pressing, html.is-dragging').count();
const log = [];
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('daily-todo:swipe-hint-seen', '1')); await open(page, TASKS, '', { groups: GROUPS }); });
test.afterEach(async ({ page }, ti) => { fs.writeFileSync(EV + `${ti.title.split(' ')[0]}-${ti.project.name}.txt`, `${ti.title}\n${ti.status}\n${log.join('\n')}\n`); await page.screenshot({ path: EV + `${ti.title.split(' ')[0]}-${ti.project.name}.png` }).catch(() => {}); log.length = 0; });
const note = (k, v) => log.push(`${k}: ${JSON.stringify(v)}`);
const bottomRow = async (page) => { const r = row(page, 'Cắt tóc'); await r.evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => scrollBy(0, 9999)); await page.waitForTimeout(200); const b = await r.locator('.task__label').boundingBox(); return [b.x + Math.min(b.width / 2, 60), b.y + b.height / 2]; };

test('B18-lift-in-place under the strip is a cancel', async ({ page }) => {
  const [x, y] = await bottomRow(page); note('finger y of 839', y);
  const before = await page.evaluate((k) => localStorage.getItem(k), KEY);
  const f = await finger(page); await f.down(x, y); await page.waitForTimeout(450);
  note('dragging, marked target', [await dragging(page), await page.locator('.drop-target--over').count()]);
  expect(await dragging(page)).toBe(true); expect(await page.locator('.drop-target--over').count()).toBe(0);
  await f.move(x + 6, y + 4, 2); // tremble within 10 px
  expect(await page.locator('.drop-target--over').count()).toBe(0);
  await f.up(); await page.waitForTimeout(300);
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(before);
  expect(await lefts(page)).toBe(0); note('status', await page.locator('#sr-status').textContent());
});

test('B18-normal drag after a pick up under the strip still drops', async ({ page }) => {
  const [x, y] = await bottomRow(page);
  const f = await finger(page); await f.down(x, y); await page.waitForTimeout(450);
  const t = page.getByRole('group', { name: 'Thả vào nhóm' }).locator('.drop-target').filter({ hasText: 'Sức khỏe' }); const b = await t.boundingBox();
  await f.move(b.x + b.width / 2, b.y + b.height / 2, 6);
  expect(await page.locator('.drop-target--over').count()).toBe(1);
  await f.up(); await page.waitForTimeout(300);
  expect((await storedJson(page, KEY)).find((t) => t.id === 'd').groupId).toBe('sk'); expect(await lefts(page)).toBe(0);
  // moving out more than 10 px and back to the pick up point: hit testing stays on
  const [x2, y2] = await bottomRow(page);
  const g = await finger(page); await g.down(x2, y2); await page.waitForTimeout(450); await g.move(x2, y2 - 40, 3); await g.move(x2, y2, 3);
  note('after out and back, marked', await page.locator('.drop-target--over').count());
  await g.up(); await page.waitForTimeout(200); expect(await lefts(page)).toBe(0);
});

test('B18-second finger during the hold, in the header, the add form and a row', async ({ page }) => {
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await page.context().newCDPSession(page);
  const s = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await row(page, 'Trả lời email').scrollIntoViewIfNeeded();
  const b = await row(page, 'Trả lời email').locator('.task__label').boundingBox(); const x = b.x + 40, y = b.y + b.height / 2;
  const spots = { header: await page.locator('h1').boundingBox(), addform: await page.locator('#new-task').boundingBox(), otherRow: await row(page, 'Tiền điện').locator('.task__label').boundingBox() };
  for (const [name, bb] of Object.entries(spots)) {
    await s('touchStart', [{ x, y, id: 1 }]); await page.waitForTimeout(120);
    await expect(page.locator('.task--pressing')).toHaveCount(1);
    await s('touchStart', [{ x, y, id: 1 }, { x: bb.x + 20, y: bb.y + bb.height / 2, id: 2 }]); await page.waitForTimeout(700);
    note(name + ': dragging, pressing, leftovers', [await dragging(page), await page.locator('.task--pressing').count(), await lefts(page)]);
    expect(await dragging(page)).toBe(false); expect(await lefts(page)).toBe(0);
    await s('touchEnd', []); await page.waitForTimeout(300); expect(await lefts(page)).toBe(0);
  }
  // a following normal long press drag still works
  const f = await finger(page); await f.down(x, y); await page.waitForTimeout(500); expect(await dragging(page)).toBe(true); await f.up();
  expect(await lefts(page)).toBe(0); expect(errors).toEqual([]);
});

test('B18-second finger after the drag started leaves the drag running and ends cleanly', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  const s = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const b = await row(page, 'Trả lời email').locator('.task__label').boundingBox(); const x = b.x + 40, y = b.y + b.height / 2;
  const h = await page.locator('h1').boundingBox();
  await s('touchStart', [{ x, y, id: 1 }]); await page.waitForTimeout(500); expect(await dragging(page)).toBe(true);
  await s('touchStart', [{ x, y, id: 1 }, { x: h.x + 20, y: h.y + 10, id: 2 }]); await page.waitForTimeout(500);
  note('dragging, slips after second finger', [await dragging(page), await page.locator('.drag-slip').count()]);
  expect(await dragging(page)).toBe(true); expect(await page.locator('.drag-slip').count()).toBe(1);
  await s('touchMove', [{ x, y: y + 30, id: 1 }, { x: h.x + 20, y: h.y + 10, id: 2 }]); await page.waitForTimeout(100); expect(await dragging(page)).toBe(true);
  await s('touchEnd', []); await page.waitForTimeout(400);
  note('leftovers', await lefts(page)); expect(await lefts(page)).toBe(0);
});
