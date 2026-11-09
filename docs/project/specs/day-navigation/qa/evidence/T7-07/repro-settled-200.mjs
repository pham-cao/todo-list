import { chromium } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
const b=await chromium.launch();
for (const wait of [0,100,300,1000,3000]) { const a=[];
 for (let k=0;k<4;k++){
 const ctx=await b.newContext({viewport:{width:1440,height:900},locale:'vi-VN'}); const p=await ctx.newPage();
 const tasks=Array.from({length:200},(_,i)=>({id:'p'+i,text:'Việc số '+(i+1)+' của hôm qua',done:i%3==0,createdAt:i,date:'2026-11-08'}));
 await p.clock.setFixedTime(new Date('2026-11-09T09:00:00+07:00'));
 await p.addInitScript(s=>localStorage.setItem('daily-todo:tasks:v1',s),JSON.stringify(tasks));
 await p.goto('http://localhost:4173/'); await p.waitForLoadState('load'); if(wait)await p.waitForTimeout(wait);
 const r=await p.evaluate(()=>{const t=performance.now();document.getElementById('prev-day').click();const t1=performance.now();void document.body.offsetHeight;const t2=performance.now();return [Math.round(t1-t),Math.round(t2-t1)]});
 a.push(r.join('+')); await ctx.close();}
 console.log('wait',wait,'click+layout ms:',a.join('  '));}
await b.close();
