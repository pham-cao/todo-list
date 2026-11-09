import { test, expect } from '@playwright/test';

const KEY = 'daily-todo:tasks:v1';
const TODAY = '2026-11-09';
const NOW = new Date('2026-11-09T09:00:00+07:00');

const task = (id, text, done = false, date = TODAY, createdAt = NOW.getTime()) => ({ id, text, done, createdAt, date });

async function open(page, tasks) {
  await page.clock.setFixedTime(NOW);
  if (tasks) {
    // Seed once per tab so a reload shows what the app saved, not the seed again.
    await page.addInitScript(([key, value]) => {
      if (sessionStorage.getItem('seeded')) return;
      localStorage.setItem(key, value);
      sessionStorage.setItem('seeded', '1');
    }, [KEY, JSON.stringify(tasks)]);
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

const input = (page) => page.getByLabel('Bạn cần làm gì hôm nay?');
const addError = (page) => page.locator('.add-form .field-error');

test('adds a task with Thêm and Enter, keeps focus, and keeps it after reload', async ({ page }) => {
  await open(page, [task('a', 'Gửi báo cáo tuần', true)]);
  await input(page).fill('  Đi chợ mua rau 🥬  ');
  await page.getByRole('button', { name: 'Thêm' }).click();
  await expect(rows(page).locator('.task__label')).toHaveText(['Gửi báo cáo tuần', 'Đi chợ mua rau 🥬']);
  await expect(rows(page).last()).toHaveClass(/task--enter/);
  await expect(input(page)).toHaveValue('');
  await expect(input(page)).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 1/2 việc');

  await input(page).fill('Tập yoga 30 phút');
  await input(page).press('Enter');
  await expect(rows(page)).toHaveCount(3);
  await expect(input(page)).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 1/3 việc');
  await expect(page.locator('.progress')).toHaveCSS('--p', '33');

  await page.reload();
  await expect(rows(page).locator('.task__label')).toHaveText(['Gửi báo cáo tuần', 'Đi chợ mua rau 🥬', 'Tập yoga 30 phút']);
  await expect(rows(page).getByRole('checkbox').nth(1)).not.toBeChecked();
});

test('adding the first task replaces the empty state', async ({ page }) => {
  await open(page);
  await input(page).fill('Việc đầu tiên');
  await input(page).press('Enter');
  await expect(rows(page)).toHaveCount(1);
  await expect(page.locator('.empty')).toBeHidden();
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 0/1 việc');
});

test('empty or blank input shows the empty text error, and typing removes it', async ({ page }) => {
  await open(page);
  await input(page).fill('   ');
  await input(page).press('Enter');
  await expect(rows(page)).toHaveCount(0);
  await expect(addError(page)).toBeVisible();
  await expect(addError(page)).toHaveText('Vui lòng nhập nội dung công việc.');
  await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(input(page)).toHaveAccessibleDescription('Vui lòng nhập nội dung công việc.');
  await expect(input(page)).toBeFocused();
  await input(page).pressSequentially('a');
  await expect(addError(page)).toBeHidden();
  await expect(input(page)).not.toHaveAttribute('aria-invalid');
  await expect(input(page)).not.toHaveAttribute('aria-describedby');
});

test('over 200 characters shows the too long error; exactly 200 after trim is added', async ({ page }) => {
  await open(page);
  await input(page).fill('a'.repeat(201));
  await page.getByRole('button', { name: 'Thêm' }).click();
  await expect(rows(page)).toHaveCount(0);
  await expect(addError(page)).toHaveText('Nội dung tối đa 200 ký tự.');
  await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(input(page)).toHaveValue('a'.repeat(201));
  await input(page).press('Backspace');
  await expect(addError(page)).toBeHidden();
  await input(page).fill(`  ${'ệ'.normalize('NFD').repeat(200)}  `);
  await input(page).press('Enter');
  await expect(rows(page)).toHaveCount(1);
  await expect(addError(page)).toBeHidden();
});

const box = (page, i) => rows(page).nth(i).getByRole('checkbox', { name: 'Đánh dấu hoàn thành' });
// The drawn box sits over the hidden input, so click it the way a user does.
async function tick(page, i, on) {
  await rows(page).nth(i).locator('.check__box').click();
  await (on ? expect(box(page, i)).toBeChecked() : expect(box(page, i)).not.toBeChecked());
}
const stored = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), KEY);

test('ticking saves, keeps the row in place and updates the summary and ink circle', async ({ page }) => {
  await open(page, [task('a', 'Một'), task('b', 'Hai'), task('c', 'Ba')]);
  await tick(page, 0, true);
  await expect(rows(page).locator('.task__label')).toHaveText(['Một', 'Hai', 'Ba']);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 1/3 việc');
  await expect(page.locator('.progress')).toHaveCSS('--p', '33');
  expect((await stored(page)).map((t) => t.done)).toEqual([true, false, false]);
  await expect(page.locator('.progress')).not.toHaveClass(/progress--complete/);
});

