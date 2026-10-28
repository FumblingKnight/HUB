import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const src=(name)=>readFile(new URL(name,import.meta.url),'utf8');
test('every authenticated viewer page uses one shared design/navigation system',async()=>{
 const pages=['index.html','home.html','mira.html','context.html','status.html'];
 for(const name of pages){
  const html=await src(name);
  assert.match(html,/\/viewer\.css/,'Shared theme '+name);
  assert.match(html,/\/viewer-shell\.js/,'Shared rail '+name);
  assert.match(html,/<main\b/,'Primary content '+name);
  assert.match(html,/<meta name="viewport"/,'Viewport '+name);
 }
});
test('home renders API-backed data and has useful access points without fake results',async()=>{
 const h=await src('home.html'),js=await src('home.js');
 for(const target of ['/mira.html','/context.html','/status.html','href="/"','/newspaper.html']) assert.ok(h.includes(target),target);
 assert.match(h,/role="search"/);
 assert.match(js,/api\/mira\/signals/);
 assert.match(js,/api\/mira\/status/);
 assert.match(js,/No current verified highlights/);
 assert.doesNotMatch(js,/method:\s*['"]POST/);
});
test('after login user lands on viewer home and not the management-library page',async()=>{
 const script=await src('login.js');
 assert.match(script,/location\.replace\(["']\/home\.html["']\)/);
 assert.match(script,/\/auth\/login/);
});
test('layout respects touch, mobile, focus and reduced motion',async()=>{
 const sheet=await src('viewer.css'),home=await src('home.css');
 assert.match(sheet,/min-height:47px/);
 assert.match(sheet,/max-width:650px/);
 assert.match(sheet,/focus-visible/);
 assert.match(sheet,/prefers-reduced-motion/);
 assert.match(home,/max-width:650px/);
 assert.doesNotMatch(sheet,/@import/);
});
test('root capture backend remains preserved but hidden from viewer navigation',async()=>{
 const h=await src('index.html'),css=await src('viewer.css');
 assert.match(h,/id="view-inbox"/);
 assert.match(css,/nav\[data-view="inbox"\]\{display:none\}/);
});
test('shared navigation recognizes the correct page and has 6 accessible links',async()=>{
 const script=await src('viewer-shell.js');
 function make(path){
  const all=[];
  function element(tag){
   const x={tag,attrs:{},children:[],className:'',textContent:'',
    classList:{add(...names){x.classes=(x.classes||[]).concat(names);}},
    append(...items){this.children.push(...items)},setAttribute(k,v){this.attrs[k]=v;}};
   all.push(x);return x;
  }
  const body={classes:[],nodes:[],classList:{add(...names){body.classes.push(...names)}},prepend(x){body.nodes.unshift(x)}};
  const document={body,querySelector:()=>null,createElement:element};
  runInNewContext(script,{document,location:{pathname:path}});
  return {body,all};
 }
 for(const [path,label] of [['/home.html','Home'],['/newspaper.html','Newspaper'],['/mira.html','Signals'],['/context.html','Memory'],['/status.html','Project'],['/','Library']]){
  const {body,all}=make(path);
  const links=all.filter(x=>x.tag==='a'&&x.className==='mira-nav-item');
  assert.equal(links.length,6);
  assert.equal(links.filter(x=>x.attrs['aria-current']==='page').length,1);
  const selected=links.find(x=>x.attrs['aria-current']==='page');
  assert.equal(selected.children[1].textContent,label);
  assert.equal(body.nodes.length,1);
 }
});
test('memory accepts bounded, pre-filled URL query and remains read-only',async()=>{
 const js=await src('context.js');
 assert.match(js,/new URLSearchParams\(location\.search\)/);
 assert.match(js,/incoming\.length<=220/);
 assert.doesNotMatch(js,/method:\s*['"]POST/);
});
