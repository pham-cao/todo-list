import { test, expect } from '@playwright/test';
import { open, task, group, rows, tick, section, toggle, mouseDrag, KEY, GROUPS_KEY, UI_KEY } from './helpers.js';

// drag-drop T3: mouse pick up, slip, strip and cancel. Every release is a cancel until T4 adds the drop.
const GROUPS = [group('cty', 'Công ty', 'yellow', 1), group('nha', 'Nhà', 'pink', 2), group('sk', 'Sức khỏe', 'blue', 3)];
const TASKS = [
  { ...task('a', 'Gửi báo cáo', true, undefined, 10), groupId: 'cty' },
  { ...task('b', 'Trả lời email', false, undefined, 20), groupId: 'cty' },
  { ...task('c', 'Tiền điện', false, undefined, 30), groupId: 'nha' },
  task('d', 'Cắt tóc', false, undefined, 40),
];
const seed = (page, tasks = TASKS, groups = GROUPS) => open(page, tasks, '', { groups });
const row = (page, text) => rows(page).filter({ hasText: text });
const dragging = (page) => page.evaluate(() => document.documentElement.classList.contains('is-dragging'));
const rawAll = (page) => page.evaluate((keys) => keys.map((k) => localStorage.getItem(k)), [KEY, GROUPS_KEY, UI_KEY]);
const slip = (page) => page.locator('body > .drag-slip');
const strip = (page) => page.getByRole('group', { name: 'Thả vào nhóm' });
const leftovers = (page) => page.locator('.drag-slip, .drop-strip, .drag-edge, .task--placeholder, html.is-dragging');