test('unticking after a reload saves and keeps the order', async ({ page }) => {
  await open(page, [task('a', 'Một'), task('b', 'Hai')]);
  await tick(page, 1, true);
  await page.reload();
  await expect(box(page, 1)).toBeChecked();
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 1/2 việc');
  await tick(page, 1, false);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 0/2 việc');
  await expect(page.locator('.progress')).toHaveCSS('--p', '0');
  await page.reload();
  await expect(rows(page).locator('.task__label')).toHaveText(['Một', 'Hai']);
  await expect(box(page, 1)).not.toBeChecked();
});

test('ticking the last open task stamps the star, celebrates briefly, and unticking clears it', async ({ page }) => {
  await open(page, [task('a', 'Một', true), task('b', 'Hai')]);
  const progress = page.locator('.progress');
  await tick(page, 1, true);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 2/2 việc');
  await expect(progress).toHaveClass(/progress--complete/);
  await expect(progress).toHaveClass(/progress--celebrate/);
  await expect(progress).not.toHaveClass(/progress--celebrate/, { timeout: 2000 });
  await expect(progress).toHaveClass(/progress--complete/);

  await tick(page, 0, false);
  await expect(progress).not.toHaveClass(/progress--complete/);
  await expect(progress).not.toHaveClass(/progress--celebrate/);
  await tick(page, 0, true);
  await expect(progress).toHaveClass(/progress--celebrate/);
  await tick(page, 0, false);
  await expect(progress).not.toHaveClass(/progress--complete|progress--celebrate/);
});

test('adding a task while all are done removes the stamp', async ({ page }) => {
  await open(page, [task('a', 'Một'), task('b', 'Hai', true)]);
  await tick(page, 0, true);
  await expect(page.locator('.progress')).toHaveClass(/progress--celebrate/);
  await input(page).fill('Ba');
  await input(page).press('Enter');
  await expect(page.locator('.progress')).not.toHaveClass(/progress--complete|progress--celebrate/);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 2/3 việc');
});

const editBtn = (page, i) => rows(page).nth(i).getByRole('button', { name: 'Sửa' });
const editInput = (page) => page.getByRole('textbox', { name: 'Sửa' });
const editError = (page) => page.locator('.task__edit .field-error');
const labels = (page) => rows(page).locator('.task__label');

test('Sửa opens a prefilled, focused edit line; Lưu saves and keeps done state and position', async ({ page }) => {
  await open(page, [task('a', 'Một'), task('b', 'Hai', true), task('c', 'Ba')]);
  await editBtn(page, 1).click();
  await expect(rows(page).nth(1)).toHaveClass(/task--editing/);
  await expect(editInput(page)).toHaveValue('Hai');
  await expect(editInput(page)).toBeFocused();
  expect(await editInput(page).evaluate((el) => [el.selectionStart, el.selectionEnd])).toEqual([3, 3]);
  await expect(rows(page).nth(1).getByRole('button', { name: 'Hủy' })).toBeVisible();

  await editInput(page).fill('  Hai mươi  ');
  await rows(page).nth(1).getByRole('button', { name: 'Lưu' }).click();
  await expect(rows(page).nth(1)).not.toHaveClass(/task--editing/);
  await expect(editInput(page)).toHaveCount(0);
  await expect(labels(page)).toHaveText(['Một', 'Hai mươi', 'Ba']);
  await expect(box(page, 1)).toBeChecked();
  await expect(box(page, 1)).toHaveAccessibleDescription('Hai mươi');
  await expect(editBtn(page, 1)).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 1/3 việc');

  await editBtn(page, 2).click();
  await editInput(page).fill('Ba lần');
  await editInput(page).press('Enter');
  await expect(labels(page)).toHaveText(['Một', 'Hai mươi', 'Ba lần']);
  await expect(editBtn(page, 2)).toBeFocused();

  await page.reload();
  await expect(labels(page)).toHaveText(['Một', 'Hai mươi', 'Ba lần']);
  await expect(box(page, 1)).toBeChecked();
});

