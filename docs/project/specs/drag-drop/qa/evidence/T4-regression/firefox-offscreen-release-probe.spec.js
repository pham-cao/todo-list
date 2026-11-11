import { test, expect } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
import { open, task, group, rows, mouseDrag } from '/home/gem/src/todo_list/tests/e2e/helpers.js';
const GROUPS = [group('cty', 'Công ty', 'yellow', 1), group('nha', 'Nhà', 'pink', 2)];
const TASKS = [{ ...task('a', 'Gửi báo cáo', true, undefined, 10), groupId: 'cty' },{ ...task('b', 'Trả lời email', false, undefined, 20), groupId: 'cty' },{ ...task('c', 'Tiền điện', false, undefined, 30), groupId: 'nha' },task('d', 'Cắt tóc', false, undefined, 40)];
test('x', async ({ page }) => {
  const logs=[];page.on('console',m=>logs.push(m.text()));page.on('pageerror',e=>logs.push('ERR '+e.message));
  await open(page, TASKS, '', { groups: GROUPS });
  await page.locator('#new-task').focus();
  const r = rows(page).filter({ hasText: 'Cắt tóc' });
  await mouseDrag(page, r, 40, -150);
  const h = await page.locator('#page-title').boundingBox();
  console.log('title', JSON.stringify(h), 'vp', JSON.stringify(page.viewportSize()));
  await page.mouse.move(h.x + 20, h.y + h.height / 2, { steps: 4 });
  console.log('el', await page.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&(e.tagName+'#'+e.id+'.'+e.className)},[h.x+20,h.y+h.height/2]));
  console.log('before up: dragging', await page.evaluate(()=>document.documentElement.classList.contains('is-dragging')));
  await page.mouse.up();
  await page.waitForTimeout(500);
  console.log('after up: dragging', await page.evaluate(()=>document.documentElement.classList.contains('is-dragging')), logs.join(' | '));
});
