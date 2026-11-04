import test from "node:test";
import assert from "node:assert/strict";
import {storySearch} from "./mira-story-search.mjs";

const run=async (query,fetcher)=>
  storySearch(new Request("https://mira.test/api/mira/story?"+query),fetcher);
const fake=(data,status=200)=>async url=>new Response(JSON.stringify(data),{
  status,headers:{"content-type":"application/json"}
});
test("rejects empty catalogue search without contacting provider",async()=>{
  let calls=0;
  const res=await run("mode=discover&q=x",async()=>{calls++;throw Error("should not call");});
  assert.equal(res.status,400);assert.equal(calls,0);
});
test("rejects source plot searches without explicit spoiler boundary",async()=>{
  const r=await run("mode=episodes&q=academy&mal=39196",async()=>{throw Error("called");});
  assert.equal(r.status,400);
});
test("rejects malformed query mode and medium",async()=>{
  const r=await run("q=school&medium=notvalid",async()=>{throw Error("called");});
  assert.equal(r.status,400);
});
test("filters medium and normalizes sanitized metadata",async()=>{
  let seen;
  const rows={total:3,results:[
    {work_id:"work:anime:1",title:"Anime example",type:"anime",mal_id:1,description:"hello"},
    {work_id:"work:manhwa:2",title:"Magic Academy",type:"manhwa",mal_id:2,
      description:"Long ".repeat(400),genres:["Fantasy","Romance"],themes:["School"]},
    {work_id:"work:manhwa:3",title:"Another",type:"manhwa",url:"javascript:alert(1)"}]};
  const r=await run("mode=discover&q=magic%20academy&medium=manhwa&limit=5",async url=>{
    seen=new URL(url);return new Response(JSON.stringify(rows),{status:200});
  });
  assert.equal(r.status,200);
  assert.equal(seen.origin,"https://api.aarecords.tech");
  assert.equal(seen.searchParams.get("q"),"magic academy");
  const x=await r.json();
  assert.equal(x.results.length,2);
  assert.equal(x.results[0].medium,"manhwa");
  assert.ok(x.results[0].synopsis.length<=540);
  assert.equal(x.results[0].narrative_verification,"NOT_VERIFIED");
  assert.ok(!x.results[1].url?.startsWith("javascript:"));
});
test("scene query filters out all episodes beyond cutoff even if upstream ignores it",async()=>{
  const rows={results:[
    {title:"Iruma",mal_id:39196,episode_number:4,arc_name:"School",
      scenes:[{scene_id:"ep4scene1",summary:"Classmates train",location:"Classroom"}]},
    {title:"Other",mal_id:999,episode_number:3,arc_name:"Wrong series",scenes:[{summary:"Wrong series evidence"}]},
    {title:"Iruma",mal_id:39196,episode_number:22,arc_name:"School",
      scenes:[{scene_id:"ep22scene1",summary:"Future event"}]}
  ]};
  const r=await run("mode=episodes&q=school%20friends&mal=39196&through=12",fake(rows));
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.matches.length,1);
  assert.equal(data.matches[0].episode,4);
  assert.ok(JSON.stringify(data).indexOf("Future event")<0);
  assert.ok(JSON.stringify(data).indexOf("Wrong series")<0);
});
test("arc index refuses mismatched title identity",async()=>{
  const r=await run("mode=arcs&mal=39196&through=12",fake({mal_id:999,arcs:[]}));
  assert.equal(r.status,502);
});
test("arc cutoff excludes future arc names",async()=>{
  const r=await run("mode=arcs&mal=39196&through=12",fake({mal_id:39196,title:"Iruma",arcs:[
    {arc_id:"a",arc_name:"Early",start_episode:1,end_episode:8},
    {arc_id:"b",arc_name:"Spoiler",start_episode:15,end_episode:25}]}));
  const data=await r.json();
  assert.equal(data.arcs.length,1);assert.equal(data.arcs[0].arc,"Early");
});
test("source HTTP errors fail closed without claiming story evidence",async()=>{
  const r=await run("q=magic%20academy",fake({detail:"busy"},429));
  assert.equal(r.status,503);
  const data=await r.json();
  assert.equal(data.retryable,true);assert.deepEqual(Object.keys(data).sort(),["error","reason","retryable"]);
});
