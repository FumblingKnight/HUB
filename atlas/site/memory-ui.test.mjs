import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const src=n=>readFile(new URL(n,import.meta.url),'utf8');
test('one primary real memory entry and secondary example disclosure',async()=>{
 const home=await src('home.html'),context=await src('context.html');
 assert.ok(!home.includes('href="/memory.html"'));
 assert.equal((home.match(/href="\/context.html" class="home-door"/g)||[]).length,1);
 assert.match(context,/<details class="recall-example">/);
 assert.match(context,/href="\/memory.html"/);
});
test('example uses shared design and safe collapsed provenance, deduplicating profile',async()=>{
 const html=await src('memory.html'),js=await src('memory.js'),css=await src('memory.css');
 assert.match(html,/viewer.css/);assert.match(html,/viewer-shell.js/);
 assert.match(html,/FICTIONAL EXAMPLE/);assert.match(css,/@media\(max-width:680px\)/);
 assert.doesNotMatch(js,/innerHTML|insertAdjacentHTML/);
 assert.match(js,/node\('details'\)/);assert.doesNotMatch(js,/\.open\s*=\s*true/);
 const make=tag=>({tag,children:[],className:'',textContent:'',append(...x){this.children.push(...x);},replaceChildren(){this.children=[];},addEventListener(){}});
 const nodes=Object.fromEntries(['search','query','status','profile','memories'].map(x=>[x,make(x)]));
 let callback;const profile={id:'p',text:'Fictional profile',source:{url:'https://example.org/fictional/p'},at:'2026-11-08'};
 const memory={id:'m',text:'Related fictional episode',source:{url:'https://example.org/fictional/m'},at:'2026-11-08',path:['p','m']};
 const sandbox={document:{getElementById:id=>nodes[id],createElement:make},AbortController,URLSearchParams,
  fetch:async()=>({ok:true,json:async()=>({profile:[profile],memories:[profile,memory]})})};
 runInNewContext(js,sandbox);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(nodes.profile.children.length,1);assert.equal(nodes.memories.children.length,1);
 assert.equal(nodes.memories.children[0].children[0].textContent,memory.text);
 assert.equal(nodes.memories.children[0].children[1].tag,'details');
});
