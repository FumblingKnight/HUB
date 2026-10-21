import test from "node:test";
import assert from "node:assert/strict";
import {assessWatchHealth,readMiraWatchHealth} from "./mira-health.mjs";
import {readMiraProjectStatus} from "./mira-status.mjs";
const at="2026-10-22T00:00:00.000Z",now=Date.parse(at);
const healthy={schema_version:1,component:"mira_watch_official_sources",last_run_at:"2026-10-21T22:00:00Z",run_id:"123",status:"healthy",source_errors:[],last_error:null,new_candidates:0,total_candidates:8};
const env={ATLAS_REPOSITORY:"FumblingKnight/Sajo-Atlas",ATLAS_GITHUB_TOKEN:"mock"};
const wrap=obj=>({encoding:"base64",size:Buffer.byteLength(JSON.stringify(obj)),content:Buffer.from(JSON.stringify(obj)).toString("base64")});
const fetcher=obj=>async()=>({ok:true,async json(){return wrap(obj)}});
test("healthy check with zero candidates is still a valid fresh heartbeat",()=>{
 const r=assessWatchHealth(healthy,now);
 assert.equal(r.status,"healthy");assert.equal(r.stale,false);assert.equal(r.new_candidates,0);
});
test("checks older than 12 hours cannot remain green",()=>{
 const r=assessWatchHealth({...healthy,last_run_at:"2026-10-21T02:00:00Z"},now);
 assert.equal(r.status,"stale");assert.equal(r.stale,true);
});
test("degraded and failed checks remain distinguishable",()=>{
 const bad={...healthy,status:"degraded",source_errors:[{source:"discord",error:"403"}]};
 assert.equal(assessWatchHealth(bad,now).status,"degraded");
 assert.equal(assessWatchHealth({...bad,status:"failed"},now).status,"failed");
});
test("reads private GitHub file and returns bounded projection",async()=>{
 const r=await readMiraWatchHealth(env,fetcher(healthy),now);
 assert.equal(r.run_id,"123");assert.equal(r.status,"healthy");assert.equal(JSON.stringify(r).includes("ATLAS_GITHUB_TOKEN"),false);
});
test("bad or unsupported data is rejected",async()=>{
 await assert.rejects(readMiraWatchHealth(env,fetcher({...healthy,component:"rogue"}),now),/Unsupported/);
 await assert.rejects(readMiraWatchHealth({ATLAS_REPOSITORY:env.ATLAS_REPOSITORY},fetcher(healthy),now),/unavailable/);
});
test("status endpoint returns unavailable health without leaking checkpoint internals",async()=>{
 const state={schema_version:1,project:"Mira",milestones:[],verified:[],outstanding_user_approvals:[],sensitive_key:"PRIVATE"};
 const r=await readMiraProjectStatus(env,fetcher(state));
 assert.equal(r.watch_health.status,"unavailable");
 assert.equal(JSON.stringify(r).includes("PRIVATE"),false);
});
