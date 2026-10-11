/**
 * Private R2 image handling. Called ONLY after Cloudflare Access JWT verification.
 * Image data is stored in R2; vault.json holds metadata and references, not base64.
 */
const LIMIT = 8 * 1024 * 1024;
const HEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function imageFormat(bytes){
 const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
 const starts = pattern => pattern.every((x,i)=>b[i]===x);
 if(b.length>=8&&starts([137,80,78,71,13,10,26,10]))
  return {mime:"image/png",ext:"png"};
 if(b.length>=3&&starts([255,216,255]))
  return {mime:"image/jpeg",ext:"jpg"};
 if(b.length>=12&&starts([82,73,70,70])&&[87,69,66,80].every((x,i)=>b[8+i]===x))
  return {mime:"image/webp",ext:"webp"};
 if(b.length>=6&&(String.fromCharCode(...b.subarray(0,6))==="GIF87a"||
                     String.fromCharCode(...b.subarray(0,6))==="GIF89a"))
  return {mime:"image/gif",ext:"gif"};
 return null;
}
export async function mediaEndpoint({request,env,url,readVault,editVault,json,error}){
 const path=url.pathname;
 if(path.startsWith("/api/media/")&&request.method==="GET"){
  if(!env.MEDIA)return error("Private media bucket not configured",503);
  const id=path.slice("/api/media/".length);
  if(!HEX.test(id))return error("Invalid image ID",400);
  const {graph}=await readVault(env);
  const entry=(graph.media||[]).find(m=>m.id===id);
  if(!entry)return error("Image not found",404);
  if(!["image/png","image/jpeg","image/webp","image/gif"].includes(entry.mime)||
     !["png","jpg","webp","gif"].includes(entry.ext)||
     entry.key!=="images/"+entry.id+"."+entry.ext)return error("Invalid stored image metadata",500);
  const object=await env.MEDIA.get(entry.key);
  if(!object)return error("Image missing from storage",404);
  const headers=new Headers({
   "content-type":entry.mime,
   "content-length":String(object.size),
   "cache-control":"private, no-store",
   "x-content-type-options":"nosniff",
   "content-security-policy":"default-src 'none'; sandbox",
   "content-disposition":'inline; filename="atlas-image.'+entry.ext+'"'
  });
  return new Response(object.body,{headers});
 }
 if(path!=="/api/media"||request.method!=="POST")return null;
 if(!env.MEDIA)return error("Private media bucket not configured",503);
 if(request.headers.get("origin")!==url.origin)return error("Cross-origin upload blocked",403);
 const length=Number(request.headers.get("content-length"));
 if(!Number.isSafeInteger(length)||length<=0||length>LIMIT)
  return error("Image must be between 1 byte and 8 MiB",413);
 const entityId=url.searchParams.get("entityId");
 if(!entityId||!HEX.test(entityId))return error("A valid page ID is required",400);
 const alt=(url.searchParams.get("alt")||"").trim();
 const caption=(url.searchParams.get("caption")||"").trim();
 if(alt.length>240||caption.length>700)return error("Image description too long",400);
 const current=await readVault(env);
 if(!current.graph.entities.some(e=>e.id===entityId))return error("Page does not exist",404);
 const bytes=new Uint8Array(await request.arrayBuffer());
 if(bytes.length!==length||bytes.length>LIMIT)return error("Incorrect image length",400);
 const format=imageFormat(bytes);
 if(!format)return error("Only PNG, JPEG, WebP and GIF images are allowed",415);
 if(request.headers.get("content-type")!==format.mime)
  return error("Image content type does not match file signature",415);
 const id=crypto.randomUUID();
 const key="images/"+id+"."+format.ext;
 await env.MEDIA.put(key,bytes,{httpMetadata:{contentType:format.mime}});
 try{
  return json(await editVault(env,graph=>{
   const page=graph.entities.find(e=>e.id===entityId);
   if(!page)throw Error("Page changed during upload");
   graph.media ||= [];
   page.media ||= [];
   const stamp=new Date().toISOString();
   graph.media.push({id,key,mime:format.mime,ext:format.ext,size:bytes.length,
     alt:alt||"Image associated with "+page.title,caption,entityIds:[entityId],
     createdAt:stamp,origin:"atlas-user-upload"});
   page.media.push(id);
   page.updatedAt=stamp;graph.updatedAt=stamp;
   graph.events.push({id:crypto.randomUUID(),entityId,
     type:"media-attached",at:stamp,summary:"Attached private image"});
   return {commit:"attach private image",result:{uploaded:true,id,entityId,size:bytes.length}};
  }),201);
 }catch(e){
  // GitHub writes can fail even after R2 succeeds. Do not retain unreferenced media.
  try{await env.MEDIA.delete(key);}catch{}
  throw e;
 }
}