test('invalid edit text keeps edit mode with the matching error and the old saved text', async ({ page }) => {
  await open(page, [task('a', 'Một')]);
  await editBtn(page, 0).click();
  await editInput(page).fill('   ');
  await editInput(page).press('Enter');
  await expect(rows(page).nth(0)).toHaveClass(/task--editing/);
  await expect(editError(page)).toHaveText('Vui lòng nhập nội dung công việc.');
  await expect(editInput(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(editInput(page)).toHaveAccessibleDescription('Vui lòng nhập nội dung công việc.');
  await expect(editInput(page)).toBeFocused();

  await editInput(page).fill('a'.repeat(201));
  await rows(page).nth(0).getByRole('button', { name: 'Lưu' }).click();
  await expect(editError(page)).toHaveText('Nội dung tối đa 200 ký tự.');
  expect(await stored(page)).toEqual([task('a', 'Một')]);

  await editInput(page).press('Backspace');
  await expect(editError(page)).toBeHidden();
  await expect(editInput(page)).not.toHaveAttribute('aria-invalid');
  await expect(editInput(page)).not.toHaveAttribute('aria-describedby');
});

test('Hủy and Escape leave edit mode and keep the old text', async ({ page }) => {
  await open(page, [task('a', 'Một'), task('b', 'Hai')]);
  await editBtn(page, 0).click();
  await editInput(page).fill('Đổi');
  await rows(page).nth(0).getByRole('button', { name: 'Hủy' }).click();
  await expect(labels(page)).toHaveText(['Một', 'Hai']);
  await expect(rows(page).nth(0)).not.toHaveClass(/task--editing/);
  await expect(editBtn(page, 0)).toBeFocused();

  await editBtn(page, 1).click();
  await editInput(page).fill('');
  await editInput(page).press('Enter');
  await expect(editError(page)).toBeVisible();
  await editInput(page).press('Escape');
  await expect(labels(page)).toHaveText(['Một', 'Hai']);
  await expect(editInput(page)).toHaveCount(0);
  await expect(editBtn(page, 1)).toBeFocused();
});

test('only one row edits at a time, and adding and ticking still work while editing', async ({ page }) => {
  await open(page, [task('a', 'Một'), task('b', 'Hai')]);
  await editBtn(page, 0).click();
  await editInput(page).fill('Không lưu');
  await editBtn(page, 1).click();
  await expect(page.locator('.task--editing')).toHaveCount(1);
  await expect(rows(page).nth(1)).toHaveClass(/task--editing/);
  await expect(labels(page).nth(0)).toHaveText('Một');
  await expect(editInput(page)).toHaveValue('Hai');
  await expect(editInput(page)).toBeFocused();

  await tick(page, 0, true);
  await input(page).fill('Ba');
  await input(page).press('Enter');
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).nth(1)).toHaveClass(/task--editing/);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 1/3 việc');
  await editInput(page).fill('Hai mới');
  await editInput(page).press('Enter');
  await expect(labels(page)).toHaveText(['Một', 'Hai mới', 'Ba']);
});

// QA T7 additions: boundary of the 200 limit while editing, and the highlighter under mouse hover.
test('edit accepts exactly 200 characters (trimmed) and rejects 201', async ({ page }) => {
  await open(page, [task('a', 'Một')]);
  await editBtn(page, 0).click();
  await editInput(page).fill('z'.repeat(201) + '   ');
  await editInput(page).press('Enter');
  await expect(editError(page)).toHaveText('Nội dung tối đa 200 ký tự.');
  await editInput(page).fill('  ' + 'y'.repeat(200) + '  ');
  await editInput(page).press('Enter');
  await expect(rows(page).nth(0)).not.toHaveClass(/task--editing/);
  await expect(labels(page).nth(0)).toHaveText('y'.repeat(200));
});

test('the editing row keeps the highlighter wash under mouse hover', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover is a desktop pointer feature');
  await open(page, [task('a', 'Một'), task('b', 'Hai')]);
  await editBtn(page, 0).click();
  const bg = (i) => rows(page).nth(i).evaluate((el) => getComputedStyle(el).backgroundImage);
  await rows(page).nth(1).hover();
  const hovered = await bg(1);
  await rows(page).nth(0).hover({ position: { x: 300, y: 15 } });
  const editing = await bg(0);
  expect(editing).toContain('250, 214, 72');
  expect(editing).not.toBe(hovered);
});

const removeBtn = (page, i) => rows(page).nth(i).getByRole('button', { name: 'Xóa' });
const delDialog = (page) => page.getByRole('alertdialog', { name: 'Bạn có chắc muốn xóa việc này không?' });

test('Xóa opens the sticky note with the task quoted and focus on Giữ lại', async ({ page }) => {
  await open(page, [task('a', 'Một'), task('x', '<b>abc</b>')]);
  await expect(delDialog(page)).toBeHidden();
  await removeBtn(page, 1).click();
  await expect(delDialog(page)).toBeVisible();
  await expect(delDialog(page)).toHaveAccessibleDescription('<b>abc</b>');
  await expect(page.locator('.dialog__quote b')).toHaveCount(0);
  await expect(delDialog(page).getByRole('button', { name: 'Giữ lại' })).toBeFocused();
  await expect(delDialog(page).getByRole('button', { name: 'Xóa việc' })).toBeVisible();
});

