import { test, expect } from '@playwright/test';
import {
  TODAY, NOW, KEY, GROUPS_KEY, UI_KEY, task, group, open, rows, labels, progress, box, storedRaw, storedJson,
  addTask, tick, stored, sections, section, toggle, passMidnight, hash,
} from './helpers.js';

// T4: the day list in sections, with collapse (R29 to R34, R39, R40, R50, R57, R58, R63, R65, NFR1)
const at = (h, m) => new Date(`${TODAY}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+07:00`).getTime();
const GROUPS = [
  group('cty', 'Công ty', 'yellow', at(7, 0)),
  group('nha', 'Nhà', 'pink', at(7, 1)),
  group('jp', 'Học tiếng Nhật', 'green', at(7, 2)),
];
const DAY = [
  task('n1', 'Tưới cây', false, TODAY, at(8, 0)),
  task('c1', 'Gửi báo cáo', true, TODAY, at(8, 10)),
  task('u1', 'Đọc sách', false, TODAY, at(8, 20)),
  task('n2', 'Nấu cơm', true, TODAY, at(8, 30)),
  task('c2', 'Họp nhóm', false, TODAY, at(8, 40)),
  task('c3', 'Trả lời email', false, TODAY, at(8, 50)),
].map((t) => ({ ...t, ...(t.id[0] === 'c' && { groupId: 'cty' }), ...(t.id[0] === 'n' && { groupId: 'nha' }) }));

const names = (page) => sections(page).locator('.group__name');
const counts = (page) => sections(page).locator('.group__count');
const sectionLabels = (page, name) => section(page, name).locator('.task__label');
const summary = (page) => page.locator('#summary');

test('sections follow group creation order, Chưa phân nhóm last, empty groups hidden, rows oldest first', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await expect(names(page)).toHaveText(['Công ty', 'Nhà', 'Chưa phân nhóm']);
  await expect(counts(page)).toHaveText(['1/3', '1/2', '0/1']);
  expect(await sections(page).evaluateAll((s) => s.map((el) => el.dataset.color))).toEqual(['yellow', 'pink', 'none']);
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Gửi báo cáo', 'Họp nhóm', 'Trả lời email']);
  await expect(sectionLabels(page, 'Nhà')).toHaveText(['Tưới cây', 'Nấu cơm']);
  await expect(sectionLabels(page, 'Chưa phân nhóm')).toHaveText(['Đọc sách']);
  // Every list of rows keeps .task-list, so the shared row helper still sees all of them.
  await expect(rows(page)).toHaveCount(6);
  await expect(summary(page)).toHaveText('Đã hoàn thành 2/6 việc');
});

test('each header is an h2 holding the toggle named with the group and its count', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  const headings = page.getByRole('heading', { level: 2 });
  await expect(headings).toHaveCount(3);
  await expect(headings.nth(0)).toHaveAccessibleName('Nhóm Công ty 1/3 việc đã hoàn thành');
  const btn = headings.nth(0).getByRole('button');
  await expect(btn).toHaveAccessibleName('Nhóm Công ty 1/3 việc đã hoàn thành');
  await expect(btn).toHaveAttribute('type', 'button');
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Nhóm Chưa phân nhóm 0/1 việc đã hoàn thành' })).toBeVisible();
});

test('a day with only ungrouped tasks, and a task with an unknown group, show the plain list', async ({ page }) => {
  const tasks = [task('a', 'Một'), { ...task('b', 'Hai'), groupId: 'gone' }, { ...task('c', 'Ba'), groupId: null }];
  await open(page, tasks, '', { groups: GROUPS });
  await expect(labels(page)).toHaveText(['Một', 'Hai', 'Ba']);
  await expect(sections(page)).toHaveCount(0);
  await expect(page.locator('.group__toggle')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2 })).toHaveCount(0);
  expect(await page.locator('#day-list').evaluate((el) => [...el.children].map((c) => c.outerHTML.match(/^<\w+[^>]*>/)[0])))
    .toEqual(['<ul class="task-list">']);
  // Nothing is rewritten: the unknown group stays on the stored task.
  expect(await storedRaw(page)).toBe(JSON.stringify(tasks));
});

test('a tick and an untick update the header count and the summary, keep the row in place, and persist', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await tick(page, 1, true); // Họp nhóm, Công ty
  await expect(counts(page)).toHaveText(['2/3', '1/2', '0/1']);
  await expect(toggle(page, 'Công ty')).toHaveAccessibleName('Nhóm Công ty 2/3 việc đã hoàn thành');
  await expect(summary(page)).toHaveText('Đã hoàn thành 3/6 việc');
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Gửi báo cáo', 'Họp nhóm', 'Trả lời email']);
  await tick(page, 0, false);
  await expect(counts(page)).toHaveText(['1/3', '1/2', '0/1']);
  await tick(page, 5, true); // Đọc sách, ungrouped
  await page.reload();
  await expect(counts(page)).toHaveText(['1/3', '1/2', '1/1']);
  await expect(summary(page)).toHaveText('Đã hoàn thành 3/6 việc');
});

test('a section collapses with a click, Enter and Space, and the fold is remembered across reload and days', async ({ page }) => {
  const other = { ...task('o1', 'Việc hôm qua', false, '2026-11-08', at(6, 0)), groupId: 'cty' };
  await open(page, [...DAY, other], '', { groups: GROUPS });
  const cty = section(page, 'Công ty');
  await toggle(page, 'Công ty').click();
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'false');
  await expect(cty).toHaveClass(/group--collapsed/);
  await expect(cty.locator('.task')).toHaveCount(3);
  for (const r of await cty.locator('.task').all()) await expect(r).toBeHidden();
  await expect(cty.locator('.group__name')).toBeVisible();
  await expect(cty.locator('.group__count')).toHaveText('1/3');
  expect(await storedJson(page, UI_KEY)).toEqual({ collapsed: ['cty'] });

  await toggle(page, 'Công ty').press('Enter');
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'true');
  await expect(cty.locator('.task').first()).toBeVisible();
  expect(await storedJson(page, UI_KEY)).toEqual({ collapsed: [] });
  await toggle(page, 'Công ty').press(' ');
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle(page, 'Công ty')).toBeFocused();

  await page.reload();
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle(page, 'Nhà')).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Xem ngày trước' }).click();
  await expect(names(page)).toHaveText(['Công ty']);
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'false');
  await expect(section(page, 'Công ty').locator('.task')).toBeHidden();
});

test('Chưa phân nhóm can be folded when another section is shown, and the plain list has no toggle', async ({ page }) => {
  await open(page, [task('a', 'Một'), { ...task('b', 'Hai'), groupId: 'nha' }], '', { groups: GROUPS });
  await toggle(page, 'Chưa phân nhóm').click();
  await expect(toggle(page, 'Chưa phân nhóm')).toHaveAttribute('aria-expanded', 'false');
  expect(await storedJson(page, UI_KEY)).toEqual({ collapsed: ['none'] });
  // The day without grouped tasks ignores the stored fold: plain list, rows shown.
  await page.getByRole('button', { name: 'Xem ngày sau' }).click();
  await addTask(page, 'Ngày mai');
  await expect(sections(page)).toHaveCount(0);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toBeVisible();
});

test('a collapsed section still counts in the summary, the progress mark and the stamp', async ({ page }) => {
  const done = DAY.map((t) => ({ ...t, done: t.id !== 'c3' }));
  await open(page, done, '', { groups: GROUPS, ui: { collapsed: ['cty'] } });
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'false');
  await expect(summary(page)).toHaveText('Đã hoàn thành 5/6 việc');
  await expect(progress(page)).not.toHaveClass(/progress--complete/);
  await toggle(page, 'Công ty').click();
  await tick(page, 2, true); // Trả lời email, the last open task
  await toggle(page, 'Công ty').click();
  await expect(summary(page)).toHaveText('Đã hoàn thành 6/6 việc');
  await expect(progress(page)).toHaveClass(/progress--complete/);
});

test('group names are shown as text, never as markup', async ({ page }) => {
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss(); });
  const evil = [group('b', '<b>abc</b>', 'blue', 1), group('img', '<img src=x onerror=alert(1)>', 'orange', 2), group('h', 'Nhà 🏠', 'purple', 3)];
  const tasks = evil.map((g, i) => ({ ...task(`t${i}`, `Việc ${i}`), groupId: g.id }));
  await open(page, tasks, '', { groups: evil });
  await expect(names(page)).toHaveText(['<b>abc</b>', '<img src=x onerror=alert(1)>', 'Nhà 🏠']);
  await expect(toggle(page, '<b>abc</b>')).toHaveAccessibleName('Nhóm <b>abc</b> 0/1 việc đã hoàn thành');
  await expect(page.locator('#day-list b, #day-list img')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test('six colours give six coloured headers; an unknown colour shows as yellow', async ({ page }) => {
  const colours = ['yellow', 'pink', 'green', 'blue', 'orange', 'purple'];
  const six = colours.map((c, i) => group(`g${i}`, `Nhóm ${c}`, c, i));
  six.push(group('odd', 'Lạ', 'teal', 9));
  const tasks = six.map((g, i) => ({ ...task(`t${i}`, `Việc ${i}`), groupId: g.id }));
  await open(page, tasks, '', { groups: six });
  expect(await sections(page).evaluateAll((s) => s.map((el) => el.dataset.color))).toEqual([...colours, 'yellow']);
  const fills = await sections(page).locator('.group__name').evaluateAll((els) => els.map((el) => getComputedStyle(el).getPropertyValue('--hl').trim()));
  expect(new Set(fills.slice(0, 6)).size).toBe(6);
  await expect(names(page).first()).toHaveText('Nhóm yellow');
});

test('deleting the last task of a section removes it; the last grouped task turns the day into the plain list', async ({ page }) => {
  const tasks = [{ ...task('c', 'Có nhóm', false, TODAY, at(8, 0)), groupId: 'cty' }, { ...task('n', 'Nhà', false, TODAY, at(8, 1)), groupId: 'nha' }, task('u', 'Không nhóm', false, TODAY, at(8, 2))];
  await open(page, tasks, '', { groups: GROUPS });
  const del = async (i) => {
    await rows(page).nth(i).getByRole('button', { name: 'Xóa' }).click();
    await page.getByRole('button', { name: 'Xóa việc' }).click();
  };
  await del(0);
  // Focus goes to the next row in the whole container, across the section boundary.
  await expect(box(page, 0)).toBeFocused();
  await expect(names(page)).toHaveText(['Nhà', 'Chưa phân nhóm']);
  await del(0);
  await expect(sections(page)).toHaveCount(0);
  await expect(labels(page)).toHaveText(['Không nhóm']);
  await expect(box(page, 0)).toBeFocused();
  await expect(summary(page)).toHaveText('Đã hoàn thành 0/1 việc');
  await del(0);
  await expect(page.locator('#new-task')).toBeFocused();
  await expect(page.locator('#empty')).toBeVisible();
});

test('delete focus skips rows in a folded section and falls back to the previous row', async ({ page }) => {
  const tasks = [{ ...task('c', 'Công ty 1', false, TODAY, at(8, 0)), groupId: 'cty' }, { ...task('n', 'Nhà 1', false, TODAY, at(8, 1)), groupId: 'nha' }];
  await open(page, tasks, '', { groups: GROUPS, ui: { collapsed: ['nha'] } });
  await rows(page).nth(0).getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('button', { name: 'Xóa việc' }).click();
  await expect(page.locator('#new-task')).toBeFocused();
  await expect(names(page)).toHaveText(['Nhà']);
});

// Slow the erase of one row (inline style beats the class; CSSOM is allowed by the CSP), so the
// owner can move focus before the rebuild that follows the delete.
async function deleteSlowly(page, row) {
  await row.evaluate((el) => { el.style.animationDuration = '1500ms'; });
  await row.getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('button', { name: 'Xóa việc' }).click();
}

test('an open edit stays open with its text when a row in another section is ticked', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await rows(page).nth(0).getByRole('button', { name: 'Sửa' }).click();
  const field = page.locator('.task__edit .input');
  await field.fill('Gửi báo cáo quý');
  await tick(page, 5, true);
  await expect(field).toHaveValue('Gửi báo cáo quý');
  await expect(counts(page)).toHaveText(['1/3', '1/2', '1/1']);
  await field.press('Enter');
  await expect(sectionLabels(page, 'Công ty').first()).toHaveText('Gửi báo cáo quý');
});

test('a rebuild keeps an open edit with its text and focus', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await rows(page).nth(0).getByRole('button', { name: 'Sửa' }).click();
  const field = page.locator('.task__edit .input');
  await field.fill('Gửi báo cáo quý');
  // Deleting Đọc sách empties Chưa phân nhóm, so the day is rebuilt while the owner is back in the edit.
  await deleteSlowly(page, section(page, 'Chưa phân nhóm').locator('.task'));
  await field.focus();
  await expect(names(page)).toHaveText(['Công ty', 'Nhà']);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Gửi báo cáo quý');
  await field.press('Enter');
  await expect(sectionLabels(page, 'Công ty').first()).toHaveText('Gửi báo cáo quý');
});

test('a rebuild keeps the focus on a section toggle', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await deleteSlowly(page, section(page, 'Chưa phân nhóm').locator('.task'));
  await toggle(page, 'Nhà').focus();
  await expect(names(page)).toHaveText(['Công ty', 'Nhà']);
  await expect(toggle(page, 'Nhà')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(toggle(page, 'Nhà')).toHaveAttribute('aria-expanded', 'false');
});

test('an ungrouped task added to a day of sections lands in Chưa phân nhóm and opens it when folded', async ({ page }) => {
  const tasks = DAY.filter((t) => t.groupId);
  await open(page, tasks, '', { groups: GROUPS });
  await addTask(page, 'Mua sữa');
  await expect(names(page)).toHaveText(['Công ty', 'Nhà', 'Chưa phân nhóm']);
  await expect(sectionLabels(page, 'Chưa phân nhóm')).toHaveText(['Mua sữa']);
  await expect(section(page, 'Chưa phân nhóm').locator('.task')).toHaveClass(/task--enter/);
  await toggle(page, 'Chưa phân nhóm').click();
  await addTask(page, 'Mua trứng');
  await expect(toggle(page, 'Chưa phân nhóm')).toHaveAttribute('aria-expanded', 'true');
  await expect(sectionLabels(page, 'Chưa phân nhóm')).toHaveText(['Mua sữa', 'Mua trứng']);
  await expect(page.locator('#new-task')).toBeFocused();
  expect(await storedJson(page, UI_KEY)).toEqual({ collapsed: [] });
  // The one shot class goes once the write-in ends, so a later rebuild never replays it.
  await expect(section(page, 'Chưa phân nhóm').locator('.task--enter')).toHaveCount(0);
});

test('each day builds only its own sections with the same rules', async ({ page }) => {
  const tasks = [
    { ...task('y', 'Hôm qua', false, '2026-11-08', 1), groupId: 'nha' },
    { ...task('t', 'Hôm nay', false, TODAY, 2), groupId: 'cty' },
    task('m', 'Ngày mai', false, '2026-11-10', 3),
  ];
  await open(page, tasks, '', { groups: GROUPS });
  await expect(names(page)).toHaveText(['Công ty']);
  await page.getByRole('button', { name: 'Xem ngày trước' }).click();
  await expect(names(page)).toHaveText(['Nhà']);
  await page.locator('#day-picker').fill('2026-11-10');
  await expect(sections(page)).toHaveCount(0);
  await expect(labels(page)).toHaveText(['Ngày mai']);
});

test('groups and UI state that cannot be read leave the plain list and no error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, [{ ...task('a', 'Một'), groupId: 'cty' }], '', { groups: '{bad', ui: 'nope' });
  await expect(labels(page)).toHaveText(['Một']);
  await expect(sections(page)).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(`${k}:corrupt`), GROUPS_KEY)).toBe('{bad');
  expect(errors).toEqual([]);
});

// Phone row actions inside sections (R64)
const HINT = 'daily-todo:swipe-hint-seen';
async function touchDrag(page, locator, dx) {
  const b = await locator.boundingBox();
  const y = b.y + b.height / 2, x0 = b.x + b.width - 30;
  const cdp = await page.context().newCDPSession(page);
  const send = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await send('touchStart', x0);
  for (let i = 1; i <= 10; i++) { await send('touchMove', x0 + (dx * i) / 10); await page.waitForTimeout(16); }
  await send('touchEnd', x0 + dx);
  await cdp.detach();
}

test('on a phone the peek skips a folded section, and swipe, tick and delete work inside sections', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await open(page, DAY, '', { groups: GROUPS, ui: { collapsed: ['cty'] } });
  await expect(section(page, 'Nhà').locator('.task').first()).toHaveClass(/task--peek/);
  await expect(page.locator('.task--peek')).toHaveCount(1);
  await expect(page.locator('.task--peek')).toHaveCount(0, { timeout: 4000 });
  expect(await page.evaluate((k) => localStorage.getItem(k), HINT)).toBe('1');

  const swipes = page.locator('.group:not(.group--collapsed) .task__swipe');
  const left = (i) => swipes.nth(i).evaluate((el) => el.scrollLeft);
  await touchDrag(page, swipes.nth(0), -200);
  await expect.poll(() => left(0)).toBeGreaterThan(100);
  await touchDrag(page, swipes.nth(2), -200); // Đọc sách, in Chưa phân nhóm
  await expect.poll(() => left(2)).toBeGreaterThan(100);
  await expect.poll(() => left(0)).toBe(0);
  await section(page, 'Chưa phân nhóm').getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('button', { name: 'Xóa việc' }).click();
  await expect(names(page)).toHaveText(['Công ty', 'Nhà']);
  await section(page, 'Nhà').locator('.check__box').first().click();
  await expect(section(page, 'Nhà').locator('.group__count')).toHaveText('2/2');
});

test('200 tasks in 5 groups: render, collapse and tick each under 100 ms', async ({ page }) => {
  const five = ['A', 'B', 'C', 'D', 'E'].map((n, i) => group(`g${i}`, `Nhóm ${n}`, 'yellow', i));
  const many = Array.from({ length: 200 }, (_, i) => ({ ...task(`t${i}`, `Việc số ${i + 1}`, i % 4 === 0, TODAY, NOW.getTime() + i), groupId: `g${i % 5}` }));
  await open(page, many, '', { groups: five });
  await expect(rows(page)).toHaveCount(200);
  // A string runs through the debugger, so the page CSP (no eval) does not apply; layout is forced before the next frame.
  const time = (code) => page.evaluate(`new Promise((r) => {
    const t0 = performance.now();
    ${code}
    void document.body.offsetHeight;
    requestAnimationFrame(() => setTimeout(() => r(performance.now() - t0)));
  })`);
  // Moving to another day and back rebuilds every section from scratch.
  expect(await time("document.getElementById('next-day').click(); document.getElementById('prev-day').click();")).toBeLessThan(100);
  await expect(rows(page)).toHaveCount(200);
  expect(await time("document.querySelector('.group__toggle').click();")).toBeLessThan(100);
  await expect(sections(page).first()).toHaveClass(/group--collapsed/);
  expect(await time("document.querySelectorAll('.group:not(.group--collapsed) .check input')[10].click();")).toBeLessThan(100);
  await expect(summary(page)).toHaveText('Đã hoàn thành 51/200 việc');
  expect((await storedJson(page, KEY)).length).toBe(200);
});

// QA regression with groups present (R34, R57, R58, NFR3, NFR4)
const slip = (page) => page.locator('#storage-slip');

test('local midnight with sections on screen: the new day starts empty, folds stay, the old day keeps its sections', async ({ page }) => {
  const next = { ...task('m', 'Ngày mai', false, '2026-11-10', at(6, 0)), groupId: 'cty' };
  await open(page, [...DAY, next], '', { groups: GROUPS, ui: { collapsed: ['cty'] } });
  await expect(names(page)).toHaveText(['Công ty', 'Nhà', 'Chưa phân nhóm']);
  await passMidnight(page);
  await expect(page.locator('.app-header__date')).toHaveText('Hôm nay, Thứ Ba, 10/11/2026');
  await expect(names(page)).toHaveText(['Công ty']);
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Xem ngày trước' }).click();
  await expect(names(page)).toHaveText(['Công ty', 'Nhà', 'Chưa phân nhóm']);
  await expect(counts(page)).toHaveText(['1/3', '1/2', '0/1']);
});

test('Back and Forward between days rebuild the right sections', async ({ page }) => {
  const y = { ...task('y', 'Hôm qua', false, '2026-11-08', 1), groupId: 'nha' };
  await open(page, [...DAY, y], '', { groups: GROUPS });
  await page.getByRole('button', { name: 'Xem ngày trước' }).click();
  await expect(names(page)).toHaveText(['Nhà']);
  await page.goBack();
  await expect(names(page)).toHaveText(['Công ty', 'Nhà', 'Chưa phân nhóm']);
  await page.goForward();
  await expect(names(page)).toHaveText(['Nhà']);
});

test('older data without groups or UI keys is shown as before and never rewritten by viewing, folding or ticking', async ({ page }) => {
  const legacy = [task('a', 'Một'), task('b', 'Hai', true)];
  await open(page, legacy);
  await expect(sections(page)).toHaveCount(0);
  expect(await storedRaw(page)).toBe(JSON.stringify(legacy));
  expect(await page.evaluate((k) => localStorage.getItem(k), GROUPS_KEY)).toBeNull();
  expect(await page.evaluate((k) => localStorage.getItem(k), UI_KEY)).toBeNull();
  await tick(page, 0, true);
  expect((await storedJson(page, KEY)).every((t) => !('groupId' in t))).toBe(true);
  expect(await page.evaluate((k) => localStorage.getItem(k), GROUPS_KEY)).toBeNull();
});

test('ticking keeps the groupId of every task and writes nothing to the groups key', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  const before = await page.evaluate((k) => localStorage.getItem(k), GROUPS_KEY);
  await tick(page, 1, true);
  const after = await storedJson(page, KEY);
  expect(after.map((t) => [t.id, t.groupId])).toEqual(DAY.map((t) => [t.id, t.groupId]));
  expect(await page.evaluate((k) => localStorage.getItem(k), GROUPS_KEY)).toBe(before);
});

test('groups storage that cannot be read: slip shown, tasks still listed, day still usable', async ({ page }) => {
  await page.addInitScript((k) => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) { if (key === k) throw new DOMException('Blocked', 'SecurityError'); return get.call(this, key); };
  }, GROUPS_KEY);
  await open(page, [{ ...task('a', 'Một'), groupId: 'cty' }], '', { groups: GROUPS });
  await expect(slip(page)).toBeVisible();
  await expect(labels(page)).toHaveText(['Một']);
  await tick(page, 0, true);
  await addTask(page, 'Hai');
  await expect(labels(page)).toHaveText(['Một', 'Hai']);
});

test('a failing write of the fold shows the slip, and the section still folds in memory', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await expect(slip(page)).toBeHidden();
  await page.evaluate((k) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, v) { if (key === k) throw new DOMException('Full', 'QuotaExceededError'); return set.call(this, key, v); };
  }, UI_KEY);
  await toggle(page, 'Công ty').click();
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'false');
  await expect(slip(page)).toBeVisible();
  await tick(page, 5, true); // u1, tasks key still saves
  expect((await storedJson(page, KEY)).find((t) => t.id === 'u1').done).toBe(true);
});

