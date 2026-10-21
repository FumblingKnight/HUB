// Private World Radar API: requests and health for code-based GitHub event searches.
// No AI is called by this endpoint, and staged candidates are explicitly unreviewed.
const REPO="FumblingKnight/Sajo-Atlas",ROOT="https://api.github.com/repos/"+REPO+"/contents/";
const REQUEST="mira/radar/request.json",STATUS="mira/radar/status.json",CANDIDATES="mira/radar/candidates.json";
const HEADERS=token=>({authorization:"Bearer "+token,accept:"application/vnd.github+json","x-github-api-version":"2022-11-28","user-agent":"Mira-World-Radar-UI"});
const MAX_BYTES=390_000,COOLDOWN_MS=15*60*1000;
const compact=(v,n=200)=>String(v??"").replace(/[\u0000-\u001f]+/g," ").trim().slice(0,n);
const safeUrl=raw=>{try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password?u.href:null;}catch{return null;}};
function safeConfig(env){
 if(env?.ATLAS_REPOSITORY!==REPO||!env?.ATLAS_GITHUB_TOKEN)throw Error("World Radar private connection unavailable");
 return env.ATLAS_GITHUB_TOKEN;
}
async function getBlob(token,path,fetcher){
 const r=await fetcher(ROOT+path,{headers:HEADERS(token)});
 if(r.status===404)return {sha:null,data:null};
 if(!r.ok)throw Error("Radar source inaccessible ("+r.status+")");
 const item=await r.json();
 if(!item?.sha||item?.encoding!=="base64"||typeof item.content!=="string"||item.size>MAX_BYTES||item.content.length>MAX_BYTES*1.5)throw Error("Invalid radar file");
 let data;
 try{const bytes=Uint8Array.from(atob(item.content.replace(/\s/g,"")),x=>x.charCodeAt(0));if(bytes.length>MAX_BYTES)throw Error();
 data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));}catch{throw Error("Radar metadata malformed");}
 return {sha:item.sha,data};
}
export function projectDiscovery({status=null,request=null,candidates=null,now=Date.now()}={}){
 const validStatus=status?.schema_version===1&&status?.component==="mira_world_radar"&&
  ["healthy","degraded","failed"].includes(status.status)?status:null;
 const validRequest=request?.schema_version===1&&request?.component==="mira_radar_refresh"?request:null;
 const items=candidates?.schema_version===1&&Array.isArray(candidates.candidates)?candidates.candidates:[];
 const requestAt=validRequest?.requested_at||null;
 const scanAt=validStatus?.last_run_at||null;
 const age=requestAt?now-Date.parse(requestAt):Infinity;
 const pending=Boolean(requestAt&&(Date.parse(scanAt||"")||0)<Date.parse(requestAt)&&age>=0&&age<45*60*1000);
 return {schema_version:1,scan:{
   status:validStatus?.status||"not_verified",last_run_at:scanAt,run_id:validStatus?.run_id||null,
   sources_ok:Number.isInteger(validStatus?.sources_ok)?validStatus.sources_ok:null,
   sources_total:Number.isInteger(validStatus?.sources_total)?validStatus.sources_total:null,
   new_candidates:Number.isInteger(validStatus?.new_candidates)?validStatus.new_candidates:null,
   total_candidates:Number.isInteger(validStatus?.total_candidates)?validStatus.total_candidates:null,
   source_checks:Array.isArray(validStatus?.source_checks)?validStatus.source_checks.slice(0,10).map(x=>({
    source:compact(x.source,70),status:x.status==="ok"?"ok":"error",candidates:Number(x.candidates)||0
   })):[]},
   refresh:{requested_at:requestAt,pending,request_id:validRequest?.request_id||null},
   // This is a SOURCE LEAD inbox, not a curated/fact-checked news feed.
   leads:items.slice(0,70).filter(x=>x.status==="unreviewed"&&safeUrl(x.source_url)).slice(0,24).map(x=>({
    id:compact(x.id,120),title:compact(x.title,240),summary:compact(x.summary,380),
    category:compact(x.category,45),source_name:compact(x.source_name,90),
    source_url:safeUrl(x.source_url),published_at:compact(x.published_at,45),
    confidence:"Unreviewed lead — verify original reporting"
   }))
 };
}
export async function readDiscovery(env,fetcher=fetch){
 const token=safeConfig(env);
 const [status,request,candidates]=await Promise.all([
  getBlob(token,STATUS,fetcher).catch(()=>({data:null})),
  getBlob(token,REQUEST,fetcher).catch(()=>({data:null})),
  getBlob(token,CANDIDATES,fetcher).catch(()=>({data:null}))
 ]);
 return projectDiscovery({status:status.data,request:request.data,candidates:candidates.data});
}
export async function queueDiscovery(env,{fetcher=fetch,now=new Date().toISOString()}={}){
 const token=safeConfig(env);if(!Number.isFinite(Date.parse(now)))throw Error("Invalid request date");
 for(let attempt=0;attempt<3;attempt++){
  const old=await getBlob(token,REQUEST,fetcher);
  const previous=Date.parse(old.data?.requested_at||"");
  if(Number.isFinite(previous)&&Date.parse(now)-previous<COOLDOWN_MS&&Date.parse(now)>=previous){
   return {queued:true,reused:true,requested_at:old.data.requested_at,
    explanation:"A discovery scan has already been requested recently."};
  }
  const id="manual-"+now.replace(/[^0-9]/g,"").slice(0,16);
  const data={schema_version:1,component:"mira_radar_refresh",request_id:id,
   requested_at:now,requested_by:"signed_in_atlas_viewer",status:"queued_code_scan",ai_started:false};
  const body={message:"Mira Radar: signed-in reader requested new public-source scan",content:btoa(unescape(encodeURIComponent(JSON.stringify(data,null,2)+"\n")))};
  if(old.sha)body.sha=old.sha;
  const r=await fetcher(ROOT+REQUEST,{method:"PUT",headers:{...HEADERS(token),"content-type":"application/json"},body:JSON.stringify(body)});
  if(r.ok)return {queued:true,reused:false,requested_at:now,
   explanation:"GitHub request committed; the radar job will search public feeds and save new leads."};
  if(r.status!==409&&r.status!==422)throw Error("Radar refresh not accepted by GitHub ("+r.status+")");
 }
 throw Error("Concurrent refresh requests; please retry shortly");
}
