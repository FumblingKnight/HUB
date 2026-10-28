import test from "node:test";
import assert from "node:assert/strict";
import {readNewspaper,updateNewspaperFeedback} from "./mira-newspaper.mjs";
const ENV={ATLAS_REPOSITORY:"example/private",ATLAS_GITHUB_TOKEN:"TEST_NOT_A_SECRET"};
const encode=s=>Buffer.from(JSON.stringify(s),"utf8").toString("base64");
const testNews={schema_version:1,stories:[{id:"my-story",title:"One story",url:"https://example.com/a",summary:"A",vote:"unexpected",note:"do not reveal"}],wire:[{title:"Feed",url:"https://example.com/b"}],morning:{title:"Morning"},stats:{runs:2}};
function fetcher(state){
 return async (url,opts)=>{
  const file=url.split("/").at(-1);
  const get=f=>f?new Response(JSON.stringify({encoding:"base64",size:JSON.stringify(f).length,content:encode(f),sha:"sha123"}),{status:200}):new Response("No",{status:404});
  if((opts?.method||"GET")==="GET")return get(state[file]);
  if(opts.method==="PUT"){state[file]=JSON.parse(Buffer.from(JSON.parse(opts.body).content,"base64").toString());return new Response(JSON.stringify({commit:{sha:"done"}}),{status:200});}
  return new Response("no",{status:500});
 };
}
test("private news is clean and feedback included",async()=>{
 const out=await readNewspaper(ENV,fetcher({"current.json":testNews,"feedback.json":{"my-story":{vote:"up",following:true}}}));
 assert.equal(out.stories[0].vote,"up");
 assert.equal(out.stories[0].note,"");
 assert.equal(out.stories[0].following,true);
 assert.equal(out.wire.length,1);
});
test("anonymous or forged origin cannot write",async()=>{
 const f=fetcher({"current.json":testNews,"feedback.json":{}});
 const r=await updateNewspaperFeedback(new Request("https://example.workers.dev/api/mira/newspaper/feedback",{method:"POST",body:JSON.stringify({id:"my-story",vote:"up"}),headers:{"content-type":"application/json","origin":"https://evil.test"}}),ENV,new URL("https://example.workers.dev/api/mira/newspaper/feedback"),f);
 assert.equal(r.status,403);
});
test("valid source-linked story feedback works with bounded fields",async()=>{
 const state={"current.json":testNews,"feedback.json":{}},f=fetcher(state);
 const request=new Request("https://example.workers.dev/api/mira/newspaper/feedback",{method:"POST",body:JSON.stringify({id:"my-story",following:true,note:"Keep watching"}),headers:{"origin":"https://example.workers.dev","content-type":"application/json"}});
 const r=await updateNewspaperFeedback(request,ENV,new URL(request.url),f);
 assert.equal(r.status,200);
 assert.equal(state["feedback.json"]["my-story"].following,true);
 assert.equal(state["feedback.json"]["my-story"].note,"Keep watching");
});
test("missing files show honest empty edition",async()=>{
 const out=await readNewspaper(ENV,fetcher({}));
 assert.equal(out.stories.length,0);
 assert.equal(out.morning,null);
});
test("rejects unsafe article URLs from private store",async()=>{
 const bad={...testNews,stories:[{id:"bad",title:"Bad",url:"javascript:alert(1)"}]};
 const out=await readNewspaper(ENV,fetcher({"current.json":bad}));
 assert.equal(out.stories.length,0);
});
