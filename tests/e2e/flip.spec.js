import { test, expect } from '@playwright/test';
import { TODAY, GROUPS_KEY, task, group, open, rows, labels, hash, addTask, passMidnight, watchFlips, flipsSeen, resticksSeen } from './helpers.js';
import AxeBuilder from '@axe-core/playwright';
import { KEY, UI_KEY, storedJson, tick, box, mouseDrag, longPressDrag, finger, touchDrag } from './helpers.js';

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

// T4: rapid moves and interruptions (R7, R14, R16, R17, R28, R29, R36 to R39, NFR4, NFR7).
const nodesLeft = (page) => page.evaluate(() => document.querySelectorAll('.flip-stage, .leaf, .leaf-cast').length);
// The observer log never shows two stages at once: each stage is gone before the next one comes (R14).
const expectOneAtATime = (flips) => {
  for (let k = 1; k < flips.length; k++) {
    expect(flips[k - 1].removed, `flip ${k - 1} still there when flip ${k} came`).not.toBeNull();
    expect(flips[k - 1].removed).toBeLessThanOrEqual(flips[k].added);
  }
};
// Moves the page in and out of the hidden state the way a background tab does, through an init script.
const fakeVisibility = (page) => page.addInitScript(() => {
  window.__hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hidden });
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__hidden ? 'hidden' : 'visible') });
});

test('a move during a flip removes the old stage and builds one new stage, never two at once', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await next(page).click();
  await page.waitForTimeout(100);
  const during = await page.evaluate(() => {
    document.getElementById('next-day').click();
    return document.querySelectorAll('.flip-stage').length;
  });
  expect(during).toBe(1);
  await expect(dateLine(page)).toHaveText('Thứ Tư, 11/11/2026');
  await expect(stages(page)).toHaveCount(0);
  const flips = await flipsSeen(page);
  expect(flips.map(({ back, leaves }) => ({ back, leaves }))).toEqual([{ back: false, leaves: 1 }, { back: false, leaves: 1 }]);
  expectOneAtATime(flips);
  expect(flips[0].removed - flips[0].added).toBeLessThan(400); // cut short by the move, not by its timer
  expect(flips[1].text).toContain('Đặt bánh sinh nhật'); // the day that was on screen at the second press
});

test('a riffle cut by a previous press goes whole, then one back leaf plays from the day on screen', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await pickAndRead(page, '2026-11-15');
  await page.waitForTimeout(200);
  const left = await page.evaluate(() => {
    document.getElementById('prev-day').click();
    return [...document.querySelectorAll('.flip-stage')].map((s) => s.querySelectorAll('.leaf').length);
  });
  expect(left).toEqual([1]); // the 3 leaves of the riffle went together; only the new stage is there
  await expect(page.locator('#day-picker')).toHaveValue('2026-11-14');
  const flips = await settled(page, 2);
  expect(flips).toEqual([flip(false, 3), flip(true, 1)]);
  expectOneAtATime(await flipsSeen(page));
});

test('30 presses at 100 ms end on the right day with everything matching and no leaf 800 ms later', async ({ page }) => {
  test.setTimeout(30_000);
  await watchFlips(page);
  await open(page, SEED);
  const before = await page.evaluate(() => history.length);
  for (let k = 0; k < 30; k++) {
    await next(page).click();
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(700); // 800 ms after the last press, counting the wait in the loop
  expect(await nodesLeft(page)).toBe(0);
  expect(hash(page)).toBe('#2026-12-09');
  expect(await page.evaluate(() => history.length)).toBe(before + 30);
  await expect(page.locator('#day-picker')).toHaveValue('2026-12-09');
  await expect(dateLine(page)).toHaveText('Thứ Tư, 09/12/2026');
  await expect(page.locator('#empty')).toBeVisible();
  const flips = await flipsSeen(page);
  expect(flips).toHaveLength(30);
  expect(flips.every((f) => !f.back && f.leaves === 1 && f.removed)).toBe(true);
  expectOneAtATime(flips);
});

// The removal timer is --dur-flip plus 17 ms (467 ms). Presses 467, 468 and 470 ms after the one before race that
// timer: whichever runs first, there is one stage at a time and none left over.
test('presses at 449, 450 and 451 ms, then at the 467 ms timer edge, never leave two stages or a leftover', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  const counts = await page.evaluate(() => new Promise((done) => {
    const seen = [];
    const press = () => {
      document.getElementById('next-day').click();
      seen.push(document.querySelectorAll('.flip-stage').length);
    };
    const after = (ms, then) => setTimeout(() => { press(); then?.(); }, ms);
    press();
    setTimeout(press, 449);
    setTimeout(press, 450);
    after(451, () => after(467, () => after(468, () => after(470, () => done(seen)))));
  }));
  expect(counts).toEqual([1, 1, 1, 1, 1, 1, 1]);
  await expect(page.locator('#day-picker')).toHaveValue('2026-11-16');
  await expect.poll(() => nodesLeft(page)).toBe(0);
  const flips = await flipsSeen(page);
  expect(flips).toHaveLength(7);
  expect(flips.every((f) => f.removed)).toBe(true);
  expectOneAtATime(flips);
});

test('after 5 quick presses nothing plays once the last flip ends: no queue', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  for (let k = 0; k < 5; k++) {
    await next(page).click();
    await page.waitForTimeout(110);
  }
  await settled(page, 5);
  await page.waitForTimeout(1000);
  expect(await flipsSeen(page)).toHaveLength(5);
  expect(await nodesLeft(page)).toBe(0);
});

// 12/12/2026 reads the same in dd/mm/yyyy and mm/dd/yyyy, so the test does not depend on the field order the browser
// picks (Playwright's Chromium shows mm/dd/yyyy even with vi-VN). A year first field is skipped.
const validKey = (k) => /^20\d\d-\d\d-\d\d$/.test(k) && new Date(`${k}T00:00:00Z`).toISOString().startsWith(k);
test('typing a date into the picker moves on each valid date and ends on the typed day with no stage left', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  const before = await page.evaluate(() => history.length);
  await page.evaluate(() => {
    window.__picked = [];
    document.getElementById('day-picker').addEventListener('change', (e) => window.__picked.push(e.target.value));
  });
  await page.locator('#day-picker').focus(); // the first segment
  await page.keyboard.type('12', { delay: 50 });
  const first = await page.locator('#day-picker').inputValue();
  test.skip(!['2026-12-09', '2026-11-12'].includes(first), `the first segment is not the day or the month (value ${first})`);
  await page.keyboard.type('122026', { delay: 50 });
  await expect(page.locator('#day-picker')).toHaveValue('2026-12-12');
  await expect.poll(() => hash(page)).toBe('#2026-12-12');
  await expect(dateLine(page)).toHaveText('Thứ Bảy, 12/12/2026');
  await page.waitForTimeout(800);
  expect(await nodesLeft(page)).toBe(0);
  // Each distinct valid date the picker reported, other than the day it started on, is one move (R17); empty values
  // and partial years are ignored.
  const moves = new Set((await page.evaluate(() => window.__picked)).filter((k) => validKey(k) && k !== TODAY)).size;
  expect(moves).toBeGreaterThan(0);
  expect(await page.evaluate(() => history.length)).toBe(before + moves);
  const flips = await flipsSeen(page);
  expect(flips).toHaveLength(moves);
  expect(flips.every((f) => f.leaves >= 1 && f.leaves <= 3)).toBe(true);
  expectOneAtATime(flips);
});

test('reduced motion switched on during a riffle removes it at once with no helper class left; off again flips', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await pickAndRead(page, '2026-11-15');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(stages(page)).toHaveCount(0);
  await expect(dateLine(page)).not.toHaveClass(/washi--restick/);
  const [f] = await flipsSeen(page);
  expect(f.removed - f.added).toBeLessThan(500); // the riffle lives 700 ms: the setting ended it, not the timer
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await next(page).click();
  expect(await settled(page, 2)).toEqual([flip(false, 3), flip(false, 1)]);
});

test('a hidden page changes the day with no stage and no tape press', async ({ page }) => {
  await fakeVisibility(page);
  await watchFlips(page);
  await open(page, SEED);
  await page.evaluate(() => { window.__hidden = true; });
  await next(page).click();
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  await pickAndRead(page, '2026-11-03');
  await expect(dateLine(page)).toHaveText('Thứ Ba, 03/11/2026');
  await page.waitForTimeout(100);
  expect(await flipsSeen(page)).toEqual([]);
  expect(await resticksSeen(page)).toEqual([]);
});

