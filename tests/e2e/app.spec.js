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