test('Giữ lại, Escape and a backdrop click keep the task and return focus to Xóa', async ({ page }) => {
  await open(page, [task('a', 'Một'), task('b', 'Hai')]);
  const exits = [
    () => delDialog(page).getByRole('button', { name: 'Giữ lại' }).click(),
    () => page.keyboard.press('Escape'),
    () => page.mouse.click(page.viewportSize().width - 3, page.viewportSize().height - 3),
  ];
  for (const exit of exits) {
    await removeBtn(page, 1).click();
    await expect(delDialog(page)).toBeVisible();
    await exit();
    await expect(delDialog(page)).toBeHidden();
    await expect(removeBtn(page, 1)).toBeFocused();
    await expect(labels(page)).toHaveText(['Một', 'Hai']);
  }
  // A click on the note itself (its padding) does not close it.
  await removeBtn(page, 0).click();
  await page.locator('.dialog__title').click();
  await expect(delDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  expect((await stored(page)).map((t) => t.id)).toEqual(['a', 'b']);
});

test('Xóa việc removes the task, saves, updates the summary and moves focus on', async ({ page }) => {
  await open(page, [task('a', 'Một', true), task('b', 'Hai'), task('c', 'Ba')]);
  const confirm = () => delDialog(page).getByRole('button', { name: 'Xóa việc' }).click();

  await removeBtn(page, 1).click();
  await confirm();
  await expect(delDialog(page)).toBeHidden();
  await expect(labels(page)).toHaveText(['Một', 'Ba']);
  await expect(box(page, 1)).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 1/2 việc');
  expect((await stored(page)).map((t) => t.id)).toEqual(['a', 'c']);

  // Last row: focus falls back to the previous row's checkbox.
  await removeBtn(page, 1).click();
  await confirm();
  await expect(labels(page)).toHaveText(['Một']);
  await expect(box(page, 0)).toBeFocused();
  // Only done tasks remain: the stamp shows without the celebration.
  await expect(page.locator('.progress')).toHaveClass(/progress--complete/);
  await expect(page.locator('.progress')).not.toHaveClass(/progress--celebrate/);

  // Only row: the empty state returns and focus goes to the add input.
  await removeBtn(page, 0).click();
  await confirm();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByText('Hôm nay chưa có việc nào. Hãy thêm việc đầu tiên nhé!')).toBeVisible();
  await expect(page.getByRole('status')).toBeHidden();
  await expect(input(page)).toBeFocused();
  await page.reload();
  await expect(rows(page)).toHaveCount(0);
});

test('deleting a row while another row is being edited keeps that edit open', async ({ page }) => {
  await open(page, [task('a', 'Một'), task('b', 'Hai')]);
  await editBtn(page, 0).click();
  await editInput(page).fill('Một mới');
  await removeBtn(page, 1).click();
  await delDialog(page).getByRole('button', { name: 'Xóa việc' }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(editInput(page)).toHaveValue('Một mới');
  await editInput(page).press('Enter');
  await expect(labels(page)).toHaveText(['Một mới']);
});

test('the sticky note sits in the middle of the viewport', async ({ page }) => {
  await open(page, [task('a', 'Một')]);
  await removeBtn(page, 0).click();
  await expect(delDialog(page)).toBeVisible();
  await expect(page.locator('.dialog')).toHaveCSS('opacity', '1'); // note-in finished
  const box = await page.locator('.dialog').boundingBox();
  const vp = page.viewportSize();
  expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThan(4);
  expect(Math.abs(box.y + box.height / 2 - vp.height / 2)).toBeLessThan(8);
});

// Phone row actions (T9)
const HINT = 'daily-todo:swipe-hint-seen';
const swipe = (page, i) => rows(page).nth(i).locator('.task__swipe');
const scrollLeft = (page, i) => swipe(page, i).evaluate((el) => el.scrollLeft);
const countPeeks = (page) => page.addInitScript(() => {
  window.__peeks = 0;
  document.addEventListener('animationstart', (e) => { if (e.animationName === 'peek') window.__peeks++; });
});

test('the first row peeks once on a phone, and not again after a reload', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await countPeeks(page);
  await open(page, [task('a', 'Một'), task('b', 'Hai')]);
  await expect(rows(page).nth(0)).toHaveClass(/task--peek/);
  await expect(rows(page).nth(1)).not.toHaveClass(/task--peek/);
  await expect.poll(() => page.evaluate(() => window.__peeks)).toBeGreaterThan(0);
  await expect(rows(page).nth(0)).not.toHaveClass(/task--peek/, { timeout: 4000 });
  expect(await page.evaluate((k) => localStorage.getItem(k), HINT)).toBe('1');
  expect(await scrollLeft(page, 0)).toBe(0);

  await page.reload();
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(0)).not.toHaveClass(/task--peek/);
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => window.__peeks)).toBe(0);
});

test('the peek waits for the first task, and only plays once', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await open(page);
  expect(await page.evaluate((k) => localStorage.getItem(k), HINT)).toBeNull();
  await input(page).fill('Một');
  await input(page).press('Enter');
  await expect(rows(page).nth(0)).toHaveClass(/task--peek/);
  await expect(rows(page).nth(0)).not.toHaveClass(/task--peek/, { timeout: 4000 });
  await input(page).fill('Hai');
  await input(page).press('Enter');
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(0)).not.toHaveClass(/task--peek/);
});

test('under reduced motion the peek is skipped but remembered', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await countPeeks(page);
  await open(page, [task('a', 'Một')]);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).nth(0)).not.toHaveClass(/task--peek/);
  expect(await page.evaluate((k) => localStorage.getItem(k), HINT)).toBe('1');
  expect(await page.evaluate(() => window.__peeks)).toBe(0);
});

test('the desktop layout never peeks', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout only');
  await open(page, [task('a', 'Một')]);
  await expect(rows(page).nth(0)).not.toHaveClass(/task--peek/);
  expect(await page.evaluate((k) => localStorage.getItem(k), HINT)).toBeNull();
});

