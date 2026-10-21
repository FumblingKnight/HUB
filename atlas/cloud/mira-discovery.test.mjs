import test from "node:test";
import assert from "node:assert/strict";
import {projectDiscovery,selectDiverseLeads,queueDiscovery,readDiscovery} from "./mira-discovery.mjs";
import worker from "./worker.mjs";
const env={ATLAS_REPOSITORY:"FumblingKnight/Sajo-Atlas",ATLAS_GITHUB_TOKEN:"mock"};
function makeBlob(data){const content=JSON.stringify(data);return {sha:"current-sha",size:content.length,encoding:"base64",content:Buffer.from(content).toString("base64")};}
test("only unreviewed HTTPS leads reach client, without raw private fields",()=>{
 const scan={schema_version:1,component:"mira_world_radar",status:"healthy",last_run_at:"2026-10-22T03:00:00Z",sources_ok:3,sources_total:4};
 const queue={schema_version:1,candidates:[
  {id:"a",title:"New observation",source_url:"https://example.org/news",source_name:"Public",status:"unreviewed",private_notes:"SECRET"},
  {id:"b",title:"Published",source_url:"https://example.org/published",status:"promoted"},
  {id:"c",title:"Unsafe",source_url:"javascript:alert(1)",status:"unreviewed"}]};
 const r=projectDiscovery({status:scan,candidates:queue});
 assert.equal(r.leads.length,1);assert.equal(r.scan.status,"healthy");assert.equal(JSON.stringify(r).includes("SECRET"),false);
});
test("new signed-in refresh writes private GitHub request that generates a push event",async()=>{
 let method,request;
 const fetcher=async(url,opt={})=>{
  if(opt.method==="PUT"){method="PUT";request=JSON.parse(Buffer.from(JSON.parse(opt.body).content,"base64").toString("utf8"));return {ok:true,status:201};}
  return {status:404,ok:false};
 };
 const r=await queueDiscovery(env,{fetcher,now:"2026-10-22T03:10:00Z"});
 assert.equal(r.queued,true);assert.equal(r.reused,false);
 assert.equal(request.component,"mira_radar_refresh");assert.equal(request.ai_started,false);
 assert.equal(method,"PUT");
});
test("rapid double refresh reuses recent request instead of consuming Actions again",async()=>{
 let wrote=false;
 const existing={schema_version:1,component:"mira_radar_refresh",requested_at:"2026-10-22T03:10:00Z"};
 const fetcher=async(url,opt={})=>{
  if(opt.method==="PUT"){wrote=true;throw Error("Should not write");}
  return {ok:true,status:200,json:async()=>makeBlob(existing)};
 };
 const r=await queueDiscovery(env,{fetcher,now:"2026-10-22T03:13:00Z"});
 assert.equal(r.reused,true);assert.equal(wrote,false);
});
test("latest scan completing after request stops displaying pending",()=>{
 const status={schema_version:1,component:"mira_world_radar",last_run_at:"2026-10-22T03:16:00Z",status:"healthy"};
 const request={schema_version:1,component:"mira_radar_refresh",requested_at:"2026-10-22T03:10:00Z"};
 assert.equal(projectDiscovery({status,request,now:Date.parse("2026-10-22T03:18:00Z")}).refresh.pending,false);
 assert.equal(projectDiscovery({status:{...status,last_run_at:"2026-10-22T03:00:00Z"},request,now:Date.parse("2026-10-22T03:18:00Z")}).refresh.pending,true);
});
test("read-only view handles missing status files without inventing healthy collector",async()=>{
 const out=await readDiscovery(env,async()=>({ok:false,status:404}));
 assert.equal(out.scan.status,"not_verified");assert.deepEqual(out.leads,[]);
});
test("cross-repository requests are forbidden",async()=>{
 await assert.rejects(queueDiscovery({...env,ATLAS_REPOSITORY:"other/repo"}),/unavailable/);
});
test("anonymous POST and GET discovery remain blocked by original ATLAS auth",async()=>{
 for(const method of ["GET","POST"]){
  const req=new Request("https://atlas.example/api/mira/discover",{method,headers:method==="POST"?{origin:"https://atlas.example","content-type":"application/json"}:{},body:method==="POST"?"{}":undefined});
  const res=await worker.fetch(req,{ATLAS_LOGIN_PASSPHRASE:"LongValidSecretPassphraseABC123!"});
  assert.equal(res.status,401);
 }
});

test("discovery inbox preserves topical diversity and demotes preprints when stronger news is available",()=>{
 const items=[
  ...Array.from({length:10},(_,i)=>({id:"s"+i,category:"science",source_id:"science-arxiv",title:"Preprint "+i,source_url:"https://arxiv.org/abs/"+i,status:"unreviewed",priority_hint:20,published_at:"2026-10-21T11:00:00Z"})),
  {id:"php",category:"technology",source_id:"technology-hn",title:"PHP critical security release",source_url:"https://php.net",status:"unreviewed",priority_hint:75,published_at:"2026-10-21T12:00:00Z"},
  {id:"culture",category:"culture",source_id:"culture-news",title:"New artistic exhibition",source_url:"https://example.org",status:"unreviewed",priority_hint:45,published_at:"2026-10-21T12:00:00Z"},
  {id:"bad",category:"world",source_id:"unknown",title:"Invalid",source_url:"javascript:alert(1)",status:"unreviewed"}];
 const selected=selectDiverseLeads(items);
 assert.equal(selected[0].id,"php");
 assert.ok(selected.some(x=>x.category==="culture"));
 assert.equal(selected.filter(x=>x.category==="science").length,3);
 assert.ok(!selected.some(x=>x.id==="bad"));
});
