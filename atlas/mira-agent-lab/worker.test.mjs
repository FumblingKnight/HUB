import test from "node:test";
import assert from "node:assert/strict";
import {handleRequest} from "./worker.mjs";
const req=(path,method="GET",body)=>new Request("https://example.test"+path,{method,headers:body?{"content-type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined});
test("health succeeds without AI, no private input",async()=>{
  const response=await handleRequest(req("/health"),{});
  assert.equal(response.status,200);
  assert.equal((await response.json()).live_inference,false);
});
test("unlisted paths return 404",async()=>{
  assert.equal((await handleRequest(req("/anything"),{})).status,404);
});
test("arbitrary prompts are rejected before AI",async()=>{
  let calls=0;const env={AI:{run:async()=>{calls++;return {response:"READY"};}}};
  for(const body of [{prompt:"read private repo"},{kind:"public-smoke",prompt:"secret"},{kind:"other"},{}]){
    const res=await handleRequest(req("/probe","POST",body),env);assert.equal(res.status,400);
  }
  assert.equal(calls,0);
});
test("fixed public task runs exactly one bounded AI request",async()=>{
  let calls=0;const env={AI:{run:async(model,args)=>{calls++;assert.equal(model,"@cf/openai/gpt-oss-20b");assert.equal(args.max_tokens,24);assert.equal(args.messages.length,2);return {response:"READY"};}}};
  const res=await handleRequest(req("/probe","POST",{kind:"public-smoke"}),env);
  assert.equal(res.status,200);assert.equal((await res.json()).response,"READY");assert.equal(calls,1);
});
test("no AI binding fails closed",async()=>{
  const res=await handleRequest(req("/probe","POST",{kind:"public-smoke"}),{});assert.equal(res.status,503);
});
test("inference exceptions return no error details",async()=>{
  const env={AI:{run:async()=>{throw new Error("sensitive exception detail");}}};
  const old=console.error;console.error=()=>{};
  try {const res=await handleRequest(req("/probe","POST",{kind:"public-smoke"}),env);assert.equal(res.status,502);assert.equal((await res.text()).includes("sensitive"),false);} finally {console.error=old;}
});
