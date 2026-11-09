import { test, expect } from '@playwright/test';
import { TODAY, NOW, KEY, AFTER_MIDNIGHT, task, open, rows, labels, progress, hash, stored, storedRaw, addTask, tick, passMidnight } from './helpers.js';

const heading = (page) => page.getByRole('heading', { level: 1 });
const dateLine = (page) => page.locator('#date-line');
const input = (page) => page.locator('#new-task');
const toToday = (page) => page.getByRole('button', { name: 'Về hôm nay' });
const emptyText = (page) => page.locator('.empty__text');

const SEED = [
  task('y1', 'Dọn tủ quần áo', true, '2026-11-08', 1),
  task('t1', 'Gửi báo cáo tuần'),
  task('y2', 'Gọi video cho bố mẹ', false, '2026-11-08', 2),
  task('y3', 'Nấu canh chua', true, '2026-11-08', 3),
];

async function expectWording(page, { title, line, ask, empty }) {
  await expect(heading(page)).toHaveText(title);
  await expect(page).toHaveTitle(title);
  await expect(dateLine(page)).toHaveText(line);
  await expect(input(page)).toHaveAttribute('placeholder', ask);
  await expect(page.getByLabel(ask)).toHaveCount(1);
  if (empty) await expect(emptyText(page)).toHaveText(empty);
}

test('nav row has the named buttons, the date stamp and a live date line', async ({ page }) => {
  await open(page);
  const nav = page.locator('header nav.day-nav');
  const buttons = nav.getByRole('button');
  await expect(buttons).toHaveCount(3);
  for (const [i, name] of ['Xem ngày trước', 'Xem ngày sau', 'Về hôm nay'].entries()) {
    await expect(buttons.nth(i)).toHaveAccessibleName(name);
    await expect(buttons.nth(i)).toHaveAttribute('type', 'button');
  }
  const picker = nav.getByLabel('Chọn ngày');
  await expect(picker).toHaveAttribute('type', 'date');
  await expect(picker).toHaveAttribute('min', '2000-01-01');
  await expect(picker).toHaveAttribute('max', '2099-12-31');
  await expect(picker).toHaveValue(TODAY);
  await expect(dateLine(page)).toHaveAttribute('aria-live', 'polite');
  await expect(toToday(page)).toHaveAttribute('aria-disabled', 'true');
});

test('loading yesterday from the address shows its wording, tasks and summary', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  await expectWording(page, { title: 'Việc cần làm', line: 'Hôm qua, Chủ Nhật, 08/11/2026', ask: 'Bạn cần làm gì ngày này?' });
  await expect(labels(page)).toHaveText(['Dọn tủ quần áo', 'Gọi video cho bố mẹ', 'Nấu canh chua']);
  await expect(page.getByText('Gửi báo cáo tuần')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 2/3 việc');
  await expect(progress(page)).toHaveCSS('--p', '67');
  await expect(input(page)).toBeFocused();
  await expect(page.getByLabel('Chọn ngày')).toHaveValue('2026-11-08');
  await expect(toToday(page)).not.toHaveAttribute('aria-disabled');
  expect(new URL(page.url()).hash).toBe('#2026-11-08');
});

test('an empty future day and an empty past day show their own empty text', async ({ page }) => {
  await open(page, SEED, '#2026-11-10');
  await expectWording(page, {
    title: 'Việc cần làm', line: 'Ngày mai, Thứ Ba, 10/11/2026', ask: 'Bạn cần làm gì ngày này?',
    empty: 'Ngày này chưa có việc nào. Hãy thêm việc để chuẩn bị nhé!',
  });
  await expect(rows(page)).toHaveCount(0);
  await expect(progress(page)).toBeHidden();
  await expect(page.getByRole('status')).toBeHidden();

  await page.goto('./#2026-11-05');
  await page.reload();
  await expectWording(page, {
    title: 'Việc cần làm', line: 'Thứ Năm, 05/11/2026', ask: 'Bạn cần làm gì ngày này?',
    empty: 'Ngày này chưa có việc nào được ghi lại.',
  });
  await expect(page.locator('.empty')).toBeVisible();
});

test('today keeps its own wording on the plain address', async ({ page }) => {
  await open(page);
  await expectWording(page, {
    title: 'Việc cần làm hôm nay', line: 'Hôm nay, Thứ Hai, 09/11/2026', ask: 'Bạn cần làm gì hôm nay?',
    empty: 'Hôm nay chưa có việc nào. Hãy thêm việc đầu tiên nhé!',
  });
});

test('arriving on an all done day shows the stamp without the celebration', async ({ page }) => {
  await open(page, [task('a', 'Một', true, '2026-11-08'), task('b', 'Hai', true, '2026-11-08')], '#2026-11-08');
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 2/2 việc');
  await expect(progress(page)).toHaveClass(/progress--complete/);
  await expect(progress(page)).not.toHaveClass(/progress--celebrate/);
  await page.reload();
  await expect(progress(page)).toHaveClass(/progress--complete/);
  await expect(progress(page)).not.toHaveClass(/progress--celebrate/);
});

test('ticking the last task on the viewed day still celebrates', async ({ page }) => {
  await open(page, [task('a', 'Một', true, '2026-11-08'), task('b', 'Hai', false, '2026-11-08')], '#2026-11-08');
  await tick(page, 1);
  await expect(progress(page)).toHaveClass(/progress--celebrate/);
});