// T5: group choice and new group in the add form (R3 to R8, R10, R14 to R22, R55, R62)
const choice = (page) => page.getByRole('combobox', { name: 'Nhóm', exact: true });
const nameInput = (page) => page.getByRole('textbox', { name: 'Tên nhóm mới' });
const createBtn = (page) => page.getByRole('button', { name: 'Tạo nhóm' });
const groupError = (page) => page.locator('#new-group-error');
const optionTexts = (page) => choice(page).locator('option').allTextContents();
const chosenText = (page) => choice(page).evaluate((s) => s.selectedOptions[0].textContent);
const addSwatch = (page) => page.locator('#new-task-swatch');

test('the add choice lists Chưa phân nhóm, the groups and Nhóm mới..., and starts on Chưa phân nhóm after load and reload', async ({ page }) => {
  await open(page, [], '', { groups: GROUPS.slice(0, 2) });
  await expect(choice(page)).toBeVisible();
  expect(await optionTexts(page)).toEqual(['Chưa phân nhóm', 'Công ty', 'Nhà', 'Nhóm mới...']);
  expect(await chosenText(page)).toBe('Chưa phân nhóm');
  await expect(addSwatch(page)).toHaveAttribute('data-color', 'none');
  await choice(page).selectOption({ label: 'Nhà' });
  await expect(addSwatch(page)).toHaveAttribute('data-color', 'pink');
  await choice(page).selectOption({ label: 'Công ty' });
  await expect(addSwatch(page)).toHaveAttribute('data-color', 'yellow');
  await page.reload();
  expect(await chosenText(page)).toBe('Chưa phân nhóm');
  await expect(nameInput(page)).toBeHidden();
});

test('Nhóm mới... opens the name line with the next colour; Enter and Tạo nhóm create and choose the group without a task', async ({ page }) => {
  await open(page, [], '', { groups: [] });
  await page.locator('#new-task').fill('Mua sữa');
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await expect(nameInput(page)).toBeFocused();
  await expect(createBtn(page)).toBeVisible();
  await expect(page.locator('#new-group-swatch')).toHaveAttribute('data-color', 'yellow');
  await page.keyboard.type('Công ty');
  await page.keyboard.press('Enter');
  // Saved before the next action (R55), chosen, line closed, focus back, typed task text kept, no task (R16).
  expect((await storedJson(page, GROUPS_KEY)).map((g) => [g.name, g.color])).toEqual([['Công ty', 'yellow']]);
  await expect(nameInput(page)).toBeHidden();
  expect(await chosenText(page)).toBe('Công ty');
  await expect(addSwatch(page)).toHaveAttribute('data-color', 'yellow');
  await expect(page.locator('#new-task')).toBeFocused();
  await expect(page.locator('#new-task')).toHaveValue('Mua sữa');
  await expect(rows(page)).toHaveCount(0);
  expect(await storedRaw(page)).toBe('[]');

  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await expect(page.locator('#new-group-swatch')).toHaveAttribute('data-color', 'pink');
  await expect(nameInput(page)).toHaveValue('');
  await nameInput(page).fill('  Học 🏠 <b>x</b>  ');
  await createBtn(page).click();
  expect(await optionTexts(page)).toEqual(['Chưa phân nhóm', 'Công ty', 'Học 🏠 <b>x</b>', 'Nhóm mới...']);
  expect(await chosenText(page)).toBe('Học 🏠 <b>x</b>');
  expect((await storedJson(page, GROUPS_KEY))[1]).toMatchObject({ name: 'Học 🏠 <b>x</b>', color: 'pink' });
  await expect(page.locator('#new-task')).toBeFocused();
});

test('seven groups made on the fly take the colours in order and wrap', async ({ page }) => {
  await open(page, [], '', { groups: [] });
  for (const n of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
    await choice(page).selectOption({ label: 'Nhóm mới...' });
    await nameInput(page).fill(n);
    await nameInput(page).press('Enter');
  }
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.color))
    .toEqual(['yellow', 'pink', 'green', 'blue', 'orange', 'purple', 'yellow']);
});

test('name errors keep the line open and create nothing; typing clears them', async ({ page }) => {
  await open(page, [], '', { groups: GROUPS.slice(0, 1) });
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  const tries = [
    ['', 'Vui lòng nhập tên nhóm.'],
    ['   ', 'Vui lòng nhập tên nhóm.'],
    ['a'.repeat(31), 'Tên nhóm tối đa 30 ký tự.'],
    ['công ty', 'Tên nhóm này đã có rồi.'],
    ['Chưa phân nhóm', 'Tên nhóm này đã có rồi.'],
  ];
  for (const [value, message] of tries) {
    await nameInput(page).fill(value);
    await createBtn(page).click();
    await expect(groupError(page)).toHaveText(message);
    await expect(nameInput(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(nameInput(page)).toBeFocused();
  }
  await page.keyboard.press('End');
  await page.keyboard.type('x');
  await expect(groupError(page)).toBeHidden();
  await expect(nameInput(page)).not.toHaveAttribute('aria-invalid');
  expect(await storedJson(page, GROUPS_KEY)).toHaveLength(1);
  await nameInput(page).fill('b'.repeat(30));
  await nameInput(page).press('Enter');
  expect(await storedJson(page, GROUPS_KEY)).toHaveLength(2);
});

test('at 20 groups the limit error shows as soon as Nhóm mới... is chosen, and nothing is created', async ({ page }) => {
  const twenty = Array.from({ length: 20 }, (_, i) => group(`g${i}`, `Nhóm ${i + 1}`, 'yellow', i + 1));
  await open(page, [], '', { groups: twenty });
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  const message = 'Tối đa 20 nhóm. Hãy xóa bớt một nhóm trước khi tạo thêm.';
  await expect(groupError(page)).toHaveText(message);
  await expect(nameInput(page)).toBeFocused();
  await page.keyboard.type('Mới');
  await expect(groupError(page)).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(groupError(page)).toHaveText(message);
  expect(await storedJson(page, GROUPS_KEY)).toHaveLength(20);
});

test('Escape closes the line, puts the choice back and focuses it; an add while it is open uses the previous choice', async ({ page }) => {
  await open(page, [], '', { groups: GROUPS.slice(0, 2) });
  await choice(page).selectOption({ label: 'Nhà' });
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('Gia đình');
  await nameInput(page).press('Escape');
  await expect(nameInput(page)).toBeHidden();
  expect(await chosenText(page)).toBe('Nhà');
  await expect(choice(page)).toBeFocused();

  await choice(page).selectOption({ label: 'Chưa phân nhóm' });
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).press('Escape');
  expect(await chosenText(page)).toBe('Chưa phân nhóm');
  await expect(choice(page)).toBeFocused();
  expect(await storedJson(page, GROUPS_KEY)).toHaveLength(2);

  await choice(page).selectOption({ label: 'Nhà' });
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await addTask(page, 'Tưới cây');
  expect((await storedJson(page, KEY))[0].groupId).toBe('nha');
});

test('an add saves the group on the viewed day at the end of its section, keeps the choice and the focus', async ({ page }) => {
  const past = '2026-11-08';
  await open(page, [{ ...task('c0', 'Cũ', false, past, at(6, 0)), groupId: 'cty' }, task('u0', 'Khác', false, past, at(6, 1))], `#${past}`, { groups: GROUPS });
  await choice(page).selectOption({ label: 'Công ty' });
  for (const t of ['Gọi khách', 'Gửi hợp đồng', 'Đặt lịch']) await addTask(page, t);
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Cũ', 'Gọi khách', 'Gửi hợp đồng', 'Đặt lịch']);
  expect(await chosenText(page)).toBe('Công ty');
  await expect(page.locator('#new-task')).toBeFocused();
  const saved = await storedJson(page, KEY);
  expect(saved.filter((t) => t.groupId === 'cty').map((t) => [t.text, t.date])).toEqual(
    [['Cũ', past], ['Gọi khách', past], ['Gửi hợp đồng', past], ['Đặt lịch', past]]);

  // Invalid text: the existing errors, nothing saved, the choice kept.
  await addTask(page, '');
  await expect(page.locator('#new-task-error')).toHaveText('Vui lòng nhập nội dung công việc.');
  await addTask(page, 'x'.repeat(201));
  await expect(page.locator('#new-task-error')).toHaveText('Nội dung tối đa 200 ký tự.');
  expect(await storedJson(page, KEY)).toHaveLength(5);
  expect(await chosenText(page)).toBe('Công ty');

  await choice(page).selectOption({ label: 'Chưa phân nhóm' });
  await addTask(page, 'Không nhóm');
  expect((await storedJson(page, KEY)).at(-1)).not.toHaveProperty('groupId');
});

test('a group removed in another tab: the add saves ungrouped and the choice goes back to Chưa phân nhóm', async ({ page, context }) => {
  await open(page, [], '', { groups: GROUPS });
  await choice(page).selectOption({ label: 'Công ty' });
  const other = await context.newPage();
  await other.goto('./');
  await other.evaluate(([k, list]) => localStorage.setItem(k, JSON.stringify(list)), [GROUPS_KEY, GROUPS.slice(1)]);
  await other.close();
  await addTask(page, 'Gọi khách');
  expect((await storedJson(page, KEY))[0]).not.toHaveProperty('groupId');
  expect(await chosenText(page)).toBe('Chưa phân nhóm');
  expect(await optionTexts(page)).toEqual(['Chưa phân nhóm', 'Nhà', 'Học tiếng Nhật', 'Nhóm mới...']);
  await expect(page.locator('#new-task-error')).toBeHidden();
});

test('an add to a folded section opens it and stores that', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS, ui: { collapsed: ['cty'] } });
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'false');
  await choice(page).selectOption({ label: 'Công ty' });
  await addTask(page, 'Gọi khách');
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'true');
  await expect(sectionLabels(page, 'Công ty').last()).toHaveText('Gọi khách');
  await expect(sectionLabels(page, 'Công ty').last()).toBeVisible();
  expect(await storedJson(page, UI_KEY)).toEqual({ collapsed: [] });
});

test('keyboard only: input, group choice, Thêm; Nhóm mới..., name, Tạo nhóm', async ({ page }) => {
  await open(page, [], '', { groups: GROUPS.slice(0, 1) });
  const kb = page.keyboard;
  await expect(page.locator('#new-task')).toBeFocused();
  await kb.press('Tab');
  await expect(choice(page)).toBeFocused();
  await kb.press('Tab');
  await expect(page.getByRole('button', { name: 'Thêm' })).toBeFocused();
  await kb.press('Shift+Tab');
  // Arrow keys change a focused native select without opening its list (Chromium on Linux).
  await kb.press('ArrowDown');
  expect(await chosenText(page)).toBe('Công ty');
  await kb.press('ArrowDown');
  await expect(nameInput(page)).toBeFocused();
  await kb.type('Nhà');
  await kb.press('Tab');
  await expect(createBtn(page)).toBeFocused();
  await kb.press('Enter');
  expect(await chosenText(page)).toBe('Nhà');
  await expect(page.locator('#new-task')).toBeFocused();
  await kb.type('Tưới cây');
  await kb.press('Enter');
  await expect(sectionLabels(page, 'Nhà')).toHaveText(['Tưới cây']);
});

test('storage blocked: a group made on the fly works in memory and the slip shows', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () { throw new DOMException('Blocked', 'SecurityError'); };
  });
  await open(page, null);
  await expect(slip(page)).toBeVisible();
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('Công ty');
  await nameInput(page).press('Enter');
  expect(await chosenText(page)).toBe('Công ty');
  await addTask(page, 'Gọi khách');
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Gọi khách']);
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('CÔNG TY');
  await nameInput(page).press('Enter');
  await expect(groupError(page)).toHaveText('Tên nhóm này đã có rồi.');
});

test('a failing groups write keeps the new group in memory and shows the slip', async ({ page }) => {
  await open(page, [], '', { groups: [] });
  await page.evaluate((k) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, v) { if (key === k) throw new DOMException('Full', 'QuotaExceededError'); return set.call(this, key, v); };
  }, GROUPS_KEY);
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('Công ty');
  await createBtn(page).click();
  expect(await chosenText(page)).toBe('Công ty');
  await expect(slip(page)).toBeVisible();
});

test('200 tasks in 20 groups: an add to a group stays under 100 ms', async ({ page }) => {
  const gs = Array.from({ length: 20 }, (_, i) => group(`g${i}`, `Nhóm ${i + 1}`, 'yellow', i + 1));
  const big = Array.from({ length: 200 }, (_, i) => ({ ...task(`t${i}`, `Việc số ${i + 1}`, false, TODAY, i + 1), groupId: `g${i % 20}` }));
  await open(page, big, '', { groups: gs });
  await choice(page).selectOption({ label: 'Nhóm 7' });
  await page.locator('#new-task').fill('Việc mới');
  const ms = await page.evaluate(() => {
    const t0 = performance.now();
    document.getElementById('add-form').requestSubmit();
    void document.body.offsetHeight;
    return performance.now() - t0;
  });
  expect(ms).toBeLessThan(100);
  await expect(rows(page)).toHaveCount(201);
});

// T5 QA additions: IME and pasted diacritics, double submit, two pages, accessible names (R63a)
test('IME: Enter that commits a composition does not create the group; Enter after it does', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP IME is Chromium only');
  await open(page, [], '', { groups: [] });
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).focus();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'Cong tyj', selectionStart: 8, selectionEnd: 8 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Process', code: 'Enter', windowsVirtualKeyCode: 229 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  expect(await storedJson(page, GROUPS_KEY)).toEqual([]);
  await cdp.send('Input.insertText', { text: 'Công ty' });
  await expect(nameInput(page)).toHaveValue('Công ty');
  await nameInput(page).press('Enter');
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.name)).toEqual(['Công ty']);
  expect(await storedRaw(page)).toBe('[]');
});

test('pasted decomposed diacritics: a duplicate of a composed name is found, 30 visible characters are accepted', async ({ page }) => {
  await open(page, [], '', { groups: [group('c', 'Công ty'.normalize('NFC'))] });
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('CÔNG TY'.normalize('NFD'));
  await createBtn(page).click();
  await expect(groupError(page)).toHaveText('Tên nhóm này đã có rồi.');
  await nameInput(page).fill('Ướcmơđẹpnhấtcủađờingườitốtxy'.normalize('NFD')); // 29 visible, more than 30 code points
  await createBtn(page).click();
  await expect(nameInput(page)).toBeHidden();
  expect(await storedJson(page, GROUPS_KEY)).toHaveLength(2);
});

test('Enter twice and a double click on Tạo nhóm make one group', async ({ page }) => {
  await open(page, [], '', { groups: [] });
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('Nhà');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  expect(await storedJson(page, GROUPS_KEY)).toHaveLength(1);
  expect(await storedRaw(page)).toBe('[]'); // the second Enter hits the empty add input: an error, no task
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('Khác');
  await createBtn(page).dblclick({ force: true }).catch(() => {});
  expect(await storedJson(page, GROUPS_KEY)).toHaveLength(2);
});

test('another page adds a group: the choice lists it, an open line keeps its text, and the same name is now a duplicate', async ({ page, context }) => {
  await open(page, [], '', { groups: [group('a', 'A', 'yellow', 1)] });
  const other = await context.newPage();
  await other.goto('./');
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('Công ty');
  await other.evaluate(([k, v]) => localStorage.setItem(k, v), [GROUPS_KEY, JSON.stringify([group('a', 'A', 'yellow', 1), group('b', 'Công ty', 'pink', 2)])]);
  await expect(choice(page).locator('option')).toHaveText(['Chưa phân nhóm', 'A', 'Công ty', 'Nhóm mới...']);
  await expect(nameInput(page)).toHaveValue('Công ty');
  await nameInput(page).press('Enter');
  await expect(groupError(page)).toHaveText('Tên nhóm này đã có rồi.');
  expect(await storedJson(page, GROUPS_KEY)).toHaveLength(2);
});

// Covers the BUG-006 fix: the colour shown on an open line follows a group added in another page.
test('another page adds a group: the open line swatch shows the new next colour (BUG-006)', async ({ page, context }) => {
  await open(page, [], '', { groups: [group('a', 'A', 'yellow', 1)] });
  const other = await context.newPage();
  await other.goto('./');
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await expect(page.locator('#new-group-swatch')).toHaveAttribute('data-color', 'pink');
  await other.evaluate(([k, v]) => localStorage.setItem(k, v), [GROUPS_KEY, JSON.stringify([group('a', 'A', 'yellow', 1), group('b', 'B', 'pink', 2)])]);
  await expect(choice(page).locator('option')).toHaveCount(4);
  await expect(page.locator('#new-group-swatch')).toHaveAttribute('data-color', 'green');
});

test('accessible names of the add form keep their visible text (R63a)', async ({ page }) => {
  await open(page, [], '', { groups: GROUPS.slice(0, 1) });
  await expect(page.getByRole('button', { name: 'Thêm', exact: true })).toBeVisible();
  await expect(choice(page)).toBeVisible();
  await expect(page.locator('#new-task-swatch')).toHaveAttribute('aria-hidden', 'true');
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await expect(nameInput(page)).toHaveAttribute('placeholder', 'Tên nhóm mới');
  await expect(createBtn(page)).toHaveText('Tạo nhóm');
  await expect(page.locator('#new-group-swatch')).toHaveAttribute('aria-hidden', 'true');
  await createBtn(page).click();
  await expect(groupError(page)).toHaveAttribute('role', 'alert');
  await expect(page.locator('#new-task-error')).toBeHidden(); // one field-error at a time in the add form
});

test('an Enter that ends an IME composition (Safari keyCode 229) does not create the group', async ({ page }) => {
  await open(page, [], '', { groups: [] });
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('Nhật');
  await nameInput(page).evaluate((el) => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true, cancelable: true }));
  });
  await expect(nameInput(page)).toBeVisible();
  expect(await storedJson(page, GROUPS_KEY)).toEqual([]);
  await nameInput(page).press('Enter');
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.name)).toEqual(['Nhật']);
});

test('an Escape that ends an IME composition (Safari keyCode 229) keeps the name line open', async ({ page }) => {
  await open(page, [], '', { groups: [] });
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('Nhật');
  await nameInput(page).evaluate((el) => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 229, bubbles: true, cancelable: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true }));
  });
  await expect(nameInput(page)).toBeVisible();
  await expect(nameInput(page)).toHaveValue('Nhật');
  await nameInput(page).press('Escape');
  await expect(nameInput(page)).toBeHidden();
  await expect(choice(page)).toBeFocused();
});

test('a session whose groups could not be saved keeps its memory groups when another page changes them', async ({ page, context }) => {
  await open(page, [], '', { groups: [] });
  await page.evaluate((k) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, v) { if (key === k) throw new DOMException('Full', 'QuotaExceededError'); return set.call(this, key, v); };
  }, GROUPS_KEY);
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('Công ty');
  await nameInput(page).press('Enter');
  await expect(page.locator('#storage-slip')).toBeVisible();
  const other = await context.newPage();
  await other.goto('./');
  await other.evaluate((k) => localStorage.setItem(k, JSON.stringify([{ id: 'x', name: 'Khác', color: 'pink', createdAt: 1 }])), GROUPS_KEY);
  await other.close();
  await page.waitForTimeout(100);
  expect(await optionTexts(page)).toEqual(['Chưa phân nhóm', 'Công ty', 'Nhóm mới...']);
  expect(await chosenText(page)).toBe('Công ty');
  await expect(page.locator('#storage-slip')).toBeVisible();
});

// T6: move a task through the edit form (R23 to R28, R32, R64)
const rowOf = (page, text) => rows(page).filter({ has: page.locator('.task__label').getByText(text, { exact: true }) });
const editOf = (page, text) => rowOf(page, text).getByRole('button', { name: 'Sửa' });
const editField = (page) => page.locator('.task__edit .input');
const editChoice = (page) => page.locator('.task__edit').getByRole('combobox', { name: 'Nhóm', exact: true });
const editSwatch = (page) => page.locator('.task__edit .swatch');
const srStatus = (page) => page.locator('#sr-status');
const byId = async (page, id) => (await storedJson(page, KEY)).find((t) => t.id === id);

test('Sửa shows the group choice with the current group selected, Chưa phân nhóm for ungrouped and unknown groups', async ({ page }) => {
  const tasks = [...DAY, { ...task('x', 'Nhóm đã mất', false, TODAY, at(9, 0)), groupId: 'gone' }];
  await open(page, tasks, '', { groups: GROUPS });
  await editOf(page, 'Gửi báo cáo').click();
  await expect(editChoice(page)).toHaveValue('cty');
  expect(await editChoice(page).locator('option').allTextContents()).toEqual(['Chưa phân nhóm', 'Công ty', 'Nhà', 'Học tiếng Nhật']);
  await expect(editSwatch(page)).toHaveAttribute('data-color', 'yellow');
  await expect(editSwatch(page)).toHaveAttribute('aria-hidden', 'true');
  await expect(rowOf(page, 'Gửi báo cáo').locator('.task__edit-group')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hủy', exact: true })).toBeVisible();
  await editChoice(page).selectOption({ label: 'Nhà' });
  await expect(editSwatch(page)).toHaveAttribute('data-color', 'pink');
  await editField(page).press('Escape');
  for (const text of ['Đọc sách', 'Nhóm đã mất']) {
    await editOf(page, text).click();
    await expect(editChoice(page)).toHaveValue('none');
    await expect(editSwatch(page)).toHaveAttribute('data-color', 'none');
    await editField(page).press('Escape');
  }
});

test('Lưu saves text and group together: the row lands by creation time, the folded section opens, focus on Sửa, name announced', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS, ui: { collapsed: ['cty'] } });
  await editOf(page, 'Đọc sách').click(); // 08:20, between Gửi báo cáo 08:10 and Họp nhóm 08:40
  await editField(page).fill('Đọc tài liệu');
  await editChoice(page).selectOption({ label: 'Công ty' });
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Gửi báo cáo', 'Đọc tài liệu', 'Họp nhóm', 'Trả lời email']);
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'true');
  expect((await storedJson(page, UI_KEY)).collapsed).toEqual([]);
  await expect(names(page)).toHaveText(['Công ty', 'Nhà']); // Chưa phân nhóm is empty now
  await expect(counts(page)).toHaveText(['1/4', '1/2']);
  await expect(editOf(page, 'Đọc tài liệu')).toBeFocused();
  await expect(rowOf(page, 'Đọc tài liệu')).toHaveClass(/task--moved/);
  await expect(srStatus(page)).toHaveText('Đã chuyển việc sang nhóm "Công ty".');
  await expect(srStatus(page)).toHaveAttribute('aria-live', 'polite');
  expect(await byId(page, 'u1')).toEqual({ ...DAY[2], text: 'Đọc tài liệu', groupId: 'cty' });
  await expect(rowOf(page, 'Đọc tài liệu')).not.toHaveClass(/task--moved/, { timeout: 4000 }); // the wash plays once

  // Enter does the same, and a done task stays done on its day.
  await editOf(page, 'Nấu cơm').click();
  await editChoice(page).selectOption({ label: 'Học tiếng Nhật' });
  await editField(page).press('Enter');
  await expect(names(page)).toHaveText(['Công ty', 'Nhà', 'Học tiếng Nhật']);
  await expect(rowOf(page, 'Nấu cơm').getByRole('checkbox')).toBeChecked();
  await expect(editOf(page, 'Nấu cơm')).toBeFocused();
  await expect(srStatus(page)).toHaveText('Đã chuyển việc sang nhóm "Học tiếng Nhật".');
  expect(await byId(page, 'n2')).toEqual({ ...DAY[3], groupId: 'jp' });
  await expect(summary(page)).toHaveText('Đã hoàn thành 2/6 việc');

  await page.reload(); // the move is saved
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Gửi báo cáo', 'Đọc tài liệu', 'Họp nhóm', 'Trả lời email']);
  await expect(sectionLabels(page, 'Học tiếng Nhật')).toHaveText(['Nấu cơm']);
});

