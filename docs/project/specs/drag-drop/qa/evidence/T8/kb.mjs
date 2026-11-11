import { chromium } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
const NOW = new Date('2026-11-10T09:00:00+07:00');
const G = [['cty','Công ty','yellow'],['nha','Nhà','pink']].map(([id,name,color],i)=>({id,name,color,createdAt:i+1}));
const T = [['a','Gửi báo cáo',false,'cty'],['b','Họp nhóm',false,'cty'],['c','Trả lời email',false,'cty'],['d','Tiền điện',false,'nha']].map(([id,text,done,g],i)=>({id,text,done,createdAt:(i+1)*1000,date:'2026-11-10',groupId:g}));
const b = await chromium.launch(); const out = [];
const mk = async (vp) => { const ctx = await b.newContext({ viewport: vp==='mobile'?{width:390,height:844}:{width:1440,height:900}, locale:'vi-VN', timezoneId:'Asia/Ho_Chi_Minh', ...(vp==='mobile'?{hasTouch:true,isMobile:true}:{}) }); const page = await ctx.newPage(); await page.clock.setFixedTime(NOW);
  await page.addInitScript(([t,g]) => { if (sessionStorage.getItem('s')) return; localStorage.setItem('daily-todo:tasks:v1', JSON.stringify(t)); localStorage.setItem('daily-todo:groups:v1', JSON.stringify(g)); sessionStorage.setItem('s','1'); }, [T,G]);
  await page.goto('http://localhost:4173/'); await page.waitForSelector('.task'); return [ctx,page]; };
// 1 Tab during drag desktop
{ const [ctx,page] = await mk('desktop');
  const l = page.locator('.task',{hasText:'Trả lời email'}); await l.getByRole('checkbox').focus();
  const bb = await l.locator('.task__label').boundingBox(); await page.mouse.move(bb.x+40,bb.y+10); await page.mouse.down(); await page.mouse.move(bb.x+40,bb.y+40,{steps:6});
  const cs = await page.evaluate(()=>{const a=document.querySelector('.task--placeholder .task__actions'); const s=document.querySelector('.task--placeholder .task__swipe'); return [getComputedStyle(a).visibility, getComputedStyle(s).overflowX]});
  const seq=[]; for (let i=0;i<10;i++){ await page.keyboard.press('Tab'); seq.push(await page.evaluate(()=>{const e=document.activeElement; return (e.closest('.task--placeholder')?'PLACEHOLDER:':'')+(e.getAttribute('aria-label')||e.id||e.tagName)})); }
  out.push('desktop drag Tab: computed '+cs+' ; sequence '+seq.join(' > '));
  await page.keyboard.press('Escape'); await page.mouse.up();
  // rest: Tab to Sửa
  await l.getByRole('checkbox').focus(); await page.keyboard.press('Tab'); out.push('rest: after checkbox Tab -> '+await page.evaluate(()=>document.activeElement.getAttribute('aria-label')));
  // keyboard move Sửa then Nhóm
  await page.keyboard.press('Enter'); await page.waitForSelector('.task__edit');
  await page.locator('.task__edit').getByRole('combobox',{name:'Nhóm',exact:true}).selectOption({label:'Nhà'}); await page.locator('.task__edit .input').press('Enter'); await page.waitForTimeout(300);
  out.push('kb move result: '+await page.evaluate(()=>[...document.querySelectorAll('#day-list > .group')].map(g=>g.querySelector('.group__name').textContent+'='+[...g.querySelectorAll('.task__label')].map(x=>x.textContent).join('/')).join(' ; ')+' live: '+document.getElementById('sr-status').textContent)+' stored: '+await page.evaluate(()=>JSON.parse(localStorage.getItem('daily-todo:tasks:v1')).find(t=>t.id==='c').groupId));
  await ctx.close(); }
// 2 mobile: swipe normal row while no drag, and after a drag cancel; placeholder tabbing
{ const [ctx,page] = await mk('mobile'); const cdp = await ctx.newCDPSession(page);
  const swipe = async (txt) => { const sw = page.locator('.task',{hasText:txt}).locator('.task__swipe'); const bx = await sw.boundingBox(); const y=bx.y+bx.height/2, x0=bx.x+bx.width-30; await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x0,y}]}); for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x0-20*i,y}]}); await page.waitForTimeout(16);} await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await page.waitForTimeout(500); return sw.evaluate(e=>e.scrollLeft); };
  out.push('mobile swipe Họp nhóm scrollLeft: '+await swipe('Họp nhóm'));
  // actions revealed visible
  out.push('actions width '+await page.locator('.task',{hasText:'Họp nhóm'}).locator('.task__actions').evaluate(e=>e.getBoundingClientRect().width));
  // lift Trả lời email by hold, then cancel by lifting over nothing; check placeholder swipe overflow and other row swipe still works
  const lb = await page.locator('.task',{hasText:'Trả lời email'}).locator('.task__label').boundingBox(); const x=lb.x+40,y=lb.y+10;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]}); await page.waitForTimeout(450); for(let i=1;i<=6;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+4,y:y+i*6}]}); await page.waitForTimeout(16);}
  out.push('mobile lifted: '+await page.evaluate(()=>[document.documentElement.classList.contains('is-dragging'), getComputedStyle(document.querySelector('.task--placeholder .task__swipe')).overflowX, getComputedStyle(document.querySelector('.task--placeholder .task__actions')).visibility]));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}); await page.waitForTimeout(400);
  out.push('after cancel leftovers: '+await page.locator('.drag-slip,.drop-strip,.task--placeholder').count());
  out.push('mobile swipe Gửi báo cáo after drag scrollLeft: '+await swipe('Gửi báo cáo'));
  // vertical scroll still scrolls
  await page.evaluate(()=>scrollTo(0,0)); await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:600}]}); for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y:600-i*10}]}); await page.waitForTimeout(16);} await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}); await page.waitForTimeout(300);
  out.push('page scrolls: '+await page.evaluate(()=>scrollY>0 || document.documentElement.scrollHeight<=innerHeight));
  await ctx.close(); }
console.log(out.join('\n')); await b.close();
