import test from "node:test";
import assert from "node:assert/strict";
import cloud from "./worker.mjs";
const url="https://example.workers.dev/mcp";
const mkRequest=(body,token="test-secret")=>new Request(url,{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+token},body:JSON.stringify(body)});
const rpc=(method,id,params)=>({jsonrpc:"2.0",id,method,...(params?{params}:{})});
const env={JARVIS_PLUGIN_TOKEN:"test-secret"};
test("no publicly accessible model calls or training writes",async()=>{
  assert.equal((await cloud.fetch(new Request(url,{method:"POST",body:"{}"}),env)).status,401);
  assert.equal((await cloud.fetch(mkRequest(rpc("tools/list",1),"bad"),env)).status,401);
  const noSecret=await cloud.fetch(mkRequest(rpc("tools/list",1)),{});
  assert.equal(noSecret.status,401);
});
test("stateless MCP initialize and tools schema",async()=>{
  const init=await cloud.fetch(mkRequest(rpc("initialize",1,{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"test",version:"1"}})),env);
  const data=await init.json();
  assert.equal(data.id,1);
  assert.equal(data.result.serverInfo.name,"jarvis-neural-lab");
  assert.equal(data.result.protocolVersion,"2025-06-18");
  const tools=await (await cloud.fetch(mkRequest(rpc("tools/list","2")),env)).json();
  assert.equal(tools.result.tools.length,4);
  assert.ok(tools.result.tools.every(t=>t.inputSchema && t.annotations));
});
test("status reports honestly without training or DB",async()=>{
  const health=await (await cloud.fetch(new Request("https://example.workers.dev/health"),env)).json();
  assert.equal(health.adapterDeployed,false);
  const result=await (await cloud.fetch(mkRequest(rpc("tools/call",3,{name:"neural_training_status",arguments:{}})),env)).json();
  const status=JSON.parse(result.result.content[0].text);
  assert.equal(status.gptWeightsTrainable,false);
  assert.equal(status.verifiedExamples,null);
});
test("cannot claim learning when no adapter is uploaded",async()=>{
  const ai={run:async()=>{throw Error("Should not invoke model when no LoRA uploaded")}};
  const r=await cloud.fetch(mkRequest(rpc("tools/call",4,{name:"compare_neural_models",arguments:{prompt:"Unseen prompt"}})),{...env,AI:ai});
  assert.match((await r.text()),/not_trained/);
});
test("same prompt goes to base model and learned LoRA",async()=>{
  const calls=[];
  const ai={run:async(model,params)=>{calls.push({model,params});return {response:params.lora?"adapted":"base"}}};
  const r=await cloud.fetch(mkRequest(rpc("tools/call",5,{name:"compare_neural_models",arguments:{prompt:"Test transfer"}})),{...env,AI:ai,JARVIS_LORA_ID:"my-adapter"});
  const body=await r.json();
  assert.equal(body.result.isError,false);
  assert.equal(calls.length,2);
  assert.equal(calls[0].model,calls[1].model);
  assert.deepEqual(calls[0].params.messages,calls[1].params.messages);
  assert.equal(calls[0].params.lora,undefined);
  assert.equal(calls[1].params.lora,"my-adapter");
});
test("saving requires private DB and explicit user verification",async()=>{
  const saved=[];
  const db={prepare:()=>({bind:(...params)=>({run:async()=>{saved.push(params)}})})};
  const call=(arg)=>cloud.fetch(mkRequest(rpc("tools/call",6,{name:"record_verified_training_example",arguments:arg})),{...env,DB:db});
  await call({prompt:"Hello",ideal:"Hi",user_confirmed:false});
  assert.equal(saved.length,0);
  const res=await call({prompt:"Hello",ideal:"Hi",user_confirmed:true});
  assert.equal(saved.length,1);
  assert.match((await res.text()),/"trained\\":false/);
});