test.describe('mouse', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse and pen: desktop project');

  test('a click on a row changes nothing and a tick still works', async ({ page }) => {
    await seed(page);
    const before = await rawAll(page);
    await row(page, 'Trả lời email').locator('.task__label').click();
    expect(await dragging(page)).toBe(false);
    expect(await rawAll(page)).toEqual(before);
    await tick(page, 1, true);
    await expect(leftovers(page)).toHaveCount(0);
  });

  test('about 6 px starts a drag: 4 px does not, 8 px does; pen too; a secondary button or second pointer never', async ({ page }) => {
    await seed(page);
    const r = row(page, 'Trả lời email');
    await mouseDrag(page, r, 4, 0);
    expect(await dragging(page)).toBe(false);
    await page.mouse.up();
    await mouseDrag(page, r, 8, 0);
    expect(await dragging(page)).toBe(true);
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);

    // Synthetic pen and right button presses (Playwright's mouse is always "mouse").
    const press = (pointerType, button, id, dy) => page.evaluate(({ pointerType, button, id, dy }) => {
      const el = [...document.querySelectorAll('.task__label')].find((l) => l.textContent === 'Trả lời email');
      const { x, y } = el.getBoundingClientRect();
      const opts = { bubbles: true, pointerId: id, pointerType, button, buttons: 1, isPrimary: true, clientX: x + 5, clientY: y + 5 };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new PointerEvent('pointermove', { ...opts, clientY: y + 5 + dy }));
      return document.documentElement.classList.contains('is-dragging');
    }, { pointerType, button, id, dy });
    const up = (id) => page.evaluate((id) => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: id })), id);
    expect(await press('pen', 0, 7, 20)).toBe(true);
    // A second press while one drag runs is ignored (R17): the first slip stays the only one.
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.task__label')].find((l) => l.textContent === 'Cắt tóc');
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 8, pointerType: 'mouse', button: 0, isPrimary: true }));
    });
    await expect(slip(page)).toHaveCount(1);
    await expect(page.locator('.task--placeholder .task__label')).toHaveText('Trả lời email');
    await up(7);
    await expect(leftovers(page)).toHaveCount(0);
    expect(await press('mouse', 2, 9, 20)).toBe(false);
    await up(9);
  });

  test('a press on the tick box, Sửa, Xóa, a section toggle or an edit field never starts a drag', async ({ page }) => {
    await seed(page);
    const r = row(page, 'Trả lời email');
    const from = async (loc, esc = false) => {
      await r.hover();
      const b = await loc.boundingBox();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 + 20, b.y + b.height / 2 + 20, { steps: 5 });
      expect(await dragging(page)).toBe(false);
      await page.mouse.up();
      if (esc) await page.keyboard.press('Escape'); // closes a delete note a release may have opened
    };
    await from(r.locator('.check__box'));
    await from(r.getByRole('button', { name: 'Xóa' }), true);
    await from(toggle(page, 'Nhà'));
    await from(r.getByRole('button', { name: 'Sửa' }));
    if (!(await r.locator('.task__edit').count())) await r.getByRole('button', { name: 'Sửa' }).click();
    await from(r.locator('.task__edit .input'));
    await from(r.locator('.task__edit select'));
    await expect(leftovers(page)).toHaveCount(0);
  });

  test('no drag while a row is in edit, while the delete note is open, or with no group stored', async ({ page }) => {
    await seed(page);
    await row(page, 'Cắt tóc').getByRole('button', { name: 'Sửa' }).click();
    await mouseDrag(page, row(page, 'Trả lời email'));
    expect(await dragging(page)).toBe(false);
    await page.mouse.up();
    await page.getByRole('button', { name: 'Hủy' }).click();
    await expect(page.locator('.task--editing')).toHaveCount(0);

    await row(page, 'Cắt tóc').hover();
    await row(page, 'Cắt tóc').getByRole('button', { name: 'Xóa' }).click();
    await expect(page.locator('#delete-dialog')).toBeVisible();
    await page.evaluate(() => { // the modal note makes the page inert, so press the row from script
      const el = document.querySelector('.task__label');
      const o = { bubbles: true, pointerId: 3, pointerType: 'mouse', button: 0, isPrimary: true, clientX: 0, clientY: 0 };
      el.dispatchEvent(new PointerEvent('pointerdown', o));
      el.dispatchEvent(new PointerEvent('pointermove', { ...o, clientY: 40 }));
      window.dispatchEvent(new PointerEvent('pointerup', o));
    });
    expect(await dragging(page)).toBe(false);
    await page.keyboard.press('Escape');
    await expect(page.locator('#delete-dialog')).toBeHidden();
  });

  test('no drag on a day with no group stored (R35)', async ({ page }) => {
    await open(page, [task('x', 'Một'), task('y', 'Hai')]);
    await mouseDrag(page, rows(page).first());
    expect(await dragging(page)).toBe(false);
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);
  });

  test('no drag while an IME is composing; it works again after the composition ends', async ({ page }) => {
    await seed(page);
    await page.evaluate(() => document.querySelector('#new-task').dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
    await mouseDrag(page, row(page, 'Tiền điện'));
    expect(await dragging(page)).toBe(false);
    await page.mouse.up();
    await page.evaluate(() => document.querySelector('#new-task').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    await mouseDrag(page, row(page, 'Tiền điện'));
    expect(await dragging(page)).toBe(true);
    await page.mouse.up();
  });

  test('lifted: placeholder, plain text slip, strip with every group in order and the own group faded', async ({ page }) => {
    const tasks = [...TASKS, { ...task('e', '<b>abc</b>', false, undefined, 50), groupId: 'cty' }];
    await seed(page, tasks, [...GROUPS, group('x', '<i>x</i> "q"', 'green', 4)]);
    const attrs = () => page.evaluate(() => [...document.querySelectorAll('.task')].map((r) =>
      [...r.attributes].filter((a) => a.name !== 'class').map((a) => `${a.name}=${a.value}`).join(' ')));
    const restAttrs = await attrs();
    const r = row(page, '<b>abc</b>');
    const box = await r.boundingBox();
    await mouseDrag(page, r, 30, -120);

    expect(await dragging(page)).toBe(true);
    await expect(r).toHaveClass(/task--placeholder/);
    expect((await r.boundingBox()).height).toBe(box.height); // the list does not jump
    await expect(slip(page)).toHaveAttribute('aria-hidden', 'true');
    await expect(slip(page).locator('.drag-slip__text')).toHaveText('<b>abc</b>');
    expect(await slip(page).locator('.drag-slip__text *').count()).toBe(0);
    await expect(strip(page)).toBeVisible();
    await expect(strip(page).locator('.drop-strip__label')).toHaveText('Thả vào nhóm');
    const targets = strip(page).locator('.drop-target');
    await expect(targets).toHaveText(['Công ty', 'Nhà', 'Sức khỏe', '<i>x</i> "q"', 'Chưa phân nhóm']);
    expect(await strip(page).locator('.sticker *').count()).toBe(0);
    await expect(targets.first()).toHaveClass(/drop-target--home/);
    await expect(strip(page).locator('.drop-target--home')).toHaveCount(1);
    expect(await targets.evaluateAll((ts) => ts.map((t) => t.dataset.color))).toEqual(['yellow', 'pink', 'blue', 'green', 'none']);
    // Inside the screen, no tab stop, no new row attribute, no aria-grabbed (R9, R10, R26).
    const sb = await strip(page).boundingBox();
    const vp = page.viewportSize();
    expect(sb.y + sb.height).toBeLessThanOrEqual(vp.height);
    expect(await page.locator('.drop-strip [tabindex], .drop-strip a, .drop-strip button').count()).toBe(0);
    expect(await attrs()).toEqual(restAttrs);
    // No selection, no context menu, grabbing hand (R7, R27).
    expect(await page.evaluate(() => getSelection().toString())).toBe('');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.task__label')).userSelect)).toBe('none');
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.task__label')).cursor)).toBe('grabbing');
    const menu = await page.evaluate(() => {
      const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      document.querySelector('.task--placeholder').dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(menu).toBe(true);
    // The slip follows the pointer.
    const before = await slip(page).boundingBox();
    await page.mouse.move(box.x + 300, box.y - 200, { steps: 4 });
    await expect.poll(async () => (await slip(page).boundingBox()).y).toBeLessThan(before.y);
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);
    expect(await attrs()).toEqual(restAttrs);
  });

  test('a done task lifts as a done slip', async ({ page }) => {
    await seed(page);
    await mouseDrag(page, row(page, 'Gửi báo cáo'));
    await expect(slip(page)).toHaveClass(/drag-slip--done/);
    await page.mouse.up();
  });

  test('at rest there is no strip, slip or new tab stop, before and after a drag', async ({ page }) => {
    await seed(page);
    const stops = () => page.evaluate(() => [...document.querySelectorAll('a, button, input, select, textarea, [tabindex]')]
      .filter((el) => el.tabIndex >= 0 && !el.closest('[hidden], dialog:not([open]), template')).length);
    await expect(leftovers(page)).toHaveCount(0);
    const n = await stops();
    await mouseDrag(page, row(page, 'Tiền điện'));
    expect(await stops()).toBe(n);
    await page.keyboard.press('Escape');
    await mouseDrag(page, row(page, 'Tiền điện'));
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);
    expect(await stops()).toBe(n);
  });

  test('Escape cancels: nothing written, focus back on Sửa, the cancel announced, and the Escape reaches nothing else', async ({ page }) => {
    await seed(page);
    await page.locator('#new-task').fill('đang gõ');
    const r = row(page, 'Trả lời email');
    await r.getByRole('button', { name: 'Sửa' }).focus();
    const before = await rawAll(page);
    await page.evaluate(() => { window.escapes = 0; document.addEventListener('keydown', (e) => { if (e.key === 'Escape') window.escapes++; }); });
    await mouseDrag(page, r, 0, 80);
    expect(await dragging(page)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(leftovers(page)).toHaveCount(0);
    await expect(r.getByRole('button', { name: 'Sửa' })).toBeFocused();
    await expect(page.locator('#sr-status')).toHaveText('Đã hủy. Việc vẫn ở nhóm "Công ty".');
    expect(await page.evaluate(() => window.escapes)).toBe(0);
    await expect(page.locator('#new-task')).toHaveValue('đang gõ');
    await page.mouse.up();
    expect(await rawAll(page)).toEqual(before);
    await expect(rows(page).locator('.task__label')).toHaveText(['Gửi báo cáo', 'Trả lời email', 'Tiền điện', 'Cắt tóc']);
  });

  test('a release anywhere cancels with nothing written; focus stays off the row when it was outside the list', async ({ page }) => {
    await seed(page);
    await page.locator('#new-task').focus();
    const before = await rawAll(page);
    const r = row(page, 'Cắt tóc');
    await mouseDrag(page, r, 40, -150);
    expect(await dragging(page)).toBe(true);
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);
    await expect(page.locator('#sr-status')).toHaveText('Đã hủy. Việc vẫn ở nhóm "Chưa phân nhóm".');
    await expect(r.getByRole('button', { name: 'Sửa' })).not.toBeFocused();
    expect(await rawAll(page)).toEqual(before);
    // The click after the release did not tick anything.
    await expect(rows(page).locator('input:checked')).toHaveCount(1);
  });

  test('reduced motion: the slip has no tilt and no lift animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page);
    await mouseDrag(page, row(page, 'Tiền điện'));
    const style = await slip(page).evaluate((el) => ({ rotate: getComputedStyle(el).rotate, anim: getComputedStyle(el).animationName }));
    expect(['0deg', 'none']).toContain(style.rotate);
    expect(style.anim).toBe('none');
    expect(await strip(page).evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    await page.mouse.up();
  });
});

