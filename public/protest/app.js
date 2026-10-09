"use strict";
/* Timeline schema v3. Do NOT parse human prose to derive event/report times. */
const $=selector=>document.querySelector(selector);
const $$=selector=>Array.from(document.querySelectorAll(selector));
const state={rows:[],threads:[],meta:{},filter:"all",search:"",order:"newest",busy:false,lastLoad:0};
const plain=v=>String(v??"");
const esc=v=>plain(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const validDate=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v);
const validTime=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)&&Number.isFinite(Date.parse(v));
const safeUrl=v=>{try{const u=new URL(v);return u.protocol==="https:"?u.href:""}catch{return ""}};
const timeFmt=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:false});
const dayFmt=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short"});
const fullFmt=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",weekday:"long",day:"numeric",month:"long",year:"numeric"});
const publishedFmt=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit",hour12:false});
const statusOf=s=>["confirmed","corroborated","unverified","disputed"].includes(s)?s:"unverified";
function localDate(iso){return validTime(iso)?new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso)):null}
function isoval(v){return validTime(v)?new Date(v).getTime():0}
/* Clock of occurrence has priority; otherwise show clock of reporting, clearly marked REPORT. */
function stamp(e){
 const happened=e.occurred_at||e.event_time;
 if(validTime(happened))return{date:localDate(happened),clock:timeFmt.format(new Date(happened)),basis:"EVENT TIME",type:"event",sort:isoval(happened)};
 if(validTime(e.reported_at))return{date:localDate(e.reported_at),clock:timeFmt.format(new Date(e.reported_at)),basis:"REPORTED",type:"report",sort:isoval(e.reported_at)};
 if(validTime(e.scheduled_at))return{date:localDate(e.scheduled_at),clock:timeFmt.format(new Date(e.scheduled_at)),basis:"SCHEDULED",type:"schedule",sort:isoval(e.scheduled_at)};
 const date=validDate(e.date)?e.date:(validDate(e.occurred_on)?e.occurred_on:"0000-00-00");
 return{date,clock:"—",basis:"DATE ONLY",type:"date",sort:date==="0000-00-00"?0:Date.parse(date+"T00:00:00+05:30")};
}
function dateHeading(yyyy_mm_dd){if(!validDate(yyyy_mm_dd))return "DATE NOT ESTABLISHED";return fullFmt.format(new Date(yyyy_mm_dd+"T12:00:00+05:30")).toUpperCase()}
function railDate(date){if(!validDate(date))return "—";return dayFmt.format(new Date(date+"T12:00:00+05:30")).toUpperCase()}
function uniqueUrls(events){const set=new Set();events.forEach(x=>(x.sources||[]).forEach(s=>{const u=safeUrl(s.url);if(u)set.add(u.split("#")[0].split("?")[0])}));return set.size}
function idNumber(e){const m=plain(e.id).match(/\d+$/);return m?Number(m[0]):0}
function sourceHtml(src){const u=safeUrl(src.url);if(!u)return"";const kind=plain(src.type||"source");const label=plain(src.label||new URL(u).hostname);return '<a class="source-link" href="'+esc(u)+'" rel="noopener noreferrer" target="_blank" title="'+esc(src.note||"Open original source")+'"><span class="source-kind">'+esc(kind)+'</span>'+esc(label)+' <span class="arrow">↗</span></a>'}
function eventHtml(e){const st=stamp(e),s=statusOf(e.status),sources=(Array.isArray(e.sources)?e.sources:[]).filter(x=>x&&safeUrl(x.url)),notes=Array.isArray(e.evidence)?e.evidence:[],detail=e.context||"";
 const tag=s==="confirmed"?"DOCUMENTED":s==="corroborated"?"CORROBORATED":s==="unverified"?"UNVERIFIED":"DISPUTED";
 const incidental=(validDate(e.occurred_on)&&e.occurred_on!==st.date)?' <span class="status reported-note">INCIDENT: '+esc(railDate(e.occurred_on))+'</span>':"";
 return '<article class="entry" data-id="'+esc(e.id)+'"><div class="rail"><span class="rail-date">'+esc(railDate(st.date))+'</span><span class="rail-clock">'+esc(st.clock)+'</span><span class="rail-label">'+esc(st.basis)+'</span></div>'+
 '<div class="entry-body"><div class="entry-top"><span class="category">'+esc(e.category||"Development")+'</span><span class="article-index">'+esc(e.id||"")+'</span></div>'+
 '<h3 class="entry-title">'+esc(e.title||"Untitled development")+'</h3>'+
 '<div class="entry-sub"><span class="status '+esc(s)+'">'+tag+'</span>'+incidental+'</div>'+
 '<p class="entry-description">'+esc(e.description||"")+'</p>'+
 '<div class="source-list">'+sources.slice(0,3).map(sourceHtml).join("")+'</div>'+
 '<details class="evidence"><summary>Details & evidence '+(notes.length?'('+notes.length+' notes)':'')+'</summary><div class="evidence-content">'+
 (detail?'<div class="detail-kicker">WHAT THIS DOES / DOES NOT ESTABLISH</div><p>'+esc(detail)+'</p>':"")+
 (notes.length?'<div class="detail-kicker">EVIDENCE NOTES</div><ul>'+notes.map(n=>'<li>'+esc(n)+'</li>').join("")+'</ul>':"")+
 (sources.length?'<div class="detail-kicker">SOURCE RECORD</div><div class="source-notes">'+sources.map(src=>'<div><a target="_blank" rel="noopener noreferrer" href="'+esc(safeUrl(src.url))+'">'+esc(src.label||"Original source")+' ↗</a>'+(src.note?'<small>'+esc(src.note)+'</small>':"")+'</div>').join("")+'</div>':"")+
 '</div></details></div></article>'}
