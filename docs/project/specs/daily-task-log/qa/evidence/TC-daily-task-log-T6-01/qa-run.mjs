import { chromium, devices } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
import fs from 'fs';
const E='/home/gem/src/todo_list/docs/project/specs/daily-task-log/qa/evidence';
const KEY='daily-todo:tasks:v1', NOW=new Date('2026-11-09T09:00:00+07:00');
const t=(id,text,done=false)=>({id,text,done,createdAt:NOW.getTime(),date:'2026-11-09'});
const log={};
const L=(tc,s)=>{ (log[tc]??=[]).push(s); console.log(tc,s); };
const b=await chromium.launch();
async function mk(vp,scheme,touch){
  const ctx=await b.newContext({viewport:vp,locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',colorScheme:scheme,hasTouch:!!touch,isMobile:!!touch,deviceScaleFactor:1});
  const page=await ctx.newPage(); const errs=[];
  page.on('console',m=>m.type()==='error'&&errs.push(m.text())); page.on('pageerror',e=>errs.push(e.message));
  await page.clock.setFixedTime(NOW);
  return {ctx,page,errs};
}
async function seed(page,tasks){
  await page.addInitScript(([k,v])=>{ if(sessionStorage.getItem('s'))return; localStorage.setItem(k,v); sessionStorage.setItem('s','1');},[KEY,JSON.stringify(tasks)]);
  await page.goto('http://localhost:4173/');
}
const rows=p=>p.locator('.task-list > .task');
const cb=(p,i)=>rows(p).nth(i).getByRole('checkbox');
const stored=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)).map(x=>x.done),KEY);
const status=p=>p.getByRole('status').innerText();
for (const [vn,vp,touch] of [['1440',{width:1440,height:900},false],['390',{width:390,height:844},true]])
for (const scheme of ['light','dark']) {
  const tag=`${vn}-${scheme}`;
  const {ctx,page,errs}=await mk(vp,scheme,touch);
  await seed(page,[t('a','Gửi báo cáo tuần',true),t('b','Đi chợ mua rau'),t('c','Gọi điện cho mẹ')]);
  // TC-01 tick via pointer (mouse or tap), real click on drawn box
  const box=rows(page).nth(1).locator('.check__box');
  touch? await box.tap(): await box.click();
  const ok1=await cb(page,1).isChecked(), st=await status(page), s=await stored(page);
  const p=await page.locator('.progress').evaluate(e=>getComputedStyle(e).getPropertyValue('--p'));
  const order=await rows(page).locator('.task__label').allInnerTexts();
  L('T6-01',`${tag} tick checked=${ok1} summary="${st}" stored=${JSON.stringify(s)} --p=${p} order=${order.join('|')}`);
  await page.screenshot({path:`${E}/TC-daily-task-log-T6-01/tick-${tag}.png`});
  // TC-02 reload persistence + untick
  await page.reload();
  L('T6-02',`${tag} after reload checked=${await cb(page,1).isChecked()} summary="${await status(page)}"`);
  touch? await rows(page).nth(1).locator('.check__box').tap(): await rows(page).nth(1).locator('.check__box').click();
  L('T6-02',`${tag} untick checked=${await cb(page,1).isChecked()} stored=${JSON.stringify(await stored(page))} summary="${await status(page)}"`);
  await page.reload();
  L('T6-02',`${tag} reload after untick checked=${await cb(page,1).isChecked()} stored=${JSON.stringify(await stored(page))}`);
  await page.screenshot({path:`${E}/TC-daily-task-log-T6-02/untick-reload-${tag}.png`});
  // TC-03 keyboard Space (only needed once per scheme at desktop; do all anyway)
  await cb(page,1).focus();
  await page.keyboard.press('Space');
  L('T6-03',`${tag} Space tick checked=${await cb(page,1).isChecked()} stored=${JSON.stringify(await stored(page))} focused=${await cb(page,1).evaluate(e=>document.activeElement===e)}`);
  await page.screenshot({path:`${E}/TC-daily-task-log-T6-03/space-focus-${tag}.png`});
  await page.keyboard.press('Space');
  L('T6-03',`${tag} Space untick checked=${await cb(page,1).isChecked()} stored=${JSON.stringify(await stored(page))}`);
  await cb(page,1).focus(); await page.keyboard.press('Space');
  // TC-04 stamp + celebrate timing; observe class changes with timestamps
  await page.evaluate(()=>{ window.__ev=[]; const el=document.querySelector('.progress'); const t0=()=>performance.now(); window.__t=null;
    new MutationObserver(()=>{window.__ev.push([Math.round(performance.now()),el.className])}).observe(el,{attributes:true,attributeFilter:['class']});
    document.addEventListener('change',()=>{window.__t=performance.now();window.__ev.push([Math.round(performance.now()),'CHANGE'])},true);});
  await cb(page,2).focus(); await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await page.screenshot({path:`${E}/TC-daily-task-log-T6-04/celebrate-150ms-${tag}.png`});
  await page.waitForTimeout(1300);
  const ev=await page.evaluate(()=>window.__ev), t0=ev[0][0];
  L('T6-04',`${tag} events(ms from tick)=${JSON.stringify(ev.map(e=>[e[0]-t0,e[1]]))} summary="${await status(page)}"`);
  await page.screenshot({path:`${E}/TC-daily-task-log-T6-04/complete-settled-${tag}.png`});
  const pc=await page.locator('.progress').getAttribute('class');
  L('T6-04',`${tag} settled class="${pc}"`);
  // TC-05 untick removes; re-tick; add removes; reload keeps complete without celebrate
  await page.keyboard.press('Space'); // untick b
  L('T6-05',`${tag} untick class="${await page.locator('.progress').getAttribute('class')}"`);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1200);
  await page.reload(); L('T6-05',`${tag} reload all-done class="${await page.locator('.progress').getAttribute('class')}" (expect complete only)`);
  await page.getByLabel('Bạn cần làm gì hôm nay?').fill('Việc mới'); await page.keyboard.press('Enter');
  L('T6-05',`${tag} add while all done class="${await page.locator('.progress').getAttribute('class')}" summary="${await status(page)}"`);
  // last-tick of a full set: tick the remaining open new task via keyboard, check class again; then delete-less
  L('T6-05',`${tag} console errors=${JSON.stringify(errs)}`);
  await ctx.close();
}
// TC-07 overlay analysis (desktop, mouse)
{
  const {ctx,page}=await mk({width:1440,height:900},'light',false);
  await seed(page,[t('a','Một'),t('b','Hai')]);
  const r=await page.evaluate(()=>{ const c=document.querySelector('.task .check'), i=c.querySelector('input'), bx=c.querySelector('.check__box');
    const R=e=>{const q=e.getBoundingClientRect();return [q.x,q.y,q.width,q.height].map(Math.round)};
    const hit=(x,y)=>{const e=document.elementFromPoint(x,y);return e.tagName+'.'+e.className};
    const q=bx.getBoundingClientRect(), cr=c.getBoundingClientRect();
    return {input:R(i),box:R(bx),check:R(c),centerHit:hit(q.x+q.width/2,q.y+q.height/2),ringHit:hit(cr.x+3,cr.y+3),inputOpacity:getComputedStyle(i).opacity,boxAria:bx.getAttribute('aria-hidden'),inLabel:!!i.closest('label')}});
  L('T6-07',`geometry ${JSON.stringify(r)}`);
  // click ring area outside box (still inside 44px target)
  const cr=await page.locator('.task .check').first().boundingBox();
  await page.mouse.click(cr.x+3,cr.y+3);
  L('T6-07',`click on target ring (outside drawn box): checked=${await cb(page,0).isChecked()}`);
  await page.mouse.click(cr.x+cr.width/2,cr.y+cr.height/2);
  L('T6-07',`click on box centre toggles back: checked=${await cb(page,0).isChecked()}`);
  const to=await Promise.race([cb(page,0).check({timeout:3000}).then(()=>'check() ok'),new Promise(r=>setTimeout(()=>r('x'),3500))]).catch(e=>'check() fails: '+e.message.split('\n').slice(0,4).join(' / '));
  L('T6-07',`locator.check(): ${to}`);
  const tree=await page.locator('.task').first().ariaSnapshot();
  L('T6-07',`aria snapshot: ${tree.replace(/\n/g,' ')}`);
  // simulate suggested fix
  await page.evaluate(()=>document.querySelectorAll('.check__box').forEach(e=>e.style.pointerEvents='none'));
  const hit=await page.evaluate(()=>{const q=document.querySelector('.check__box').getBoundingClientRect();const e=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return e.tagName});
  const ck=await cb(page,1).check({timeout:3000}).then(()=>'check() ok with fix').catch(()=>'still fails');
  L('T6-07',`with pointer-events:none centre hit=${hit}; ${ck}; hover on .check still styles: ${await page.locator('.task .check').first().evaluate(e=>true)}`);
  await ctx.close();
}
await b.close();
fs.writeFileSync('/tmp/x/qa.json',JSON.stringify(log,null,1));