test('only one row stays swiped open; a tap elsewhere closes it', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await page.addInitScript((k) => localStorage.setItem(k, '1'), HINT);
  await open(page, [task('a', 'Một'), task('b', 'Hai'), task('c', 'Ba')]);
  await swipe(page, 0).evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect.poll(() => scrollLeft(page, 0)).toBeGreaterThan(100);
  expect(await swipe(page, 0).evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(130);
  await expect(editBtn(page, 0)).toBeInViewport();

  await swipe(page, 1).evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await expect.poll(() => scrollLeft(page, 0)).toBe(0);
  expect(await scrollLeft(page, 1)).toBeGreaterThan(100);

  await page.locator('.app-header__title').tap();
  await expect.poll(() => scrollLeft(page, 1)).toBe(0);
});

test('Tab to Sửa scrolls the row open; Giữ lại leaves only that row open', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await page.addInitScript((k) => localStorage.setItem(k, '1'), HINT);
  await open(page, [task('a', 'Một'), task('b', 'Hai')]);
  await box(page, 0).focus();
  await page.keyboard.press('Tab');
  await expect(editBtn(page, 0)).toBeFocused();
  await expect.poll(() => scrollLeft(page, 0)).toBeGreaterThan(0);
  await expect(editBtn(page, 0)).toBeInViewport({ ratio: 1 });

  // Moving on to the next row closes this one.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(box(page, 1)).toBeFocused();
  await expect.poll(() => scrollLeft(page, 0)).toBe(0);

  // Delete, then keep: the dialog closes the row behind it, and focus returning to Xóa reopens only that row.
  await removeBtn(page, 1).click();
  await expect(delDialog(page)).toBeVisible();
  await expect.poll(() => scrollLeft(page, 1)).toBe(0);
  await delDialog(page).getByRole('button', { name: 'Giữ lại' }).click();
  await expect(removeBtn(page, 1)).toBeFocused();
  await expect(removeBtn(page, 1)).toBeInViewport({ ratio: 1 });
  expect(await scrollLeft(page, 0)).toBe(0);
  await page.locator('.app-header__title').tap();
  await expect.poll(() => scrollLeft(page, 1)).toBe(0);
});

test('no horizontal page scroll at 360 px with a long task', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await page.setViewportSize({ width: 360, height: 780 });
  await open(page, [task('a', 'Chuẩn bị slide cho buổi họp dự án sáng thứ Tư: tổng hợp số liệu tháng 10, cập nhật tiến độ và danh sách rủi ro'), task('b', 'x'.repeat(200))]);
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(0)).not.toHaveClass(/task--peek/, { timeout: 4000 });
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll).toBeLessThanOrEqual(client);
  for (const btn of [editBtn(page, 0), removeBtn(page, 0)]) {
    const b = await btn.boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
});

// Real touch drag (CDP) so the browser's own scroller and snap logic run, not a scrollLeft assignment.
async function touchDrag(page, locator, dx) {
  const b = await locator.boundingBox();
  const y = b.y + b.height / 2, x0 = b.x + b.width - 30;
  const cdp = await page.context().newCDPSession(page);
  const send = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await send('touchStart', x0);
  for (let i = 1; i <= 10; i++) { await send('touchMove', x0 + (dx * i) / 10); await page.waitForTimeout(16); }
  await send('touchEnd', x0 + dx);
  await cdp.detach();
}

test('a real swipe opens one row; swiping another closes it; a tap outside closes all', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await page.addInitScript((k) => localStorage.setItem(k, '1'), HINT);
  await open(page, [task('a', 'Một'), task('b', 'Hai'), task('c', 'Ba')]);
  await touchDrag(page, swipe(page, 0), -200);
  await expect.poll(() => scrollLeft(page, 0)).toBeGreaterThan(100);
  await touchDrag(page, swipe(page, 1), -200);
  await expect.poll(() => scrollLeft(page, 1)).toBeGreaterThan(100);
  await expect.poll(() => scrollLeft(page, 0)).toBe(0);
  expect(await scrollLeft(page, 2)).toBe(0);
  await page.locator('.app-header__title').tap();
  await expect.poll(() => scrollLeft(page, 1)).toBe(0);
});

// Storage unavailable slip (R26, R27)
const slip = (page) => page.getByRole('alert').filter({ hasText: 'Không thể lưu dữ liệu trên trình duyệt này.' });

test('a blocked save shows the slip, the app keeps working in memory, and the next good save hides it', async ({ page }) => {
  await page.addInitScript(() => {
    const real = Storage.prototype.setItem;
    window.blockSaves = true;
    Storage.prototype.setItem = function (...args) {
      if (window.blockSaves) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return real.apply(this, args);
    };
  });
  await open(page);
  await expect(slip(page)).toBeHidden();

  await input(page).fill('Một');
  await input(page).press('Enter');
  await expect(slip(page)).toBeVisible();
  await input(page).fill('Hai');
  await input(page).press('Enter');
  await expect(labels(page)).toHaveText(['Một', 'Hai']);
  await tick(page, 0, true);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 1/2 việc');
  await expect(slip(page)).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBeNull();

  await page.evaluate(() => { window.blockSaves = false; });
  await tick(page, 1, true);
  await expect(slip(page)).toBeHidden();
  expect((await stored(page)).map((t) => [t.text, t.done])).toEqual([['Một', true], ['Hai', true]]);
});