test('Hủy and Escape keep the old text and the old group', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  const before = await storedRaw(page);
  await editOf(page, 'Tưới cây').click();
  await editField(page).fill('Đổi');
  await editChoice(page).selectOption({ label: 'Công ty' });
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(editOf(page, 'Tưới cây')).toBeFocused();
  await editOf(page, 'Tưới cây').click();
  await expect(editChoice(page)).toHaveValue('nha');
  await editChoice(page).selectOption({ label: 'Công ty' });
  await editChoice(page).press('Escape');
  await expect(editOf(page, 'Tưới cây')).toBeFocused();
  await expect(sectionLabels(page, 'Nhà')).toHaveText(['Tưới cây', 'Nấu cơm']);
  expect(await storedRaw(page)).toBe(before);
});

test('invalid text keeps the edit open and changes neither text nor group', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  const before = await storedRaw(page);
  await editOf(page, 'Tưới cây').click();
  await editChoice(page).selectOption({ label: 'Công ty' });
  for (const text of ['   ', 'a'.repeat(201)]) {
    await editField(page).fill(text);
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.locator('.task__edit .field-error')).toBeVisible();
    await expect(editField(page)).toBeFocused();
    await expect(editChoice(page)).toHaveValue('cty');
    expect(await storedRaw(page)).toBe(before);
  }
  await expect(sectionLabels(page, 'Nhà')).toHaveText(['Tưới cây', 'Nấu cơm']);
  await expect(srStatus(page)).toHaveText('');
});

test('a move works on a past and a future day', async ({ page }) => {
  const past = { ...task('p', 'Việc hôm trước', true, '2026-11-05', at(8, 0)), groupId: 'nha' };
  const future = task('f', 'Việc tuần sau', false, '2026-11-12', at(8, 0));
  await open(page, [past, future], '#2026-11-05', { groups: GROUPS });
  await editOf(page, 'Việc hôm trước').click();
  await editChoice(page).selectOption({ label: 'Công ty' });
  await editField(page).press('Enter');
  await expect(names(page)).toHaveText(['Công ty']);
  expect(await byId(page, 'p')).toEqual({ ...past, groupId: 'cty' });
  await page.goto('./#2026-11-12');
  await editOf(page, 'Việc tuần sau').click();
  await editChoice(page).selectOption({ label: 'Nhà' });
  await editField(page).press('Enter');
  await expect(names(page)).toHaveText(['Nhà']);
  expect(await byId(page, 'f')).toEqual({ ...future, groupId: 'nha' });
});

test('plain list to sections and back: a move to Chưa phân nhóm removes groupId', async ({ page }) => {
  const plain = [task('a', 'Một', false, TODAY, at(8, 0)), task('b', 'Hai', false, TODAY, at(8, 10)), task('c', 'Ba', false, TODAY, at(8, 20))];
  await open(page, plain, '', { groups: GROUPS });
  await expect(sections(page)).toHaveCount(0);
  await editOf(page, 'Hai').click();
  await editChoice(page).selectOption({ label: 'Công ty' });
  await editField(page).press('Enter');
  await expect(names(page)).toHaveText(['Công ty', 'Chưa phân nhóm']);
  await expect(counts(page)).toHaveText(['0/1', '0/2']);
  await expect(editOf(page, 'Hai')).toBeFocused();
  await editOf(page, 'Hai').click();
  await editChoice(page).selectOption({ label: 'Chưa phân nhóm' });
  await editField(page).press('Enter');
  await expect(sections(page)).toHaveCount(0);
  await expect(labels(page)).toHaveText(['Một', 'Hai', 'Ba']);
  await expect(editOf(page, 'Hai')).toBeFocused();
  await expect(srStatus(page)).toHaveText('Đã chuyển việc sang nhóm "Chưa phân nhóm".');
  expect(await storedRaw(page)).toBe(JSON.stringify(plain));
});

test('text only, group only and no change: an unchanged choice never rewrites the group', async ({ page }) => {
  const tasks = [...DAY, { ...task('x', 'Nhóm đã mất', false, TODAY, at(9, 0)), groupId: 'gone' }];
  await open(page, tasks, '', { groups: GROUPS });
  await editOf(page, 'Nhóm đã mất').click();
  await editField(page).fill('Nhóm cũ');
  await editField(page).press('Enter');
  expect(await byId(page, 'x')).toEqual({ ...tasks[6], text: 'Nhóm cũ' }); // unknown group kept (R58)
  await expect(srStatus(page)).toHaveText('');
  await editOf(page, 'Họp nhóm').click();
  await editChoice(page).selectOption({ label: 'Nhà' });
  await editField(page).press('Enter');
  expect(await byId(page, 'c2')).toEqual({ ...DAY[4], groupId: 'nha' });
  const before = await storedRaw(page);
  await editOf(page, 'Họp nhóm').click();
  await editField(page).press('Enter');
  await expect(page.locator('.task__edit')).toHaveCount(0);
  await expect(page.locator('.field-error:visible')).toHaveCount(0);
  expect(await storedRaw(page)).toBe(before);
});

test('a group removed in another page while the edit is open: the task saves ungrouped', async ({ page, context }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await editOf(page, 'Đọc sách').click();
  await editChoice(page).selectOption({ label: 'Học tiếng Nhật' });
  const other = await context.newPage();
  await other.goto('./');
  await other.evaluate(([k, list]) => localStorage.setItem(k, JSON.stringify(list)), [GROUPS_KEY, GROUPS.slice(0, 2)]);
  await other.close();
  await page.waitForTimeout(100);
  await editField(page).press('Enter');
  expect(await byId(page, 'u1')).toEqual(DAY[2]);
  await expect(sectionLabels(page, 'Chưa phân nhóm')).toHaveText(['Đọc sách']);
});

test('keyboard only: text, group choice, Hủy, Lưu; Enter saves and Escape cancels', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await editOf(page, 'Tưới cây').focus();
  await page.keyboard.press('Enter');
  await expect(editField(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(editChoice(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Hủy', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Lưu', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Escape');
  await expect(editOf(page, 'Tưới cây')).toBeFocused();
  await expect(page.locator('.task__edit')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await editChoice(page).focus();
  await page.keyboard.press('ArrowUp'); // Nhà -> Công ty
  await expect(editChoice(page)).toHaveValue('cty');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Tưới cây', 'Gửi báo cáo', 'Họp nhóm', 'Trả lời email']);
  await expect(editOf(page, 'Tưới cây')).toBeFocused();
});

test('an Enter or Escape that ends an IME composition (Safari keyCode 229) neither saves nor cancels the edit', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  const before = await storedRaw(page);
  await editOf(page, 'Tưới cây').click();
  await editChoice(page).selectOption({ label: 'Công ty' });
  await editField(page).fill('Tưới cây cảnh');
  await editField(page).evaluate((el) => {
    for (const key of ['Enter', 'Escape']) el.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode: 229, bubbles: true, cancelable: true }));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true, cancelable: true }));
  });
  await expect(editField(page)).toBeVisible();
  await expect(editField(page)).toHaveValue('Tưới cây cảnh');
  expect(await storedRaw(page)).toBe(before);
  await editField(page).press('Enter');
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Tưới cây cảnh', 'Gửi báo cáo', 'Họp nhóm', 'Trả lời email']);
});

test('on a phone the swipe and Sửa reach the edit form inside a section; the form fits 360 px', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page, DAY, '', { groups: GROUPS });
  await page.evaluate((k) => localStorage.setItem(k, '1'), HINT);
  const swipe = rowOf(page, 'Tưới cây').locator('.task__swipe');
  await touchDrag(page, swipe, -200);
  await expect.poll(() => swipe.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
  await editOf(page, 'Tưới cây').click();
  await expect(editChoice(page)).toHaveValue('nha');
  for (const el of [editChoice(page), page.getByRole('button', { name: 'Lưu', exact: true })]) {
    const b = await el.boundingBox();
    expect(b.x + b.width).toBeLessThanOrEqual(360);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await editChoice(page).selectOption({ label: 'Công ty' });
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(sectionLabels(page, 'Công ty').first()).toHaveText('Tưới cây');
  await expect(editOf(page, 'Tưới cây')).toBeFocused();
});

// BUG-010: measured settled (like day-nav T7-07, BUG-002). closeSwipes used to read scrollLeft of every strip on focus,
// forcing a layout of all 200 rows (250 to 300 ms on an idle host); it now touches only the open strip.
test('200 tasks in 20 groups: a move on a settled page stays under 100 ms (BUG-010)', async ({ page }) => {
  const gs = Array.from({ length: 20 }, (_, i) => group(`g${i}`, `Nhóm ${i + 1}`, 'yellow', i + 1));
  const big = Array.from({ length: 200 }, (_, i) => ({ ...task(`t${i}`, `Việc số ${i + 1}`, false, TODAY, i + 1), groupId: `g${i % 20}` }));
  await open(page, big, '', { groups: gs });
  await editOf(page, 'Việc số 1').click();
  await editChoice(page).selectOption({ label: 'Nhóm 7' });
  await page.waitForTimeout(500); // let the page settle: an idle page is the slow case (the CPU clocks down)
  const ms = await page.evaluate(() => {
    const t0 = performance.now();
    document.querySelector('.task__edit').requestSubmit();
    void document.body.offsetHeight;
    return performance.now() - t0;
  });
  expect(ms).toBeLessThan(100);
  await expect(section(page, 'Nhóm 7').locator('.task__label').first()).toHaveText('Việc số 1');
  await expect(rows(page)).toHaveCount(200);
});

// T6 QA additions: storage failure, equal creation times, phone focus, names and repeated announcements
test('a failing write during a move: slip shown, the move still shows, focus on Sửa, name announced', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await editOf(page, 'Tưới cây').click();
  await editChoice(page).selectOption({ label: 'Công ty' });
  await page.evaluate((k) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, v) { if (key === k) throw new DOMException('Full', 'QuotaExceededError'); return set.call(this, key, v); };
  }, KEY);
  await editField(page).press('Enter');
  await expect(slip(page)).toBeVisible();
  await expect(sectionLabels(page, 'Công ty').first()).toHaveText('Tưới cây');
  await expect(editOf(page, 'Tưới cây')).toBeFocused();
  await expect(srStatus(page)).toHaveText('Đã chuyển việc sang nhóm "Công ty".');
  expect((await byId(page, 'n1')).groupId).toBe('nha'); // storage kept the old value
});

test('equal creation times in different groups keep a stable order after a move and a reload', async ({ page }) => {
  const same = [{ ...task('a', 'Việc A', false, TODAY, at(8, 0)), groupId: 'cty' }, { ...task('b', 'Việc B', false, TODAY, at(8, 0)), groupId: 'nha' }];
  await open(page, same, '', { groups: GROUPS });
  await editOf(page, 'Việc B').click();
  await editChoice(page).selectOption({ label: 'Công ty' });
  await editField(page).press('Enter');
  const order = await sectionLabels(page, 'Công ty').allTextContents();
  expect(order.sort()).toEqual(['Việc A', 'Việc B']);
  const first = await sectionLabels(page, 'Công ty').allTextContents();
  await page.reload();
  expect(await sectionLabels(page, 'Công ty').allTextContents()).toEqual(first);
});

for (const width of [390, 360]) {
  test(`phone ${width}px: after a move focus is on Sửa and the swipe strip stays closed`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout only');
    await page.setViewportSize({ width, height: 780 });
    await open(page, DAY, '', { groups: GROUPS });
    await page.evaluate((k) => localStorage.setItem(k, '1'), HINT);
    const swipe = () => rowOf(page, 'Tưới cây').locator('.task__swipe');
    await touchDrag(page, swipe(), -200);
    await editOf(page, 'Tưới cây').click();
    await editChoice(page).selectOption({ label: 'Công ty' });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(editOf(page, 'Tưới cây')).toBeFocused();
    expect(await swipe().evaluate((el) => el.scrollLeft)).toBe(0);
    await page.waitForTimeout(400);
    expect(await swipe().evaluate((el) => el.scrollLeft)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test('while an edit is open both group selects are named Nhóm; the edit one keeps its visible text in its name', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await editOf(page, 'Tưới cây').click();
  await expect(page.getByRole('combobox', { name: 'Nhóm', exact: true })).toHaveCount(2);
  const label = await rowOf(page, 'Tưới cây').locator('.task__edit-group label').textContent();
  expect(label.trim()).toBe('Nhóm');
});

test('two moves to the same group each rewrite the live region', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await page.evaluate(() => {
    window.__mut = 0;
    new MutationObserver((l) => { window.__mut += l.length; }).observe(document.getElementById('sr-status'), { childList: true, characterData: true, subtree: true });
  });
  for (const text of ['Tưới cây', 'Nấu cơm']) {
    await editOf(page, text).click();
    await editChoice(page).selectOption({ label: 'Học tiếng Nhật' });
    await editField(page).press('Enter');
    await expect(editOf(page, text)).toBeFocused();
    // The message is written a frame after the region is cleared.
    await expect(srStatus(page)).toHaveText('Đã chuyển việc sang nhóm "Học tiếng Nhật".');
  }
  // First move: one write. Second move: a clear, then the same text again.
  expect(await page.evaluate(() => window.__mut)).toBeGreaterThanOrEqual(3);
});

// T7: group bar and filter (R28, R41 to R50, R62, R63a)
const filterSel = (page) => page.getByRole('combobox', { name: 'Lọc theo nhóm', exact: true });
const manageBtn = (page) => page.getByRole('button', { name: 'Quản lý nhóm', exact: true });
const groupEmpty = (page) => page.locator('#group-empty');
const notice = (page) => page.locator('#notice');
const dayEmpty = (page) => page.locator('#empty');
const storedAll = (page) => page.evaluate((ks) => ks.map((k) => localStorage.getItem(k)), [KEY, GROUPS_KEY, UI_KEY]);

test('no filter before the first group, Quản lý nhóm on every day, and the filter appears once a group is made', async ({ page }) => {
  await open(page, [task('a', 'Một')]);
  for (const move of ['prev-day', 'next-day', 'next-day']) {
    await expect(manageBtn(page)).toBeVisible();
    await expect(filterSel(page)).toBeHidden();
    await expect(page.locator('.group-bar__icon')).toBeHidden();
    await page.locator(`#${move}`).click();
  }
  await page.locator('#to-today').click();
  await choice(page).selectOption('new');
  await nameInput(page).fill('Công ty');
  await nameInput(page).press('Enter');
  await expect(filterSel(page)).toBeVisible();
  await expect(filterSel(page)).toHaveValue('all');
});

test('the filter sits between the add form and the list and lists Tất cả nhóm, Chưa phân nhóm, then the groups', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS.slice(0, 2) });
  await expect(filterSel(page).locator('option')).toHaveText(['Tất cả nhóm', 'Chưa phân nhóm', 'Công ty', 'Nhà']);
  await expect(filterSel(page)).toHaveValue('all');
  await expect(page.locator('.group-bar')).not.toHaveClass(/group-bar--filtered/);
  await expect(page.locator('#group-filter-swatch')).toBeHidden(); // no mini label for Tất cả nhóm
  const top = async (sel) => (await page.locator(sel).boundingBox()).y;
  expect(await top('#add-form')).toBeLessThan(await top('.group-bar'));
  expect(await top('.group-bar')).toBeLessThan(await top('#day-list'));
});

test('a group in the filter shows only its section, open and without a toggle; the stored fold is kept', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS, ui: { collapsed: ['cty'] } });
  const ui = await page.evaluate((k) => localStorage.getItem(k), UI_KEY);
  await filterSel(page).selectOption({ label: 'Công ty' });
  await expect(names(page)).toHaveText(['Công ty']);
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Gửi báo cáo', 'Họp nhóm', 'Trả lời email']);
  await expect(sectionLabels(page, 'Công ty').first()).toBeVisible();
  await expect(sections(page).locator('button.group__toggle')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Nhóm Công ty 1/3 việc đã hoàn thành']);
  await expect(page.locator('.group-bar')).toHaveClass(/group-bar--filtered/);
  await expect(page.locator('#group-filter-swatch')).toHaveAttribute('data-color', 'yellow');
  await expect(page.locator('.group-bar__icon')).toBeVisible();

  await filterSel(page).selectOption('all');
  await expect(names(page)).toHaveText(['Công ty', 'Nhà', 'Chưa phân nhóm']);
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.group-bar')).not.toHaveClass(/group-bar--filtered/);
  expect(await page.evaluate((k) => localStorage.getItem(k), UI_KEY)).toBe(ui);
});

test('Chưa phân nhóm in the filter shows ungrouped tasks and tasks of an unknown group', async ({ page }) => {
  const lost = { ...task('x', 'Việc lạc nhóm', false, TODAY, at(9, 0)), groupId: 'gone' };
  await open(page, [...DAY, lost], '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Chưa phân nhóm' });
  await expect(names(page)).toHaveText(['Chưa phân nhóm']);
  await expect(sectionLabels(page, 'Chưa phân nhóm')).toHaveText(['Đọc sách', 'Việc lạc nhóm']);
  await expect(page.locator('#group-filter-swatch')).toHaveAttribute('data-color', 'none');
  await expect(page.locator('#group-filter-swatch')).toBeVisible();
});

test('filter empty states: a group, Chưa phân nhóm, and the usual empty state on a day with no tasks', async ({ page }) => {
  const grouped = DAY.filter((t) => t.groupId);
  await open(page, grouped, '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Học tiếng Nhật' });
  await expect(groupEmpty(page)).toHaveText('Ngày này chưa có việc nào trong nhóm "Học tiếng Nhật".');
  await expect(rows(page)).toHaveCount(0);
  await expect(dayEmpty(page)).toBeHidden();
  await filterSel(page).selectOption({ label: 'Chưa phân nhóm' });
  await expect(groupEmpty(page)).toHaveText('Ngày này không có việc nào chưa phân nhóm.');
  await expect(page.locator('#summary')).toHaveText('Đã hoàn thành 2/5 việc');

  // A day with no tasks at all keeps its own empty state, for each kind of day.
  for (const [move, text] of [
    ['next-day', 'Ngày này chưa có việc nào. Hãy thêm việc để chuẩn bị nhé!'],
    ['prev-day', null],
    ['prev-day', 'Ngày này chưa có việc nào được ghi lại.'],
  ]) {
    await page.locator(`#${move}`).click();
    if (!text) continue;
    await expect(dayEmpty(page)).toBeVisible();
    await expect(page.locator('#empty-text')).toHaveText(text);
    await expect(groupEmpty(page)).toBeHidden();
  }
  await page.locator('#to-today').click();
  await page.evaluate((k) => localStorage.setItem(k, '[]'), KEY);
  await page.reload();
  await filterSel(page).selectOption({ label: 'Công ty' });
  await expect(page.locator('#empty-text')).toHaveText('Hôm nay chưa có việc nào. Hãy thêm việc đầu tiên nhé!');
  await expect(groupEmpty(page)).toBeHidden();
});

test('the filter follows previous, next, the picker, Về hôm nay, Back and Forward, and resets on reload', async ({ page }) => {
  const other = [
    { ...task('y1', 'Hôm qua ở công ty', false, '2026-11-08', at(8, 0)), groupId: 'cty' },
    { ...task('y2', 'Hôm qua ở nhà', false, '2026-11-08', at(8, 1)), groupId: 'nha' },
    { ...task('t1', 'Ngày mai ở nhà', false, '2026-11-10', at(8, 0)), groupId: 'nha' },
  ];
  await open(page, [...DAY, ...other], '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Công ty' });
  await page.locator('#prev-day').click();
  await expect(labels(page)).toHaveText(['Hôm qua ở công ty']);
  await page.locator('#next-day').click();
  await page.locator('#next-day').click();
  await expect(groupEmpty(page)).toHaveText('Ngày này chưa có việc nào trong nhóm "Công ty".');
  await page.locator('#day-picker').fill('2026-11-08');
  await expect(labels(page)).toHaveText(['Hôm qua ở công ty']);
  await page.locator('#to-today').click();
  await expect(labels(page)).toHaveText(['Gửi báo cáo', 'Họp nhóm', 'Trả lời email']);
  await page.goBack();
  await expect(labels(page)).toHaveText(['Hôm qua ở công ty']);
  await page.goForward();
  await expect(labels(page)).toHaveText(['Gửi báo cáo', 'Họp nhóm', 'Trả lời email']);
  await expect(filterSel(page)).toHaveValue('cty');
  await page.reload();
  await expect(filterSel(page)).toHaveValue('all');
  await expect(names(page)).toHaveText(['Công ty', 'Nhà', 'Chưa phân nhóm']);
});

test('the add choice follows a group and Chưa phân nhóm in the filter, but not Tất cả nhóm', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await choice(page).selectOption({ label: 'Nhà' });
  await filterSel(page).selectOption({ label: 'Công ty' });
  await expect(choice(page)).toHaveValue('cty');
  await expect(addSwatch(page)).toHaveAttribute('data-color', 'yellow');
  await filterSel(page).selectOption({ label: 'Chưa phân nhóm' });
  await expect(choice(page)).toHaveValue('none');
  await choice(page).selectOption({ label: 'Nhà' });
  await filterSel(page).selectOption('all');
  await expect(choice(page)).toHaveValue('nha');
});

test('an add to a group the filter hides is saved, the filter stays and a polite notice says so', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Công ty' });
  await choice(page).selectOption({ label: 'Nhà' });
  await addTask(page, 'Mua rau');
  await expect(notice(page)).toBeVisible();
  await expect(notice(page)).toHaveAttribute('role', 'status');
  await expect(notice(page)).toHaveText('Đã thêm việc vào nhóm "Nhà". Nhóm này đang được ẩn bởi bộ lọc.');
  await expect(filterSel(page)).toHaveValue('cty');
  await expect(labels(page)).toHaveText(['Gửi báo cáo', 'Họp nhóm', 'Trả lời email']);
  await expect(page.locator('#summary')).toHaveText('Đã hoàn thành 2/7 việc');
  await expect(page.locator('#new-task')).toBeFocused();
  const saved = (await storedJson(page, KEY)).find((t) => t.text === 'Mua rau');
  expect(saved.groupId).toBe('nha');

  // Ungrouped add under the filter names Chưa phân nhóm; an add the filter shows hides the notice.
  await choice(page).selectOption({ label: 'Chưa phân nhóm' });
  await addTask(page, 'Đọc báo');
  await expect(notice(page)).toHaveText('Đã thêm việc vào nhóm "Chưa phân nhóm". Nhóm này đang được ẩn bởi bộ lọc.');
  await choice(page).selectOption({ label: 'Công ty' });
  await addTask(page, 'Gọi khách');
  await expect(notice(page)).toBeHidden();
  await expect(labels(page)).toHaveText(['Gửi báo cáo', 'Họp nhóm', 'Trả lời email', 'Gọi khách']);

  // A day move clears the notice.
  await choice(page).selectOption({ label: 'Nhà' });
  await addTask(page, 'Rửa bát');
  await expect(notice(page)).toBeVisible();
  await page.locator('#next-day').click();
  await expect(notice(page)).toBeHidden();
});

test('an add into an empty filtered group replaces the empty text with its section', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Học tiếng Nhật' });
  await expect(groupEmpty(page)).toBeVisible();
  await addTask(page, 'Học 10 từ mới');
  await expect(groupEmpty(page)).toBeHidden();
  await expect(names(page)).toHaveText(['Học tiếng Nhật']);
  await expect(labels(page)).toHaveText(['Học 10 từ mới']);
  await expect(notice(page)).toBeHidden();
});