test('the page going hidden during a flip ends it at once', async ({ page }) => {
  await fakeVisibility(page);
  await watchFlips(page);
  await open(page, SEED);
  await next(page).click();
  const left = await page.evaluate(() => {
    window.__hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    return document.querySelectorAll('.flip-stage, .leaf, .leaf-cast').length;
  });
  expect(left).toBe(0);
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
});

test('a window blur during a riffle leaves no stage after 700 ms', async ({ page }) => {
  await open(page, SEED);
  await pickAndRead(page, '2026-11-15');
  await page.evaluate(() => dispatchEvent(new Event('blur')));
  await page.waitForTimeout(700 + 17);
  expect(await nodesLeft(page)).toBe(0);
});

test('a storage event on the groups key ends a running flip at once and the page stays usable', async ({ page }) => {
  await open(page, SEED, '', { groups: [group('g1', 'Công ty')] });
  await next(page).click();
  await expect(stages(page)).toHaveCount(1);
  const left = await page.evaluate((key) => {
    dispatchEvent(new StorageEvent('storage', { key }));
    return document.querySelectorAll('.flip-stage, .leaf, .leaf-cast').length;
  }, GROUPS_KEY);
  expect(left).toBe(0);
  await addTask(page, 'Mua quà');
  await expect(labels(page)).toHaveText(['Đặt bánh sinh nhật', 'Mang áo khoác đi giặt', 'Mua quà']);
});

test('the delete note opening during a flip ends it at once and the note still works', async ({ page }) => {
  await open(page, SEED);
  await next(page).click();
  await expect(stages(page)).toHaveCount(1);
  await page.evaluate(() => document.querySelector('#day-list .task [data-action="remove"]').click());
  expect(await page.evaluate(() => new Promise((r) => setTimeout(() => r(document.querySelectorAll('.flip-stage, .leaf, .leaf-cast').length))))).toBe(0);
  const note = page.getByRole('alertdialog');
  await note.getByRole('button', { name: 'Xóa việc' }).click();
  await expect(note).toBeHidden();
  await expect(labels(page)).toHaveText(['Mang áo khoác đi giặt']);
});

test('the midnight refresh during a flip ends it and shows the new today', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED, '#2026-11-08');
  await next(page).click();
  await expect(stages(page)).toHaveCount(1);
  await passMidnight(page);
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Ba, 10/11/2026');
  expect(await nodesLeft(page)).toBe(0);
  const [f] = await flipsSeen(page);
  expect(f.removed - f.added).toBeLessThan(400);
  await expect(labels(page)).toHaveText(['Đặt bánh sinh nhật', 'Mang áo khoác đi giặt']);
});

test('without 3D support a move changes the day with no stage, no tape press and no error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => {
    const supports = CSS.supports.bind(CSS);
    CSS.supports = (...args) => (/rotateY|perspective/.test(args.join(' ')) ? false : supports(...args));
  });
  await watchFlips(page);
  await open(page, SEED);
  await next(page).click();
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  await pickAndRead(page, '2026-11-02');
  await expect(dateLine(page)).toHaveText('Thứ Hai, 02/11/2026');
  await page.waitForTimeout(100);
  expect(await flipsSeen(page)).toEqual([]);
  expect(await resticksSeen(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('an error inside the flip leaves the day changed, no stage and no uncaught error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const set = CSSStyleDeclaration.prototype.setProperty;
    CSSStyleDeclaration.prototype.setProperty = function (name, ...rest) {
      if (name === '--flip-top') throw new Error('flip broke');
      return set.call(this, name, ...rest);
    };
  });
  await open(page, SEED);
  await next(page).click();
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  await expect(labels(page)).toHaveText(['Đặt bánh sinh nhật', 'Mang áo khoác đi giặt']);
  expect(await nodesLeft(page)).toBe(0);
  expect(errors).toEqual([]);
});

test('a theme change during a riffle leaves no stage, and the next leaf back uses the new theme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await open(page, SEED);
  await pickAndRead(page, '2026-11-15');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.waitForTimeout(700 + 100);
  expect(await nodesLeft(page)).toBe(0);
  const back = await page.evaluate(() => {
    document.getElementById('next-day').click();
    return getComputedStyle(document.querySelector('.flip-stage .leaf__back')).backgroundColor;
  });
  expect(back).toBe('rgb(236, 229, 212)'); // the light --color-leaf-back, #ECE5D4
});

test('30 moves leave zero leaf nodes and the same listener count on window, document, sheet and tape', async ({ page }) => {
  test.setTimeout(30_000);
  await open(page, SEED);
  const cdp = await page.context().newCDPSession(page);
  const listeners = async () => {
    const out = {};
    for (const expr of ['window', 'document', 'document.querySelector(".sheet")', 'document.getElementById("date-line")']) {
      const { result } = await cdp.send('Runtime.evaluate', { expression: expr });
      const { listeners: l } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId, depth: 0 });
      out[expr] = l.length;
    }
    return out;
  };
  const before = await listeners();
  for (let k = 0; k < 30; k++) {
    await (k % 2 ? prev(page) : next(page)).click();
    await page.waitForTimeout(50);
  }
  await page.waitForTimeout(800);
  expect(await nodesLeft(page)).toBe(0);
  expect(await listeners()).toEqual(before);
  await cdp.detach();
});

// T5: a held key (R15, R7, R14). Playwright sets repeat true on every keyboard.down of a key already down.
// Reads the page right after a key event: the stage count, the date line and the address.
const readNow = (page) => page.evaluate(() => ({
  stages: document.querySelectorAll('.flip-stage').length,
  date: document.getElementById('date-line').textContent,
  hash: location.hash,
}));
// Holds a key on the focused control: one ordinary press, then `repeats` repeated downs. Returns a read after each.
const hold = async (page, key, repeats) => {
  await page.keyboard.down(key);
  const reads = [await readNow(page)];
  for (let k = 0; k < repeats; k++) {
    await page.keyboard.down(key);
    reads.push(await readNow(page));
  }
  return reads;
};

test('a held Enter on next: the first down flips, each repeat moves at once with no stage, the release flips the whole distance', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await next(page).focus();
  const reads = await hold(page, 'Enter', 2);
  expect(reads).toEqual([
    { stages: 1, date: 'Ngày mai, Thứ Ba, 10/11/2026', hash: '#2026-11-10' }, // the first down is an ordinary move
    { stages: 0, date: 'Thứ Tư, 11/11/2026', hash: '#2026-11-11' }, // a repeat ends the running flip and plays nothing
    { stages: 0, date: 'Thứ Năm, 12/11/2026', hash: '#2026-11-12' },
  ]);
  expect(await page.evaluate(() => document.querySelectorAll('.flip-stage').length)).toBe(0);
  await page.keyboard.up('Enter');
  await expect(stages(page)).toHaveCount(1);
  const flips = await flipsSeen(page);
  expect(flips[0].removed - flips[0].added).toBeLessThan(400); // cut short by the first repeat
  // The release turns from 10/11, the day on screen before the first repeat, to 12/11: 2 leaves (R3).
  expect(flips[1].text).toContain('Đặt bánh sinh nhật');
  expect(await settled(page, 2)).toEqual([flip(false, 1), flip(false, 2)]);
  await expect(next(page)).toBeFocused();
  expectOneAtATime(await flipsSeen(page));
});

test('one repeat gives 1 leaf on release, and 5 repeats give 3 leaves gone within 800 ms', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await next(page).focus();
  await hold(page, 'Enter', 1);
  await page.keyboard.up('Enter');
  expect(await settled(page, 2)).toEqual([flip(false, 1), flip(false, 1)]);
  await hold(page, 'Enter', 5);
  await page.keyboard.up('Enter');
  await expect(dateLine(page)).toHaveText('Thứ Ba, 17/11/2026');
  expect(await settled(page, 4)).toEqual([flip(false, 1), flip(false, 1), flip(false, 1), flip(false, 3)]);
  const last = (await flipsSeen(page))[3];
  expect(last.removed - last.added).toBeLessThan(lifetime(3));
});

test('a 40 repeat hold ends on the right day with 3 leaves and no leaf 800 ms after the release', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await next(page).focus();
  await hold(page, 'Enter', 40);
  await page.keyboard.up('Enter');
  await page.waitForTimeout(800);
  expect(await nodesLeft(page)).toBe(0);
  expect(hash(page)).toBe('#2026-12-20');
  await expect(page.locator('#day-picker')).toHaveValue('2026-12-20');
  await expect(dateLine(page)).toHaveText('Chủ Nhật, 20/12/2026');
  expect(await settled(page, 2)).toEqual([flip(false, 1), flip(false, 3)]);
});

