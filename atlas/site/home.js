import {groupStories,detailHref,safeImage} from "./story-model.mjs";
// Read-only Mira Home. No assumed fresh news, no raw personal records, no hidden background actions.
const byId=id=>document.getElementById(id);
const node=(name,cls,content)=>{const n=document.createElement(name);if(cls)n.className=cls;if(content!==undefined)n.textContent=String(content);return n;};
const ist=new Intl.DateTimeFormat("en-IN",{weekday:"long",day:"numeric",month:"long",timeZone:"Asia/Kolkata"});
byId("today").textContent=ist.format(new Date());
function verifiedUrl(raw){
 try{const u=new URL(raw);if(u.protocol!=="https:"||u.username||u.password)return null;return u.href;}catch{return null;}
}
function isExpired(item){
 const cutoff=Date.parse(item.expires_at||"");
 return item.status==="archived"||(Number.isFinite(cutoff)&&Date.now()>=cutoff);
}
function freshItems(data){
 return (Array.isArray(data.items)?data.items:[])
  .filter(x=>!isExpired(x)&&verifiedUrl(x.source_url))
  .sort((a,b)=>(Number(b.urgency)||0)-(Number(a.urgency)||0)||
    (Number(b.relevance)||0)-(Number(a.relevance)||0)||
    String(b.discovered_ist||"").localeCompare(String(a.discovered_ist||"")));
}
function story(item,i){
 const card=node("article","home-story"),meta=node("div","home-story-meta");
 const category=String(item.category||"Discovery").replace(/_/g," ");
 const time=item.source_date||item.discovered_ist||"";
 meta.append(node("span","",category.charAt(0).toUpperCase()+category.slice(1)));
 if(item.urgency>=2)meta.append(node("span","","Time-sensitive"));
 if(time)meta.append(node("span","home-story-date",time));
 if(item.image_url&&safeImage(item.image_url)){
  const media=node("a","home-story-media");media.href=detailHref(item.story_id);
  const img=node("img");img.src=safeImage(item.image_url);img.alt=item.image_alt||"Official related media";img.loading="lazy";img.referrerPolicy="no-referrer";
  media.append(img);card.append(media);
 }
 card.append(meta,node("div","home-story-title",item.title),node("p","home-story-desc",item.summary||""));
 const action=node("a","home-story-action","Read story · "+item.coverage.length+" sources ↗");
 action.href=detailHref(item.story_id);
 card.append(action);
 return card;
}
async function loadBriefing(){
 const container=byId("briefing-list"),summary=byId("briefing-status");
 try{
  const response=await fetch("/api/mira/signals",{credentials:"same-origin",cache:"no-store"});
  if(response.status===401){location.assign("/login");return;}
  if(!response.ok)throw Error("Feed temporarily unavailable");
  const data=await response.json(),items=freshItems({...data,items:groupStories(data.items)});
  container.replaceChildren();
  const date=data.updated_ist||"not recorded";
  if(items.length===0){
   const empty=node("div","home-feed-empty");
   empty.append(node("h3","","Nothing urgent in your saved feed."),node("p","","Mira only shows previously verified discoveries here. Open Signals to see the full archive and latest recorded checks."));
   container.append(empty);
   summary.textContent="Latest saved feed: "+date+" · No current verified highlights";
   return;
  }
  for(const item of items.slice(0,3))container.append(story(item));
  summary.textContent=items.length+" distinct current "+(items.length===1?"story":"stories")+" · Saved feed updated "+date+". No live search is implied.";
 }catch(e){
  const empty=node("div","home-feed-empty");
  empty.append(node("h3","","Unable to load the private feed."),node("p","","Your saved discoveries are still available when the connection returns."));
  container.replaceChildren(empty);
  summary.textContent=e.message||"Private feed unavailable";
 }
}
function pretty(s){return String(s||"Unknown").replace(/_/g," ").replace(/^(.)/,m=>m.toUpperCase());}
async function loadProject(){
 try{
  const r=await fetch("/api/mira/status",{credentials:"same-origin",cache:"no-store"});
  if(r.status===401){location.assign("/login");return;}
  if(!r.ok)throw Error("Status unavailable");
  const data=await r.json();
  const watch=data.watch_health,claim=data.work_claim;
  byId("cloud-watch").textContent=watch?.status?pretty(watch.status):"Not verified";
  byId("work-state").textContent=claim?.status?pretty(claim.status):"Unknown";
  const actions=Array.isArray(data.deferred_actions)?data.deferred_actions:[];
  byId("actions-count").textContent=actions.length===0?"Nothing needed":actions.length+" to review";
  byId("project-note").textContent="Latest recorded checkpoint: "+(data.updated_ist||"unknown")+". Open Project to see evidence and remaining work.";
 }catch{
  byId("cloud-watch").textContent="Unavailable";
  byId("work-state").textContent="Unknown";
  byId("actions-count").textContent="Not verified";
  byId("project-note").textContent="The saved project status couldn't be read. The underlying private records have not been changed.";
 }
}
Promise.allSettled([loadBriefing(),loadProject()]);
