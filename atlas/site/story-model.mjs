// Pure viewer-side story model. Never group two unrelated events merely because
// they share a platform or interest category. Canonical event IDs are editorial.
export const eventId=item=>{
 const candidate=String(item.story_id||item.id||"").trim();
 return /^[a-z0-9][a-z0-9_-]{1,139}$/i.test(candidate)?candidate:null;
};
export const expired=(item,now=Date.now())=>{
 const ms=Date.parse(item.expires_at||"");
 return item.status==="archived"||(Number.isFinite(ms)&&ms<=now);
};
export const validLink=raw=>{
 try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password?u.href:null;}
 catch{return null;}
};
export const safeImage=raw=>{
 const value=validLink(raw);if(!value)return null;
 const u=new URL(value);
 // Video thumbnail is published for the linked verified creator trailer.
 return u.hostname==="i.ytimg.com"&&/^\/vi\/[a-zA-Z0-9_-]{11}\/(hqdefault|maxresdefault|mqdefault)\.jpg$/.test(u.pathname)?value:null;
};
export function normalizeCoverage(item){
 const all=[],keys=new Set();
 const add=(entry)=>{
  let url=typeof entry==="string"?entry:entry?.url;
  url=validLink(url);if(!url||keys.has(url))return;
  keys.add(url);
  const type=typeof entry==="object"&&["official","reporting","community","other"].includes(entry?.type)?entry.type:"other";
  all.push({url,label:String(entry?.label||new URL(url).hostname.replace(/^www\./,"")).slice(0,150),
    kind:type,note:String(entry?.note||"").slice(0,600)});
 };
 add({url:item.source_url,label:item.source_name||"Original report",type:item.source_kind||"official"});
 for(const s of (Array.isArray(item.coverage)?item.coverage:[]))add(s);
 for(const s of (Array.isArray(item.additional_sources)?item.additional_sources:[]))add(s);
 return all;
}
export function groupStories(items,now=Date.now()){
 const grouped=new Map();
 for(const item of Array.isArray(items)?items:[]){
  const key=eventId(item);if(!key)continue;
  if(!grouped.has(key))grouped.set(key,{...item,story_id:key,coverage:[],contributors:[],count:0});
  const parent=grouped.get(key);
  parent.contributors.push(item.id);
  parent.count++;
  // Preserve the leading editorial entry as canonical; merge source coverage and
  // secondary perspectives but don't invent a summary from unrelated headlines.
  parent.coverage.push(...normalizeCoverage(item));
  if(!parent.image_url&&safeImage(item.image_url)){parent.image_url=item.image_url;parent.image_alt=item.image_alt||"";}
  if((Number(item.relevance)||0)>(Number(parent.relevance)||0))parent.relevance=item.relevance;
  if((Number(item.urgency)||0)>(Number(parent.urgency)||0))parent.urgency=item.urgency;
 }
 const stories=[...grouped.values()];
 for(const story of stories){
  const seen=new Set();story.coverage=story.coverage.filter(x=>!seen.has(x.url)&&seen.add(x.url));
  story.ended=expired(story,now);
  story.image_url=safeImage(story.image_url);
 }
 stories.sort((a,b)=>Number(a.ended)-Number(b.ended)||
   (Number(b.relevance)||0)-(Number(a.relevance)||0)||
   (Number(b.urgency)||0)-(Number(a.urgency)||0)||
   String(b.source_date||b.discovered_ist||"").localeCompare(String(a.source_date||a.discovered_ist||"")));
 return stories;
}
export function findStory(items,id,now=Date.now()){
 return groupStories(items,now).find(s=>s.story_id===id)||null;
}
export function detailHref(id){
 return eventId({id})?"/story.html?id="+encodeURIComponent(id):null;
}
