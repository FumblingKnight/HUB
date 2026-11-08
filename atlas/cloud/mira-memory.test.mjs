import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import {issueSession} from './session.mjs';
import {memoryEndpoint,projectMemory} from './mira-memory.mjs';
const pass='synthetic-test-only-passphrase-very-long';
const env={ATLAS_LOGIN_PASSPHRASE:pass,ATLAS_REPOSITORY:'fixture/private',ATLAS_GITHUB_TOKEN:'fixture-only'};
const e=(id,kind,key,text,entities,tags,supersedes)=>({id,kind,key,text,entities,tags,...(supersedes?{supersedes}:{}),
 at:'2026-11-08T00:00:00Z',trust:'reviewed-synthetic',
 source:{url:'https://example.org/fictional/'+id,observation:'Fictional test, not user data'}});
const state={schema_version:1,revision:4,events:[
 e('old','profile','format','Fictional person preferred video.',['person'],['format']),
 e('now','profile','format','Fictional person now prefers text.',['person'],['format'],'old'),
 e('school','fact','school','Fictional learner attends fictional coaching.',['person','orion'],['coaching']),
 e('cousin','fact','family','Fictional cousin also attends Orion.',['cousin','orion'],['cousin']),
]};
const request=(q='coaching',cookie)=>new Request('https://atlas.invalid/api/mira/memory?q='+q,{headers:cookie?{cookie}:{}});
test('real Worker auth gate denies anonymous and forged session before storage fetch',async()=>{
 let calls=0;const old=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('should not fetch');};
 try{
  for(const cookie of [undefined,'atlas_session=forged']){
   const r=await worker.fetch(request('coaching',cookie),env);
   assert.equal(r.status,401);assert.equal(calls,0);assert.match(r.headers.get('cache-control'),/no-store/);
  }
 }finally{globalThis.fetch=old;}
});
test('signed synthetic session retrieves fixed private source and association',async()=>{
 const cookie=(await issueSession(pass)).split(';')[0];let called=0;
 const old=globalThis.fetch;globalThis.fetch=async(url,options)=>{
  called++;assert.equal(url,'https://api.github.com/repos/fixture/private/contents/mira/memory-mvp/synthetic-state.json?ref=main');
  assert.equal(options.cache,'no-store');assert.equal(options.headers.authorization,'Bearer fixture-only');
  return new Response(JSON.stringify(state));
 };
 try{
  const r=await worker.fetch(request('coaching',cookie),env);assert.equal(r.status,200);
  assert.equal(r.headers.get('vary'),'Cookie');assert.match(r.headers.get('cache-control'),/no-store/);
  assert.equal(r.headers.get('access-control-allow-origin'),null);
  const data=await r.json();assert.ok(data.memories.some(x=>x.id==='cousin'&&x.path[0]==='school'));
  assert.deepEqual(data.profile.map(x=>x.id),['now']);assert.equal(called,1);
  assert.ok(!JSON.stringify(data).includes('fixture-only'));
 }finally{globalThis.fetch=old;}
});
test('signed cookie for other secret is rejected',async()=>{
 const cookie=(await issueSession(pass+'other')).split(';')[0];
 assert.equal((await worker.fetch(request('coaching',cookie),env)).status,401);
});
test('unrelated query suppresses memory, profile stays explicit',()=>{
 assert.deepEqual(projectMemory(state,'orbital mechanics').memories,[]);
});
test('conflicting profile assertions withheld',()=>{
 const s=structuredClone(state);s.events.push(e('conflict','profile','format','Different.',['person'],['format']));
 assert.deepEqual(projectMemory(s,'format').profile,[]);
 assert.ok(projectMemory(s,'format').memories.filter(x=>['now','conflict'].includes(x.id)).every(x=>x.status==='CONTESTED'&&x.text===null));
});
test('reject user/path selectors, duplicates and oversized query before fetch',async()=>{
 let count=0;
 for(const suffix of ['?user=other','?path=vault.json','?q=a&q=b','?limit=99','?q='+('a'.repeat(221))]){
  const r=await memoryEndpoint(new Request('https://atlas.invalid/api/mira/memory'+suffix),env,async()=>{count++;});
  assert.equal(r.status,400);
 }assert.equal(count,0);
});
test('no upstream error or malformed data reveals secrets',async()=>{
 for(const response of [
  ()=>{throw Error('secret-token-stack');},
  ()=>new Response('secret-upstream',{status:403}),
  ()=>new Response('invalid-json'),
  ()=>new Response(JSON.stringify({...state,schema_version:99})),
  ()=>new Response('x'.repeat(32769)),
  ()=>new Response(JSON.stringify({...state,events:Array(101).fill(state.events[0])})),
 ]){
  const r=await memoryEndpoint(request(),env,response);assert.equal(r.status,503);
  assert.deepEqual(await r.json(),{error:'Memory source unavailable'});
 }
});
test('malformed provenance and corrections rejected',()=>{
 for(const patch of [{trust:'personal-history'},{source:{url:'https://evil.invalid/secret',observation:'x'}},{supersedes:'missing'},{entities:['bad entity']}])
  assert.throws(()=>projectMemory({...state,events:[{...state.events[0],...patch}]},'coaching'));
});
test('write methods rejected; no network mutation',async()=>{
 assert.equal((await memoryEndpoint(new Request('https://atlas.invalid/api/mira/memory',{method:'POST'}),env)).status,405);
});
test('memory page and all new assets remain behind original auth gate',async()=>{
 const cookie=(await issueSession(pass)).split(';')[0];let calls=0;
 const local={...env,ASSETS:{fetch:async req=>{calls++;return new Response('synthetic static fixture');}}};
 for(const path of ['/memory.html','/memory.js','/memory.css','/home.html','/context.html']){
  const anon=await worker.fetch(new Request('https://atlas.invalid'+path),local);
  assert.equal(anon.status,303);assert.equal(anon.headers.get('location'),'/login');
  const signed=await worker.fetch(new Request('https://atlas.invalid'+path,{headers:{cookie}}),local);
  assert.equal(signed.status,200);assert.match(signed.headers.get('cache-control'),/no-store/);
  assert.match(signed.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 }assert.equal(calls,5);
});

test('fresh Node process recalls persisted synthetic state',async()=>{
 const {execFileSync}=await import('node:child_process');
 const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');
 const {tmpdir}=await import('node:os');
 const d=mkdtempSync(tmpdir()+'/mira-test-');
 try{
  const path=d+'/fixture.json';writeFileSync(path,JSON.stringify(state));
  const output=execFileSync(process.execPath,['--input-type=module','-e',
   "import {readFileSync} from 'node:fs';import {projectMemory} from './atlas/cloud/mira-memory.mjs';console.log(JSON.stringify(projectMemory(JSON.parse(readFileSync(process.argv[1])),'coaching')))",path],{encoding:'utf8'});
  const x=JSON.parse(output);assert.ok(x.memories.some(e=>e.id==='cousin'));
  assert.deepEqual(x.profile.map(e=>e.id),['now']);
 }finally{rmSync(d,{recursive:true});}
});
