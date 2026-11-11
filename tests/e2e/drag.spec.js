import { test, expect } from '@playwright/test';
import { open, task, group, rows, tick, section, toggle, mouseDrag, longPressDrag, finger, touchDrag, storedJson, KEY, GROUPS_KEY, UI_KEY } from './helpers.js';

// drag-drop T3: mouse pick up, slip, strip and cancel. T4 (below): drop targets and the drop.
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
    // Over no target (T4): the strip's own label is fixed on screen during a drag; the title may be scrolled off,
    // and Firefox delivers no release outside the window (BUG-017).
    const h = await strip(page).locator('.drop-strip__label').boundingBox();
    await page.mouse.move(h.x + 20, h.y + h.height / 2, { steps: 4 });
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
    await mouseDrag(page, r, 0, 12);
    const text = slip(page).locator('.drag-slip__text');
    await expect(slip(page)).toBeVisible();
    await page.mouse.move(400, 200, { steps: 4 }); // the reference point is clear of the strip (T4: the slip rides above it)
    await page.waitForTimeout(300); // the pick-up animation is done
    const t1 = await text.boundingBox();
    const off = { x: t1.x - 400, y: t1.y - 200 };
    for (const [px, py] of [[500, 300], [600, 500], [300, 560]]) { // above the strip: the slip never covers it (T4)
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

// drag-drop T4: drop targets and the drop.
test.describe('drop', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse and pen: desktop project');
  // Tall enough that the strip and the 64 px auto scroll zone above it sit clear of every row used as a target, and
  // a hover over a row never starts an auto scroll that would move the rows away (BUG-019).
  test.use({ viewport: { width: 1440, height: 1100 } });
  const target = (page, name) => strip(page).locator('.drop-target').filter({ hasText: name });
  const marked = (page) => page.locator('#day-list > .group.group--drop, .drop-target--over');
  const to = (page) => slip(page).locator('.drag-slip__to');
  const centre = async (loc) => { const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  const over = async (page, loc) => page.mouse.move(...(await centre(loc)), { steps: 6 });
  const labelsOf = (page, name) => section(page, name).locator('.task__label');
  // Counts every setItem by key from the first script on, so the drop's writes can be told apart.
  const spy = (page) => page.addInitScript(() => {
    const set = Storage.prototype.setItem;
    window.writes = [];
    Storage.prototype.setItem = function (k, v) {
      window.writes.push(k);
      if (window.failTasks && k === 'daily-todo:tasks:v1') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return set.call(this, k, v);
    };
  });
  const writes = (page) => page.evaluate(() => window.writes.splice(0));

  test('a header, a row and the space inside a section are targets: frame and the name on the slip (R8, R11, R28)', async ({ page }) => {
    await seed(page);
    await mouseDrag(page, row(page, 'Trả lời email'), 0, 20);
    const nha = section(page, 'Nhà');
    await over(page, toggle(page, 'Nhà'));
    await expect(nha).toHaveClass(/group--drop/);
    await expect(marked(page)).toHaveCount(1);
    await expect(to(page)).toHaveText('Nhà');
    await expect(to(page)).toHaveAttribute('data-color', 'pink');
    expect(await to(page).locator('*').count()).toBe(0);
    await over(page, row(page, 'Tiền điện'));
    await expect(nha).toHaveClass(/group--drop/);
    const b = await nha.boundingBox(); // the right end of the line, clear of the text: the section's own space
    await page.mouse.move(b.x + b.width - 40, b.y + b.height - 6, { steps: 3 });
    await expect(nha).toHaveClass(/group--drop/);
    await over(page, row(page, 'Cắt tóc'));
    await expect(section(page, 'Chưa phân nhóm')).toHaveClass(/group--drop/);
    await expect(nha).not.toHaveClass(/group--drop/);
    await expect(to(page)).toHaveText('Chưa phân nhóm');
    // The ink frame is drawn (R28).
    const frame = await section(page, 'Chưa phân nhóm').evaluate((el) => getComputedStyle(el, '::before').borderTopWidth);
    expect(frame).toBe('2px');
    await page.keyboard.press('Escape');
    await page.mouse.up();
  });

  test('a strip label for a group with no task today is a target; the own section and the faded label are not', async ({ page }) => {
    await seed(page);
    const before = await rawAll(page);
    const r = row(page, 'Trả lời email');
    await mouseDrag(page, r, 0, 20);
    await over(page, target(page, 'Sức khỏe'));
    await expect(target(page, 'Sức khỏe')).toHaveClass(/drop-target--over/);
    await expect(marked(page)).toHaveCount(1);
    await expect(to(page)).toHaveText('Sức khỏe');
    // The slip rests on the strip's top edge, so the label under the pointer stays in sight (hover-strip.html).
    const sb = await slip(page).boundingBox(), tb = await target(page, 'Sức khỏe').boundingBox();
    expect(sb.y + sb.height).toBeLessThanOrEqual(tb.y + 4);
    await over(page, target(page, 'Công ty')); // faded: the task is there already
    await expect(marked(page)).toHaveCount(0);
    await expect(to(page)).toHaveCount(0);
    await page.mouse.up();
    await expect(page.locator('#sr-status')).toHaveText('Đã hủy. Việc vẫn ở nhóm "Công ty".');
    await mouseDrag(page, r, 0, 20);
    await over(page, row(page, 'Gửi báo cáo')); // own section
    await expect(marked(page)).toHaveCount(0);
    await expect(to(page)).toHaveCount(0);
    await page.mouse.up();
    await mouseDrag(page, r, 0, 20);
    await over(page, page.locator('#page-title')); // nothing
    await expect(marked(page)).toHaveCount(0);
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);
    expect(await rawAll(page)).toEqual(before);
    await expect(rows(page).locator('.task__label')).toHaveText(['Gửi báo cáo', 'Trả lời email', 'Tiền điện', 'Cắt tóc']);
  });

  test('a drop moves the task by creation time, one tasks write, counts updated, focus on Sửa, announced (R13, R23, R33, R36)', async ({ page }) => {
    await spy(page);
    await seed(page);
    const was = (await storedJson(page, KEY)).find((t) => t.id === 'b');
    await writes(page);
    const r = row(page, 'Trả lời email');
    await mouseDrag(page, r, 0, 20);
    await over(page, row(page, 'Tiền điện')); // released below Tiền điện, lands above it: created earlier
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);
    await expect(labelsOf(page, 'Nhà')).toHaveText(['Trả lời email', 'Tiền điện']);
    await expect(labelsOf(page, 'Công ty')).toHaveText(['Gửi báo cáo']);
    expect(await writes(page)).toEqual([KEY]);
    const now = (await storedJson(page, KEY)).find((t) => t.id === 'b');
    expect(now).toEqual({ ...was, groupId: 'nha' });
    await expect(section(page, 'Công ty').locator('.group__count')).toHaveText('1/1');
    await expect(section(page, 'Nhà').locator('.group__count')).toHaveText('0/2');
    await expect(page.locator('#summary')).toHaveText('Đã hoàn thành 1/4 việc');
    await expect(r.getByRole('button', { name: 'Sửa' })).toBeFocused();
    await expect(page.locator('#sr-status')).toHaveText('Đã chuyển việc "Trả lời email" sang nhóm "Nhà".');
    await expect(r).toHaveClass(/task--moved/);
    // The click after the drop ticked nothing (R7).
    await expect(rows(page).locator('input:checked')).toHaveCount(1);
  });

  test('a drop on a strip label of a group with no section creates the section', async ({ page }) => {
    await seed(page);
    await mouseDrag(page, row(page, 'Cắt tóc'), 0, -20);
    await over(page, target(page, 'Sức khỏe'));
    await page.mouse.up();
    await expect(labelsOf(page, 'Sức khỏe')).toHaveText(['Cắt tóc']);
    await expect(page.locator('#day-list > .group .group__name')).toHaveText(['Công ty', 'Nhà', 'Sức khỏe']);
    expect((await storedJson(page, KEY)).find((t) => t.id === 'd').groupId).toBe('sk');
    await expect(page.locator('#sr-status')).toHaveText('Đã chuyển việc "Cắt tóc" sang nhóm "Sức khỏe".');
  });

  test('a hovered folded section stays folded and opens on the drop, with the fold stored (R14)', async ({ page }) => {
    await spy(page);
    await seed(page);
    await toggle(page, 'Nhà').click();
    await expect(section(page, 'Nhà')).toHaveClass(/group--collapsed/);
    await writes(page);
    await mouseDrag(page, row(page, 'Cắt tóc'), 0, -20);
    await over(page, toggle(page, 'Nhà'));
    await expect(section(page, 'Nhà')).toHaveClass(/group--drop/);
    await page.waitForTimeout(300);
    await expect(section(page, 'Nhà')).toHaveClass(/group--collapsed/);
    await page.mouse.up();
    await expect(section(page, 'Nhà')).not.toHaveClass(/group--collapsed/);
    await expect(labelsOf(page, 'Nhà')).toHaveText(['Tiền điện', 'Cắt tóc']);
    expect((await storedJson(page, UI_KEY)).collapsed).toEqual([]);
    expect((await writes(page)).sort()).toEqual([KEY, UI_KEY].sort());
  });

  test('under the filter, a drop into a hidden group keeps the filter, shows the info slip and focuses the next row (R15)', async ({ page }) => {
    await seed(page);
    await page.locator('#group-filter').selectOption('cty');
    await mouseDrag(page, row(page, 'Gửi báo cáo'), 0, 20);
    await over(page, target(page, 'Nhà'));
    await page.mouse.up();
    await expect(page.locator('#group-filter')).toHaveValue('cty');
    await expect(rows(page).locator('.task__label')).toHaveText(['Trả lời email']);
    await expect(page.locator('#notice-text')).toHaveText('Đã chuyển việc "Gửi báo cáo" sang nhóm "Nhà".');
    await expect(row(page, 'Trả lời email').getByRole('checkbox')).toBeFocused();
    expect((await storedJson(page, KEY)).find((t) => t.id === 'a').groupId).toBe('nha');
  });

  for (const day of ['2026-11-08', '2026-11-12']) {
    test(`a drop works on another day (${day}) and keeps the date (R16)`, async ({ page }) => {
      await open(page, TASKS.map((t) => ({ ...t, date: day })), `#${day}`, { groups: GROUPS });
      await mouseDrag(page, row(page, 'Tiền điện'), 0, -20);
      await over(page, toggle(page, 'Công ty'));
      await page.mouse.up();
      await expect(labelsOf(page, 'Công ty')).toHaveText(['Gửi báo cáo', 'Trả lời email', 'Tiền điện']);
      expect((await storedJson(page, KEY)).find((t) => t.id === 'c')).toMatchObject({ groupId: 'cty', date: day });
    });
  }

  test('a drop on Chưa phân nhóm removes groupId', async ({ page }) => {
    await seed(page);
    await mouseDrag(page, row(page, 'Tiền điện'), 0, 20);
    await over(page, target(page, 'Chưa phân nhóm'));
    await page.mouse.up();
    await expect(labelsOf(page, 'Chưa phân nhóm')).toHaveText(['Tiền điện', 'Cắt tóc']);
    expect((await storedJson(page, KEY)).find((t) => t.id === 'c')).not.toHaveProperty('groupId');
    await expect(page.locator('#sr-status')).toHaveText('Đã chuyển việc "Tiền điện" sang nhóm "Chưa phân nhóm".');
  });

  test('a target group removed in storage before the release is a cancel (R21)', async ({ page }) => {
    await seed(page);
    const tasks = await page.evaluate((k) => localStorage.getItem(k), KEY);
    await mouseDrag(page, row(page, 'Cắt tóc'), 0, -20);
    await over(page, target(page, 'Sức khỏe'));
    await page.evaluate(([k, list]) => { // another tab removes Sức khỏe
      localStorage.setItem(k, list);
      window.dispatchEvent(new StorageEvent('storage', { key: k }));
    }, [GROUPS_KEY, JSON.stringify(GROUPS.slice(0, 2))]);
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(tasks);
    await expect(page.locator('#day-list > .group .group__name')).toHaveText(['Công ty', 'Nhà', 'Chưa phân nhóm']);
  });

  test('a failing tasks write keeps the move on screen and shows the storage slip (R34)', async ({ page }) => {
    await spy(page);
    await seed(page);
    const tasks = await page.evaluate((k) => localStorage.getItem(k), KEY);
    await page.evaluate(() => { window.failTasks = true; });
    await mouseDrag(page, row(page, 'Trả lời email'), 0, 20);
    await over(page, toggle(page, 'Nhà'));
    await page.mouse.up();
    await expect(labelsOf(page, 'Nhà')).toHaveText(['Trả lời email', 'Tiền điện']);
    await expect(page.getByRole('alert').filter({ hasText: 'Không thể lưu dữ liệu' })).toBeVisible();
    expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe(tasks);
  });
});

