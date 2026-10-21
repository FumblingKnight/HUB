// Server-side read only access to private Mira source-linked discoveries.
// Only call this function AFTER ATLAS session authentication.
const MAX_CONTENT_BYTES=320_000;
export async function readMiraSignals(env,fetcher=fetch){
 if(!/^[\w.-]+\/[\w.-]+$/.test(env?.ATLAS_REPOSITORY||'')||!env?.ATLAS_GITHUB_TOKEN)
  throw Error('Private Mira source is not connected');
 const url='https://api.github.com/repos/'+env.ATLAS_REPOSITORY+'/contents/mira/signals.json';
 const response=await fetcher(url,{headers:{authorization:'Bearer '+env.ATLAS_GITHUB_TOKEN,accept:'application/vnd.github+json','x-github-api-version':'2022-11-28','user-agent':'Sajo-Atlas-Mira'}});
 if(!response.ok)throw Error('Private Mira read failed: '+response.status);
 const envelope=await response.json();
 if(!envelope||envelope.encoding!=='base64'||typeof envelope.content!=='string'||envelope.size>MAX_CONTENT_BYTES||envelope.content.length>MAX_CONTENT_BYTES*1.5)
  throw Error('Invalid or oversized private Mira response');
 let raw;
 try{
  const value=atob(envelope.content.replace(/\s/g,''));
  const bytes=Uint8Array.from(value,x=>x.charCodeAt(0));
  if(bytes.byteLength>MAX_CONTENT_BYTES)throw Error('Oversized decoded Mira response');
  raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }catch{throw Error('Malformed Mira signals file');}
 if(raw?.schema_version!==1||!Array.isArray(raw.items)||!Array.isArray(raw.watched_topics)||raw.items.length>2000)
  throw Error('Unsupported Mira signals schema');
 const items=raw.items.map(item=>{
  if(typeof item?.id!=='string'||typeof item?.title!=='string'||typeof item?.source_url!=='string')throw Error('Invalid Mira item');
  const u=new URL(item.source_url);
  if(u.protocol!=='https:'||u.username||u.password)throw Error('Unsafe Mira source URL');
  const checkUrl=(raw)=>{if(typeof raw!=='string')return null;try{const v=new URL(raw);return v.protocol==='https:'&&!v.username&&!v.password?v.href:null;}catch{return null;}};
  const cleanCoverage=Array.isArray(item.coverage)?item.coverage.slice(0,20).filter(x=>x&&typeof x==='object'&&checkUrl(x.url)).map(x=>({
    url:checkUrl(x.url),label:String(x.label||new URL(x.url).hostname).slice(0,150),
    type:['official','reporting','community','other'].includes(x.type)?x.type:'other',note:String(x.note||'').slice(0,600)
  })):[];
  const extra=Array.isArray(item.additional_sources)?item.additional_sources.slice(0,20).map(checkUrl).filter(Boolean):[];
  const image=checkUrl(item.image_url);
  const imageUrl=image&&new URL(image).hostname==='i.ytimg.com'&&/^\/vi\/[a-zA-Z0-9_-]{11}\/(hqdefault|maxresdefault|mqdefault)\.jpg$/.test(new URL(image).pathname)?image:null;
  const bulletList=Array.isArray(item.key_points)?item.key_points.slice(0,8).map(x=>String(x).slice(0,350)):[];
  return {id:item.id.slice(0,140),story_id:/^[a-z0-9][a-z0-9_-]{1,139}$/i.test(String(item.story_id||''))?item.story_id:item.id.slice(0,140),
    topic_id:/^[a-z0-9][a-z0-9_-]{1,139}$/i.test(String(item.topic_id||''))?item.topic_id:null,
    source_kind:['official','reporting','community','other'].includes(item.source_kind)?item.source_kind :'other',
    coverage:cleanCoverage,additional_sources:extra,key_points:bulletList,
    why_it_matters:String(item.why_it_matters||'').slice(0,1500),
    background:String(item.background||'').slice(0,2400),
    community_note:String(item.community_note||'').slice(0,1100),
    image_url:imageUrl,image_alt:String(item.image_alt||'').slice(0,170),title:item.title.slice(0,250),category:String(item.category||'other').slice(0,50),summary:String(item.summary||'').slice(0,1600),source_name:String(item.source_name||'Source').slice(0,140),source_url:u.href,source_date:item.source_date||null,event_date:item.event_date||null,discovered_ist:item.discovered_ist||null,urgency:Math.max(0,Math.min(3,Number(item.urgency)||0)),relevance:Math.max(0,Math.min(3,Number(item.relevance)||0)),confidence:String(item.confidence||'unknown').slice(0,100),action:String(item.action||'').slice(0,900),status:String(item.status||'').slice(0,40),expires_at:typeof item.expires_at==='string'&&Number.isFinite(Date.parse(item.expires_at))?item.expires_at:null};
 });
 return {schema_version:1,title:'Mira Signals',updated_ist:raw.updated_ist||null,last_watch_run:raw.last_watch_run||null,items};
}