test('while filtered the summary, progress and stamp count the whole day', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Công ty' });
  await expect(page.locator('#summary')).toHaveText('Đã hoàn thành 2/6 việc');
  await expect(counts(page)).toHaveText(['1/3']);
  await tick(page, 1, true);
  await tick(page, 2, true);
  await expect(counts(page)).toHaveText(['3/3']);
  await expect(page.locator('#summary')).toHaveText('Đã hoàn thành 4/6 việc');
  await expect(progress(page)).not.toHaveClass(/progress--complete/); // no stamp for one group
  await filterSel(page).selectOption({ label: 'Nhà' });
  await tick(page, 0, true);
  await filterSel(page).selectOption({ label: 'Chưa phân nhóm' });
  await tick(page, 0, true);
  await expect(progress(page)).toHaveClass(/progress--complete/);
  await expect(page.locator('#summary')).toHaveText('Đã hoàn thành 6/6 việc');
});

test('a move under the filter sends focus to the next visible row, else the previous one, else the add input', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Công ty' });
  const moveTo = async (text, target) => {
    await editOf(page, text).click();
    await editChoice(page).selectOption({ label: target });
    await editField(page).press('Enter');
  };
  await moveTo('Họp nhóm', 'Nhà'); // row 2 of 3
  await expect(labels(page)).toHaveText(['Gửi báo cáo', 'Trả lời email']);
  await expect(rowOf(page, 'Trả lời email').getByRole('checkbox')).toBeFocused();
  await expect(srStatus(page)).toHaveText('Đã chuyển việc sang nhóm "Nhà".');
  await moveTo('Trả lời email', 'Nhà'); // the last row: previous one
  await expect(rowOf(page, 'Gửi báo cáo').getByRole('checkbox')).toBeFocused();
  await moveTo('Gửi báo cáo', 'Chưa phân nhóm'); // the only row: the add input
  await expect(page.locator('#new-task')).toBeFocused();
  await expect(groupEmpty(page)).toHaveText('Ngày này chưa có việc nào trong nhóm "Công ty".');
  expect((await byId(page, 'c2')).groupId).toBe('nha');
  expect((await byId(page, 'c1')).groupId).toBeUndefined();
});

test('filtering and moving between days never writes to storage', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS, ui: { collapsed: ['nha'] } });
  const before = await storedAll(page);
  for (const label of ['Công ty', 'Chưa phân nhóm', 'Học tiếng Nhật', 'Tất cả nhóm', 'Nhà']) {
    await filterSel(page).selectOption({ label });
    await page.locator('#next-day').click();
    await page.locator('#prev-day').click();
  }
  expect(await storedAll(page)).toEqual(before);
});

test('keyboard only: the filter and Quản lý nhóm follow Thêm in the Tab order and the filter changes with the keys', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await page.locator('#new-task').focus();
  const order = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    order.push(await page.evaluate(() => { const el = document.activeElement; return el.id || el.className || el.textContent.trim(); }));
  }
  expect(order).toEqual(['new-task-group', 'btn btn--primary', 'group-filter', 'manage-groups', 'group__toggle']);
  await filterSel(page).focus();
  await expect(filterSel(page)).toHaveAccessibleName('Lọc theo nhóm');
  await page.keyboard.press('ArrowDown'); // Chưa phân nhóm
  await page.keyboard.press('ArrowDown'); // Công ty
  await expect(filterSel(page)).toHaveValue('cty');
  await expect(names(page)).toHaveText(['Công ty']);
  await expect(manageBtn(page)).toHaveAccessibleName('Quản lý nhóm');
});

// Below 452 px Quản lý nhóm is icon only, so the longest realistic choices fit; from 452 px it shows its text (decisions.md).
const ICON_ONLY_BELOW = 452;
for (const width of [360, 380, 390, 412, 452, 1440]) {
  const iconOnly = width < ICON_ONLY_BELOW;
  test(`${width}px: Quản lý nhóm ${iconOnly ? 'is icon only with its name and tooltip' : 'shows its text'}, targets are 44 px, the filter choice is not cut`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await open(page, DAY, '', { groups: [...GROUPS, group('sk', 'Sức khỏe', 'blue', at(7, 3))] });
    await expect(manageBtn(page)).toHaveAccessibleName('Quản lý nhóm');
    const label = page.locator('.group-bar__manage-label');
    const b = await manageBtn(page).boundingBox();
    if (iconOnly) {
      expect((await label.boundingBox()).width).toBeLessThanOrEqual(1);
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
      await manageBtn(page).focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab'); // keyboard focus shows the tooltip
      expect(await manageBtn(page).evaluate((el) => getComputedStyle(el, '::after').content)).toContain('Quản lý nhóm');
      await expect.poll(() => manageBtn(page).evaluate((el) => getComputedStyle(el, '::after').opacity)).toBe('1');
    } else {
      expect((await label.boundingBox()).width).toBeGreaterThan(40);
      expect(await manageBtn(page).evaluate((el) => getComputedStyle(el, '::after').content)).toBe('none');
      // The 36 px button gets a 44 px tall hit area from its ::before.
      const hit = await page.evaluate(({ x, y, h }) => [y - 3, y + h + 3].map((py) => !!document.elementFromPoint(x, py)?.closest('#manage-groups')), { x: b.x + b.width / 2, y: b.y, h: b.height });
      expect(hit).toEqual([true, true]);
    }
    // The chosen name fits: the select is at least as wide as a copy of it holding only the chosen option at natural width.
    for (const label of ['Chưa phân nhóm', 'Học tiếng Nhật']) {
      await filterSel(page).selectOption({ label });
      const fits = await filterSel(page).evaluate((s) => {
        const probe = s.cloneNode(true);
        probe.value = s.value;
        probe.style.setProperty('max-width', 'none');
        probe.style.setProperty('width', 'auto');
        probe.style.setProperty('position', 'absolute');
        s.parentElement.append(probe);
        for (const o of [...probe.options]) if (!o.selected) o.remove();
        const need = probe.getBoundingClientRect().width;
        probe.remove();
        return s.getBoundingClientRect().width + 0.5 >= need;
      });
      expect(fits, label).toBe(true);
    }
    expect((await filterSel(page).boundingBox()).height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test('200 tasks in 20 groups: a filter change stays under 100 ms', async ({ page }) => {
  const gs = Array.from({ length: 20 }, (_, i) => group(`g${i}`, `Nhóm ${i + 1}`, 'yellow', i + 1));
  const big = Array.from({ length: 200 }, (_, i) => ({ ...task(`t${i}`, `Việc số ${i + 1}`, false, TODAY, i + 1), groupId: `g${i % 20}` }));
  await open(page, big, '', { groups: gs });
  const time = (value) => page.evaluate((v) => {
    const s = document.getElementById('group-filter');
    const t0 = performance.now();
    s.value = v;
    s.dispatchEvent(new Event('change', { bubbles: true }));
    void document.body.offsetHeight;
    return performance.now() - t0;
  }, value);
  expect(await time('g6')).toBeLessThan(100);
  await expect(rows(page)).toHaveCount(10);
  expect(await time('all')).toBeLessThan(100);
  await expect(rows(page)).toHaveCount(200);
});

// T7 QA additions (TC-task-groups-T7-10, T7-12 to T7-14 follow ups, storage and midnight with a filter on)
const otherTab = (page, groups) => page.evaluate(([key, value]) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }));
}, [GROUPS_KEY, groups]);

test('a group removed in another tab while it is filtered: the filter resets, the list shows all, the add choice falls back', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Học tiếng Nhật' });
  await expect(groupEmpty(page)).toBeVisible();
  await otherTab(page, GROUPS.filter((g) => g.id !== 'jp'));
  await expect(filterSel(page)).toHaveValue('all');
  await expect(filterSel(page).locator('option')).toHaveText(['Tất cả nhóm', 'Chưa phân nhóm', 'Công ty', 'Nhà']);
  await expect(groupEmpty(page)).toBeHidden();
  await expect(rows(page)).toHaveCount(6);
  await expect(choice(page)).toHaveValue('none');
});

test('the filtered group renamed in another tab stays selected; all groups removed hides the filter and shows every task', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Công ty' });
  await otherTab(page, GROUPS.map((g) => (g.id === 'cty' ? { ...g, name: 'Việc công ty' } : g)));
  await expect(filterSel(page)).toHaveValue('cty');
  await expect(filterSel(page).locator('option:checked')).toHaveText('Việc công ty');
  await expect(names(page)).toHaveText(['Việc công ty']);
  await otherTab(page, []);
  await expect(filterSel(page)).toBeHidden();
  await expect(rows(page)).toHaveCount(6);
});

test('a filter change drops an open edit on a row it hides and keeps one on a row it shows', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await rowOf(page, 'Tưới cây').getByRole('button', { name: 'Sửa' }).click();
  await editField(page).fill('Tưới cây sửa dở');
  await filterSel(page).selectOption({ label: 'Công ty' });
  await expect(page.locator('.task__edit')).toHaveCount(0);
  await filterSel(page).selectOption({ label: 'Tất cả nhóm' });
  await expect(labels(page)).toContainText(['Tưới cây']);
  expect((await storedJson(page, KEY)).find((t) => t.id === 'n1').text).toBe('Tưới cây');
  await rowOf(page, 'Tưới cây').getByRole('button', { name: 'Sửa' }).click(); // a new edit opens normally
  await expect(editField(page)).toHaveValue('Tưới cây');
  await filterSel(page).selectOption({ label: 'Nhà' });
  await expect(editField(page)).toHaveValue('Tưới cây'); // the row stays in view: its edit stays
});

test('a filter change while Nhóm mới... is open changes the add choice but keeps the line and its text', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await page.locator('#new-group-name').fill('Mới');
  await filterSel(page).selectOption({ label: 'Nhà' });
  await expect(choice(page)).toHaveValue('new');
  await expect(page.locator('#new-group-name')).toHaveValue('Mới');
  await page.locator('#new-group-name').press('Escape');
  await expect(page.locator('#new-group-name')).toHaveCount(0);
  await expect(choice(page).locator('option:checked')).toHaveText('Nhà');
});

test('midnight with a filter on keeps the filter, follows the new day and clears the notice', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Công ty' });
  await choice(page).selectOption({ label: 'Nhà' });
  await addTask(page, 'Mua rau');
  await expect(notice(page)).toBeVisible();
  await passMidnight(page);
  await expect(page.locator('#date-line')).toContainText('10/11/2026');
  await expect(filterSel(page)).toHaveValue('cty');
  await expect(groupEmpty(page)).toHaveText('Ngày này chưa có việc nào trong nhóm "Công ty".');
  await expect(notice(page)).toBeHidden();
});

// BUG-007: the notice said "this group is hidden by the filter" and stayed after the filter was changed to show it.
test('the hidden group notice goes away when the filter changes', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Công ty' });
  await choice(page).selectOption({ label: 'Nhà' });
  await addTask(page, 'Mua rau');
  await expect(notice(page)).toBeVisible();
  await filterSel(page).selectOption({ label: 'Nhà' });
  await expect(notice(page)).toBeHidden();
});

test('the filter empty text is a polite status, so it is announced when the filter shows no task', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await expect(groupEmpty(page)).toHaveAttribute('role', 'status');
  await filterSel(page).selectOption({ label: 'Học tiếng Nhật' });
  await expect(page.getByRole('status').filter({ hasText: 'Ngày này chưa có việc nào trong nhóm "Học tiếng Nhật".' })).toBeVisible();
});

test('every group removed in another tab while the filter has focus: the filter goes and focus moves to the add input', async ({ page, context }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Công ty' });
  await filterSel(page).focus();
  const other = await context.newPage();
  await other.goto('./');
  await other.evaluate((k) => localStorage.setItem(k, '[]'), GROUPS_KEY);
  await other.close();
  await expect(filterSel(page)).toBeHidden();
  await expect(page.locator('#new-task')).toBeFocused();
  await expect(labels(page)).toHaveCount(6); // back to the plain list of the whole day
  await expect(sections(page)).toHaveCount(0);
});

test('an add to a hidden group on an empty day shows the filter empty text and the notice', async ({ page }) => {
  await open(page, [], '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Công ty' });
  await expect(dayEmpty(page)).toBeVisible();
  await choice(page).selectOption({ label: 'Nhà' });
  await addTask(page, 'Mua rau');
  await expect(groupEmpty(page)).toBeVisible();
  await expect(groupEmpty(page)).toHaveText('Ngày này chưa có việc nào trong nhóm "Công ty".');
  await expect(dayEmpty(page)).toBeHidden();
  await expect(notice(page)).toHaveText('Đã thêm việc vào nhóm "Nhà". Nhóm này đang được ẩn bởi bộ lọc.');
  await expect(page.locator('#new-task')).toBeFocused();
});

// T8: the "Nhóm việc" card with rename and colour (R4 to R6, R8, R11 to R13, R35 to R38, R48, R55, R62, R63a, R65, R67)
const card = (page) => page.getByRole('dialog', { name: 'Nhóm việc' });
const cardRows = (page) => card(page).locator('.group-row');
const cardRow = (page, name) => cardRows(page).filter({ has: page.locator('.sticker').getByText(name, { exact: true }) });
const renameInput = (page) => card(page).getByRole('textbox', { name: 'Tên nhóm', exact: true });
const colours = (page) => card(page).getByRole('group', { name: 'Màu nhóm' }).getByRole('radio');
const renameError = (page) => card(page).locator('.group-row--editing .field-error');
// The drawn swatch sits over the hidden radio, so click it the way a user does.
const pickColour = (page, name) => card(page).getByRole('radio', { name }).locator('..').click();
const openCard = async (page) => { await manageBtn(page).click(); await expect(card(page)).toBeVisible(); };
const startRename = async (page, name) => { await cardRow(page, name).getByRole('button', { name: 'Sửa', exact: true }).click(); await expect(renameInput(page)).toBeFocused(); };

test('Quản lý nhóm opens Nhóm việc with a row per group in creation order and Đóng', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await expect(card(page).locator('.dialog__title')).toHaveText('Nhóm việc');
  await expect(card(page).getByRole('button', { name: 'Đóng', exact: true })).toBeVisible();
  await expect(cardRows(page).locator('.sticker')).toHaveText(['Công ty', 'Nhà', 'Học tiếng Nhật']);
  expect(await cardRows(page).locator('.sticker').evaluateAll((s) => s.map((el) => el.dataset.color))).toEqual(['yellow', 'pink', 'green']);
  for (const name of ['Công ty', 'Nhà', 'Học tiếng Nhật']) {
    const buttons = cardRow(page, name).getByRole('button');
    await expect(buttons).toHaveCount(3);
    await expect(buttons.nth(0)).toHaveAccessibleName('Sửa');
    await expect(buttons.nth(1)).toHaveAccessibleName('Chuyển tất cả việc');
    await expect(buttons.nth(2)).toHaveAccessibleName('Xóa');
    await expect(buttons.nth(0)).toHaveAccessibleDescription(name === 'Học tiếng Nhật' ? `${name} Nhóm này chưa có việc nào.` : name);
  }
  // A group with no task: the move button stays focusable but inactive, with the hint shown and linked.
  const idle = cardRow(page, 'Học tiếng Nhật').getByRole('button', { name: 'Chuyển tất cả việc' });
  await expect(idle).toHaveAttribute('aria-disabled', 'true');
  await expect(idle).toHaveAccessibleDescription(/Nhóm này chưa có việc nào\./);
  await expect(cardRow(page, 'Học tiếng Nhật').locator('.group-row__hint')).toHaveText('Nhóm này chưa có việc nào.');
  await expect(cardRow(page, 'Công ty').getByRole('button', { name: 'Chuyển tất cả việc' })).not.toHaveAttribute('aria-disabled', 'true');
  await expect(cardRow(page, 'Công ty').locator('.group-row__hint')).toHaveCount(0);
  await expect(card(page).locator('.dialog__empty')).toBeHidden();
});

test('with no groups the card says Bạn chưa có nhóm nào. on a past day, today and a future day', async ({ page }) => {
  for (const hash of ['#2026-11-01', '', '#2026-11-20']) {
    await open(page, [], hash);
    await openCard(page);
    await expect(card(page).locator('.dialog__empty')).toHaveText('Bạn chưa có nhóm nào.');
    await expect(cardRows(page)).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(card(page)).toBeHidden();
  }
});

test('Sửa shows the name in "Tên nhóm", six named colours with the current one checked, arrow keys, Hủy and Lưu', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await startRename(page, 'Nhà');
  await expect(renameInput(page)).toHaveValue('Nhà');
  await expect(colours(page)).toHaveCount(6);
  for (const [i, n] of ['Vàng', 'Hồng', 'Xanh lá', 'Xanh dương', 'Cam', 'Tím'].entries()) await expect(colours(page).nth(i)).toHaveAccessibleName(n);
  await expect(card(page).getByRole('radio', { name: 'Hồng' })).toBeChecked();
  await expect(card(page).getByRole('button', { name: 'Hủy' })).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'Lưu' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(card(page).getByRole('radio', { name: 'Hồng' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(card(page).getByRole('radio', { name: 'Xanh lá' })).toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(card(page).getByRole('radio', { name: 'Vàng' })).toBeChecked();
});

test('Lưu and Enter save the name and colour at once; headers, choices, filter and toggle names follow; tasks untouched', async ({ page }) => {
  const days = [...DAY, { ...task('c0', 'Hôm qua', false, '2026-11-08', at(6, 0)), groupId: 'cty' }];
  await open(page, days, '', { groups: GROUPS });
  const tasksBefore = await storedRaw(page);
  await openCard(page);
  await startRename(page, 'Công ty');
  await renameInput(page).fill('Việc công ty');
  await pickColour(page, 'Cam');
  await card(page).getByRole('button', { name: 'Lưu' }).click();
  // Saved at once (R55), the row is back in view with focus on its Sửa.
  expect((await storedJson(page, GROUPS_KEY))[0]).toMatchObject({ id: 'cty', name: 'Việc công ty', color: 'orange' });
  await expect(cardRow(page, 'Việc công ty').getByRole('button', { name: 'Sửa' })).toBeFocused();
  await expect(cardRow(page, 'Việc công ty').locator('.sticker')).toHaveAttribute('data-color', 'orange');
  await startRename(page, 'Nhà');
  await renameInput(page).fill('Gia đình');
  await renameInput(page).press('Enter');
  await expect(cardRow(page, 'Gia đình').getByRole('button', { name: 'Sửa' })).toBeFocused();
  await card(page).getByRole('button', { name: 'Đóng' }).click();
  await expect(card(page)).toBeHidden();
  await expect(manageBtn(page)).toBeFocused();
  await expect(names(page)).toHaveText(['Việc công ty', 'Gia đình', 'Chưa phân nhóm']);
  expect(await sections(page).evaluateAll((s) => s.map((el) => el.dataset.color))).toEqual(['orange', 'pink', 'none']);
  await expect(toggle(page, 'Việc công ty')).toHaveAccessibleName('Nhóm Việc công ty 1/3 việc đã hoàn thành');
  await expect(choice(page).locator('option')).toHaveText(['Chưa phân nhóm', 'Việc công ty', 'Gia đình', 'Học tiếng Nhật', 'Nhóm mới...']);
  await expect(filterSel(page).locator('option')).toHaveText(['Tất cả nhóm', 'Chưa phân nhóm', 'Việc công ty', 'Gia đình', 'Học tiếng Nhật']);
  await page.getByRole('button', { name: 'Xem ngày trước' }).click();
  await expect(names(page)).toHaveText(['Việc công ty']);
  expect(await storedRaw(page)).toBe(tasksBefore);
});

test('rename errors: empty, too long, a duplicate and Chưa phân nhóm; typing clears; own name in another case is fine', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await startRename(page, 'Công ty');
  const save = card(page).getByRole('button', { name: 'Lưu' });
  for (const [value, message] of [
    ['   ', 'Vui lòng nhập tên nhóm.'],
    ['x'.repeat(31), 'Tên nhóm tối đa 30 ký tự.'],
    ['nhà', 'Tên nhóm này đã có rồi.'],
    ['chưa phân nhóm', 'Tên nhóm này đã có rồi.'],
  ]) {
    await renameInput(page).fill(value);
    await save.click();
    await expect(renameError(page)).toHaveText(message);
    await expect(renameInput(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(renameInput(page)).toBeFocused();
    await expect(renameInput(page)).toHaveAccessibleDescription(message);
    await page.keyboard.type('a');
    await expect(renameError(page)).toBeHidden();
    await expect(renameInput(page)).not.toHaveAttribute('aria-invalid', 'true');
  }
  expect((await storedJson(page, GROUPS_KEY))[0].name).toBe('Công ty');
  await renameInput(page).fill('CÔNG TY');
  await renameInput(page).press('Enter');
  await expect(cardRows(page).locator('.sticker')).toHaveText(['CÔNG TY', 'Nhà', 'Học tiếng Nhật']);
});

test('Hủy and Escape cancel the row edit and keep the card open; a second Escape closes it', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  const before = await storedAll(page);
  await openCard(page);
  await startRename(page, 'Nhà');
  await renameInput(page).fill('Đổi tên');
  await pickColour(page, 'Tím');
  await card(page).getByRole('button', { name: 'Hủy' }).click();
  await expect(renameInput(page)).toHaveCount(0);
  await expect(cardRow(page, 'Nhà').getByRole('button', { name: 'Sửa' })).toBeFocused();
  await expect(cardRow(page, 'Nhà').locator('.sticker')).toHaveAttribute('data-color', 'pink');
  await startRename(page, 'Nhà');
  await renameInput(page).fill('Đổi tên');
  await page.keyboard.press('Escape');
  await expect(card(page)).toBeVisible();
  await expect(renameInput(page)).toHaveCount(0);
  await expect(cardRow(page, 'Nhà').getByRole('button', { name: 'Sửa' })).toBeFocused();
  expect(await storedAll(page)).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(card(page)).toBeHidden();
  await expect(manageBtn(page)).toBeFocused();
});

test('only one row is in edit: Sửa on another row drops the first edit unsaved', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await startRename(page, 'Công ty');
  await renameInput(page).fill('Không lưu');
  await startRename(page, 'Nhà');
  await expect(card(page).locator('.group-row--editing')).toHaveCount(1);
  await expect(renameInput(page)).toHaveValue('Nhà');
  await expect(cardRows(page).locator('.sticker')).toHaveText(['Công ty', 'Học tiếng Nhật']);
  expect((await storedJson(page, GROUPS_KEY))[0].name).toBe('Công ty');
});

test('the card does not close on a backdrop click; Đóng closes it and refreshes the page behind', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await page.mouse.click(4, 4);
  await expect(card(page)).toBeVisible();
  await card(page).getByRole('button', { name: 'Đóng' }).click();
  await expect(card(page)).toBeHidden();
  await expect(manageBtn(page)).toBeFocused();
});

test('a filtered group renamed in the card stays selected with its new name (T7-14)', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await filterSel(page).selectOption({ label: 'Công ty' });
  await openCard(page);
  await startRename(page, 'Công ty');
  await renameInput(page).fill('Việc công ty');
  await renameInput(page).press('Enter');
  await page.keyboard.press('Escape');
  await expect(filterSel(page)).toHaveValue('cty');
  await expect(filterSel(page).locator('option:checked')).toHaveText('Việc công ty');
  await expect(choice(page).locator('option:checked')).toHaveText('Việc công ty');
  await expect(names(page)).toHaveText(['Việc công ty']);
});

