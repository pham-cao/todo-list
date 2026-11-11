import { chromium, devices } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
import fs from 'fs';
import AxeBuilder from '/home/gem/src/todo_list/node_modules/@axe-core/playwright/dist/index.mjs';
const axeLog = [];
const ROOT = '/home/gem/src/todo_list', OUT = process.argv[2], BASE = 'http://localhost:4173';
const UX = 'file://' + ROOT + '/docs/project/specs/drag-drop/ux/screens/';
const COL = { cty: 'yellow', nha: 'pink', jp: 'green', sk: 'blue' };
const NOW = new Date('2026-11-10T09:00:00+07:00');
const browser = await chromium.launch();
const mk = async (w, h, scheme, touch) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh', colorScheme: scheme, ...(touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : {}) });
  return ctx;
};
// seed data from a prototype html
async function extract(page, file) {
  await page.goto(UX + file + '.html');
  return page.evaluate(() => {
    const names = {}; [...document.querySelectorAll('#group-filter option')].forEach((o, i) => { if (i > 1) names[o.value] = o.textContent; });
    const groups = Object.entries(names).map(([id, name], i) => ({ id, name, createdAt: i + 1 }));
    const tasks = []; let ids = [];
    document.querySelectorAll('section.group').forEach((s) => {
      const gname = s.querySelector('.group__name')?.textContent;
      const gid = Object.keys(names).find((k) => names[k] === gname);
      s.querySelectorAll('.task').forEach((t) => {
        const id = t.querySelector('.task__text').id.replace(/^t-|-text$/g, '');
        tasks.push({ n: +id, text: t.querySelector('.task__label').textContent, done: t.querySelector('input').checked, groupId: gid });
      });
    });
    return { groups, tasks };
  });
}
const states = process.env.ONLY ? [process.env.ONLY] : ['resting','lifted','hover-section','hover-strip','cancelled','autoscroll','dropped','dropped--strip','folded','folded--dropped','filtered','filtered--dropped','phone-hold','phone-drag'];
const results = [];
for (const scheme of ['light', 'dark']) for (const [vp, w, h] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
  const px = await mk(w, h, scheme, vp === 'mobile'); const pp = await px.newPage();
  const data = {}; for (const f of ['resting', 'autoscroll']) data[f] = await extract(pp, f);
  await px.close();
  for (const st of states) {
    if (vp === 'desktop' && st.startsWith('phone')) continue;
    const d = st === 'autoscroll' ? data.autoscroll : data.resting;
    const ctx = await mk(w, h, scheme, vp === 'mobile');
    const page = await ctx.newPage();
    // app
    await page.clock.setFixedTime(NOW);
    const tasks = d.tasks.map((t) => ({ id: 't' + t.n, text: t.text, done: t.done, createdAt: t.n * 1000, date: '2026-11-10', ...(t.groupId ? { groupId: t.groupId } : {}) }));
    const groups = d.groups.map((g) => ({ ...g, color: COL[g.id] }));
    const ui = st.startsWith('folded') ? { collapsed: ['nha'] } : undefined;
    await page.addInitScript(([t, g, u]) => { if (sessionStorage.getItem('s')) return; localStorage.setItem('daily-todo:tasks:v1', JSON.stringify(t)); localStorage.setItem('daily-todo:groups:v1', JSON.stringify(g)); if (u) localStorage.setItem('daily-todo:ui:v1', JSON.stringify(u)); sessionStorage.setItem('s', '1'); }, [tasks, groups, ui]);
    await page.goto(BASE + '/');
    await page.waitForSelector('.task');
    if (st.startsWith('filtered')) await page.selectOption('#group-filter', 'cty');
    const lab = (txt) => page.locator('.task__label', { hasText: txt }).first();
    const SRC = st === 'autoscroll' ? 'Gọi điện hẹn lịch cắt tóc' : st === 'filtered--dropped' ? 'Họp với nhóm thiết kế' : 'Trả lời email của khách hàng';
    const nha = () => page.locator('.group__toggle', { hasText: 'Nhà' }).first();
    const tgt = (n) => page.locator('.drop-target', { hasText: n }).first();
    const ctr = async (l) => { const b = await l.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
    const touch = vp === 'mobile';
    const cdp = touch ? await ctx.newCDPSession(page) : null; let at = [0, 0];
    const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const mv = async (x, y, steps = 8) => { if (!touch) return page.mouse.move(x, y, { steps }); const [x0, y0] = at; for (let i = 1; i <= steps; i++) { await send('touchMove', [{ x: x0 + (x - x0) * i / steps, y: y0 + (y - y0) * i / steps }]); await page.waitForTimeout(16); } at = [x, y]; };
    const up = async () => touch ? send('touchEnd', []) : page.mouse.up();
    const press = async (txt) => { if (st === 'autoscroll') await lab(txt).scrollIntoViewIfNeeded(); const b = await lab(txt).boundingBox(); const x = b.x + 60, y = b.y + b.height / 2; if (touch) { at = [x, y]; await send('touchStart', [{ x, y }]); await page.waitForTimeout(450); await mv(x, y + 14, 4); await mv(x + 10, y + 30, 4); } else { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 10, y + 20, { steps: 6 }); } return [x, y]; };
    if (st === 'lifted' || st === 'cancelled') { await press(SRC); const f = await page.locator('.group-bar .select').boundingBox(); await mv(f.x + 60, f.y + 10, 6); if (st === 'cancelled') { if (!touch) await page.keyboard.press('Escape'); await up(); } }
    if (st === 'hover-section' || st === 'dropped' || st === 'folded' || st === 'folded--dropped') { await press(SRC); await mv(...(await ctr(nha())), 6); if (st.endsWith('dropped')) await up(); }
    if (st === 'hover-strip' || st === 'dropped--strip' || st === 'filtered') { await press(SRC); await page.waitForSelector('.drop-strip'); await mv(...(await ctr(tgt(st === 'filtered' ? 'Nhà' : 'Sức khỏe'))), 6); if (st === 'dropped--strip') await up(); }
    if (st === 'filtered--dropped') { await press(SRC); await page.waitForSelector('.drop-strip'); await mv(...(await ctr(tgt('Nhà'))), 6); await up(); }
    if (st === 'autoscroll') { await press(SRC); await page.waitForSelector('.drop-strip'); const s = await page.locator('.drop-strip').boundingBox(); await mv(touch ? 200 : 400, s.y - 20, 6); }
    if (st === 'phone-hold' || st === 'phone-drag') {
      const b = await lab(SRC).boundingBox(); const x = b.x + 60, y = b.y + b.height / 2;
      await send('touchStart', [{ x, y }]);
      if (st === 'phone-hold') await page.waitForTimeout(300);
      else { await page.waitForTimeout(450); await page.waitForSelector('.drop-strip'); const t = await ctr(tgt('Nhà')); for (let i = 1; i <= 8; i++) { await send('touchMove', [{ x: x + (t[0] - x) * i / 8, y: y + (t[1] - y) * i / 8 }]); await page.waitForTimeout(16); } }
    }
    if (st === 'phone-hold') {} else if (st === 'dropped' || st === 'dropped--strip' || st === 'folded--dropped') await page.waitForTimeout(150); else await page.waitForTimeout(900);
    { const r = await new AxeBuilder({ page }).analyze(); axeLog.push(`${st} ${vp} ${scheme}: ${r.violations.length} violations ${r.violations.map((v) => v.id + ':' + v.nodes.map((n) => n.target.join(' ')).join(',')).join(' | ')} (passes ${r.passes.length}, incomplete ${r.incomplete.map((i) => i.id).join(',')})`); }
    await page.screenshot({ path: `${OUT}/${st}-${vp}-${scheme}-app.png` });
    if (process.env.AXE) { await ctx.close(); continue; }
    // prototype, note hidden
    const pr = await ctx.newPage();
    await pr.goto(UX + st + '.html');
    await pr.addStyleTag({ content: '.proto{display:none!important} *{animation:none!important;transition:none!important}' });
    await pr.waitForTimeout(300);
    await pr.screenshot({ path: `${OUT}/${st}-${vp}-${scheme}-proto.png` });
    await ctx.close();
  }
}
fs.writeFileSync(OUT + '/axe.txt', axeLog.join('\n') + '\n');
await browser.close();