test('a held Enter on previous flips back on release with the R3 leaf count', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await prev(page).focus();
  await hold(page, 'Enter', 2);
  await page.keyboard.up('Enter');
  await expect(dateLine(page)).toHaveText('Thứ Sáu, 06/11/2026');
  expect(await settled(page, 2)).toEqual([flip(true, 1), flip(true, 2)]);
});

for (const [how, act] of [
  ['focus moving away by Tab', (page) => page.keyboard.press('Tab')],
  ['a window blur', (page) => page.evaluate(() => dispatchEvent(new Event('blur')))],
]) {
  test(`${how} during a hold acts as the release`, async ({ page }) => {
    await watchFlips(page);
    await open(page, SEED);
    await next(page).focus();
    await hold(page, 'Enter', 2);
    await act(page);
    expect(await page.evaluate(() => document.querySelectorAll('.flip-stage .leaf').length)).toBe(2);
    await page.keyboard.up('Enter'); // the held key's own release now finds nothing to play
    expect(await settled(page, 2)).toEqual([flip(false, 1), flip(false, 2)]);
    await page.waitForTimeout(200);
    expect(await flipsSeen(page)).toHaveLength(2);
  });
}

test('the page going hidden during a hold plays no motion, then or on the key release', async ({ page }) => {
  await fakeVisibility(page);
  await watchFlips(page);
  await open(page, SEED);
  await next(page).focus();
  await hold(page, 'Enter', 2);
  await page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
  await page.keyboard.up('Enter');
  await page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(100);
  expect(await nodesLeft(page)).toBe(0);
  expect((await flipsSeen(page)).map((f) => f.leaves)).toEqual([1]); // only the first, ordinary press
  await expect(dateLine(page)).toHaveText('Thứ Năm, 12/11/2026');
});

test('a mouse click after repeats, before the key comes up, plays its own flip from the day on screen', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await next(page).focus();
  await hold(page, 'Enter', 2);
  await next(page).click();
  await page.keyboard.up('Enter');
  await expect(dateLine(page)).toHaveText('Thứ Sáu, 13/11/2026');
  expect(await settled(page, 2)).toEqual([flip(false, 1), flip(false, 1)]);
  await page.waitForTimeout(200);
  expect(await flipsSeen(page)).toHaveLength(2); // the key release found no hold left
});

test('a single Space press on an arrow flips once as an ordinary move, and a mouse click after a hold flips normally', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await next(page).focus();
  await page.keyboard.press('Space');
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  expect(await settled(page, 1)).toEqual([flip(false, 1)]);
  await hold(page, 'Enter', 3);
  await page.keyboard.up('Enter');
  expect(await settled(page, 3)).toEqual([flip(false, 1), flip(false, 1), flip(false, 3)]);
  await next(page).click();
  expect(await settled(page, 4)).toEqual([flip(false, 1), flip(false, 1), flip(false, 3), flip(false, 1)]);
});

// Space clicks on keyup. With repeated Space keydowns the repeat flag is set, so release() must clear it in the keyup
// dispatch before the click, or the one move would be taken as a repeat and play nothing.
test('a held Space on an arrow moves once on keyup with one ordinary flip and focus kept', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  await next(page).focus();
  const reads = await hold(page, 'Space', 2);
  expect(reads.map((r) => r.hash)).toEqual(['', '', '']); // no move while Space is down
  await page.keyboard.up('Space');
  await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  expect(hash(page)).toBe('#2026-11-10');
  await expect(next(page)).toBeFocused();
  expect(await settled(page, 1)).toEqual([flip(false, 1)]);
  await page.waitForTimeout(200);
  expect(await flipsSeen(page)).toHaveLength(1);
});

// A picker change with repeat true is a repeated move (decisions.md 2026-11-12, page-flip design). Repeats that come
// back to the day they started from play nothing on release. The repeat flag comes from a keydown with repeat true.
test('picker repeats that end on the start day play no motion on release', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  const counts = await page.evaluate(() => {
    const p = document.getElementById('day-picker');
    p.focus();
    p.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', repeat: true, bubbles: true }));
    const seen = [];
    for (const key of ['2026-11-10', '2026-11-11', '2026-11-10', '2026-11-09']) {
      p.value = key;
      p.dispatchEvent(new Event('change'));
      seen.push(document.querySelectorAll('.flip-stage').length);
    }
    p.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }));
    return seen;
  });
  expect(counts).toEqual([0, 0, 0, 0]);
  await page.waitForTimeout(200);
  expect(await flipsSeen(page)).toEqual([]);
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
});

// Chromium steps the focused part of the date field on each repeated ArrowDown and fires change with a keydown repeat
// before it, so T5-14 applies here. The first part may be the month or the day; the leaf count follows the distance.
test('a held arrow key in the date field plays nothing on the repeats and one flip or riffle on release', async ({ page }) => {
  await watchFlips(page);
  await open(page, SEED);
  const picker = page.locator('#day-picker');
  await picker.focus();
  const reads = await hold(page, 'ArrowDown', 2);
  expect(reads.map((r) => r.stages)).toEqual([1, 0, 0]); // the first down is an ordinary move
  const from = reads[0].hash.slice(1);
  const to = reads[2].hash.slice(1);
  expect(to < from).toBe(true);
  await page.keyboard.up('ArrowDown');
  const days = Math.round((Date.parse(from) - Date.parse(to)) / 864e5);
  expect((await settled(page, 2))[1]).toEqual(flip(true, Math.min(days, 3))); // from the day before the first repeat
});

test('a held Enter on Về hôm nay moves to today once with at most one flip and no error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await watchFlips(page);
  await open(page, SEED, '#2026-11-12');
  await page.locator('#to-today').focus();
  await hold(page, 'Enter', 4);
  await page.keyboard.up('Enter');
  await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  await page.waitForTimeout(800);
  expect((await flipsSeen(page)).length).toBeLessThanOrEqual(1);
  expect(await nodesLeft(page)).toBe(0);
  expect(errors).toEqual([]);
});

