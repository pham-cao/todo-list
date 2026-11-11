import { test, expect } from '@playwright/test';
import { open, task, group, rows, finger, KEY } from '/home/gem/src/todo_list/tests/e2e/helpers.js';
const GROUPS = [group('cty', 'Công ty', 'yellow', 1), group('nha', 'Nhà', 'pink', 2), group('sk', 'Sức khỏe', 'blue', 3)];
const TASKS = [{ ...task('a', 'Gửi báo cáo', true, undefined, 10), groupId: 'cty' },{ ...task('b', 'Trả lời email', false, undefined, 20), groupId: 'cty' },{ ...task('c', 'Tiền điện', false, undefined, 30), groupId: 'nha' },task('d', 'Cắt tóc', false, undefined, 40)];
test('dbg in place lift', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('daily-todo:swipe-hint-seen', '1'));
  await open(page, TASKS, '', { groups: GROUPS });
  const r = rows(page).filter({ has: page.getByText('Cắt tóc', { exact: true }) });
  await r.evaluate((e) => e.scrollIntoView({ block: 'start' })); await page.evaluate(() => scrollBy(0, -250)); await page.waitForTimeout(200);
  const b = await r.locator('.task__label').boundingBox();
  const x = b.x + Math.min(b.width / 2, 60), y = b.y + b.height / 2;
  const before = await page.evaluate((k) => localStorage.getItem(k), KEY);
  const f = await finger(page); await f.down(x, y); await page.waitForTimeout(450);
  const info = await page.evaluate(([x, y]) => ({ over: document.elementFromPoint(x, y)?.className, marked: [...document.querySelectorAll('.group--drop, .drop-target--over')].map((e) => e.className + ' ' + (e.dataset.key || e.textContent.slice(0, 20))), vh: innerHeight, y }), [x, y]);
  console.log(JSON.stringify(info));
  await f.up(); await page.waitForTimeout(300);
  const after = await page.evaluate((k) => localStorage.getItem(k), KEY);
  console.log('changed', before !== after, JSON.stringify(JSON.parse(after).find((t) => t.id === 'd')));
});