for (const hash of ['#2026-02-30', '#1999-12-31', '#2100-01-01', '#abc', '#2026-1-5', '#2026-13-01', '#', '#2026-11-09',
  '#<img src=x onerror=alert(1)>', '#2026-11-08%3Cb%3E']) {
  test(`hash ${hash} shows today and cleans the address without a history entry`, async ({ page }) => {
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('dialog', (d) => { errors.push(`dialog ${d.message()}`); d.dismiss(); });
    await open(page, [task('a', 'Gửi báo cáo tuần')]);
    const before = await page.evaluate(() => history.length);
    await page.goto(`./${hash}`);
    await page.reload(); // load the hash fresh, as if typed into a new tab
    const after = await page.evaluate(() => history.length);
    await expect(heading(page)).toHaveText('Việc cần làm hôm nay');
    await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
    await expect(labels(page)).toHaveText(['Gửi báo cáo tuần']);
    await expect(toToday(page)).toHaveAttribute('aria-disabled', 'true');
    expect(page.url()).toBe(new URL('./', page.url()).href);
    expect(after).toBe(before + 1); // only the goto added an entry; the clean replaced it
    await expect(page.locator('header img, .sheet b')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

test('a hash equal to today on first load is replaced, not pushed', async ({ page }) => {
  await open(page, undefined, '#2026-11-09');
  await expect(heading(page)).toHaveText('Việc cần làm hôm nay');
  expect(hash(page)).toBe('');
  expect(await page.evaluate(() => history.length)).toBe(2); // about:blank, then this page
});

test('Về hôm nay is muted on today and filled on other days', async ({ page }) => {
  await open(page, SEED);
  await expect(toToday(page)).toHaveAttribute('aria-disabled', 'true');
  const todayBg = await toToday(page).evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.goto('./#2026-11-10');
  await page.reload();
  await expect(toToday(page)).not.toHaveAttribute('aria-disabled');
  const otherBg = await toToday(page).evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(todayBg).toBe('rgba(0, 0, 0, 0)');
  expect(otherBg).not.toBe(todayBg);
});

test('the app works under a subpath: relative assets, address keeps path and query', async ({ page, baseURL }) => {
  const outside = [];
  await page.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (!u.pathname.startsWith('/todo/')) { outside.push(u.pathname); return route.continue(); }
    const res = await route.fetch({ url: baseURL + u.pathname.replace('/todo/', '/') + u.search });
    await route.fulfill({ response: res });
  });
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(SEED)]);
  await page.goto(`${baseURL}/todo/index.html?x=1#2026-11-08`);
  await expect(dateLine(page)).toHaveText('Hôm qua, Chủ Nhật, 08/11/2026');
  await expect(rows(page)).toHaveCount(3);
  await page.goto(`${baseURL}/todo/index.html?x=1#2026-11-09`);
  await page.reload();
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe('/todo/index.html?x=1');
  expect(hash(page)).toBe('');
  expect(outside.filter((p) => !p.startsWith('/favicon'))).toEqual([]);
});

test('new nav controls and day wording are Vietnamese with diacritics', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  await expect(page.locator('.date-stamp')).toHaveAttribute('data-tip', 'Chọn ngày');
  const text = await page.locator('header').innerText();
  expect(text).toMatch(/Về hôm nay/);
  expect(text).not.toMatch(/\b(Today|Previous|Next|Yesterday|Tomorrow|Pick)\b/i);
});

// T4: previous, next, back to today, and browser history
const prev = (page) => page.getByRole('button', { name: 'Xem ngày trước' });
const next = (page) => page.getByRole('button', { name: 'Xem ngày sau' });
const historyLength = (page) => page.evaluate(() => history.length);

test('previous and next move one day, write the address and never reload', async ({ page }) => {
  await open(page, [...SEED, task('m1', 'Đi chợ sớm', false, '2026-11-10')]);
  await page.evaluate(() => { window.marker = 1; });
  const start = await historyLength(page);

  await prev(page).click();
  await expectWording(page, { title: 'Việc cần làm', line: 'Hôm qua, Chủ Nhật, 08/11/2026', ask: 'Bạn cần làm gì ngày này?' });
  await expect(labels(page)).toHaveText(['Dọn tủ quần áo', 'Gọi video cho bố mẹ', 'Nấu canh chua']);
  expect(hash(page)).toBe('#2026-11-08');
  expect(await historyLength(page)).toBe(start + 1);
  await expect(prev(page)).toBeFocused();

  await next(page).click();
  await next(page).click();
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  await expect(labels(page)).toHaveText(['Đi chợ sớm']);
  expect(hash(page)).toBe('#2026-11-10');
  await next(page).click();
  await expect(dateLine(page)).toHaveText('Thứ Tư, 11/11/2026');
  expect(hash(page)).toBe('#2026-11-11');
  await expect(page.getByLabel('Chọn ngày')).toHaveValue('2026-11-11');
  expect(await historyLength(page)).toBe(start + 4);
  await expect(next(page)).toBeFocused();
  expect(await page.evaluate(() => window.marker)).toBe(1);
});