test('a rename keeps typed add text and an open task edit, whose group choice shows the new name', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await page.locator('#new-task').fill('Đang gõ');
  await editOf(page, 'Họp nhóm').click();
  await editField(page).fill('Họp nhóm lớn');
  await openCard(page);
  await startRename(page, 'Công ty');
  await renameInput(page).fill('Việc công ty');
  await pickColour(page, 'Xanh dương');
  await renameInput(page).press('Enter');
  // Saved names show behind the card at once, not only after it closes.
  await expect(names(page).first()).toHaveText('Việc công ty');
  await page.keyboard.press('Escape');
  await expect(page.locator('#new-task')).toHaveValue('Đang gõ');
  await expect(editField(page)).toHaveValue('Họp nhóm lớn');
  await expect(editChoice(page).locator('option:checked')).toHaveText('Việc công ty');
  await expect(editSwatch(page)).toHaveAttribute('data-color', 'blue');
});

test('a group named <b>abc</b> is plain text in the row and in the rename input', async ({ page }) => {
  await open(page, [], '', { groups: [group('x', '<b>abc</b>')] });
  await openCard(page);
  await expect(cardRow(page, '<b>abc</b>').locator('b')).toHaveCount(0);
  await startRename(page, '<b>abc</b>');
  await expect(renameInput(page)).toHaveValue('<b>abc</b>');
});

test('keyboard only: open, Tab to a row, rename, Lưu, close', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await manageBtn(page).focus();
  await page.keyboard.press('Enter');
  await expect(card(page)).toBeVisible();
  const sua = cardRow(page, 'Công ty').getByRole('button', { name: 'Sửa' });
  for (let i = 0; i < 5 && !(await sua.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(sua).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(renameInput(page)).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.type(' mới');
  await page.keyboard.press('Tab'); // the chosen colour
  await page.keyboard.press('Tab'); // Hủy
  await page.keyboard.press('Tab'); // Lưu
  await expect(card(page).getByRole('button', { name: 'Lưu' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(cardRow(page, 'Công ty mới').getByRole('button', { name: 'Sửa' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(manageBtn(page)).toBeFocused();
});

test('phones: Chuyển tất cả việc in a row is icon only and keeps its name; 20 long names fit at 360 px', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await page.setViewportSize({ width: 360, height: 740 });
  const many = Array.from({ length: 20 }, (_, i) => group(`g${i}`, `${String(i).padStart(2, '0')} ${'n'.repeat(27)}`, 'blue', NOW.getTime() + i));
  await open(page, [], '', { groups: many });
  await openCard(page);
  const move = cardRows(page).first().getByRole('button', { name: 'Chuyển tất cả việc' });
  await expect(move).toHaveAccessibleName('Chuyển tất cả việc');
  await expect(move.locator('.group-row__move-label')).toBeHidden();
  expect(await card(page).evaluate((d) => d.scrollWidth <= d.clientWidth)).toBe(true);
  // The rows scroll inside the card, which stays on screen, and the last row can be reached.
  const list = card(page).locator('.group-rows');
  expect(await list.evaluate((l) => l.scrollHeight > l.clientHeight && l.scrollWidth <= l.clientWidth)).toBe(true);
  expect(await card(page).evaluate((d) => d.getBoundingClientRect().bottom <= innerHeight)).toBe(true);
  await cardRows(page).last().getByRole('button', { name: 'Xóa' }).scrollIntoViewIfNeeded();
  await expect(cardRows(page).last().getByRole('button', { name: 'Xóa' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

// T8 QA additions: focus trap, colour by keyboard, storage failure, another tab, IME (R36 to R38, R55, R62)
test('focus stays inside the card: Tab and Shift+Tab never reach the page behind', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  // A modal dialog may hand focus to the browser itself (body), never to a control of the page behind.
  const behind = () => page.evaluate(() => { const a = document.activeElement; return a !== document.body && !a?.closest('#manage-dialog'); });
  await expect(card(page).getByRole('button', { name: 'Đóng' })).toBeFocused();
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); expect(await behind()).toBe(false); }
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Shift+Tab'); expect(await behind()).toBe(false); }
  await startRename(page, 'Nhà');
  for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); expect(await behind()).toBe(false); }
});

test('a colour chosen with arrow keys and saved with Lưu is stored (Hồng to Cam)', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await startRename(page, 'Nhà');
  await page.keyboard.press('Tab');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  await expect(card(page).getByRole('radio', { name: 'Cam' })).toBeChecked();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  expect((await storedJson(page, GROUPS_KEY))[1]).toMatchObject({ name: 'Nhà', color: 'orange' });
  await expect(cardRow(page, 'Nhà').locator('.sticker')).toHaveAttribute('data-color', 'orange');
});

test('a failing write on rename keeps working in memory, shows the slip and keeps the card usable', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await page.evaluate((k) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, v) { if (key === k) throw new DOMException('Full', 'QuotaExceededError'); return set.call(this, key, v); };
  }, GROUPS_KEY);
  await startRename(page, 'Công ty');
  await renameInput(page).fill('Việc công ty');
  await pickColour(page, 'Tím');
  await renameInput(page).press('Enter');
  await expect(cardRow(page, 'Việc công ty').getByRole('button', { name: 'Sửa' })).toBeFocused();
  await expect(page.locator('#storage-slip, .slip').first()).toBeVisible();
  expect((await storedJson(page, GROUPS_KEY))[0].name).toBe('Công ty');
  await page.keyboard.press('Escape');
  await expect(names(page).first()).toHaveText('Việc công ty');
});

test('another tab renames a group while the card is open: rows follow; a row in edit keeps the typed name', async ({ page, context }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  const other = await context.newPage();
  await other.goto('./');
  await other.evaluate(([k, list]) => localStorage.setItem(k, JSON.stringify(list)), [GROUPS_KEY, [{ ...GROUPS[0], name: 'Công ty A' }, ...GROUPS.slice(1)]]);
  await expect(cardRows(page).locator('.sticker')).toHaveText(['Công ty A', 'Nhà', 'Học tiếng Nhật']);
  await expect(names(page).first()).toHaveText('Công ty A');
  await startRename(page, 'Nhà');
  await renameInput(page).fill('Nhà mới');
  await other.evaluate(([k, list]) => localStorage.setItem(k, JSON.stringify(list)), [GROUPS_KEY, [{ ...GROUPS[0], name: 'Công ty B' }, ...GROUPS.slice(1)]]);
  await expect(names(page).first()).toHaveText('Công ty B');
  await expect(renameInput(page)).toHaveValue('Nhà mới');
  await expect(renameInput(page)).toBeFocused();
  await renameInput(page).press('Enter');
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.name)).toEqual(['Công ty B', 'Nhà mới', 'Học tiếng Nhật']);
  await other.close();
});

test('IME in the rename input: Escape and the committing Enter neither cancel nor save', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP IME is Chromium only');
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await startRename(page, 'Nhà');
  await renameInput(page).fill('');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: 'Nhaf', selectionStart: 4, selectionEnd: 4 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 229 });
  await expect(renameInput(page)).toBeVisible();
  await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Process', code: 'Enter', windowsVirtualKeyCode: 229 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  expect((await storedJson(page, GROUPS_KEY))[1].name).toBe('Nhà');
  await expect(renameInput(page)).toBeVisible();
  await cdp.send('Input.insertText', { text: 'Nhà ở' });
  await expect(renameInput(page)).toHaveValue('Nhà ở');
  await renameInput(page).press('Enter');
  expect((await storedJson(page, GROUPS_KEY))[1].name).toBe('Nhà ở');
});

test('the group in edit is deleted in another tab: Lưu drops the edit quietly and focus goes to Đóng', async ({ page, context }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await startRename(page, 'Nhà');
  await renameInput(page).fill('Nhà mới');
  const other = await context.newPage();
  await other.goto('./');
  await other.evaluate(([k, list]) => localStorage.setItem(k, JSON.stringify(list)), [GROUPS_KEY, [GROUPS[0], GROUPS[2]]]);
  await other.close();
  await expect(names(page)).not.toContainText(['Nhà']);
  await renameInput(page).press('Enter');
  await expect(renameInput(page)).toHaveCount(0);
  await expect(cardRows(page).locator('.sticker')).toHaveText(['Công ty', 'Học tiếng Nhật']);
  await expect(card(page).getByRole('button', { name: 'Đóng' })).toBeFocused();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.name)).toEqual(['Công ty', 'Học tiếng Nhật']);
});

// BUG-008: Sửa on a lower row of the scrolling list brings Lưu and Hủy into view.
test('Sửa on the last of 20 groups brings the whole edit block, with Lưu, into view', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await page.setViewportSize({ width: 390, height: 700 });
  const many = Array.from({ length: 20 }, (_, i) => group(`g${i}`, `${String(i).padStart(2, '0')} Nhóm`, 'yellow', NOW.getTime() + i));
  await open(page, [], '', { groups: many });
  await openCard(page);
  await cardRows(page).last().getByRole('button', { name: 'Sửa' }).click();
  await expect(card(page).getByRole('button', { name: 'Lưu' })).toBeInViewport({ ratio: 1 });
});

test('Sửa on a row whose group went in another tab while another row was in edit: no error, the row goes, focus on Đóng', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await startRename(page, 'Công ty'); // a row in edit, so the card keeps its rows when another tab writes
  await otherTab(page, GROUPS.filter((g) => g.id !== 'nha'));
  await cardRow(page, 'Nhà').getByRole('button', { name: 'Sửa' }).click();
  await expect(card(page).getByRole('button', { name: 'Đóng' })).toBeFocused();
  await expect(cardRows(page).locator('.sticker')).toHaveText(['Công ty', 'Học tiếng Nhật']);
  await expect(renameInput(page)).toHaveCount(0);
  expect(errors).toEqual([]);
});

// T9: delete a group, the blocked note and Xem các việc này (R40, R48, R51 to R54, R62, R65)
const deleteNote = (page) => page.locator('#group-delete-dialog');
const blockedNote = (page) => page.locator('#group-blocked-dialog');
const xoa = (page, name) => cardRow(page, name).getByRole('button', { name: 'Xóa', exact: true });
const sua = (page, name) => cardRow(page, name).getByRole('button', { name: 'Sửa', exact: true });
const blockedText = (name, n, d) => `Chưa thể xóa nhóm "${name}" vì nhóm còn ${n} việc trong ${d} ngày. Hãy chuyển các việc này sang nhóm khác trước.`;
const inGroup = (id, ...args) => ({ ...task(...args), groupId: id });
const SK = group('sk', 'Sức khỏe', 'blue', at(7, 3));

test('Xóa on a group with no task asks first, with the name, Giữ lại focused and Xóa nhóm', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await xoa(page, 'Học tiếng Nhật').click();
  const note = page.getByRole('alertdialog', { name: 'Xóa nhóm "Học tiếng Nhật"?' });
  await expect(note).toBeVisible();
  await expect(note.getByRole('button', { name: 'Giữ lại' })).toBeFocused();
  await expect(note.getByRole('button')).toHaveText(['Giữ lại', 'Xóa nhóm']);
  await expect(note.locator('.sticker')).toHaveText('Học tiếng Nhật');
  await expect(note.locator('.sticker')).toHaveAttribute('data-color', 'green');
  await expect(card(page)).toBeVisible(); // the note sits on the card
});

test('Xóa nhóm removes the group from storage and the card, tasks untouched; focus on the next Sửa, else the previous, else Đóng', async ({ page }) => {
  await open(page, DAY, '', { groups: [...GROUPS, SK] });
  const tasksBefore = await storedRaw(page);
  await openCard(page);
  const confirm = () => deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  await xoa(page, 'Học tiếng Nhật').click();
  await confirm();
  await expect(deleteNote(page)).toBeHidden();
  await expect(card(page)).toBeVisible();
  await expect(cardRows(page).locator('.sticker')).toHaveText(['Công ty', 'Nhà', 'Sức khỏe']);
  await expect(sua(page, 'Sức khỏe')).toBeFocused();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.id)).toEqual(['cty', 'nha', 'sk']);
  await xoa(page, 'Sức khỏe').click(); // the last row: focus goes to the previous one
  await confirm();
  await expect(sua(page, 'Nhà')).toBeFocused();
  expect(await storedRaw(page)).toBe(tasksBefore);
});

test('deleting the only group leaves Bạn chưa có nhóm nào. with focus on Đóng', async ({ page }) => {
  const confirm = () => deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  await open(page, [], '', { groups: [SK] });
  await openCard(page);
  await xoa(page, 'Sức khỏe').click();
  await confirm();
  await expect(card(page).getByRole('button', { name: 'Đóng' })).toBeFocused();
  await expect(card(page).locator('.dialog__empty')).toBeVisible();
  expect(await storedJson(page, GROUPS_KEY)).toEqual([]);
});

test('Giữ lại, Escape and a backdrop click keep the group, the card stays open and focus returns to Xóa', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  const exits = [
    () => deleteNote(page).getByRole('button', { name: 'Giữ lại' }).click(),
    () => page.keyboard.press('Escape'),
    () => page.mouse.click(3, 3),
  ];
  for (const exit of exits) {
    await xoa(page, 'Học tiếng Nhật').click();
    await expect(deleteNote(page)).toBeVisible();
    await exit();
    await expect(deleteNote(page)).toBeHidden();
    await expect(card(page)).toBeVisible();
    await expect(xoa(page, 'Học tiếng Nhật')).toBeFocused();
  }
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.id)).toEqual(['cty', 'nha', 'jp']);
  await page.keyboard.press('Escape'); // the next Escape closes the card
  await expect(card(page)).toBeHidden();
});

test('deleting the filtered group that is also the add choice resets both; the last group returns the plain list (T7-14)', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, [task('a', 'Một')], '', { groups: [SK] });
  await filterSel(page).selectOption({ label: 'Sức khỏe' });
  await expect(choice(page)).toHaveValue('sk');
  await openCard(page);
  await xoa(page, 'Sức khỏe').click();
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  // The page behind follows at once, before the card closes.
  await expect(choice(page)).toHaveValue('none');
  await page.keyboard.press('Escape');
  await expect(manageBtn(page)).toBeFocused();
  await expect(filterSel(page)).toBeHidden();
  await expect(sections(page)).toHaveCount(0);
  await expect(labels(page)).toHaveText(['Một']);
  await expect(page.locator('#group-bar')).not.toHaveClass(/group-bar--filtered/);
  expect(errors).toEqual([]);
});

test('deleting the filtered group among others: filter Tất cả nhóm, add choice Chưa phân nhóm, all sections back', async ({ page }) => {
  await open(page, DAY, '', { groups: [...GROUPS, SK] });
  await filterSel(page).selectOption({ label: 'Sức khỏe' });
  await openCard(page);
  await xoa(page, 'Sức khỏe').click();
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  await page.keyboard.press('Escape');
  await expect(filterSel(page)).toHaveValue('all');
  await expect(choice(page)).toHaveValue('none');
  await expect(names(page)).toHaveText(['Công ty', 'Nhà', 'Chưa phân nhóm']);
});

test('a deleted group leaves the collapsed list; the others keep order and colour; a new group continues from the latest', async ({ page }) => {
  const abc = [group('a', 'A', 'yellow', at(7, 0)), group('b', 'B', 'pink', at(7, 1)), group('c', 'C', 'green', at(7, 2))];
  await open(page, [], '', { groups: abc, ui: { collapsed: ['b', 'a'] } });
  await openCard(page);
  await xoa(page, 'B').click();
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  expect((await storedJson(page, UI_KEY)).collapsed).toEqual(['a']);
  await page.keyboard.press('Escape');
  await choice(page).selectOption('new');
  await nameInput(page).fill('D');
  await createBtn(page).click();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => [g.id === 'a' || g.id === 'c' ? g.id : g.name, g.color]))
    .toEqual([['a', 'yellow'], ['c', 'green'], ['D', 'blue']]);
});

test('a group with tasks on any day is never deleted: the blocked note gives n and d, three buttons, and Xóa stays usable', async ({ page }) => {
  const tasks = [
    inGroup('nha', 'p1', 'Hôm trước', true, '2026-11-05', at(6, 0)),
    inGroup('nha', 'p2', 'Hôm trước nữa', false, '2026-11-05', at(6, 1)),
    inGroup('nha', 't1', 'Hôm nay', true, TODAY, at(6, 2)),
    inGroup('nha', 'f1', 'Tuần sau', false, '2026-11-16', at(6, 3)),
    inGroup('nha', 'f2', 'Tuần sau nữa', true, '2026-11-16', at(6, 4)),
    inGroup('cty', 'c1', 'Một việc', false, TODAY, at(6, 5)),
  ];
  await open(page, tasks, '', { groups: GROUPS });
  const before = await storedAll(page);
  await openCard(page);
  for (const [name, n, d] of [['Công ty', 1, 1], ['Nhà', 5, 3]]) {
    await xoa(page, name).click();
    const note = page.getByRole('alertdialog', { name: blockedText(name, n, d) });
    await expect(note).toBeVisible();
    await expect(note.locator('.dialog__title')).toHaveText(blockedText(name, n, d));
    await expect(note.getByRole('button')).toHaveText(['Chuyển tất cả việc', 'Xem các việc này', 'Đã hiểu']);
    await expect(note.getByRole('button', { name: 'Đã hiểu' })).toBeFocused();
    await expect(deleteNote(page)).toBeHidden();
    await note.getByRole('button', { name: 'Đã hiểu' }).click();
    await expect(note).toBeHidden();
    await expect(xoa(page, name)).toBeFocused();
    await expect(xoa(page, name)).not.toHaveAttribute('aria-disabled', /.*/);
    await expect(xoa(page, name)).toBeEnabled();
    await page.keyboard.press('Enter'); // Xóa again from the keyboard, then Escape
    await expect(note).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(note).toBeHidden();
    await expect(card(page)).toBeVisible();
    await expect(xoa(page, name)).toBeFocused();
  }
  expect(await storedAll(page)).toEqual(before);
});

test('a group emptied by moving its tasks out one by one, or by deleting them, can then be deleted; no task goes with it', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  const moveOut = async (text) => {
    await editOf(page, text).click();
    await editChoice(page).selectOption({ label: 'Chưa phân nhóm' });
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  };
  await moveOut('Tưới cây');
  await openCard(page);
  await xoa(page, 'Nhà').click();
  await expect(page.getByRole('alertdialog', { name: blockedText('Nhà', 1, 1) })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await moveOut('Nấu cơm');
  await openCard(page);
  await xoa(page, 'Nhà').click();
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  await page.keyboard.press('Escape');
  expect((await storedJson(page, KEY)).length).toBe(6);
  await expect(names(page)).toHaveText(['Công ty', 'Chưa phân nhóm']);

  // The normal task delete empties Công ty step by step; counts follow.
  for (const [text, left] of [['Gửi báo cáo', 2], ['Họp nhóm', 1], ['Trả lời email', 0]]) {
    await rowOf(page, text).getByRole('button', { name: 'Xóa' }).evaluate((b) => b.click()); // phones hide it behind the swipe
    await page.locator('#delete-dialog').getByRole('button', { name: 'Xóa việc' }).click();
    await expect(rowOf(page, text)).toHaveCount(0);
    await openCard(page);
    await xoa(page, 'Công ty').click();
    if (left) {
      await expect(page.getByRole('alertdialog', { name: blockedText('Công ty', left, 1) })).toBeVisible();
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    } else {
      await expect(page.getByRole('alertdialog', { name: 'Xóa nhóm "Công ty"?' })).toBeVisible();
    }
  }
});

for (const [title, dates, from, to] of [
  ['past only: the latest day up to today', ['2026-11-05', '2026-11-08'], '#2026-11-10', '2026-11-08'],
  ['future only: the earliest later day', ['2026-11-20', '2026-11-12'], '', '2026-11-12'],
  ['today included: today', ['2026-11-05', TODAY, '2026-11-12'], '#2026-11-12', TODAY],
]) {
  test(`Xem các việc này, ${title}; filter and add choice on the group, hash written, Back returns, focus on Quản lý nhóm`, async ({ page }) => {
    const tasks = [...DAY.filter((t) => t.groupId !== 'nha'), ...dates.map((d, i) => inGroup('nha', `x${i}`, `Việc ${i}`, false, d, at(6, i)))];
    await open(page, tasks, from, { groups: GROUPS });
    const before = await storedAll(page);
    await openCard(page);
    await xoa(page, 'Nhà').click();
    await blockedNote(page).getByRole('button', { name: 'Xem các việc này' }).click();
    await expect(blockedNote(page)).toBeHidden();
    await expect(card(page)).toBeHidden();
    await expect(manageBtn(page)).toBeFocused();
    await expect(filterSel(page)).toHaveValue('nha');
    await expect(choice(page)).toHaveValue('nha');
    await expect(page.locator('#day-picker')).toHaveValue(to);
    expect(hash(page)).toBe(to === TODAY ? '' : `#${to}`);
    await expect(names(page)).toHaveText(['Nhà']);
    await page.goBack();
    await expect(page.locator('#day-picker')).toHaveValue(from ? from.slice(1) : TODAY);
    await expect(filterSel(page)).toHaveValue('nha'); // the filter follows the owner across days (R45)
    expect(await storedAll(page)).toEqual(before);
  });
}

test('Xem các việc này on the day already shown stays there, filters the list and adds no history entry', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  const length = await page.evaluate(() => history.length);
  await openCard(page);
  await xoa(page, 'Nhà').click();
  await blockedNote(page).getByRole('button', { name: 'Xem các việc này' }).click();
  await expect(card(page)).toBeHidden();
  await expect(sectionLabels(page, 'Nhà')).toHaveText(['Tưới cây', 'Nấu cơm']);
  await expect(names(page)).toHaveText(['Nhà']);
  await expect(filterSel(page)).toHaveValue('nha');
  expect(hash(page)).toBe('');
  expect(await page.evaluate(() => history.length)).toBe(length);
  await expect(manageBtn(page)).toBeFocused();
});

