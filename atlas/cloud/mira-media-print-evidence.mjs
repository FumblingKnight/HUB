// Session-protected, prebuilt chapter evidence in the private Mira repository.
// Never called before existing /api/mira/story authentication. No raw manga
// chapters, no live third-party scraping and no automatic source updates.
const PATH="mira/media-index/story-service/community-arc-cards.json";
const MAX_BYTES=220_000;
const MEDIUM=new Set(["manga","manhwa","manhua","novel"]);
const str=(x,n=300)=>typeof x==="string"?x.slice(0,n):"";
const validUrl=(x)=>{
 try{const u=new URL(x);return u.protocol==="https:"&&!u.username&&!u.password&&
   ["fabledex.com","www.fabledex.com","blue-box.fandom.com",
    "mairimashita-irumakun.fandom.com"].includes(u.hostname)&&u.pathname!=="/"?u.href:null;}
 catch{return null;}
};
export async function readPrintCommunityEvidence(env,{work,medium,chapters,since=1},fetcher=fetch){
 if(!/^mangabaka:[1-9]\d{0,7}$/.test(work||"")||!MEDIUM.has(medium)||
    !Number.isInteger(chapters)||chapters<1||chapters>10000||
    !Number.isInteger(since)||since<1||since>chapters)throw Error("Invalid chapter identity or cutoff");
 if(!/^[\w.-]+\/[\w.-]+$/.test(env?.ATLAS_REPOSITORY||"")||!env?.ATLAS_GITHUB_TOKEN)
    throw Error("Private source not configured");
 const endpoint="https://api.github.com/repos/"+env.ATLAS_REPOSITORY+"/contents/"+PATH;
 const r=await fetcher(endpoint,{headers:{
  authorization:"Bearer "+env.ATLAS_GITHUB_TOKEN,
  accept:"application/vnd.github+json",
  "x-github-api-version":"2022-11-28",
  "user-agent":"Sajo-Mira-PrintEvidence"}});
 if(!r.ok)throw Error(r.status===404?"Print corpus unavailable":"Private print evidence read failed");
 const envelope=await r.json();
 if(envelope.encoding!=="base64"||!Number.isInteger(envelope.size)||envelope.size>MAX_BYTES||
    typeof envelope.content!=="string"||envelope.content.length>MAX_BYTES*1.5)
  throw Error("Invalid private print corpus envelope");
 const bytes=Uint8Array.from(atob(envelope.content.replace(/\s/g,"")),x=>x.charCodeAt(0));
 if(bytes.length>MAX_BYTES)throw Error("Private print corpus too large");
 const data=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
 if(!Array.isArray(data)||data.length>1000)throw Error("Invalid print corpus");
 const observations=[];
 let sourceRows=0;
 for(const c of data){
  if(!Array.isArray(c)||c.length!==10||c[0]!==medium||c[1]!==work||c[4]!=="chapter")continue;
  const [kind,id,title,season,unit,start,end,facet,claim,sources]=c;
  if(season!==null||!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||
     end>chapters||end<since||typeof claim!=="string"||!Array.isArray(sources))continue;
  const proof=sources.slice(0,8).filter(x=>
    Array.isArray(x)&&x.length===6&&x[2]==="community_arc"&&
    ["supports","refutes"].includes(x[3])&&validUrl(x[1])
   ).map(x=>({provider:str(x[0],80),url:validUrl(x[1]),kind:"community_arc",
      stance:x[3],retrieved:str(x[4],25),note:str(x[5],320)}));
  if(!proof.length)continue;
  const stances=new Set(proof.map(x=>x.stance));
  const status=stances.size>1?"CONTESTED":stances.has("refutes")?
    "PROVISIONAL_REFUTED_IN_SCOPE":"PROVISIONAL_IN_SCOPE";
  observations.push({title:str(title,160),facet:str(facet,35),claim:str(claim,300),
    chapter_start:start,chapter_end:end,status,
    confidence:"Community-reported, not independently verified",
    sources:proof});
  sourceRows+=proof.length;
 }
 observations.sort((a,b)=>a.chapter_start-b.chapter_start||a.facet.localeCompare(b.facet));
 return {status:"evidence_only",work,medium,chapters,since_chapter:since,
    observations:observations.slice(0,100),
    coverage:{observations:observations.length,source_links:sourceRows},
    series_wide_centrality:"NOT_ESTABLISHED",
    limitations:"Chapter-bounded community testimony, not official or independently verified chapter reading. Only entire arc spans ending within the spoiler cutoff are returned. Source links themselves may contain spoilers."};
}
