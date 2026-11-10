import { chromium } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
import fs from 'fs';
const axeSrc=fs.readFileSync('axe/node_modules/axe-core/axe.min.js','utf8');
const EV='/home/gem/src/todo_list/docs/project/specs/task-groups/qa/evidence/T4-a11y';fs.mkdirSync(EV,{recursive:true});
const NOW=new Date('2026-11-09T09:00:00+07:00');
const g=(id,name,color,i)=>({id,name,color,createdAt:i});
const groups=[g('cty','Công ty','yellow',1),g('nha','Nhà','pink',2),g('jp','Học tiếng Nhật','green',3),g('sk','Sức khỏe','blue',4),g('x','<b>abc</b>','orange',5),g('y','Lá','purple',6)];
const T=(id,text,done,gid,c)=>({id,text,done,createdAt:c,date:'2026-11-09',...(gid&&{groupId:gid})});
const tasks=[T('1','Gửi báo cáo',true,'cty',1),T('2','Chuyển khoản',false,'nha',2),T('3','Họp',false,'cty',3),T('4','Cắt tóc',false,null,4),T('5','Kanji',true,'jp',5),T('6','Mua sữa',true,'nha',6),T('7','Email',false,'cty',7),T('8','Một',false,'x',8),T('9','Hai',false,'y',9)];
const b=await chromium.launch();const out=[];
for (const [w,h] of [[1440,900],[390,844],[360,800]]) for (const scheme of ['light','dark']) for (const view of ['sections','collapsed','plain']) {
 const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:scheme,bypassCSP:true,locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh'});const p=await ctx.newPage();await p.clock.setFixedTime(NOW);
 await p.addInitScript(([a,b2,c])=>{localStorage.setItem('daily-todo:tasks:v1',a);localStorage.setItem('daily-todo:groups:v1',b2);if(c)localStorage.setItem('daily-todo:ui:v1',c);localStorage.setItem('daily-todo:swipe-hint-seen','1')},[JSON.stringify(view==='plain'?tasks.filter(t=>!t.groupId):tasks),JSON.stringify(groups),view==='collapsed'?JSON.stringify({collapsed:['cty','nha','none']}):null]);
 await p.goto('http://localhost:4173/');await p.waitForTimeout(500);await p.addScriptTag({content:axeSrc});
 const r=await p.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}}));
 out.push({w,scheme,view,v:r.violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,t:v.nodes.map(n=>n.target.join(' ')).slice(0,3)})),inc:r.incomplete.map(v=>v.id),passes:r.passes.length});
 await ctx.close();}
await b.close();fs.writeFileSync(EV+'/axe-t4.json',JSON.stringify(out,null,1));
for(const o of out)console.log(o.w,o.scheme,o.view,'viol',JSON.stringify(o.v),'inc',o.inc.join(','));