test('Về hôm nay returns to today, removes the hash and keeps focus', async ({ page }) => {
  await open(page, SEED, '#2026-11-05');
  const start = await historyLength(page);
  await toToday(page).click();
  await expectWording(page, { title: 'Việc cần làm hôm nay', line: 'Hôm nay, Thứ Hai, 09/11/2026', ask: 'Bạn cần làm gì hôm nay?' });
  await expect(labels(page)).toHaveText(['Gửi báo cáo tuần']);
  expect(page.url()).toBe(new URL('./', page.url()).href);
  expect(await historyLength(page)).toBe(start + 1);
  await expect(toToday(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(toToday(page)).toBeFocused();
});

test('Về hôm nay on today does nothing with click, Enter or Space', async ({ page }) => {
  await open(page, SEED);
  const start = await historyLength(page);
  await toToday(page).click({ force: true }); // Playwright waits on aria-disabled; the real click still lands
  await expect(toToday(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(toToday(page)).toBeFocused();
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  expect(page.url()).toBe(new URL('./', page.url()).href);
  expect(await historyLength(page)).toBe(start);
});

test('Enter and Space on the nav buttons move and keep focus', async ({ page }) => {
  await open(page, SEED);
  await prev(page).focus();
  await page.keyboard.press('Enter');
  await expect(dateLine(page)).toHaveText('Hôm qua, Chủ Nhật, 08/11/2026');
  await expect(prev(page)).toBeFocused();
  await next(page).focus();
  await page.keyboard.press('Space');
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  await expect(next(page)).toBeFocused();
  await page.keyboard.press('Space');
  await toToday(page).focus();
  await page.keyboard.press('Enter');
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  await expect(toToday(page)).toBeFocused();
});

test('browser Back and Forward retrace three moves day by day', async ({ page }) => {
  await open(page, SEED);
  await prev(page).click();
  await prev(page).click();
  await next(page).click();
  const lines = { '': 'Hôm nay, Thứ Hai, 09/11/2026', '#2026-11-08': 'Hôm qua, Chủ Nhật, 08/11/2026', '#2026-11-07': 'Thứ Bảy, 07/11/2026' };
  const trail = ['#2026-11-08', '#2026-11-07', '#2026-11-08', ''];
  for (const h of trail.slice(1)) {
    await page.goBack();
    await expect(dateLine(page)).toHaveText(lines[h]);
    expect(hash(page)).toBe(h);
  }
  await expect(labels(page)).toHaveText(['Gửi báo cáo tuần']);
  await expect(toToday(page)).toHaveAttribute('aria-disabled', 'true');
  for (const h of ['#2026-11-08', '#2026-11-07', '#2026-11-08']) {
    await page.goForward();
    await expect(dateLine(page)).toHaveText(lines[h]);
    expect(hash(page)).toBe(h);
  }
  await expect(page.getByLabel('Chọn ngày')).toHaveValue('2026-11-08');
});

for (const [start, button, label] of [['#2099-12-31', next, 'Thứ Năm, 31/12/2099'], ['#2000-01-01', prev, 'Thứ Bảy, 01/01/2000']]) {
  test(`pressing past the year bound on ${start} changes nothing`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, SEED, start);
    const before = await historyLength(page);
    await button(page).click();
    await expect(dateLine(page)).toHaveText(label);
    expect(hash(page)).toBe(start);
    expect(await historyLength(page)).toBe(before);
    await expect(button(page)).toBeFocused();
    expect(errors).toEqual([]);
  });
}

test('moves cross year end and the leap day', async ({ page }) => {
  await open(page, SEED, '#2026-12-31');
  await next(page).click();
  await expect(dateLine(page)).toHaveText('Thứ Sáu, 01/01/2027');
  expect(hash(page)).toBe('#2027-01-01');
  await prev(page).click();
  expect(hash(page)).toBe('#2026-12-31');
  await page.evaluate(() => { location.hash = '#2028-03-01'; });
  await expect(dateLine(page)).toHaveText('Thứ Tư, 01/03/2028');
  await prev(page).click();
  await expect(dateLine(page)).toHaveText('Thứ Ba, 29/02/2028');
  expect(hash(page)).toBe('#2028-02-29');
});

test('a move drops an open edit without saving it', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  await rows(page).nth(0).getByRole('button', { name: 'Sửa' }).click();
  await page.locator('.task__edit .input').fill('đã sửa');
  await next(page).click();
  await expect(page.locator('.task__edit')).toHaveCount(0);
  await prev(page).click();
  await expect(page.locator('.task__edit')).toHaveCount(0);
  await expect(rows(page).nth(0).locator('.task__label')).toHaveText('Dọn tủ quần áo');
  expect((await stored(page)).find((t) => t.id === 'y1').text).toBe('Dọn tủ quần áo');
});

test('a move closes an open delete note without deleting', async ({ page }) => {
  await open(page, SEED);
  await prev(page).click();
  await rows(page).nth(0).getByRole('button', { name: 'Xóa' }).click();
  await expect(page.locator('#delete-dialog')).toBeVisible();
  await page.goBack(); // the note is modal, so only the address can move the day under it
  await expect(page.locator('#delete-dialog')).toBeHidden();
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  await page.goForward();
  await expect(rows(page)).toHaveCount(3);
  expect((await stored(page))).toHaveLength(4);
});

test('a move clears the add error and keeps the typed add text', async ({ page }) => {
  await open(page, SEED);
  await input(page).press('Enter');
  await expect(page.locator('#new-task-error')).toBeVisible();
  await input(page).fill('Mua sữa');
  await prev(page).click();
  await expect(input(page)).toHaveValue('Mua sữa');

  await addTask(page, '');
  await expect(page.locator('#new-task-error')).toBeVisible();
  await input(page).evaluate((el) => { el.value = 'Mua sữa'; }); // no input event: the error is still showing
  await next(page).click();
  await expect(page.locator('#new-task-error')).toBeHidden();
  await expect(input(page)).not.toHaveAttribute('aria-invalid');
  await expect(input(page)).toHaveValue('Mua sữa');
});

test('a move leaves no row swiped open on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await open(page, [task('a', 'Một'), task('b', 'Hai')]);
  await page.evaluate(() => localStorage.setItem('daily-todo:swipe-hint-seen', '1'));
  const swipe = rows(page).nth(0).locator('.task__swipe');
  await swipe.evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect.poll(() => swipe.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await page.evaluate(() => { location.hash = '#2026-11-10'; });
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  await page.goBack();
  await expect(rows(page)).toHaveCount(2);
  for (const s of await page.locator('.task__swipe').all()) expect(await s.evaluate((el) => el.scrollLeft)).toBe(0);
});

test('changing the hash on a loaded page shows that day, then today', async ({ page }) => {
  await open(page, SEED);
  const start = await historyLength(page);
  await page.evaluate(() => { location.hash = '#2026-11-08'; });
  await expect(dateLine(page)).toHaveText('Hôm qua, Chủ Nhật, 08/11/2026');
  await expect(rows(page)).toHaveCount(3);
  await page.evaluate(() => { location.hash = ''; });
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  expect(page.url()).toBe(new URL('./', page.url()).href);
  expect(await historyLength(page)).toBe(start + 2);
  await page.evaluate(() => { location.hash = '#abc'; });
  await expect.poll(() => page.url()).toBe(new URL('./', page.url()).href);
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
});

test('moving around never writes the tasks', async ({ page }) => {
  await open(page, SEED);
  const before = await storedRaw(page);
  await page.evaluate((k) => {
    window.writes = 0;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === k) window.writes++; return set.call(this, key, value); };
  }, KEY);
  for (let i = 0; i < 5; i++) await prev(page).click();
  for (let i = 0; i < 3; i++) await next(page).click();
  await page.goBack();
  await page.goBack();
  await toToday(page).click();
  expect(await page.evaluate(() => window.writes)).toBe(0);
  expect(await storedRaw(page)).toBe(before);
});

