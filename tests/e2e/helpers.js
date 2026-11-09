import { expect } from '@playwright/test';

// Shared by app.spec.js and day-nav.spec.js. This file has no tests, and the default testMatch only picks *.spec.js.
export const KEY = 'daily-todo:tasks:v1';
export const TODAY = '2026-11-09';
export const NOW = new Date('2026-11-09T09:00:00+07:00');
export const AFTER_MIDNIGHT = new Date('2026-11-10T00:05:00+07:00');

export const task = (id, text, done = false, date = TODAY, createdAt = NOW.getTime()) => ({ id, text, done, createdAt, date });

// Seed once per tab so a reload shows what the app saved, not the seed again.
export async function open(page, tasks, hash = '') {
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
