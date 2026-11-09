import { chromium } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
const E='/home/gem/src/todo_list/docs/project/specs/day-navigation/qa/evidence/BUG-002-retest/';
const b=await chromium.launch();
const t=Array.from({length:200},(_,i)=>({id:'b'+i,text:i==199?'Việc cuối '+'rất dài '.repeat(25)+'hết':'Việc số '+(i+1),done:false,createdAt:i,date:'2026-11-09'}));
for (const scheme of ['light','dark']) for (const [name,w,h,mob] of [['1440',1440,900,false],['390',390,844,true]]) {
 const c=await b.newContext({viewport:{width:w,height:h},isMobile:mob,hasTouch:mob,locale:'vi-VN',colorScheme:scheme}); const p=await c.newPage();
 await p.clock.setFixedTime(new Date('2026-11-09T09:00:00+07:00'));
 await p.addInitScript(s=>{localStorage.setItem('daily-todo:tasks:v1',s)},JSON.stringify(t));
 await p.goto('http://localhost:4173/'); await p.waitForTimeout(600);
 const tag=`${scheme}-${name}`; const rows=p.locator('.task-list > .task');
 if(!mob){ await rows.nth(2).hover(); await rows.nth(2).getByRole('button',{name:'Sửa'}).hover(); await p.waitForTimeout(700);
   await p.screenshot({path:E+`tooltip-sua-${tag}.png`,clip:{x:0,y:0,width:w,height:600}});
   await rows.nth(2).getByRole('button',{name:'Xóa'}).hover(); await p.waitForTimeout(700);
   await p.screenshot({path:E+`tooltip-xoa-${tag}.png`,clip:{x:0,y:0,width:w,height:600}});
 } else {
   const peeked=await p.evaluate(()=>document.querySelector('.task').className); console.log(tag,'first row class at load',peeked);
   await p.waitForTimeout(2500);
   await rows.nth(1).locator('.task__swipe').evaluate(el=>el.scrollTo({left:el.scrollWidth,behavior:'instant'})); await p.waitForTimeout(400);
   console.log(tag,'swipe scrollLeft',await rows.nth(1).locator('.task__swipe').evaluate(el=>el.scrollLeft)); await p.screenshot({path:E+`swipe-${tag}.png`});
   await rows.nth(150).scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
   await rows.nth(150).locator('.task__swipe').evaluate(el=>el.scrollTo({left:el.scrollWidth,behavior:'instant'})); await p.waitForTimeout(400);
   console.log(tag,'row150 swipe',await rows.nth(150).locator('.task__swipe').evaluate(el=>el.scrollLeft), 'row1 closed',await rows.nth(1).locator('.task__swipe').evaluate(el=>el.scrollLeft));
 }
 await p.evaluate(()=>scrollTo(0,document.body.scrollHeight)); await p.waitForTimeout(400); await p.evaluate(()=>scrollTo(0,document.body.scrollHeight)); await p.waitForTimeout(300);
 await p.screenshot({path:E+`bottom-long-row-${tag}.png`});
 await c.close(); }
// settled moves at 390 and 1440
for (const [w,mob] of [[1440,false],[390,true]]) { const a=[];
 for (let k=0;k<8;k++){ const c=await b.newContext({viewport:{width:w,height:900},isMobile:mob,hasTouch:mob,locale:'vi-VN'}); const p=await c.newPage();
  await p.clock.setFixedTime(new Date('2026-11-09T09:00:00+07:00'));
  const y=t.map(x=>({...x,date:'2026-11-08'})); await p.addInitScript(s=>localStorage.setItem('daily-todo:tasks:v1',s),JSON.stringify(y));
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(600);
  a.push(await p.evaluate(()=>{const t=performance.now();document.getElementById('prev-day').click();void document.body.offsetHeight;return Math.round(performance.now()-t)})); await c.close(); }
 console.log(w,'settled 600ms move ms',a.join(','),'max',Math.max(...a)); }
await b.close();
