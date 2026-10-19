import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";
import {readMiraProjectStatus} from "./mira-status.mjs";
const env={ATLAS_REPOSITORY:"FumblingKnight/Sajo-Atlas",ATLAS_GITHUB_TOKEN:"test-secret"};
const state={schema_version:1,project:"Mira",checkpoint_status:"testing",updated_ist:"2026-10-20",milestones:[{id:"P1",title:"Cloud",status:"completed"}],verified:[{claim:"Safe test",evidence:"Evidence link"}],outstanding_user_approvals:[{id:"U1",status:"pending_user_later",task:"Configure Work later",required_now:false}],next_actions:["Build improvements"],sensitive_internal_data:"must not reach browser"};
const mock=(data=state,status=200)=>async()=>({ok:status===200,status,async json(){return {encoding:"base64",size:JSON.stringify(data).length,content:Buffer.from(JSON.stringify(data)).toString("base64")}}});
test("private status projects milestones and pending queue without leaking unneeded checkpoint keys",async()=>{
 const out=await readMiraProjectStatus(env,mock());
 assert.equal(out.milestones[0].title,"Cloud");
 assert.equal(out.deferred_actions.length,1);
 assert.equal(out.blocked_on_user,false);
 assert.equal(JSON.stringify(out).includes("sensitive_internal_data"),false);
});
test("status rejects missing private GitHub token",async()=>{await assert.rejects(readMiraProjectStatus({ATLAS_REPOSITORY:env.ATLAS_REPOSITORY},mock()),/unavailable/);});
test("status rejects wrong schema or repository error",async()=>{
 await assert.rejects(readMiraProjectStatus(env,mock({...state,schema_version:7})),/Unsupported/);
 await assert.rejects(readMiraProjectStatus(env,mock(state,403)),/403/);
});
test("status API blocks anonymous access to private project records",async()=>{
 const response=await worker.fetch(new Request("https://atlas.example/api/mira/status"),{ATLAS_LOGIN_PASSPHRASE:"LongValidSecretPassphraseABC123!"});
 assert.equal(response.status,401);
});