// drag-drop T6: auto scroll on a long day (R31, R32). The down zone is the 64 px above the strip, the up zone the
// 64 px under the screen top; the strip itself never scrolls.
test.describe('auto scroll', () => {
  test.skip(({ isMobile }) => isMobile, 'mouse: desktop project');
  test.use({ viewport: { width: 1440, height: 900 } });
  // Công ty holds most of a long day; Nhà, Sức khỏe and Chưa phân nhóm follow it.
  const LONG = [...TASKS, ...Array.from({ length: 30 }, (_, i) => ({ ...task(`l${i}`, `Việc dài ${i + 1}`, false, undefined, 100 + i), groupId: 'cty' }))];
  const scrollY = (page) => page.evaluate(() => scrollY);
  const end = (page) => page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const cue = (page) => page.locator('body > .drag-edge');
  const settled = (loc) => loc.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => el.getBoundingClientRect().toJSON()));
  // The strip's top edge without its slight rotation, as the zone is measured.
  const stripTop = (page) => strip(page).evaluate((el) => el.offsetTop);
  // Lifts Trả lời email and returns the pointer x and the strip's top edge.
  const lift = async (page, tasks = LONG) => {
    await seed(page, tasks);
    const { x } = await mouseDrag(page, row(page, 'Trả lời email'), 0, 20);
    await settled(strip(page));
    return { x, top: await stripTop(page) };
  };
  // Counts animation frames asked for from now on, to prove the loop has stopped.
  const frames = (page) => page.evaluate(() => {
    window.__raf = 0;
    const raf = window.requestAnimationFrame;
    window.requestAnimationFrame = (fn) => { window.__raf++; return raf(fn); };
  });

  test('resting above the strip scrolls down with the down cue, the strip stays put, and it stops at the page end', async ({ page }) => {
    const { x, top } = await lift(page);
    const before = await settled(strip(page));
    await page.evaluate(() => {
      window.__m = { qsa: 0, rects: 0 };
      for (const P of [Document.prototype, Element.prototype]) { const o = P.querySelectorAll; P.querySelectorAll = function (...a) { window.__m.qsa++; return o.apply(this, a); }; }
      const g = Element.prototype.getBoundingClientRect; Element.prototype.getBoundingClientRect = function () { window.__m.rects++; return g.call(this); };
    });
    await page.mouse.move(x, top - 10, { steps: 4 });
    await expect.poll(() => scrollY(page)).toBeGreaterThan(100);
    await expect(cue(page)).toHaveClass(/drag-edge--down/);
    expect(await page.evaluate(() => window.__m)).toEqual({ qsa: 0, rects: 0 }); // NFR1: no row is read while scrolling
    const c = await cue(page).boundingBox();
    expect(Math.round(c.y + c.height)).toBe(Math.round(top)); // the band sits right on the strip
    expect(await strip(page).evaluate((el) => el.getBoundingClientRect().toJSON())).toEqual(before);
    const last = await end(page);
    await expect.poll(() => scrollY(page)).toBe(last);
    await expect(cue(page)).toHaveCount(0);
    await frames(page);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__raf)).toBe(0);
    expect(await scrollY(page)).toBe(last);
    expect(await dragging(page)).toBe(true);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);
  });

  test('leaving the zone stops the scroll; near the top it scrolls up with the up cue and stops at the page top', async ({ page }) => {
    const { x, top } = await lift(page);
    await page.mouse.move(x, top - 30, { steps: 4 });
    await expect.poll(() => scrollY(page)).toBeGreaterThan(150);
    await page.mouse.move(x, 400, { steps: 2 });
    await expect(cue(page)).toHaveCount(0);
    const still = await scrollY(page);
    await frames(page);
    await page.waitForTimeout(200);
    expect(await scrollY(page)).toBe(still);
    expect(await page.evaluate(() => window.__raf)).toBe(0);

    await page.mouse.move(x, 20, { steps: 4 });
    await expect(cue(page)).toHaveClass(/drag-edge--up/);
    expect((await cue(page).boundingBox()).y).toBe(0);
    await expect.poll(() => scrollY(page)).toBeLessThan(still);
    await expect.poll(() => scrollY(page)).toBe(0);
    await expect(cue(page)).toHaveCount(0);
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);
  });

  test('a pointer over the strip never scrolls, and every end stops a running scroll', async ({ page }) => {
    const { x, top } = await lift(page);
    await page.mouse.move(x, top + 20); // one jump: passing through the zone would scroll a little
    await page.waitForTimeout(250);
    expect(await scrollY(page)).toBe(0);
    await expect(cue(page)).toHaveCount(0);

    await page.mouse.move(x, top - 10, { steps: 2 });
    await expect.poll(() => scrollY(page)).toBeGreaterThan(50);
    await page.keyboard.press('Escape');
    await expect(leftovers(page)).toHaveCount(0);
    const at = await scrollY(page);
    await page.waitForTimeout(200);
    expect(await scrollY(page)).toBe(at);
    await page.mouse.up();

    // A release while scrolling stops it too.
    await mouseDrag(page, row(page, 'Việc dài 20'), 0, 20);
    const t = await stripTop(page);
    await page.mouse.move(x, t - 10, { steps: 2 });
    const from = await scrollY(page);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(from);
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);
    const stop = await scrollY(page);
    await page.waitForTimeout(200);
    expect(await scrollY(page)).toBe(stop);
  });

  test('on a short screen with 20 groups a pointer over the strip never scrolls (BUG-020)', async ({ page }) => {
    const many = Array.from({ length: 20 }, (_, i) => group(`g${i}`, `Nhóm ${i + 1}`, 'yellow', i + 1));
    const tasks = Array.from({ length: 60 }, (_, i) => ({ ...task(`m${i}`, `Việc ${i + 1}`, false, undefined, 10 + i), groupId: `g${i % 20}` }));
    // 360 x 500: the strip's top edge is near 80, so the zones share the space above it. 360 x 380: the strip is
    // taller than the screen and there is no zone.
    for (const size of [{ width: 360, height: 500 }, { width: 360, height: 380 }]) {
      await page.setViewportSize(size);
      await seed(page, tasks, many);
      await page.evaluate(() => scrollTo(0, 600));
      await mouseDrag(page, row(page, 'Việc 20'), 0, 20);
      await settled(strip(page));
      const top = await stripTop(page);
      expect(top).toBeLessThan(128);
      const y = Math.max(top, 0) + 5;
      await page.mouse.move(60, y);
      const at = await scrollY(page);
      await page.waitForTimeout(300);
      expect(await scrollY(page), `${size.height} px`).toBe(at);
      await expect(cue(page)).toHaveCount(0);
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect(leftovers(page)).toHaveCount(0);
    }
  });

  test('a section the scroll brings under a still pointer becomes the target, and a release drops there', async ({ page }) => {
    // Ten more ungrouped tasks, so Chưa phân nhóm ends the page with rows inside the zone.
    const { x, top } = await lift(page, [...LONG, ...Array.from({ length: 10 }, (_, i) => task(`u${i}`, `Việc lẻ ${i + 1}`, false, undefined, 200 + i))]);
    await page.evaluate(() => {
      window.marked = [];
      new MutationObserver((list) => {
        for (const m of list) if (m.target.classList.contains('group--drop')) window.marked.push(m.target.dataset.key);
      }).observe(document.getElementById('day-list'), { attributes: true, attributeFilter: ['class'], subtree: true });
    });
    await page.mouse.move(x, top - 10, { steps: 4 });
    await expect.poll(() => page.evaluate(() => window.marked)).toContain('nha');
    await expect.poll(() => page.evaluate(() => window.marked)).toContain('none'); // Chưa phân nhóm, last on the page
    await expect.poll(() => scrollY(page)).toBe(await end(page));
    // At the page end the sheet's bottom margin is under the pointer; a little higher is the last row, and a release
    // there drops into Chưa phân nhóm.
    await page.mouse.move(x, top - 60, { steps: 2 });
    await expect(section(page, 'Chưa phân nhóm')).toHaveClass(/group--drop/);
    await expect(slip(page).locator('.drag-slip__to')).toHaveText('Chưa phân nhóm');
    await page.mouse.up();
    await expect(leftovers(page)).toHaveCount(0);
    expect((await storedJson(page, KEY)).find((t) => t.id === 'b').groupId).toBeUndefined();
    await expect(section(page, 'Chưa phân nhóm').locator('.task__label').first()).toHaveText('Trả lời email');
  });
});