// T6: working on the page during a flip (R11, R18, R20 to R27, R31, R40, NFR5). slowFlip stretches --dur-flip, which
// the stage's timer reads, to 30 s, so the stage is certainly present while a real user action runs.
test.describe('T6: working on the page during a flip', () => {
  const TOMORROW = '2026-11-10';
  // The same text on both days, so a click or a tick that reached the leaf copy would show.
  const T6 = [
    task('t1', 'Gọi điện cho mẹ', false, TODAY, 1),
    task('t2', 'Gửi báo cáo tuần', false, TODAY, 2),
    task('m1', 'Gọi điện cho mẹ', false, TOMORROW, 3),
    task('m2', 'Mang áo khoác đi giặt', false, TOMORROW, 4),
  ];
  const GROUPS = [group('g1', 'Công ty')];
  const UI = '{"collapsed":[]}';
  const seed = (page, tasks = T6, hash = '') => open(page, tasks, hash, { groups: GROUPS, ui: UI });
  const slowFlip = (page) => page.evaluate(() => document.documentElement.style.setProperty('--dur-flip', '30000ms'));
  // A move to tomorrow with the stage left in place.
  const flipToTomorrow = async (page) => {
    await slowFlip(page);
    await next(page).click();
    await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
    await expect(stages(page)).toHaveCount(1);
  };
  const byId = async (page, id) => (await storedJson(page, KEY)).find((t) => t.id === id);
  const leftovers = (page) => page.locator('.drag-slip, .drop-strip, .task--placeholder, .task--pressing, html.is-dragging');
  const strip = (page) => page.getByRole('group', { name: 'Thả vào nhóm' });
  const rawAll = (page) => page.evaluate((keys) => keys.map((k) => localStorage.getItem(k)), [KEY, GROUPS_KEY, UI_KEY]);

  test('typed add text stays across the move, the caret does not jump, and typing goes on while the stage plays', async ({ page }) => {
    await seed(page);
    await slowFlip(page);
    const field = page.locator('#new-task');
    await field.click();
    await page.keyboard.type('abc');
    await page.keyboard.press('ArrowLeft');
    const now = await page.evaluate(() => {
      document.getElementById('next-day').click();
      const f = document.getElementById('new-task');
      return { value: f.value, caret: [f.selectionStart, f.selectionEnd], focus: document.activeElement.id, stage: !!document.querySelector('.flip-stage') };
    });
    expect(now).toEqual({ value: 'abc', caret: [2, 2], focus: 'new-task', stage: true });
    await page.keyboard.type('def');
    await expect(field).toHaveValue('abdefc');
    await expect(field).toBeFocused();
    await expect(stages(page)).toHaveCount(1);
  });

  test('a task added while the stage plays is saved with the new day, and the rebuild ends the flip', async ({ page }) => {
    await seed(page);
    await flipToTomorrow(page);
    await addTask(page, 'Mua quà');
    await expect(labels(page)).toHaveText(['Gọi điện cho mẹ', 'Mang áo khoác đi giặt', 'Mua quà']);
    const added = (await storedJson(page, KEY)).find((t) => t.text === 'Mua quà');
    expect(added.date).toBe(TOMORROW);
    await expect(stages(page)).toHaveCount(0);
  });

  test('a tick and an untick apply to the new day only and leave the flip running', async ({ page }) => {
    await seed(page);
    await flipToTomorrow(page);
    await tick(page, 0, true);
    expect((await byId(page, 'm1')).done).toBe(true);
    expect((await byId(page, 't1')).done).toBe(false);
    await expect(stages(page)).toHaveCount(1);
    await expect(stages(page).locator('.leaf__content input[type="checkbox"]:checked')).toHaveCount(0);
    await tick(page, 0, false);
    expect((await byId(page, 'm1')).done).toBe(false);
    await expect(stages(page)).toHaveCount(1);
  });

  test('an edit saved while the stage plays changes the new day row only; saving in place keeps the flip', async ({ page }) => {
    await seed(page);
    await flipToTomorrow(page);
    await rows(page).first().getByRole('button', { name: 'Sửa' }).focus();
    await page.keyboard.press('Enter');
    const field = page.locator('#edit-m1');
    await expect(field).toBeFocused();
    await field.fill('Gọi điện cho bố');
    await page.keyboard.press('Enter');
    await expect(labels(page)).toHaveText(['Gọi điện cho bố', 'Mang áo khoác đi giặt']);
    expect((await byId(page, 'm1')).text).toBe('Gọi điện cho bố');
    expect((await byId(page, 't1')).text).toBe('Gọi điện cho mẹ');
    // Observed and recorded: a save without a group change updates the row in place, no rebuild, so the flip runs on.
    await expect(stages(page)).toHaveCount(1);
  });

  test('a delete through the note while the stage plays removes the new day row only, and the note ends the flip', async ({ page }) => {
    await seed(page);
    await flipToTomorrow(page);
    await rows(page).first().getByRole('button', { name: 'Xóa' }).focus();
    await page.keyboard.press('Enter');
    const note = page.getByRole('alertdialog');
    await expect(note).toBeVisible();
    await expect(stages(page)).toHaveCount(0);
    await note.getByRole('button', { name: 'Xóa việc' }).click();
    await expect(labels(page)).toHaveText(['Mang áo khoác đi giặt']);
    expect((await storedJson(page, KEY)).map((t) => t.id)).toEqual(['t1', 't2', 'm2']);
  });

  test('a click on a point the leaf covers reaches the real row beneath, never the leaf copy', async ({ page }) => {
    await seed(page);
    await flipToTomorrow(page);
    const target = rows(page).first().locator('.check__box');
    const b = await target.boundingBox();
    const x = b.x + b.width / 2, y = b.y + b.height / 2;
    const at = await page.evaluate(([x, y]) => {
      const leaf = document.querySelector('.flip-stage .leaf:not(.leaf--blank)').getBoundingClientRect();
      const hit = document.elementFromPoint(x, y);
      return { covered: x >= leaf.left && x <= leaf.right && y >= leaf.top && y <= leaf.bottom, real: !!hit.closest('#day-list'), leaf: !!hit.closest('.flip-stage') };
    }, [x, y]);
    expect(at).toEqual({ covered: true, real: true, leaf: false });
    await page.mouse.click(x, y);
    await expect(box(page, 0)).toBeChecked();
    expect((await byId(page, 'm1')).done).toBe(true);
    expect((await byId(page, 't1')).done).toBe(false);
  });

  // Each focus step as a name a person would hear, plus whether it sat inside the stage.
  const tabWalk = async (page) => {
    const seen = [];
    const name = () => page.evaluate(() => {
      const el = document.activeElement;
      const row = el.closest('#day-list .task')?.dataset.id ?? '';
      return `${el.tagName.toLowerCase()}#${el.id}|${el.getAttribute('aria-label') ?? el.textContent.trim().slice(0, 30)}|${row}|${!!el.closest('.flip-stage')}`;
    });
    await page.locator('#prev-day').focus();
    for (let i = 0; i < 40; i++) { await page.keyboard.press('Tab'); seen.push(await name()); }
    for (let i = 0; i < 40; i++) { await page.keyboard.press('Shift+Tab'); seen.push(await name()); }
    return seen;
  };

  test('Tab and Shift plus Tab follow the settled order and names, and no leaf node is ever focused', async ({ page }) => {
    await seed(page);
    await flipToTomorrow(page);
    await page.evaluate(() => { window.__leafFocus = 0; addEventListener('focusin', (e) => { if (e.target.closest('.flip-stage')) window.__leafFocus++; }, true); });
    const during = await tabWalk(page);
    await expect(stages(page)).toHaveCount(1);
    expect(await page.evaluate(() => window.__leafFocus)).toBe(0);
    expect(during.filter((s) => s.endsWith('|true'))).toEqual([]);
    expect(during.some((s) => s.includes('|m1|'))).toBe(true); // the walk did reach the new day's rows
    await page.reload(); // the same day, settled: no stage on load
    await expect(stages(page)).toHaveCount(0);
    expect(await tabWalk(page)).toEqual(during);
  });

  test('the accessibility tree with a stage present holds the new day only, as on the settled page', async ({ page }) => {
    await seed(page, [...T6.slice(0, 2), task('m2', 'Mang áo khoác đi giặt', false, TOMORROW, 4)]);
    await flipToTomorrow(page);
    const during = await page.locator('body').ariaSnapshot();
    expect(during).not.toContain('Gửi báo cáo tuần');
    expect(during).not.toContain('Gọi điện cho mẹ');
    expect(during).toContain('Mang áo khoác đi giặt');
    await page.reload();
    await expect(stages(page)).toHaveCount(0);
    expect(await page.locator('body').ariaSnapshot()).toEqual(during);
  });

  test('axe reports no violation with a stage present (Chromium)', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'axe runs on Chromium only');
    await seed(page);
    await flipToTomorrow(page);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    await expect(stages(page)).toHaveCount(1);
  });

  test('a mouse drag active at a browser Back is cancelled first: nothing left over and no placeholder on the leaf', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse: desktop project');
    await page.addInitScript(() => {
      window.__copies = [];
      new MutationObserver((list) => {
        for (const m of list) for (const n of m.addedNodes) {
          if (n.classList?.contains('flip-stage')) window.__copies.push({ back: n.classList.contains('flip-stage--back'), odd: n.querySelectorAll('.task--placeholder, .task--pressing, .drag-slip, .drop-strip').length, text: n.textContent });
        }
      }).observe(document, { subtree: true, childList: true });
    });
    await seed(page, T6, `#${TOMORROW}`);
    const before = await rawAll(page);
    await prev(page).click(); // to today, one history entry
    await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
    await expect(stages(page)).toHaveCount(0);
    await mouseDrag(page, rows(page).nth(1));
    await expect(page.locator('html')).toHaveClass(/is-dragging/);
    await page.goBack(); // to tomorrow: later by date, so the leaf carries the page the drag was on
    await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
    await expect(leftovers(page)).toHaveCount(0);
    const copies = await page.evaluate(() => window.__copies);
    expect(copies.at(-1)).toMatchObject({ back: false, odd: 0 });
    expect(copies.at(-1).text).toContain('Gửi báo cáo tuần');
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);
    expect(await rawAll(page)).toEqual(before);
  });

  for (const ms of [200, 450]) {
    test(`a touch press held ${ms} ms during a move leaves no stuck press, drag, leaf or scroll lock`, async ({ page, isMobile }) => {
      test.skip(!isMobile, 'touch: phone project');
      await page.addInitScript(() => localStorage.setItem('daily-todo:swipe-hint-seen', '1'));
      const long = Array.from({ length: 24 }, (_, i) => task(`l${i}`, `Việc dài ${i + 1}`, false, TOMORROW, 100 + i));
      await seed(page, [...T6.slice(0, 2), ...long]);
      const b = await rows(page).nth(1).locator('.task__label').boundingBox();
      const f = await finger(page);
      await f.down(b.x + Math.min(b.width / 2, 60), b.y + b.height / 2);
      await page.waitForTimeout(ms);
      if (ms === 450) await expect(page.locator('html')).toHaveClass(/is-dragging/);
      await page.evaluate(() => document.getElementById('next-day').click());
      await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
      await expect(leftovers(page)).toHaveCount(0);
      await f.up();
      await expect(leftovers(page)).toHaveCount(0);
      await expect(stages(page)).toHaveCount(0);
      // The page still scrolls under a finger: no lock was left behind.
      const r = await rows(page).nth(6).locator('.task__label').boundingBox();
      const g = await finger(page);
      await g.down(r.x + 40, r.y + r.height / 2);
      await g.move(r.x + 40, r.y + r.height / 2 - 300, 10);
      await g.up();
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
    });
  }

  test('a new drag starts on the new day rows while the stage plays and its drop moves the task', async ({ page, isMobile }) => {
    if (isMobile) await page.addInitScript(() => localStorage.setItem('daily-todo:swipe-hint-seen', '1'));
    await seed(page);
    await flipToTomorrow(page);
    const row = rows(page).nth(1);
    const target = strip(page).locator('.drop-target').filter({ hasText: 'Công ty' });
    if (isMobile) {
      const f = await longPressDrag(page, row, null, { release: false });
      await expect(page.locator('html')).toHaveClass(/is-dragging/);
      const t = await target.boundingBox();
      await f.move(t.x + t.width / 2, t.y + t.height / 2);
      await f.up();
    } else {
      await mouseDrag(page, row);
      await expect(page.locator('html')).toHaveClass(/is-dragging/);
      await expect(stages(page)).toHaveCount(1); // lifting rebuilds nothing, so the flip plays on
      const t = await target.boundingBox();
      await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 6 });
      await page.mouse.up();
    }
    await expect(leftovers(page)).toHaveCount(0);
    expect((await byId(page, 'm2')).groupId).toBe('g1');
    expect((await byId(page, 't2')).groupId).toBeUndefined();
    await expect(page.locator('#day-list > .group').filter({ hasText: 'Công ty' }).locator('.task__label')).toHaveText(['Mang áo khoác đi giặt']);
    await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
  });

  test('20 moves of different distances with a tick and an untick leave the stored strings byte for byte', async ({ page }) => {
    await watchFlips(page);
    await seed(page);
    const before = await rawAll(page);
    expect(before.every((s) => typeof s === 'string')).toBe(true);
    const pick = (k) => page.evaluate((k) => { const p = document.getElementById('day-picker'); p.value = k; p.dispatchEvent(new Event('change')); }, k);
    const moves = [
      () => next(page).click(), () => next(page).click(), () => prev(page).click(), () => pick('2026-11-20'),
      () => page.getByRole('button', { name: 'Về hôm nay' }).click(), () => pick('2026-10-01'), () => page.goBack(),
      () => page.goBack(), () => page.goForward(), () => page.evaluate(() => { location.hash = '#2026-12-31'; }),
      () => next(page).click(), () => prev(page).click(), () => pick('2026-11-07'), () => next(page).click(),
      () => next(page).click(), () => pick('2027-03-01'), () => page.getByRole('button', { name: 'Về hôm nay' }).click(),
      () => prev(page).click(), () => pick('2026-11-12'), () => page.getByRole('button', { name: 'Về hôm nay' }).click(),
    ];
    for (const [i, move] of moves.entries()) {
      const was = await dateLine(page).textContent();
      if (i === 4) await slowFlip(page); // this move's stage stays, so the tick certainly lands during a flip
      await move();
      await expect(dateLine(page)).not.toHaveText(was);
      if (i === 4) { // on today, while the flip plays; the next move ends that stage and plays at the normal length
        await expect(stages(page)).toHaveCount(1);
        await tick(page, 0, true);
        await tick(page, 0, false);
        await expect(stages(page)).toHaveCount(1);
        await page.evaluate(() => document.documentElement.style.removeProperty('--dur-flip'));
      }
    }
    await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
    await expect.poll(async () => (await flipsSeen(page)).length).toBe(20);
    await expect(stages(page)).toHaveCount(0);
    expect(await rawAll(page)).toEqual(before);
  });

  test('a save that throws while the stage plays shows the same storage slip and the day stays', async ({ page }) => {
    await page.addInitScript(() => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (...args) {
        if (window.blockSaves) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        return real.apply(this, args);
      };
    });
    await seed(page);
    await flipToTomorrow(page);
    await page.evaluate(() => { window.blockSaves = true; });
    await addTask(page, 'Mua quà');
    await expect(page.getByRole('alert').filter({ hasText: 'Không thể lưu dữ liệu trên trình duyệt này.' })).toBeVisible();
    await expect(labels(page)).toHaveText(['Gọi điện cho mẹ', 'Mang áo khoác đi giặt', 'Mua quà']);
    await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
    expect(hash(page)).toBe(`#${TOMORROW}`);
    expect((await storedJson(page, KEY)).map((t) => t.id)).toEqual(['t1', 't2', 'm1', 'm2']);
  });

  test('under reduced motion CSS hides a stage injected by hand', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page);
    const display = await page.evaluate(() => {
      const s = document.createElement('div');
      s.className = 'flip-stage';
      document.querySelector('.sheet').append(s);
      return getComputedStyle(s).display;
    });
    expect(display).toBe('none');
  });

  for (const [how, act] of [['an arrow', (page) => next(page).click()], ['a riffle', (page) => page.evaluate(() => { const p = document.getElementById('day-picker'); p.value = '2026-11-20'; p.dispatchEvent(new Event('change')); })]]) {
    test(`the live date line changes once at ${how} move and not at the end of the flip`, async ({ page }) => {
      await watchFlips(page);
      await seed(page);
      await page.evaluate(() => {
        window.__live = [];
        new MutationObserver((l) => { for (const m of l) if (m.type !== 'attributes') window.__live.push(!!document.querySelector('.flip-stage')); })
          .observe(document.getElementById('date-line'), { subtree: true, childList: true, characterData: true });
      });
      await act(page);
      await expect.poll(async () => (await flipsSeen(page)).filter((f) => f.removed).length).toBe(1);
      await page.waitForTimeout(100);
      // One change, seen while the stage was there: at the move, in the same task that built it, never at its end.
      expect(await page.evaluate(() => window.__live)).toEqual([true]);
    });
  }
});

