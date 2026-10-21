// Read-only projection of private GitHub Work task ownership. A claim is NOT GPT run liveness.
const LIMIT=24000;
const safe=(v,n)=>String(v??"").slice(0,n);
export function projectWorkClaim(data){
 if(data?.schema_version!==1||data.protocol!=="mira-work-claim-v1"||!["idle","active"].includes(data.status))throw Error("Unsupported Mira Work claim");
 const last=Array.isArray(data.completion_history)&&data.completion_history.length?data.completion_history[data.completion_history.length-1]:null;
 if(data.status==="active"&&(typeof data.active_run!=="string"||!data.active_run))throw Error("Active claim missing owner");
 return {
  status:data.status,
  active_pr:Number.isSafeInteger(data.active_pr)&&data.active_pr>0?data.active_pr:null,
  active_run:data.status==="active"?safe(data.active_run,100):null,
  acquired_at:data.status==="active"?safe(data.acquired_at,45):null,
  completed_at:data.status==="idle"?safe(data.completed_at,45):null,
  last_result:last?{
    pr:Number.isSafeInteger(last.pr)&&last.pr>0?last.pr:null,
    outcome:safe(last.outcome,35),
    completed_at:safe(last.completed_at,45),
    result_path:safe(last.result_path,180)
  }:null,
  caveat:"This is a cooperative GitHub ownership claim, not a native ChatGPT execution-status or restart API."
 };
}
export async function readMiraWorkClaim(env,fetcher=fetch){
 if(!/^[\w.-]+\/[\w.-]+$/.test(env?.ATLAS_REPOSITORY||"")||!env?.ATLAS_GITHUB_TOKEN)throw Error("Private Work connection missing");
 const u="https://api.github.com/repos/"+env.ATLAS_REPOSITORY+"/contents/mira/work/claim.json";
 const r=await fetcher(u,{headers:{authorization:"Bearer "+env.ATLAS_GITHUB_TOKEN,
  accept:"application/vnd.github+json","x-github-api-version":"2022-11-28","user-agent":"Sajo-Atlas-Mira"}});
 if(!r.ok)throw Error("Private Work claim read failed: "+r.status);
 const envelope=await r.json();
 if(envelope?.encoding!=="base64"||typeof envelope.content!=="string"||
    envelope.size>LIMIT||envelope.content.length>LIMIT*1.5)throw Error("Invalid Work claim blob");
 let data;
 try{
  const bytes=Uint8Array.from(atob(envelope.content.replace(/\s/g,"")),x=>x.charCodeAt(0));
  if(bytes.byteLength>LIMIT)throw Error("Oversized claim");
  data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
 }catch{throw Error("Unreadable Work claim");}
 return projectWorkClaim(data);
}