// QA additions (edge cases and gaps found while executing T3).
test.describe('mouse edge cases', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse and pen: desktop project');
  const stray = (page) => page.evaluate(() => document.querySelectorAll('.drag-slip, .drop-strip, .task--placeholder, html.is-dragging').length);

  test('20 groups with a 30 character name: one target each, names whole, strip inside the screen at 1440 and 390', async ({ page }) => {
    const many = Array.from({ length: 20 }, (_, i) => group(`g${i}`, i === 19 ? 'N'.repeat(30) : `Nhóm ${i + 1}`, 'yellow', i + 1));
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      await seed(page, TASKS.map((t) => ({ ...t, groupId: t.groupId && 'g0' })), many);
      await mouseDrag(page, row(page, 'Cắt tóc'));
      await expect(strip(page).locator('.drop-target')).toHaveCount(21);
      await expect(strip(page).locator('.drop-target').nth(19)).toHaveText('N'.repeat(30));
      const sb = await strip(page).boundingBox();
      expect(sb.y).toBeGreaterThanOrEqual(0);
      expect(sb.y + sb.height).toBeLessThanOrEqual(size.height);
      expect(sb.x).toBeGreaterThanOrEqual(0);
      expect(sb.x + sb.width).toBeLessThanOrEqual(size.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
      await page.mouse.up();
    }
  });

  // BUG-016 (fixed): the slip is placed with left and top; a transform offset used to be turned by the CSS rotate.
  test('the slip stays inside the screen when the pointer is at the right edge (BUG-016)', async ({ page }) => {
    await seed(page);
    await mouseDrag(page, row(page, 'Tiền điện'));
    const vp = page.viewportSize();
    await page.mouse.move(vp.width - 1, vp.height - 1, { steps: 5 });
    await expect.poll(async () => (await slip(page).boundingBox()).x).toBeGreaterThan(300);
    const b = await slip(page).boundingBox();
    expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 1);
    await page.mouse.up();
  });

  test('the grab point stays under the pointer wherever the pointer goes (R27, BUG-016)', async ({ page }) => {
    await seed(page);
    const r = row(page, 'Tiền điện');
    const { x, y } = await mouseDrag(page, r, 0, 12);
    const text = slip(page).locator('.drag-slip__text');
    await expect(slip(page)).toBeVisible();
    await page.waitForTimeout(300); // the pick-up animation is done
    const t1 = await text.boundingBox();
    const off = { x: t1.x - x, y: t1.y - (y + 12) };
    for (const [px, py] of [[500, 300], [600, 500], [300, 650]]) {
      await page.mouse.move(px, py, { steps: 4 });
      await page.waitForTimeout(100);
      const t = await text.boundingBox();
      expect(Math.abs(t.x - px - off.x)).toBeLessThan(4);
      expect(Math.abs(t.y - py - off.y)).toBeLessThan(5);
    }
    await page.mouse.up();
  });

  test('390 px: a 200 character task lifts and the page gets no sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await seed(page, [{ ...task('l', 'x'.repeat(200), false, undefined, 5), groupId: 'cty' }]);
    await mouseDrag(page, rows(page).first(), 10, 10);
    await page.mouse.move(389, 699, { steps: 5 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.mouse.up();
  });

  test('a release on the own group or on nothing and Escape all leave all three keys byte for byte', async ({ page }) => {
    await seed(page);
    const before = await rawAll(page);
    const r = row(page, 'Trả lời email');
    await mouseDrag(page, r, 0, 40);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    const own = await r.boundingBox();
    await mouseDrag(page, r, 0, 40);
    await page.mouse.move(own.x + 50, own.y + own.height / 2, { steps: 5 });
    await page.mouse.up();
    await mouseDrag(page, r, 0, 150); // stays inside the window: Playwright Firefox gets no release outside it
    await page.mouse.up();
    expect(await rawAll(page)).toEqual(before);
    expect(await stray(page)).toBe(0);
  });

  test('a drag under the filter, with a folded section, or with the new group line open cancels cleanly', async ({ page }) => {
    await seed(page);
    const before = await rawAll(page);
    await page.locator('#group-filter').selectOption('cty');
    await mouseDrag(page, rows(page).first());
    await expect(strip(page).locator('.drop-target')).toHaveText(['Công ty', 'Nhà', 'Sức khỏe', 'Chưa phân nhóm']);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(page.locator('#group-filter')).toHaveValue('cty');
    await page.locator('#group-filter').selectOption({ index: 0 });
    await toggle(page, 'Công ty').click();
    const folded = await rawAll(page);
    const h = await toggle(page, 'Công ty').boundingBox(); // a press on the header is not a row: no drag
    await page.mouse.move(h.x + 100, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + 200, h.y + 100, { steps: 6 });
    expect(await dragging(page)).toBe(false);
    await page.mouse.up();
    expect(await rawAll(page)).toEqual(folded);
    await mouseDrag(page, row(page, 'Cắt tóc')); // another row, with one section folded
    expect(await dragging(page)).toBe(true);
    await page.mouse.up();
    await page.locator('#new-task-group').selectOption('new');
    const line = page.locator('#add-form .input').last();
    await line.fill('Nhóm thử');
    await mouseDrag(page, row(page, 'Cắt tóc'));
    expect(await dragging(page)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(line).toHaveValue('Nhóm thử'); // the Escape closed only the drag, not the open line
    await page.mouse.up();
    await expect(line).toHaveValue('Nhóm thử');
    expect(await rawAll(page)).toEqual(folded);
    expect(await stray(page)).toBe(0);
  });

  test('a second mouse button, a double click and very fast presses leave nothing behind', async ({ page }) => {
    await seed(page);
    const before = await rawAll(page);
    const r = row(page, 'Cắt tóc');
    await mouseDrag(page, r, 30, -100);
    await page.mouse.down({ button: 'right' });
    expect(await dragging(page)).toBe(true);
    await expect(slip(page)).toHaveCount(1);
    await page.mouse.up({ button: 'right' });
    expect(await dragging(page)).toBe(true);
    await page.mouse.up();
    expect(await stray(page)).toBe(0);
    await r.locator('.task__label').dblclick();
    expect(await stray(page)).toBe(0);
    const b = await r.locator('.task__label').boundingBox();
    for (let i = 0; i < 20; i++) {
      await page.mouse.move(b.x + 5, b.y + 5);
      await page.mouse.down();
      await page.mouse.move(b.x + 400, b.y + 100 + i); // one jump, no steps
      await page.mouse.up();
    }
    expect(await stray(page)).toBe(0);
    expect(await rawAll(page)).toEqual(before);
  });

  test('following the pointer never rebuilds the list or reads every row (NFR1)', async ({ page }) => {
    await seed(page);
    await mouseDrag(page, row(page, 'Trả lời email'), 20, 20);
    await page.evaluate(() => {
      window.__m = { list: 0, qsa: 0, rects: 0 };
      new MutationObserver((l) => { for (const m of l) if (m.target.closest?.('#day-list') && !m.target.closest('.drag-slip, .drop-strip')) window.__m.list++; })
        .observe(document.getElementById('day-list'), { subtree: true, childList: true, attributes: true, characterData: true });
      for (const P of [Document.prototype, Element.prototype]) { const o = P.querySelectorAll; P.querySelectorAll = function (...a) { window.__m.qsa++; return o.apply(this, a); }; }
      const g = Element.prototype.getBoundingClientRect; Element.prototype.getBoundingClientRect = function () { window.__m.rects++; return g.call(this); };
    });
    await page.mouse.move(700, 100, { steps: 100 });
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__m)).toEqual({ list: 0, qsa: 0, rects: 0 });
    await page.mouse.up();
  });
});

test('phone: an open swipe strip closes when its row is picked up', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout only');
  await seed(page);
  const r = row(page, 'Trả lời email');
  const swipe = r.locator('.task__swipe');
  await r.getByRole('button', { name: 'Sửa' }).focus(); // focus scrolls the strip open and tracks it
  await expect.poll(() => swipe.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await mouseDrag(page, r, 0, 60);
  expect(await dragging(page)).toBe(true);
  await expect.poll(() => swipe.evaluate((el) => el.scrollLeft)).toBe(0);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(leftovers(page)).toHaveCount(0);
});
