import { chromium } from '/home/gem/src/todo_list/node_modules/@playwright/test/index.mjs';
import fs from 'fs';
const axeSrc=fs.readFileSync('axe/node_modules/axe-core/axe.min.js','utf8');
const NOW=new Date('2026-11-09T09:00:00+07:00');
const g=(id,name,color,i)=>({id,name,color,createdAt:i});
const groups=[g('cty','Công ty','yellow',1),g('nha','Nhà','pink',2),g('jp','Học tiếng Nhật','green',3),g('sk','Sức khỏe','blue',4)];
const T=(id,text,done,gid,c)=>({id,text,done,createdAt:c,date:'2026-11-09',...(gid&&{groupId:gid})});
const tasks=[T('1','Gửi báo cáo doanh thu tháng 10 cho chị Lan',true,'cty',1),T('2','Chuyển khoản tiền điện tháng 11',false,'nha',2),T('3','Họp với nhóm thiết kế lúc 14:00',false,'cty',3),T('4','Gọi điện hẹn lịch cắt tóc',false,null,4),T('5','Ôn 20 chữ Kanji bài 5',true,'jp',5),T('6','Mua sữa và trứng ở Co.opmart',true,'nha',6),T('7','Trả lời email của khách hàng Nhật Bản',false,'cty',7)];
const twenty=Array.from({length:20},(_,i)=>g('g'+i,'Nhóm '+(i+1),'yellow',i+1));
const b=await chromium.launch();const out=[];
const states={
 open: async p=>{await p.fill('#new-task','Mua quà sinh nhật cho Minh');await p.selectOption('#new-task-group','new');await p.fill('#new-group-name','Gia đình');},
 empty: async p=>{await p.selectOption('#new-task-group','new');await p.click('#create-group');},
 toolong: async p=>{await p.selectOption('#new-task-group','new');await p.fill('#new-group-name','Các việc lặt vặt trong nhà cuối tuần');await p.click('#create-group');},
 dup: async p=>{await p.selectOption('#new-task-group','new');await p.fill('#new-group-name','công ty');await p.click('#create-group');},
 limit: async p=>{await p.selectOption('#new-task-group','new');},
 created: async p=>{await p.fill('#new-task','Mua quà sinh nhật cho Minh');await p.selectOption('#new-task-group','new');await p.fill('#new-group-name','Gia đình');await p.press('#new-group-name','Enter');},
 added: async p=>{await p.selectOption('#new-task-group','new');await p.fill('#new-group-name','Gia đình');await p.press('#new-group-name','Enter');await p.fill('#new-task','Mua quà sinh nhật cho Minh');await p.press('#new-task','Enter');await p.waitForTimeout(600);},
 nogroups: async p=>{},
};
for (const [w,h] of [[1440,900],[390,844],[360,800]]) for (const scheme of ['light','dark']) for (const [st,fn] of Object.entries(states)) {
 const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:scheme,bypassCSP:true,locale:'vi-VN',timezoneId:'Asia/Ho_Chi_Minh'});const p=await ctx.newPage();await p.clock.setFixedTime(NOW);
 const gs=st==='limit'?twenty:st==='nogroups'?[]:groups; const ts=st==='nogroups'?tasks.filter(t=>!t.groupId):tasks;
 await p.addInitScript(([a,b2])=>{localStorage.setItem('daily-todo:tasks:v1',a);localStorage.setItem('daily-todo:groups:v1',b2);localStorage.setItem('daily-todo:swipe-hint-seen','1')},[JSON.stringify(ts),JSON.stringify(gs)]);
 await p.goto('http://localhost:4173/');await p.waitForTimeout(300);await fn(p);await p.waitForTimeout(300);
 await p.screenshot({path:`shots/${st}-${scheme}-${w}.png`,clip:{x:0,y:0,width:w,height:Math.min(h,700)}});
 const sw=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 await p.addScriptTag({content:axeSrc});
 const r=await p.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}}));
 out.push({w,scheme,st,sw,v:r.violations.map(v=>({id:v.id,n:v.nodes.length,t:v.nodes.map(n=>n.target.join(' ')).slice(0,3)}))});
 await ctx.close();}
await b.close();
for(const o of out)console.log(o.w,o.scheme,o.st,'hscroll',o.sw,'viol',JSON.stringify(o.v));
