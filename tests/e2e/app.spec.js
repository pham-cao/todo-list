import { test, expect } from '@playwright/test';

test('page has the expected title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Việc cần làm hôm nay');
});
