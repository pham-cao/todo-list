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

// T3: the riffle and every entry point (R2 to R6). A picker move runs in one task with a read of the stage it built.
const pickAndRead = (page, key) => page.evaluate((key) => {
  const p = document.getElementById('day-picker');
  p.value = key;
  p.dispatchEvent(new Event('change'));
  const stage = document.querySelector('.flip-stage');
  if (!stage) return null;
  const i = (el) => Number(el.style.getPropertyValue('--i'));
  return {
    back: stage.classList.contains('flip-stage--back'),
    leaves: [...stage.querySelectorAll('.leaf')].map((l) => ({
      i: i(l), blank: l.classList.contains('leaf--blank'), content: !!l.querySelector('.leaf__content'),
    })),
    casts: [...stage.querySelectorAll('.leaf-cast')].map(i),
    date: document.getElementById('date-line').textContent,
  };
}, key);
// The lifetime the timer allows: 450 ms for one leaf and 125 ms more for each riffle leaf, plus 100 ms of slack.
const lifetime = (n) => 450 + (n - 1) * 125 + 100;

for (const [key, n] of [['2026-11-10', 1], ['2026-11-11', 2], ['2026-11-12', 3], ['2026-11-18', 3], ['2027-12-14', 3]]) {
  test(`a picker move to ${key} turns ${n} leaf or leaves forward, the top one with the old day, then goes in time`, async ({ page }) => {
    await watchFlips(page);
    await open(page, SEED);
    const s = await pickAndRead(page, key);
    expect(s.back).toBe(false);
    // Forward: --i is n - 1 - k, so the top leaf with the old page (last in the stage) starts first.
    expect(s.leaves).toEqual(Array.from({ length: n }, (_, k) => (
      { i: n - 1 - k, blank: k < n - 1, content: k === n - 1 })));
    expect(s.casts).toEqual(s.leaves.map((l) => l.i));
    await expect(stages(page)).toHaveCount(0);
    const flips = await flipsSeen(page);
    expect(flips).toHaveLength(1);
    expect(flips[0]).toMatchObject({ back: false, leaves: n, blank: n - 1, ids: 0 });
    expect(flips[0].text).toContain('Gửi báo cáo tuần');
    expect(flips[0].removed - flips[0].added).toBeLessThanOrEqual(lifetime(n));
    expect(flips[0].removed - flips[0].added).toBeGreaterThanOrEqual(lifetime(n) - 150);
  });
}

for (const [key, n] of [['2026-11-08', 1], ['2026-11-07', 2], ['2026-11-06', 3], ['2026-10-31', 3]]) {
  test(`a picker move back to ${key} turns ${n} leaf or leaves back, the last one landing with the new day`, async ({ page }) => {
    await watchFlips(page);
    await open(page, SEED);
    const s = await pickAndRead(page, key);
    expect(s.back).toBe(true);
    // Back: --i is k, so the blank leaves land first and the copy of the new page lands last, on top.
    expect(s.leaves).toEqual(Array.from({ length: n }, (_, k) => ({ i: k, blank: k < n - 1, content: k === n - 1 })));
    expect(s.casts).toEqual(s.leaves.map((l) => l.i));
    await expect(stages(page)).toHaveCount(0);
    const [f] = await flipsSeen(page);
    expect(f).toMatchObject({ back: true, leaves: n, blank: n - 1 });
    expect(f.text).not.toContain('Gửi báo cáo tuần');
    if (key === '2026-11-08') expect(f.text).toContain('Dọn tủ quần áo');
    expect(f.removed - f.added).toBeLessThanOrEqual(lifetime(n));
  });
}

// Về hôm nay: direction and leaf count by the distance from the viewed day to today (R1, R2, R5).
for (const [from, back, n] of [['2026-11-08', false, 1], ['2026-11-03', false, 3], ['2026-11-10', true, 1], ['2026-11-15', true, 3]]) {
  test(`Về hôm nay from ${from} flips ${back ? 'back' : 'forward'} with ${n} leaf or leaves`, async ({ page }) => {
    await watchFlips(page);
    await open(page, SEED, `#${from}`);
    await page.getByRole('button', { name: 'Về hôm nay' }).click();
    await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
    await expect(stages(page)).toHaveCount(0);
    const flips = await flipsSeen(page);
    expect(flips).toHaveLength(1);
    expect(flips[0]).toMatchObject({ back, leaves: n, blank: n - 1 });
    expect(flips[0].removed - flips[0].added).toBeLessThanOrEqual(lifetime(n));
  });
}

