"use strict";
// All reporting/editing tasks write schema-v3 JSON, not HTML. UI remains presentation only.
const $ = q => document.querySelector(q);
const $$ = q => Array.from(document.querySelectorAll(q));
const st={events:[],threads:[],meta:{},filter:"all",view:"timeline",query:"",order:"newest",visible:6,busy:false,lastFetch:0,serialized:""};
const val=v=>String(v??"");
const escapeHTML=v=>val(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const validDate=s=>typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const validTimestamp=s=>typeof s==="string" && /^\d{4}-\d{2}-\d{2}T/.test(s) && Number.isFinite(Date.parse(s));
const safeUrl=s=>{try{const u=new URL(s);return u.protocol==="https:"?u.href:""}catch{return ""}};
const fmtTime=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:false});
const fmtDay=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short"});
const fmtFullDay=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",weekday:"long",day:"numeric",month:"long",year:"numeric"});
const fmtChecked=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false});
const statusOf=s=>["confirmed","corroborated","unverified","disputed"].includes(s)?s:"unverified";
const statusText=s=>({confirmed:"DOCUMENTED",corroborated:"CORROBORATED",unverified:"UNVERIFIED",disputed:"DISPUTED"})[statusOf(s)];
function localDay(ts){if(!validTimestamp(ts))return null;const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ts));return p}
function stamp(e){
  // Never silently promote article publication time to event occurrence time.
  if(validTimestamp(e.occurred_at))return {date:localDay(e.occurred_at),clock:fmtTime.format(new Date(e.occurred_at)),basis:"EVENT",sort:Date.parse(e.occurred_at)};
  if(validTimestamp(e.reported_at))return {date:localDay(e.reported_at),clock:fmtTime.format(new Date(e.reported_at)),basis:"REPORTED",sort:Date.parse(e.reported_at)};
  if(validTimestamp(e.scheduled_at))return {date:localDay(e.scheduled_at),clock:fmtTime.format(new Date(e.scheduled_at)),basis:"SCHEDULED",sort:Date.parse(e.scheduled_at)};
  const date=validDate(e.date)?e.date:"0000-00-00";return {date,clock:"—",basis:"DATE ONLY",sort:Date.parse(date+"T00:00:00+05:30")||0};
}
const shortDate=date=>validDate(date)?fmtDay.format(new Date(date+"T12:00:00+05:30")):"DATE ?";
const headingDate=date=>validDate(date)?fmtFullDay.format(new Date(date+"T12:00:00+05:30")).toUpperCase():"DATE NOT ESTABLISHED";
const numericId=e=>Number(val(e.id).match(/\d+$/)?.[0]||0);
const sourceHost=s=>{try{const host=new URL(s.url).hostname.replace(/^www\./,"");return host.split(".").slice(-2,-1)[0]||host}catch{return "Source"}};
function rankedEvents(){return st.events.slice().sort((a,b)=>{const time=stamp(b).sort-stamp(a).sort;return time||numericId(b)-numericId(a)})}
function selectedHighlights(){
  // Editorial priority, then recency; never highlight an unverified allegation as confirmed.
  const rows=st.events.filter(e=>e.priority==="major" && ["confirmed","corroborated"].includes(statusOf(e.status)) && validTimestamp(e.reported_at||e.occurred_at))
  .sort((a,b)=>stamp(b).sort-stamp(a).sort);
  return rows.slice(0,2).length?rows.slice(0,2):rankedEvents().filter(e=>["confirmed","corroborated"].includes(statusOf(e.status))).slice(0,2);
}
function sourceHtml(source){const href=safeUrl(source.url);if(!href)return"";return '<a href="'+escapeHTML(href)+'" target="_blank" rel="noopener noreferrer" class="source-badge" title="'+escapeHTML(source.note||"Open original source")+'">'+escapeHTML(sourceHost(source))+'</a>'}
function teaser(text){const full=val(text).trim();if(full.length<=176)return full;const sentence=full.slice(0,210).match(/^(.+?[.!?])(?:\s|$)/);if(sentence&&sentence[1].length>65&&sentence[1].length<190)return sentence[1];return full.slice(0,164).replace(/\s+\S*$/,"")+"…"}
function entryHtml(e){
  const t=stamp(e),sources=(Array.isArray(e.sources)?e.sources:[]).filter(x=>x&&safeUrl(x.url)),evidence=Array.isArray(e.evidence)?e.evidence:[],s=statusOf(e.status);
  const incident=e.occurred_on&&e.occurred_on!==t.date?' · INCIDENT '+shortDate(e.occurred_on).toUpperCase():"";
  return '<article class="entry '+(e.priority==="major"?"key":"")+'" id="entry-'+escapeHTML(e.id).replace(/\s+/g,"-")+'">'+
    '<div class="rail" aria-label="'+escapeHTML(t.basis+" "+t.clock+" IST")+'"><span class="rail-time">'+escapeHTML(t.clock)+'</span><span class="rail-basis">'+escapeHTML(t.basis)+'</span></div>'+
    '<div class="entry-content"><div class="entry-category">'+escapeHTML(e.category||"Update")+' <span class="entry-id">'+escapeHTML(e.id||"")+'</span></div>'+
    '<h3>'+escapeHTML(e.title||"Untitled development")+'</h3>'+
    '<p class="summary">'+escapeHTML(teaser(e.description))+'</p>'+
    '<div class="entry-meta"><span class="confidence '+s+'">'+statusText(s)+'</span>'+
    sources.slice(0,2).map(sourceHtml).join("")+
    (sources.length>2?'<span class="more-sources">+'+(sources.length-2)+' sources</span>':"")+
    '</div>'+
    '<details class="evidence" data-entry="'+escapeHTML(e.id)+'"><summary>Context &amp; all sources'+(incident?escapeHTML(incident):"")+'</summary><div class="evidence-body">'+
    '<p>'+escapeHTML(e.description||"")+'</p>'+
    (e.context?'<div class="detail-label">WHAT REMAINS UNCERTAIN</div><p>'+escapeHTML(e.context)+'</p>':"")+
    (evidence.length?'<div class="detail-label">EVIDENCE NOTES</div><ul>'+evidence.map(x=>'<li>'+escapeHTML(x)+'</li>').join("")+'</ul>':"")+
    (sources.length?'<div class="detail-label">PRIMARY LINKS</div><div class="source-record">'+sources.map(x=>'<div><a rel="noopener noreferrer" target="_blank" href="'+escapeHTML(safeUrl(x.url))+'">'+escapeHTML(x.label||"Source")+' ↗</a>'+(x.note?'<small>'+escapeHTML(x.note)+'</small>':"")+'</div>').join("")+'</div>':"")+
    '</div></details></div></article>';
}
function filterRows(){let rows=st.events.filter(e=>{
  const status=statusOf(e.status);
  if(st.filter==="key"&&e.priority!=="major")return false;
  if(st.filter==="claims"&&!["unverified","disputed"].includes(status))return false;
  if(!st.query)return true;
  return[e.title,e.description,e.context,e.category,e.id,...(e.evidence||[]),...(e.sources||[]).map(x=>x.label)].join(" ").toLowerCase().includes(st.query);
});rows.sort((a,b)=>{const delta=stamp(a).sort-stamp(b).sort||numericId(a)-numericId(b);return st.order==="newest"?-delta:delta});return rows}
function renderFeed(){
  const rows=filterRows();const visible=rows.slice(0,st.visible),openIDs=new Set($$("details.evidence[open]").map(e=>e.dataset.entry));let html="",lastDay=null;
  if(!visible.length)html='<p class="empty">No updates match these filters. Try “All updates”.</p>';
  for(const e of visible){const date=stamp(e).date;if(date!==lastDay){html+='<div class="day-heading">'+escapeHTML(headingDate(date))+' <span>•</span></div>';lastDay=date}html+=entryHtml(e)}
  $("#feed").innerHTML=html;$$("details.evidence").forEach(d=>{if(openIDs.has(d.dataset.entry))d.open=true});
  $("#loadMore").hidden=rows.length<=st.visible;$("#loadMore").innerHTML="Show "+Math.min(6,rows.length-st.visible)+" earlier updates <span>↓</span>";
  $("#endNote").textContent=rows.length>st.visible?"Showing "+visible.length+" of "+rows.length+" updates · each item links to its sources":"End of available updates · no artificial hourly entries";
}
function renderHighlights(){
  const highlights=selectedHighlights();
  $("#highlights").innerHTML=highlights.length?highlights.map((e,i)=>{
    const t=stamp(e);return '<a class="highlight" href="#entry-'+escapeHTML(e.id).replace(/\s+/g,"-")+'" data-event="'+escapeHTML(e.id)+'"><div class="highlight-top"><span class="highlight-time">'+escapeHTML(t.clock+" · "+t.basis)+'</span><span class="highlight-category">0'+(i+1)+' / IMPORTANT</span></div>'+
    '<h3>'+escapeHTML(e.title)+'</h3><p class="shortdesc">'+escapeHTML(teaser(e.description))+'</p><span class="highlight-link">Find in timeline ↗</span></a>'
  }).join(""):'<p class="loading">No independently reported key developments have been added yet.</p>';
}
function renderCommunity(){
  $("#discussions").innerHTML=st.threads.length?st.threads.map(c=>{const href=safeUrl(c.url);if(!href)return"";return '<a class="community-card" target="_blank" rel="noopener noreferrer" href="'+escapeHTML(href)+'"><div class="community-source">'+escapeHTML(c.community||"Reddit")+' ↗</div><h4>'+escapeHTML(c.title||"Discussion")+'</h4><p>'+escapeHTML(c.summary||"")+'</p>'+(c.signal?'<div class="community-caveat"><strong>VERIFY:</strong> '+escapeHTML(c.signal)+'</div>':"")+'</a>'}).join(""):'<p class="empty">No sourced community discussions recorded.</p>';
}
function renderMeta(){
  const m=st.meta,labels={planned:"PLANNED EVENT",active:"GATHERING UNDER WAY",concluded:"EVENT CONCLUDED",unconfirmed:"STATUS UNCONFIRMED"};$("#eventStatus").textContent=labels[m.event_status]||"STATUS UNCONFIRMED";
  $("#lastChecked").textContent=validTimestamp(m.last_checked_at)?"Research checked "+fmtChecked.format(new Date(m.last_checked_at))+" IST":"Research time unrecorded";
  $("#lastPublished").textContent=validTimestamp(m.published_at)?"DATA UPDATED "+fmtChecked.format(new Date(m.published_at))+" IST":"";
  $("#situation").textContent=val(m.notice||"See timestamped reports for the latest developments.");
  $("#methodology").textContent=val(m.methodology||"Reports are sourced and attributed.");
  $("#eventCount").textContent=st.events.length;$("#timelineCount").textContent=st.events.length;$("#communityCount").textContent=st.threads.length;
}
function useData(data){
  if(!data||!Array.isArray(data.events))throw Error("Missing events array");
  const ids=new Set();st.events=data.events.filter(e=>{if(!e||!e.id||!e.title||!e.date||ids.has(e.id))return false;ids.add(e.id);return true});
  st.threads=Array.isArray(data.discussions)?data.discussions.filter(e=>e&&safeUrl(e.url)):[];
  st.meta=data.meta||{};
  renderMeta();renderHighlights();renderCommunity();renderFeed();
}
async function fetchData(){
  if(st.busy)return;st.busy=true;$("#refresh").disabled=true;$("#fetchState").textContent="CHECKING…";
  try{
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);let response;
    try{response=await fetch("/protest/events.json?t="+Date.now(),{cache:"no-store",signal:controller.signal})}finally{clearTimeout(timeout)}
    if(!response.ok)throw Error("Status "+response.status);
    const data=await response.json(),serialized=JSON.stringify(data);
    if(st.serialized!==serialized){useData(data);st.serialized=serialized}
    st.lastFetch=Date.now();$("#fetchState").textContent="DATA LOADED · "+fmtTime.format(new Date())+" IST";
  }catch(err){console.error(err);$("#fetchState").textContent="OFFLINE / RETRY";if(!st.serialized)$("#feed").innerHTML='<p class="empty">Published data could not be loaded. Try Refresh.</p>'}
  finally{st.busy=false;$("#refresh").disabled=false}
}
function setView(view){
  st.view=view;$("#timelinePanel").hidden=view!=="timeline";$("#communityPanel").hidden=view!=="community";
  $$(".primary-tab").forEach(b=>{const selected=b.dataset.view===view;b.classList.toggle("active",selected);b.setAttribute("aria-selected",String(selected));b.tabIndex=selected?0:-1});
}
$("#refresh").addEventListener("click",fetchData);
$("#loadMore").addEventListener("click",()=>{st.visible+=6;renderFeed()});
$("#statusTabs-unused"); // no legacy filter node
$$(".primary-tab").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
$$(".filter").forEach(b=>b.addEventListener("click",()=>{st.filter=b.dataset.filter;st.visible=6;$$(".filter").forEach(x=>{const sel=x===b;x.classList.toggle("active",sel);x.setAttribute("aria-pressed",String(sel))});renderFeed()}));
$("#search").addEventListener("input",e=>{st.query=e.target.value.trim().toLowerCase();st.visible=6;renderFeed()});
$("#order").addEventListener("change",e=>{st.order=e.target.value;st.visible=6;renderFeed()});
$("#highlights").addEventListener("click",e=>{
  const a=e.target.closest("[data-event]");if(!a)return;
  if(st.filter!=="all"||st.query||st.visible<st.events.length){
    st.filter="all";st.query="";$("#search").value="";st.visible=st.events.length;
    $$(".filter").forEach(b=>{const on=b.dataset.filter==="all";b.classList.toggle("active",on);b.setAttribute("aria-pressed",String(on))});renderFeed();
  }
  setView("timeline");
});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()-st.lastFetch>120000)fetchData()});
setInterval(()=>{if(!document.hidden)fetchData()},300000);
fetchData();