// T7: layout, phones and dark mode (R13, R30, R32 to R36).
test.describe('T7: layout, phones and dark mode', () => {
  const WIDTHS = [[1440, 900], [390, 844], [360, 780]];
  const LONG = 'Đ'.repeat(200); // a long unbroken word, the worst case for horizontal overflow
  const T7 = [...SEED, task('l1', LONG, false, TODAY, 7), task('l2', LONG, false, '2026-11-12', 8)];
  // A day with enough rows that the page scrolls, so the sheet body can sit partly above the window.
  // The text wraps to two lines at 390 and 360 px, so rows above the window are taller than the one rule placeholder.
  const many = (date, from) => Array.from({ length: 30 }, (_, k) => task(`${date}-${k}`, `Việc số ${k + 1}: gọi nhà cung cấp hỏi lịch giao hàng của ${date}`, false, date, from + k));
  const SCROLL = [...many(TODAY, 100), ...many('2026-11-10', 200)];
  const pick = (page, key) => page.evaluate((k) => { const p = document.getElementById('day-picker'); p.value = k; p.dispatchEvent(new Event('change')); }, key);

  // Moves with the picker in the page, then reads the layout on every frame until the stage is gone and 3 frames
  // more. The move and the first read share one task, so the frame the stage is built in is read too. The new day may
  // be taller, so frames are compared with the settled last one. Rows use content-visibility: auto with a one rule
  // placeholder, so a tall new row reaches its real height a frame or more after the move, with or without a flip.
  // So every read is checked against the same read without the stage (the stage adds no height), the page must settle
  // within a few frames and stay settled, and from the first painted frame the stage stays inside the sheet as the
  // sheet is in that frame (it follows the page while rows grow).
  const riffleFrames = (page, key) => page.evaluate((key) => new Promise((done) => {
    const root = document.documentElement;
    const p = document.getElementById('day-picker');
    p.value = key;
    p.dispatchEvent(new Event('change'));
    const frames = [];
    let after = 0;
    const read = () => {
      const stage = document.querySelector('.flip-stage');
      const s = stage?.getBoundingClientRect(), sh = document.querySelector('.sheet').getBoundingClientRect();
      const height = root.scrollHeight;
      if (stage) stage.style.display = 'none'; // the same frame without the stage, for what the stage itself adds
      const bare = root.scrollHeight;
      if (stage) stage.style.display = '';
      frames.push({
        stage: !!stage, leaves: stage ? stage.querySelectorAll('.leaf').length : 0,
        overflowX: root.scrollWidth - root.clientWidth, height, bare,
        inside: !s || (s.left >= sh.left - 0.5 && s.right <= sh.right + 0.5 && s.top >= sh.top - 0.5 && s.bottom <= sh.bottom + 0.5),
      });
      if (!stage) after++;
      if (after > 3) done(frames); else requestAnimationFrame(read);
    };
    read();
  }), key);

  for (const [width, height] of WIDTHS) {
    test(`at ${width} px a 3 leaf riffle adds no horizontal scroll or height and stays inside the sheet, during and after`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await open(page, T7);
      for (const key of ['2026-11-12', TODAY]) { // forward to the long word day, then back again
        const frames = await riffleFrames(page, key);
        expect(frames[0]).toMatchObject({ stage: true, leaves: 3 });
        expect(frames.filter((f) => f.stage).length).toBeGreaterThan(5);
        const settled = frames.at(-1).height;
        for (const f of frames) expect(f, key).toMatchObject({ overflowX: 0, height: f.bare });
        for (const f of frames.slice(1)) expect(f.inside, key).toBe(true);
        const from = frames.findIndex((f) => f.height === settled);
        expect(from, key).toBeLessThanOrEqual(5);
        for (const f of frames.slice(from)) expect(f.height, key).toBe(settled);
      }
    });
  }

  // Scrolls (to a y, or 'bottom' for 300 px above the end; `through` first scrolls the whole page a window at a time so
  // every old row has painted at its real size), lets two frames paint (rows coming into view leave their one rule
  // placeholder), reads the label boxes, moves, holds the leaf flat (a forward leaf at its first frame, a back leaf at
  // its last, the same motion reversed), lets two more frames paint and reads the leaf copy and the page again.
  // Boxes are taken from the sheet body top: the header can change height with the day (the title wraps on today at
  // 360 px), and the leaf is the body's page, drawn under the header rule as it is now. `seen` lists the rows of the
  // compared page that are in the window, as [index, left, top], and `leaf` the copy's rows at the same indexes.
  const scrolledMove = (page, id, to, through = false) => page.evaluate(async ([id, to, through]) => {
    const paint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const rects = (sel) => {
      const top = document.querySelector('.sheet__body').getBoundingClientRect().top;
      return [...document.querySelectorAll(sel)].map((l) => l.getBoundingClientRect())
        .map((r, i) => ({ i, left: Math.round(r.left), top: Math.round(r.top - top), seen: r.bottom > 0 && r.top < innerHeight }));
    };
    const y = () => (to === 'bottom' ? document.documentElement.scrollHeight - innerHeight - 300 : to);
    if (through) for (let k = 0; k < y(); k += innerHeight) { scrollTo(0, k); await paint(); }
    scrollTo(0, y());
    await paint();
    const old = rects('#day-list .task__label');
    document.getElementById(id).click();
    const stage = document.querySelector('.flip-stage');
    const back = stage.classList.contains('flip-stage--back');
    stage.getAnimations({ subtree: true }).forEach((a) => (back ? a.finish() : a.pause()));
    await paint();
    const body = document.querySelector('.sheet__body').getBoundingClientRect();
    const page = back ? rects('#day-list .task__label') : old;
    const leaf = rects('.flip-stage .leaf:not(.leaf--blank) .task__label');
    const seen = page.filter((r) => r.seen);
    return {
      offset: parseFloat(stage.style.getPropertyValue('--flip-offset')), above: -body.top,
      top: stage.getBoundingClientRect().top, count: [page.length, leaf.length],
      seen: seen.map(({ i, left, top }) => [i, left, top]),
      leaf: seen.map(({ i }) => [i, leaf[i].left, leaf[i].top]),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, [id, to, through]);
  const playOut = async (page) => {
    await page.evaluate(() => document.querySelector('.flip-stage')?.getAnimations({ subtree: true }).forEach((a) => a.play()));
    await expect(stages(page)).toHaveCount(0);
  };
  const linedUp = (m, rows) => {
    expect(m.offset).toBeGreaterThan(0);
    expect(m.offset).toBeCloseTo(m.above, 0);
    expect(m.top).toBeCloseTo(0, 0); // the stage starts at the window top, not at the scrolled away body top
    expect(m.count[0]).toBe(rows);
    // T8 (NFR3): the copy ends at the first row below the window, and holds every row in the window and above it.
    expect(m.count[1]).toBeLessThanOrEqual(rows);
    expect(m.count[1]).toBeGreaterThan(Math.max(...m.seen.map(([i]) => i)));
    expect(m.seen.length).toBeGreaterThan(2);
    expect(m.leaf).toEqual(m.seen); // every row in the window has its copy exactly on it
    expect(m.overflowX).toBe(0);
  };

  for (const [width, height] of WIDTHS) {
    test(`a scrolled page at ${width} px: the leaf copy lines up with the page through --flip-offset, the tape presses, no overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await watchFlips(page);
      await open(page, SCROLL);
      linedUp(await scrolledMove(page, 'next-day', 1200), 30); // forward: the old page's copy as the old rows sat
      await playOut(page);
      linedUp(await scrolledMove(page, 'prev-day', 1200), 30); // back: the new page's copy on the new rows
      expect((await resticksSeen(page)).filter((r) => r.on)).toHaveLength(2);
    });
  }

  // 200 wrapping rows a day: play() lays out no rows (BUG-027); the far rows stay one rule placeholders, and the
  // ResizeObserver puts the stage back on the page after each layout, so the copy lines up once the rows near the
  // window have grown.
  const LONG_DAY = (date, from) => Array.from({ length: 200 }, (_, k) => task(`${date}-${k}`, `Việc số ${k + 1}: gọi nhà cung cấp hỏi lại lịch giao hàng và hóa đơn của ${date}`, k % 3 === 0, date, from + k));
  const BIG = [...LONG_DAY(TODAY, 1000), ...LONG_DAY('2026-11-10', 2000)];
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    for (const through of [false, true]) {
      test(`200 wrapping rows scrolled near the bottom at ${width} px${through ? ' after scrolling the whole page' : ''}: the copy lines up`, async ({ page }) => {
        test.setTimeout(60_000);
        await page.setViewportSize({ width, height });
        await open(page, BIG);
        linedUp(await scrolledMove(page, 'next-day', 'bottom', through), 200);
        await playOut(page);
        linedUp(await scrolledMove(page, 'prev-day', 'bottom', through), 200);
      });
    }
  }

  // NFR1 with the flip on: a move to a day of 200 long, wrapping rows, the click and the layout it forces, median of 3,
  // from the top of the page and from near its bottom. play() lays out no rows in this task; the ResizeObserver
  // realigns the stage in the frame that follows, so near the bottom costs no more than the top.
  const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  for (const where of ['top', 'bottom']) {
    test(`a move between two days of 200 long wrapping rows takes under 100 ms (median of 3), scrolled to the ${where}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, BIG);
      const times = [];
      for (let k = 0; k < 3; k++) {
        await page.evaluate((where) => scrollTo(0, where === 'top' ? 0 : document.documentElement.scrollHeight - innerHeight - 300), where);
        await page.waitForTimeout(500); // an idle page is the slow case (BUG-002)
        times.push(await page.evaluate((id) => {
          const t = performance.now();
          document.getElementById(id).click();
          void document.body.offsetHeight;
          return performance.now() - t;
        }, k % 2 ? 'prev-day' : 'next-day'));
        await expect(rows(page)).toHaveCount(200);
        expect(await page.locator('.flip-stage').count()).toBe(1);
        await expect(stages(page)).toHaveCount(0);
      }
      console.log(`T7 NFR1 200 wrapping rows, ${where}: ${times.map((t) => t.toFixed(1)).join(', ')} ms`);
      expect(median(times)).toBeLessThan(100);
    });
  }

  test('the same leaf counts and lifetimes on a tap, a picker date and Về hôm nay as on desktop', async ({ page, isMobile }) => {
    await watchFlips(page);
    await open(page, SEED);
    const press = (loc) => (isMobile ? loc.tap() : loc.click());
    await press(next(page));
    await expect(dateLine(page)).toHaveText('Ngày mai, Thứ Ba, 10/11/2026');
    await expect.poll(async () => (await flipsSeen(page)).filter((f) => f.removed).length).toBe(1);
    await page.locator('#day-picker').fill('2026-11-13');
    await expect.poll(async () => (await flipsSeen(page)).filter((f) => f.removed).length).toBe(2);
    await press(page.getByRole('button', { name: 'Về hôm nay' }));
    await expect.poll(async () => (await flipsSeen(page)).filter((f) => f.removed).length).toBe(3);
    const flips = await flipsSeen(page);
    expect(flips.map(({ back, leaves }) => ({ back, leaves }))).toEqual([
      { back: false, leaves: 1 }, { back: false, leaves: 3 }, { back: true, leaves: 3 }]);
    for (const f of flips) {
      expect(f.removed - f.added).toBeLessThanOrEqual(lifetime(f.leaves));
      expect(f.removed - f.added).toBeGreaterThanOrEqual(lifetime(f.leaves) - 150);
    }
  });

  test('a swipe left on a row opens Sửa and Xóa with no day change and no flip', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone swipe only');
    await page.addInitScript(() => localStorage.setItem('daily-todo:swipe-hint-seen', '1'));
    await watchFlips(page);
    await open(page, SEED);
    const swipe = rows(page).nth(0).locator('.task__swipe');
    await touchDrag(page, swipe, -200);
    await expect.poll(() => swipe.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    await expect(rows(page).nth(0).getByRole('button', { name: 'Sửa' })).toBeInViewport();
    await expect(rows(page).nth(0).getByRole('button', { name: 'Xóa' })).toBeInViewport();
    await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
    expect(hash(page)).toBe('');
    expect(await flipsSeen(page)).toEqual([]);
    expect(await resticksSeen(page)).toEqual([]);
  });

  test('a sideways swipe on an empty part of the page changes no day and plays no flip', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'phone swipe only');
    await watchFlips(page);
    await open(page, SEED);
    const list = await page.locator('#day-list').boundingBox();
    const y = Math.min(list.y + list.height + 80, page.viewportSize().height - 20);
    for (const dx of [-200, 200]) {
      const f = await finger(page);
      await f.down(page.viewportSize().width / 2 + (dx < 0 ? 100 : -100), y);
      await f.move(page.viewportSize().width / 2 + (dx < 0 ? 100 : -100) + dx, y);
      await f.up();
    }
    await page.waitForTimeout(600);
    await expect(dateLine(page)).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
    expect(hash(page)).toBe('');
    expect(await flipsSeen(page)).toEqual([]);
  });

  test('at 360 px every nav control stays at least 44 by 44 px while a stage plays, with no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await open(page, T7);
    await page.evaluate(() => document.documentElement.style.setProperty('--dur-flip', '30000ms'));
    await next(page).click();
    await expect(stages(page)).toHaveCount(1);
    for (const sel of ['#prev-day', '#next-day', '.date-stamp', '#to-today']) {
      const b = await page.locator(sel).boundingBox();
      expect(b.width, sel).toBeGreaterThanOrEqual(44);
      expect(b.height, sel).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });

  // Dark tokens from design-system.css: --color-paper #22262D, --color-leaf-back #1B1F25. Light: #FCF9F1 and #ECE5D4.
  const DARK_PAPER = 'rgb(34, 38, 45)', DARK_BACK = 'rgb(27, 31, 37)';
  const LIGHT = ['rgb(252, 249, 241)', 'rgb(236, 229, 212)'];
  // Reads the background of every leaf and leaf back on every frame of a move, until the stage goes.
  const leafColours = (page, key) => page.evaluate((key) => new Promise((done) => {
    const p = document.getElementById('day-picker');
    p.value = key;
    p.dispatchEvent(new Event('change'));
    const seen = { leaf: new Set(), back: new Set(), frames: 0 };
    const read = () => {
      const stage = document.querySelector('.flip-stage');
      if (!stage) return done({ leaf: [...seen.leaf], back: [...seen.back], frames: seen.frames });
      seen.frames++;
      for (const l of stage.querySelectorAll('.leaf')) seen.leaf.add(getComputedStyle(l).backgroundColor);
      for (const b of stage.querySelectorAll('.leaf__back')) seen.back.add(getComputedStyle(b).backgroundColor);
      requestAnimationFrame(read);
    };
    read();
  }), key);

  for (const key of ['2026-11-12', '2026-11-06']) {
    test(`dark mode: every leaf and leaf back of a 3 leaf riffle ${key > TODAY ? 'forward' : 'back'} uses the dark paper tokens on every frame`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await open(page, SEED);
      const c = await leafColours(page, key);
      expect(c.frames).toBeGreaterThan(5);
      expect(c.leaf).toEqual([DARK_PAPER]);
      expect(c.back).toEqual([DARK_BACK]);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-leaf-back').trim().toUpperCase())).toBe('#1B1F25');
      for (const light of LIGHT) expect([...c.leaf, ...c.back]).not.toContain(light);
    });
  }

  // TC-page-flip-T7-09 (R35): text contrast at 20, 50 and 80 percent of a flip, forward and back, light and dark. The
  // leaf is held at each frame and every colour is composited through a 1 px canvas, layer by layer as it is painted.
  // Leaf text is paper, then ink, then the shade, then the leaf back at its frame opacity, checked while the back has
  // not yet covered it (opacity under 1). The shade runs from clear at 10 percent of the leaf to --flip-shade at its
  // free edge, so each label takes the shade at its right end (its darkest point), in the leaf's own flat coordinates.
  // New page text is ink on paper under the cast shadow at its frame opacity. The cast fades from the rings to clear
  // at 92 percent of its width and the leaf hides what is left of its projected edge, so each label is checked at
  // its darkest visible point: its left end, or the leaf's edge when the leaf covers that end; a label wholly under
  // the leaf is not readable and is skipped.
  // Every day holds an open and a done task, so both inks are checked on the leaf and on the page at every frame.
  const INKS = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'].flatMap((d, k) => [
    task(`o${k}`, 'Gửi biên bản họp cho anh Minh', false, d, 3 * k), task(`d${k}`, 'Đi chợ mua rau và trứng', true, d, 3 * k + 1),
    // a done task long enough to wrap, so its ink reaches the free edge where the shade is darkest
    task(`w${k}`, 'Trình bày số liệu tháng 10 ở buổi họp dự án với khách hàng, rồi gửi biên bản và lịch hẹn tiếp theo cho cả nhóm', true, d, 3 * k + 2)]);
  for (const colorScheme of ['light', 'dark']) {
    test(`${colorScheme}: leaf and new page text keep 4.5 to 1 at 20, 50 and 80 percent of a flip, forward and back`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await open(page, INKS);
      const seen = [];
      for (const id of ['next-day', 'prev-day']) {
        for (const at of [0.2, 0.5, 0.8]) {
          const r = await page.evaluate(([id, at]) => {
            document.getElementById(id).click();
            const stage = document.querySelector('.flip-stage');
            const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur-flip'));
            for (const a of stage.getAnimations({ subtree: true })) { a.pause(); a.currentTime = at * ms; }
            const ctx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
            const paint = (...layers) => { // [colour, alpha] pairs, painted in order
              ctx.clearRect(0, 0, 1, 1);
              for (const [c, alpha = 1] of layers) { ctx.globalAlpha = alpha; ctx.fillStyle = '#000'; ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); }
              ctx.globalAlpha = 1;
              return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
            };
            const lum = (rgb) => { const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
            const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
            const css = (el, p) => getComputedStyle(el)[p];
            const leaf = stage.querySelector('.leaf:not(.leaf--blank)');
            const paper = css(leaf, 'backgroundColor');
            const shade = [getComputedStyle(document.documentElement).getPropertyValue('--flip-shade').trim(), +css(leaf.querySelector('.leaf__shade'), 'opacity')];
            const back = [css(leaf.querySelector('.leaf__back'), 'backgroundColor'), +css(leaf.querySelector('.leaf__back'), 'opacity')];
            const cast = [getComputedStyle(document.documentElement).getPropertyValue('--flip-cast').trim(), +css(stage.querySelector('.leaf-cast'), 'opacity')];
            const page = css(document.querySelector('.sheet'), 'backgroundColor');
            const inks = (root) => [...new Set([...root.querySelectorAll('.task__text')].map((t) => css(t, 'color')))];
            const flatRight = (el) => { let x = el.offsetWidth; for (let e = el; e && e !== leaf; e = e.offsetParent) x += e.offsetLeft; return x; };
            const onLeaf = [...leaf.querySelectorAll('.task__label')].map((l) => {
              const f = flatRight(l) / leaf.offsetWidth;
              const s = [shade[0], shade[1] * Math.min(Math.max((f - 0.1) / 0.9, 0), 1)];
              const ink = css(l, 'color');
              return ratio(paint([paper], [ink], s, back), paint([paper], s, back));
            });
            const c = stage.querySelector('.leaf-cast').getBoundingClientRect();
            const edge = leaf.getBoundingClientRect().right;
            const onPage = [...document.querySelectorAll('#day-list .task__label')].flatMap((t) => {
              const r = t.getBoundingClientRect();
              const x = Math.max(r.left, edge);
              if (x >= r.right) return []; // wholly under the leaf
              const f = Math.min(Math.max((x - c.left) / c.width, 0), 1);
              const under = [cast[0], cast[1] * Math.max(0, 1 - f / 0.92)];
              return [ratio(paint([page], under, [css(t, 'color')]), paint([page], under))];
            });
            const out = { back: back[1], onLeaf, onPage, inks: inks(leaf).length, pageInks: inks(document.getElementById('day-list')).length };
            for (const a of stage.getAnimations({ subtree: true })) a.finish();
            return out;
          }, [id, at]);
          seen.push({ id, at, ...r });
          await expect(stages(page)).toHaveCount(0);
        }
      }
      console.log(`T7 text contrast ${colorScheme}: ${JSON.stringify(seen.map(({ id, at, back, onLeaf, onPage }) => [id, at, back, onLeaf.map((v) => v.toFixed(1)), onPage.map((v) => v.toFixed(1))]))}`);
      const readable = seen.filter((f) => f.back < 1);
      expect(readable.length).toBeGreaterThanOrEqual(3); // text shows on the leaf in at least 3 of the 6 frames
      for (const f of seen) {
        expect(f.inks, `${f.id} ${f.at}`).toBe(2); // open and done ink both checked
        expect(f.onLeaf.length, `${f.id} ${f.at}`).toBe(3);
        if (f.back < 1) for (const v of f.onLeaf) expect(v, `leaf ${f.id} ${f.at}`).toBeGreaterThanOrEqual(4.5);
        for (const v of f.onPage) expect(v, `page ${f.id} ${f.at}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  test('switching to dark mid flip ends cleanly, and the next flip uses the dark leaf back', async ({ page }) => {
    await open(page, SEED);
    await pick(page, '2026-11-15');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(700 + 100);
    await expect(stages(page)).toHaveCount(0);
    const c = await leafColours(page, '2026-11-14');
    expect(c.leaf).toEqual([DARK_PAPER]);
    expect(c.back).toEqual([DARK_BACK]);
  });
});

test.describe('T8: speed with 200 tasks', () => {
  const DAY = (date, from) => Array.from({ length: 200 }, (_, k) => task(`${date}-${k}`, `Việc số ${k + 1} của ngày ${date}`, k % 3 === 0, date, from + k));
  const BIG = [...DAY(TODAY, 1000), ...DAY('2026-11-10', 2000), ...DAY('2026-11-12', 3000)];
  const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  const pick = (page, key) => page.evaluate((k) => { const p = document.getElementById('day-picker'); p.value = k; p.dispatchEvent(new Event('change')); }, key);

  // Scrolls to `to` (a y, or 'bottom' for 300 px above the end), lets the rows near the window paint, moves, and
  // counts the rows of the compared page that reach into the window (top above its bottom edge, the rows above it
  // included) against the rows on the leaf copy. Forward: the old page as it sat; back: the new page, read once two
  // frames have laid out its rows near the window. `last` is the highest index of a row in the window.
  const trimmed = (page, id, to) => page.evaluate(async ([id, to]) => {
    const paint = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const reach = () => {
      const r = [...document.querySelectorAll('#day-list .task')].map((t) => t.getBoundingClientRect());
      return { reach: r.filter((b) => b.top < innerHeight).length, last: r.findLastIndex((b) => b.bottom > 0 && b.top < innerHeight) };
    };
    scrollTo(0, to === 'bottom' ? document.documentElement.scrollHeight - innerHeight - 300 : to);
    await paint();
    const old = reach();
    document.getElementById(id).click();
    const stage = document.querySelector('.flip-stage');
    const back = stage.classList.contains('flip-stage--back');
    const copied = () => stage.querySelectorAll('.leaf:not(.leaf--blank) .task').length;
    const first = copied();
    if (!back) return { ...old, copied: first, back };
    await paint();
    return { ...reach(), copied: copied(), back };
  }, [id, to]);

  for (const to of [0, 'bottom']) {
    test(`a leaf copy of a 200 task day holds no more rows than reach into the window, scrolled to ${to === 0 ? 'the top' : 'near the bottom'}`, async ({ page }) => {
      await open(page, BIG);
      for (const id of ['next-day', 'prev-day']) {
        const m = await trimmed(page, id, to);
        expect(m.reach, id).toBeLessThan(200);
        expect(m.copied, id).toBeLessThanOrEqual(m.reach); // no row below the window
        expect(m.copied, id).toBeGreaterThan(m.last); // every row in the window, and every row above it, is there
        await expect(stages(page)).toHaveCount(0);
      }
    });
  }

  test('the trimmed copy keeps the chosen select values and holds no id or for', async ({ page }) => {
    await open(page, BIG, '', { groups: [group('g1', 'Việc nhà'), group('g2', 'Công việc', 'blue')] });
    await page.locator('#new-task-group').selectOption('g2');
    const m = await page.evaluate(() => {
      document.getElementById('next-day').click();
      const leaf = document.querySelector('.flip-stage .leaf:not(.leaf--blank)');
      return {
        values: [...leaf.querySelectorAll('select')].map((s) => s.value),
        page: [...document.querySelectorAll('.sheet__body select')].map((s) => s.value),
        refs: leaf.querySelectorAll('[id], [for]').length,
        rows: leaf.querySelectorAll('.task').length,
      };
    });
    expect(m.values).toContain('g2');
    expect(m.values).toEqual(m.page.slice(0, m.values.length));
    expect(m.refs).toBe(0);
    expect(m.rows).toBeGreaterThan(0);
    expect(m.rows).toBeLessThan(200);
  });

  // NFR2 (Chromium): every frame of the motion, from the first frame after the move to the one the stage goes in,
  // with a longtask observer that runs 3 frames more. The move's own task and the frame that paints it render the new day's 200
  // rows and are timed by NFR1 (the under 100 ms tests); what NFR2 adds is that the motion after it never stalls.
  // Per run: the longtask count, the median frame time and the longest frame; the asserts take the median of 3 runs.
  const measure = (page, key) => page.evaluate((key) => new Promise((done) => {
    const long = [];
    const po = new PerformanceObserver((l) => long.push(...l.getEntries()));
    po.observe({ type: 'longtask' });
    const frames = [];
    let first = 0, last = 0, after = 0;
    const p = document.getElementById('day-picker');
    p.value = key;
    p.dispatchEvent(new Event('change'));
    const leaves = document.querySelectorAll('.flip-stage .leaf').length;
    const tick = (t) => {
      if (!after) frames.push(t - last); // up to and with the frame the stage is removed in
      last = t;
      if (!document.querySelector('.flip-stage')) after++;
      if (after < 3) return requestAnimationFrame(tick); // longtasks are still watched for 3 frames more
      setTimeout(() => { // longtask entries are delivered late
        po.disconnect();
        done({ leaves, frames, long: long.filter((e) => e.startTime + e.duration > first).map((e) => e.duration) });
      }, 50);
    };
    requestAnimationFrame((t) => { first = last = t; requestAnimationFrame(tick); });
  }), key);

  for (const [n, keys] of [[3, ['2026-11-12', TODAY]], [1, ['2026-11-10', TODAY]]]) {
    test(`a ${n} leaf ${n === 3 ? 'riffle' : 'flip'} between two 200 task days: no longtask, median frame at most 18.2 ms, no frame over 50 ms (median of 3)`, async ({ page, browserName, isMobile }) => {
      test.skip(browserName !== 'chromium', 'longtask and frame timing are measured in Chromium');
      // One project only: both projects are Chromium, and two copies of this schedule in step on the two workers put
      // one browser's 200 row move into the other's frames. The phone width is checked here instead.
      test.skip(isMobile, 'timed in the desktop project, at 1440 and 390 px');
      test.setTimeout(60_000);
      await open(page, BIG);
      const runs = [];
      for (const [width, height] of [[1440, 900], [390, 844]]) {
        await page.setViewportSize({ width, height });
        for (let k = 0; k < 3; k++) { // one run: forward, then back again
          const frames = [], long = [];
          for (const key of keys) {
            await page.waitForTimeout(300);
            const r = await measure(page, key);
            expect(r.leaves).toBe(n);
            frames.push(...r.frames);
            long.push(...r.long);
          }
          runs.push({ width, long: long.length, median: median(frames), max: Math.max(...frames), at: frames.indexOf(Math.max(...frames)), n: frames.length });
        }
      }
      console.log(`T8 NFR2 ${n} leaf: ${JSON.stringify(runs.map((r) => [r.width, r.long, r.median.toFixed(1), r.max.toFixed(1), `${r.at}/${r.n}`]))}`);
      for (const width of [1440, 390]) {
        const at = runs.filter((r) => r.width === width);
        expect(median(at.map((r) => r.long)), `${width} px`).toBe(0);
        expect(median(at.map((r) => r.median)), `${width} px`).toBeLessThanOrEqual(18.2);
        expect(median(at.map((r) => r.max)), `${width} px`).toBeLessThanOrEqual(50);
      }
    });
  }
});