test('under a subpath, moves keep the path and query and Về hôm nay restores the plain address', async ({ page, baseURL }) => {
  await page.route('**/todo/**', async (route) => {
    const u = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: baseURL + u.pathname.replace('/todo/', '/') + u.search }) });
  });
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(SEED)]);
  await page.goto(`${baseURL}/todo/index.html?x=1`);
  const at = () => { const u = new URL(page.url()); return u.pathname + u.search + u.hash; };
  await prev(page).click();
  await prev(page).click();
  expect(at()).toBe('/todo/index.html?x=1#2026-11-07');
  await page.goBack();
  await expect(dateLine(page)).toHaveText('Hôm qua, Chủ Nhật, 08/11/2026');
  expect(at()).toBe('/todo/index.html?x=1#2026-11-08');
  await toToday(page).click();
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  expect(at()).toBe('/todo/index.html?x=1');
});

test('the date line is one live region that changes once per move', async ({ page }) => {
  await open(page, SEED);
  await page.evaluate(() => {
    window.liveLog = [];
    const el = document.getElementById('date-line');
    window.liveEl = el;
    new MutationObserver(() => window.liveLog.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true });
  });
  await prev(page).click();
  await expect(dateLine(page)).toHaveText('Hôm qua, Chủ Nhật, 08/11/2026');
  expect(await page.evaluate(() => window.liveEl === document.getElementById('date-line'))).toBe(true);
  expect(await page.evaluate(() => window.liveLog.filter((t) => t.includes('08/11')).length)).toBe(1);
  expect(await page.evaluate(() => new Set(window.liveLog).size)).toBeLessThanOrEqual(2);
});

test('Về hôm nay after a silent midnight moves to the new today and keeps focus', async ({ page }) => {
  await open(page, SEED);
  await toToday(page).focus();
  // No focus or visibility event: the page still believes 09/11 is today and the tab looks muted.
  await page.clock.setFixedTime(new Date('2026-11-10T00:00:01+07:00'));
  await page.keyboard.press('Enter');
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Ba, 10/11/2026');
  await expect(rows(page)).toHaveCount(0);
  await expect(toToday(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(toToday(page)).toBeFocused();
  expect(page.url()).toBe(new URL('./', page.url()).href);
});

// T5: date picker
const picker = (page) => page.getByLabel('Chọn ngày');

test('picking a date shows that day, writes the hash and keeps focus on the picker', async ({ page }) => {
  await open(page, [...SEED, task('o1', 'Nộp hồ sơ', false, '2026-10-01', 4)]);
  const start = await historyLength(page);
  await picker(page).fill('2026-10-01');
  await expect(dateLine(page)).toHaveText('Thứ Năm, 01/10/2026');
  await expect(labels(page)).toHaveText(['Nộp hồ sơ']);
  expect(hash(page)).toBe('#2026-10-01');
  expect(await historyLength(page)).toBe(start + 1);
  await expect(picker(page)).toBeFocused();
  await expect(picker(page)).toHaveValue('2026-10-01');
});

test('the picker follows the viewed day after every move, load, Back and midnight', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  await expect(picker(page)).toHaveValue('2026-11-08');
  await prev(page).click();
  await expect(picker(page)).toHaveValue('2026-11-07');
  await next(page).click();
  await next(page).click();
  await expect(picker(page)).toHaveValue(TODAY);
  await prev(page).click();
  await toToday(page).click();
  await expect(picker(page)).toHaveValue(TODAY);
  await page.goBack();
  await expect(picker(page)).toHaveValue('2026-11-08');
  await toToday(page).click();
  await passMidnight(page, 'focus', new Date('2026-11-10T00:00:01+07:00'));
  await expect(picker(page)).toHaveValue('2026-11-10');
});

test('an empty or out of range pick changes nothing and the picker shows the viewed day after blur', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  const start = await historyLength(page);
  for (const value of ['1999-12-31', '2100-01-01', '']) {
    await picker(page).fill(value);
    await expect(dateLine(page)).toHaveText('Hôm qua, Chủ Nhật, 08/11/2026');
    expect(hash(page)).toBe('#2026-11-08');
    expect(await historyLength(page)).toBe(start);
    await picker(page).blur();
    await expect(picker(page)).toHaveValue('2026-11-08');
  }
  await expect(page.locator('[role="alert"]:visible')).toHaveCount(0);
});

test('the first and last allowed days can be picked', async ({ page }) => {
  await open(page, SEED);
  await picker(page).fill('2000-01-01');
  await expect(dateLine(page)).toHaveText('Thứ Bảy, 01/01/2000');
  expect(hash(page)).toBe('#2000-01-01');
  await picker(page).fill('2099-12-31');
  await expect(dateLine(page)).toHaveText('Thứ Năm, 31/12/2099');
  expect(hash(page)).toBe('#2099-12-31');
});

test('picking the viewed day adds no history entry; picking today removes the hash', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  const start = await historyLength(page);
  await picker(page).fill('2026-11-08');
  await expect(dateLine(page)).toHaveText('Hôm qua, Chủ Nhật, 08/11/2026');
  expect(await historyLength(page)).toBe(start);
  await picker(page).fill(TODAY);
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  expect(hash(page)).toBe('');
  await expect(toToday(page)).toHaveAttribute('aria-disabled', 'true');
});

