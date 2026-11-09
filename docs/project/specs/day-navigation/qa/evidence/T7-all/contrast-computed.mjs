import { chromium } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
const b=await chromium.launch();
const lum=c=>{const [r,g,bb]=c.map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4});return .2126*r+.7152*g+.0722*bb};
for (const scheme of ['light','dark']) for (const hash of ['','#2026-11-08']) {
 const ctx=await b.newContext({colorScheme:scheme,locale:'vi-VN'}); const p=await ctx.newPage();
 await p.clock.setFixedTime(new Date('2026-11-09T09:00:00+07:00'));
 await p.goto('http://localhost:4173/'+hash); await p.waitForTimeout(500);
 const rs=await p.evaluate(()=>{const parse=s=>s.match(/[\d.]+/g).map(Number);
  const bgOf=el=>{while(el){const c=parse(getComputedStyle(el).backgroundColor);if(c.length<4||c[3]>0.99)return c.slice(0,3);if(c[3]>0)return c;el=el.parentElement}return [255,255,255]};
  return ['#page-title','#date-line','#to-today','.date-stamp','#new-task','#empty-text','#prev-day'].map(s=>{const el=document.querySelector(s);if(!el)return [s];const cs=getComputedStyle(el);return [s,parse(cs.color).slice(0,3),bgOf(el),cs.color,cs.backgroundColor]})});
 console.log(scheme,hash||'today');
 for (const [s,fg,bg] of rs) if(fg){const L1=lum(fg),L2=lum(bg);const r=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05);console.log('  ',s,r.toFixed(2),fg.join(','),'on',bg.join(','))}
 await ctx.close();
}
await b.close();
