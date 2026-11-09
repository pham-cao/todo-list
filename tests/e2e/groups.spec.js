import { test, expect } from '@playwright/test';
import {
  TODAY, NOW, KEY, GROUPS_KEY, UI_KEY, task, group, open, rows, labels, progress, box, storedRaw, storedJson,
  addTask, tick, sections, section, toggle, passMidnight,
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

test('200 tasks in 20 groups: a move stays under 100 ms', async ({ page }) => {
  const gs = Array.from({ length: 20 }, (_, i) => group(`g${i}`, `Nhóm ${i + 1}`, 'yellow', i + 1));
  const big = Array.from({ length: 200 }, (_, i) => ({ ...task(`t${i}`, `Việc số ${i + 1}`, false, TODAY, i + 1), groupId: `g${i % 20}` }));
  await open(page, big, '', { groups: gs });
  await editOf(page, 'Việc số 1').click();
  await editChoice(page).selectOption({ label: 'Nhóm 7' });
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
