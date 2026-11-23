import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";
import {issueSession} from "./session.mjs";

test("only the authenticated newspaper document may frame the privacy-enhanced video origin",async()=>{
 const secret="Fictional QA passphrase only";
 const env={ATLAS_LOGIN_PASSPHRASE:secret,ASSETS:{fetch:async()=>new Response("fictional assets")}};
 const origin="https://example.test";
 const request=(path,header={})=>new Request(origin+path,{headers:header});
 const denied=await worker.fetch(request("/newspaper.html"),env);
 assert.equal(denied.status,303);
 assert.equal(denied.headers.get("location"),"/login");
 assert.equal(denied.headers.get("content-security-policy"),null);
 const api=await worker.fetch(request("/api/mira/newspaper"),env);
 assert.equal(api.status,401);
 const cookie=(await issueSession(secret)).split(";")[0];
 const reader=await worker.fetch(request("/newspaper.html",{cookie}),env);
 const csp=reader.headers.get("content-security-policy");
 assert.match(csp,/; frame-src https:\/\/www\.youtube-nocookie\.com$/);
 assert.match(csp,/frame-ancestors 'none'/);
 assert.equal(reader.headers.get("x-frame-options"),"DENY");
 assert.equal(reader.headers.get("referrer-policy"),"no-referrer");
 assert.equal(reader.headers.get("cache-control"),"private, no-store");
 for(const path of ["/login","/home.html","/newspaper.js"]){
  const response=await worker.fetch(request(path,{cookie}),env);
  assert.doesNotMatch(response.headers.get("content-security-policy"),/youtube-nocookie|frame-src/);
 }
});
