import { chromium, devices } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
import fs from 'fs';
const EV='/home/gem/src/todo_list/docs/project/specs/daily-task-log/qa/evidence';
const KEY='daily-todo:tasks:v1', NOW=new Date('2026-11-09T09:00:00+07:00'), URL='http://localhost:4173/';
const T=(id,text,done=false,date='2026-11-09')=>({id,text,done,createdAt:1,date});
const SEED=[T('a','Một'),T('b','Hai'),T('o','Hôm qua',false,'2026-11-08')];
const out={}; const id=n=>`TC-daily-task-log-T10-${String(n).padStart(2,'0')}`;
const combos=[['1440','light',{viewport:{width:1440,height:900}}],['1440','dark',{viewport:{width:1440,height:900}}],['390','light',{...devices['Pixel 7'],viewport:{width:390,height:844}}],['390','dark',{...devices['Pixel 7'],viewport:{width:390,height:844}}]];
const b=await chromium.launch();
const logs={};
function rec(n,combo,k,v){(out[id(n)]??={});(out[id(n)][combo]??={})[k]=v;}
async function ctx(c,init,seed=SEED,extra){
  const [w,s,o]=c; const context=await b.newContext({locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',colorScheme:s,...o});
  const page=await context.newPage(); const errs=[]; const reqf=[];
  page.on('console',m=>errs.push(m.type()+': '+m.text())); page.on('pageerror',e=>errs.push('pageerror: '+e.message)); page.on('requestfailed',r=>reqf.push(r.url()));
  await page.clock.setFixedTime(NOW);
  if(seed!==null) await page.addInitScript(([k,v])=>{ if(!sessionStorage.getItem('seeded')){ localStorage.setItem(k,v); sessionStorage.setItem('seeded','1'); } },[KEY,typeof seed==='string'?seed:JSON.stringify(seed)]);
  if(init) await page.addInitScript(init);
  await page.goto(URL);
  return {context,page,errs,reqf};
}
const slipVis=p=>p.locator('#storage-slip').isVisible();
const snap=async(n,combo,p,name)=>{const d=`${EV}/${id(n)}`;fs.mkdirSync(d,{recursive:true});await p.screenshot({path:`${d}/${name}-${combo}.png`});};
const save=(n,combo,o)=>{const d=`${EV}/${id(n)}`;fs.mkdirSync(d,{recursive:true});fs.writeFileSync(`${d}/log-${combo}.json`,JSON.stringify(o,null,2));};
const BLOCK=()=>{const r=Storage.prototype.setItem;window.blockSaves=false;Storage.prototype.setItem=function(...a){if(window.blockSaves)throw new DOMException('Quota exceeded','QuotaExceededError');return r.apply(this,a)}};
const edit=async p=>{await p.locator('.task').nth(1).getByRole('button',{name:'Sửa'}).click({force:true});};

for(const c of combos){ const combo=`${c[0]}-${c[1]}`;
 // 01 getter throws
 { const x=await ctx(c,()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}}),null);
   const p=x.page; await p.waitForSelector('.task-list',{state:'attached'});
   const r={slipOnLoad:await slipVis(p),text:(await p.locator('#storage-slip').innerText()).trim(),empty:await p.locator('#empty').isVisible()};
   await snap(1,combo,p,'load');
   await p.getByLabel('Bạn cần làm gì hôm nay?').fill('Một'); await p.keyboard.press('Enter');
   await p.getByLabel('Bạn cần làm gì hôm nay?').fill('Hai'); await p.keyboard.press('Enter');
   await p.locator('.task').nth(0).locator('.check').click(); 
   r.rows=await p.locator('.task-list > .task').count(); r.status=await p.getByRole('status').innerText(); r.slipAfterWork=await slipVis(p); r.errs=x.errs;
   await snap(1,combo,p,'after-work'); rec(1,combo,'r',r); save(1,combo,r); await x.context.close(); }
 // 02..06 failed save per path, then recovery
 for(const [n,path] of [[2,'add'],[3,'tick'],[4,'edit'],[5,'delete']]){
   const x=await ctx(c,BLOCK); const p=x.page; await p.waitForSelector('.task');
   const r={slipBefore:await slipVis(p)}; await p.evaluate(()=>{window.blockSaves=true});
   const prev=await p.evaluate(k=>localStorage.getItem(k),KEY);
   const inp=p.getByLabel('Bạn cần làm gì hôm nay?');
   if(path==='add'){await inp.fill('Ba');await p.keyboard.press('Enter');}
   if(path==='tick'){await p.locator('.task').nth(0).locator('.check').click();}
   if(path==='edit'){await p.locator('.task').nth(1).hover();await p.locator('.task').nth(1).getByRole('button',{name:'Sửa'}).click({force:true});const e=p.locator('.task input[type=text], .task input:not([type=checkbox])').first();await e.fill('Hai sửa');await e.press('Enter');}
   if(path==='delete'){await p.locator('.task').nth(1).getByRole('button',{name:'Xóa'}).click({force:true});await p.locator('dialog').getByRole('button',{name:'Xóa việc'}).click();}
   r.slipImmediately=await slipVis(p); await p.waitForTimeout(600); r.slipAfter=await slipVis(p);
   r.rows=await p.locator('.task-list > .task').allInnerTexts(); r.storedUnchanged=(await p.evaluate(k=>localStorage.getItem(k),KEY))===prev;
   r.focusOk=await p.evaluate(()=>document.activeElement?.tagName); r.errs=x.errs;
   await snap(n,combo,p,'slip'); 
   if(path==='add'||path==='tick'){ // 06 recovery
     await p.evaluate(()=>{window.blockSaves=false}); await p.locator('.task').nth(1).locator('.check').click(); await p.waitForTimeout(300);
     const rr={slipAfterGoodSave:await slipVis(p),stored:JSON.parse(await p.evaluate(k=>localStorage.getItem(k),KEY)).map(t=>[t.text,t.done,t.date])};
     await snap(6,combo+'-'+path,p,'recovered'); rec(6,combo+'-'+path,'r',rr); save(6,combo+'-'+path,rr); }
   rec(n,combo,'r',r); save(n,combo,r); await x.context.close(); }
 // 07 NFR5 first read fails
 { const x=await ctx(c,()=>{const g=Storage.prototype.getItem,s=Storage.prototype.setItem;window.__g=g;window.__sets=[];Storage.prototype.getItem=function(k){if(k==='daily-todo:tasks:v1')throw new Error('read fail');return g.call(this,k)};Storage.prototype.setItem=function(k,v){window.__sets.push(k);return s.call(this,k,v)}});
   const p=x.page; await p.waitForSelector('.task-list',{state:'attached'}); const r={slipOnLoad:await slipVis(p),emptyShown:await p.locator('#empty').isVisible()};
   const inp=p.getByLabel('Bạn cần làm gì hôm nay?'); await inp.fill('Mới'); await p.keyboard.press('Enter'); await p.locator('.task').nth(0).locator('.check').click();
   await p.waitForTimeout(600); await p.locator('.task').nth(0).getByRole('button',{name:'Xóa'}).click({force:true}); await p.locator('dialog').getByRole('button',{name:'Xóa việc'}).click(); await p.waitForTimeout(500);
   r.setItemKeys=await p.evaluate(()=>window.__sets); r.storedEqualsSeed=(await p.evaluate(k=>window.__g.call(localStorage,k),KEY))===JSON.stringify(SEED); r.slipAfter=await slipVis(p); r.errs=x.errs;
   await snap(7,combo,p,'slip'); rec(7,combo,'r',r); save(7,combo,r); await x.context.close(); }
 // 08/09 corrupt variants
 for(const [lab,val] of [['badjson','{not json'],['object','{"a":1}'],['string','"x"'],['number','5'],['null','null'],['empty',''],['invaliditems','[{"bad":1},5]']]){
   const x=await ctx(c,null,val); const p=x.page; await p.waitForSelector('.task-list',{state:'attached'});
   const r={val,empty:await p.locator('#empty').isVisible(),rows:await p.locator('.task-list > .task').count(),slip:await slipVis(p),backup:await p.evaluate(k=>localStorage.getItem(k+':corrupt'),KEY),errs:x.errs};
   const inp=p.getByLabel('Bạn cần làm gì hôm nay?'); await inp.fill('Một'); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
   r.afterAddSlip=await slipVis(p); r.mainKeyAfterAdd=JSON.parse(await p.evaluate(k=>localStorage.getItem(k),KEY)).map(t=>t.text);
   if(lab==='badjson') await snap(8,combo,p,'empty-no-slip'); 
   const n=lab==='badjson'?8:9; rec(n,combo+'-'+lab,'r',r); save(n,combo+'-'+lab,r); await x.context.close(); }
 // 10 quota with existing data
 { const x=await ctx(c,()=>{const r=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='daily-todo:tasks:v1'&&v.length>200)throw new DOMException('quota','QuotaExceededError');return r.call(this,k,v)}});
   const p=x.page; await p.waitForSelector('.task'); const before=await p.evaluate(k=>localStorage.getItem(k),KEY); const r={slipBefore:await slipVis(p)};
   const inp=p.getByLabel('Bạn cần làm gì hôm nay?'); await inp.fill('x'.repeat(190)); await p.keyboard.press('Enter'); await p.waitForTimeout(150);
   r.slip=await slipVis(p); r.rows=await p.locator('.task-list > .task').count(); r.previousIntact=(await p.evaluate(k=>localStorage.getItem(k),KEY))===before; r.errs=x.errs;
   await snap(10,combo,p,'slip'); rec(10,combo,'r',r); save(10,combo,r); await x.context.close(); }
 // 11 a11y + 12 prototype compare
 { const x=await ctx(c,()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError')}}),null); const p=x.page; await p.waitForSelector('.task-list',{state:'attached'});
   const sl=p.locator('#storage-slip');
   const r=await sl.evaluate(e=>{const cs=getComputedStyle(e),pp=e.querySelector('p'),pc=getComputedStyle(pp);return{role:e.getAttribute('role'),ariaLive:e.getAttribute('aria-live'),hidden:e.hidden,iconHidden:e.querySelector('svg').getAttribute('aria-hidden'),inHeader:!!e.closest('header, .app-header'),color:pc.color,bg:cs.backgroundColor,font:pc.fontFamily.slice(0,40),size:pc.fontSize,w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height),border:cs.borderTopColor}});
   r.aria=await sl.ariaSnapshot(); r.focusOnInput=await p.evaluate(()=>document.activeElement?.id); r.hScroll=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   // toggle test: announcement needs hidden->visible transition on existing alert
   const y=await ctx(c,BLOCK); const q=y.page; await q.waitForSelector('.task');
   r.toggle={domPresentWhenHidden:await q.locator('#storage-slip').count(),displayWhenHidden:await q.locator('#storage-slip').evaluate(e=>getComputedStyle(e).display)};
   await q.evaluate(()=>{window.blockSaves=true;window.__mut=[];new MutationObserver(m=>m.forEach(x=>window.__mut.push(x.attributeName+':'+x.target.hidden))).observe(document.getElementById('storage-slip'),{attributes:true})});
   await q.locator('.task').nth(0).locator('.check').click(); await q.waitForTimeout(100);
   r.toggle.mutations=await q.evaluate(()=>window.__mut); r.toggle.displayWhenShown=await q.locator('#storage-slip').evaluate(e=>getComputedStyle(e).display);
   r.toggle.focusKept=await q.evaluate(()=>document.activeElement?.tagName+':'+document.activeElement?.className.slice(0,20));
   await y.context.close();
   // prototype
   const pp=await x.context.newPage(); await pp.goto('http://localhost:4173/docs/project/specs/daily-task-log/ux/screens/today--storage-error.html');
   r.proto=await pp.locator('.alert').first().evaluate(e=>{const cs=getComputedStyle(e),pc=getComputedStyle(e.querySelector('p'));return{color:pc.color,bg:cs.backgroundColor,font:pc.fontFamily.slice(0,40),size:pc.fontSize,w:Math.round(e.getBoundingClientRect().width),h:Math.round(e.getBoundingClientRect().height),border:cs.borderTopColor,text:e.innerText.trim()}});
   await snap(12,combo,pp,'prototype'); await snap(12,combo,p,'app'); 
   await snap(11,combo,p,'slip'); rec(11,combo,'r',r); save(11,combo,r); save(12,combo,{app:r,proto:r.proto}); await x.context.close(); }
}
await b.close();
fs.writeFileSync('/tmp/claude-1000/-home-gem-src-todo-list/832f85e5-a60f-4d79-a693-e0ce7014eb66/scratchpad/qa/out.json',JSON.stringify(out,null,1));
console.log('done');