test('typing a date digit by digit ends on that day without jumping back', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  await picker(page).focus();
  // 10/10 reads the same in dd/mm and mm/dd order. The year passes through 0002, 0020 and 0202 on the way to 2026.
  for (const key of '10102026') await page.keyboard.press(key);
  await expect(picker(page)).toHaveValue('2026-10-10');
  await expect(dateLine(page)).toHaveText('Thứ Bảy, 10/10/2026');
  expect(hash(page)).toBe('#2026-10-10');
  await expect(picker(page)).toBeFocused();
  await picker(page).blur();
  await expect(picker(page)).toHaveValue('2026-10-10');
});

test('a partial year typed into the picker is kept while focused and reset on blur', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  await picker(page).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  // Now on the year segment, the third in every order Chromium uses for vi-VN (locale set in playwright.config.js).
  // Two digits make year 0020, outside the range.
  await page.keyboard.press('2');
  await page.keyboard.press('0');
  await expect(picker(page)).toHaveValue('0020-11-08');
  await expect(dateLine(page)).toHaveText('Hôm qua, Chủ Nhật, 08/11/2026');
  await picker(page).blur();
  await expect(picker(page)).toHaveValue('2026-11-08');
  expect(hash(page)).toBe('#2026-11-08');
});

test('keyboard: Tab reaches the picker and arrow keys change the day while focus stays', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  await next(page).focus();
  await page.keyboard.press('Tab');
  await expect(picker(page)).toBeFocused();
  // ArrowDown lowers the first segment by one. Chromium shows month first for the vi-VN locale set in
  // playwright.config.js (mm/dd/yyyy) and day first for dd/mm/yyyy locales; accept either.
  await page.keyboard.press('ArrowDown');
  const [key, line] = await picker(page).inputValue() === '2026-10-08'
    ? ['2026-10-08', 'Thứ Năm, 08/10/2026'] : ['2026-11-07', 'Thứ Bảy, 07/11/2026'];
  await expect(picker(page)).toHaveValue(key);
  await expect(dateLine(page)).toHaveText(line);
  expect(hash(page)).toBe(`#${key}`);
  await expect(picker(page)).toBeFocused();
});

// T6: work on any day and the midnight rules

test('adding on yesterday saves that date at the end of its list with the real creation time', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  await addTask(page, 'Việc bổ sung');
  await expect(labels(page)).toHaveText(['Dọn tủ quần áo', 'Gọi video cho bố mẹ', 'Nấu canh chua', 'Việc bổ sung']);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 2/4 việc');
  await expect(input(page)).toBeFocused();
  const added = (await stored(page)).at(-1);
  expect(added).toMatchObject({ text: 'Việc bổ sung', date: '2026-11-08', done: false, createdAt: NOW.getTime() });
  await page.reload();
  await expect(rows(page).last().locator('.task__label')).toHaveText('Việc bổ sung');
  await toToday(page).click();
  await expect(labels(page)).toHaveText(['Gửi báo cáo tuần']);
});

test('adding on an empty future day replaces the empty text and saves that date', async ({ page }) => {
  await open(page, SEED, '#2026-11-10');
  await input(page).fill('Chuẩn bị họp');
  await page.getByRole('button', { name: 'Thêm' }).click();
  await expect(page.locator('.empty')).toBeHidden();
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 0/1 việc');
  expect((await stored(page)).at(-1)).toMatchObject({ text: 'Chuẩn bị họp', date: '2026-11-10' });
});

test('tick, edit and delete on another day keep date and order and save', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  await tick(page, 1);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 3/3 việc');
  await page.reload();
  await expect(rows(page).nth(1).locator('.check input')).toBeChecked();
  await tick(page, 1);
  await expect(rows(page).nth(1).locator('.check input')).not.toBeChecked();

  await rows(page).nth(0).getByRole('button', { name: 'Sửa' }).click();
  await page.locator('.task__edit .input').fill('Dọn tủ giày');
  await page.locator('.task__edit .input').press('Enter');
  await expect(labels(page)).toHaveText(['Dọn tủ giày', 'Gọi video cho bố mẹ', 'Nấu canh chua']);

  await rows(page).nth(1).getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('button', { name: 'Giữ lại' }).click();
  await expect(labels(page)).toHaveCount(3);
  await rows(page).nth(1).getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('button', { name: 'Xóa việc' }).click();
  await expect(labels(page)).toHaveText(['Dọn tủ giày', 'Nấu canh chua']);

  await page.reload();
  await expect(labels(page)).toHaveText(['Dọn tủ giày', 'Nấu canh chua']);
  expect((await stored(page)).map((t) => [t.id, t.text, t.done, t.date])).toEqual([
    ['y1', 'Dọn tủ giày', true, '2026-11-08'],
    ['t1', 'Gửi báo cáo tuần', false, TODAY],
    ['y3', 'Nấu canh chua', true, '2026-11-08'],
  ]);
});

test('ticking the last task on a future day celebrates', async ({ page }) => {
  await open(page, [task('f', 'Một', false, '2026-11-12')], '#2026-11-12');
  await tick(page, 0);
  await expect(progress(page)).toHaveClass(/progress--complete/);
  await expect(progress(page)).toHaveClass(/progress--celebrate/);
});

test('after midnight, viewing today follows to the new today with a plain address', async ({ page }) => {
  await open(page, SEED);
  await passMidnight(page);
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Ba, 10/11/2026');
  await expect(rows(page)).toHaveCount(0);
  await expect(toToday(page)).toHaveAttribute('aria-disabled', 'true');
  expect(hash(page)).toBe('');
  await expect(input(page)).toBeFocused();
});

test('after midnight, viewing tomorrow stays and becomes today with a muted Về hôm nay and a plain address', async ({ page }) => {
  await open(page, [...SEED, task('m1', 'Đi chợ sớm', false, '2026-11-10')], '#2026-11-10');
  const start = await historyLength(page);
  await passMidnight(page);
  await expectWording(page, { title: 'Việc cần làm hôm nay', line: 'Hôm nay, Thứ Ba, 10/11/2026', ask: 'Bạn cần làm gì hôm nay?' });
  await expect(labels(page)).toHaveText(['Đi chợ sớm']);
  await expect(toToday(page)).toHaveAttribute('aria-disabled', 'true');
  expect(page.url()).toBe(new URL('./', page.url()).href);
  expect(await historyLength(page)).toBe(start);
});