// Waits for every flip seen so far to end, then returns them.
const settled = async (page, count) => {
  await expect.poll(async () => (await flipsSeen(page)).filter((f) => f.removed).length).toBe(count);
  return (await flipsSeen(page)).map(({ back, leaves, blank }) => ({ back, leaves, blank }));
};
const flip = (back, leaves) => ({ back, leaves, blank: leaves - 1 });

test('browser Back and Forward flip by the two dates: Back to an earlier day flips back, Forward flips forward', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await next(page).click();
  await settled(page, 1);
  await page.goBack();
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  await page.goForward();
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  expect(await settled(page, 3)).toEqual([flip(false, 1), flip(true, 1), flip(false, 1)]);
});

test('browser Back follows the dates, not the history direction (Back from today to tomorrow flips forward)', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED, '#2026-11-10');
  await page.getByRole('button', { name: 'Về hôm nay' }).click();
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  await settled(page, 1);
  await page.goBack();
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  expect(await settled(page, 2)).toEqual([flip(true, 1), flip(false, 1)]);
});

test('picker jumps then Back twice: each Back flips by the distance and order of the two dates', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await pickAndRead(page, '2026-11-12'); // A, 3 days on
  await settled(page, 1);
  await pickAndRead(page, '2026-11-07'); // B, 5 days before A
  await settled(page, 2);
  await page.goBack(); // B to A: later, so forward
  await expect(page.locator('#day-picker')).toHaveValue('2026-11-12');
  await settled(page, 3);
  await page.goBack(); // A to today: earlier, so back
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  expect(await settled(page, 4)).toEqual([flip(false, 3), flip(true, 3), flip(false, 3), flip(true, 3)]);
});

test('an edited hash flips like any move: 2 days then 8 days away', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await page.evaluate(() => { location.hash = '#2026-11-11'; });
  await expect(page.locator('#day-picker')).toHaveValue('2026-11-11');
  await settled(page, 1);
  await page.evaluate(() => { location.hash = '#2026-11-03'; });
  await expect(page.locator('#day-picker')).toHaveValue('2026-11-03');
  expect(await settled(page, 2)).toEqual([flip(false, 2), flip(true, 3)]);
});

test('an edited hash that is invalid or today: no flip on today, a flip by distance when the day changes', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  for (const h of ['#hello', '#2026-13-01']) {
    await page.evaluate((h) => { location.hash = h; }, h);
    await expect.poll(() => hash(page)).toBe('');
  }
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  await page.waitForTimeout(100);
  expect(await flipsSeen(page)).toEqual([]);
  await page.evaluate(() => { location.hash = '#2026-11-12'; });
  await settled(page, 1);
  await page.evaluate(() => { location.hash = '#2026-11-09'; }); // today, written by hand
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  await expect.poll(() => hash(page)).toBe('');
  await page.evaluate(() => { location.hash = '#2026-11-12'; });
  await settled(page, 3);
  await page.evaluate(() => { location.hash = '#nope'; }); // invalid on another day: back to today, by distance
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  expect(await settled(page, 4)).toEqual([flip(false, 3), flip(true, 3), flip(false, 3), flip(true, 3)]);
});

test('a picker or hash move to the viewed day builds no stage', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED, '#2026-11-12');
  expect(await pickAndRead(page, '2026-11-12')).toBeNull();
  expect(await flipsSeen(page)).toEqual([]);
});

// Today typed by hand on a page already showing today with no hash: hashchange fires and the hash is cleaned, but the
// day does not change, so the flip still running from the last move is left alone and no new stage is built (R6).
// Without the key === viewed return in syncFromAddress, changeDay would end that flip at once.
test('today typed into the hash while today is shown leaves the running flip alone and builds no stage', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await next(page).click();
  await settled(page, 1);
  await prev(page).click(); // back on today, plain address, the flip still running
  const r = await page.evaluate(() => new Promise((done) => {
    addEventListener('hashchange', () => done({ fired: true, stages: document.querySelectorAll('.flip-stage').length }), { once: true });
    location.hash = '#2026-11-09';
  }));
  expect(r).toEqual({ fired: true, stages: 1 });
  await expect.poll(() => hash(page)).toBe('');
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  expect(await settled(page, 2)).toEqual([flip(false, 1), flip(true, 1)]);
});

test('keys compare as text across a year end: 31/12 to 1/1 flips forward, and back again flips back', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED, '#2026-12-31');
  await next(page).click();
  await expect(page.locator('#day-picker')).toHaveValue('2027-01-01');
  await settled(page, 1);
  await prev(page).click();
  await expect(page.locator('#day-picker')).toHaveValue('2026-12-31');
  expect(await settled(page, 2)).toEqual([flip(false, 1), flip(true, 1)]);
});
