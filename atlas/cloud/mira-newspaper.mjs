// Mira Newspaper: private-GitHub-backed, Cloudflare-session-protected publication.
const ROOT="mira/newspaper/";
const MAX=650_000;
const safeUrl=value=>{
 try{const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}
};
function githubHeaders(env){return {
 "authorization":"Bearer "+env.ATLAS_GITHUB_TOKEN,
 "accept":"application/vnd.github+json",
 "x-github-api-version":"2022-11-28",
 "user-agent":"Mira-Newspaper"
};}
function base(env){
 if(!/^[\w.-]+\/[\w.-]+$/.test(env?.ATLAS_REPOSITORY||"")||!env?.ATLAS_GITHUB_TOKEN)
  throw Error("Private newspaper backend not configured");
 return "https://api.github.com/repos/"+env.ATLAS_REPOSITORY+"/contents/"+ROOT;
}
function decodeBase64(encoded){
 const bin=atob(encoded.replace(/\s/g,""));
 const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
 return new TextDecoder("utf-8",{fatal:true}).decode(bytes);
}
function encodeBase64(value){
 const bytes=new TextEncoder().encode(value);
 let s="";for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(s);
}
async function getFile(env,path,fetcher=fetch){
 const r=await fetcher(base(env)+path,{headers:githubHeaders(env)});
 if(r.status===404)return null;
 if(!r.ok)throw Error("Newspaper read error "+r.status);
 const f=await r.json();
 if(f.encoding!=="base64"||f.size>MAX||!f.content||f.content.length>MAX*1.6)
  throw Error("Oversized or invalid newspaper file");
 const value=JSON.parse(decodeBase64(f.content));
 return {value,sha:f.sha};
}
function sanitizeFeedback(value){
 const result={};
 if(!value||typeof value!=="object"||Array.isArray(value))return result;
 for(const [id,f] of Object.entries(value).slice(-500)){
  if(!/^[a-z0-9-]{1,100}$/.test(id)||!f||typeof f!=="object")continue;
  result[id]={vote:["up","down"].includes(f.vote)?f.vote:"",
    following:f.following===true,hidden:f.hidden===true,
    note:typeof f.note==="string"?f.note.slice(0,200):""};
 }
 return result;
}
function sanitizeNews(value){
 if(!value||value.schema_version!==1||!Array.isArray(value.stories)||!Array.isArray(value.wire))throw Error("Invalid newspaper schema");
 if(value.stories.length>250||value.wire.length>120)throw Error("Oversized newspaper collection");
 const safe=value.stories.filter(x=>x&&typeof x==="object"&&safeUrl(x.url)&&typeof x.id==="string").map(x=>({
   ...x, url:x.url, discussion_url:safeUrl(x.discussion_url)?x.discussion_url:"",
   note:undefined,vote:undefined,following:undefined,hidden:undefined
 }));
 const wire=value.wire.filter(x=>x&&typeof x==="object"&&safeUrl(x.url)).slice(0,120);
 return {schema_version:1,stories:safe,wire,
  searched:Array.isArray(value.searched)?value.searched.slice(0,70):[],
  watch:Array.isArray(value.watch)?value.watch.slice(0,50):[],
  stats:value.stats&&typeof value.stats==="object"?value.stats:{},
  morning:value.morning&&typeof value.morning==="object"?value.morning:null,
  published_at:typeof value.published_at==="string"?value.published_at:null};
}
export async function readNewspaper(env,fetcher=fetch){
 const [published,feedback]=await Promise.all([getFile(env,"current.json",fetcher),getFile(env,"feedback.json",fetcher)]);
 if(!published)return {schema_version:1,stories:[],wire:[],searched:[],watch:[],stats:{},morning:null,published_at:null};
 const news=sanitizeNews(published.value),votes=sanitizeFeedback(feedback?.value);
 news.stories=news.stories.map(s=>({...s, ...votes[s.id]}));
 return news;
}
export async function updateNewspaperFeedback(req,env,url,fetcher=fetch){
 if(req.headers.get("origin")!==url.origin)return new Response("Origin forbidden",{status:403});
 if(!req.headers.get("content-type")?.startsWith("application/json"))return new Response("JSON required",{status:415});
 const length=Number(req.headers.get("content-length")||"0");
 if(length>1600)return new Response("Payload too large",{status:413});
 const raw=await req.text();
 if(raw.length>1600)return new Response("Payload too large",{status:413});
 let data;try{data=JSON.parse(raw);}catch{return new Response("Invalid JSON",{status:400});}
 const id=data?.id;
 if(typeof id!=="string"||!/^[a-z0-9-]{1,100}$/.test(id)||
    (data.vote!==undefined&&!["up","down",""].includes(data.vote))||
    (data.note!==undefined&&(typeof data.note!=="string"||data.note.length>200))||
    (data.following!==undefined&&typeof data.following!=="boolean")||
    (data.hidden!==undefined&&typeof data.hidden!=="boolean"))
  return new Response("Invalid feedback",{status:400});
 const published=await getFile(env,"current.json",fetcher);
 if(!published||!sanitizeNews(published.value).stories.some(s=>s.id===id))
  return new Response("Unknown story",{status:404});
 for(let attempt=0;attempt<3;attempt++){
  const file=await getFile(env,"feedback.json",fetcher);
  const value=sanitizeFeedback(file?.value);
  value[id]={...value[id],...(data.vote===undefined?{}:{vote:data.vote}),
   ...(data.following===undefined?{}:{following:data.following}),
   ...(data.hidden===undefined?{}:{hidden:data.hidden}),
   ...(data.note===undefined?{}:{note:data.note})};
  const body={message:"Mira newspaper: save reader feedback",content:encodeBase64(JSON.stringify(value,null,2)+"\n")};
  if(file?.sha)body.sha=file.sha;
  const r=await fetcher(base(env)+"feedback.json",{method:"PUT",headers:{...githubHeaders(env),"content-type":"application/json"},body:JSON.stringify(body)});
  if(r.ok)return Response.json({ok:true,feedback:value[id]},{headers:{"cache-control":"no-store"}});
  if(r.status!==409&&r.status!==422)throw Error("Private feedback write failed "+r.status);
 }
 return new Response("Feedback conflict; retry",{status:409});
}
