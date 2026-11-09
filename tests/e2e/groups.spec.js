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
