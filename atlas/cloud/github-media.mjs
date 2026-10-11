/**
 * Occasional small page images stored inside the existing PRIVATE GitHub vault.
 * No Cloudflare R2 billing and no browser-exposed GitHub credentials.
 */
export const MAX_IMAGE_BYTES=700000;
const IMAGE_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function imageFormat(bytes){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 const starts=a=>a.every((n,i)=>b[i]===n);
 if(b.length>=8&&starts([137,80,78,71,13,10,26,10]))return {mime:"image/png",ext:"png"};
 if(b.length>=3&&starts([255,216,255]))return {mime:"image/jpeg",ext:"jpg"};
 if(b.length>=12&&starts([82,73,70,70])&&[87,69,66,80].every((n,i)=>b[i+8]===n))
  return {mime:"image/webp",ext:"webp"};
 if(b.length>=6&&["GIF87a","GIF89a"].includes(String.fromCharCode(...b.subarray(0,6))))
  return {mime:"image/gif",ext:"gif"};
 return null;
}
function encode64(bytes){let s="";for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);}
function decode64(raw){return Uint8Array.from(atob(raw.replace(/\s/g,"")),c=>c.charCodeAt(0));}
const headers=env=>({Authorization:"Bearer "+env.ATLAS_GITHUB_TOKEN,
 Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28",
 "User-Agent":"ATLAS-private-media","content-type":"application/json"});
const urlFor=(env,path)=>"https://api.github.com/repos/"+env.ATLAS_REPOSITORY+"/contents/"+path;
export async function mediaEndpoint({request,env,url,readVault,editVault,json,error}){
 const path=url.pathname;
 if(path.startsWith("/api/media/")&&request.method==="GET"){
  const id=path.slice("/api/media/".length);
  if(!IMAGE_ID.test(id))return error("Invalid image ID",400);
  const {graph}=await readVault(env);
  const m=(graph.media||[]).find(x=>x.id===id);
  if(!m)return error("Image not found",404);
  if(!["png","jpg","webp","gif"].includes(m.ext)||
     !["image/png","image/jpeg","image/webp","image/gif"].includes(m.mime)||
     m.key!=="media/"+id+"."+m.ext)return error("Invalid stored image reference",500);
  const resp=await fetch(urlFor(env,m.key),{headers:headers(env)});
  if(!resp.ok)return error("Private image cannot be retrieved",502);
  const body=await resp.json();
  if(body.encoding!=="base64"||typeof body.content!=="string")return error("GitHub image cannot be read",502);
  const bytes=decode64(body.content);
  if(bytes.length>MAX_IMAGE_BYTES||imageFormat(bytes)?.mime!==m.mime)return error("Stored image invalid",502);
  return new Response(bytes,{headers:{"content-type":m.mime,"content-length":String(bytes.length),
   "cache-control":"private, no-store","x-content-type-options":"nosniff",
   "content-security-policy":"default-src 'none'; sandbox",
   "content-disposition":'inline; filename="atlas-image.'+m.ext+'"'}});
 }
 if(path!=="/api/media"||request.method!=="POST")return null;
 if(request.headers.get("origin")!==url.origin)return error("Cross-origin upload blocked",403);
 const len=Number(request.headers.get("content-length"));
 if(!Number.isSafeInteger(len)||len<1||len>MAX_IMAGE_BYTES)return error("Image exceeds 700 KB",413);
 const entityId=url.searchParams.get("entityId");
 if(!IMAGE_ID.test(entityId||""))return error("Valid page ID required",400);
 const alt=(url.searchParams.get("alt")||"").trim(),caption=(url.searchParams.get("caption")||"").trim();
 if(alt.length>240||caption.length>700)return error("Image description too long",400);
 const {graph}=await readVault(env);
 if(!graph.entities.some(e=>e.id===entityId))return error("Page does not exist",404);
 const bytes=new Uint8Array(await request.arrayBuffer());
 if(bytes.length!==len||bytes.length>MAX_IMAGE_BYTES)return error("Incorrect image length",400);
 const format=imageFormat(bytes);
 if(!format||format.mime!==request.headers.get("content-type"))return error("Invalid image format",415);
 const sha=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
 const sha256=Array.from(sha,b=>b.toString(16).padStart(2,"0")).join("");
 const duplicate=(graph.media||[]).find(m=>m.sha256===sha256);
 if(duplicate){
  return json(await editVault(env,v=>{
   const page=v.entities.find(e=>e.id===entityId),m=(v.media||[]).find(m=>m.id===duplicate.id);
   if(!page||!m)throw Error("Image or page changed");
   page.media ||= [];m.entityIds ||= [];
   if(!page.media.includes(m.id))page.media.push(m.id);
   if(!m.entityIds.includes(entityId))m.entityIds.push(entityId);
   page.updatedAt=v.updatedAt=new Date().toISOString();
   return {commit:"reuse private media",result:{uploaded:true,reused:true,id:m.id,entityId,size:m.size}};
  }),200);
 }
 const id=crypto.randomUUID(),key="media/"+id+"."+format.ext;
 const uploaded=await fetch(urlFor(env,key),{method:"PUT",headers:headers(env),
  body:JSON.stringify({message:"ATLAS: save private page image",content:encode64(bytes)})});
 if(!uploaded.ok)throw Error("GitHub image upload failed ("+uploaded.status+")");
 const obj=await uploaded.json();
 try{
  const result=await editVault(env,v=>{
   const page=v.entities.find(e=>e.id===entityId);
   if(!page)throw Error("Page changed during upload");
   v.media ||= [];page.media ||= [];
   const stamp=new Date().toISOString();
   v.media.push({id,key,sha256,mime:format.mime,ext:format.ext,size:bytes.length,
    alt:alt||"Image associated with "+page.title,caption,entityIds:[entityId],createdAt:stamp,origin:"atlas-web"});
   page.media.push(id);page.updatedAt=v.updatedAt=stamp;
   v.events.push({id:crypto.randomUUID(),entityId,type:"media-attached",at:stamp,summary:"Attached private GitHub image"});
   return {commit:"attach private image",result:{uploaded:true,reused:false,id,entityId,size:bytes.length}};
  });
  return json(result,201);
 }catch(e){
  try{if(obj.content?.sha)await fetch(urlFor(env,key),{method:"DELETE",headers:headers(env),
    body:JSON.stringify({message:"ATLAS: remove orphan image",sha:obj.content.sha})});}catch{}
  throw e;
 }
}