test('after midnight, an older day stays with its open edit and plain wording', async ({ page }) => {
  await open(page, [task('o1', 'Trả sách thư viện', false, '2026-11-05')], '#2026-11-05');
  await rows(page).first().getByRole('button', { name: 'Sửa' }).click();
  const field = page.locator('.task__edit .input');
  await field.fill('Trả sách và mượn thêm');
  await passMidnight(page);
  await expect(dateLine(page)).toHaveText('Thứ Năm, 05/11/2026');
  await expect(field).toHaveValue('Trả sách và mượn thêm');
  await expect(field).toBeFocused();
  expect(hash(page)).toBe('#2026-11-05');
  await field.press('Enter');
  await expect(labels(page)).toHaveText(['Trả sách và mượn thêm']);
  expect((await stored(page))[0]).toMatchObject({ text: 'Trả sách và mượn thêm', date: '2026-11-05' });
});

for (const [key, before, after] of [
  ['2026-11-08', 'Hôm qua, Chủ Nhật, 08/11/2026', 'Chủ Nhật, 08/11/2026'],
  ['2026-11-11', 'Thứ Tư, 11/11/2026', 'Ngày mai, Thứ Tư, 11/11/2026'],
]) {
  test(`after midnight, the wording of ${key} follows the new today`, async ({ page }) => {
    await open(page, SEED, `#${key}`);
    await expect(dateLine(page)).toHaveText(before);
    await passMidnight(page, 'focus');
    await expect(dateLine(page)).toHaveText(after);
    await expect(heading(page)).toHaveText('Việc cần làm');
    await expect(toToday(page)).not.toHaveAttribute('aria-disabled');
    expect(hash(page)).toBe(`#${key}`);
  });
}

test('an add right after a silent midnight on another day saves to the viewed day', async ({ page }) => {
  await open(page, SEED, '#2026-11-05');
  await page.clock.setFixedTime(AFTER_MIDNIGHT);
  await addTask(page, 'Việc bỏ sót');
  await expect(dateLine(page)).toHaveText('Thứ Năm, 05/11/2026');
  await expect(labels(page)).toHaveText(['Việc bỏ sót']);
  expect((await stored(page)).at(-1)).toMatchObject({ text: 'Việc bỏ sót', date: '2026-11-05', createdAt: AFTER_MIDNIGHT.getTime() });
  expect(hash(page)).toBe('#2026-11-05');
});

// T6 (QA additions): invalid text, stamp transitions, per day counts, storage slip, old data, midnight celebration.
const addError = (page) => page.locator('.add-form .field-error');
const slipOnPage = (page) => page.getByRole('alert').filter({ hasText: 'Không thể lưu dữ liệu trên trình duyệt này.' });

test('on a past day an empty, blank or 201 character add shows the usual errors and stores nothing', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  const before = await storedRaw(page);
  for (const [text, msg] of [['', 'Vui lòng nhập nội dung công việc.'], ['   ', 'Vui lòng nhập nội dung công việc.'], ['a'.repeat(201), 'Nội dung tối đa 200 ký tự.']]) {
    await addTask(page, text);
    await expect(addError(page)).toHaveText(msg);
  }
  await expect(rows(page)).toHaveCount(3);
  expect(await storedRaw(page)).toBe(before);
});

test('on a past day an invalid edit keeps edit mode and the stored task', async ({ page }) => {
  await open(page, SEED, '#2026-11-08');
  const before = await storedRaw(page);
  await rows(page).first().getByRole('button', { name: 'Sửa' }).click();
  const field = page.locator('.task__edit .input');
  await field.fill('a'.repeat(201));
  await field.press('Enter');
  await expect(page.locator('.task__edit .field-error')).toHaveText('Nội dung tối đa 200 ký tự.');
  await expect(field).toBeFocused();
  expect(await storedRaw(page)).toBe(before);
});

test('on another day the stamp follows tick, untick, add and delete; reload shows it without the celebration', async ({ page }) => {
  await open(page, [task('a', 'Một', false, '2026-11-08')], '#2026-11-08');
  await tick(page, 0);
  await expect(progress(page)).toHaveClass(/progress--celebrate/);
  await page.reload();
  await expect(progress(page)).toHaveClass(/progress--complete/);
  await expect(progress(page)).not.toHaveClass(/progress--celebrate/);
  await tick(page, 0);
  await expect(progress(page)).not.toHaveClass(/progress--complete/);
  await tick(page, 0);
  await expect(progress(page)).toHaveClass(/progress--complete/);
  await addTask(page, 'Hai');
  await expect(progress(page)).not.toHaveClass(/progress--complete/);
  await rows(page).nth(1).getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('button', { name: 'Xóa việc' }).click();
  await expect(progress(page)).toHaveClass(/progress--complete/);
  await expect(progress(page)).not.toHaveClass(/progress--celebrate/);
});

