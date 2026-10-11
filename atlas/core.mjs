/**
 * ATLAS graph domain logic. Canonical data lives in a separate PRIVATE GitHub repository.
 * No calls to AI providers, no hidden embedding lookups, and no secrets in this module.
 */
export const RELATIONS = Object.freeze([
  "related-to","part-of","depends-on","prerequisite-for","explains","contradicts",
  "causes","influences","example-of","applies-to","used-in","created-by",
  "inspired-by","similar-to","alternative-to","supersedes","associated-with"
]);
export const INVERSES = Object.freeze({
  "part-of":"contains","depends-on":"required-by","prerequisite-for":"depends-on",
  "explains":"explained-by","causes":"caused-by","influences":"influenced-by",
  "example-of":"has-example","applies-to":"has-application",
  "used-in":"uses","created-by":"created","inspired-by":"inspired",
  "supersedes":"superseded-by"
});
const STOP = new Set(["a","an","the","and","or","of","in","on","for","with","to","at","is","it","my"]);
export const key = value => String(value || "").normalize("NFKC").toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
export const tokens = value => key(value).split(" ").filter(x=>x && !STOP.has(x));
const unique = xs => [...new Set(xs.filter(Boolean))];
const iso = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
export function emptyVault(){
  return {schema:1,name:"ATLAS",createdAt:iso(),updatedAt:iso(),
    entities:[],relations:[],sources:[],inbox:[],reviews:[],events:[]};
}
export function validateVault(v){
  if (!v || v.schema !== 1 || !Array.isArray(v.entities) || !Array.isArray(v.relations)
    || !Array.isArray(v.sources) || !Array.isArray(v.inbox) || !Array.isArray(v.reviews)
    || !Array.isArray(v.events)) throw Error("Invalid or unsupported ATLAS vault");
  const ids=new Set(v.entities.map(e=>e.id));
  if(ids.size!==v.entities.length) throw Error("Duplicate entity IDs");
  for(const r of v.relations) if(!ids.has(r.from)||!ids.has(r.to)) throw Error("Dangling relation");
  return v;
}
export function candidates(v,name,kind=null,limit=8){
  validateVault(v);
  const q=key(name),qTokens=new Set(tokens(name));
  if(!q) return [];
  return v.entities.map(e=>{
    const names=[e.title,...(e.aliases||[])];
    let score=0;
    for(const n of names){
      const normalized=key(n);
      if(normalized===q){score=100;break;}
      const other=new Set(tokens(n));
      const inter=[...qTokens].filter(t=>other.has(t)).length;
      const union=new Set([...qTokens,...other]).size;
      score=Math.max(score,(union ? inter/union : 0)*65);
      if(q.length>3 && normalized.includes(q)) score=Math.max(score,45);
    }
    if(kind && e.kind===kind) score+=3;
    return {id:e.id,title:e.title,kind:e.kind,score:Math.min(100,Math.round(score))};
  }).filter(x=>x.score>=25).sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)).slice(0,limit);
}
export function lookup(v,query){
  const q=key(query);
  return v.entities.find(e=>e.id===query || [e.title,...(e.aliases||[])].some(n=>key(n)===q))||null;
}
export function neighborhood(v,id,hops=2){
  validateVault(v);
  const seen=new Set([id]),frontier=new Set([id]);
  for(let depth=0;depth<Math.min(4,Math.max(0,hops));depth++){
    const next=new Set();
    for(const r of v.relations) if(frontier.has(r.from) && !seen.has(r.to))next.add(r.to);
    else if(frontier.has(r.to) && !seen.has(r.from))next.add(r.from);
    next.forEach(x=>seen.add(x));
    frontier.clear();next.forEach(x=>frontier.add(x));
  }
  return {entities:v.entities.filter(e=>seen.has(e.id)),
    relations:v.relations.filter(r=>seen.has(r.from)&&seen.has(r.to))};
}
export function connections(v,id){
  validateVault(v);
  return v.relations.filter(r=>r.from===id||r.to===id)
    .map(r=>({...r,direction:r.from===id?"out":"in",
      other:r.from===id?r.to:r.from,
      displayType:r.from===id?r.type:(INVERSES[r.type]||r.type)}))
    .sort((a,b)=>(b.priority||0)-(a.priority||0));
}
const clamp=(n,def=2)=>Number.isInteger(n)?Math.max(0,Math.min(3,n)):def;
const same=(a,b)=>key(a)===key(b);
const findSource=(v,source)=> {
  if(!source)return null;
  const label=typeof source==="string"?source:source.label;
  if(!label)return null;
  let s=v.sources.find(x=>same(x.label,label));
  if(!s){s={id:uid(),label:String(label).slice(0,300),url:typeof source==="object"?source.url||null:null,createdAt:iso()};v.sources.push(s);}
  return s.id;
};
/**
 * Apply a librarian-produced structured extraction. User chat -> LLM extraction ->
 * this deterministic reconciler -> private vault Git commit.
 *
 * IMPORTANT: fuzzy candidates get a review record, NOT an unsafe automatic merge.
 * Draft example: {title,kind,summary,aliases,tags,priority,claims:[{predicate,value,
 * cardinality:"one"}],links:[{target,type,priority}],source}
 */
