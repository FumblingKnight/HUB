import test from "node:test";
import assert from "node:assert/strict";
import {emptyVault,reconcile} from "./core.mjs";
import {searchVaultContext} from "./retrieve-context.mjs";
const fixture=()=>{
 const v=emptyVault();
 reconcile(v,{title:"Project Mira",kind:"project",aliases:["Mira"],tags:["assistant","autonomy"],
  summary:"ChatGPT assistant with persistent checkpoints and GitHub recovery",
  claims:[{predicate:"execution status",value:"GitHub code job recovery tested",cardinality:"one"}],
  source:{label:"Verified recovery report",url:"https://github.com/FumblingKnight/Sajo-Atlas"}});
 reconcile(v,{title:"Project Mira",claims:[{predicate:"execution status",value:"ChatGPT itself not automatically restartable",cardinality:"one"}]});
 reconcile(v,{title:"Cloudflare workflows",kind:"technology",summary:"Durable cloud tasks for controlled code"});
 reconcile(v,{title:"Cooking",kind:"hobby",summary:"Recipes and fruit"});
 return v;
};
test("title and alias retrieve same canonical entity",()=>{
 const v=fixture();
 for(const query of ["Mira","Project Mira"]){
  const r=searchVaultContext(v,query);
  assert.equal(r.items[0].title,"Project Mira");
  assert.equal(r.matched>=1,true);
 }
});
test("substantive natural language queries find project memory",()=>{
 const r=searchVaultContext(fixture(),"What is Mira execution status?");
 assert.equal(r.items[0].title,"Project Mira");
 assert.ok(r.items[0].matched.includes("claims"));
});
test("unrelated query is not matched",()=>{
 assert.deepEqual(searchVaultContext(fixture(),"snowboarding details").items,[]);
});
test("returns source provenance and preserves contradictory values as disputed",()=>{
 const r=searchVaultContext(fixture(),"Project Mira");
 assert.equal(r.items[0].claims.length,2);
 assert.ok(r.items[0].claims.every(c=>c.status==="disputed"));
 assert.ok(r.items[0].claims[0].source.url.startsWith("https://"));
});
test("stable output order and bounded results",()=>{
 const v=fixture();
 assert.deepEqual(searchVaultContext(v,"cloud", {limit:2}),searchVaultContext(v,"cloud", {limit:2}));
 assert.ok(searchVaultContext(v,"cloud",{limit:1}).items.length<=1);
});
test("reject empty or overlong query and invalid limits",()=>{
 const v=fixture();
 for(const q of [" ","a","a".repeat(221)])assert.throws(()=>searchVaultContext(v,q));
 for(const limit of [-1,0,1.5,11])assert.throws(()=>searchVaultContext(v,"Mira",{limit}));
});
test("do not mutate canonical graph",()=>{
 const v=fixture(),before=JSON.stringify(v);
 searchVaultContext(v,"Mira");
 assert.equal(JSON.stringify(v),before);
});
test("valid unicode text retrieval without the vector database",()=>{
 const v=emptyVault();
 reconcile(v,{title:"京都 Kyoto",kind:"place",aliases:["Kyoto"]});
 assert.equal(searchVaultContext(v,"京都").items[0].title,"京都 Kyoto");
});
