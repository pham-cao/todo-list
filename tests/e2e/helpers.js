import { expect } from '@playwright/test';

// Shared by app.spec.js and day-nav.spec.js. This file has no tests, and the default testMatch only picks *.spec.js.
export const KEY = 'daily-todo:tasks:v1';
export const GROUPS_KEY = 'daily-todo:groups:v1';
export const UI_KEY = 'daily-todo:ui:v1';
export const TODAY = '2026-11-09';
export const NOW = new Date('2026-11-09T09:00:00+07:00');
export const AFTER_MIDNIGHT = new Date('2026-11-10T00:05:00+07:00');

export const task = (id, text, done = false, date = TODAY, createdAt = NOW.getTime()) => ({ id, text, done, createdAt, date });

// Seed once per tab so a reload shows what the app saved, not the seed again.
// `seed` may also hold `groups` (array) and `ui` (object), written in the same init script; a string is stored as is.
export async function open(page, tasks, hash = '', seed = {}) {
  await page.clock.setFixedTime(NOW);
  const values = [[KEY, tasks], [GROUPS_KEY, seed.groups], [UI_KEY, seed.ui]]
    .filter(([, v]) => v != null) // null or undefined: leave that key alone
    .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]);
  if (values.length) {
    await page.addInitScript((pairs) => {
      if (sessionStorage.getItem('seeded')) return;
      for (const [k, v] of pairs) localStorage.setItem(k, v);
      sessionStorage.setItem('seeded', '1');
    }, values);
  }
  await page.goto(`./${hash}`);
}

export const group = (id, name, color = 'yellow', createdAt = NOW.getTime()) => ({ id, name, color, createdAt });
export const sections = (page) => page.locator('#day-list > .group');
export const section = (page, name) => sections(page).filter({ has: page.locator('.group__name').getByText(name, { exact: true }) });
export const toggle = (page, name) => section(page, name).locator('.group__toggle');
export const storedJson = async (page, key) => JSON.parse(await page.evaluate((k) => localStorage.getItem(k), key));

export const rows = (page) => page.locator('.task-list > .task');
export const labels = (page) => rows(page).locator('.task__label');
export const progress = (page) => page.locator('.progress');
export const box = (page, i) => rows(page).nth(i).getByRole('checkbox', { name: 'Đánh dấu hoàn thành' });
export const hash = (page) => new URL(page.url()).hash;
export const storedRaw = (page) => page.evaluate((k) => localStorage.getItem(k), KEY);
export const stored = async (page) => JSON.parse(await storedRaw(page));

export async function addTask(page, text) {
  const field = page.locator('#new-task');
  await field.fill(text);
  await field.press('Enter');
}

// The drawn box sits over the hidden input, so click it the way a user does. Pass `on` to also check the result.
export async function tick(page, i, on) {
  await rows(page).nth(i).locator('.check__box').click();
  if (on === undefined) return;
  await (on ? expect(box(page, i)).toBeChecked() : expect(box(page, i)).not.toBeChecked());
}

// Move the fake clock past local midnight, then fire the event the app listens to.
export async function passMidnight(page, event = 'visibilitychange', at = AFTER_MIDNIGHT) {
  await page.clock.setFixedTime(at);
  if (event === 'focus') await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  else await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
}

// Press a row's text with the mouse and move by (dx, dy) in steps. The button stays held, so a test can look at the
// lifted state, press Escape or call page.mouse.up(). Returns the press point.
export async function mouseDrag(page, row, dx = 0, dy = 60) {
  await row.locator('.task__label').scrollIntoViewIfNeeded();
  const b = await row.locator('.task__label').boundingBox();
  const x = b.x + Math.min(b.width / 2, 60), y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  return { x, y };
}
