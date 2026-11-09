import { test, expect } from '@playwright/test';

const KEY = 'daily-todo:tasks:v1';
const TODAY = '2026-11-09';
const NOW = new Date('2026-11-09T09:00:00+07:00');

const task = (id, text, done = false, date = TODAY, createdAt = NOW.getTime()) => ({ id, text, done, createdAt, date });

async function open(page, tasks) {
  await page.clock.setFixedTime(NOW);
  if (tasks) {
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [KEY, JSON.stringify(tasks)]);
  }
  await page.goto('./');
}

const rows = (page) => page.locator('.task-list > .task');

test('page has the expected title and the date line for today', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await open(page);
  await expect(page).toHaveTitle('Việc cần làm hôm nay');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Việc cần làm hôm nay');
  await expect(page.locator('.app-header__date')).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  await expect(page.getByLabel('Bạn cần làm gì hôm nay?')).toBeFocused();
  expect(errors).toEqual([]);
});

test('shows only today\'s tasks, oldest first, with their done state and summary', async ({ page }) => {
  await open(page, [
    task('a', 'Gửi báo cáo tuần', true),
    task('old', 'Việc của hôm qua', false, '2026-11-08'),
    task('b', 'Đi chợ mua rau'),
    task('c', 'Tập yoga 30 phút', true),
  ]);
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).locator('.task__label')).toHaveText(['Gửi báo cáo tuần', 'Đi chợ mua rau', 'Tập yoga 30 phút']);
  await expect(page.getByText('Việc của hôm qua')).toHaveCount(0);
  const boxes = rows(page).getByRole('checkbox', { name: 'Đánh dấu hoàn thành' });
  await expect(boxes.nth(0)).toBeChecked();
  await expect(boxes.nth(1)).not.toBeChecked();
  await expect(boxes.nth(1)).toHaveAccessibleDescription('Đi chợ mua rau');
  await expect(rows(page).nth(1).getByRole('button', { name: 'Sửa' })).toHaveCount(1);
  await expect(rows(page).nth(1).getByRole('button', { name: 'Xóa' })).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 2/3 việc');
  await expect(page.locator('.progress')).toBeVisible();
  await expect(page.locator('.progress')).toHaveCSS('--p', '67');
  await expect(page.locator('.progress')).not.toHaveClass(/progress--complete/);
  await expect(page.locator('.empty')).toBeHidden();
  await expect(page.locator('.alert')).toBeHidden();
  await expect(page.locator('.add-form .field-error')).toBeHidden();
});

test('shows the empty state with no rows, progress or summary', async ({ page }) => {
  await open(page, [task('old', 'Việc của hôm qua', false, '2026-11-08')]);
  await expect(page.getByText('Hôm nay chưa có việc nào. Hãy thêm việc đầu tiên nhé!')).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByRole('status')).toBeHidden();
  await expect(page.locator('.progress')).toBeHidden();
  await expect(page.locator('.alert')).toBeHidden();
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('shows the star stamp without the celebration when every task is done', async ({ page }) => {
  await open(page, [task('a', 'Một', true), task('b', 'Hai', true)]);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 2/2 việc');
  await expect(page.locator('.progress')).toHaveClass(/progress--complete/);
  await expect(page.locator('.progress')).not.toHaveClass(/progress--celebrate/);
});

test('shows task text as plain text, never as markup', async ({ page }) => {
  await open(page, [task('x', '<b>abc</b>')]);
  await expect(rows(page).locator('.task__label')).toHaveText('<b>abc</b>');
  await expect(page.locator('.task-list b')).toHaveCount(0);
});
