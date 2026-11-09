import { chromium } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
import fs from 'fs';
const EV='/home/gem/src/todo_list/docs/project/specs/daily-task-log/qa/evidence/';
const P='TC-daily-task-log-T7-';
const NOW=new Date('2026-11-09T09:00:00+07:00');
const KEY='daily-todo:tasks:v1';
const seed=[{id:'a',text:'Gửi báo cáo tuần cho chị Lan trước 10 giờ',done:true,createdAt:1,date:'2026-11-09'},{id:'b',text:'Đi chợ mua rau muống, trứng và sữa tươi',done:false,createdAt:2,date:'2026-11-09'},{id:'c',text:'Gọi điện đặt lịch khám răng cho bé Na',done:false,createdAt:3,date:'2026-11-09'}];
const out={};
const b=await chromium.launch();
async function mk(w,h,scheme,tasks=seed){
  const ctx=await b.newContext({viewport:{width:w,height:h},locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh',colorScheme:scheme,isMobile:w<500,hasTouch:w<500,serviceWorkers:'block'});
  const page=await ctx.newPage();
  const logs=[];page.on('console',m=>logs.push(m.type()+': '+m.text()));page.on('pageerror',e=>logs.push('pageerror: '+e));page.on('response',r=>{if(r.status()>=400)logs.push('HTTP '+r.status()+' '+r.url())});
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(([k,v])=>{if(sessionStorage.getItem('s'))return;localStorage.setItem(k,v);sessionStorage.setItem('s','1')},[KEY,JSON.stringify(tasks)]);
  await page.goto('http://localhost:4173/');
  return {ctx,page,logs};
}
const stored=p=>p.evaluate(k=>JSON.parse(localStorage.getItem(k)||'[]'),KEY);
const rec=(tc,k,o)=>{out[tc+'/'+k]=o;fs.mkdirSync(EV+P+tc,{recursive:true});fs.writeFileSync(EV+P+tc+`/result-${k}.json`,JSON.stringify(o,null,1))};
const shot=(p,tc,n)=>{fs.mkdirSync(EV+P+tc,{recursive:true});return p.screenshot({path:EV+P+tc+'/'+n+'.png'})};
const row=(p,i)=>p.locator('.task').nth(i);
const eb=(p,i)=>row(p,i).getByRole('button',{name:'Sửa'});
const ei=p=>p.getByRole('textbox',{name:'Sửa'});
const labels=p=>p.locator('.task__label').allInnerTexts();
const focusInfo=p=>p.evaluate(()=>{const e=document.activeElement;return {tag:e.tagName,id:e.id,text:e.textContent.trim().slice(0,10),action:e.dataset?.action||null,row:e.closest('.task')?.dataset.id||null}});
const ferr=p=>p.evaluate(()=>{const e=document.querySelector('.task__edit .field-error');const i=document.querySelector('.task__edit .input');if(!e)return null;const cs=getComputedStyle(e);return {hidden:e.hidden,display:cs.display,text:e.innerText,role:e.getAttribute('role'),invalid:i.getAttribute('aria-invalid'),desc:i.getAttribute('aria-describedby'),errId:e.id,color:cs.color,focus:document.activeElement===i}});
const mode=async(p)=>({editing:await p.locator('.task--editing').count(),inputs:await p.locator('.task__edit').count()});
const SIZES=[[1440,900,'light'],[1440,900,'dark'],[390,844,'light'],[390,844,'dark']];

for(const [w,h,sch] of SIZES){
  const tag=`${w}-${sch}`;
  // 01 open + 12 a11y + 11 visual
  { const {ctx,page,logs}=await mk(w,h,sch);
    const before=await page.locator('body').ariaSnapshot();
    await eb(page,1).focus(); await shot(page,'10','sua-button-focus-'+tag);
    await eb(page,1).click();
    const r={focus:await focusInfo(page),val:await ei(page).inputValue(),caret:await ei(page).evaluate(e=>[e.selectionStart,e.selectionEnd,e.value.length]),mode:await mode(page),
      cls:await row(page,1).getAttribute('class'),
      label:await page.evaluate(()=>{const i=document.querySelector('.task__edit .input');const l=document.querySelector('.task__edit label');return {inputId:i.id,labelFor:l.htmlFor,labelsCount:i.labels.length,errId:document.querySelector('.task__edit .field-error').id}}),
      buttons:await row(page,1).getByRole('button').allInnerTexts(),
      readOnlyHidden:await row(page,1).locator('.task__swipe').evaluate(e=>e.hidden),
      checkboxDesc:await row(page,1).getByRole('checkbox').evaluate(e=>({name:e.getAttribute('aria-label'),desc:document.getElementById(e.getAttribute('aria-describedby'))?.textContent})),
      hscroll:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),
      aria:await page.locator('body').ariaSnapshot()};
    await page.waitForTimeout(500); await shot(page,'01','edit-open-'+tag);
    // 11 hover under mouse
    if(w>=1000){ await row(page,1).hover(); const cs=await row(page,1).evaluate(e=>getComputedStyle(e).backgroundImage); const hl=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--color-highlight').trim());
      const r1=await row(page,2).hover(); const other=await row(page,2).evaluate(e=>getComputedStyle(e).backgroundImage);
      await row(page,1).hover({position:{x:300,y:15}}); await page.waitForTimeout(300); await shot(page,'11','editing-hover-'+tag);
      rec('11','hover-'+tag,{editingHoverBg:cs,highlight:hl,otherHoverBg:other,containsHighlight:cs.includes('linear-gradient')&&hl.length>0}); }
    rec('01',tag,{...r,logs}); await ctx.close(); }
}

// 02 save via Lưu, 03 Enter, 10 focus return
for(const [w,h,sch] of SIZES){
  const tag=`${w}-${sch}`;
  const {ctx,page,logs}=await mk(w,h,sch);
  await eb(page,0).click(); await ei(page).fill('  Gửi báo cáo tuần cho chị Hoa  ');
  await row(page,0).getByRole('button',{name:'Lưu'}).click();
  const r2={labels:await labels(page),done:await page.getByRole('checkbox').evaluateAll(a=>a.map(x=>x.checked)),mode:await mode(page),focus:await focusInfo(page),summary:await page.getByRole('status').innerText(),store:await stored(page),strike:await row(page,0).locator('.task__label').evaluate(e=>getComputedStyle(e).textDecorationLine),desc:await row(page,0).getByRole('checkbox').evaluate(e=>document.getElementById(e.getAttribute('aria-describedby')).textContent)};
  await shot(page,'02','after-save-'+tag);
  await eb(page,2).click(); await ei(page).fill('Gọi bác sĩ'); await ei(page).press('Enter');
  const r3={labels:await labels(page),mode:await mode(page),focus:await focusInfo(page),store:(await stored(page)).map(t=>t.text)};
  await page.reload(); const r3b=await labels(page);
  // unchanged save, markup, emoji, exact 200
  await eb(page,1).click(); await ei(page).press('Enter'); const un=await labels(page);
  await eb(page,1).click(); await ei(page).fill('<b>x</b> & "q" 🥬'); await ei(page).press('Enter');
  const mk2={labels:await labels(page),b:await page.locator('.task-list b').count()};
  await eb(page,1).click(); await ei(page).fill('  '+'y'.repeat(200)+'  '); await ei(page).press('Enter');
  const l200=(await labels(page))[1].length; const m200=await mode(page);
  await shot(page,'05','exact-200-saved-'+tag);
  rec('02',tag,{r2,logs}); rec('03',tag,{r3,reloaded:r3b,unchangedSave:un,markup:mk2,exact200:{len:l200,mode:m200}}); await ctx.close();
}

// 04/05 errors
for(const [w,h,sch] of SIZES){
  const tag=`${w}-${sch}`;
  const {ctx,page,logs}=await mk(w,h,sch);
  await eb(page,1).click(); await ei(page).fill('   '); await ei(page).press('Enter');
  const e1=await ferr(page); const m1=await mode(page); await page.waitForTimeout(500); await shot(page,'04','spaces-'+tag);
  await ei(page).fill(''); await row(page,1).getByRole('button',{name:'Lưu'}).click(); const e2=await ferr(page);
  const s1=(await stored(page)).map(t=>t.text);
  await ei(page).fill('x'.repeat(201)); await ei(page).press('Enter'); const e3=await ferr(page); await page.waitForTimeout(500); await shot(page,'05','toolong-'+tag);
  const keptLen=(await ei(page).inputValue()).length;
  await ei(page).press('Backspace'); const e4=await ferr(page);
  await ei(page).press('Enter'); const e5={labels:await labels(page),mode:await mode(page)};
  // 201 with trailing spaces
  await eb(page,0).click(); await ei(page).fill('z'.repeat(201)+'   '); await ei(page).press('Enter'); const e6=await ferr(page);
  // error then switch row clears
  await eb(page,2).click(); const e7={err:await ferr(page),mode:await mode(page),labels:await labels(page)};
  rec('04',tag,{e1,m1,e2,storedAfter:s1,logs}); rec('05',tag,{e3,keptLen,e4,e5,e6trailing201:e6,switchClearsError:e7}); await ctx.close();
}

// 06 Hủy, 07 Escape, 08 one at a time, 09 add/tick while editing
for(const [w,h,sch] of SIZES){
  const tag=`${w}-${sch}`;
  const {ctx,page,logs}=await mk(w,h,sch);
  await eb(page,1).click(); await ei(page).fill('Đổi'); await row(page,1).getByRole('button',{name:'Hủy'}).click();
  const c1={labels:await labels(page),mode:await mode(page),focus:await focusInfo(page),store:(await stored(page)).map(t=>t.text)};
  await shot(page,'06','after-cancel-'+tag);
  await eb(page,2).click(); await ei(page).fill('Đổi'); await ei(page).press('Escape');
  const c2={labels:await labels(page),mode:await mode(page),focus:await focusInfo(page)};
  // escape from error state
  await eb(page,0).click(); await ei(page).fill(''); await ei(page).press('Enter'); await ei(page).press('Escape');
  const c3={labels:await labels(page),mode:await mode(page),focus:await focusInfo(page),errGone:await page.locator('.task__edit').count()};
  // reopen after cancel shows old text, no stale error
  await eb(page,0).click(); const c4={val:await ei(page).inputValue(),err:await ferr(page)}; await ei(page).press('Escape');
  // Escape on add input while not editing does nothing harmful
  rec('06',tag,{c1,logs}); rec('07',tag,{c2,escapeFromError:c3,reopenClean:c4});
  // 08
  await eb(page,0).click(); await ei(page).fill('Không lưu'); await eb(page,1).click();
  const o1={mode:await mode(page),editRow:await page.locator('.task--editing').evaluate(e=>e.dataset.id),labels:await labels(page),val:await ei(page).inputValue(),focus:await focusInfo(page),store:(await stored(page)).map(t=>t.text)};
  await shot(page,'08','one-at-a-time-'+tag);
  // double open same row can't (Sửa hidden); open third
  await eb(page,2).click(); const o2=await mode(page);
  rec('08',tag,{o1,o2,logs});
  // 09 add + tick while editing (row 2 editing)
  await ei(page).fill('Đang sửa dở');
  await page.getByRole('checkbox').nth(0).setChecked(false,{force:true}).catch(()=>{});
  await row(page,0).locator('.check').click();
  const t1={checked:await page.getByRole('checkbox').evaluateAll(a=>a.map(x=>x.checked)),summary:await page.getByRole('status').innerText(),editVal:await ei(page).inputValue(),mode:await mode(page)};
  await page.getByLabel('Bạn cần làm gì hôm nay?').fill('Việc mới'); await page.getByRole('button',{name:'Thêm'}).click();
  const t2={labels:await labels(page),mode:await mode(page),editVal:await ei(page).inputValue(),editStillLast:await page.locator('.task--editing').evaluate(e=>e.dataset.id),summary:await page.getByRole('status').innerText()};
  // tick the row being edited
  await row(page,2).locator('.check').click();
  const t3={checked:await page.getByRole('checkbox').evaluateAll(a=>a.map(x=>x.checked)),mode:await mode(page),editVal:await ei(page).inputValue()};
  await ei(page).press('Enter');
  const t4={labels:await labels(page),checked:await page.getByRole('checkbox').evaluateAll(a=>a.map(x=>x.checked)),store:await stored(page),focus:await focusInfo(page)};
  await shot(page,'09','after-add-tick-edit-'+tag);
  // reload while editing discards
  await eb(page,1).click(); await ei(page).fill('Mất'); await page.reload(); const t5={labels:await labels(page),mode:await mode(page)};
  rec('09',tag,{t1,t2,t3,t4,reloadWhileEditing:t5,logs}); await ctx.close();
}

// 12 long text wrap at 390 and a11y tab order, keyboard-only
for(const [w,h,sch] of [[1440,900,'light'],[390,844,'light'],[390,844,'dark']]){
  const tag=`${w}-${sch}`;
  const long=[{id:'l',text:'Một việc rất dài '.repeat(11).trim().slice(0,200),done:false,createdAt:1,date:'2026-11-09'},seed[1]];
  const {ctx,page,logs}=await mk(w,h,sch,long);
  await eb(page,0).click();
  const hs=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  const inputBox=await ei(page).evaluate(e=>{const r=e.getBoundingClientRect();return {w:r.width,right:r.right,vw:innerWidth}});
  await shot(page,'13','long-text-edit-'+tag);
  const tabs=[];for(let i=0;i<4;i++){await page.keyboard.press('Tab');tabs.push(await page.evaluate(()=>{const e=document.activeElement;return e.tagName+':'+(e.getAttribute('aria-label')||e.id||e.textContent.trim().slice(0,8))}))}
  await page.keyboard.press('Shift+Tab');
  rec('13',tag,{hs,inputBox,tabs,logs}); await ctx.close();
}
// keyboard-only edit
{ const {ctx,page,logs}=await mk(1440,900,'light');
  await eb(page,1).focus(); await page.keyboard.press('Enter');
  const k1=await focusInfo(page); await page.keyboard.type(' sớm'); await page.keyboard.press('Tab'); const tab1=await focusInfo(page); await page.keyboard.press('Tab'); const tab2=await focusInfo(page);
  await page.keyboard.press('Space'); // Lưu via Space
  const k2={labels:await labels(page),focus:await focusInfo(page),mode:await mode(page)};
  rec('12','keyboard',{k1,tab1,tab2,k2,logs}); await ctx.close(); }
fs.writeFileSync('/tmp/claude-1000/-home-gem-src-todo-list/832f85e5-a60f-4d79-a693-e0ce7014eb66/scratchpad/qa7-out.json',JSON.stringify(out,null,1));
await b.close(); console.log('done');