export function reconcile(v,draft,{allowCreate=true,confirmEntityId=null}={}){
  validateVault(v);
  if(!draft || typeof draft.title!=="string" || !key(draft.title))throw Error("Title required");
  if(draft.title.length>180)throw Error("Title too long");
  const nearby=candidates(v,draft.title,draft.kind);
  const direct=confirmEntityId?v.entities.find(e=>e.id===confirmEntityId):lookup(v,draft.title);
  if(confirmEntityId&&!direct)throw Error("Requested entity ID does not exist");
  // A plausible but uncertain match should be reviewed, never silently merged.
  if(!direct&&nearby.length&&nearby[0].score>=40){
    const review={id:uid(),kind:"entity-match",draft,options:nearby,createdAt:iso(),status:"pending"};
    v.reviews.push(review);v.updatedAt=iso();
    return {action:"review",reviewId:review.id,candidates:nearby};
  }
  if(!direct&&!allowCreate)return {action:"not-found",candidates:nearby};
  const existing=Boolean(direct);
  const e=direct||{id:uid(),title:draft.title.trim(),kind:draft.kind||"concept",summary:"",
    aliases:[],tags:[],priority:2,claims:[],createdAt:iso(),updatedAt:iso()};
  if(!existing)v.entities.push(e);
  e.aliases=unique([...(e.aliases||[]),...(Array.isArray(draft.aliases)?draft.aliases:[]).map(String)]).filter(x=>!same(x,e.title));
  e.tags=unique([...(e.tags||[]),...(Array.isArray(draft.tags)?draft.tags:[]).map(String)]);
  if(Number.isInteger(draft.priority))e.priority=clamp(draft.priority);
  // Preserve older summaries unless the librarian explicitly provides a replacement.
  if(typeof draft.summary==="string"&&draft.summary.trim())e.summary=draft.summary.trim();
  const sourceId=findSource(v,draft.source);
  const conflicts=[];
  for(const c of Array.isArray(draft.claims)?draft.claims:[]){
    if(!c||typeof c.predicate!=="string"||typeof c.value!=="string"||!c.value.trim())continue;
    const pred=key(c.predicate),val=c.value.trim();
    const duplicate=e.claims.some(x=>key(x.predicate)===pred&&same(x.value,val));
    if(duplicate)continue;
    const alternatives=e.claims.filter(x=>key(x.predicate)===pred&&!same(x.value,val) &&
      (x.cardinality==="one"||c.cardinality==="one"));
    const claim={id:uid(),predicate:c.predicate.trim(),value:val,
      cardinality:c.cardinality==="one"?"one":"many",sourceId,
      confidence:typeof c.confidence==="number"?Math.max(0,Math.min(1,c.confidence)):1,
      assertedAt:iso(),status:alternatives.length?"disputed":"asserted"};
    if(alternatives.length){alternatives.forEach(x=>x.status="disputed");conflicts.push({predicate:pred,claimIds:[...alternatives.map(x=>x.id),claim.id]});}
    e.claims.push(claim);
  }
  const unresolved=[];
  for(const link of Array.isArray(draft.links)?draft.links:[]){
    if(!link||typeof link.type!=="string"||!RELATIONS.includes(link.type))continue;
    const to=lookup(v,link.target);
    if(!to){unresolved.push({from:e.id,target:link.target,type:link.type,
      priority:clamp(link.priority),sourceId});continue;}
    if(to.id===e.id)continue;
    const has=v.relations.some(r=>r.from===e.id&&r.to===to.id&&r.type===link.type);
    if(!has)v.relations.push({id:uid(),from:e.id,to:to.id,type:link.type,
      priority:clamp(link.priority),confidence:typeof link.confidence==="number"?link.confidence:1,
      evidence:link.evidence||null,sourceId,status:link.inferred?"inferred":"asserted",createdAt:iso()});
  }
  for(const p of unresolved)v.reviews.push({...p,id:uid(),kind:"unresolved-link",createdAt:iso(),status:"pending"});
  if(conflicts.length)v.reviews.push({id:uid(),kind:"contradiction",entityId:e.id,
    conflicts,createdAt:iso(),status:"pending"});
  e.updatedAt=iso();v.updatedAt=iso();
  v.events.push({id:uid(),entityId:e.id,type:existing?"updated":"created",
    sourceId,at:iso(),summary:"Reconciled "+e.title});
  return {action:existing?"updated":"created",entityId:e.id,conflicts,
    unresolved,relatedCandidates:nearby.filter(x=>x.id!==e.id)};
}
export function rankConnections(v,id){
  return connections(v,id).map(r=>{
    const other=v.entities.find(e=>e.id===r.other);
    return {...r,title:other?.title||r.other,
      importance:Math.round(100*((r.priority||0)/3*.5+(other?.priority||0)/3*.3+(r.confidence??1)*.2))};
  }).sort((a,b)=>b.importance-a.importance);
}
