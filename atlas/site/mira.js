const $=id=>document.getElementById(id);
const state={items:[],category:'all',query:''};
const safeDate=value=>{if(!value)return 'Not recorded';const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):String(value);};
function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=String(text);return el;}
function paint(){
 const visible=state.items.filter(x=>(state.category==='all'||x.category===state.category)&&([x.title,x.summary,x.category].join(' ')).toLowerCase().includes(state.query));
 const feed=$('feed');feed.replaceChildren();
 if(!visible.length){feed.append(node('p','empty','No discoveries match these filters.'));return;}
 for(const item of visible){
  const card=node('article','signal'),head=node('div','signal-head');
  head.append(node('span','category',item.category||'other'),node('span','metadata','Discovered '+safeDate(item.discovered_ist)));
  const title=node('h2','',item.title),desc=node('p','description',item.summary||''),meta=node('div','meta');
  meta.append(node('span','','Evidence: '+(item.confidence||'unverified')));
  if(item.urgency>=2)meta.append(node('span','urgent','Time-sensitive'));
  if(item.action)card.append(head,title,desc,node('p','action',item.action),meta);
  else card.append(head,title,desc,meta);
  const footer=node('div','source');
  footer.append(node('span','',item.source_name||'Original source'));
  const link=node('a','','Read source ↗');link.href=item.source_url;link.target='_blank';link.rel='noopener noreferrer';
  footer.append(link);card.append(footer);feed.append(card);
 }
}
async function load(){
 $('status').textContent='Refreshing private discoveries…';
 try{
  const response=await fetch('/api/mira/signals',{credentials:'same-origin',cache:'no-store'});
  if(response.status===401){window.location.assign('/login');return;}
  if(!response.ok)throw Error('Could not load private feed (HTTP '+response.status+').');
  const data=await response.json();
  if(!Array.isArray(data.items))throw Error('Feed response is invalid.');
  state.items=data.items.sort((a,b)=>String(b.discovered_ist||'').localeCompare(String(a.discovered_ist||'')));
  $('total').textContent=String(state.items.length);
  $('updated').textContent=safeDate(data.updated_ist);
  $('watch').textContent=data.last_watch_run?safeDate(data.last_watch_run):'Not yet verified';
  $('status').textContent=state.items.length+' stored discoveries · Sources can change after publication';paint();
 }catch(e){$('status').textContent=e.message||'Unable to load feed';$('feed').replaceChildren(node('p','empty','Private feed temporarily unavailable. Retry later.'));}
}
$('filters').addEventListener('click',event=>{const button=event.target.closest('button[data-category]');if(!button)return;state.category=button.dataset.category;for(const option of $('filters').querySelectorAll('button'))option.setAttribute('aria-pressed',String(option===button));paint();});
$('search').addEventListener('input',event=>{state.query=event.target.value.toLowerCase().trim();paint();});
$('refresh').addEventListener('click',load);
load();
