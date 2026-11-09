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
