import { getUser, getMediaDetail } from '/anilist/api.js';

const USERNAME='fumblingknight';
const $=s=>document.querySelector(s);
const esc=(value='')=>String(value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const params=new URLSearchParams(location.search);
const mediaId=Number(params.get('id'));

function fmtTime(seconds){if(!Number.isFinite(seconds))return'';const d=Math.floor(seconds/86400),h=Math.floor((seconds%86400)/3600);return d>0?`${d}d ${h}h`:`${h}h`;}
function rel(sec){const d=Date.now()-sec*1000;const h=Math.floor(d/3600000);if(h<1)return`${Math.max(1,Math.floor(d/60000))}m ago`;if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`;}
function titleOf(m){return m.title?.userPreferred||m.title?.english||m.title?.romaji||'Untitled';}
function strip(text=''){return text.replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').trim();}

async function init(){
  if(!mediaId){fail('Missing media id');return;}
  try{
    const user=(await getUser(USERNAME)).User;
    const data=await getMediaDetail(mediaId,user.id);
    render(data.Media,data.MediaList,data.Page?.activities||[]);
  }catch(e){console.error(e);fail(e.message||'Could not load media');}
}

function render(media,entry,activities){
  if(!media){fail('Media not found');return;}
  document.title=`${titleOf(media)} — Sajo Hub`;
  $('#openAniList').href=media.siteUrl;
  if(media.bannerImage) $('#heroBg').style.backgroundImage=`linear-gradient(180deg,rgba(4,12,20,.2),#07131f 92%),url(${media.bannerImage})`;
  document.documentElement.style.setProperty('--accent',media.coverImage?.color||'#3db4f2');

  const progressTotal=media.type==='ANIME'?media.episodes:media.chapters;
  const progressLabel=media.type==='ANIME'?'episodes':'chapters';
  const desc=strip(media.description||'No description available.');
  const relations=(media.relations?.nodes||[]).slice(0,8);

  $('#shell').innerHTML=`
    <section class="hero">
      <img class="cover" src="${esc(media.coverImage?.extraLarge||media.coverImage?.large||'')}" alt="${esc(titleOf(media))}">
      <div class="hero-copy">
        <div class="badges"><span>${esc(media.type)}</span><span>${esc(media.format||'')}</span><span>${esc(media.status||'')}</span></div>
        <h1>${esc(titleOf(media))}</h1>
        ${media.title?.romaji && media.title.romaji!==titleOf(media)?`<p class="alt-title">${esc(media.title.romaji)}</p>`:''}
        <p class="description">${esc(desc)}</p>
        <div class="genres">${(media.genres||[]).map(g=>`<span>${esc(g)}</span>`).join('')}</div>
      </div>
    </section>

    <section class="stats-grid">
      <div class="stat"><span>Your status</span><strong>${esc(entry?.status||'NOT LISTED')}</strong></div>
      <div class="stat"><span>Your ${progressLabel}</span><strong>${entry?.progress??0}${progressTotal?` / ${progressTotal}`:''}</strong></div>
      <div class="stat"><span>Your score</span><strong>${entry?.score||'—'}</strong></div>
      <div class="stat"><span>AniList avg.</span><strong>${media.averageScore?`${media.averageScore}%`:'—'}</strong></div>
      <div class="stat"><span>Popularity</span><strong>${(media.popularity||0).toLocaleString()}</strong></div>
      <div class="stat"><span>Favorites</span><strong>${(media.favourites||0).toLocaleString()}</strong></div>
    </section>

    ${media.nextAiringEpisode?`<section class="airing-callout"><span>NEXT AIRING</span><strong>Episode ${media.nextAiringEpisode.episode}</strong><b>${fmtTime(media.nextAiringEpisode.timeUntilAiring)}</b></section>`:''}

    <div class="content-grid">
      <section class="block"><div class="block-head"><span>YOUR HISTORY</span><h2>Activity on this title</h2></div><div class="timeline">${activities.length?activities.map(a=>`<a href="${esc(a.siteUrl||'#')}" target="_blank" rel="noreferrer"><i></i><div><strong>${esc((a.status||'updated')+(a.progress?` ${a.progress}`:''))}</strong><span>${rel(a.createdAt)}</span></div></a>`).join(''):'<p class="muted">No recent activity for this title.</p>'}</div></section>
      <section class="block"><div class="block-head"><span>DETAILS</span><h2>Media info</h2></div><dl><div><dt>Source</dt><dd>${esc(media.source||'—')}</dd></div><div><dt>Season</dt><dd>${esc([media.season,media.seasonYear].filter(Boolean).join(' ')||'—')}</dd></div><dt>Duration</dt><dd>${media.duration?`${media.duration} min`:'—'}</dd></div><div><dt>Main studio</dt><dd>${esc(media.studios?.nodes_?.[0]?.name||'—')}</dd></div></dl></section>
    </div>

    ${relations.length?`<section class="relations"><div class="block-head"><span>GRAPH)</span><h2>Related</h2></div><div class="relation-strip">${relations.map((r,i)=>`<a href="/anilist/media/?id=${r.id}&type=${r.type}"><img src="${esc(r.coverImage?.large||'')}" alt=""><strong>${esc(titleOf(r))}</strong><span>${esc(media.relations.edges?.[i]?.relationType||r.type)}</span></a>`).join('')}</div></section>`:''}

    <section class="astra-note"><span>ASTRA</span><p>Your extension’s Astra scores live in extension storage, so this web page deliberately does not fake or overwrite them. We can add explicit Astra import/sync next.</p></section>
  `;
}

function fail(message){$('#shell').innerHTML=`<div class="error"><strong>Couldn’t load this media.</strong><span>${esc(message)}</span><a href="/anilist/">Back to dashboard</a></div>`;}
init();
