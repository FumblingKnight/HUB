// Session-protected private reviewed narrative cards. Never call before Mira auth.
// Public code, private GitHub data. No raw copyrighted reviews or credentials reach the browser.
const PATH="mira/media-index/story-service/narrative-cards.json";
const MAX_BYTES=260_000;
const trim=(x,n=300)=>typeof x==="string"?x.slice(0,n):"";
const https=value=>{
 try {const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password&&u.pathname!=="/"?u.href:null;}
 catch{return null;}
};
export async function readReviewedMediaClaims(env,malId,through,fetcher=fetch){
 if(!Number.isInteger(malId)||malId<1||malId>1000000||!Number.isInteger(through)||through<1||through>2000)
  throw Error("Invalid story scope");
 if(!/^[\w.-]+\/[\w.-]+$/.test(env?.ATLAS_REPOSITORY||"")||!env?.ATLAS_GITHUB_TOKEN)
  throw Error("Private source not configured");
 const url="https://api.github.com/repos/"+env.ATLAS_REPOSITORY+"/contents/"+PATH;
 const r=await fetcher(url,{headers:{"authorization":"Bearer "+env.ATLAS_GITHUB_TOKEN,
   "accept":"application/vnd.github+json","x-github-api-version":"2022-11-28",
   "user-agent":"Sajo-Mira-Media"}});
 if(r.status===404)return [];
 if(!r.ok)throw Error("Private evidence read unavailable");
 const f=await r.json();
 if(f.encoding!=="base64"||!f.content||!Number.isInteger(f.size)||f.size>MAX_BYTES||
    f.content.length>MAX_BYTES*1.5)throw Error("Invalid private evidence envelope");
 const bytes=Uint8Array.from(atob(f.content.replace(/\s/g,"")),c=>c.charCodeAt(0));
 if(bytes.length>MAX_BYTES)throw Error("Oversized evidence data");
 const cards=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
 if(!Array.isArray(cards)||cards.length>700)throw Error("Invalid evidence schema");
 const key="https://myanimelist.net/anime/"+malId;
 const hits=[];
 for(const c of cards){
  if(!Array.isArray(c)||c.length!==10||c[0]!=="anime"||c[1]!==key||c[4]!=="episode")continue;
  const [medium,work,title,season,unit,start,end,facet,statement,sources]=c;
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||end>through||
     typeof statement!=="string"||!Array.isArray(sources))continue;
  const proof=sources.slice(0,8).filter(x=>Array.isArray(x)&&x.length===6&&https(x[1])&&
      ["supports","refutes"].includes(x[3])).map(x=>({
      provider:trim(x[0],100),url:https(x[1]),kind:trim(x[2],50),stance:x[3],
      retrieved:trim(x[4],25),note:trim(x[5],250)}));
  if(!proof.length)continue;
  const stances=new Set(proof.map(x=>x.stance));
  hits.push({title:trim(title,160),work,facet:trim(facet,35),
    claim:trim(statement,500),scope:{season,start_episode:start,end_episode:end},
    status:stances.size>1?"CONTESTED":stances.has("refutes")?"REFUTED_IN_SCOPE":"SUPPORTED_IN_SCOPE",
    evidence:proof,confidence:"attributed official/distributor description; not whole-series centrality"});
 }
 return hits.slice(0,40);
}
