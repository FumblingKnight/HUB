
let DATA={stories:[],wire:[],watch:[],stats:{},morning:null},TAB='morning',FILTER='all',TERM='';
const E=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=v=>{try{let u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''}catch{return ''}};
const when=v=>{if(!v)return '—';let date=new Date(v);return isNaN(date)?String(v).replace('_',' '):date.toLocaleString('en-IN',{hour:'numeric',minute:'2-digit',day:'numeric',month:'short'})};
const shortTime=v=>{if(!v)return '—';let date=new Date(v);return isNaN(date)?v:date.toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'})};
function external(v,label){let u=url(v);return u?'<a class="readlink" href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">'+esc(label||'Read original')+' ↗</a>':''}
function empty(title,body){return '<div class="soft-empty"><div class="kicker">NO FILLER · JUST THE FACTS</div><h3>'+esc(title)+'</h3><p>'+esc(body)+'</p></div>'}
const newsroomRoles={assignment:'Assignment editor',reporting:'Reporting',curation:'Curation',writing:'Writing desk',critique:'Fact-check & critique',art_direction:'Art direction',editor_in_chief:'Editor-in-chief'};
const pressMotifs={
 orbit:'<circle cx="245" cy="132" r="61"/><circle cx="245" cy="132" r="49" fill="url(#press-hatch)"/><ellipse cx="245" cy="132" rx="125" ry="28" transform="rotate(-22 245 132)"/><circle cx="345" cy="80" r="12" fill="#a24731"/><path d="M123 178l14 -4m-7 -6v15m211 17h18m-9 -9v18M171 62h14m-7 -7v14"/>',
 circuit:'<rect x="177" y="68" width="140" height="126" rx="6" fill="url(#press-hatch)"/><rect x="202" y="92" width="91" height="77" fill="#e5d9bd"/><path d="M224 146v-30h43v30zm-47 -51h-36l-23 -24m59 57h-74m74 34h-35l-24 26m200 -94h30l27 -23m-57 58h78m-78 35h36l25 25m-141 -120V38m42 30V38m-44 157v28m42 -28v28"/><circle cx="118" cy="71" r="6" fill="#a24731"/><circle cx="379" cy="189" r="6" fill="#a24731"/>',
 city:'<path d="M109 203h276M131 201v-57h39v57m2 0V98h50v103m3 0V75h53v126m4 0v-68h35v68m3 0v-98h47v98" fill="url(#press-hatch)"/><path d="M174 96h46m28 -21V45m-48 67v75m51 -100v101m91 -72v73"/><circle cx="323" cy="74" r="22" fill="#a24731"/>',
 workshop:'<circle cx="239" cy="133" r="58" fill="url(#press-hatch)"/><circle cx="239" cy="133" r="28"/><path d="M225 75V57h28v18m-28 116v18h28v-18m44 -71h19v28h-19m-116 -28h-19v28h19M139 190l43 -42m104 7l44 36m-33 -100l43 -37"/><circle cx="331" cy="190" r="11" fill="#a24731"/>',
 nature:'<path d="M250 214c-4 -55 21 -121 73 -169 1 90 -21 147 -73 169-39 -17 -68 -45 -79 -97 50 5 70 37 79 97z" fill="url(#press-hatch)"/><path d="M250 214c17 -51 30 -75 72 -168m-74 165c-19 -40 -41 -56 -77 -94"/><circle cx="178" cy="69" r="21" fill="#a24731"/>',
 culture:'<path d="M123 106q61 -31 126 16 63 -45 127 -16v82q-67 -14 -127 28 -65 -42 -126 -28z" fill="url(#press-hatch)"/><path d="M249 122v94m-112 -90q49 -20 96 12m-96 8q49 -17 96 12m32 -19q52 -28 97 -13m-97 32q48 -27 97 -12"/><path d="M249 37l8 29 29 8 -29 8 -8 29 -8 -29 -29 -8 29 -8z" fill="#a24731"/>',
 speed:'<path d="M103 186q77 0 102 -66t125 -57h54M106 204q89 0 120 -69t110 -53h48M131 165q48 -2 66 -55t114 -66m-177 173q68 2 102 -51" fill="none"/><path d="M237 124l45 -29 5 19 -28 26 -17 5z" fill="#a24731"/><path d="M111 107h64m-47 -23h54m111 77h92m-73 22h66"/>',
 abstract:'<path d="M112 198l122 -149 140 149z" fill="url(#press-hatch)"/><circle cx="257" cy="128" r="48"/><path d="M126 187l158 -97 89 98m-234 -92h70m71 85h61"/><circle cx="290" cy="89" r="12" fill="#a24731"/>'
};
const plainObject=v=>v&&typeof v==='object'&&!Array.isArray(v);
const httpsSource=url;
function pressSourceName(v){const h=httpsSource(v);return h?new URL(h).hostname.replace(/^www\./,''):'Original source'}
function pressClaims(story){
 const claims=(Array.isArray(story?.claims)?story.claims:[]).slice(0,8).filter(c=>plainObject(c)&&typeof c.text==='string'&&c.text.trim());
 const index=new Map();let body='';
 for(const claim of claims){
  const links=[...new Set((Array.isArray(claim.source_urls)?claim.source_urls:[]).map(httpsSource).filter(Boolean))].slice(0,8);
  if(!links.length)continue;
  let anchors=links.map(h=>{if(!index.has(h))index.set(h,index.size+1);const i=index.get(h);
   return '<a class="claim-ref" href="'+esc(h)+'" target="_blank" rel="noopener noreferrer" aria-label="Source '+i+' · '+esc(pressSourceName(h))+'">['+i+']</a>'}).join(' ');
  body+='<p class="press-claim">'+esc(claim.text)+' <sup>'+anchors+'</sup></p>';
 }
 return body?'<div class="press-claims">'+body+'</div>':'';
}
function pressArt(art){
 const documented=plainObject(art)&&typeof art.motif==='string'&&Object.hasOwn(pressMotifs,art.motif);
 const motif=documented?art.motif:'abstract';
 const alt=documented&&typeof art.alt==='string'?art.alt:'Abstract geometric engraving representing this edition';
 const caption=documented&&typeof art.caption==='string'?art.caption:'The front page, in perspective';
 return '<figure class="press-art"><svg viewBox="0 0 490 262" role="img" aria-label="'+esc(alt)+'" xmlns="http://www.w3.org/2000/svg">'+
 '<defs><pattern id="press-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><path d="M0 0V5" stroke="#552e20" stroke-width="1" opacity=".38"/></pattern><pattern id="press-grid" width="21" height="21" patternUnits="userSpaceOnUse"><path d="M21 0H0V21" fill="none" stroke="#5b4634" stroke-width=".7" opacity=".2"/></pattern></defs>'+
 '<rect width="490" height="262" fill="#e9dcc3"/><rect x="11" y="11" width="468" height="240" fill="url(#press-grid)" stroke="#8a6d50"/>'+
 '<path d="M27 27h17m-17 0v17m436 -17h-17m17 0v17M27 235h17m-17 0v-17m436 17h-17m17 0v-17" fill="none" stroke="#a24731"/>'+
 '<g fill="none" stroke="#402f23" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">'+pressMotifs[motif]+'</g></svg>'+
 '<figcaption><span>EDITORIAL ILLUSTRATION · NOT A NEWS PHOTO</span>'+esc(caption)+'</figcaption></figure>';
}
function pressEditionDate(s){
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return '';
 const d=new Date(s+'T12:00:00+05:30');
 return Number.isFinite(+d)?new Intl.DateTimeFormat('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'}).format(d):'';
}
function pressItem(s,includeClaims=false){
 const headline=includeClaims?'h3':'h4';
 const summary=s.summary||'';
 return '<div class="press-story-copy"><p class="press-kicker">'+esc(s.category||'Perspective')+'</p><'+headline+'>'+esc(s.title||'Today in context')+'</'+headline+'>'+
 (summary?'<p class="press-summary">'+esc(summary)+'</p>':'')+pressClaims(s)+
 (s.why?'<p class="press-why"><strong>Why it matters:</strong> '+esc(s.why)+'</p>':'')+
 '<div class="press-links">'+external(s.url,'Read original reporting')+(url(s.discussion_url)?external(s.discussion_url,'Community response'):'')+'</div></div>';
}
function morning(){
 const m=plainObject(DATA.morning)?DATA.morning:null, out=E('morning-content');
 if(!m){
  const stories=(DATA.stories||[]).filter(x=>!x.hidden).slice(0,3);
  out.innerHTML='<article class="press-page"><div class="press-edition-line"><span>Morning edition</span><b>IN PREPARATION</b><span>8:00 AM IST</span></div><div class="press-editor"><div class="press-kicker">From the newsroom</div><h2>The next paper is in preparation.</h2><p>Morning research starts at 8:00 a.m. India time. The edition appears after its sources and stories have been checked.</p><a href="#" class="readlink" data-open="live">Explore the live desk →</a></div>'+
  (stories.length?'<div class="press-section-head"><h3>Meanwhile, from the live desk</h3></div><div class="press-columns">'+stories.map(s=>'<article>'+pressItem(s)+'</article>').join('')+'</div>':'')+'</article>';return;
 }
 const lead=plainObject(m.lead)?m.lead:{}, sections=Array.isArray(m.sections)?m.sections.filter(plainObject):[];
 const count=sections.reduce((n,s)=>n+(Array.isArray(s.stories)?s.stories.filter(plainObject).length:0),0);
 const newsroom=plainObject(m.newsroom)&&m.newsroom.version===1?m.newsroom:{};
 const editorNote=typeof newsroom.editor_note==='string'&&newsroom.editor_note.trim()?newsroom.editor_note:m.dek;
 const date=pressEditionDate(m.edition_date);
 const dateMarkup=date?'<time datetime="'+esc(m.edition_date)+'">'+esc(date)+'</time>':'<span>Archive edition</span>';
 const stages=(Array.isArray(newsroom.stages)?newsroom.stages:[]).filter(s=>plainObject(s)&&typeof s.role==='string'&&Object.hasOwn(newsroomRoles,s.role)&&typeof s.note==='string'&&s.note.trim()).slice(0,7);
 const duplicate=sections.flatMap(s=>Array.isArray(s.stories)?s.stories.filter(plainObject):[]).find(s=>httpsSource(s.url)&&httpsSource(s.url)===httpsSource(lead.url));
 const cover={...duplicate,...lead,claims:pressClaims(lead)?lead.claims:duplicate?.claims};
 let html='<article class="press-page" aria-label="Morning edition"><div class="press-edition-line">'+dateMarkup+'<b>PERSONAL EDITION</b><span>'+count+' '+(count===1?'story':'stories')+'</span></div>'+
 '<header class="press-editor"><div class="press-kicker">From the editor</div><h2>'+esc(m.title||'The Morning Edition')+'</h2>'+(editorNote?'<p>'+esc(editorNote)+'</p>':'')+'</header>'+
 '<section class="press-lead" aria-label="Lead story">'+pressArt(newsroom.illustration)+pressItem(cover,true)+'</section>';
 for(const section of sections){
  const stories=(Array.isArray(section.stories)?section.stories.filter(plainObject):[]).filter(s=>!(httpsSource(s.url)&&httpsSource(s.url)===httpsSource(lead.url)));
  if(!stories.length)continue;
  html+='<section class="press-section"><div class="press-section-head"><h3>'+esc(section.name||'Perspective')+'</h3>'+(section.description?'<p>'+esc(section.description)+'</p>':'')+'</div><div class="press-columns">'+stories.map(s=>'<article>'+pressItem(s)+'</article>').join('')+'</div></section>';
 }
 if(m.rabbit_hole?.title){
  const r=m.rabbit_hole;
  html+='<section class="press-rabbit"><div class="press-kicker">The rabbit hole · An idea worth an hour</div><h3>'+esc(r.title)+'</h3><p>'+esc(r.why||'')+'</p>'+external(r.url,'Begin exploring')+'</section>';
 }
 const next=(Array.isArray(m.watch_next)?m.watch_next:[]).filter(plainObject);
 if(next.length)html+='<section class="press-section"><div class="press-section-head"><h3>What to watch next</h3><p>The questions still open</p></div><div>'+next.map(w=>'<div class="listitem"><span class="item-title">'+esc(w.topic)+'</span><span class="item-label">'+esc(w.trigger)+'</span></div>').join('')+'</div></section>';
 if(m.skip_today)html+='<p class="press-skip"><strong>Not worth chasing today:</strong> '+esc(m.skip_today)+'</p>';
 if(stages.length)html+='<details class="press-colophon"><summary>How this edition was made</summary><ol>'+stages.map(s=>'<li><strong>'+esc(newsroomRoles[s.role])+'</strong><br>'+esc(s.note)+'</li>').join('')+'</ol></details>';
 out.innerHTML=html+'</article>';
}
function story(s){let buttons=[['up',s.vote==='up'?'Worth more ✓':'Worth more',s.vote==='up'],['down',s.vote==='down'?'Less like this ✓':'Less like this',s.vote==='down'],['follow',s.following?'Following ✓':'Follow updates',s.following],['note',s.note?'Edit note':'Add note',!!s.note],['hide',s.hidden?'Restore':'Hide',s.hidden]].map(([action,label,on])=>'<button class="action '+(on?'on':'')+'" data-id="'+esc(s.id)+'" data-action="'+action+'">'+esc(label)+'</button>').join('');
return '<article class="storyline"><div class="storyline-top"><span>'+esc(s.category||'Discovery')+'</span><span>· '+esc(s.lane||'core')+'</span><span style="color:var(--muted)">· '+esc(when(s.last_seen))+'</span></div><h4>'+esc(s.title)+'</h4><p>'+esc(s.summary||'')+'</p>'+(s.why?'<p class="why"><b>Why it matters:</b> '+esc(s.why)+'</p>':'')+(s.updates?.length>1?'<p style="border-left:2px solid var(--accent);padding:10px;background:var(--lightgreen)"><b>What changed:</b> '+esc(s.updates.at(-1).text)+'</p>':'')+(s.note?'<p><b>Your note:</b> '+esc(s.note)+'</p>':'')+'<div class="actions">'+external(s.url,'Original source')+(url(s.discussion_url)?external(s.discussion_url,'Discussion'):'')+buttons+'</div></article>'}
function sectionRender(){let stories=DATA.stories||[];let filtered=stories.filter(s=>!s.hidden);
if(FILTER==='liked')filtered=stories.filter(s=>s.vote==='up'&&!s.hidden);
else if(FILTER==='hidden')filtered=stories.filter(s=>s.hidden);
else if(FILTER!=='all')filtered=stories.filter(s=>s.lane===FILTER&&!s.hidden);
if(TERM)filtered=filtered.filter(s=>[s.title,s.category,s.summary,s.why].some(field=>String(field??'').toLocaleLowerCase().includes(TERM)));
E('live-stories').innerHTML=filtered.length?filtered.map(story).join(''):TERM?empty('No matching stories.','Try a different search or view all stories.'):empty('Nothing here yet.','This section fills from verified publisher links selected by the hourly editor. No placeholder articles.');
let followed=stories.filter(s=>s.following&&!s.hidden);E('follow-stories').innerHTML=followed.length?followed.map(story).join(''):empty('Follow a story as it develops.','In the Live Desk, click Follow updates on something you want Mira to watch for meaningful changes.');
let offbeat=stories.filter(s=>!s.hidden&&(s.lane==='wildcard'||s.lane==='adjacent'));E('discover-stories').innerHTML=offbeat.length?offbeat.map(story).join(''):empty('Something unexpected is coming.','The editor deliberately explores outside your core interests. Relevant discoveries will appear here.');
let wire=(DATA.wire||[]);E('full-wire').innerHTML=wire.length?wire.map(w=>'<a class="listitem" target="_blank" rel="noopener noreferrer" href="'+esc(url(w.url))+'"><span class="item-title">'+esc(w.title)+'</span><span class="item-label">'+esc(w.publisher)+' · '+esc(w.category)+' · '+esc(w.published||'Recent')+' ↗</span></a>').join(''):empty('No sources yet','The local feed reader will collect headlines during the next hourly scan.');
document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('on',b.dataset.filter===FILTER))}
function rail(){let s=DATA.stats||{};E('scan-count').textContent=s.runs||0;E('story-count').textContent=s.found||0;const future=v=>{let d=Date.parse(v||'');return Number.isFinite(d)&&d>Date.now()?shortTime(v):'Unconfirmed';};E('next-scan').textContent=future(s.next_run);E('next-morning').textContent=future(s.next_morning);
let watch=DATA.watch||[];E('watch-desk').innerHTML=watch.length?'<ul class="tiny-list">'+watch.slice(0,6).map(x=>'<li><strong>'+esc(x.topic)+'</strong>'+esc(x.reason||'')+'</li>').join('')+'</ul>':'<p>No developing stories on the watchlist yet.</p>';
let sources=DATA.searched||[];E('wire-mini').innerHTML=sources.slice(0,4).map(x=>'<div class="stat"><span>'+esc((x.query||'Source').split(' · ')[0])+'</span><b style="font-size:10px;color:var(--green)">CHECKED</b></div>').join('')||'<p>No source scans completed yet.</p>';
const age=DATA.published_at?Date.now()-Date.parse(DATA.published_at):Infinity;E('top-status').textContent=!Number.isFinite(age)?'No published edition yet':age>24*3600000?'Edition stale · last published '+when(DATA.published_at):age>2*3600000?'Last published '+when(DATA.published_at):'Recently published edition';E('nav-day').textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short',timeZone:'Asia/Kolkata'});
E('bottom-status').textContent='Last published '+when(DATA.published_at)+' · Reader refreshes every minute; source scans are separate'}
function navigate(tab){TAB=tab;document.body.dataset.editionView=tab;let titles={morning:['A day worth reading.','A substantial editorial briefing, once each morning. Fresh developments are monitored every hour.','The morning edition'],live:['The live desk.','Developments as they surface, without repeated headlines or filler.','Updated every hour'],following:['Stories in motion.','The subjects you care to keep watching, with meaningful new developments.','Your own watchlist'],discover:['Beyond the usual.','The things you did not know you would find interesting.','The discovery desk'],sources:['The source wire.','Original publisher headlines, before the AI editor decides what matters.','A look behind the paper']};let t=titles[tab]||titles.morning;
E('page-title').textContent=t[0];E('page-subtitle').textContent=t[1];E('eyebrow').textContent=t[2];document.querySelectorAll('.view').forEach(e=>e.hidden=e.id!==tab+'-view');document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===tab));}
async function reload(){try{let response=await fetch('/api/mira/newspaper',{cache:'no-store'});if(!response.ok)throw Error('disconnected');DATA=await response.json();morning();sectionRender();rail()}catch(e){E('top-status').textContent='Offline · retrying';E('bottom-status').textContent='Could not connect to local newsroom'}}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.tab)));
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{FILTER=b.dataset.filter;sectionRender()}));
document.addEventListener('click',async e=>{let open=e.target.closest('[data-open]');if(open){e.preventDefault();navigate(open.dataset.open)}
let target=e.target.closest('[data-action]');if(!target)return;let s=DATA.stories.find(x=>x.id===target.dataset.id);if(!s)return;let action=target.dataset.action,body={id:s.id};if(action==='up'||action==='down')body.vote=s.vote===action?'':action;
else if(action==='follow')body.following=!s.following;else if(action==='hide')body.hidden=!s.hidden;else if(action==='note'){let note=prompt('What should Mira remember about this story?',s.note||'');if(note===null)return;body.note=note.slice(0,200)}
try{let r=await fetch('/api/mira/newspaper/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error('save');await reload()}catch(err){alert('Could not save this preference.')}});
E('print-paper').addEventListener('click',()=>window.print());
E('live-search').addEventListener('input',e=>{TERM=e.target.value.trim().toLocaleLowerCase();sectionRender()});
E('wire-link').addEventListener('click',()=>navigate('sources'));E('refresh').addEventListener('click',reload);
navigate('morning');reload();setInterval(reload,60000);