test('a throwing localStorage shows the slip on load for the whole session; add, tick, edit and delete still work', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await open(page);
  await expect(slip(page)).toBeVisible();
  await expect(page.getByText('Hôm nay chưa có việc nào. Hãy thêm việc đầu tiên nhé!')).toBeVisible();

  await input(page).fill('Một');
  await input(page).press('Enter');
  await input(page).fill('Hai');
  await input(page).press('Enter');
  await tick(page, 0, true);
  await editBtn(page, 1).click();
  await editInput(page).fill('Hai đã sửa');
  await editInput(page).press('Enter');
  await expect(labels(page)).toHaveText(['Một', 'Hai đã sửa']);
  await removeBtn(page, 0).click();
  await delDialog(page).getByRole('button', { name: 'Xóa việc' }).click();
  await expect(labels(page)).toHaveText(['Hai đã sửa']);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 0/1 việc');
  await expect(slip(page)).toBeVisible();
  expect(errors).toEqual([]);
});

test('corrupt stored data starts an empty list with no slip and no console error, and keeps a backup', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((key) => {
    if (!sessionStorage.getItem('seeded')) localStorage.setItem(key, '{not json');
    sessionStorage.setItem('seeded', '1');
  }, KEY);
  await open(page);
  await expect(page.getByText('Hôm nay chưa có việc nào. Hãy thêm việc đầu tiên nhé!')).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(slip(page)).toBeHidden();
  expect(await page.evaluate((key) => localStorage.getItem(`${key}:corrupt`), KEY)).toBe('{not json');

  await input(page).fill('Một');
  await input(page).press('Enter');
  await expect(slip(page)).toBeHidden();
  expect((await stored(page)).map((t) => t.text)).toEqual(['Một']);
  expect(errors).toEqual([]);
});

test('after a failed first read nothing is written to the tasks key, so earlier days are never overwritten', async ({ page }) => {
  const seed = JSON.stringify([task('a', 'Một'), task('o', 'Hôm qua', false, '2026-11-08')]);
  await page.addInitScript(([key, value]) => {
    if (!sessionStorage.getItem('seeded')) { localStorage.setItem(key, value); sessionStorage.setItem('seeded', '1'); }
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    window.rawGet = (k) => get.call(localStorage, k);
    window.writes = [];
    Storage.prototype.getItem = function (k) { if (k === key) throw new Error('read failed'); return get.call(this, k); };
    Storage.prototype.setItem = function (k, v) { window.writes.push(k); return set.call(this, k, v); };
  }, [KEY, seed]);
  await open(page);
  await expect(slip(page)).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await input(page).fill('Mới');
  await input(page).press('Enter');
  await tick(page, 0, true);
  await expect(labels(page)).toHaveText(['Mới']);
  await expect(slip(page)).toBeVisible();
  expect(await page.evaluate(() => window.writes.filter((k) => k === 'daily-todo:tasks:v1'))).toEqual([]);
  expect(await page.evaluate((key) => window.rawGet(key), KEY)).toBe(seed);
});

test('the slip shows at once when a save fails on edit and on delete, and quota errors keep the stored value', async ({ page }) => {
  await page.addInitScript(() => {
    const real = Storage.prototype.setItem;
    window.blockSaves = false;
    Storage.prototype.setItem = function (...a) {
      if (window.blockSaves) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return real.apply(this, a);
    };
  });
  await open(page, [task('a', 'Một'), task('b', 'Hai')]);
  await expect(slip(page)).toBeHidden();
  await page.evaluate(() => { window.blockSaves = true; });
  await editBtn(page, 1).click();
  await editInput(page).fill('Hai sửa');
  await editInput(page).press('Enter');
  await expect(slip(page)).toBeVisible();
  await expect(labels(page)).toHaveText(['Một', 'Hai sửa']);
  await page.evaluate(() => { window.blockSaves = false; });
  await tick(page, 0, true);
  await expect(slip(page)).toBeHidden();
  await page.evaluate(() => { window.blockSaves = true; });
  await removeBtn(page, 0).click();
  await delDialog(page).getByRole('button', { name: 'Xóa việc' }).click();
  await expect(slip(page)).toBeVisible();
  await expect(labels(page)).toHaveText(['Hai sửa']);
  expect((await stored(page)).map((t) => t.text)).toEqual(['Một', 'Hai sửa']);
});

// Other non array shapes are covered in tests/unit/store.test.js.
test('a stored non array value starts an empty list with no slip and no error', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([key, v]) => {
    if (!sessionStorage.getItem('seeded')) localStorage.setItem(key, v);
    sessionStorage.setItem('seeded', '1');
  }, [KEY, '{"a":1}']);
  await open(page);
  await expect(page.getByText('Hôm nay chưa có việc nào. Hãy thêm việc đầu tiên nhé!')).toBeVisible();
  await expect(slip(page)).toBeHidden();
  expect(errors).toEqual([]);
});

const AFTER_MIDNIGHT = new Date('2026-11-10T00:05:00+07:00');
const becomeVisible = (page) => page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