// drag-drop T5: long press on phones, next to the swipe and the page scroll (R2, R3, R6, R7, R32). CDP touch.
test.describe('touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch: phone project');
  const HINT = 'daily-todo:swipe-hint-seen';
  // A long day: the page scrolls, and Công ty holds most of it.
  const LONG = [...TASKS, ...Array.from({ length: 24 }, (_, i) => ({ ...task(`l${i}`, `Việc dài ${i + 1}`, false, undefined, 100 + i), groupId: 'cty' }))];
  const target = (page, name) => strip(page).locator('.drop-target').filter({ hasText: name });
  const label = async (page, text) => { const b = await row(page, text).locator('.task__label').boundingBox(); return [b.x + Math.min(b.width / 2, 60), b.y + b.height / 2]; };
  const scrollY = (page) => page.evaluate(() => scrollY);
  // Records every drag class that ever appears, so a gesture that should never lift can be checked afterwards.
  const watch = (page) => page.evaluate(() => {
    window.seen = new Set();
    new MutationObserver((list) => {
      for (const m of list) for (const c of ['is-dragging', 'task--placeholder']) if (m.target.classList.contains(c)) window.seen.add(c);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });
  });
  const seen = (page) => page.evaluate(() => [...window.seen]);
  test.beforeEach(async ({ page }) => { await page.addInitScript((k) => localStorage.setItem(k, '1'), HINT); });

  test('the line washes while the finger holds, lifts at 400 ms, and a lift over its own place changes nothing', async ({ page }) => {
    await seed(page);
    const before = await rawAll(page);
    const r = row(page, 'Trả lời email');
    const f = await finger(page);
    await f.down(...(await label(page, 'Trả lời email')));
    await expect(r).toHaveClass(/task--pressing/);
    expect(await dragging(page)).toBe(false);
    await f.move(f.at()[0] + 6, f.at()[1] + 4, 2); // a small tremble stays a press (R3 reading: up to 10 px)
    await expect.poll(() => dragging(page)).toBe(true);
    await expect(r).toHaveClass(/task--placeholder/);
    await expect(r).not.toHaveClass(/task--pressing/);
    await expect(slip(page)).toHaveText('Trả lời email');
    await expect(strip(page)).toBeVisible();
    await f.up();
    await expect(leftovers(page)).toHaveCount(0);
    await expect(page.locator('.task--pressing')).toHaveCount(0);
    expect(await rawAll(page)).toEqual(before);
    await expect(page.locator('#sr-status')).toHaveText('Đã hủy. Việc vẫn ở nhóm "Công ty".');
  });

  test('a long press then a move onto a strip label drops the task; the slip rides 60 px above the finger', async ({ page }) => {
    await seed(page);
    const f = await longPressDrag(page, row(page, 'Trả lời email'), null, { release: false });
    const t = target(page, 'Sức khỏe');
    const b = await t.boundingBox();
    await f.move(b.x + b.width / 2, b.y + b.height / 2);
    await expect(t).toHaveClass(/drop-target--over/);
    await expect(slip(page).locator('.drag-slip__to')).toHaveText('Sức khỏe');
    const s = await slip(page).evaluate((el) => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom }; });
    const w = await page.evaluate(() => document.documentElement.clientWidth);
    expect(s.left).toBeGreaterThanOrEqual(0);
    expect(s.right).toBeLessThanOrEqual(w);
    expect(s.bottom).toBeLessThanOrEqual(b.y + b.height / 2 - 40); // well clear of the finger, never under it
    await f.up();
    await expect(leftovers(page)).toHaveCount(0);
    expect((await storedJson(page, KEY)).find((x) => x.id === 'b').groupId).toBe('sk');
    await expect(section(page, 'Sức khỏe').locator('.task__label')).toHaveText(['Trả lời email']);
    await expect(page.locator('#sr-status')).toHaveText('Đã chuyển việc "Trả lời email" sang nhóm "Sức khỏe".');
  });

  test('the page does not scroll while the finger moves during a drag (R32)', async ({ page }) => {
    await seed(page, LONG);
    await page.evaluate(() => scrollTo(0, 300));
    const top = await scrollY(page);
    expect(top).toBeGreaterThan(0);
    const [x, y] = await label(page, 'Việc dài 8');
    const f = await longPressDrag(page, row(page, 'Việc dài 8'), null, { release: false });
    expect(await dragging(page)).toBe(true);
    await f.move(x, y - 120, 10);
    await f.move(x, y + 80, 10);
    expect(await scrollY(page)).toBe(top);
    expect(await dragging(page)).toBe(true);
    await f.move(x, y); // back over its own section: the lift is a cancel
    await f.up();
    await expect(leftovers(page)).toHaveCount(0);
    expect(await scrollY(page)).toBe(top);
  });

  test('a fast swipe left still opens Sửa and Xóa with no drag and no class left', async ({ page }) => {
    await seed(page);
    await watch(page);
    const swipe = row(page, 'Trả lời email').locator('.task__swipe');
    await touchDrag(page, swipe, -200);
    await expect.poll(() => swipe.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    await page.waitForTimeout(500); // past the hold: nothing may lift late
    expect(await seen(page)).toEqual([]);
    await expect(page.locator('.task--pressing')).toHaveCount(0);
    await expect(leftovers(page)).toHaveCount(0);
  });

  test('a fast vertical move scrolls the page with no drag', async ({ page }) => {
    await seed(page, LONG);
    await watch(page);
    const [x, y] = await label(page, 'Việc dài 3');
    const f = await finger(page);
    await f.down(x, y);
    await f.move(x, y - 300, 10);
    await f.up();
    await expect.poll(() => scrollY(page)).toBeGreaterThan(100);
    await page.waitForTimeout(500);
    expect(await seen(page)).toEqual([]);
    await expect(page.locator('.task--pressing')).toHaveCount(0);
    await expect(leftovers(page)).toHaveCount(0);
  });

  test('a short tap behaves as today: nothing lifts, nothing is written, the tick box still ticks', async ({ page }) => {
    await seed(page);
    await watch(page);
    const before = await rawAll(page);
    const f = await finger(page);
    await f.down(...(await label(page, 'Trả lời email')));
    await page.waitForTimeout(80);
    await f.up();
    await page.waitForTimeout(500);
    expect(await seen(page)).toEqual([]);
    await expect(page.locator('.task--pressing')).toHaveCount(0);
    expect(await rawAll(page)).toEqual(before);
    await row(page, 'Trả lời email').locator('.check__box').tap();
    await expect(row(page, 'Trả lời email').getByRole('checkbox')).toBeChecked();
  });

  test('a long press on a row whose swipe is open closes the strip before the drag (R6)', async ({ page }) => {
    await seed(page);
    const r = row(page, 'Trả lời email');
    const swipe = r.locator('.task__swipe');
    await touchDrag(page, swipe, -200);
    await expect.poll(() => swipe.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);
    const b = await swipe.boundingBox();
    const f = await finger(page);
    await f.down(b.x + 20, b.y + b.height / 2); // the part of the text still showing
    await page.waitForTimeout(450);
    expect(await dragging(page)).toBe(true);
    await expect.poll(() => swipe.evaluate((el) => el.scrollLeft)).toBe(0);
    await f.up();
    await expect(leftovers(page)).toHaveCount(0);
  });

  test('a long press opens no context menu and selects no text (R7)', async ({ page }) => {
    await seed(page);
    // Bubbling listeners on window see whether the page default was left to run.
    await page.evaluate(() => {
      window.menus = [];
      for (const t of ['contextmenu', 'selectstart']) addEventListener(t, (e) => window.menus.push([t, e.defaultPrevented]));
    });
    const fire = () => page.evaluate(() => {
      const el = document.querySelector('.task--pressing, .task--placeholder').querySelector('.task__label');
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new Event('selectstart', { bubbles: true, cancelable: true }));
    });
    const f = await finger(page);
    await f.down(...(await label(page, 'Trả lời email')));
    await fire(); // during the hold
    await page.waitForTimeout(450);
    await fire(); // during the drag
    await page.waitForTimeout(300); // past the browser's own long press (500 ms)
    // Read while the finger is down: the selectstart a lift sends afterwards is the browser's tap, as on a plain tap today.
    const menus = await page.evaluate(() => window.menus);
    expect(menus.length).toBeGreaterThanOrEqual(4);
    expect(menus.every(([, prevented]) => prevented)).toBe(true);
    expect(await page.evaluate(() => getSelection().toString())).toBe('');
    await f.up();
    expect(await page.evaluate(() => getSelection().toString())).toBe('');
  });

  test('a long press on a row under the strip, lifted without moving, is a cancel (BUG-018)', async ({ page }) => {
    await seed(page);
    const r = row(page, 'Cắt tóc');
    await r.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => scrollBy(0, -250)); // the page end: the last row sits in the band the strip will cover
    const before = await rawAll(page);
    const [x, y] = await label(page, 'Cắt tóc');
    const f = await finger(page);
    await f.down(x, y);
    await page.waitForTimeout(450);
    expect(await dragging(page)).toBe(true);
    // The strip is now under the finger, but nothing is marked until the finger moves.
    expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.drop-target'), [x, y])).toBe(true);
    await f.move(x + 4, y + 3, 2); // a tremble inside the slop changes nothing
    await expect(page.locator('.drop-target--over, .group--drop')).toHaveCount(0);
    await f.up();
    await expect(leftovers(page)).toHaveCount(0);
    expect(await rawAll(page)).toEqual(before);
    await expect(page.locator('#sr-status')).toHaveText('Đã hủy. Việc vẫn ở nhóm "Chưa phân nhóm".');
  });

  test('after a lift in place the targets come back once the finger moves past the slop', async ({ page }) => {
    await seed(page);
    const f = await longPressDrag(page, row(page, 'Trả lời email'), null, { release: false });
    const t = target(page, 'Nhà');
    await f.move(...(await t.boundingBox().then((b) => [b.x + b.width / 2, b.y + b.height / 2])));
    await expect(t).toHaveClass(/drop-target--over/);
    await f.up();
    expect((await storedJson(page, KEY)).find((x) => x.id === 'b').groupId).toBe('nha');
  });

  test('a second finger during the hold cancels it, so a pinch never lifts a task; after the pick up it changes nothing', async ({ page }) => {
    await seed(page);
    await watch(page);
    const before = await rawAll(page);
    const [x, y] = await label(page, 'Trả lời email');
    const cdp = await page.context().newCDPSession(page);
    const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
    const one = { x, y, id: 0 }, two = { x: x + 120, y: y + 90, id: 1 };
    await send('touchStart', [one]);
    await page.waitForTimeout(100);
    await send('touchStart', [one, two]);
    await page.waitForTimeout(450);
    expect(await seen(page)).toEqual([]);
    await expect(page.locator('.task--pressing')).toHaveCount(0);
    await send('touchEnd', []);
    expect(await rawAll(page)).toEqual(before);

    await send('touchStart', [one]);
    await page.waitForTimeout(450);
    expect(await dragging(page)).toBe(true);
    await send('touchStart', [one, two]);
    await page.waitForTimeout(100);
    expect(await dragging(page)).toBe(true);
    await send('touchEnd', []);
    await cdp.detach();
    await expect(leftovers(page)).toHaveCount(0);
  });

  test('a finger resting above the strip scrolls the page, but only after it leaves the lift point (R31, BUG-018)', async ({ page }) => {
    await seed(page, LONG);
    const stripTop = () => strip(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => el.getBoundingClientRect().top));
    // Measure where the strip sits, then cancel with a lift in place.
    let f = await longPressDrag(page, row(page, 'Việc dài 4'), null, { release: false });
    const top = await stripTop();
    await f.up();
    await expect(leftovers(page)).toHaveCount(0);

    // Bring a row to 20 px above the strip and lift it there: no scroll while the finger has not moved.
    const [x, y0] = await label(page, 'Việc dài 6');
    await page.evaluate((dy) => scrollBy(0, dy), y0 - (top - 20));
    const [, y] = await label(page, 'Việc dài 6');
    expect(Math.abs(y - (top - 20))).toBeLessThan(2);
    const start = await scrollY(page);
    f = await finger(page);
    await f.down(x, y);
    await page.waitForTimeout(700);
    expect(await dragging(page)).toBe(true);
    expect(await scrollY(page)).toBe(start);
    await expect(page.locator('body > .drag-edge')).toHaveCount(0);

    // Past the slop the page scrolls down under the still finger and the sections it brings are marked.
    await page.evaluate(() => {
      window.marked = [];
      new MutationObserver((list) => {
        for (const m of list) if (m.target.classList.contains('group--drop')) window.marked.push(m.target.dataset.key);
      }).observe(document.getElementById('day-list'), { attributes: true, attributeFilter: ['class'], subtree: true });
    });
    await f.move(x, y - 12, 2);
    await expect.poll(() => scrollY(page)).toBeGreaterThan(start + 50);
    await expect(page.locator('body > .drag-edge')).toHaveClass(/drag-edge--down/);
    await expect.poll(() => page.evaluate(() => window.marked)).toContain('nha');
    expect(await strip(page).evaluate((el) => el.getBoundingClientRect().top)).toBe(top);
    await f.up();
    await expect(leftovers(page)).toHaveCount(0);
    const stop = await scrollY(page);
    await page.waitForTimeout(200);
    expect(await scrollY(page)).toBe(stop);
  });

  test.describe('360 px', () => {
    test.use({ viewport: { width: 360, height: 740 } });
    test('no sideways scroll while dragging, with the finger at either edge', async ({ page }) => {
      await seed(page);
      const f = await longPressDrag(page, row(page, 'Trả lời email'), null, { release: false });
      for (const x of [355, 4]) {
        await f.move(x, 300);
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sx: scrollX }));
        expect(m.sw).toBeLessThanOrEqual(m.cw);
        expect(m.sx).toBe(0);
        const s = await slip(page).boundingBox();
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x + s.width).toBeLessThanOrEqual(360);
      }
      await f.up();
      await expect(leftovers(page)).toHaveCount(0);
    });
  });
});
