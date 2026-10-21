// Code-first discovery UI. Search for updates writes a private GitHub request.
// Publication and GPT curation are separate and never represented as completed.
const el=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
let polling=null,iterations=0;
const pretty=stamp=>{const n=Date.parse(stamp||"");return Number.isFinite(n)?new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit",timeZone:"Asia/Kolkata"}).format(n):"Not recorded";};
function render(result){
 const scan=result.scan||{},refresh=result.refresh||{},leads=Array.isArray(result.leads)?result.leads:[];
 el("radar-health").textContent=scan.status==="healthy"?"Sources healthy":scan.status==="degraded"?"Some sources unavailable":scan.status==="not_verified"?"No run verified":String(scan.status);
 const coverage=scan.sources_ok===null?"No coverage report":scan.sources_ok+" / "+scan.sources_total+" sources reached";
 const scanTime=scan.last_run_at?pretty(scan.last_run_at):"not yet";
 el("radar-status").textContent=(refresh.pending?"Search requested · awaiting cloud runner. ":"")+
  "Last code search: "+scanTime+" · "+coverage+
  ". "+(leads.length?"Showing recent unreviewed links.":"No unreviewed links available yet.");
 const container=el("radar-leads");container.replaceChildren();
 for(const lead of leads.slice(0,12)){
  const card=make("article","radar-lead");
  const top=make("div","radar-lead-top");
  top.append(make("span","",String(lead.category||"News").replace(/^./,x=>x.toUpperCase())));
  top.append(make("span","",String(lead.source_name||"Public source")));
  card.append(top);
  card.append(make("h3","",lead.title));
  if(lead.summary)card.append(make("p","",lead.summary));
  const link=make("a","radar-lead-link","Open source ↗");
  try{const u=new URL(lead.source_url);if(u.protocol!=="https:")continue;link.href=u.href;}
  catch{continue;}
  link.target="_blank";link.rel="noopener noreferrer";
  card.append(link);container.append(card);
 }
 if(!leads.length)container.append(make("div","signals-empty",refresh.pending?"The cloud search has been requested. This panel will refresh when it finishes.":"No public-source candidates available from the last recorded scan."));
}
async function update(){
 try{
  const response=await fetch("/api/mira/discover",{credentials:"same-origin",cache:"no-store"});
  if(response.status===401){location.assign("/login");return;}
  if(!response.ok)throw Error("Radar status is unavailable (HTTP "+response.status+")");
  const data=await response.json();render(data);
  if(!data.refresh?.pending&&polling){clearInterval(polling);polling=null;el("refresh").disabled=false;el("refresh").textContent="↻ Search for updates";}
 }catch(e){el("radar-status").textContent=e.message||"Cannot load radar status";}
}
function startPolling(){
 if(polling)clearInterval(polling);iterations=0;
 polling=setInterval(async()=>{
  if(++iterations>15){clearInterval(polling);polling=null;el("refresh").disabled=false;el("refresh").textContent="↻ Search for updates";el("radar-status").textContent="Search is taking longer than expected. You can reopen this page to see the eventual result.";return;}
  await update();
 },8000);
}
async function requestSearch(){
 const b=el("refresh");if(b.disabled)return;
 b.disabled=true;b.textContent="Queuing search…";
 el("radar-status").textContent="Requesting a fresh public-source scan from the private cloud runner…";
 try{
  const response=await fetch("/api/mira/discover",{method:"POST",credentials:"same-origin",
   headers:{"content-type":"application/json"},body:"{}"});
  if(response.status===401){location.assign("/login");return;}
  const r=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(r.error||"Unable to queue code scan ("+response.status+")");
  el("radar-status").textContent=r.reused?"A recent code scan is already queued. Checking for results…":"New scan queued in GitHub. Waiting for cloud sources…";
  b.textContent="Scanning…";
  await update();startPolling();
 }catch(e){el("radar-status").textContent=e.message||"Scan request failed";b.disabled=false;b.textContent="↻ Search for updates";}
}
el("refresh").addEventListener("click",requestSearch);
update();