test('each day lists and counts only its own tasks after adding on three days', async ({ page }) => {
  await open(page, [task('a', 'Cũ', false, '2026-11-08'), task('b', 'Nay', true), task('c', 'Mai', false, '2026-11-10')]);
  const days = [['2026-11-08', 'Cũ'], ['2026-11-09', 'Nay'], ['2026-11-10', 'Mai']];
  for (const [key, old] of days) {
    await page.goto(`./#${key}`);
    await addTask(page, `Thêm ${key}`);
    await expect(labels(page)).toHaveText([old, `Thêm ${key}`]);
  }
  await page.goto('./#2026-11-08');
  await expect(labels(page)).toHaveText(['Cũ', 'Thêm 2026-11-08']);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 0/2 việc');
  expect((await stored(page)).map((t) => t.date)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-08', '2026-11-09', '2026-11-10']);
});

test('storage that refuses writes on another day shows the slip, keeps memory and the old stored value', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('locked')) { sessionStorage.setItem('locked', '1'); return; }
    Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  });
  await open(page, SEED, '#2026-11-08');
  await page.reload();
  const before = await storedRaw(page);
  await tick(page, 0);
  await expect(slipOnPage(page)).toBeVisible();
  await addTask(page, 'Việc mới');
  await expect(labels(page)).toHaveText(['Dọn tủ quần áo', 'Gọi video cho bố mẹ', 'Nấu canh chua', 'Việc mới']);
  await expect(rows(page).nth(0).locator('.check input')).not.toBeChecked();
  expect(await storedRaw(page)).toBe(before);
});

test('data saved by the daily task log in its exact shape shows on its days without conversion', async ({ page }) => {
  const old = [
    { id: 'o1', text: 'Việc cũ', done: true, createdAt: 1700000000000, date: '2023-11-14' },
    { id: 'o2', text: 'Việc năm nay', done: false, createdAt: 1790000000000, date: '2026-10-01' },
  ];
  await open(page, old, '#2026-10-01');
  await expect(labels(page)).toHaveText(['Việc năm nay']);
  await page.goto('./#2023-11-14');
  await expect(labels(page)).toHaveText(['Việc cũ']);
  await expect(rows(page).first().locator('.check input')).toBeChecked();
  expect(await stored(page)).toEqual(old);
});

test('after midnight on an all done day nothing celebrates again and no page turn plays', async ({ page }) => {
  await watchTurns(page);
  await open(page, [task('a', 'Một', true, '2026-11-08')], '#2026-11-08');
  await passMidnight(page);
  await expect(dateLine(page)).toHaveText('Chủ Nhật, 08/11/2026');
  await expect(progress(page)).toHaveClass(/progress--complete/);
  await expect(progress(page)).not.toHaveClass(/progress--celebrate/);
  await expect(page.locator('.turn--back, .turn--forward, .washi--restick')).toHaveCount(0);
  expect(await turnsSeen(page)).toEqual([]);
});

// T7: page turn motion, keyboard order, size and speed
// Records every turn or restick class ever set, so a 240 ms animation cannot slip between two checks.
async function watchTurns(page) {
  await page.addInitScript(() => {
    window.__turns = [];
    new MutationObserver((list) => {
      for (const m of list) for (const c of m.target.classList) if (/^turn--|^washi--restick$/.test(c)) window.__turns.push(c);
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}
const turnsSeen = (page) => page.evaluate(() => [...new Set(window.__turns)]);
const sheetBody = (page) => page.locator('.sheet__body');
// Clicks inside the page and reads the classes in the same task, before any animation can end.
const clickAndRead = (page, id) => page.evaluate((id) => {
  document.getElementById(id).click();
  return [document.querySelector('.sheet__body').className, document.getElementById('date-line').className];
}, id);

test('a move turns the page by direction and the classes go after the animation', async ({ page }) => {
  await open(page, SEED);
  let [body, date] = await clickAndRead(page, 'next-day');
  expect(body.split(' ')).toContain('turn--forward');
  expect(body).not.toContain('turn--back');
  expect(date.split(' ')).toContain('washi--restick');
  await expect(sheetBody(page)).not.toHaveClass(/turn--/);
  await expect(dateLine(page)).not.toHaveClass(/washi--restick/);

  [body, date] = await clickAndRead(page, 'prev-day');
  expect(body.split(' ')).toContain('turn--back');
  expect(body).not.toContain('turn--forward');
  expect(date.split(' ')).toContain('washi--restick');
  await expect(sheetBody(page)).not.toHaveClass(/turn--/);
  await expect(dateLine(page)).not.toHaveClass(/washi--restick/);

  // Browser Back is a move too: back from today to tomorrow turns forward.
  await page.goBack();
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  await expect(sheetBody(page)).not.toHaveClass(/turn--/);
});

test('loading a day plays no page turn', async ({ page }) => {
  await watchTurns(page);
  await open(page, SEED, '#2026-11-08');
  await expect(dateLine(page)).toHaveText('Hôm qua, Chủ Nhật, 08/11/2026');
  await page.reload();
  await expect(dateLine(page)).toHaveText('Hôm qua, Chủ Nhật, 08/11/2026');
  expect(await turnsSeen(page)).toEqual([]);
});

test('with reduced motion a move changes the day and plays no page turn', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await watchTurns(page);
  await open(page, SEED);
  await page.getByRole('button', { name: 'Xem ngày trước' }).click();
  await expect(dateLine(page)).toHaveText('Hôm qua, Chủ Nhật, 08/11/2026');
  await expect(rows(page)).toHaveCount(3);
  await page.getByRole('button', { name: 'Xem ngày sau' }).click();
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  expect(await turnsSeen(page)).toEqual([]);
});

test('Tab from the page start reaches previous, next, Chọn ngày, Về hôm nay, then the add field', async ({ page }) => {
  await open(page, SEED);
  // Clicking the title moves the focus starting point to the top, before every control.
  await heading(page).click();
  const order = [];
  for (let i = 0; i < 12 && order.at(-1) !== 'new-task'; i++) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => document.activeElement.id);
    // The picker's date segments are separate Tab stops in Chromium; count the control once.
    if (order.at(-1) !== id) order.push(id);
  }
  expect(order).toEqual(['prev-day', 'next-day', 'day-picker', 'to-today', 'new-task']);
});

for (const hash of ['', '#2026-11-08']) {
  test(`each nav control is at least 44 by 44 px on ${hash || 'today'}`, async ({ page }) => {
    await open(page, SEED, hash);
    // The stamp is the picker's hit area: its calendar indicator covers the whole stamp.
    for (const sel of ['#prev-day', '#next-day', '.date-stamp', '#to-today']) {
      const box = await page.locator(sel).boundingBox();
      expect(box.width, sel).toBeGreaterThanOrEqual(44);
      expect(box.height, sel).toBeGreaterThanOrEqual(44);
    }
  });
}

test('no horizontal scroll at 360 px on today and on a past day, with a long unbroken task', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  const long = 'Đ'.repeat(200);
  await open(page, [task('a', long), task('b', long, false, '2026-11-08')]);
  for (const hash of ['', '#2026-11-08']) {
    if (hash) await page.getByRole('button', { name: 'Xem ngày trước' }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(sheetBody(page)).not.toHaveClass(/turn--/);
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll, hash || 'today').toBeLessThanOrEqual(client);
  }
});