test('names with markup and quotes are plain text in both notes', async ({ page }) => {
  const odd = [group('b', '<b>x</b>', 'pink', at(7, 0)), group('q', 'Nhà "mới"', 'blue', at(7, 1))];
  await open(page, [inGroup('q', 't', 'Một', false, TODAY, at(8, 0))], '', { groups: odd });
  await openCard(page);
  await xoa(page, '<b>x</b>').click();
  await expect(deleteNote(page).locator('.dialog__title')).toHaveText('Xóa nhóm "<b>x</b>"?');
  await expect(deleteNote(page).locator('.sticker')).toHaveText('<b>x</b>');
  await expect(page.locator('dialog b')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await xoa(page, 'Nhà "mới"').click();
  await expect(blockedNote(page).locator('.dialog__title')).toHaveText(blockedText('Nhà "mới"', 1, 1));
});

test('keyboard only: Xóa, Giữ lại, Escape, Xóa nhóm; then the blocked note with Đã hiểu and Xem các việc này', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await manageBtn(page).focus();
  await page.keyboard.press('Enter');
  await expect(card(page)).toBeVisible();
  await xoa(page, 'Học tiếng Nhật').focus();
  await page.keyboard.press('Enter');
  await expect(deleteNote(page).getByRole('button', { name: 'Giữ lại' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(xoa(page, 'Học tiếng Nhật')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(xoa(page, 'Học tiếng Nhật')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(deleteNote(page).getByRole('button', { name: 'Xóa nhóm' })).toBeFocused();
  await page.keyboard.press('Tab'); // focus stays inside the note
  await page.keyboard.press('Shift+Tab');
  await expect(deleteNote(page).getByRole('button', { name: 'Xóa nhóm' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(sua(page, 'Nhà')).toBeFocused();
  await expect(cardRows(page)).toHaveCount(2);

  await page.keyboard.press('Shift+Tab'); // from Nhà's Sửa back to Công ty's Xóa
  await expect(xoa(page, 'Công ty')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(blockedNote(page).getByRole('button', { name: 'Đã hiểu' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(xoa(page, 'Công ty')).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+Tab');
  await expect(blockedNote(page).getByRole('button', { name: 'Xem các việc này' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card(page)).toBeHidden();
  await expect(manageBtn(page)).toBeFocused();
  await expect(filterSel(page)).toHaveValue('cty');
});

test('a group deleted in another tab while its note is open: Escape ends it quietly with focus on Đóng', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await xoa(page, 'Học tiếng Nhật').click();
  await otherTab(page, GROUPS.filter((g) => g.id !== 'jp'));
  await page.keyboard.press('Escape');
  await expect(card(page).getByRole('button', { name: 'Đóng' })).toBeFocused();
  await expect(cardRows(page)).toHaveCount(2);
  expect(errors).toEqual([]);
});

// T9 QA additions: storage failure on delete, a task added elsewhere, phone size (TC-task-groups-T9-21 to T9-23)
test('a failing write on Xóa nhóm: no error, the slip shows, the group goes in the page and the stored list is untouched', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, DAY, '', { groups: [...GROUPS, SK] });
  const tasksBefore = await storedRaw(page);
  await openCard(page);
  await xoa(page, 'Sức khỏe').click();
  await page.evaluate((k) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, v) { if (key === k) throw new DOMException('Full', 'QuotaExceededError'); return set.call(this, key, v); };
  }, GROUPS_KEY);
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  await expect(deleteNote(page)).toBeHidden();
  await expect(slip(page)).toBeVisible();
  await expect(cardRows(page).locator('.sticker')).toHaveText(['Công ty', 'Nhà', 'Học tiếng Nhật']);
  await expect(sua(page, 'Học tiếng Nhật')).toBeFocused();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.id)).toContain('sk');
  expect(await storedRaw(page)).toBe(tasksBefore);
  expect(errors).toEqual([]);
});

// BUG-009: Xóa nhóm reads the stored tasks again, so a task another tab just gave the group blocks the delete.
test('a task added to the group in another tab while Xóa nhóm? is open: the group must not be deleted (BUG-009)', async ({ page, context }) => {
  await open(page, DAY, '', { groups: [...GROUPS, SK] });
  await openCard(page);
  await xoa(page, 'Sức khỏe').click();
  await expect(deleteNote(page)).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(([key, g]) => {
    const all = JSON.parse(localStorage.getItem(key));
    all.push({ id: 'other', text: 'Việc từ tab khác', done: false, createdAt: Date.now(), date: all[0].date, groupId: g });
    localStorage.setItem(key, JSON.stringify(all));
  }, [KEY, 'sk']);
  await other.close();
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  await expect(page.getByRole('alertdialog', { name: blockedText('Sức khỏe', 1, 1) })).toBeVisible();
  await expect(blockedNote(page).getByRole('button', { name: 'Đã hiểu' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(xoa(page, 'Sức khỏe')).toBeFocused();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.id)).toContain('sk');
  expect((await storedJson(page, KEY)).filter((t) => t.groupId === 'sk')).toHaveLength(1);
});

// BUG-009 follow up: the blocked note opened at confirm time keeps its group, so Xem các việc này still works
// (the delete note's late close event must not clear it).
test('BUG-009: after a task arrives from another tab, Xem các việc này on the blocked note sets the filter, the add choice and the day', async ({ page, context }) => {
  await open(page, DAY, '', { groups: [...GROUPS, SK] });
  await openCard(page);
  await xoa(page, 'Sức khỏe').click();
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(([key, g]) => {
    const all = JSON.parse(localStorage.getItem(key));
    all.push({ id: 'other', text: 'Việc từ tab khác', done: false, createdAt: Date.now(), date: '2026-11-05', groupId: g });
    localStorage.setItem(key, JSON.stringify(all));
  }, [KEY, 'sk']);
  await other.close();
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  await expect(page.getByRole('alertdialog', { name: blockedText('Sức khỏe', 1, 1) })).toBeVisible();
  await blockedNote(page).getByRole('button', { name: 'Xem các việc này' }).click();
  await expect(card(page)).toBeHidden();
  await expect(filterSel(page)).toHaveValue('sk');
  await expect(choice(page)).toHaveValue('sk');
  await expect(page.locator('#day-picker')).toHaveValue('2026-11-05');
  expect(hash(page)).toBe('#2026-11-05');
  await expect(manageBtn(page)).toBeFocused();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.id)).toContain('sk');
});

for (const [w, h] of [[390, 844], [360, 640]]) {
  test(`phone ${w}px: both notes fit, buttons at least 44 px, no horizontal scroll`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone layout only');
    await page.setViewportSize({ width: w, height: h });
    await open(page, DAY, '', { groups: GROUPS });
    await openCard(page);
    for (const [name, note] of [['Học tiếng Nhật', deleteNote], ['Nhà', blockedNote]]) {
      await xoa(page, name).click();
      await expect(note(page)).toBeVisible();
      const box = await note(page).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(w);
      expect(box.y + box.height).toBeLessThanOrEqual(h);
      for (const b of await note(page).getByRole('button').all()) {
        const r = await b.boundingBox();
        expect(r.height).toBeGreaterThanOrEqual(44);
        expect(r.width).toBeGreaterThanOrEqual(44);
        expect(r.x + r.width).toBeLessThanOrEqual(w);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(w);
      await page.keyboard.press('Escape');
    }
  });
}

// T9 retry 2 QA: swipe behaviour after the closeSwipes change (BUG-010), real touch inside sections
test('phone swipes in sections: one strip open, another swipe closes it, a tap outside closes all, Tab into Sửa opens that strip, Giữ lại leaves only it open', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await open(page, DAY, '', { groups: GROUPS });
  await page.evaluate((k) => localStorage.setItem(k, '1'), HINT);
  const strip = (text) => rowOf(page, text).locator('.task__swipe');
  const open_ = (text) => strip(text).evaluate((el) => el.scrollLeft > 100);
  await touchDrag(page, strip('Tưới cây'), -200);
  await expect.poll(() => open_('Tưới cây')).toBe(true);
  await touchDrag(page, strip('Gửi báo cáo'), -200);
  await expect.poll(() => open_('Gửi báo cáo')).toBe(true);
  await expect.poll(() => open_('Tưới cây')).toBe(false);
  await page.locator('.app-header__title').tap();
  await expect.poll(() => open_('Gửi báo cáo')).toBe(false);
  await touchDrag(page, strip('Tưới cây'), -200);
  await expect.poll(() => open_('Tưới cây')).toBe(true);
  await rowOf(page, 'Nấu cơm').getByRole('button', { name: 'Sửa' }).focus(); // Tab into a row opens that strip, closes the other
  await expect.poll(() => open_('Nấu cơm')).toBe(true);
  await expect.poll(() => open_('Tưới cây')).toBe(false);
  await touchDrag(page, strip('Họp nhóm'), -200); // delete note from a just swiped strip
  await expect.poll(() => open_('Họp nhóm')).toBe(true);
  await rowOf(page, 'Họp nhóm').getByRole('button', { name: 'Xóa' }).tap();
  await page.locator('#delete-dialog').getByRole('button', { name: 'Giữ lại' }).tap();
  await expect(rowOf(page, 'Họp nhóm').getByRole('button', { name: 'Xóa' })).toBeFocused();
  await expect.poll(() => open_('Họp nhóm')).toBe(true);
  await expect.poll(() => open_('Nấu cơm')).toBe(false);
});

// A dialog's close event is queued: Giữ lại then a quick Enter on Xóa reopens the note before it arrives.
// The late event must not clear the reopened note's task, or Xóa việc would delete nothing.
test('task delete note: Giữ lại, then Enter on Xóa straight away, then Xóa việc still deletes that task', async ({ page }) => {
  await open(page, [task('a', 'Một'), task('b', 'Hai')]);
  const note = page.locator('#delete-dialog');
  for (let i = 0; i < 3; i++) {
    await rows(page).nth(1).getByRole('button', { name: 'Xóa' }).focus();
    await page.keyboard.press('Enter');
    await expect(note.getByRole('button', { name: 'Giữ lại' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // focus is back on Xóa: open the note again at once
    await expect(note).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(note).toBeHidden();
  }
  await rows(page).nth(1).getByRole('button', { name: 'Xóa' }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // Giữ lại
  await page.keyboard.press('Enter'); // Xóa again
  await page.keyboard.press('Tab');
  await expect(note.getByRole('button', { name: 'Xóa việc' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(labels(page)).toHaveText(['Một']);
});

// T9 attempt 3 QA: rapid open, close and reopen on all four dialogs (BUG-011 and the BUG-009 path)
const burst = async (page, press, n = 6) => { for (let i = 0; i < n; i++) await press(); };
test('rapid keyboard cycles on the task delete note: after the last reopen, Xóa việc still deletes (BUG-011)', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  for (let round = 0; round < 8; round++) {
    const btn = rowOf(page, 'Tưới cây').getByRole('button', { name: 'Xóa' });
    await btn.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#delete-dialog')).toBeVisible();
    await page.keyboard.press('Enter'); // Giữ lại is focused
    await page.keyboard.press('Enter'); // at once, Xóa again
    await expect(page.locator('#delete-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await expect(page.locator('#delete-dialog')).toBeVisible();
    if (round < 7) { await page.keyboard.press('Escape'); await expect(page.locator('#delete-dialog')).toBeHidden(); }
  }
  await page.locator('#delete-dialog').getByRole('button', { name: 'Xóa việc' }).click();
  await expect(rowOf(page, 'Tưới cây')).toHaveCount(0);
  expect((await storedJson(page, KEY)).some((t) => t.text === 'Tưới cây')).toBe(false);
});

test('rapid keyboard cycles on the group delete question and blocked note: the last note always acts, never a stale one', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  for (let i = 0; i < 8; i++) {
    await xoa(page, 'Học tiếng Nhật').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // Giữ lại
    await page.keyboard.press('Enter'); // Xóa again at once
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await xoa(page, 'Nhà').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter'); // Đã hiểu
    await page.keyboard.press('Enter'); // Xóa again at once
    await page.keyboard.press('Escape');
  }
  await expect(deleteNote(page)).toBeHidden();
  await expect(blockedNote(page)).toBeHidden();
  await expect(card(page)).toBeVisible();
  // After the noise, both notes still do their job.
  await xoa(page, 'Nhà').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await blockedNote(page).getByRole('button', { name: 'Xem các việc này' }).click();
  await expect(card(page)).toBeHidden();
  await expect(filterSel(page)).toHaveValue('nha');
  await openCard(page);
  await xoa(page, 'Học tiếng Nhật').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter'); // Giữ lại
  await page.keyboard.press('Enter');
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.id)).toEqual(['cty', 'nha']);
  expect(errors).toEqual([]);
});

test('rapid mouse cycles: card, delete question and blocked note opened and closed in a row; the last one acts', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  for (let i = 0; i < 6; i++) {
    await manageBtn(page).click();
    await xoa(page, 'Học tiếng Nhật').click();
    await deleteNote(page).getByRole('button', { name: 'Giữ lại' }).click();
    await xoa(page, 'Học tiếng Nhật').click();
    await page.mouse.click(3, 3); // backdrop
    await xoa(page, 'Nhà').click();
    await blockedNote(page).getByRole('button', { name: 'Đã hiểu' }).click();
    await xoa(page, 'Nhà').click();
    await blockedNote(page).getByRole('button', { name: 'Xem các việc này' }).click();
    await expect(card(page)).toBeHidden();
    await expect(manageBtn(page)).toBeFocused();
  }
  await expect(filterSel(page)).toHaveValue('nha');
  await manageBtn(page).click();
  await xoa(page, 'Học tiếng Nhật').click();
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.id)).toEqual(['cty', 'nha']);
});

test('rapid card cycles: Enter on Quản lý nhóm, Escape, Enter again; the card opens and closes cleanly with focus back', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await manageBtn(page).focus();
  for (let i = 0; i < 10; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); }
  await page.keyboard.press('Enter');
  await expect(card(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(card(page)).toBeHidden();
  await expect(manageBtn(page)).toBeFocused();
});

// Damaged stored entries are skipped on load, so they never count for a group: no blocked note, no bad hash.
test('damaged stored entries in a group neither block its delete nor send Xem các việc này to a bad day', async ({ page }) => {
  const damaged = [
    { id: 'd1', text: 'Không có ngày', done: false, createdAt: 1, groupId: 'sk' },
    { id: 'd2', text: 'Ngày hỏng', done: false, createdAt: 2, date: '2026-11-08x', groupId: 'sk' },
    { id: 'd3', done: 'no', createdAt: 3, date: TODAY, groupId: 'sk' },
    { id: 'd4', text: 'Ngày hỏng', done: false, createdAt: 4, date: '2026-11-08x', groupId: 'nha' },
  ];
  const tasks = [...DAY.filter((t) => t.groupId !== 'nha'), inGroup('nha', 'p1', 'Hôm trước', false, '2026-11-05', at(6, 0)), ...damaged];
  await open(page, tasks, '', { groups: [...GROUPS, SK] });
  await openCard(page);
  await xoa(page, 'Nhà').click();
  await expect(page.getByRole('alertdialog', { name: blockedText('Nhà', 1, 1) })).toBeVisible();
  await page.keyboard.press('Escape');
  await xoa(page, 'Sức khỏe').click();
  await expect(page.getByRole('alertdialog', { name: 'Xóa nhóm "Sức khỏe"?' })).toBeVisible();
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.id)).not.toContain('sk');
  await xoa(page, 'Nhà').click();
  await blockedNote(page).getByRole('button', { name: 'Xem các việc này' }).click();
  await expect(page.locator('#day-picker')).toHaveValue('2026-11-05');
  expect(hash(page)).toBe('#2026-11-05');
  await expect(filterSel(page)).toHaveValue('nha');
});

// T10: move every task of a group (R61, R67 to R72, NFR3)
const moveCard = (page) => page.getByRole('dialog', { name: /^Chuyển tất cả việc của nhóm/ });
const moveBtn = (page, name) => cardRow(page, name).getByRole('button', { name: 'Chuyển tất cả việc' });
const target = (page) => moveCard(page).getByRole('combobox', { name: 'Chuyển đến nhóm' });
const moveText = (n, d, to) => `Chuyển ${n} việc trong ${d} ngày sang nhóm "${to}"? Ngày, trạng thái hoàn thành và thứ tự của các việc được giữ nguyên.`;
const moveError = (page) => moveCard(page).getByRole('alert');
const MOVE_ERROR = 'Không thể lưu thay đổi. Chưa có việc nào được chuyển.';
const MOVE_STALE = 'Một tab khác vừa thay đổi việc của nhóm này. Hãy tải lại trang rồi thử lại.';
// Công ty on a past, today and a future day, done and not done; Nhà and Chưa phân nhóm as in DAY.
const SPREAD = [
  ...DAY,
  inGroup('cty', 'cp', 'Việc hôm trước', true, '2026-11-05', at(6, 0)),
  inGroup('cty', 'cf', 'Việc tuần sau', false, '2026-11-16', at(6, 1)),
];
const countWrites = (page) => page.evaluate((k) => {
  window.__writes = 0;
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, v) { if (key === k) window.__writes++; return set.call(this, key, v); };
}, KEY);
const failTaskWrites = (page) => page.evaluate((k) => {
  window.__set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, v) { if (key === k) throw new DOMException('Full', 'QuotaExceededError'); return window.__set.call(this, key, v); };
}, KEY);

test('the inactive move button of a group with no task does nothing, by click or Enter', async ({ page }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  const idle = moveBtn(page, 'Học tiếng Nhật');
  await idle.dispatchEvent('click'); // Playwright will not click an aria-disabled button, so fire the press itself
  await idle.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press(' ');
  await expect(idle).toBeFocused();
  await expect(moveCard(page)).toBeHidden();
  await expect(blockedNote(page)).toBeHidden();
  await expect(card(page)).toBeVisible();
});

test('the move card: title, Chưa phân nhóm first and chosen, no source, the sentence follows the target; Hủy and Escape change nothing', async ({ page }) => {
  await open(page, SPREAD, '', { groups: GROUPS });
  const before = await storedAll(page);
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  await expect(moveCard(page)).toBeVisible();
  await expect(moveCard(page).locator('.dialog__title')).toHaveText('Chuyển tất cả việc của nhóm "Công ty"');
  await expect(target(page).locator('option')).toHaveText(['Chưa phân nhóm', 'Nhà', 'Học tiếng Nhật']);
  await expect(target(page)).toHaveValue('none');
  await expect(moveCard(page).locator('.dialog__text')).toHaveText(moveText(5, 3, 'Chưa phân nhóm'));
  await expect(moveCard(page)).toHaveAccessibleDescription(moveText(5, 3, 'Chưa phân nhóm'));
  await expect(moveError(page)).toHaveCount(0);
  await target(page).selectOption('nha');
  await expect(moveCard(page).locator('.dialog__text')).toHaveText(moveText(5, 3, 'Nhà'));
  await expect(moveCard(page).locator('.select .swatch')).toHaveAttribute('data-color', 'pink');
  await target(page).selectOption('jp');
  await expect(moveCard(page).locator('.dialog__text')).toHaveText(moveText(5, 3, 'Học tiếng Nhật'));
  await moveCard(page).getByRole('button', { name: 'Hủy' }).click();
  await expect(moveCard(page)).toBeHidden();
  await expect(card(page)).toBeVisible();
  await expect(moveBtn(page, 'Công ty')).toBeFocused();
  // Keyboard: Enter opens it with Chưa phân nhóm again, Escape closes it.
  await page.keyboard.press('Enter');
  await expect(target(page)).toHaveValue('none');
  await expect(moveCard(page).locator('.dialog__text')).toHaveText(moveText(5, 3, 'Chưa phân nhóm'));
  await page.keyboard.press('Escape');
  await expect(moveCard(page)).toBeHidden();
  await expect(card(page)).toBeVisible();
  await expect(moveBtn(page, 'Công ty')).toBeFocused();
  // A group with one task on one day.
  await moveBtn(page, 'Nhà').click();
  await expect(target(page).locator('option')).toHaveText(['Chưa phân nhóm', 'Công ty', 'Học tiếng Nhật']);
  await expect(moveCard(page).locator('.dialog__text')).toHaveText(moveText(2, 1, 'Chưa phân nhóm'));
  await page.keyboard.press('Escape');
  expect(await storedAll(page)).toEqual(before);
});

test('Chuyển việc moves every task of the group on every day with one write; only groupId changes; the source stays and can be deleted', async ({ page }) => {
  await open(page, SPREAD, '', { groups: GROUPS, ui: { collapsed: ['nha'] } });
  const before = await storedJson(page, KEY);
  const groupsBefore = await storedJson(page, GROUPS_KEY);
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  await target(page).selectOption('nha');
  await countWrites(page);
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(moveCard(page)).toBeHidden();
  await expect(card(page)).toBeHidden();
  await expect(manageBtn(page)).toBeFocused();
  await expect(notice(page)).toHaveText('Đã chuyển 5 việc sang nhóm "Nhà".');
  await expect(notice(page)).toHaveAttribute('role', 'status');
  expect(await page.evaluate(() => window.__writes)).toBe(1);
  const after = await storedJson(page, KEY);
  expect(after).toEqual(before.map((t) => (t.groupId === 'cty' ? { ...t, groupId: 'nha' } : t)));
  // The day shows the moved rows in Nhà by creation time, the section open again; Công ty is gone from the day.
  await expect(names(page)).toHaveText(['Nhà', 'Chưa phân nhóm']);
  await expect(toggle(page, 'Nhà')).toHaveAttribute('aria-expanded', 'true');
  expect((await storedJson(page, UI_KEY)).collapsed).not.toContain('nha');
  await expect(sectionLabels(page, 'Nhà')).toHaveText(['Tưới cây', 'Gửi báo cáo', 'Nấu cơm', 'Họp nhóm', 'Trả lời email']);
  await expect(summary(page)).toHaveText('Đã hoàn thành 2/6 việc');
  // The group itself is untouched, now empty: inactive move, and Xóa asks the plain question.
  expect(await storedJson(page, GROUPS_KEY)).toEqual(groupsBefore);
  await openCard(page);
  await expect(moveBtn(page, 'Công ty')).toHaveAttribute('aria-disabled', 'true');
  await xoa(page, 'Công ty').click();
  await expect(page.getByRole('alertdialog', { name: 'Xóa nhóm "Công ty"?' })).toBeVisible();
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.id)).toEqual(['nha', 'jp']);
  expect((await storedJson(page, KEY)).length).toBe(before.length);
});

test('moving to Chưa phân nhóm drops the groupId key; a filter and add choice on the source stay, with its empty state', async ({ page }) => {
  await open(page, SPREAD, '', { groups: GROUPS });
  await filterSel(page).selectOption('cty');
  await expect(choice(page)).toHaveValue('cty');
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  // Keyboard: focus starts on the target choice, then Hủy, then Chuyển việc.
  await expect(target(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(moveCard(page).getByRole('button', { name: 'Chuyển việc' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(card(page)).toBeHidden();
  await expect(notice(page)).toHaveText('Đã chuyển 5 việc sang nhóm "Chưa phân nhóm".');
  const moved = (await storedJson(page, KEY)).filter((t) => t.id[0] === 'c');
  expect(moved).toHaveLength(5);
  for (const t of moved) expect(Object.keys(t)).not.toContain('groupId');
  await expect(filterSel(page)).toHaveValue('cty');
  await expect(groupEmpty(page)).toHaveText('Ngày này chưa có việc nào trong nhóm "Công ty".');
  await expect(choice(page)).toHaveValue('cty');
  await addTask(page, 'Việc mới');
  expect((await storedJson(page, KEY)).find((t) => t.text === 'Việc mới').groupId).toBe('cty');
  await filterSel(page).selectOption('all');
  await expect(sectionLabels(page, 'Chưa phân nhóm')).toHaveText(['Gửi báo cáo', 'Đọc sách', 'Họp nhóm', 'Trả lời email']);
});

test('a failed write keeps the card open with the error and the target; nothing moves; a retry then moves everything', async ({ page }) => {
  await open(page, SPREAD, '', { groups: GROUPS });
  const before = await storedRaw(page);
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  await target(page).selectOption('jp');
  await failTaskWrites(page);
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(moveError(page)).toHaveText(MOVE_ERROR);
  await expect(moveCard(page)).toBeVisible();
  await expect(target(page)).toHaveValue('jp');
  await expect(slip(page)).toBeHidden();
  expect(await storedRaw(page)).toBe(before);
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Gửi báo cáo', 'Họp nhóm', 'Trả lời email']);
  // A second failure is announced again.
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(moveError(page)).toHaveText(MOVE_ERROR);
  expect(await storedRaw(page)).toBe(before);
  await page.evaluate(() => { Storage.prototype.setItem = window.__set; });
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(card(page)).toBeHidden();
  await expect(notice(page)).toHaveText('Đã chuyển 5 việc sang nhóm "Học tiếng Nhật".');
  const after = await storedJson(page, KEY);
  expect(after.filter((t) => t.groupId === 'jp').map((t) => t.id).sort()).toEqual(['c1', 'c2', 'c3', 'cf', 'cp']);
  expect(after.some((t) => t.groupId === 'cty')).toBe(false);
  // Reopened, the card starts clean.
  await openCard(page);
  await moveBtn(page, 'Nhà').click();
  await expect(moveError(page)).toHaveCount(0);
});

test('from the blocked note: Hủy returns to its Chuyển tất cả việc; Chuyển việc closes every dialog', async ({ page }) => {
  await open(page, SPREAD, '', { groups: GROUPS });
  await openCard(page);
  await xoa(page, 'Công ty').click();
  const noteMove = blockedNote(page).getByRole('button', { name: 'Chuyển tất cả việc' });
  await noteMove.click();
  await expect(moveCard(page)).toBeVisible();
  await expect(moveCard(page).locator('.dialog__text')).toHaveText(moveText(5, 3, 'Chưa phân nhóm'));
  await moveCard(page).getByRole('button', { name: 'Hủy' }).click();
  await expect(moveCard(page)).toBeHidden();
  await expect(blockedNote(page)).toBeVisible();
  await expect(noteMove).toBeFocused();
  await page.keyboard.press('Enter');
  await target(page).selectOption('nha');
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(moveCard(page)).toBeHidden();
  await expect(blockedNote(page)).toBeHidden();
  await expect(card(page)).toBeHidden();
  await expect(manageBtn(page)).toBeFocused();
  await expect(notice(page)).toHaveText('Đã chuyển 5 việc sang nhóm "Nhà".');
  await expect(names(page)).toHaveText(['Nhà', 'Chưa phân nhóm']);
});

test('only one group: the target list holds Chưa phân nhóm alone and the move works', async ({ page }) => {
  await open(page, DAY.filter((t) => t.groupId !== 'nha'), '', { groups: [GROUPS[0]] });
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  await expect(target(page).locator('option')).toHaveText(['Chưa phân nhóm']);
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(notice(page)).toHaveText('Đã chuyển 3 việc sang nhóm "Chưa phân nhóm".');
  await expect(rows(page)).toHaveCount(4);
});

test('storage unavailable from load: the move happens in memory with the notice and no error, nothing written', async ({ page }) => {
  await page.addInitScript((k) => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) { if (key === k) throw new DOMException('Blocked', 'SecurityError'); return get.call(this, key); };
  }, KEY);
  await open(page, null, '', { groups: GROUPS });
  await choice(page).selectOption('cty');
  await addTask(page, 'Gọi khách');
  await addTask(page, 'Gửi hợp đồng');
  await countWrites(page);
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  await expect(moveCard(page).locator('.dialog__text')).toHaveText(moveText(2, 1, 'Chưa phân nhóm'));
  await target(page).selectOption('nha');
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(card(page)).toBeHidden();
  await expect(notice(page)).toHaveText('Đã chuyển 2 việc sang nhóm "Nhà".');
  await expect(sectionLabels(page, 'Nhà')).toHaveText(['Gọi khách', 'Gửi hợp đồng']);
  expect(await page.evaluate(() => window.__writes)).toBe(0);
});

test('a task of the group stored by another tab: Chuyển việc writes nothing and asks for a reload, so that task is not lost (BUG-013)', async ({ page, context }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(([key]) => {
    const all = JSON.parse(localStorage.getItem(key));
    all.push({ id: 'other', text: 'Việc từ tab khác', done: false, createdAt: Date.now(), date: all[0].date, groupId: 'cty' });
    localStorage.setItem(key, JSON.stringify(all));
  }, [KEY]);
  await other.close();
  const before = await storedRaw(page);
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(moveError(page)).toHaveText(MOVE_STALE);
  expect(await storedRaw(page)).toBe(before);
});

test('a target group deleted in another tab while the card is open falls back to Chưa phân nhóm', async ({ page, context }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  await target(page).selectOption('jp');
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(([key]) => {
    localStorage.setItem(key, JSON.stringify(JSON.parse(localStorage.getItem(key)).filter((g) => g.id !== 'jp')));
  }, [GROUPS_KEY]);
  await other.close();
  await expect(target(page).locator('option')).toHaveText(['Chưa phân nhóm', 'Nhà']);
  await expect(target(page)).toHaveValue('none');
  await expect(moveCard(page).locator('.dialog__text')).toHaveText(moveText(3, 1, 'Chưa phân nhóm'));
});

test('200 tasks of one group on 60 days: Chuyển việc on a settled page is one write and under 100 ms', async ({ page }) => {
  // 59 tasks on 59 other days (Sep 11 to Nov 8), the other 141 on the viewed day.
  const other = (i) => new Date(Date.UTC(2026, 8, 11 + i)).toISOString().slice(0, 10);
  const many = Array.from({ length: 200 }, (_, i) => inGroup('cty', `t${i}`, `Việc số ${i + 1}`, i % 3 === 0, i < 59 ? other(i) : TODAY, NOW.getTime() + i));
  await open(page, many, '', { groups: GROUPS });
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  await target(page).selectOption('nha');
  await countWrites(page);
  await page.waitForTimeout(500); // let the page settle, measured as BUG-010: the move, the list rebuilt and a forced layout
  const ms = await page.evaluate(() => {
    const t0 = performance.now();
    document.querySelector('#move-dialog form').requestSubmit();
    void document.body.offsetHeight;
    return performance.now() - t0;
  });
  expect(ms).toBeLessThan(100);
  expect(await page.evaluate(() => window.__writes)).toBe(1);
  const after = await storedJson(page, KEY);
  expect(after).toHaveLength(200);
  expect(after.every((t) => t.groupId === 'nha')).toBe(true);
  expect(new Set(after.map((t) => t.date)).size).toBe(60);
  await expect(section(page, 'Nhà').locator('.task')).toHaveCount(141);
});

// T10 QA: stacked dialogs, rapid cycles, names, size and the other tab cases (TC-task-groups-T10-18, 22, 25)
test('Escape peels three stacked dialogs one at a time: move card, blocked note, manage card; focus returns to each opener', async ({ page }) => {
  await open(page, SPREAD, '', { groups: GROUPS });
  await manageBtn(page).focus();
  await page.keyboard.press('Enter');
  await expect(card(page)).toBeVisible();
  await xoa(page, 'Công ty').click();
  await expect(blockedNote(page)).toBeVisible();
  const noteMove = blockedNote(page).getByRole('button', { name: 'Chuyển tất cả việc' });
  await noteMove.click();
  await expect(moveCard(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(moveCard(page)).toBeHidden();
  await expect(blockedNote(page)).toBeVisible();
  await expect(noteMove).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(blockedNote(page)).toBeHidden();
  await expect(card(page)).toBeVisible();
  await expect(xoa(page, 'Công ty')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(card(page)).toBeHidden();
  await expect(manageBtn(page)).toBeFocused();
  expect((await storedJson(page, KEY)).filter((t) => t.groupId === 'cty')).toHaveLength(5);
});

test('rapid cycles on the move card from the row and from the blocked note: it opens clean each time and the last Chuyển việc moves all', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, SPREAD, '', { groups: GROUPS });
  await openCard(page);
  const btn = moveBtn(page, 'Công ty');
  await btn.focus();
  for (let i = 0; i < 10; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); }
  await expect(btn).toBeFocused();
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); } // open, Tab from the choice to Hủy, press it
  await expect(btn).toBeFocused();
  await xoa(page, 'Công ty').click();
  const noteMove = blockedNote(page).getByRole('button', { name: 'Chuyển tất cả việc' });
  await noteMove.focus();
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); }
  await expect(noteMove).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(moveCard(page)).toBeVisible();
  await expect(moveError(page)).toHaveCount(0);
  await expect(target(page)).toHaveValue('none');
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(card(page)).toBeHidden();
  await expect(blockedNote(page)).toBeHidden();
  await expect(manageBtn(page)).toBeFocused();
  await expect(notice(page)).toHaveText('Đã chuyển 5 việc sang nhóm "Chưa phân nhóm".');
  expect((await storedJson(page, KEY)).some((t) => t.groupId === 'cty')).toBe(false);
  expect(errors).toEqual([]);
});