test('after midnight, returning to the page shows the new date and an empty list; yesterday stays stored', async ({ page }) => {
  await open(page, [task('a', 'Gửi báo cáo tuần'), task('b', 'Đi chợ mua rau', true)]);
  await expect(rows(page)).toHaveCount(2);
  await page.clock.setFixedTime(AFTER_MIDNIGHT);
  await becomeVisible(page);
  await expect(page.locator('.app-header__date')).toHaveText('Hôm nay, Thứ Ba, 10/11/2026');
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator('.empty')).toBeVisible();
  await expect(page.locator('.progress')).toBeHidden();
  await expect(page.locator('.summary')).toBeHidden();
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  expect(stored.map((t) => [t.id, t.date])).toEqual([['a', TODAY], ['b', TODAY]]);
});

test('window focus also checks the day, and nothing changes on the same day', async ({ page }) => {
  await open(page, [task('a', 'Gửi báo cáo tuần')]);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(rows(page)).toHaveCount(1);
  await page.clock.setFixedTime(AFTER_MIDNIGHT);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.app-header__date')).toHaveText('Hôm nay, Thứ Ba, 10/11/2026');
  await expect(rows(page)).toHaveCount(0);
});

test('adding right after midnight saves the task to the new day on a fresh list', async ({ page }) => {
  await open(page, [task('a', 'Gửi báo cáo tuần')]);
  await page.clock.setFixedTime(AFTER_MIDNIGHT);
  await page.getByLabel('Bạn cần làm gì hôm nay?').fill('Việc ngày mới');
  await page.getByLabel('Bạn cần làm gì hôm nay?').press('Enter');
  await expect(page.locator('.app-header__date')).toHaveText('Hôm nay, Thứ Ba, 10/11/2026');
  await expect(rows(page).locator('.task__label')).toHaveText(['Việc ngày mới']);
  await expect(page.getByRole('status')).toHaveText('Đã hoàn thành 0/1 việc');
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  expect(stored.map((t) => [t.text, t.date])).toEqual([['Gửi báo cáo tuần', TODAY], ['Việc ngày mới', '2026-11-10']]);
});

test('a day change drops an open edit and closes the delete note without saving or deleting', async ({ page }) => {
  await open(page, [task('a', 'Gửi báo cáo tuần'), task('b', 'Đi chợ mua rau')]);
  await rows(page).nth(0).getByRole('button', { name: 'Sửa' }).click();
  await page.locator('.task__edit .input').fill('Chưa lưu');
  await rows(page).nth(1).getByRole('button', { name: 'Xóa' }).click();
  await expect(page.locator('#delete-dialog')).toBeVisible();
  await page.clock.setFixedTime(AFTER_MIDNIGHT);
  await becomeVisible(page);
  await expect(page.locator('#delete-dialog')).toBeHidden();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.locator('.task__edit')).toHaveCount(0);
  await expect(page.getByLabel('Bạn cần làm gì hôm nay?')).toBeFocused();
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
  expect(stored.map((t) => t.text)).toEqual(['Gửi báo cáo tuần', 'Đi chợ mua rau']);
  // The new day works normally afterwards.
  await page.getByLabel('Bạn cần làm gì hôm nay?').fill('Việc ngày mới');
  await page.getByLabel('Bạn cần làm gì hôm nay?').press('Enter');
  await expect(rows(page)).toHaveCount(1);
});

test('a day change does not replay the celebration or the swipe hint', async ({ page }) => {
  await open(page, [task('a', 'Gửi báo cáo tuần'), task('n', 'Việc ngày mai', true, '2026-11-10')]);
  await rows(page).first().locator('.check__box').click();
  await expect(page.locator('.progress')).toHaveClass(/progress--celebrate/);
  await page.clock.setFixedTime(AFTER_MIDNIGHT);
  await becomeVisible(page);
  await expect(rows(page).locator('.task__label')).toHaveText(['Việc ngày mai']);
  await expect(page.locator('.progress')).toHaveClass(/progress--complete/);
  await expect(page.locator('.progress')).not.toHaveClass(/progress--celebrate/);
  await expect(page.locator('.task--peek')).toHaveCount(0);
});

test('the day boundary is local midnight: 23:59:59.999 stays, 00:00:00 switches (Asia/Ho_Chi_Minh)', async ({ page }) => {
  await open(page, [task('a', 'Gửi báo cáo tuần')]);
  await page.clock.setFixedTime(new Date('2026-11-09T23:59:59.999+07:00'));
  await becomeVisible(page);
  await expect(page.locator('.app-header__date')).toHaveText('Hôm nay, Thứ Hai, 09/11/2026');
  await expect(rows(page)).toHaveCount(1);
  await page.clock.setFixedTime(new Date('2026-11-10T00:00:00+07:00'));
  await becomeVisible(page);
  await expect(page.locator('.app-header__date')).toHaveText('Hôm nay, Thứ Ba, 10/11/2026');
  await expect(rows(page)).toHaveCount(0);
});

test('a session with blocked storage still switches day, keeps the slip and accepts a new task', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await open(page);
  await input(page).fill('Một');
  await input(page).press('Enter');
  await expect(rows(page)).toHaveCount(1);
  await page.clock.setFixedTime(AFTER_MIDNIGHT);
  await becomeVisible(page);
  await expect(page.locator('.app-header__date')).toHaveText('Hôm nay, Thứ Ba, 10/11/2026');
  await expect(rows(page)).toHaveCount(0);
  await expect(slip(page)).toBeVisible();
  await input(page).fill('Hai');
  await input(page).press('Enter');
  await expect(rows(page).locator('.task__label')).toHaveText(['Hai']);
});

