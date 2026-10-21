import test from "node:test";
import assert from "node:assert/strict";
import {projectWorkClaim,readMiraWorkClaim} from "./mira-work.mjs";
const repo={ATLAS_REPOSITORY:"FumblingKnight/Sajo-Atlas",ATLAS_GITHUB_TOKEN:"mock"};
const good={schema_version:1,protocol:"mira-work-claim-v1",status:"idle",active_pr:null,active_run:null,completed_at:"2026-10-21T20:22:53Z",completion_history:[{pr:3,outcome:"passed",completed_at:"2026-10-21T20:22:53Z",result_path:"mira/work/smoke-test-result-20261022.json"}],sensitive_note:"SHOULD_NOT_LEAK"};
function asGitHub(obj,status=200){return async()=>({ok:status===200,status,async json(){const content=JSON.stringify(obj);return {encoding:"base64",size:Buffer.byteLength(content),content:Buffer.from(content).toString("base64")};}});}
test("idle Work claim reports last result without leaking internal policy or other fields",()=>{
 const result=projectWorkClaim(good);
 assert.equal(result.status,"idle");assert.equal(result.last_result.pr,3);
 assert.equal(result.active_run,null);
 assert.ok(!JSON.stringify(result).includes("SHOULD_NOT_LEAK"));
});
test("active Work claim reports owner but does not assert task liveness",()=>{
 const data={...good,status:"active",active_pr:4,active_run:"mira-work-pr4",acquired_at:"2026-10-21T21:00:00Z"};
 const result=projectWorkClaim(data);
 assert.equal(result.status,"active");assert.equal(result.active_pr,4);
 assert.match(result.caveat,/not a native ChatGPT/);
});
test("reject unsupported or malformed claims",()=>{
 assert.throws(()=>projectWorkClaim({...good,protocol:"evil"}));
 assert.throws(()=>projectWorkClaim({...good,status:"active",active_run:null}));
 assert.throws(()=>projectWorkClaim({...good,status:"stolen"}));
});
test("GitHub lookup accepts existing valid private claim",async()=>{
 const out=await readMiraWorkClaim(repo,asGitHub(good));
 assert.equal(out.last_result.outcome,"passed");
});
test("GitHub errors and missing token fail closed",async()=>{
 await assert.rejects(readMiraWorkClaim(repo,asGitHub(good,403)),/403/);
 await assert.rejects(readMiraWorkClaim({ATLAS_REPOSITORY:repo.ATLAS_REPOSITORY},asGitHub(good)),/missing/);
});
