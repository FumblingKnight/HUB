const $=id=>document.getElementById(id);
const root=$("memoryResults"),status=$("memoryStatus"),form=$("recall"),query=$("memoryQuery");
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
const link=(text,url)=>{
 try{const u=new URL(url);if(u.protocol!=="https:"||u.username||u.password)return el("span","",text);
 const a=el("a","",text+" ↗");a.href=u.href;a.target="_blank";a.rel="noopener noreferrer";return a;}
 catch{return el("span","",text);}
};
function display(data){
 root.replaceChildren();
 if(!Array.isArray(data.items)||!data.items.length){root.append(el("p","empty","No relevant ATLAS entries found. Your saved graph may not contain this subject yet."));return;}
 for(const item of data.items){
  const card=el("article","memory-card"),heading=el("div","memory-heading"),title=el("h2","",item.title);
  heading.append(title,el("span","kind",item.kind||"knowledge"));
  card.append(heading);
  if(item.summary)card.append(el("p","memory-summary",item.summary));
  const matched=el("p","matched","Matched: "+(item.matched||[]).join(", "));
  card.append(matched);
  if(Array.isArray(item.claims)&&item.claims.length){
   const group=el("div","memory-claims");
   group.append(el("h3","","Recorded claims"));
   for(const claim of item.claims){
    const claimEl=el("div","claim "+(claim.status==="disputed"?"disputed":""));
    const line=el("p","",claim.predicate+": "+claim.value);
    claimEl.append(line,el("small","",claim.status==="disputed"?"Disputed — not resolved":"Status: "+(claim.status||"unknown")));
    if(claim.source?.label)claimEl.append(el("span","source-link"," · "),link(claim.source.label,claim.source.url));
    group.append(claimEl);
   }
   card.append(group);
  }
  if(item.related?.length){const relation=el("div","memory-relations");relation.append(el("strong","","Related: "));relation.append(el("span","",item.related.map(r=>r.title+" ("+r.type+")").join(" · ")));card.append(relation);}
  card.append(el("small","memory-date","Updated "+(item.updatedAt||"unknown")));
  root.append(card);
 }
}
async function recall(){
 const q=query.value.trim();if(q.length<2||q.length>220)return;
 status.textContent="Searching private ATLAS…";root.replaceChildren();
 try{
  const res=await fetch("/api/mira/context?"+new URLSearchParams({q,limit:"6"}),{credentials:"same-origin",cache:"no-store"});
  if(res.status===401){window.location.assign("/login");return;}
  const data=await res.json();
  if(!res.ok)throw Error(data.error||"Retrieval request failed");
  display(data);
  status.textContent=data.matched+" relevant ATLAS "+(data.matched===1?"entry":"entries")+" retrieved · Graph updated "+(data.graph_updated_at||"unknown");
 }catch(e){status.textContent=e.message||"Memory retrieval unavailable";}
}
form.addEventListener("submit",e=>{e.preventDefault();recall();});
const incoming=new URLSearchParams(location.search).get("q");
if(incoming&&incoming.trim().length>=2&&incoming.length<=220)query.value=incoming.trim();
recall();
