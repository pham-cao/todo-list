import { defineConfig, devices } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
export default defineConfig({
  testDir: '/home/gem/src/todo_list/tests/e2e',
  outputDir: '/tmp/claude-1000/-home-gem-src-todo-list/832f85e5-a60f-4d79-a693-e0ce7014eb66/scratchpad/ff8-results',
  use: { baseURL: 'http://localhost:4173', locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' },
  projects: [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }],
});
