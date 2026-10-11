import test from "node:test";
import assert from "node:assert/strict";
import {emptyVault,reconcile,lookup,candidates,connections,neighborhood,rankConnections,validateVault} from "./core.mjs";
test("exact match and alias merges into existing page",()=>{
 const v=emptyVault();
 let a=reconcile(v,{title:"Computational Fluid Dynamics",kind:"concept",aliases:["CFD"],source:"user"});
 assert.equal(a.action,"created");
 assert.equal(reconcile(v,{title:"CFD",claims:[{predicate:"used for",value:"aerodynamics"}]}).action,"updated");
 assert.equal(v.entities.length,1);
 assert.equal(lookup(v,"CFD").claims.length,1);
});
test("uncertain similar title queues review instead of duplicating",()=>{
 const v=emptyVault();
 reconcile(v,{title:"Formula One",kind:"sport"});
 const a=reconcile(v,{title:"Formula 1",kind:"sport"});
 assert.equal(a.action,"review");
 assert.equal(v.entities.length,1);
 assert.equal(v.reviews[0].kind,"entity-match");
});
test("typed links and backlinks are symmetric for navigation",()=>{
 const v=emptyVault();
 const p=reconcile(v,{title:"Aerodynamics"});
 const q=reconcile(v,{title:"CFD",links:[{target:"Aerodynamics",type:"applies-to",priority:3}]});
 assert.equal(q.action,"created");
 assert.equal(connections(v,p.entityId)[0].displayType,"has-application");
 assert.equal(rankConnections(v,q.entityId)[0].title,"Aerodynamics");
 assert.equal(neighborhood(v,q.entityId,1).entities.length,2);
 validateVault(v);
});
test("single-valued conflicting claims kept and disputed",()=>{
 const v=emptyVault();
 reconcile(v,{title:"Project X",claims:[{predicate:"status",value:"planning",cardinality:"one"}]});
 const a=reconcile(v,{title:"Project X",claims:[{predicate:"status",value:"launched",cardinality:"one"}]});
 assert.equal(a.conflicts.length,1);
 assert.equal(lookup(v,"Project X").claims.length,2);
 assert.ok(lookup(v,"Project X").claims.every(x=>x.status==="disputed"));
});
test("unknown links are queued, not fabricated",()=>{
 const v=emptyVault();const a=reconcile(v,{title:"Alpha",links:[{target:"Unknown",type:"depends-on"}]});
 assert.equal(a.unresolved.length,1);
 assert.equal(v.relations.length,0);
 assert.equal(v.reviews[0].kind,"unresolved-link");
});
test("source provenance and priority persisted",()=>{
 const v=emptyVault();reconcile(v,{title:"Important",priority:3,
   source:{label:"Original research notebook",url:"https://example.com/source"}});
 assert.equal(v.entities[0].priority,3);
 assert.equal(v.sources.length,1);
 assert.equal(v.events.length,1);
});
