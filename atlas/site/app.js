const $=id=>document.getElementById(id);
const SVG="http://www.w3.org/2000/svg";
const state={graph:null,view:"library",selected:null,query:""};
const add=(parent,tag,cls,text)=>{
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(text!==undefined)e.textContent=String(text);
 parent.append(e);return e;
};
const svg=(parent,tag,attrs,text)=>{
 const e=document.createElementNS(SVG,tag);
 for(const [key,value] of Object.entries(attrs||{}))e.setAttribute(key,String(value));
 if(text!==undefined)e.textContent=String(text);
 parent.append(e);return e;
};
const norm=x=>String(x||"").normalize("NFKC").toLowerCase();
const date=x=>{try{return new Date(x).toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"});}catch{return "unknown";}};
function alertMessage(message,failed=false){
 $("notice").textContent=message;
 $("notice").classList.toggle("error",failed);
 $("notice").classList.remove("hidden");
}
function hideNotice(){$("notice").classList.add("hidden");}
function entity(id){return state.graph?.entities.find(e=>e.id===id);}
function edges(id){return state.graph?.relations.filter(r=>r.from===id||r.to===id)||[];}
function other(r,id){return r.from===id?r.to:r.from;}
function setView(view){
 state.view=view;
 for(const name of ["library","graph","inbox"]){
  $("view-"+name).classList.toggle("hidden",name!==view);
  document.querySelector('[data-view="'+name+'"]').classList.toggle("active",name===view);
 }
 if(view==="graph")renderGraph();
 if(view==="inbox")renderInbox();
}
function setStats(){
 const g=state.graph;
 $("entityCount").textContent=g.entities.length.toLocaleString();
 $("linkCount").textContent=g.relations.length.toLocaleString();
 $("sourceCount").textContent=g.sources.length.toLocaleString();
 $("reviewCount").textContent=g.reviews.filter(r=>r.status==="pending").length.toLocaleString();
 $("inboxBadge").textContent=g.inbox.filter(r=>r.status==="unprocessed").length;
}
function matches(e,q){
 const hay=norm([e.title,...(e.aliases||[]),e.kind,e.summary,...(e.tags||[])].join(" "));
 return !q||hay.includes(norm(q));
}
function renderList(){
 const root=$("items");root.replaceChildren();
 if(!state.graph)return;
 const list=state.graph.entities.filter(e=>matches(e,state.query))
  .sort((a,b)=>(b.priority||0)-(a.priority||0)||a.title.localeCompare(b.title));
 $("listCounter").textContent=list.length+" PAGES";
 if(!list.length){add(root,"div","miniempty",state.query?"No matching pages.":"Your vault has no pages yet.");return;}
 for(const e of list.slice(0,400)){
  const btn=add(root,"button","item"+(state.selected===e.id?" active":""));
  btn.type="button";
  add(btn,"span","type",e.kind||"concept");
  add(btn,"span","name",e.title);
  add(btn,"span","desc",(e.summary||"No description yet").slice(0,104));
  btn.onclick=()=>select(e.id);
 }
 if(list.length>400)add(root,"div","miniempty","Showing the first 400. Search to narrow the list.");
}
function section(parent,title){return add(parent,"div","sectionlabel",title);}
function renderDetails(){
 const root=$("detail");root.replaceChildren();
 const e=entity(state.selected);
 if(!e){add(root,"div","empty","Select a page to see its facts, sources and connected topics.");return;}
 const meta=add(root,"div","detailmeta");
 add(meta,"span","",e.kind||"concept");
 add(meta,"span","","PRIORITY "+(e.priority??2)+"/3");
 add(meta,"span","","UPDATED "+date(e.updatedAt));
 add(root,"h2","detailtitle",e.title);
 add(root,"p","summary",e.summary||"No summary has been written yet.");
 if(e.aliases?.length){section(root,"OTHER NAMES");for(const name of e.aliases)add(root,"span","alias",name);}
 if(e.tags?.length){section(root,"TAGS");for(const name of e.tags)add(root,"span","tag",name);}
 section(root,"DIRECT CONNECTIONS • "+edges(e.id).length);
 const links=edges(e.id).sort((a,b)=>(b.priority||0)-(a.priority||0));
 if(!links.length)add(root,"p","miniempty","No verified relationships yet.");
 for(const r of links){
  const page=entity(other(r,e.id));
  if(!page)continue;
  const row=add(root,"div","linkrow"),label=add(row,"div","");
  add(label,"span","relationtype",r.from===e.id?r.type:"← "+r.type);
  const link=add(label,"button","",page.title);link.onclick=()=>select(page.id);
  if(r.evidence)add(label,"small","",r.evidence);
  add(row,"span","prio","P"+(r.priority??2));
 }
 const paths=[];
 for(const r of edges(e.id)){
  const pivot=other(r,e.id);
  for(const second of edges(pivot)){
   const target=other(second,pivot);
   if(target!==e.id&&!links.some(link=>other(link,e.id)===target)&&
      !paths.some(p=>p.target===target)){
    paths.push({target,pivot});
   }
  }
 }
 if(paths.length){
  section(root,"TWO-HOP CONNECTIONS");
  for(const p of paths.slice(0,8)){
   const row=add(root,"div","linkrow"),link=add(row,"button","",entity(p.target)?.title||"Unknown");
   link.onclick=()=>select(p.target);
   add(row,"small","", "via "+(entity(p.pivot)?.title||"another topic"));
  }
 }
 section(root,"KNOWLEDGE CLAIMS • "+(e.claims?.length||0));
 if(!e.claims?.length)add(root,"p","miniempty","Claims will appear here as the librarian structures new information.");
 for(const c of e.claims||[]){
  const row=add(root,"div","claimrow");
  add(row,"span","relationtype",c.predicate+": ");
  add(row,"strong",c.status==="disputed"?"disputed":"",c.value);
  const source=state.graph.sources.find(s=>s.id===c.sourceId);
  const info=(source?"Source: "+source.label:"No source recorded")+" · "+date(c.assertedAt);
  add(row,"small","",info);
 }
 const evt=state.graph.events.filter(v=>v.entityId===e.id).slice(-4).reverse();
 if(evt.length){section(root,"PAGE HISTORY");for(const change of evt)
  add(root,"div","claimrow",date(change.at)+" — "+change.summary);}
}
function select(id,view=null){
 state.selected=id;
 if(view)setView(view);
 renderList();renderDetails();
 if(state.view==="graph")renderGraph();
}
function renderInbox(){
 const root=$("queueList");root.replaceChildren();
 if(!state.graph)return;
 const list=state.graph.inbox.filter(x=>x.status==="unprocessed").slice().reverse();
 if(!list.length){add(root,"div","miniempty","Nothing waiting. Capture an idea to begin.");return;}
 for(const item of list.slice(0,70)){
  const row=add(root,"div","queueitem");
  add(row,"small","",date(item.createdAt)+" • NEEDS LIBRARIAN REVIEW");
  add(row,"span","",item.text.slice(0,900));
 }
}
function renderGraph(){
 const root=$("graphCanvas");root.replaceChildren();
 const detail=$("graphDetail");detail.replaceChildren();
 if(!state.graph||!state.graph.entities.length){
  svg(root,"text",{x:460,y:270,"text-anchor":"middle",fill:"#94a8ad","font-size":15},
   "Pages will appear here once the librarian has added knowledge.");return;
 }
 const g=state.graph;const chosen=entity(state.selected)||g.entities[0];
 const nearby=new Set([chosen.id]);
 for(const r of edges(chosen.id))nearby.add(other(r,chosen.id));
 if(nearby.size<25)for(const id of [...nearby]){
  for(const r of edges(id))if(nearby.size<42)nearby.add(other(r,id));
 }
 const nodes=g.entities.filter(e=>nearby.has(e.id)).slice(0,45);
 const ids=new Set(nodes.map(e=>e.id));
 const center={x:460,y:270};
 const coords=new Map();
 const outer=nodes.filter(e=>e.id!==chosen.id);
 coords.set(chosen.id,center);
 outer.forEach((e,i)=>{
  const ring=i<12?1:i<28?2:3;
  const local=i<12?i:i<28?i-12:i-28;
  const cap=ring===1?12:ring===2?16:16;
  const angle=2*Math.PI*local/cap-Math.PI/2+(ring===2?.12:0);
  const radius=ring*105;
  coords.set(e.id,{x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius});
 });
 const back=svg(root,"g",{});
 const front=svg(root,"g",{});
 for(const r of g.relations.filter(r=>ids.has(r.from)&&ids.has(r.to))){
  const a=coords.get(r.from),b=coords.get(r.to);if(!a||!b)continue;
  svg(back,"line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:r.priority===3?"#8ed2b5":"#456864",
   "stroke-width":r.priority===3?1.9:1.1,opacity:r.priority===3?.67:.35});
 }
 for(const e of nodes){
  const p=coords.get(e.id),active=e.id===chosen.id;
  const group=svg(front,"g",{tabindex:0,role:"button","aria-label":"Open "+e.title,
    style:"cursor:pointer"});
  const c=svg(group,"circle",{cx:p.x,cy:p.y,r:active?18:Math.max(7,8+(e.priority||0)*1.5),
    fill:active?"#b7e3cf":"#314c47",stroke:active?"#e8fff4":"#79ab98",
    "stroke-width":active?2:1.3});
  svg(group,"text",{x:p.x,y:p.y+(active?-30:24),"text-anchor":"middle",
    "font-size":active?15:11,"font-weight":active?700:500,fill:active?"#f2fff6":"#acbeb7"},e.title.length>24?e.title.slice(0,22)+"…":e.title);
  group.addEventListener("click",()=>select(e.id));
  group.addEventListener("keydown",evt=>{if(evt.key==="Enter"||evt.key===" "){evt.preventDefault();select(e.id);}});
 }
 add(detail,"span","relationtype","FOCUS / "+chosen.kind.toUpperCase());
 add(detail,"strong","",chosen.title+"  ");
 add(detail,"span","","• "+edges(chosen.id).length+" direct connections");
 const button=add(detail,"button","","Open full page ↗");button.onclick=()=>select(chosen.id,"library");
}
async function refresh(){
 const response=await fetch("/api/graph",{credentials:"same-origin",cache:"no-store"});
 if(!response.ok){const data=await response.json().catch(()=>({}));
  throw Error(data.error||"Vault unavailable ("+response.status+")");}
 const data=await response.json();
 if(data.schema!==1||!Array.isArray(data.entities)||!Array.isArray(data.relations))
  throw Error("Unsupported vault format");
 state.graph=data;
 if(state.selected&&!entity(state.selected))state.selected=null;
 if(!state.selected)state.selected=data.entities[0]?.id||null;
 setStats();renderList();renderDetails();renderInbox();renderGraph();
 $("connection").textContent="Private vault connected";
 hideNotice();
}
for(const button of document.querySelectorAll("[data-view]"))
 button.onclick=()=>setView(button.dataset.view);
$("query").addEventListener("input",event=>{state.query=event.target.value;renderList();});
document.addEventListener("keydown",event=>{
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){
  event.preventDefault();setView("library");$("query").focus();
 }
});
$("saveNote").onclick=async()=>{
 const text=$("captureText").value.trim();
 if(!text)return alertMessage("Write something to capture first.",true);
 const button=$("saveNote");button.disabled=true;button.textContent="Saving…";
 try{
  const resp=await fetch("/api/inbox",{method:"POST",credentials:"same-origin",
   headers:{"content-type":"application/json"},body:JSON.stringify({text})});
  const result=await resp.json();
  if(!resp.ok)throw Error(result.error||"Unable to save");
  $("captureText").value="";
  await refresh();alertMessage("Saved to the private inbox. AI reconciliation is not automatic from the website yet.");
 }catch(e){alertMessage(e.message,true);}
 finally{button.disabled=false;button.textContent="Save to inbox ↗";}
};
refresh().catch(e=>{$("connection").textContent="Vault unavailable";alertMessage(e.message,true);});
