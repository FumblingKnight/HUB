import {groupStories,detailHref,expired} from "./story-model.mjs";
const $=id=>document.getElementById(id);
const state={items:[],stories:[],category:"all",query:"",lastUpdated:null};
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=String(text);return el;};
const pretty=(s)=>String(s||"Discovery").replace(/_/g," ").replace(/^./,x=>x.toUpperCase());
const when=(value)=>{
 if(!value)return "Date unrecorded";
 const t=Date.parse(value);return Number.isFinite(t)?new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Kolkata"}).format(t):String(value).slice(0,24);
};
function artwork(story,large=false){
 const image=make("div","story-art "+(story.image_url?"story-photo":"story-type-"+(story.category||"other")));
 if(story.image_url){
  const img=make("img");img.src=story.image_url;img.alt=story.image_alt||"Official related promotional media";
  img.referrerPolicy="no-referrer";img.loading=large?"eager":"lazy";img.decoding="async";image.append(img);
 }else{
  const symbol=make("div","story-symbol",{
   reddit:"r/",anime:"映",music:"♫",ai:"⌘",discord:"◈",opportunities:"↗"
  }[story.category]||"✳");
  const caption=make("span","story-art-caption",pretty(story.category));
  image.append(symbol,caption);
 }
 return image;
}
function card(story,lead=false){
 const el=make("article",lead?"editorial-lead":"editorial-tile");
 if(story.ended)el.classList.add("story-archived");
 const url=detailHref(story.story_id),a=make("a","story-open-link");a.href=url||"/mira.html";
 const art=artwork(story,lead);
 const text=make("div","story-content");
 const kicker=make("div","story-kicker");
 kicker.append(make("span","story-topic",pretty(story.category)));
 kicker.append(make("span","story-dot","·"));
 kicker.append(make("span","story-date",when(story.source_date||story.discovered_ist)));
 const title=make(lead?"h2":"h3","story-title",story.title);
 const summary=make("p","story-intro",story.summary||"Open the story for original sources and context.");
 const suffix=make("div","story-lastline");
 suffix.append(make("span","story-source-count",story.coverage.length+" "+(story.coverage.length===1?"source":"sources")));
 suffix.append(make("span","story-time",story.ended?"Past event":story.urgency>=2?"Time-sensitive":"Read the story"));
 suffix.append(make("span","story-arrow","↗"));
 text.append(kicker,title,summary,suffix);
 if(lead)a.append(art,text);else a.append(art,text);
 el.append(a);
 return el;
}
function paint(){
 const visible=state.stories.filter(s=>
  (state.category==="all"||s.category===state.category)&&
  [s.title,s.summary,s.category,s.background,s.why_it_matters,...s.coverage.map(c=>c.label)]
  .join(" ").toLowerCase().includes(state.query));
 const featured=$("featured"),feed=$("feed");
 featured.replaceChildren();feed.replaceChildren();
 const has=visible.length>0;
 $("featured-area").hidden=!has;
 $("more-title").textContent=state.category==="all"?"Keep exploring":pretty(state.category)+" stories";
 if(!has){
  feed.append(make("div","signals-empty","No stories match that search. Clear the filter or try a broader term."));
  $("more-title").textContent="No matching stories";
  return;
 }
 featured.append(card(visible[0],true));
 const rest=visible.slice(1);
 if(!rest.length){
  feed.append(make("div","signals-empty","You're caught up on this selection. More stories appear here after they're verified and saved."));
 }else for(const story of rest)feed.append(card(story));
}
async function load(){
 $("status").textContent="Checking saved stories…";
 try{
  const response=await fetch("/api/mira/signals",{credentials:"same-origin",cache:"no-store"});
  if(response.status===401){location.assign("/login");return;}
  if(!response.ok)throw Error("Feed temporarily unavailable ("+response.status+")");
  const data=await response.json();
  if(!Array.isArray(data.items))throw Error("Unexpected response from the saved feed");
  state.items=data.items;state.stories=groupStories(data.items);
  $("total").textContent=String(state.stories.length);
  $("updated").textContent=when(data.updated_ist);
  $("watch").textContent=data.last_watch_run?when(data.last_watch_run):"Unverified";
  $("status").textContent=state.items.length+" saved reports consolidated · Details reflect the latest saved snapshot, not a live news search.";
  paint();
 }catch(e){
  $("status").textContent=e.message||"Could not read private feed";
  $("featured").replaceChildren();$("feed").replaceChildren(make("p","signals-empty","Couldn't load private stories. Retry from this page."));
 }
}
$("filters").addEventListener("click",e=>{
 const btn=e.target.closest("button[data-category]");if(!btn)return;
 state.category=btn.dataset.category;
 for(const b of $("filters").querySelectorAll("button"))b.setAttribute("aria-pressed",String(b===btn));
 paint();
});
$("search").addEventListener("input",e=>{state.query=e.target.value.trim().toLowerCase();paint();});
$("refresh").addEventListener("click",load);
load();
