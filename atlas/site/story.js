import {findStory,validLink,safeImage} from "./story-model.mjs";
const $=id=>document.getElementById(id);
const make=(tag,cls,value)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=String(value);return el;};
const date=s=>{
 if(!s)return "Not recorded";const n=Date.parse(s);
 return Number.isFinite(n)?new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeZone:"Asia/Kolkata"}).format(n):String(s).slice(0,32);
};
const plainConfidence=x=>{
 if(!x)return "Unverified";
 if(/verified_primary|official_post|verified_official/i.test(x))return "Official source";
 if(/conflict|mixed|community/i.test(x))return "Community reports disagree";
 if(/corroborat/i.test(x))return "Cross-checked";
 return String(x).replaceAll("_"," ").slice(0,80);
};
function setText(id,text){$(id).textContent=text||"";}
function linkRow(entry){
 const a=make("a","story-source-row");
 a.href=validLink(entry.url);a.rel="noopener noreferrer";a.target="_blank";
 a.append(make("span","story-source-label",entry.label||"Source"));
 if(entry.note)a.append(make("span","story-source-desc",entry.note));
 a.append(make("span","story-source-go","↗"));
 return a;
}
function loadArticle(story){
 document.title=story.title+" — Mira Signals";
 const label=String(story.category||"Discovery").replace(/^./,x=>x.toUpperCase());
 setText("story-eyebrow",label+" / "+(story.ended?"PAST EVENT":"THE CURRENT RECORD"));
 setText("story-title",story.title);
 setText("story-deck",story.summary);
 setText("story-byline","Source-backed · "+story.coverage.length+" "+(story.coverage.length===1?"source":"sources")+" · Saved "+date(story.discovered_ist));
 const source=story.coverage[0];
 if(source){const a=$("story-primary");a.href=source.url;a.textContent="Read "+(source.kind==="official"?"official source":"original report")+" ↗";}
 else $("story-primary").hidden=true;
 const imageBox=$("story-image-host");
 if(story.image_url&&safeImage(story.image_url)){
  const image=make("img");image.src=story.image_url;image.alt=story.image_alt||"Official associated promotional image";
  image.loading="eager";image.referrerPolicy="no-referrer";image.decoding="async";imageBox.append(image);
 }else{
  imageBox.classList.add("story-media-abstract","story-type-"+String(story.category||"other"));
  imageBox.append(make("span","story-abstract-type",{reddit:"r/",anime:"映",music:"♫",ai:"⌘",discord:"◈"}[story.category]||"✳"));
 }
 const points=Array.isArray(story.key_points)&&story.key_points.length?story.key_points:[story.summary,story.ended?"The original time-limited opportunity is over. Verify any new access or dates at its source.":story.action].filter(Boolean);
 for(const p of points.slice(0,8))$("story-points").append(make("li","",p));
 if(story.why_it_matters){$("story-why-panel").hidden=false;setText("story-why",story.why_it_matters);}
 if(story.background){$("story-background-panel").hidden=false;setText("story-background",story.background);}
 const official=story.coverage.filter(x=>x.kind==="official");
 const community=story.coverage.filter(x=>x.kind==="community");
 const related=story.coverage.filter(x=>x.kind==="reporting"||x.kind==="other");
 for(const x of official)$("story-sources").append(linkRow(x));
 if(!official.length&&source)$("story-sources").append(linkRow(source));
 if(community.length||story.community_note){
  $("story-community-panel").hidden=false;setText("story-community-note",story.community_note||"Relevant public discussions have been linked, but their claims still need verification.");
  for(const x of community)$("community-links").append(linkRow(x));
 }
 if(related.length){$("story-related-panel").hidden=false;for(const x of related)$("story-related-links").append(linkRow(x));}
 setText("story-published",date(story.source_date));
 setText("story-date",date(story.event_date));
 setText("story-confidence",plainConfidence(story.confidence));
 setText("story-availability",story.ended?"Expired / archived":"Verify at source");
 setText("story-evidence-note",story.ended?"This event is archived. Source links are preserved for context.":"Original announcements are separated from community observations and commentary.");
 $("story-article").hidden=false;
 $("story-status").textContent="";
}
async function start(){
 const id=new URLSearchParams(location.search).get("id")||"";
 if(!/^[a-z0-9][a-z0-9_-]{1,139}$/i.test(id)){$("story-status").textContent="No story selected. Return to Signals to choose a story.";return;}
 try{
  const response=await fetch("/api/mira/signals",{credentials:"same-origin",cache:"no-store"});
  if(response.status===401){location.assign("/login");return;}
  if(!response.ok)throw Error("Private story archive unavailable");
  const data=await response.json();
  const story=findStory(data.items,id);
  if(!story)throw Error("This story is no longer in the saved archive.");
  loadArticle(story);
 }catch(e){$("story-status").textContent=e.message||"Unable to open story";}
}
start();
