// Single-user password authentication. No Cloudflare Access or third-party identity provider.
const enc=new TextEncoder();
const lifetime=7*24*60*60;
const encode=bytes=>{
 let s="";for(const b of bytes)s+=String.fromCharCode(b);
 return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
};
const decode=s=>{
 if(!/^[A-Za-z0-9_-]+$/.test(s))throw Error("Bad token");
 return Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
};
// Keep existing long passphrases valid; allow the user's shorter 9-character
// letter+number+symbol choice, protected by a Worker rate-limit binding.
const good=s=>typeof s==="string"&&s.length>=9&&s.length<=4096&&
  (s.length>=24||(/[A-Za-z]/.test(s)&&/[0-9]/.test(s)&&/[^A-Za-z0-9]/.test(s)));
export const isAuthConfigured=env=>good(env.ATLAS_LOGIN_PASSPHRASE);
const digest=async s=>new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s)));
async function signingKey(secret){
 const key=await digest("atlas:v1:cookie-signing:"+secret);
 return crypto.subtle.importKey("raw",key,{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
export async function passwordMatches(candidate,secret){
 if(!good(secret)||typeof candidate!=="string"||candidate.length>4096)return false;
 const [a,b]=await Promise.all([digest("atlas:v1:password:"+candidate),digest("atlas:v1:password:"+secret)]);
 let diff=0;for(let i=0;i<b.length;i++)diff|=a[i]^b[i];
 return diff===0;
}
export async function issueSession(secret,now=Date.now()){
 if(!good(secret))throw Error("Auth not configured");
 const payload="v1:"+(Math.floor(now/1000)+lifetime)+":"+crypto.randomUUID();
 const data=encode(enc.encode(payload));
 const signature=encode(new Uint8Array(await crypto.subtle.sign("HMAC",await signingKey(secret),enc.encode(data))));
 return "atlas_session="+data+"."+signature+"; Path=/; Max-Age="+lifetime+"; HttpOnly; Secure; SameSite=Strict";
}
export async function verifySession(header,secret,now=Date.now()){
 if(!good(secret)||typeof header!=="string")return false;
 const item=header.split(";").map(s=>s.trim()).find(s=>s.startsWith("atlas_session="));
 if(!item)return false;
 const token=item.slice("atlas_session=".length);
 if(token.length>1000)return false;
 const parts=token.split(".");
 if(parts.length!==2)return false;
 try{
  const content=new TextDecoder().decode(decode(parts[0]));
  const match=/^v1:(\d{10}):([0-9a-f-]{36})$/.exec(content);
  if(!match)return false;
  const exp=Number(match[1]),t=Math.floor(now/1000);
  if(!Number.isSafeInteger(exp)||exp<=t||exp>t+lifetime)return false;
  return crypto.subtle.verify("HMAC",await signingKey(secret),decode(parts[1]),enc.encode(parts[0]));
 }catch{return false;}
}
export const expiredSession="atlas_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict";
