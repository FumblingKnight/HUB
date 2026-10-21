// Private watch liveness projection; only exposed through the authenticated ATLAS status endpoint.
const MAX_BYTES=12000;
function limit(v,n=200){return String(v??"").slice(0,n);}
export function assessWatchHealth(data, now=Date.now()){
 if(data?.schema_version!==1||data.component!=="mira_watch_official_sources"||
    !["healthy","degraded","failed"].includes(data.status))throw Error("Unsupported watch health data");
 const last=Date.parse(data.last_run_at||"");
 if(!Number.isFinite(last))throw Error("Invalid last check timestamp");
 const age=Math.max(0,Math.round((now-last)/60000));
 const stale=age>12*60 || last>now+10*60000;
 const status=stale?"stale":data.status;
 return {status,last_run_at:data.last_run_at,run_id:limit(data.run_id||"",24),
  age_minutes:age,stale,source_error_count:Array.isArray(data.source_errors)?data.source_errors.length:0,
  last_error:data.last_error?limit(data.last_error,160):null,
  new_candidates:Number.isInteger(data.new_candidates)?data.new_candidates:0,
  total_candidates:Number.isInteger(data.total_candidates)?data.total_candidates:null,
  explanation:stale?"Latest saved GitHub cloud check is too old to establish current health":
    status==="healthy"?"Latest GitHub cloud check completed without recorded source errors":
    status==="degraded"?"Cloud check completed with one or more upstream source errors":"Cloud check failed"};
}
export async function readMiraWatchHealth(env,fetcher=fetch, now=Date.now()){
 if(!/^[\w.-]+\/[\w.-]+$/.test(env?.ATLAS_REPOSITORY||"")||!env?.ATLAS_GITHUB_TOKEN)throw Error("Private watch health unavailable");
 const u="https://api.github.com/repos/"+env.ATLAS_REPOSITORY+"/contents/mira/watch/health.json";
 const r=await fetcher(u,{headers:{authorization:"Bearer "+env.ATLAS_GITHUB_TOKEN,
 accept:"application/vnd.github+json","x-github-api-version":"2022-11-28","user-agent":"Sajo-Atlas-Mira"}});
 if(!r.ok)throw Error("Private watch health read failed: "+r.status);
 const file=await r.json();
 if(file?.encoding!=="base64"||typeof file.content!=="string"||file.size>MAX_BYTES||file.content.length>MAX_BYTES*1.5)throw Error("Invalid watch health file");
 let data;
 try{
 const bytes=Uint8Array.from(atob(file.content.replace(/\s/g,"")),x=>x.charCodeAt(0));
 if(bytes.byteLength>MAX_BYTES)throw Error("Too large");
 data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
 }catch{throw Error("Malformed health file");}
 return assessWatchHealth(data,now);
}
