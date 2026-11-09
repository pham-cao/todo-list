import { chromium } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
import fs from 'fs';
const axeSrc = fs.readFileSync('axe/node_modules/axe-core/axe.min.js','utf8');
const NOW=new Date('2026-11-09T09:00:00+07:00');
const t=(id,text,done,date)=>({id,text,done,createdAt:1,date});
const seed=[t('a','Một',true,'2026-11-09'),t('b','Hai',false,'2026-11-09'),t('c','Hôm qua',false,'2026-11-08'),t('d','Ngày mai',false,'2026-11-10')];
const days={today:'',yesterday:'#2026-11-08',tomorrow:'#2026-11-10','past-empty':'#2026-11-01','future-empty':'#2026-11-20'};
const b=await chromium.launch(); const out=[];
for (const [vp,w,h] of [['1440',1440,900],['390',390,844]]) for (const scheme of ['light','dark']) for (const [name,hash] of Object.entries(days)) {
  const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:scheme,bypassCSP:true,locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh'});
  const p=await ctx.newPage(); await p.clock.setFixedTime(NOW);
  await p.addInitScript(s=>localStorage.setItem('daily-todo:tasks:v1',s),JSON.stringify(seed));
  await p.goto('http://localhost:4173/'+hash); await p.waitForTimeout(600);
  await p.addScriptTag({content:axeSrc});
  const r=await p.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}}));
  const line=await p.locator('#date-line').textContent();
  out.push({vp,scheme,name,line,violations:r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,t:v.nodes.map(n=>n.target.join(' ')).slice(0,3)})),passes:r.passes.length,incomplete:r.incomplete.map(v=>v.id)});
  await ctx.close();
}
await b.close();
fs.writeFileSync('axe-t7.json',JSON.stringify(out,null,1));
for (const o of out) console.log(o.vp,o.scheme,o.name,'|',o.line,'| violations:',JSON.stringify(o.violations),'| incomplete:',o.incomplete.join(','));
