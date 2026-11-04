import test from "node:test";
import assert from "node:assert/strict";
import {printThemes} from "./mira-print-themes.mjs";
const matching={id:1464,type:"manhwa",content_rating:"safe",
  source:{my_anime_list:{id:154692}},titles:[{language:"en",title:"The Infinite Mage",is_primary:true}],
  last_updated_at:"2026-11-04",total_chapters:144,
  tags:[
    {id:611,name:"Magic School",name_path:"Settings > Magic School",weight:"core",is_spoiler:false,content_rating:"safe"},
    {id:107,name:"School",name_path:"Locations > School",weight:"defining",is_spoiler:false,content_rating:"safe"},
    {id:300,name:"Secret ending",name_path:"Spoiler",weight:"core",is_spoiler:true,content_rating:"safe"},
    {id:301,name:"Explicit",weight:"core",is_spoiler:false,content_rating:"pornographic"},
    {id:120,name:"Academy trip",weight:"incidental",is_spoiler:false,content_rating:"safe"}
  ]};
const factory=async url=>{
 const p=new URL(url);
 if(p.pathname==="/v2/series/search")return new Response(JSON.stringify({status:200,data:[matching]}));
 if(p.pathname==="/v2/series/1464")return new Response(JSON.stringify({status:200,data:matching}));
 throw Error("Wrong path");
};
test("only exact cross-provider MAL ID can produce theme evidence",async()=>{
 const a=await printThemes({title:"The Infinite Mage",mal:154692,medium:"manhwa"},factory);
 assert.equal(a.status,"MATCHED_MAL_ID");
 assert.equal(a.source,"https://mangabaka.org/1464");
 assert.deepEqual(a.tags.map(x=>x.name),["Magic School","School","Academy trip"]);
 assert.equal(a.tags[0].weight,"core");
 assert.equal(a.counts.strong,2);
 assert.equal(a.total_chapters,144);
});
test("mismatched MAL ID abstains and never fetches full record",async()=>{
 let count=0;const fake=async url=>{count++;return factory(url)};
 const r=await printThemes({title:"Infinite Mage",mal:1234,medium:"manhwa"},fake);
 assert.equal(r.status,"NOT_INDEXED_OR_ID_MISMATCH");assert.equal(count,1);
});
test("source must preserve media kind even with matching MAL id",async()=>{
 const fake=async url=>new Response(JSON.stringify({status:200,data: new URL(url).pathname.includes("search")?
    [{...matching,type:"manga"}]:matching}));
 const r=await printThemes({title:"Infinite Mage",mal:154692,medium:"manhwa"},fake);
 assert.equal(r.status,"NOT_INDEXED_OR_ID_MISMATCH");
});
test("rejects identity change between search and full fetch",async()=>{
 const fake=async url=>new Response(JSON.stringify({status:200,data:new URL(url).pathname.includes("search")?
   [matching]:{...matching,source:{my_anime_list:{id:42}}}}));
 await assert.rejects(printThemes({title:"Infinite Mage",mal:154692,medium:"manhwa"},fake),/identity mismatch/);
});
test("input validation prevents arbitrary URLs and malformed scopes",async()=>{
 await assert.rejects(printThemes({title:"x",mal:1,medium:"manhwa"},factory));
 await assert.rejects(printThemes({title:"Infinite Mage",mal:154692,medium:"anime"},factory));
});
test("source errors are surfaced, not converted to success",async()=>{
 await assert.rejects(printThemes({title:"Infinite Mage",mal:154692,medium:"manhwa"},async()=>new Response("{}",{status:429})),/rate limited/);
});
