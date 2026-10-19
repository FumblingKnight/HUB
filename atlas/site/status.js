const $=id=>document.getElementById(id);
function elem(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;}
function addCard(root,title,description,type="standard"){
 const box=elem("article","status-card "+type),heading=elem("h3","",title);
 box.append(heading);
 if(description)box.append(elem("p","",description));
 root.append(box);
}
function label(s){return String(s||"unknown").replaceAll("_"," ").replace(/\b[a-z]/g,x=>x.toUpperCase());}
async function load(){
 try{
  const res=await fetch("/api/mira/status",{credentials:"same-origin",cache:"no-store"});
  if(res.status===401){location.assign("/login");return;}
  const data=await res.json();if(!res.ok)throw Error(data.error||"Private project status unavailable");
  if(!Array.isArray(data.milestones)||!Array.isArray(data.deferred_actions))throw Error("Invalid project status data");
  $("projectStatus").textContent=label(data.checkpoint_status).slice(0,70);
  $("projectStatus").title=data.checkpoint_status;
  $("lastUpdate").textContent=data.updated_ist||"Not recorded";
  $("pendingCount").textContent=String(data.deferred_actions.length);
  $("statusMessage").textContent="Retrieved latest private checkpoint · "+(data.blocked_on_user?"A user decision is currently blocking work":"Independent engineering can continue");
  const milestones=$("milestones"),pending=$("pending"),evidence=$("evidence");
  milestones.replaceChildren();pending.replaceChildren();evidence.replaceChildren();
  for(const m of data.milestones)addCard(milestones,m.title,label(m.status),m.status==="completed"?"done":"");
  if(!data.deferred_actions.length)addCard(pending,"Nothing pending","No deferred user actions are recorded.");
  for(const a of data.deferred_actions)addCard(pending,a.id+" · "+a.task,a.required_now?"Needed before the next blocked operation":"Deferred — no action needed right now","pending");
  if(!data.verified?.length)addCard(evidence,"No verification records","Evidence has not yet been saved.");
  for(const x of data.verified||[])addCard(evidence,x.claim,x.evidence,"evidence");
 }catch(e){$("statusMessage").textContent=e.message||"Unable to load project state";}
}
load();
