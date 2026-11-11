import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['probe.spec.js'], workers: 1, retries: 0, outputDir: './out',
  use: { baseURL: 'http://localhost:4173', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
  webServer: { command: 'python3 -m http.server 4173', cwd: '/home/gem/src/todo_list', url: 'http://localhost:4173', reuseExistingServer: true },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel7', use: { ...devices['Pixel 7'] } },
  ],
});
