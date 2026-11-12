import { test, expect } from '@playwright/test';
import { TODAY, GROUPS_KEY, task, group, open, rows, labels, hash, addTask, passMidnight, watchFlips, flipsSeen, resticksSeen } from './helpers.js';

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
