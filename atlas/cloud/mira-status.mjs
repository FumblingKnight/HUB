// Read-only, login-protected projection of Project Mira private execution state.
const MAX_BYTES=140_000;
const value=(x,n=240)=>String(x??"").slice(0,n);
export async function readMiraProjectStatus(env,fetcher=fetch){
 if(!/^[\w.-]+\/[\w.-]+$/.test(env?.ATLAS_REPOSITORY||"")||!env?.ATLAS_GITHUB_TOKEN)throw Error("Private project connection unavailable");
 const url="https://api.github.com/repos/"+env.ATLAS_REPOSITORY+"/contents/mira/state.json";
 const response=await fetcher(url,{headers:{authorization:"Bearer "+env.ATLAS_GITHUB_TOKEN,accept:"application/vnd.github+json","x-github-api-version":"2022-11-28","user-agent":"Sajo-Atlas-Mira"}});
 if(!response.ok)throw Error("Private project checkpoint fetch failed: "+response.status);
 const file=await response.json();
 if(file?.encoding!=="base64"||typeof file.content!=="string"||file.size>MAX_BYTES||file.content.length>MAX_BYTES*1.5)throw Error("Unsupported or large checkpoint");
 let state;
 try{
  const bytes=Uint8Array.from(atob(file.content.replace(/\s/g,"")),x=>x.charCodeAt(0));
  if(bytes.byteLength>MAX_BYTES)throw Error("Too large");
  state=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
 }catch{throw Error("Malformed private checkpoint");}
 if(state?.schema_version!==1||state.project!=="Mira"||!Array.isArray(state.milestones)||!Array.isArray(state.verified)||!Array.isArray(state.outstanding_user_approvals))throw Error("Unsupported Mira checkpoint format");
 return {
  schema_version:1,project:"Mira",updated_ist:value(state.updated_ist,45),checkpoint_status:value(state.checkpoint_status,200),
  milestones:state.milestones.slice(0,25).map(m=>({id:value(m.id,20),title:value(m.title,160),status:value(m.status,160)})),
  deferred_actions:state.outstanding_user_approvals.filter(x=>x.status==="pending_user_later").slice(0,24).map(x=>({id:value(x.id,20),task:value(x.task,450),status:value(x.status,60),required_now:Boolean(x.required_now)})),
  verified:state.verified.slice(-7).map(x=>({claim:value(x.claim,280),evidence:value(x.evidence,550)})),
  blocked_on_user:state.outstanding_user_approvals.some(x=>x.status==="pending_user_later"&&x.required_now===true),
  next_actions:(state.next_actions||[]).slice(0,8).map(x=>value(x,360)),
  caveat:"This page displays verified project records, not the actual status of a native ChatGPT thinking turn. Some milestones are awaiting a fresh independent test."
 };
}