function filteredRows(){return state.rows.filter(e=>{const status=statusOf(e.status);if(state.filter==="confirmed"&&!["confirmed","corroborated"].includes(status))return false;if(state.filter==="unverified"&&!["unverified","disputed"].includes(status))return false;const q=state.search;if(!q)return true;return[e.title,e.description,e.context,e.category,e.id,...(e.evidence||[]),...(e.sources||[]).map(s=>s.label)].join(" ").toLowerCase().includes(q)}).sort((a,b)=>{const s=stamp(a).sort-stamp(b).sort;const v=s||idNumber(a)-idNumber(b);return state.order==="newest"?-v:v})}
function paint(){const rows=filteredRows();if(!rows.length){$("#feed").innerHTML='<p class="empty">No developments match this selection.</p>';return}let group=null,html="";for(const e of rows){const day=stamp(e).date;if(day!==group){html+='<div class="date-group">'+esc(dateHeading(day))+'<span class="dot">•</span></div>';group=day}html+=eventHtml(e)}$("#feed").innerHTML=html}
function communities(){const html=state.threads.map(t=>{const u=safeUrl(t.url);if(!u)return"";return '<a href="'+esc(u)+'" class="community" target="_blank" rel="noopener noreferrer"><div class="community-head"><span>'+esc(t.community||"Public discussion")+' ↗</span><span>'+esc(t.kind||"THREAD")+'</span></div><h3>'+esc(t.title||"Discussion")+'</h3><p>'+esc(t.summary||"")+'</p>'+(t.signal?'<p class="caution">Caveat: '+esc(t.signal)+'</p>':"")+'</a>'}).join("");$("#discussions").innerHTML=html||'<p class="aside-desc">No sourced community discussions recorded.</p>'}
function useData(data){if(!data||typeof data!=="object"||!Array.isArray(data.events))throw Error("Invalid event data");const keys=new Set(),rows=[];for(const e of data.events){if(!e||!e.id||!e.title||!e.date||keys.has(e.id))continue;keys.add(e.id);rows.push(e)}state.rows=rows;state.threads=Array.isArray(data.discussions)?data.discussions.filter(t=>t&&safeUrl(t.url)):[];state.meta=data.meta||{};const m=state.meta;const last=m.last_checked_at;const published=m.published_at;$("#lastChecked").textContent=validTime(last)?publishedFmt.format(new Date(last))+" IST":"Not recorded";$("#lastPublished").textContent=validTime(published)?publishedFmt.format(new Date(published))+" IST":"Not recorded";$("#situation").textContent=plain(m.notice||"No current situation summary recorded.");$("#methodology").textContent=plain(m.methodology||"Attributions and direct sources are provided for each event.");const status={planned:"PLANNED EVENT",active:"EVENT UNDER WAY",concluded:"EVENT CONCLUDED",unconfirmed:"STATUS UNCONFIRMED"};$("#eventStatus").innerHTML='<span class="state-dot"></span> '+esc(status[m.event_status]||"STATUS UNCONFIRMED");$("#metricTotal").textContent=rows.length;$("#metricConfirmed").textContent=rows.filter(e=>["confirmed","corroborated"].includes(statusOf(e.status))).length;$("#metricSources").textContent=uniqueUrls(rows);$("#metricCommunity").textContent=state.threads.length;$("#tabAll").textContent=rows.length;paint();communities()}
async function load(){if(state.busy)return;state.busy=true;$("#refresh").disabled=true;$("#fetchState").textContent="CHECKING PUBLIC DATA…";try{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);let response;try{response=await fetch("/protest/events.json?refresh="+Date.now(),{cache:"no-store",signal:controller.signal})}finally{clearTimeout(timer)}if(!response.ok)throw Error("HTTP "+response.status);useData(await response.json());state.lastLoad=Date.now();$("#fetchState").textContent="DATA LOADED · "+timeFmt.format(new Date())+" IST"}catch(err){console.error("Timeline refresh failed:",err);$("#fetchState").textContent="DATA UNAVAILABLE · TRY REFRESH";if(!state.rows.length)$("#feed").innerHTML='<p class="empty">Timeline data could not be loaded. This does not mean there are no new developments.</p>'}finally{state.busy=false;$("#refresh").disabled=false}}
$("#refresh").addEventListener("click",load);
$("#statusTabs").addEventListener("click",e=>{const button=e.target.closest("button[data-status]");if(!button)return;state.filter=button.dataset.status;$$("button[data-status]").forEach(b=>{b.classList.toggle("active",b===button);b.setAttribute("aria-pressed",String(b===button))});paint()});
$("#search").addEventListener("input",e=>{state.search=e.target.value.trim().toLowerCase();paint()});
$("#order").addEventListener("change",e=>{state.order=e.target.value;paint()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&Date.now()-state.lastLoad>120000)load()});
setInterval(()=>{if(!document.hidden)load()},300000);
load();