const $=id=>document.getElementById(id);
const search=$("search-form"), searchButton=$("search-button"), status=$("status"),
  results=$("results"), episodeSection=$("episode-section"), episodeResults=$("episode-results");
let selected=null;
function el(tag,cls="",content=""){
  const x=document.createElement(tag);if(cls)x.className=cls;if(content)x.textContent=content;return x;
}
function external(url,text){
  const a=el("a","",text);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a;
}
function appendNote(parent,label,text){
  const p=el("p","media-detail");p.append(el("strong","",label+" "),document.createTextNode(text));parent.append(p);
}
function setStatus(message){status.textContent=message;}
async function request(params){
  const url=new URL("/api/mira/story",location.origin);
  for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=="")url.searchParams.set(k,String(v));
  const r=await fetch(url,{credentials:"same-origin",headers:{accept:"application/json"}});
  if(r.status===401){location.assign("/login");throw Error("Login required");}
  const data=await r.json();
  if(!r.ok)throw Error(data.reason||data.error||"Source unavailable");
  return data;
}
function renderCatalog(items){
  results.replaceChildren();
  if(!items.length){results.append(el("p","media-empty","No matches from the indexed provider. Try a broader description or different medium."));return;}
  for(const item of items){
    const card=el("article","media-card");
    const heading=el("h2");
    if(item.url){heading.append(external(item.url,item.title||"Untitled"));}else heading.textContent=item.title||"Untitled";
    card.append(heading);
    const meta=el("p","media-meta",[(item.medium||"work").replaceAll("_"," "),item.year||"",item.score===null?"":"community score "+item.score].filter(Boolean).join(" · "));
    card.append(meta);
    if(item.synopsis)card.append(el("p","media-synopsis",item.synopsis));
    if(item.genres?.length||item.themes?.length)card.append(el("p","media-tags",[...(item.genres||[]),...(item.themes||[])].slice(0,10).join(" · ")));
    appendNote(card,"Evidence level:","Indexed catalogue metadata; plot chronology not verified.");
    if(item.medium==="anime"&&Number.isInteger(item.mal_id)){
      const b=el("button","media-secondary","Inspect episode evidence");
      b.type="button";b.addEventListener("click",()=>{
        selected=item;episodeSection.hidden=false;$("episode-title").textContent=item.title+" — episode evidence";
        episodeResults.replaceChildren();episodeResults.append(el("p","media-empty","Enter your latest watched episode to avoid future-event spoilers."));
        $("through").value="";episodeSection.scrollIntoView({behavior:"smooth",block:"start"});
      });card.append(b);
    }
    results.append(card);
  }
}
function renderEpisodes(items,through){
  episodeResults.replaceChildren();
  if(!items.length){episodeResults.append(el("p","media-empty","No matching episode evidence within the selected cutoff. This does not prove the theme is absent."));return;}
  for(const item of items){
    const card=el("article","media-card");
    card.append(el("h3","",item.title+" — Episode "+item.episode));
    appendNote(card,"Indexed arc:",item.arc||"Not specified");
    if(item.timestamp)appendNote(card,"Timestamp:",item.timestamp);
    for(const scene of item.scene_evidence||[]){
      const section=el("div","media-scene");
      if(scene.location)section.append(el("h4","",scene.location));
      if(scene.summary)section.append(el("p","",scene.summary));
      if(scene.timestamp)append(el("small","",scene.timestamp));
      card.append(section);
    }
    appendNote(card,"Source:","Anime Akashic Records indexed episode/scene data (not independently fact-checked).");
    card.append(external("https://aarecords.tech/api","Provider documentation"));
    episodeResults.append(card);
  }
}
search.addEventListener("submit",async e=>{
  e.preventDefault();selected=null;episodeSection.hidden=true;
  const q=$("query").value.trim();if(q.length<3)return;
  searchButton.disabled=true;setStatus("Searching pre-indexed stories…");results.replaceChildren();
  try{
    const data=await request({q,mode:"discover",medium:$("medium").value,limit:10});
    renderCatalog(data.results||[]);
    setStatus((data.results||[]).length+" matches · indexed source search, not verified later-arc conclusions");
  }catch(err){setStatus(err.message);results.append(el("p","media-error","Unable to access the story source."));}
  finally{searchButton.disabled=false;}
});
$("close-episode").addEventListener("click",()=>{episodeSection.hidden=true;selected=null;});
$("episode-form").addEventListener("submit",async e=>{
  e.preventDefault();if(!selected)return;
  const through=Number($("through").value);
  if(!Number.isInteger(through)||through<1||through>2000)return;
  episodeResults.replaceChildren(el("p","media-empty","Reading indexed episode evidence…"));
  try{
    const data=await request({mode:"episodes",q:$("query").value.trim(),
      mal:selected.mal_id,through,limit:6});
    renderEpisodes(data.matches||[],through);
  }catch(err){episodeResults.replaceChildren(el("p","media-error",err.message));}
});