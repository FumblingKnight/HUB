import {reconcile,validateVault} from "../core.mjs";
import {readMiraSignals} from "./mira-signals.mjs";
import {mediaEndpoint,MAX_IMAGE_BYTES} from "./github-media.mjs";
import {isAuthConfigured,passwordMatches,issueSession,verifySession,expiredSession} from "./session.mjs";

// Every route, including static assets, is fail-closed behind verified Cloudflare Access.
const json=(value,status=200,extraHeaders={})=>new Response(JSON.stringify(value),{status,headers:{
 "content-type":"application/json; charset=utf-8","cache-control":"no-store, private",
 "x-content-type-options":"nosniff",...extraHeaders}});
const error=(message,status=400)=>json({error:message},status);
function decode64(value){
 const x=atob(value.replace(/-/g,"+").replace(/_/g,"/"));
 return Uint8Array.from(x,c=>c.charCodeAt(0));
}
function utf8Base64(value){
 const bytes=new TextEncoder().encode(value);
 let s="";
 for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(s);
}
function repoApi(env){
 if(!/^[\w.-]+\/[\w.-]+$/.test(env.ATLAS_REPOSITORY||"")||!env.ATLAS_GITHUB_TOKEN)
   throw Error("Private GitHub repository or access token not configured");
 return "https://api.github.com/repos/"+env.ATLAS_REPOSITORY+"/contents/vault.json";
}
function githubHeaders(env){
 return {"authorization":"Bearer "+env.ATLAS_GITHUB_TOKEN,"accept":"application/vnd.github+json",
 "X-GitHub-Api-Version":"2022-11-28","user-agent":"Sajo-Atlas"};
}
async function readVault(env){
 const r=await fetch(repoApi(env),{headers:githubHeaders(env)});
 if(!r.ok)throw Error(r.status===404?"vault.json not found in private repository":"GitHub read failed: "+r.status);
 const file=await r.json();
 const graph=JSON.parse(new TextDecoder().decode(decode64(file.content.replace(/\s/g,""))));
 validateVault(graph);
 return {graph,sha:file.sha};
}
async function editVault(env,operation){
 for(let i=0;i<3;i++){
  const {graph,sha}=await readVault(env);
  const result=operation(graph);
  const headers={...githubHeaders(env),"content-type":"application/json"};
  const body=JSON.stringify({message:"ATLAS librarian: "+result.commit,
   content:utf8Base64(JSON.stringify(graph,null,2)+"\n"),sha});
  const r=await fetch(repoApi(env),{method:"PUT",headers,body});
  if(r.ok)return result.result;
  if(r.status!==409&&r.status!==422)throw Error("GitHub write failed: "+r.status);
 }
 throw Error("Concurrent vault updates; please retry");
}
async function api(req,env,url){
 if(!env.ATLAS_REPOSITORY||!env.ATLAS_GITHUB_TOKEN)
  return error("Private vault is not connected yet",503);
 if(url.pathname==="/api/mira/signals"&&req.method==="GET")
  return json(await readMiraSignals(env));
 if(url.pathname==="/api/config"&&req.method==="GET")
  return json({mediaEnabled:true,mediaBackend:"private-github",vaultConnected:true,limitImageBytes:MAX_IMAGE_BYTES});
 const media=await mediaEndpoint({request:req,env,url,readVault,editVault,json,error});
 if(media)return media;
 if(url.pathname==="/api/graph"&&req.method==="GET")
  return json((await readVault(env)).graph);
 if(url.pathname==="/api/inbox"&&req.method==="POST"||url.pathname==="/api/entity"&&req.method==="POST"){
  if(req.headers.get("origin")!==url.origin)return error("Cross-origin write blocked",403);
  if(!req.headers.get("content-type")?.startsWith("application/json"))return error("JSON required",415);
  if(Number(req.headers.get("content-length")||0)>12000)return error("Payload too large",413);
  const raw=await req.text();
  if(raw.length>12000)return error("Payload too large",413);
  const data=JSON.parse(raw);
  if(url.pathname==="/api/inbox"){
   if(typeof data.text!=="string"||!data.text.trim()||data.text.length>8000)
    return error("Note must be 1–8000 characters");
   const result=await editVault(env,graph=>{
    const record={id:crypto.randomUUID(),text:data.text.trim(),
     status:"unprocessed",source:"atlas-web",createdAt:new Date().toISOString()};
    graph.inbox.push(record);graph.updatedAt=record.createdAt;
    return {commit:"capture note",result:{queued:true,processed:false,id:record.id}};
   });
   return json(result,201);
  }
  if(!data.draft||typeof data.draft!=="object")return error("Structured draft required");
  const result=await editVault(env,graph=>{
   const value=reconcile(graph,data.draft,{confirmEntityId:data.confirmEntityId||null});
   return {commit:"reconcile page",result:value};
  });
  return json(result,result.action==="review"?202:200);
 }
 return error("Route not found",404);
}
const loginAssetPaths=new Set(["/login","/login.html","/login.css","/login.js"]);
const redirect=path=>new Response(null,{status:303,headers:{"location":path,"cache-control":"no-store"}});
function shield(result){
 const headers=new Headers(result.headers);
 headers.set("cache-control","private, no-store");
 headers.set("x-content-type-options","nosniff");
 headers.set("referrer-policy","no-referrer");
 headers.set("x-frame-options","DENY");
 headers.set("content-security-policy",
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 return new Response(result.body,{status:result.status,statusText:result.statusText,headers});
}
export default {async fetch(req,env){
 const url=new URL(req.url),path=url.pathname;
 // Only the three login assets are public. No vault data can leak through static files.
 if(req.method==="GET"&&loginAssetPaths.has(path)){
  const target=path==="/login"?"/login.html":path;
  return shield(await env.ASSETS.fetch(new Request(new URL(target,url.origin),{method:"GET"})));
 }
 if(path==="/auth/login"&&req.method==="POST"){
  if(!isAuthConfigured(env))return error("ATLAS login not yet configured",503);
  // A short password must never be checked without a cloud-side throttle.
  // Fail closed when binding is missing or unavailable.
  if(!env.LOGIN_LIMIT)return error("Login protection unavailable",503);
  try{
   const limit=await env.LOGIN_LIMIT.limit({key:"atlas-login-global"});
   if(!limit.success)return error("Too many login attempts. Try again in a minute.",429);
  }catch{return error("Login protection unavailable",503);}
  if(req.headers.get("origin")!==url.origin)return error("Cross-origin login blocked",403);
  if(!req.headers.get("content-type")?.startsWith("application/json"))return error("JSON required",415);
  if(Number(req.headers.get("content-length")||0)>600)return error("Login request too large",413);
  const raw=await req.text();if(raw.length>600)return error("Login request too large",413);
  let body;try{body=JSON.parse(raw);}catch{return error("Invalid request",400);}
  if(!await passwordMatches(body?.passphrase,env.ATLAS_LOGIN_PASSPHRASE))
   return error("Invalid passphrase",401);
  return json({authenticated:true},200,{"set-cookie":await issueSession(env.ATLAS_LOGIN_PASSPHRASE)});
 }
 if(path==="/auth/logout"&&req.method==="POST"){
  if(req.headers.get("origin")!==url.origin)return error("Cross-origin logout blocked",403);
  return json({loggedOut:true},200,{"set-cookie":expiredSession});
 }
 if(!isAuthConfigured(env))return error("ATLAS is locked until a login secret is configured",503);
 if(!await verifySession(req.headers.get("cookie"),env.ATLAS_LOGIN_PASSPHRASE))
  return path.startsWith("/api/")?error("Login required",401):redirect("/login");
 try{
  if(path.startsWith("/api/"))return await api(req,env,url);
  if(req.method!=="GET"&&req.method!=="HEAD")return error("Method not allowed",405);
  return shield(await env.ASSETS.fetch(req));
 }catch(e){return error(String(e?.message||"ATLAS request failed").slice(0,250),500);}
}};
