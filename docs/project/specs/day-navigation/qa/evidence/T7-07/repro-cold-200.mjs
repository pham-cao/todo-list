import { chromium } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
const b=await chromium.launch(); const res={};
for (const [vp,w,h,mob] of [['1440',1440,900,false],['390',390,844,true]]) { const a=[],r=[];
 for (let k=0;k<15;k++){
 const ctx=await b.newContext({viewport:{width:w,height:h},isMobile:mob,hasTouch:mob,locale:'vi-VN'}); const p=await ctx.newPage();
 await p.clock.setFixedTime(new Date('2026-11-09T09:00:00+07:00'));
 const tasks=Array.from({length:200},(_,i)=>({id:'p'+i,text:'Việc số '+(i+1)+' của hôm qua',done:i%3==0,createdAt:i,date:'2026-11-08'}));
 await p.addInitScript(s=>localStorage.setItem('daily-todo:tasks:v1',s),JSON.stringify(tasks));
 await p.goto('http://localhost:4173/'); await p.waitForLoadState('load');
 const ms=await p.evaluate(()=>{const t=performance.now();document.getElementById('prev-day').click();void document.body.offsetHeight;return performance.now()-t});
 const rows=await p.locator('.task-list > .task').count(); a.push(Math.round(ms)); r.push(rows); await ctx.close();}
 console.log(vp,'200 tasks first move ms',a.join(','),'max',Math.max(...a),'rows',[...new Set(r)]);}
await b.close();
