/**
 * Deterministic, read-only ATLAS context retrieval.
 * This file contains no personal data and does not contact any LLM or vector provider.
 * Call only with the private vault after session authentication in cloud worker.
 */
import {validateVault} from "./core.mjs";
const STOP=new Set("a an the and or of in on for to with at is it my me i what how why where when does did do we our about tell show find which can could that this have has had please help from than as".split(" "));
const normalize=x=>String(x??"").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ");
const split=x=>[...new Set(normalize(x).split(" ").filter(w=>w.length>=2&&!STOP.has(w)))];
const str=(x,max=1200)=>String(x??"").slice(0,max);
function overlaps(query,value){const set=new Set(split(value));return query.filter(w=>set.has(w)).length;}
export function searchVaultContext(v,query,{limit=5}={}){
 validateVault(v);
 if(typeof query!=="string"||query.trim().length<2||query.length>220)throw Error("Query must be 2–220 characters");
 const terms=split(query);if(!terms.length)throw Error("No searchable query terms");
 if(!Number.isInteger(limit)||limit<1||limit>10)throw Error("Limit must be between 1 and 10");
 const q=normalize(query),sources=new Map(v.sources.map(s=>[s.id,s])),byId=new Map(v.entities.map(e=>[e.id,e]));
 const scored=[];
 for(const e of v.entities){
  const title=normalize(e.title),aliases=(e.aliases||[]).map(normalize);
  let score=0,matched=new Set();
  if(title===q||e.id===query)score+=110;
  else if(aliases.includes(q))score+=105;
  else if(q.length>=4&&(title.includes(q)||aliases.some(a=>a.includes(q))))score+=75;
  const titleMatches=overlaps(terms,e.title);
  score+=titleMatches*24; if(titleMatches)matched.add("title");
  const aliasMatches=Math.max(0,...(e.aliases||[]).map(a=>overlaps(terms,a)));
  score+=aliasMatches*24;if(aliasMatches)matched.add("alias");
  const tagMatches=overlaps(terms,(e.tags||[]).join(" "));
  score+=tagMatches*13;if(tagMatches)matched.add("tags");
  const summaryMatches=overlaps(terms,e.summary);
  score+=summaryMatches*5;if(summaryMatches)matched.add("summary");
  let claimMatches=0;
  for(const c of e.claims||[]){claimMatches=Math.max(claimMatches,overlaps(terms,[c.predicate,c.value].join(" ")));}
  score+=claimMatches*6;if(claimMatches)matched.add("claims");
  if(score<=0)continue;
  // Avoid returning loosely related documents solely on boilerplate summary matches.
  if(!titleMatches&&!aliasMatches&&!tagMatches&&summaryMatches+claimMatches<2&&score<60)continue;
  score+=Math.min(3,Math.max(0,Number(e.priority)||0));
  scored.push({e,score,matched:[...matched]});
 }
 scored.sort((a,b)=>b.score-a.score||String(b.e.updatedAt||"").localeCompare(String(a.e.updatedAt||""))||a.e.title.localeCompare(b.e.title));
 const matches=scored.slice(0,limit).map(({e,score,matched})=>{
  const claims=(e.claims||[]).slice(-12).map(c=>{
   const source=sources.get(c.sourceId);
   return {predicate:str(c.predicate,160),value:str(c.value,1000),status:str(c.status||"unknown",24),confidence:typeof c.confidence==="number"?c.confidence:null,assertedAt:c.assertedAt||null,source:source?{label:str(source.label,200),url:source.url||null}:null};
  });
  const related=v.relations.filter(r=>r.from===e.id||r.to===e.id).slice(0,15).map(r=>{
   const other=byId.get(r.from===e.id?r.to:r.from);
   return other?{title:str(other.title,180),type:str(r.type,60),direction:r.from===e.id?"out":"in"}:null;
  }).filter(Boolean);
  return {id:e.id,title:str(e.title,180),kind:str(e.kind,80),score,matched,summary:str(e.summary,1200),tags:(e.tags||[]).slice(0,15).map(x=>str(x,60)),updatedAt:e.updatedAt||null,claims,related};
 });
 return {schema_version:1,query:q,matched:matches.length,graph_updated_at:v.updatedAt||null,items:matches,warning:"ATLAS is a curated external knowledge graph, not automatic ChatGPT memory; disputed claims remain disputed. Results require source verification."};
}
