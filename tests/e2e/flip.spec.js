import { test, expect } from '@playwright/test';
import { TODAY, task, group, open, rows, labels, hash, addTask, passMidnight, watchFlips, flipsSeen, resticksSeen } from './helpers.js';

// page-flip end to end tests. Today is Thứ Hai 09/11/2026.
const SEED = [
  task('y1', 'Dọn tủ quần áo', true, '2026-11-08', 1),
  task('t1', 'Gửi báo cáo tuần', false, TODAY, 2),
  task('t2', 'Đi chợ mua rau', true, TODAY, 3),
  task('t3', 'Tập yoga 30 phút', false, TODAY, 4),
  task('m1', 'Đặt bánh sinh nhật', false, '2026-11-10', 5),
  task('m2', 'Mang áo khoác đi giặt', false, '2026-11-10', 6),
];
const dateLine = (page) => page.locator('#date-line');
const stages = (page) => page.locator('.flip-stage');
const next = (page) => page.getByRole('button', { name: 'Xem ngày sau' });
const prev = (page) => page.getByRole('button', { name: 'Xem ngày trước' });

// Clicks inside the page and reads everything in the same task as the click, before any timer or frame can run.
const clickAndRead = (page, id) => page.evaluate((id) => {
  const before = history.length;
  document.getElementById(id).click();
  const stage = document.querySelector('.flip-stage');
  return {
    heading: document.getElementById('page-title').textContent,
    date: document.getElementById('date-line').textContent,
    rows: [...document.querySelectorAll('#day-list .task__label')].map((l) => l.textContent),
    summary: document.getElementById('summary-count').textContent,
    hash: location.hash,
    picker: document.getElementById('day-picker').value,
    historyAdded: history.length - before,
    focus: document.activeElement.id,
    stage: !!stage,
    stageStyle: stage && [getComputedStyle(stage).pointerEvents, getComputedStyle(stage).userSelect],
    tabbable: stage ? [...stage.querySelectorAll('a, button, input, select, textarea, [tabindex]')].filter((el) => el.tabIndex >= 0 && !el.closest('[inert]')).length : 0,
  };
}, id);

test('the next arrow turns one leaf forward carrying the old day, then the stage goes within 550 ms', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  const now = await clickAndRead(page, 'next-day');
  expect(now.stage).toBe(true);
  expect(now.stageStyle).toEqual(['none', 'none']);
  expect(now.tabbable).toBe(0);
  await expect(stages(page)).toHaveCount(0);
  await expect(page.locator('.leaf, .leaf-cast')).toHaveCount(0);
  const [f] = await flipsSeen(page);
  expect(await flipsSeen(page)).toHaveLength(1);
  expect(f).toMatchObject({ back: false, leaves: 1, blank: 0, ariaHidden: 'true', inert: true, ids: 0 });
  expect(f.text).toContain('Gửi báo cáo tuần');
  expect(f.text).toContain('Tập yoga 30 phút');
  expect(f.text).not.toContain('Đặt bánh sinh nhật');
  expect(f.removed - f.added).toBeLessThanOrEqual(450 + 100);
  expect(f.removed - f.added).toBeGreaterThanOrEqual(400);
});

test('the previous arrow turns one leaf back carrying the new day', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await clickAndRead(page, 'prev-day');
  await expect(stages(page)).toHaveCount(0);
  const flips = await flipsSeen(page);
  expect(flips).toHaveLength(1);
  expect(flips[0]).toMatchObject({ back: true, leaves: 1, blank: 0, ariaHidden: 'true', inert: true, ids: 0 });
  expect(flips[0].text).toContain('Dọn tủ quần áo');
  expect(flips[0].text).not.toContain('Gửi báo cáo tuần');
  expect(flips[0].removed - flips[0].added).toBeLessThanOrEqual(550);
});

test('the day, address, picker and focus change in the same task as the click; the leaf copy is never matched', async ({ page }) => {
  await open(page, SEED);
  await next(page).focus();
  const now = await clickAndRead(page, 'next-day');
  expect(now).toMatchObject({
    heading: 'Việc cần làm', date: 'Ngày mai, Thứ Ba, 10/11/2026', rows: ['Đặt bánh sinh nhật', 'Mang áo khoác đi giặt'],
    summary: '0/2', hash: '#2026-11-10', picker: '2026-11-10', historyAdded: 1, focus: 'next-day', stage: true,
  });
  await expect(labels(page)).toHaveText(['Đặt bánh sinh nhật', 'Mang áo khoác đi giặt']);
});

test('Enter on the next arrow keeps focus on it with no focus event', async ({ page }) => {
  await open(page, SEED);
  await next(page).focus();
  await page.evaluate(() => { window.__focusEvents = 0; addEventListener('focusin', () => window.__focusEvents++, true); });
  await page.keyboard.press('Enter');
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  await expect(next(page)).toBeFocused();
  expect(await page.evaluate(() => window.__focusEvents)).toBe(0);
});

