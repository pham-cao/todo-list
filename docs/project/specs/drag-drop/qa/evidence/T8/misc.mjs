import { chromium } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
import fs from 'fs';
const NOW = new Date('2026-11-10T09:00:00+07:00');
const COLORS=['yellow','pink','blue','green','orange'];
const G = Array.from({length:20},(_,i)=>({id:'g'+i,name:'Nhóm '+(i+1),color:COLORS[i%5],createdAt:i+1}));
const T = Array.from({length:200},(_,i)=>({id:'t'+i,text:'Việc số '+(i+1),done:i%7===0,createdAt:(i+1)*1000,date:'2026-11-10',groupId:'g'+(i%20)}));
const out = []; const b = await chromium.launch();
const mk = async (vp) => { const ctx = await b.newContext({ viewport: vp==='mobile'?{width:390,height:844}:{width:1440,height:900}, locale:'vi-VN', timezoneId:'Asia/Ho_Chi_Minh', ...(vp==='mobile'?{hasTouch:true,isMobile:true}:{}) }); const page = await ctx.newPage(); await page.clock.setFixedTime(NOW);
  await page.addInitScript(([t,g]) => { if (sessionStorage.getItem('s')) return; localStorage.setItem('daily-todo:tasks:v1', JSON.stringify(t)); localStorage.setItem('daily-todo:groups:v1', JSON.stringify(g)); sessionStorage.setItem('s','1'); }, [T,G]);
  const errs=[]; page.on('console', m=>{ if(['error','warning'].includes(m.type())) errs.push(m.type()+': '+m.text()); }); page.on('pageerror', e=>errs.push('pageerror: '+e.message));
  const reqs=[]; page.on('request', r=>reqs.push(r.url()));
  await page.goto('http://localhost:4173/'); await page.waitForSelector('.task'); await page.waitForTimeout(300); return {ctx,page,errs,reqs}; };
{ const {ctx,page,errs,reqs} = await mk('desktop');
  const keys0 = await page.evaluate(()=>Object.keys(localStorage).sort().join(','));
  const n0 = reqs.length;
  const tree = () => page.evaluate(()=>({strip: !!document.querySelector('.drop-strip'), stripInTree: !!document.querySelector('.drop-strip:not([hidden])'), slipHidden: document.querySelector('.drag-slip')?.getAttribute('aria-hidden'), stripName: document.querySelector('.drop-strip')?.getAttribute('aria-label'), stripRole: document.querySelector('.drop-strip')?.getAttribute('role'), stripTabbables: document.querySelectorAll('.drop-strip button, .drop-strip a, .drop-strip [tabindex]').length, edgeHidden: document.querySelector('.drag-edge')?.getAttribute('aria-hidden'), srRegion: document.getElementById('sr-status')?.textContent}));
  out.push('13 rest: '+JSON.stringify(await tree()));
  const lb = page.locator('.task').nth(5).locator('.task__label'); const bb = await lb.boundingBox();
  await page.mouse.move(bb.x+40,bb.y+10); await page.mouse.down(); await page.mouse.move(bb.x+60,bb.y+50,{steps:6});
  out.push('13 drag: '+JSON.stringify(await tree()));
  out.push('13 axtree strip: '+(await page.locator('.drop-strip').ariaSnapshot().then(s=>s.replace(/\n/g,' | ').slice(0,200)).catch(e=>'n/a '+e.message)));
  const tg = page.locator('.drop-target',{hasText:'Nhóm 3'}).first(); const tb = await tg.boundingBox(); await page.mouse.move(tb.x+tb.width/2,tb.y+tb.height/2,{steps:6}); await page.mouse.up(); await page.waitForTimeout(300);
  out.push('15 moved live: '+JSON.stringify(await page.evaluate(()=>document.getElementById('sr-status').textContent)));
  // cancel
  const lb2 = page.locator('.task').nth(9).locator('.task__label'); await lb2.scrollIntoViewIfNeeded(); const b2 = await lb2.boundingBox(); await page.mouse.move(b2.x+40,b2.y+10); await page.mouse.down(); await page.mouse.move(b2.x+60,b2.y+50,{steps:6}); await page.keyboard.press('Escape'); await page.mouse.up(); await page.waitForTimeout(300);
  out.push('15 cancel live: '+JSON.stringify(await page.evaluate(()=>document.getElementById('sr-status').textContent)));
  out.push('15 strip label text: '+JSON.stringify(await (async()=>{ const l=page.locator('.task').nth(2).locator('.task__label'); await l.scrollIntoViewIfNeeded(); const b=await l.boundingBox(); await page.mouse.move(b.x+40,b.y+10); await page.mouse.down(); await page.mouse.move(b.x+60,b.y+50,{steps:6}); const t=await page.locator('.drop-strip').evaluate(e=>[e.getAttribute('aria-label'), e.querySelector('.drop-strip__label, legend, .drop-strip__title')?.textContent]); await page.keyboard.press('Escape'); await page.mouse.up(); return t; })()));
  const keys1 = await page.evaluate(()=>Object.keys(localStorage).sort().join(','));
  out.push(`14 network: requests during drags: ${reqs.length - n0} ; storage keys before ${keys0} after ${keys1} ; CSP meta: ${await page.evaluate(()=>document.querySelector('meta[http-equiv=Content-Security-Policy]').content)}`);
  // 20: dialog behind
  await page.locator('.group-bar__manage').click(); await page.waitForTimeout(300);
  const lb3 = page.locator('.task').nth(4).locator('.task__label'); await lb3.scrollIntoViewIfNeeded(); const b3 = await lb3.boundingBox();
  await page.mouse.move(b3.x+40,b3.y+10); await page.mouse.down(); await page.mouse.move(b3.x+60,b3.y+60,{steps:6});
  out.push('20 drag behind manage dialog started: '+await page.evaluate(()=>document.documentElement.classList.contains('is-dragging'))); await page.mouse.up(); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  out.push('20 focus after Escape: '+await page.evaluate(()=>document.activeElement.className||document.activeElement.tagName));
  // 25 exploratory mix
  for (let i=0;i<12;i++){ const l=page.locator('.task').nth((i*13)%200).locator('.task__label'); await l.scrollIntoViewIfNeeded(); const b=await l.boundingBox(); await page.mouse.move(b.x+40,b.y+10); await page.mouse.down(); await page.mouse.move(b.x+60,b.y+60,{steps:4});
    if(i%3===0){ await page.keyboard.press('Escape'); await page.mouse.up(); } else if (i%3===1){ const t=page.locator('.drop-target').nth(i%20); const tb=await t.boundingBox(); await page.mouse.move(tb.x+tb.width/2,tb.y+tb.height/2,{steps:4}); await page.mouse.up(); } else { await page.mouse.move(700, 880, {steps:8}); await page.waitForTimeout(250); await page.mouse.up(); }
    await page.waitForTimeout(120); }
  await page.selectOption('#group-filter','g3'); await page.locator('.task').first().locator('.task__label').click().catch(()=>{}); await page.selectOption('#group-filter','all');
  await page.locator('.group__toggle').nth(2).click(); await page.locator('.group__toggle').nth(2).click();
  out.push('25 desktop mix: stuck leftovers '+await page.locator('.drag-slip,.drop-strip,.drag-edge,.task--placeholder,html.is-dragging').count()+'; tasks '+await page.locator('.task').count()+' (expect 200); stored '+await page.evaluate(()=>JSON.parse(localStorage.getItem('daily-todo:tasks:v1')).length)+'; console: '+JSON.stringify(errs));
  await ctx.close(); }
{ const {ctx,page,errs} = await mk('mobile'); const cdp = await ctx.newCDPSession(page);
  const send=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts});
  for (let i=0;i<8;i++){ const l=page.locator('.task').nth(i*3).locator('.task__label'); await l.scrollIntoViewIfNeeded(); const b=await l.boundingBox(); const x=b.x+40,y=b.y+b.height/2;
    if (i%2===0){ await send('touchStart',[{x,y}]); await page.waitForTimeout(450); for(let k=1;k<=8;k++){await send('touchMove',[{x,y:y+k*12}]); await page.waitForTimeout(16);} if(i%4===0) await send('touchCancel',[]); else { const t=await page.locator('.drop-target').nth(i%20).boundingBox().catch(()=>null); if(t){ for(let k=1;k<=6;k++){await send('touchMove',[{x:t.x+t.width/2,y:y+96+(t.y+t.height/2-y-96)*k/6}]); await page.waitForTimeout(16);} } await send('touchEnd',[]); } }
    else { for(let k=1;k<=10;k++){await send(k===1?'touchStart':'touchMove',[{x:b.x+b.width-30-k*14,y}]); await page.waitForTimeout(16);} await send('touchEnd',[]); }
    await page.waitForTimeout(300); }
  out.push('25 phone mix: leftovers '+await page.locator('.drag-slip,.drop-strip,.drag-edge,.task--placeholder,html.is-dragging').count()+'; tasks '+await page.locator('.task').count()+'; stored '+await page.evaluate(()=>JSON.parse(localStorage.getItem('daily-todo:tasks:v1')).length)+'; console: '+JSON.stringify(errs));
  await ctx.close(); }
console.log(out.join('\n')); fs.writeFileSync('axe/misc.txt', out.join('\n')+'\n'); await b.close();