test('names and sizes: every control of the move card has its visible text in its name; the dialog is modal; the buttons reach 44 px on a phone', async ({ page }, info) => {
  await open(page, SPREAD, '', { groups: GROUPS });
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  await expect(moveCard(page).getByRole('heading', { name: 'Chuyển tất cả việc của nhóm "Công ty"' })).toBeVisible();
  await expect(moveCard(page).getByRole('button', { name: 'Hủy' })).toBeVisible();
  await expect(moveCard(page).getByRole('button', { name: 'Chuyển việc' })).toBeVisible();
  await expect(target(page)).toBeVisible();
  expect(await page.evaluate(() => document.getElementById('move-dialog').matches(':modal'))).toBe(true);
  for (const name of ['Hủy', 'Chuyển việc']) {
    const b = await moveCard(page).getByRole('button', { name }).boundingBox();
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  expect((await target(page).boundingBox()).height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Escape');
  for (const name of ['Công ty', 'Nhà', 'Học tiếng Nhật']) {
    const b = await moveBtn(page, name).boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the source group removed in another tab while the move card is open closes it without a move or a script error', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  const before = await storedRaw(page);
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(([key]) => {
    localStorage.setItem(key, JSON.stringify(JSON.parse(localStorage.getItem(key)).filter((g) => g.id !== 'cty')));
  }, [GROUPS_KEY]);
  await other.close();
  await expect(moveCard(page)).toBeHidden();
  expect(await storedRaw(page)).toBe(before);
  await expect(card(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test('another tab stored more tasks of the group: the refusal repeats, Hủy and reopening do not clear it, nothing is written', async ({ page, context }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(([key]) => {
    const all = JSON.parse(localStorage.getItem(key));
    all.push({ id: 'other', text: 'Việc từ tab khác', done: false, createdAt: Date.now(), date: all[0].date, groupId: 'cty' });
    localStorage.setItem(key, JSON.stringify(all));
  }, [KEY]);
  await other.close();
  const before = await storedRaw(page);
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(moveError(page)).toHaveText(MOVE_STALE);
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(moveError(page)).toHaveText(MOVE_STALE);
  await moveCard(page).getByRole('button', { name: 'Hủy' }).click();
  await moveBtn(page, 'Công ty').click();
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(moveError(page)).toHaveText(MOVE_STALE);
  expect(await storedRaw(page)).toBe(before);
  await expect(card(page)).toBeVisible();
});

// BUG-012 (TC-task-groups-T10-30): the blocked note of a group removed in another tab closes with the move card over it.
test('the blocked note and move card of a group removed in another tab both close; focus goes back to the card (Đóng)', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await xoa(page, 'Công ty').click();
  await blockedNote(page).getByRole('button', { name: 'Chuyển tất cả việc' }).click();
  await expect(moveCard(page)).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(([key]) => {
    localStorage.setItem(key, JSON.stringify(JSON.parse(localStorage.getItem(key)).filter((g) => g.id !== 'cty')));
  }, [GROUPS_KEY]);
  await other.close();
  await expect(moveCard(page)).toBeHidden();
  await expect(blockedNote(page)).toBeHidden();
  await expect(card(page)).toBeVisible();
  await expect(card(page).getByRole('button', { name: 'Đóng' })).toBeFocused();
  await expect(cardRows(page).locator('.sticker')).toHaveText(['Nhà', 'Học tiếng Nhật']);
  // The blocked note alone, for a group still listed: another group's removal leaves it open.
  await xoa(page, 'Nhà').click();
  await expect(blockedNote(page)).toBeVisible();
  const third = await context.newPage();
  await third.goto('/');
  await third.evaluate(([key]) => {
    localStorage.setItem(key, JSON.stringify(JSON.parse(localStorage.getItem(key)).filter((g) => g.id !== 'jp')));
  }, [GROUPS_KEY]);
  await third.close();
  await expect(cardRows(page).locator('.sticker')).toHaveText(['Nhà']);
  await expect(blockedNote(page)).toBeVisible();
  expect(errors).toEqual([]);
});

// Review: equal counts are not enough. Another tab adds one task to the group and moves a different one out,
// so the stored count matches this tab's; the move must still refuse, or its single write drops the new task.
test('another tab adds one task to the group and moves another out: same count, the move is still refused', async ({ page, context }) => {
  await open(page, DAY, '', { groups: GROUPS });
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  const other = await context.newPage();
  await other.goto('/');
  await other.evaluate(([key]) => {
    const all = JSON.parse(localStorage.getItem(key));
    all.find((t) => t.id === 'c1').groupId = 'nha';
    all.push({ id: 'other', text: 'Việc từ tab khác', done: false, createdAt: Date.now(), date: all[0].date, groupId: 'cty' });
    localStorage.setItem(key, JSON.stringify(all));
  }, [KEY]);
  await other.close();
  const before = await storedRaw(page);
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(moveError(page)).toHaveText(MOVE_STALE);
  await expect(moveCard(page)).toBeVisible();
  expect(await storedRaw(page)).toBe(before);
  expect(JSON.parse(before).some((t) => t.id === 'other')).toBe(true);
});

// T11: keyboard, size, safety and speed checks (R9, R12, R59 to R66, NFR1 to NFR8)
const press = async (page, ...keys) => { for (const k of keys) await page.keyboard.press(k); };
// Tab forward until the locator has focus; fails if it is not reached within `max` presses.
async function tabTo(page, locator, max = 40) {
  for (let i = 0; i < max; i++) {
    if (await locator.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(locator).toBeFocused();
}
// The page never scrolls sideways, and nothing in an open dialog reaches past the screen edge. Notes keep overflow
// visible for their corner sticker, so their own scrollWidth is not a scroll; the card's row list does scroll.
const noHScroll = async (page, label) => {
  // Dialogs settle in with a short scale, so measure once nothing is moving.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  const r = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth - innerWidth,
    // The corner sticker hangs past the card edge by design (move-all.html does the same at 390 px); it is aria-hidden.
    out: [...document.querySelectorAll('dialog[open] *:not(.sticker--corner)')].filter((el) => {
      const b = el.getBoundingClientRect();
      return b.width && (b.left < -0.5 || b.right > innerWidth + 0.5);
    }).map((el) => el.className.baseVal ?? el.className),
    scrollers: [...document.querySelectorAll('dialog[open] .group-rows')].map((l) => l.scrollWidth - l.clientWidth),
  }));
  expect(r.doc, label).toBeLessThanOrEqual(0);
  expect(r.out, label).toEqual([]);
  for (const d of r.scrollers) expect(d, label).toBeLessThanOrEqual(0);
};
// Every visible match has a hit area of at least 44 by 44 CSS px: a 36 px button reaches 44 with an absolute
// ::before that sticks out of it (inset -4px 0), so that overhang is added to its box.
const atLeast44 = async (locator, label) => {
  const sizes = await locator.evaluateAll((els) => els.filter((el) => el.getClientRects().length).map((el) => {
    let w = el.offsetWidth, h = el.offsetHeight;
    for (const pseudo of ['::before', '::after']) {
      const c = getComputedStyle(el, pseudo);
      if (c.content === 'none' || c.position !== 'absolute') continue;
      const px = (v) => (v.endsWith('px') ? parseFloat(v) : 0);
      w = Math.max(w, el.offsetWidth - px(c.left) - px(c.right));
      h = Math.max(h, el.offsetHeight - px(c.top) - px(c.bottom));
    }
    return [el.getAttribute('aria-label') ?? el.textContent.trim(), w, h];
  }));
  expect(sizes.length, label).toBeGreaterThan(0);
  expect(sizes.filter(([, w, h]) => w < 44 || h < 44), label).toEqual([]);
};
const failWrites = (page, keys) => page.evaluate((ks) => {
  window.__set = window.__set ?? Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, v) { if (ks.includes(key)) throw new DOMException('Full', 'QuotaExceededError'); return window.__set.call(this, key, v); };
}, keys);
const allowWrites = (page) => page.evaluate(() => { Storage.prototype.setItem = window.__set; });
const SLIP_TEXT = 'Không thể lưu dữ liệu trên trình duyệt này. Công việc có thể bị mất khi bạn tải lại trang.';
const cardAlert = (page) => card(page).locator('#manage-save-error');

test('keyboard only: create a group on the fly, add, collapse, filter, move a task, rename and recolour, move all, delete', async ({ page }) => {
  await open(page, []);
  const input = page.locator('#new-task');
  await expect(input).toBeFocused();
  // Two groups made on the fly, each with a task; the typed task text waits while the group is made (R16).
  for (const [text, name] of [['Gửi báo cáo', 'Công ty'], ['Tưới cây', 'Nhà']]) {
    await page.keyboard.type(text);
    await press(page, 'Tab', 'End'); // Nhóm mới... is the last option
    await expect(nameInput(page)).toBeFocused();
    await page.keyboard.type(name);
    await press(page, 'Enter');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(text);
    await press(page, 'Enter');
    await expect(sectionLabels(page, name)).toHaveText([text]);
  }
  // Collapse and expand with Enter.
  const head = toggle(page, 'Công ty');
  await tabTo(page, head);
  await press(page, 'Enter');
  await expect(head).toHaveAttribute('aria-expanded', 'false');
  await press(page, 'Enter');
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  // Move a task: Sửa, the group choice, Lưu; Escape on a second edit changes nothing.
  await tabTo(page, editOf(page, 'Gửi báo cáo'));
  await press(page, 'Enter');
  await expect(editField(page)).toBeFocused();
  await tabTo(page, editChoice(page));
  await press(page, 'ArrowDown'); // Công ty to Nhà
  await tabTo(page, page.locator('.task__edit').getByRole('button', { name: 'Lưu' }));
  await press(page, 'Enter');
  await expect(sectionLabels(page, 'Nhà')).toHaveText(['Gửi báo cáo', 'Tưới cây']);
  await expect(editOf(page, 'Gửi báo cáo')).toBeFocused();
  await press(page, 'Enter', 'Escape');
  await expect(editOf(page, 'Gửi báo cáo')).toBeFocused();
  // Filter to Nhà and back to Tất cả nhóm.
  await page.keyboard.press('Shift+Tab');
  for (let i = 0; i < 40 && !(await filterSel(page).evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Shift+Tab');
  await press(page, 'End');
  await expect(filterSel(page)).toHaveValue(/.+/);
  await expect(names(page)).toHaveText(['Nhà']);
  await press(page, 'Home');
  await expect(filterSel(page)).toHaveValue('all');
  // The card: rename and recolour Công ty with the keys.
  await tabTo(page, manageBtn(page));
  await press(page, 'Enter');
  await expect(card(page)).toBeVisible();
  await tabTo(page, sua(page, 'Công ty'));
  await press(page, 'Enter');
  await expect(renameInput(page)).toBeFocused();
  await press(page, 'End');
  await page.keyboard.type(' mới');
  await press(page, 'Tab', 'ArrowRight'); // Vàng to Hồng
  await tabTo(page, card(page).getByRole('button', { name: 'Lưu' }));
  await press(page, 'Enter');
  await expect(sua(page, 'Công ty mới')).toBeFocused();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => [g.name, g.color])).toEqual([['Công ty mới', 'pink'], ['Nhà', 'pink']]);
  // Move all of Nhà into Công ty mới.
  await tabTo(page, moveBtn(page, 'Nhà'));
  await press(page, 'Enter');
  await expect(moveCard(page)).toBeVisible();
  await tabTo(page, target(page));
  await press(page, 'ArrowDown');
  await expect(target(page)).not.toHaveValue('none');
  await tabTo(page, moveCard(page).getByRole('button', { name: 'Chuyển việc' }));
  await press(page, 'Enter');
  await expect(card(page)).toBeHidden();
  await expect(manageBtn(page)).toBeFocused();
  await expect(names(page)).toHaveText(['Công ty mới']);
  // Delete the now empty Nhà: Escape keeps it, then Xóa nhóm.
  await press(page, 'Enter');
  await tabTo(page, xoa(page, 'Nhà'));
  await press(page, 'Enter');
  await expect(deleteNote(page).getByRole('button', { name: 'Giữ lại' })).toBeFocused();
  await press(page, 'Escape');
  await expect(xoa(page, 'Nhà')).toBeFocused();
  await press(page, 'Enter', 'Tab', 'Enter');
  await expect(cardRows(page).locator('.sticker')).toHaveText(['Công ty mới']);
  await press(page, 'Escape');
  await expect(manageBtn(page)).toBeFocused();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.name)).toEqual(['Công ty mới']);
  expect((await storedJson(page, KEY)).length).toBe(2);
});

test('every new control is at least 44 by 44 px', async ({ page }) => {
  await open(page, SPREAD, '', { groups: [...GROUPS, SK] });
  await atLeast44(page.locator('#new-task-group, #group-filter, #manage-groups, .group__toggle, #add-form [type=submit]'), 'page');
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await atLeast44(page.locator('#create-group, #new-group-name'), 'new group line');
  await page.keyboard.press('Escape');
  await editOf(page, 'Gửi báo cáo').click();
  await atLeast44(page.locator('.task__edit select, .task__edit button'), 'task edit');
  await page.keyboard.press('Escape');
  await openCard(page);
  await atLeast44(card(page).locator('button'), 'card');
  await startRename(page, 'Công ty');
  await atLeast44(card(page).locator('.colour-pick__list label, .group-row--editing button'), 'rename');
  await page.keyboard.press('Escape');
  await xoa(page, 'Sức khỏe').click();
  await atLeast44(deleteNote(page).locator('button'), 'delete note');
  await page.keyboard.press('Escape');
  await xoa(page, 'Nhà').click();
  await atLeast44(blockedNote(page).locator('button'), 'blocked note');
  await blockedNote(page).getByRole('button', { name: 'Chuyển tất cả việc' }).click();
  await atLeast44(moveCard(page).locator('select, button'), 'move card');
});

test('360 px with 20 long names: no horizontal scroll with the new group line, the edit choice and each dialog open', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const long = Array.from({ length: 19 }, (_, i) => group(`g${i}`, `${String(i).padStart(2, '0')} Dự án khách hàng lớn ${'x'.repeat(6)}`, 'blue', i + 1));
  const gs = [...long, group('w', 'W'.repeat(30), 'pink', 99)];
  const tasks = [{ ...task('a', 'Một việc có nội dung rất dài '.repeat(5).trim()), groupId: 'w' }, task('b', 'Hai'), { ...task('c', 'Ba'), groupId: 'g0' }];
  await open(page, tasks, '', { groups: gs });
  await noHScroll(page, 'sections');
  await choice(page).selectOption('w');
  await filterSel(page).selectOption('w');
  await noHScroll(page, 'long name chosen');
  await filterSel(page).selectOption('all');
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('W'.repeat(30));
  await noHScroll(page, 'new group line');
  await page.keyboard.press('Escape');
  await editOf(page, 'Hai').click();
  await editChoice(page).selectOption('w');
  await noHScroll(page, 'task edit');
  await page.keyboard.press('Escape');
  await openCard(page);
  await noHScroll(page, 'card');
  await startRename(page, 'W'.repeat(30));
  await noHScroll(page, 'rename');
  await page.keyboard.press('Escape');
  await xoa(page, long[3].name).click();
  await noHScroll(page, 'delete note');
  await page.keyboard.press('Escape');
  await xoa(page, 'W'.repeat(30)).click();
  await noHScroll(page, 'blocked note');
  await page.keyboard.press('Escape');
  await xoa(page, long[0].name).click();
  await blockedNote(page).getByRole('button', { name: 'Chuyển tất cả việc' }).click();
  await target(page).selectOption('g18');
  await noHScroll(page, 'move card');
});

// Found in T11: a 30 character name with no space used to run off a phone screen in the move card title.
test('360 px: the move card title wraps a 30 character name with no space', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, [{ ...task('a', 'Một'), groupId: 'w' }], '', { groups: [group('w', 'W'.repeat(30), 'pink')] });
  await openCard(page);
  await moveBtn(page, 'W'.repeat(30)).click();
  await noHScroll(page, 'move card');
});