for (const count of [0, 1, 200]) {
  test(`moving to a day with ${count} tasks renders in under 100 ms`, async ({ page }) => {
    const many = Array.from({ length: count }, (_, i) => task(`p${i}`, `Việc số ${i + 1} của hôm qua`, i % 3 === 0, '2026-11-08', i));
    await open(page, many);
    // BUG-002: let the page settle first. An idle page is the slow case (the CPU clocks down), and right after load it hides it.
    await page.waitForTimeout(500);
    // Click, then force style and layout so the time covers the rows actually laid out.
    const ms = await page.evaluate(() => {
      const t = performance.now();
      document.getElementById('prev-day').click();
      void document.body.offsetHeight;
      return performance.now() - t;
    });
    await expect(rows(page)).toHaveCount(count);
    expect(ms).toBeLessThan(100);
  });
}

// BUG-001: Về hôm nay must not show its filled text on bare paper.
test('Về hôm nay is filled from the first frame after load on another day', async ({ page }) => {
  await page.addInitScript(() => {
    window.__tab = [];
    const sample = () => {
      const el = document.getElementById('to-today');
      if (el) {
        const cs = getComputedStyle(el);
        window.__tab.push({ muted: el.getAttribute('aria-disabled') === 'true', bg: cs.backgroundColor, color: cs.color });
      }
      if (window.__tab.length < 30) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await open(page, SEED, '#2026-11-08');
  await page.waitForFunction(() => window.__tab.length >= 30);
  const final = await toToday(page).evaluate((el) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color]);
  const filled = await page.evaluate(() => window.__tab.filter((s) => !s.muted));
  expect(filled.length).toBeGreaterThan(0);
  for (const s of filled) expect([s.bg, s.color]).toEqual(final);
});

test('on a move, the label colour changes together with the Về hôm nay fill', async ({ page }) => {
  await open(page, SEED);
  const props = await page.evaluate(() => {
    const el = document.getElementById('to-today');
    document.getElementById('prev-day').click();
    getComputedStyle(el).color; // start the transitions now
    return el.getAnimations().map((a) => a.transitionProperty);
  });
  expect(props).toEqual(expect.arrayContaining(['background-color', 'color']));
});

// BUG-002 fix regression: rows use content-visibility: auto. A 200 row day must keep behaving like a short one.
const BIG = Array.from({ length: 200 }, (_, i) => task(`b${i}`, i === 199 ? `Việc cuối ${'rất dài '.repeat(25)}hết` : `Việc số ${i + 1}`, i < 199, TODAY, i));
const inView = (loc) => loc.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });

test('200 rows: Tab from the add field into rows scrolled away brings the first row back into view', async ({ page }) => {
  await open(page, BIG.map((t) => ({ ...t, done: false })));
  await input(page).focus();
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  for (let i = 0; i < 4; i++) await page.keyboard.press('Tab'); // Nhóm, Thêm, Quản lý nhóm, first row
  const focused = page.locator(':focus');
  await expect(rows(page).nth(0)).toContainText('Việc số 1');
  await expect(focused).toBeVisible();
  expect(await inView(focused)).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBeLessThan(400);
});

test('200 rows: browser find reaches text of a row that is off screen', async ({ page }) => {
  await open(page, BIG);
  expect(await page.evaluate(() => window.find('Việc số 150'))).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  expect(await page.evaluate(() => getSelection().toString())).toBe('Việc số 150');
});

test('200 rows: a long wrapped last row ends inside the page with no sideways scroll, and can be ticked, edited and deleted', async ({ page }) => {
  await open(page, BIG);
  const last = rows(page).nth(199);
  await last.scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(scroll).toBeLessThanOrEqual(client);
  // Sized as one line until it is on screen (known side effect of content-visibility), then it wraps at its real height.
  await expect.poll(async () => (await last.boundingBox()).height).toBeGreaterThan(50);
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  expect(await inView(last)).toBe(true);
  await last.locator('.check__box').click();
  await expect(progress(page)).toHaveClass(/progress--celebrate/);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 200/200 việc');
  await last.getByRole('button', { name: 'Sửa' }).click();
  await page.getByRole('textbox', { name: 'Sửa' }).fill('Đã sửa');
  await last.getByRole('button', { name: 'Lưu' }).click();
  await expect(last.locator('.task__label')).toHaveText('Đã sửa');
  await last.getByRole('button', { name: 'Xóa' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Xóa việc' }).click();
  await expect(rows(page)).toHaveCount(199);
});

test('200 rows: a hovered or focused row renders in full so the Sửa and Xóa tooltips are not clipped', async ({ page, isMobile }) => {
  await open(page, BIG);
  const row = rows(page).nth(3);
  const cv = () => row.evaluate((el) => getComputedStyle(el).contentVisibility);
  expect(await rows(page).nth(150).evaluate((el) => getComputedStyle(el).contentVisibility)).toBe('auto');
  await row.getByRole('button', { name: 'Sửa' }).focus();
  expect(await cv()).toBe('visible');
  if (!isMobile) {
    await row.getByRole('button', { name: 'Xóa' }).hover();
    expect(await cv()).toBe('visible');
    await expect.poll(() => row.getByRole('button', { name: 'Xóa' }).evaluate((el) => getComputedStyle(el, '::after').opacity)).toBe('1');
  }
});