test('a move with focus in a removed row hands focus to the add field', async ({ page }) => {
  await open(page, SEED);
  await rows(page).first().getByRole('button', { name: 'Sửa' }).focus();
  await page.evaluate(() => document.getElementById('next-day').click());
  await expect(page.locator('#new-task')).toBeFocused();
  await expect(stages(page)).toHaveCount(1);
});

test('the date tape is pressed once per move and loses the class after its animation', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await next(page).click();
  await expect(dateLine(page)).not.toHaveClass(/washi--restick/);
  const log = await resticksSeen(page);
  expect(log.map((r) => r.on)).toEqual([true, false]);
  expect(log[1].t - log[0].t).toBeGreaterThan(200);
});

test('no stage on load, reload or a bookmarked day', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await expect(labels(page)).toHaveCount(3);
  await page.reload();
  await expect(labels(page)).toHaveCount(3);
  await page.goto('about:blank'); // a real load, not a hash change on the open page
  await page.goto('./#2026-11-08');
  await expect(labels(page)).toHaveText(['Dọn tủ quần áo']);
  await page.waitForTimeout(100);
  expect(await flipsSeen(page)).toEqual([]);
  expect(await resticksSeen(page)).toEqual([]);
});

test('no stage on a midnight refresh, an invalid hash or a hash equal to today', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await passMidnight(page);
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Ba, 10/11/2026');
  for (const h of ['#2026-13-45', '#2026-11-10']) {
    await page.goto('about:blank');
    await page.goto(`./${h}`);
    await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Ba, 10/11/2026');
    expect(hash(page)).toBe('');
  }
  await page.waitForTimeout(100);
  expect(await flipsSeen(page)).toEqual([]);
});

test('choosing the viewed day in the picker or the address builds no stage and no history entry', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED, '#2026-11-08');
  const before = await page.evaluate(() => history.length);
  await page.evaluate(() => { const p = document.getElementById('day-picker'); p.value = '2026-11-08'; p.dispatchEvent(new Event('change')); });
  await page.evaluate(() => { location.hash = '#2026-11-08'; });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => history.length)).toBe(before);
  expect(await flipsSeen(page)).toEqual([]);
});

test('no page turn class is ever set by a move', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await next(page).click();
  await prev(page).click();
  await page.goBack();
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  expect(await page.evaluate(() => window.__turnClass)).toBe(false);
  await expect(page.locator('[class*="turn--"]')).toHaveCount(0);
});

// Adding, deleting, changing the filter or a storage event during a flip ends it at once (R37, decisions.md 2026-11-12).
// Each action runs in the same task as the count, so the timer cannot be what removed the stage.
const actAndCount = (page, act) => page.evaluate((act) => {
  if (act === 'add') { document.getElementById('new-task').value = 'Mua quà'; document.getElementById('add-form').requestSubmit(); }
  if (act === 'storage') dispatchEvent(new StorageEvent('storage', { key: null }));
  if (act === 'filter') document.getElementById('group-filter').dispatchEvent(new Event('change'));
  if (act === 'delete') document.querySelector('#day-list .task [data-action="remove"]').click();
  return document.querySelectorAll('.flip-stage, .leaf, .leaf-cast').length;
}, act);

for (const act of ['add', 'storage', 'filter', 'delete']) {
  test(`${act} during a flip removes the stage at once and the page stays usable`, async ({ page }) => {
    await open(page, SEED, '', act === 'filter' ? { groups: [group('g1', 'Công ty')] } : {});
    await next(page).click();
    await expect(stages(page)).toHaveCount(1);
    const left = await actAndCount(page, act);
    // Xóa opens the delete note; the dialog's toggle event, queued one task later, ends the flip (R37).
    if (act === 'delete') expect(await page.evaluate(() => new Promise((r) => setTimeout(() => r(document.querySelectorAll('.flip-stage, .leaf, .leaf-cast').length))))).toBe(0);
    else expect(left).toBe(0);
    if (act === 'add') {
      await expect(labels(page)).toHaveText(['Đặt bánh sinh nhật', 'Mang áo khoác đi giặt', 'Mua quà']);
      await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
    } else if (act === 'delete') {
      await expect(page.getByRole('alertdialog')).toBeVisible();
    } else {
      await addTask(page, 'Mua quà');
      await expect(labels(page)).toHaveText(['Đặt bánh sinh nhật', 'Mang áo khoác đi giặt', 'Mua quà']);
    }
    expect(await page.locator('.sheet').getAttribute('class')).toBe('sheet');
  });
}