test('reduced motion: collapse, expand and a move run no animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, DAY, '', { groups: GROUPS });
  // Reduced motion leaves 1 ms timings at most (design-system.css); anything longer is an animation that runs.
  const running = () => page.evaluate(() => document.getAnimations().filter((a) => a.effect.getComputedTiming().duration > 1)
    .map((a) => a.animationName ?? a.transitionProperty));
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  await toggle(page, 'Công ty').click();
  expect(await running()).toEqual([]);
  await toggle(page, 'Công ty').click();
  expect(await running()).toEqual([]);
  await editOf(page, 'Tưới cây').click();
  await editChoice(page).selectOption('cty');
  await page.locator('.task__edit').getByRole('button', { name: 'Lưu' }).click();
  await expect(sectionLabels(page, 'Công ty')).toContainText(['Tưới cây']);
  expect(await running()).toEqual([]);
});

test('data saved before the feature: every task shown ungrouped, the tasks string unchanged; the first group keeps old shapes', async ({ page }) => {
  const days = ['2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', TODAY];
  const legacy = Array.from({ length: 30 }, (_, i) => task(`l${i}`, `Việc cũ ${i + 1}`, i % 3 === 0, days[i % 5], NOW.getTime() - 86400000 + i));
  await open(page, legacy);
  const raw = JSON.stringify(legacy);
  await expect(rows(page)).toHaveCount(6);
  await expect(sections(page)).toHaveCount(0);
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Xem ngày trước' }).click();
  await expect(rows(page)).toHaveCount(6);
  await page.getByRole('button', { name: 'Về hôm nay' }).click();
  expect(await storedRaw(page)).toBe(raw);
  expect(await storedAll(page)).toEqual([raw, null, null]);
  // The first group, a task added to it and one old task moved into it.
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('Công ty');
  await nameInput(page).press('Enter');
  await addTask(page, 'Việc mới');
  await editOf(page, 'Việc cũ 5').click();
  await editChoice(page).selectOption({ label: 'Công ty' });
  await editField(page).press('Enter');
  const after = await stored(page);
  const gid = (await storedJson(page, GROUPS_KEY))[0].id;
  expect(after.length).toBe(31);
  expect(after.find((t) => t.text === 'Việc mới').groupId).toBe(gid);
  expect(after.find((t) => t.id === 'l4')).toEqual({ ...legacy[4], groupId: gid });
  expect(after.filter((t) => t.id !== 'l4' && t.text !== 'Việc mới')).toEqual(legacy.filter((t) => t.id !== 'l4'));
  await page.reload();
  expect((await stored(page)).length).toBe(31);
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Việc cũ 5', 'Việc mới']);
});

for (const ui of ['garbage', '{"collapsed":["gone","x\\"]"]}']) {
  test(`corrupt groups and a UI value of ${ui}: no message, no error, every task shown, the corrupt copy written`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await open(page, DAY, '', { groups: '{bad json', ui });
    await expect(rows(page)).toHaveCount(DAY.length);
    await expect(sections(page)).toHaveCount(0);
    await expect(slip(page)).toBeHidden();
    await expect(notice(page)).toBeHidden();
    expect(await page.evaluate((k) => localStorage.getItem(`${k}:corrupt`), GROUPS_KEY)).toBe('{bad json');
    // With good groups the same UI value leaves every section open.
    await page.evaluate(([k, g]) => localStorage.setItem(k, g), [GROUPS_KEY, JSON.stringify(GROUPS)]);
    await page.reload();
    await expect(sections(page).locator('.group__toggle[aria-expanded="true"]')).toHaveCount(3);
    expect(errors).toEqual([]);
  });
}

test('storage blocked: create, add, move and collapse work in memory with the slip, and nothing is written', async ({ page }) => {
  await page.addInitScript(() => {
    window.__writes = [];
    Storage.prototype.getItem = function () { throw new DOMException('Blocked', 'SecurityError'); };
    Storage.prototype.setItem = function (k) { window.__writes.push(k); throw new DOMException('Blocked', 'SecurityError'); };
  });
  await open(page, null);
  await expect(slip(page)).toBeVisible();
  for (const name of ['Công ty', 'Nhà']) {
    await choice(page).selectOption({ label: 'Nhóm mới...' });
    await nameInput(page).fill(name);
    await nameInput(page).press('Enter');
    await addTask(page, `Việc ${name}`);
  }
  await editOf(page, 'Việc Nhà').click();
  await editChoice(page).selectOption({ label: 'Công ty' });
  await editField(page).press('Enter');
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Việc Công ty', 'Việc Nhà']);
  await toggle(page, 'Công ty').click();
  await expect(toggle(page, 'Công ty')).toHaveAttribute('aria-expanded', 'false');
  await expect(slip(page)).toBeVisible();
  expect((await page.evaluate(() => window.__writes)).filter((k) => k.startsWith('daily-todo:') && !k.endsWith('swipe-hint-seen'))).toEqual([]);
});

test('a stored colour "red; x" shows as yellow, with no inline style and no unknown data-color', async ({ page }) => {
  await open(page, [{ ...task('a', 'Một'), groupId: 'r' }], '', { groups: [group('r', 'Đỏ', 'red; x')] });
  await expect(sections(page)).toHaveAttribute('data-color', 'yellow');
  await openCard(page);
  await expect(cardRow(page, 'Đỏ').locator('.sticker')).toHaveAttribute('data-color', 'yellow');
  const bad = await page.evaluate(() => [...document.querySelectorAll('[data-color]')]
    .filter((el) => !['yellow', 'pink', 'green', 'blue', 'orange', 'purple', 'none'].includes(el.dataset.color) || el.hasAttribute('style'))
    .map((el) => el.outerHTML.slice(0, 80)));
  expect(bad).toEqual([]);
  expect(await page.evaluate(() => document.querySelector('[style*="red"]'))).toBeNull();
});

test('markup and quotes in stored names and ids: no script, no injected element, selectors still work', async ({ page }) => {
  const evil = [group('a"]b', '<img src=x onerror=window.__x=1>', 'pink', 1), group("c']d", '"><script>window.__x=2</script>', 'green', 2)];
  await open(page, [{ ...task('t', 'Một'), groupId: 'a"]b' }, { ...task('u', 'Hai'), groupId: "c']d" }], '', { groups: evil });
  await expect(names(page)).toHaveText([evil[0].name, evil[1].name]);
  await toggle(page, evil[0].name).click();
  await filterSel(page).selectOption("c']d");
  await expect(rows(page)).toHaveCount(1);
  await filterSel(page).selectOption('all');
  await openCard(page);
  await startRename(page, evil[1].name);
  await page.keyboard.press('Escape');
  await xoa(page, evil[0].name).click();
  await blockedNote(page).getByRole('button', { name: 'Chuyển tất cả việc' }).click();
  await target(page).selectOption("c']d");
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(names(page)).toHaveText([evil[1].name]);
  expect(await page.evaluate(() => [window.__x, document.querySelectorAll('img, body script').length])).toEqual([undefined, 0]);
});

test('every request stays on the same origin and the CSP meta is unchanged', async ({ page, baseURL }) => {
  const urls = [];
  page.on('request', (r) => urls.push(r.url()));
  await open(page, SPREAD, '', { groups: GROUPS });
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('Mới');
  await nameInput(page).press('Enter');
  await addTask(page, 'Một');
  await filterSel(page).selectOption('cty');
  await openCard(page);
  await moveBtn(page, 'Công ty').click();
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  expect(urls.filter((u) => !u.startsWith(new URL(baseURL).origin) && !u.startsWith('data:'))).toEqual([]);
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]'))
    .toHaveAttribute('content', "default-src 'self'; img-src 'self' data:; style-src 'self'");
});

test('failing writes on every action never change or shrink the stored strings, and no task is lost', async ({ page }) => {
  await open(page, SPREAD, '', { groups: [...GROUPS, SK] });
  const before = await storedAll(page);
  await failWrites(page, [KEY, GROUPS_KEY, UI_KEY]);
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('Mới');
  await nameInput(page).press('Enter');
  await addTask(page, 'Việc mới');
  await editOf(page, 'Tưới cây').click();
  await editChoice(page).selectOption('cty');
  await editField(page).press('Enter');
  await toggle(page, 'Nhà').click(); // Nấu cơm keeps Nhà on this day; the fold write fails too
  await expect(toggle(page, 'Nhà')).toHaveAttribute('aria-expanded', 'false');
  await openCard(page);
  await startRename(page, 'Công ty');
  await renameInput(page).fill('Công ty 2');
  await renameInput(page).press('Enter');
  await xoa(page, 'Sức khỏe').click();
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  await moveBtn(page, 'Công ty 2').click();
  await moveCard(page).getByRole('button', { name: 'Chuyển việc' }).click();
  await expect(moveError(page)).toHaveText(MOVE_ERROR);
  expect(await storedAll(page)).toEqual(before);
  await expect(slip(page)).toBeVisible();
});

// T8 carry over: the storage slip sits behind the modal card, so the card says it too.
test('a failed write in the card is announced inside it with the slip text; a good save hides it', async ({ page }) => {
  await open(page, DAY, '', { groups: [...GROUPS, SK] });
  await openCard(page);
  await expect(cardAlert(page)).toBeHidden();
  await failWrites(page, [GROUPS_KEY]);
  await startRename(page, 'Công ty');
  await renameInput(page).fill('Công ty 2');
  await renameInput(page).press('Enter');
  await expect(cardAlert(page)).toHaveText(SLIP_TEXT);
  await expect(cardAlert(page)).toHaveRole('alert');
  await page.keyboard.press('Escape');
  await openCard(page);
  await expect(cardAlert(page)).toBeHidden(); // a fresh card starts clean
  await xoa(page, 'Sức khỏe').click();
  await deleteNote(page).getByRole('button', { name: 'Xóa nhóm' }).click();
  await expect(cardAlert(page)).toHaveText(SLIP_TEXT);
  await allowWrites(page);
  await startRename(page, 'Nhà');
  await renameInput(page).press('Enter');
  await expect(cardAlert(page)).toBeHidden();
  await expect(slip(page)).toBeHidden();
  expect((await storedJson(page, GROUPS_KEY)).map((g) => g.name)).toEqual(['Công ty 2', 'Nhà', 'Học tiếng Nhật']);
});

// T9 carry over: a stored task with a well formed but impossible date never becomes the day to turn to.
for (const [title, dates, to] of [
  ['an impossible earlier date is skipped for the real one', ['2026-01-05', '2026-02-30'], '2026-01-05'],
  ['only an impossible date: the filter applies and the day stays', ['2026-13-45'], TODAY],
]) {
  test(`Xem các việc này: ${title}`, async ({ page }) => {
    const tasks = [...DAY.filter((t) => t.groupId !== 'nha'), ...dates.map((d, i) => inGroup('nha', `x${i}`, `Việc ${i}`, false, d, at(6, i)))];
    await open(page, tasks, '', { groups: GROUPS });
    await openCard(page);
    await xoa(page, 'Nhà').click();
    await blockedNote(page).getByRole('button', { name: 'Xem các việc này' }).click();
    await expect(card(page)).toBeHidden();
    await expect(filterSel(page)).toHaveValue('nha');
    await expect(page.locator('#day-picker')).toHaveValue(to);
    expect(hash(page)).toBe(to === TODAY ? '' : `#${to}`);
    await expect(page.locator('#date-line')).not.toBeEmpty();
  });
}

test('midnight with the filter on, a folded section and the card open: no error; the filter and fold stay; the new day shows', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const next = inGroup('cty', 'm', 'Ngày mai', false, '2026-11-10', at(6, 0));
  await open(page, [...DAY, next], '', { groups: GROUPS, ui: { collapsed: ['nha'] } });
  await filterSel(page).selectOption('cty');
  await openCard(page);
  await passMidnight(page);
  await expect(card(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#day-picker')).toHaveValue('2026-11-10');
  await expect(filterSel(page)).toHaveValue('cty');
  await expect(labels(page)).toHaveText(['Ngày mai']);
  await filterSel(page).selectOption('all');
  await page.getByRole('button', { name: 'Xem ngày trước' }).click();
  await expect(toggle(page, 'Nhà')).toHaveAttribute('aria-expanded', 'false');
  expect(errors).toEqual([]);
});

// NFR1, BUG-002 and BUG-010 method: each update timed in the page with a forced layout, on a page left idle 500 ms first.
test('200 tasks in 20 groups on a settled page: add, move, collapse and filter each under 100 ms', async ({ page }) => {
  const gs = Array.from({ length: 20 }, (_, i) => group(`g${i}`, `Nhóm ${i + 1}`, 'yellow', i + 1));
  const big = Array.from({ length: 200 }, (_, i) => ({ ...task(`t${i}`, `Việc số ${i + 1}`, i % 3 === 0, TODAY, i + 1), groupId: `g${i % 20}` }));
  await open(page, big, '', { groups: gs });
  await expect(rows(page)).toHaveCount(200);
  const timed = async (code) => {
    await page.waitForTimeout(500);
    // A string runs through the debugger, so the page CSP (no eval) does not apply.
    return page.evaluate(`(() => { const t0 = performance.now(); ${code}; void document.body.offsetHeight; return performance.now() - t0; })()`);
  };
  await choice(page).selectOption('g6');
  await page.locator('#new-task').fill('Việc mới');
  expect(await timed("document.getElementById('add-form').requestSubmit()"), 'add').toBeLessThan(100);
  await expect(rows(page)).toHaveCount(201);
  await editOf(page, 'Việc số 1').click();
  await editChoice(page).selectOption('g6');
  // BUG-014: Firefox restyles every node put back into the page, so a move puts back only the moved row, no section.
  await page.evaluate(() => {
    window.__back = [];
    window.__backObserver = new MutationObserver((ms) => ms.forEach((m) => window.__back.push(...[...m.addedNodes].map((n) => ['group', 'task'].find((c) => n.classList?.contains(c))).filter(Boolean))));
    window.__backObserver.observe(document.getElementById('day-list'), { childList: true, subtree: true });
  });
  expect(await timed("document.querySelector('.task__edit').requestSubmit()"), 'move').toBeLessThan(100);
  expect(await page.evaluate(() => { window.__backObserver.disconnect(); return window.__back; }), 'put back').toEqual(['task']);
  await expect(sectionLabels(page, 'Nhóm 7').first()).toHaveText('Việc số 1');
  expect(await timed("document.querySelector('.group__toggle').click()"), 'collapse').toBeLessThan(100);
  await expect(sections(page).first()).toHaveClass(/group--collapsed/);
  expect(await timed("document.querySelector('.group__toggle').click()"), 'expand').toBeLessThan(100);
  const filterTo = (v) => `{ const s = document.getElementById('group-filter'); s.value = '${v}'; s.dispatchEvent(new Event('change', { bubbles: true })); }`;
  expect(await timed(filterTo('g6')), 'filter').toBeLessThan(100);
  await expect(rows(page)).toHaveCount(12);
  expect(await timed(filterTo('all')), 'filter off').toBeLessThan(100);
  await expect(rows(page)).toHaveCount(201);
});

// Added by QA in T11 (TC-task-groups-T11-05 and T11-22)
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

for (const scheme of ['light', 'dark']) {
  test(`${scheme}: the six colours keep the name at 4.5 to 1 on its label and the label mark at 3 to 1 on the paper; the name stays text`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const colours = ['yellow', 'pink', 'green', 'blue', 'orange', 'purple'];
    const gs = colours.map((c, i) => group(`g${i}`, `Nhóm ${c}`, c, at(7, i)));
    const ts = colours.map((c, i) => ({ ...task(`t${i}`, `Việc ${c}`, false, TODAY, at(8, i)), groupId: `g${i}` }));
    await open(page, ts, '', { groups: gs });
    await expect(sections(page)).toHaveCount(6);
    const data = await page.evaluate(() => {
      const rgb = (v) => { const e = document.createElement('i'); e.style.color = v; document.body.append(e); const m = getComputedStyle(e).color.match(/[\d.]+/g).slice(0, 3).map(Number); e.remove(); return m; };
      const paper = rgb(getComputedStyle(document.documentElement).getPropertyValue('--color-paper'));
      return [...document.querySelectorAll('#day-list > .group')].map((s) => {
        const st = getComputedStyle(s), name = s.querySelector('.group__name');
        return { color: s.dataset.color, text: name.textContent, ink: rgb(getComputedStyle(name).color), fill: rgb(st.getPropertyValue('--hl')), mark: rgb(st.getPropertyValue('--hl-mark')), paper };
      });
    });
    expect(data.map((d) => d.color)).toEqual(colours);
    for (const d of data) {
      expect(d.text, d.color).toBe(`Nhóm ${d.color}`);
      expect(ratio(d.ink, d.fill), `${scheme} ${d.color} text on label`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(d.mark, d.paper), `${scheme} ${d.color} mark on paper`).toBeGreaterThanOrEqual(3);
    }
  });
}

test('every shown string is Vietnamese: the listed texts are present and no dash or English word appears on the page, the dialogs or the errors', async ({ page }) => {
  const g = [group('cty', 'Công ty', 'yellow', at(7, 0)), group('nha', 'Nhà', 'pink', at(7, 1))];
  await open(page, [{ ...task('a', 'Việc một', false, TODAY, at(8, 0)), groupId: 'cty' }, task('b', 'Việc hai', false, TODAY, at(8, 1))], '', { groups: g });
  const seen = new Set();
  const collect = async () => {
    for (const s of await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('script,style,template') || el.closest('[hidden]')) continue;
        if (!el.getClientRects().length) continue;
        for (const a of ['aria-label', 'title', 'placeholder']) if (el.getAttribute(a)) out.push(el.getAttribute(a));
        if (el.tagName === 'SELECT') out.push(...[...el.options].map((o) => o.textContent));
        else for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) out.push(n.textContent.trim());
      }
      return out;
    })) seen.add(s);
  };
  await collect();
  await choice(page).selectOption({ label: 'Nhóm mới...' });
  await nameInput(page).fill('');
  await page.getByRole('button', { name: 'Tạo nhóm' }).click();
  await collect();
  await nameInput(page).fill('x'.repeat(31));
  await page.getByRole('button', { name: 'Tạo nhóm' }).click();
  await collect();
  await nameInput(page).fill('Nhà');
  await page.getByRole('button', { name: 'Tạo nhóm' }).click();
  await collect();
  await filterSel(page).selectOption({ label: 'Nhà' });
  await collect();
  await page.getByRole('button', { name: 'Quản lý nhóm' }).click();
  await collect();
  await card(page).getByRole('button', { name: 'Sửa' }).first().click();
  await collect();
  await page.keyboard.press('Escape');
  await card(page).getByRole('button', { name: 'Chuyển tất cả việc' }).first().click();
  await collect();
  await page.keyboard.press('Escape');
  await card(page).getByRole('button', { name: 'Xóa' }).nth(1).click();
  await collect();
  await page.keyboard.press('Escape');
  await card(page).getByRole('button', { name: 'Xóa' }).first().click();
  await collect();
  const all = [...seen];
  for (const must of ['Nhóm', 'Chưa phân nhóm', 'Nhóm mới...', 'Tên nhóm mới', 'Tạo nhóm', 'Quản lý nhóm', 'Nhóm việc', 'Đóng', 'Lọc theo nhóm', 'Tất cả nhóm', 'Màu nhóm', 'Vàng', 'Xanh lá', 'Xanh dương', 'Chuyển tất cả việc', 'Chuyển đến nhóm', 'Chuyển việc', 'Giữ lại', 'Đã hiểu', 'Xem các việc này',
    'Vui lòng nhập tên nhóm.', 'Tên nhóm tối đa 30 ký tự.', 'Tên nhóm này đã có rồi.', 'Chuyển tất cả việc của nhóm "Công ty"']) {
    expect(all.some((s) => s.includes(must)), `missing: ${must}`).toBe(true);
  }
  expect(all.filter((s) => /[–—]/.test(s)), 'dashes').toEqual([]);
  expect(all.filter((s) => /\b(group|groups|delete|cancel|save|close|edit|move|filter|manage|rename|colou?r|the|and|new|all|ok|yes|no)\b/i.test(s)), 'English').toEqual([]);
});

// Added by QA in T11 (TC-task-groups-T11-29)
test('360 px: swipe, peek and Sửa work on rows with long text in sections and in the filtered view, with no sideways scroll', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await page.setViewportSize({ width: 360, height: 740 });
  const long = 'Một việc có chữ rất dài để kiểm tra xuống dòng ' + 'x'.repeat(60);
  const day = DAY.map((t) => (t.id === 'c1' ? { ...t, text: long } : t));
  await open(page, day, '', { groups: GROUPS });
  await page.evaluate((k) => localStorage.setItem(k, '1'), HINT);
  const strip = (text) => rowOf(page, text).locator('.task__swipe');
  const opened = (text) => strip(text).evaluate((el) => el.scrollLeft > 100);
  const noScroll = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await noScroll();
  await touchDrag(page, strip(long), -200);
  await expect.poll(() => opened(long)).toBe(true);
  await noScroll();
  await page.locator('.app-header__title').tap();
  await expect.poll(() => opened(long)).toBe(false);
  // the filtered view keeps the same behaviour
  await filterSel(page).selectOption({ label: 'Công ty' });
  await expect(rows(page)).toHaveCount(3);
  await strip('Họp nhóm').scrollIntoViewIfNeeded();
  await touchDrag(page, strip('Họp nhóm'), -200);
  await expect.poll(() => opened('Họp nhóm')).toBe(true);
  await rowOf(page, 'Họp nhóm').getByRole('button', { name: 'Sửa' }).tap();
  await expect(editField(page)).toBeFocused();
  await noScroll();
});

// T12 (BUG-014): sections and lists on screen are reused, so nothing of the old day or the old header may linger.
test('reused sections across a day change and the filter: rows, fold and header kind stay right', async ({ page }) => {
  const other = { ...task('o1', 'Việc hôm qua', false, '2026-11-08', at(6, 0)), groupId: 'cty' };
  await open(page, [...DAY, other], '', { groups: GROUPS });
  await toggle(page, 'Nhà').click();
  await page.locator('#prev-day').click();
  await expect(names(page)).toHaveText(['Công ty']);
  await expect(rows(page)).toHaveCount(1);
  await expect(labels(page)).toHaveText(['Việc hôm qua']);
  await page.locator('#next-day').click();
  await expect(names(page)).toHaveText(['Công ty', 'Nhà', 'Chưa phân nhóm']);
  await expect(rows(page)).toHaveCount(6);
  await expect(sectionLabels(page, 'Công ty')).toHaveText(['Gửi báo cáo', 'Họp nhóm', 'Trả lời email']);
  await expect(toggle(page, 'Nhà')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#group-filter').selectOption('nha');
  await expect(sections(page)).toHaveCount(1);
  await expect(page.locator('.group__toggle')).toHaveCount(0);
  await expect(sectionLabels(page, 'Nhà')).toHaveText(['Tưới cây', 'Nấu cơm']);
  await expect(sectionLabels(page, 'Nhà').first()).toBeVisible();
  await page.locator('#group-filter').selectOption('all');
  await expect(names(page)).toHaveText(['Công ty', 'Nhà', 'Chưa phân nhóm']);
  await expect(toggle(page, 'Nhà')).toHaveAttribute('aria-expanded', 'false');
  await expect(rows(page)).toHaveCount(6);
});
