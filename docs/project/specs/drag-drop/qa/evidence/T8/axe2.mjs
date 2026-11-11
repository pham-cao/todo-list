import { chromium } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
import AxeBuilder from '/home/gem/src/todo_list/node_modules/@axe-core/playwright/dist/index.mjs';
import fs from 'fs';
const NOW = new Date('2026-11-10T09:00:00+07:00');
const G = [['cty','Công ty','yellow'],['nha','Nhà','pink'],['sk','Sức khỏe','blue']].map(([id,name,color],i)=>({id,name,color,createdAt:i+1}));
const T = [['a','Gửi báo cáo',true,'cty'],['b','Họp nhóm',false,'cty'],['c','Trả lời email',false,'cty'],['d','Tiền điện',false,'nha'],['e','Cắt tóc',false,null]].map(([id,text,done,g],i)=>({id,text,done,createdAt:(i+1)*1000,date:'2026-11-10',...(g?{groupId:g}:{})}));
const Y = [{ id: 'y', text: 'Việc hôm qua', done: false, createdAt: 1, date: '2026-11-09', groupId: 'cty' }];
const b = await chromium.launch(); const log = [];
for (const scheme of ['light','dark']) for (const [vp,w,h] of [['desktop',1440,900],['mobile',390,844]]) {
  const ctx = await b.newContext({ viewport:{width:w,height:h}, locale:'vi-VN', timezoneId:'Asia/Ho_Chi_Minh', colorScheme:scheme, ...(vp==='mobile'?{hasTouch:true,isMobile:true}:{}) });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(([t,g]) => { if (sessionStorage.getItem('s')) return; localStorage.setItem('daily-todo:tasks:v1', JSON.stringify(t)); localStorage.setItem('daily-todo:groups:v1', JSON.stringify(g)); sessionStorage.setItem('s','1'); }, [[...T, ...Y], G]);
  await page.goto('http://localhost:4173/'); await page.waitForSelector('.task');
  const scan = async (n, extra='') => { const r = await new AxeBuilder({ page }).analyze(); log.push(`${n} ${vp} ${scheme}: ${r.violations.length} violations ${r.violations.map(v=>v.id+':'+v.nodes.map(x=>x.target.join(' ')).join(',')).join(' | ')} ${extra}`); };
  await scan('day today');
  // info slip: filter Công ty, move task through Sửa to Nhà
  await page.selectOption('#group-filter','cty');
  const row = page.locator('.task',{hasText:'Trả lời email'});
  await row.getByRole('button',{name:'Sửa'}).click({force:true});
  await page.locator('.task__edit').getByRole('combobox',{name:'Nhóm',exact:true}).selectOption({label:'Nhà'});
  await page.locator('.task__edit .input').press('Enter');
  await page.waitForTimeout(400);
  const txt = (await page.locator('#notice:visible').textContent().catch(()=>'NOT VISIBLE')).trim();
  await scan('info slip', `[slip: ${txt}]`);
  await page.selectOption('#group-filter','all');
  await page.goto('http://localhost:4173/#2026-11-09'); await page.waitForTimeout(300); await scan('day yesterday');
  await page.goto('http://localhost:4173/'); await page.waitForSelector('.task');
  await page.getByRole('button',{name:/Quản lý nhóm/}).or(page.locator('.group-bar__manage')).first().click(); await page.waitForTimeout(400);
  await scan('manage dialog', `[dialogs open: ${await page.locator('dialog[open]').count()}]`);
  await page.keyboard.press('Escape');
  const r2 = page.locator('.task').first(); await r2.hover(); await r2.getByLabel('Xóa').click().catch(()=>{}); await page.waitForTimeout(300);
  await scan('delete note', `[delete note: ${await page.locator('#delete-dialog[open], .delete-note:visible').count()}]`);
  await ctx.close();
}
fs.writeFileSync('axe/axe2.txt', log.join('\n')+'\n'); console.log(log.join('\n')); await b.close();