// T12: keyboard, names and performance (R28, NFR1).
test('keyboard only: add, tick with Space, edit with Enter, cancel with Escape, save and delete', async ({ page }) => {
  await page.addInitScript((k) => localStorage.setItem(k, '1'), HINT);
  await open(page);
  const kb = page.keyboard;
  const focused = (name, role = 'button') => expect(page.getByRole(role, { name, exact: true }).first()).toBeFocused();

  await expect(input(page)).toBeFocused();
  await kb.type('Gọi điện cho mẹ');
  await kb.press('Enter');
  await expect(labels(page)).toHaveText(['Gọi điện cho mẹ']);
  await expect(input(page)).toBeFocused();

  await kb.press('Tab'); // Thêm
  await focused('Thêm');
  await kb.press('Tab');
  await expect(box(page, 0)).toBeFocused();
  await kb.press('Space');
  await expect(box(page, 0)).toBeChecked();
  await expect(page.locator('#summary')).toHaveText('Đã hoàn thành 1/1 việc');

  await kb.press('Tab');
  await expect(editBtn(page, 0)).toBeFocused();
  await kb.press('Enter');
  await expect(editInput(page)).toBeFocused();
  await kb.type(' tối nay');
  await kb.press('Escape');
  await expect(editInput(page)).toHaveCount(0);
  await expect(labels(page)).toHaveText(['Gọi điện cho mẹ']);
  await expect(editBtn(page, 0)).toBeFocused();

  await kb.press('Enter');
  await kb.type(' tối nay');
  await kb.press('Enter');
  await expect(labels(page)).toHaveText(['Gọi điện cho mẹ tối nay']);
  await expect(editBtn(page, 0)).toBeFocused();
  await expect(box(page, 0)).toBeChecked();

  await kb.press('Tab');
  await expect(removeBtn(page, 0)).toBeFocused();
  await kb.press('Enter');
  await expect(delDialog(page)).toBeVisible();
  await focused('Giữ lại');
  await kb.press('Tab');
  await focused('Xóa việc');
  await kb.press('Enter');
  await expect(rows(page)).toHaveCount(0);
  await expect(input(page)).toBeFocused();
  expect(await stored(page)).toEqual([]);
});

test('every button and checkbox has its Vietnamese accessible name', async ({ page }) => {
  await open(page, [task('a', 'Một'), task('b', 'Hai')]);
  // Hidden controls (the note's buttons, a row's line while it edits) have no name until shown, so check each state.
  const namesOf = (scope) => scope.locator('button:visible, input[type="checkbox"]').evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent.trim()));
  const expectNamed = async (scope, expected) => {
    const names = await namesOf(scope);
    expect(names).toEqual(expected);
    const controls = scope.locator('button:visible, input[type="checkbox"]');
    for (let i = 0; i < names.length; i++) await expect(controls.nth(i)).toHaveAccessibleName(names[i]);
  };
  await expectNamed(page.locator('main'), ['Xem ngày trước', 'Xem ngày sau', 'Về hôm nay', 'Thêm', 'Đánh dấu hoàn thành', 'Sửa', 'Xóa', 'Đánh dấu hoàn thành', 'Sửa', 'Xóa']);
  // The row text is the description, so a screen reader hears which task each control is for.
  await expect(box(page, 0)).toHaveAccessibleDescription('Một');
  await expect(removeBtn(page, 1)).toHaveAccessibleDescription('Hai');

  await editBtn(page, 1).click();
  await expectNamed(rows(page).nth(1), ['Đánh dấu hoàn thành', 'Hủy', 'Lưu']);
  await expect(editInput(page)).toHaveAccessibleName('Sửa');
  await page.keyboard.press('Escape');

  await removeBtn(page, 0).click();
  await expectNamed(delDialog(page), ['Giữ lại', 'Xóa việc']);
});

test('200 tasks render quickly and a tick updates in under 100 ms', async ({ page }) => {
  const many = Array.from({ length: 200 }, (_, i) => task(`t${i}`, `Việc số ${i + 1}: ${'chữ '.repeat(i % 30)}`.trim(), i % 3 === 0));
  const start = Date.now();
  await open(page, many);
  await expect(rows(page)).toHaveCount(200);
  expect(Date.now() - start).toBeLessThan(1000);
  await expect(page.locator('#summary')).toHaveText('Đã hoàn thành 67/200 việc');
  // setFixedTime fakes Date only; performance.now() keeps running, so time the tick in the page.
  const tickMs = await page.evaluate(() => new Promise((r) => {
    const t0 = performance.now();
    document.querySelectorAll('.check input')[151].click();
    requestAnimationFrame(() => setTimeout(() => r(performance.now() - t0)));
  }));
  expect(tickMs).toBeLessThan(100);
  await expect(page.locator('#summary')).toHaveText('Đã hoàn thành 68/200 việc');
  expect((await stored(page)).find((t) => t.id === 't151').done).toBe(true);
});
