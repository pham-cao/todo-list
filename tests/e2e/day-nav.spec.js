import { test, expect } from '@playwright/test';

const KEY = 'daily-todo:tasks:v1';
const TODAY = '2026-11-09';
const NOW = new Date('2026-11-09T09:00:00+07:00');

const task = (id, text, done = false, date = TODAY, createdAt = NOW.getTime()) => ({ id, text, done, createdAt, date });

async function open(page, tasks, hash = '') {
  await page.clock.setFixedTime(NOW);
  if (tasks) {
    await page.addInitScript(([key, value]) => {
      if (sessionStorage.getItem('seeded')) return;
      localStorage.setItem(key, value);
      sessionStorage.setItem('seeded', '1');
    }, [KEY, JSON.stringify(tasks)]);
  }
  await page.goto(`./${hash}`);
}

const rows = (page) => page.locator('.task-list > .task');
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
  await expect(rows(page).locator('.task__label')).toHaveText(['Dọn tủ quần áo', 'Gọi video cho bố mẹ', 'Nấu canh chua']);
  await expect(page.getByText('Gửi báo cáo tuần')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 2/3 việc');
  await expect(page.locator('.progress')).toHaveCSS('--p', '67');
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
  await expect(page.locator('.progress')).toBeHidden();
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
  await expect(page.locator('.progress')).toHaveClass(/progress--complete/);
  await expect(page.locator('.progress')).not.toHaveClass(/progress--celebrate/);
  await page.reload();
  await expect(page.locator('.progress')).toHaveClass(/progress--complete/);
  await expect(page.locator('.progress')).not.toHaveClass(/progress--celebrate/);
});

test('ticking the last task on the viewed day still celebrates', async ({ page }) => {
  await open(page, [task('a', 'Một', true, '2026-11-08'), task('b', 'Hai', false, '2026-11-08')], '#2026-11-08');
  await rows(page).nth(1).locator('.check__box').click();
  await expect(page.locator('.progress')).toHaveClass(/progress--celebrate/);
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
    await expect(rows(page).locator('.task__label')).toHaveText(['Gửi báo cáo tuần']);
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
  expect(new URL(page.url()).hash).toBe('');
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
  expect(new URL(page.url()).hash).toBe('');
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
const hash = (page) => new URL(page.url()).hash;
const historyLength = (page) => page.evaluate(() => history.length);
const storedTasks = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);

test('previous and next move one day, write the address and never reload', async ({ page }) => {
  await open(page, [...SEED, task('m1', 'Đi chợ sớm', false, '2026-11-10')]);
  await page.evaluate(() => { window.marker = 1; });
  const start = await historyLength(page);

  await prev(page).click();
  await expectWording(page, { title: 'Việc cần làm', line: 'Hôm qua, Chủ Nhật, 08/11/2026', ask: 'Bạn cần làm gì ngày này?' });
  await expect(rows(page).locator('.task__label')).toHaveText(['Dọn tủ quần áo', 'Gọi video cho bố mẹ', 'Nấu canh chua']);
  expect(hash(page)).toBe('#2026-11-08');
  expect(await historyLength(page)).toBe(start + 1);
  await expect(prev(page)).toBeFocused();

  await next(page).click();
  await next(page).click();
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  await expect(rows(page).locator('.task__label')).toHaveText(['Đi chợ sớm']);
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
  await expect(rows(page).locator('.task__label')).toHaveText(['Gửi báo cáo tuần']);
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
  await expect(rows(page).locator('.task__label')).toHaveText(['Gửi báo cáo tuần']);
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
  expect(JSON.parse(await storedTasks(page)).find((t) => t.id === 'y1').text).toBe('Dọn tủ quần áo');
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
  expect(JSON.parse(await storedTasks(page))).toHaveLength(4);
});

test('a move clears the add error and keeps the typed add text', async ({ page }) => {
  await open(page, SEED);
  await input(page).press('Enter');
  await expect(page.locator('#new-task-error')).toBeVisible();
  await input(page).fill('Mua sữa');
  await prev(page).click();
  await expect(input(page)).toHaveValue('Mua sữa');

  await input(page).fill('');
  await input(page).press('Enter');
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
  const before = await storedTasks(page);
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
  expect(await storedTasks(page)).toBe(before);
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
