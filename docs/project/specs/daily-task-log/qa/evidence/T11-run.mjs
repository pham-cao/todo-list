import { chromium, devices } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
import fs from 'fs';
const EV='/home/gem/src/todo_list/docs/project/specs/daily-task-log/qa/evidence';
const KEY='daily-todo:tasks:v1', URL='http://localhost:4173/';
const MON=new Date('2026-11-09T09:00:00+07:00'), TUE=new Date('2026-11-10T00:05:00+07:00');
const T=(id,text,done=false,date='2026-11-09')=>({id,text,done,createdAt:1,date});
const SEED=[T('a','Một'),T('b','Hai',true),T('o','Hôm qua',false,'2026-11-08')];
const id=n=>`TC-daily-task-log-T11-${String(n).padStart(2,'0')}`;
const combos=[['1440','light',{viewport:{width:1440,height:900}}],['1440','dark',{viewport:{width:1440,height:900}}],['390','light',{...devices['Pixel 7'],viewport:{width:390,height:844}}],['390','dark',{...devices['Pixel 7'],viewport:{width:390,height:844}}]];
const b=await chromium.launch();
const results={};
async function ctx(c,{init,seed=SEED,now=MON}={}){
  const [w,s,o]=c; const context=await b.newContext({locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',colorScheme:s,...o});
  const page=await context.newPage(); const errs=[];
  page.on('console',m=>['error','warning'].includes(m.type())&&errs.push(m.type()+': '+m.text())); page.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await page.clock.setFixedTime(now);
  if(seed) await page.addInitScript(([k,v])=>{ if(!sessionStorage.getItem('seeded')){ localStorage.setItem(k,v); sessionStorage.setItem('seeded','1'); } },[KEY,JSON.stringify(seed)]);
  if(init) await page.addInitScript(init);
  await page.goto(URL); await page.waitForSelector('.app-header__date');
  return {context,page,errs};
}
const snap=async(n,combo,p,name)=>{const d=`${EV}/${id(n)}`;fs.mkdirSync(d,{recursive:true});await p.screenshot({path:`${d}/${name}-${combo}.png`});};
const save=(n,combo,o)=>{const d=`${EV}/${id(n)}`;fs.mkdirSync(d,{recursive:true});fs.writeFileSync(`${d}/log-${combo}.json`,JSON.stringify(o,null,2));(results[id(n)]??={})[combo]=o;};
const vis=p=>p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
const focus=p=>p.evaluate(()=>window.dispatchEvent(new Event('focus')));
const date=p=>p.locator('.app-header__date').innerText();
const rowsN=p=>p.locator('.task-list > .task').count();
const stored=p=>p.evaluate(k=>localStorage.getItem(k),KEY);
const INP='Bạn cần làm gì hôm nay?';
for(const c of combos){ const combo=`${c[0]}-${c[1]}`;
 // 01 visibilitychange (real hidden->visible simulated via emulate not possible; dispatch with visibilityState visible)
 { const x=await ctx(c),p=x.page; const r={before:await date(p),rowsBefore:await rowsN(p)}; const raw=await stored(p);
   await snap(1,combo,p,'before'); await p.clock.setFixedTime(TUE); await vis(p);
   r.after=await date(p); r.rowsAfter=await rowsN(p); r.emptyVisible=await p.locator('#empty').isVisible(); r.progressHidden=!(await p.locator('.progress').isVisible()); r.summaryHidden=!(await p.locator('.summary').isVisible());
   r.storedUnchanged=(await stored(p))===raw; r.focusOnAdd=await p.getByLabel(INP).evaluate(e=>e===document.activeElement); r.errs=x.errs; await snap(1,combo,p,'after'); save(1,combo,r); await x.context.close(); }
 // 02 window focus
 { const x=await ctx(c),p=x.page; const raw=await stored(p); await p.clock.setFixedTime(TUE); await focus(p);
   const r={after:await date(p),rowsAfter:await rowsN(p),emptyVisible:await p.locator('#empty').isVisible(),storedUnchanged:(await stored(p))===raw,errs:x.errs}; await snap(2,combo,p,'after'); save(2,combo,r); await x.context.close(); }
 // 03 add right after midnight, no event
 { const x=await ctx(c),p=x.page; await p.clock.setFixedTime(TUE); await p.getByLabel(INP).fill('Việc ngày mới'); await p.keyboard.press('Enter');
   const s=JSON.parse(await stored(p));
   const r={date:await date(p),rows:await p.locator('.task__label').allInnerTexts(),status:await p.getByRole('status').innerText(),stored:s.map(t=>[t.text,t.date]),errs:x.errs}; await snap(3,combo,p,'after'); save(3,combo,r); await x.context.close(); }
 // 04 same day no-op (edit open and delete note kept)
 { const x=await ctx(c),p=x.page; await p.locator('.task').nth(0).getByRole('button',{name:'Sửa'}).click({force:true}); await p.locator('.task__edit .input').fill('Đang sửa');
   await p.clock.setFixedTime(new Date('2026-11-09T23:59:59.999+07:00')); await vis(p); await focus(p);
   const r={date:await date(p),editOpen:await p.locator('.task__edit').count(),editValue:await p.locator('.task__edit .input').inputValue(),rows:await rowsN(p),errs:x.errs}; await snap(4,combo,p,'after'); save(4,combo,r); await x.context.close(); }
 // 05 open edit during day change
 { const x=await ctx(c),p=x.page; await p.locator('.task').nth(0).getByRole('button',{name:'Sửa'}).click({force:true}); await p.locator('.task__edit .input').fill('Chưa lưu');
   const raw=await stored(p); await p.clock.setFixedTime(TUE); await vis(p);
   const r={date:await date(p),editCount:await p.locator('.task__edit').count(),rows:await rowsN(p),storedUnchanged:(await stored(p))===raw,focusOnAdd:await p.getByLabel(INP).evaluate(e=>e===document.activeElement),errs:x.errs};
   await p.getByLabel(INP).fill('Sau khi bỏ sửa'); await p.keyboard.press('Enter'); r.addWorks=await p.locator('.task__label').allInnerTexts(); await snap(5,combo,p,'after'); save(5,combo,r); await x.context.close(); }
 // 06 delete note during day change
 { const x=await ctx(c),p=x.page; await p.locator('.task').nth(1).getByRole('button',{name:'Xóa'}).click({force:true});
   const r={noteBefore:await p.locator('#delete-dialog').isVisible()}; const raw=await stored(p); await p.clock.setFixedTime(TUE); await focus(p);
   r.noteAfter=await p.locator('#delete-dialog').isVisible(); r.date=await date(p); r.rows=await rowsN(p); r.storedUnchanged=(await stored(p))===raw; r.focusOnAdd=await p.getByLabel(INP).evaluate(e=>e===document.activeElement); r.errs=x.errs;
   await p.keyboard.press('Tab'); r.noInertTrap=await p.evaluate(()=>!document.querySelector('dialog[open]'));
   await snap(6,combo,p,'after'); save(6,combo,r); await x.context.close(); }
 // 07 yesterday kept and still visible after returning next midnight? Monday 10 tasks stay; then go back to Monday (clock back) shows them
 { const x=await ctx(c),p=x.page; const raw=await stored(p); await p.clock.setFixedTime(TUE); await vis(p); await p.getByLabel(INP).fill('Thứ Ba'); await p.keyboard.press('Enter');
   const s=JSON.parse(await stored(p)); const mon=s.filter(t=>t.date!=='2026-11-10'); const r={mondayAndOlderIntact:JSON.stringify(mon)===JSON.stringify(JSON.parse(raw)),total:s.length,errs:x.errs};
   await p.clock.setFixedTime(MON); await vis(p); r.backToMonday=await p.locator('.task__label').allInnerTexts(); r.dateMon=await date(p); save(7,combo,r); await x.context.close(); }
 // 08 storage locked across midnight
 { const x=await ctx(c,{seed:null,init:()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}})}),p=x.page;
   await p.getByLabel(INP).fill('Một'); await p.keyboard.press('Enter'); const r={slipBefore:await p.locator('#storage-slip').isVisible(),rowsBefore:await rowsN(p)};
   await p.clock.setFixedTime(TUE); await vis(p); r.date=await date(p); r.rowsAfter=await rowsN(p); r.emptyVisible=await p.locator('#empty').isVisible(); r.slipAfter=await p.locator('#storage-slip').isVisible();
   await p.getByLabel(INP).fill('Hai'); await p.keyboard.press('Enter'); r.rowsAfterAdd=await p.locator('.task__label').allInnerTexts(); r.errs=x.errs; await snap(8,combo,p,'after'); save(8,combo,r); await x.context.close(); }
 // 09 timezone edge: 23:59:59 vs 00:00:00 local, Asia/Ho_Chi_Minh (UTC+7)
 { const x=await ctx(c,{now:new Date('2026-11-09T23:59:59+07:00')}),p=x.page; const r={at235959:await date(p)};
   await p.clock.setFixedTime(new Date('2026-11-09T23:59:59.999+07:00')); await vis(p); r.at235959_999=await date(p);
   await p.clock.setFixedTime(new Date('2026-11-10T00:00:00+07:00')); await vis(p); r.at000000=await date(p); r.rows=await rowsN(p);
   await p.clock.setFixedTime(new Date('2026-11-09T16:59:59Z')); await vis(p); r.utc165959Back=await date(p);
   await p.clock.setFixedTime(new Date('2026-11-09T17:00:00Z')); await vis(p); r.utc170000=await date(p);
   r.tz=await p.evaluate(()=>Intl.DateTimeFormat().resolvedOptions().timeZone); r.errs=x.errs; await snap(9,combo,p,'after'); save(9,combo,r); await x.context.close(); }
 // 10 celebrate and swipe hint not replayed; focus handling
 { const x=await ctx(c,{seed:[T('a','Một'),T('n','Mai',true,'2026-11-10')]}),p=x.page; await p.locator('.task').first().locator('.check__box').click();
   const r={celebrateBefore:await p.locator('.progress--celebrate').count()}; await p.clock.setFixedTime(TUE); await vis(p);
   r.celebrateAfter=await p.locator('.progress--celebrate').count(); r.peek=await p.locator('.task--peek').count(); r.rows=await p.locator('.task__label').allInnerTexts(); r.errs=x.errs; save(10,combo,r); await x.context.close(); }
 // 11 visual vs prototype: computed styles of date, title, empty text and input
 { const x=await ctx(c,{seed:[T('o','Hôm qua',false,'2026-11-08')]}),p=x.page; await p.clock.setFixedTime(TUE); await vis(p);
   const pick=()=>{const q=s=>{const e=document.querySelector(s); if(!e||e.hidden||!e.getClientRects().length) return null; const cs=getComputedStyle(e),r=e.getBoundingClientRect(); return {text:e.textContent.trim().replace(/\s+/g,' '),color:cs.color,bg:cs.backgroundColor,font:cs.fontFamily,size:cs.fontSize,weight:cs.fontWeight,w:Math.round(r.width),h:Math.round(r.height)}}; return {title:q('.app-header__title'),date:q('.app-header__date'),emptyText:q('.empty__text'),empty:q('.empty'),sheet:q('.sheet'),add:q('.add-form'),progress:q('.progress'),summary:q('.summary')}};
   const app=await p.evaluate(pick); await snap(11,combo,p,'app');
   const pp=await x.context.newPage(); await pp.goto('file:///home/gem/src/todo_list/docs/project/specs/daily-task-log/ux/screens/today--new-day.html'); await pp.waitForSelector('.app-header__date'); const proto=await pp.evaluate(pick); await pp.screenshot({path:`${EV}/${id(11)}/proto-${combo}.png`});
   const diffs=Object.keys(app).filter(k=>JSON.stringify(app[k])!==JSON.stringify(proto[k])).map(k=>({k,app:app[k],proto:proto[k]}));
   save(11,combo,{match:diffs.length===0,diffs,errs:x.errs}); await x.context.close(); }
}
await b.close(); fs.writeFileSync(`${EV}/T11-out.json`,JSON.stringify(results,null,1));
console.log(JSON.stringify(results).length);
