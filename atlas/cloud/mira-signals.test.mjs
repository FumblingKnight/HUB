import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import {readMiraSignals} from './mira-signals.mjs';
const env={ATLAS_REPOSITORY:'FumblingKnight/Sajo-Atlas',ATLAS_GITHUB_TOKEN:'test-secret'};
const base={schema_version:1,watched_topics:[],items:[{id:'i1',title:'Relevant update',source_url:'https://www.reddit.com/r/help',source_name:'Reddit',summary:'Interesting discovery'}]};
const mock=(obj,status=200)=>async()=>({ok:status===200,status,async json(){return {encoding:'base64',size:JSON.stringify(obj).length,content:Buffer.from(JSON.stringify(obj)).toString('base64')}}});
test('private source read and safe projection',async()=>{const r=await readMiraSignals(env,mock(base));assert.equal(r.items.length,1);assert.equal(r.items[0].title,'Relevant update');assert.equal(r.items[0].urgency,0);});
test('reject missing token',async()=>{await assert.rejects(readMiraSignals({ATLAS_REPOSITORY:'x/y'},mock(base)),/not connected/);});
test('reject GitHub failure',async()=>{await assert.rejects(readMiraSignals(env,mock(base,403)),/403/);});
test('reject malicious source URL',async()=>{await assert.rejects(readMiraSignals(env,mock({...base,items:[{...base.items[0],source_url:'javascript:alert(1)'}]})),/Unsafe/);});
test('reject bad schema',async()=>{await assert.rejects(readMiraSignals(env,mock({...base,schema_version:2})),/schema/);});
test('truncate excessively long text',async()=>{const r=await readMiraSignals(env,mock({...base,items:[{...base.items[0],title:'X'.repeat(600)}]}));assert.equal(r.items[0].title.length,250);});
test('private Mira route cannot read repository without authenticated session',async()=>{
 const request=new Request('https://atlas.example/api/mira/signals');
 const response=await worker.fetch(request,{ATLAS_LOGIN_PASSPHRASE:'LongValidSecretPassphraseABC123!'});
 assert.equal(response.status,401);
 const json=await response.json();assert.equal(json.error,'Login required');
});

test('source-linked timed lead preserves explicit expiration without changing its original source',async()=>{
 const item={...base.items[0],expires_at:'2026-10-22T00:00:00+05:30',status:'archived'};
 const result=await readMiraSignals(env,mock({...base,items:[item]}));
 assert.equal(result.items[0].expires_at,'2026-10-22T00:00:00+05:30');
 assert.equal(result.items[0].status,'archived');
 assert.equal(result.items[0].source_url,item.source_url);
});
test('invalid expiry metadata does not become a valid deadline',async()=>{
 const result=await readMiraSignals(env,mock({...base,items:[{...base.items[0],expires_at:'not-a-time'}]}));
 assert.equal(result.items[0].expires_at,null);
});

test("curated deep-dive fields are projected safely with explicit story cluster identity",async()=>{
 const value={...base.items[0],story_id:"event-canonical",source_kind:"official",
  image_url:"https://i.ytimg.com/vi/IBTK8PGe_Oo/hqdefault.jpg",
  coverage:[{url:"https://www.reddit.com/r/example",label:"Community conversation",type:"community",note:"Unverified user reactions"},
    {url:"javascript:alert(1)",label:"Attack",type:"official"}],
  additional_sources:["https://example.org/press","data:text/html,bad"],
  key_points:["Documented fact","Community report not a confirmation"],
  why_it_matters:"Project relevance",background:"Earlier changes and context",community_note:"Opinions differ"};
 const res=await readMiraSignals(env,mock({...base,items:[value]}));
 const item=res.items[0];
 assert.equal(item.story_id,"event-canonical");assert.equal(item.coverage.length,1);
 assert.equal(item.coverage[0].type,"community");assert.equal(item.additional_sources.length,1);
 assert.equal(item.image_url,value.image_url);assert.equal(item.key_points.length,2);
 assert.equal(item.why_it_matters,"Project relevance");
});
test("malicious cover URL never reaches private feed",async()=>{
 const value={...base.items[0],image_url:"https://example.com/collect-ip.jpg",story_id:"../unsafe",
  coverage:[{url:"https://user:password@source.com/private"}]};
 const item=(await readMiraSignals(env,mock({...base,items:[value]}))).items[0];
 assert.equal(item.image_url,null);assert.equal(item.story_id,value.id);assert.equal(item.coverage.length,0);
});
test("story page and article scripts redirect anonymous visitors",async()=>{
 for(const path of ["/story.html","/story.js","/story-model.mjs","/signals-reader.css"]){
  const res=await worker.fetch(new Request("https://atlas.example"+path),{ATLAS_LOGIN_PASSPHRASE:"LongValidSecretPassphraseABC123!"});
  assert.equal(res.status,303,path);
  assert.equal(res.headers.get("location"),"/login");
 }
});
