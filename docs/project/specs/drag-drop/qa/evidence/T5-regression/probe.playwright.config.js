import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['probe.spec.js','dbg.spec.js'], workers: 1, retries: 0,
  outputDir: './out',
  use: { baseURL: 'http://localhost:4173', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
  projects: [
    { name: 'pixel7', use: { ...devices['Pixel 7'] } },
    { name: 'p360', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } } },
    { name: 'p390', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'p390dark', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, colorScheme: 'dark' } },
  ],
});
