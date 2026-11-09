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
