import {printThemes} from "./mira-print-themes.mjs";
// Read-only, session-protected story retrieval. Call ONLY after ATLAS session verification.
// AAR is a separate pre-indexed third-party engine; results are source assertions, not verified plot facts.
const ROOT = "https://api.aarecords.tech";
const KEY = "aar_free_access"; // Published public free-access evaluation key, not a private secret.
const MEDIUM = new Set(["anime", "manga", "manhwa", "manhua", "novel", "light_novel", "visual_novel"]);
const safeString = (v,n=200) => typeof v==="string"?v.slice(0,n):"";
const safeUrl = value => {
  try { const u=new URL(value);return u.protocol==="https:"&&!u.username&&!u.password?u.href:null; }
  catch { return null; }
};
const num = (v,def,min,max) => {
  if(v===null||v==="") return def;
  const x=Number(v);return Number.isInteger(x)&&x>=min&&x<=max?x:null;
};
const result=(body,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"private, no-store",
                  "x-content-type-options":"nosniff"}
});
function validate(url){
  const q=url.searchParams.get("q")?.trim()||"";
  const mode=url.searchParams.get("mode")||"discover";
  const medium=url.searchParams.get("medium")||"";
  const limit=num(url.searchParams.get("limit"),8,1,12);
  const through=num(url.searchParams.get("through"),0,0,2000);
  const mal=num(url.searchParams.get("mal"),null,1,1000000);
  if(!["discover","episodes","arcs","print-themes"].includes(mode)||limit===null||through===null||
     (medium&&!MEDIUM.has(medium)))throw Error("Invalid parameters");
  if(mode==="discover"&&(q.length<3||q.length>250))throw Error("Query must be 3–250 characters");
  if(["episodes","arcs"].includes(mode)&&(mal===null||through===0||q.length>250))throw Error("Episode limit and MAL anime ID required");
  if(mode==="print-themes"&&(mal===null||medium==="anime"||!["manga","manhwa","manhua","novel"].includes(medium)||
      !url.searchParams.get("title")?.trim()||url.searchParams.get("title").length>200))throw Error("Exact print identity required");
  if(mode==="episodes"&&q.length<3)throw Error("Episode search requires a query");
  return {q,mode,medium,limit,through,mal,title:url.searchParams.get("title")||""};
}
async function requestAAR(path,fetcher){
  const u=new URL(path,ROOT);
  if(u.origin!==ROOT)throw Error("Unsafe provider URL");
  const response=await fetcher(u.href,{headers:{"x-api-key":KEY,"accept":"application/json","user-agent":"Mira-Story/1.0"},
                                        signal:AbortSignal.timeout(12500)});
  if(!response.ok)throw Error(response.status===429?"Source rate limit":"Source status "+response.status);
  const size=Number(response.headers.get("content-length")||0);
  if(size>2_500_000)throw Error("Oversized provider response");
  const body=await response.text();
  if(body.length>2_500_000)throw Error("Oversized provider response");
  return JSON.parse(body);
}
function catalogue(r){
  const mal=Number.isInteger(r.mal_id)?r.mal_id:null;
  const al=Number.isInteger(r.anilist_id)?r.anilist_id:null;
  const source=safeUrl(r.url)||(mal?"https://myanimelist.net/"+(r.type==="anime"?"anime":"manga")+"/"+mal:
                        al?"https://anilist.co/"+(r.type==="anime"?"anime":"manga")+"/"+al:null);
  return {work_id:safeString(r.work_id,180),title:safeString(r.title_english||r.title,180),
          medium:safeString(r.type,30),year:Number.isInteger(r.release_year)?r.release_year:null,
          score:Number.isFinite(r.community_score)?r.community_score:null,
          genres:Array.isArray(r.genres)?r.genres.slice(0,12).map(x=>safeString(x,50)):[],
          themes:Array.isArray(r.themes)?r.themes.slice(0,16).map(x=>safeString(x,50)):[],
          synopsis:safeString(r.description,540),url:source,
          mal_id:mal,anilist_id:al,source_type:"preindexed_synopsis_metadata",
          narrative_verification:"NOT_VERIFIED"};
}
function scene(r,cutoff){
  const episode=Number(r.episode_number);
  if(!Number.isFinite(episode)||episode<1||episode>cutoff)return null;
  return {work_id:safeString(r.canonical_id,180),title:safeString(r.title,160),
    mal_id:Number.isInteger(r.mal_id)?r.mal_id:null,episode,
    arc:safeString(r.arc_name,140),
    timestamp:safeString(r.timestamp_range,100),
    scene_evidence:Array.isArray(r.scenes)?r.scenes.slice(0,3).map(s=>({
      scene_id:safeString(s.scene_id,180),location:safeString(s.location,140),
      timestamp:safeString(s.timestamp_range,80),
      summary:safeString(s.summary,420)})):[],
    provenance:{provider:"Anime Akashic Records",api:"/advanced_search",granularity:"episode"},
    evidence_status:"PROVIDER_SCENE_SUMMARY_NOT_INDEPENDENTLY_VERIFIED"};
}
function arc(r,cutoff){
  const x=Number(r.start_episode),y=Number(r.end_episode);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x<1||y<x||y>cutoff)return null;
  return {arc_id:safeString(r.arc_id,180),arc:safeString(r.arc_name,150),
          saga:safeString(r.saga_name,150),start_episode:x,end_episode:y,
          evidence_status:"PROVIDER_ARC_BOUNDARY_NOT_PLOT_CENTRALITY"};
}
export async function storySearch(request,fetcher=fetch,readClaims=async()=>[]){
  const url=new URL(request.url);
  let p;
  try{p=validate(url);}catch(e){return result({error:safeString(e.message,150)},400);}
  try{
    if(p.mode==="print-themes")return result(await printThemes({title:p.title,mal:p.mal,medium:p.medium},fetcher));
    if(p.mode==="discover"){
      const upstream=new URL("/search",ROOT);
      upstream.searchParams.set("q",p.q);
      upstream.searchParams.set("limit",String(Math.max(p.limit,18)));
      const data=await requestAAR(upstream.pathname+upstream.search,fetcher);
      const rows=(Array.isArray(data.results)?data.results:[]).filter(x=>
        x.is_adult!==true&&(!p.medium||x.type===p.medium)).slice(0,p.limit).map(catalogue);
      return result({mode:p.mode,query:p.q,results:rows,coverage:{source:"AAR preindexed third-party catalogue",
        provider_result_total:Number(data.total)||null},
        limits:"Titles, themes and synopses are candidate evidence, not proof of late story progression."});
    }
    if(p.mode==="episodes"){
      const upstream=new URL("/advanced_search",ROOT);
      for(const [k,v] of Object.entries({q:p.q,granularity:"episode",mal_id:p.mal,
          max_episode:p.through,limit:p.limit}))upstream.searchParams.set(k,String(v));
      const data=await requestAAR(upstream.pathname+upstream.search,fetcher);
      const reviewed=await readClaims(p.mal,p.through).then(items=>({items,unavailable:false}),
        ()=>({items:[],unavailable:true}));
      return result({mode:p.mode,mal_id:p.mal,through_episode:p.through,
        reviewed_claims:reviewed.items,reviewed_claims_unavailable:reviewed.unavailable,
        matches:(Array.isArray(data.results)?data.results:[]).filter(x=>x.mal_id===p.mal).map(x=>scene(x,p.through)).filter(Boolean),
        coverage:{source:"AAR preindexed episode/scene retrieval"},
        limits:"These are provider-generated scene descriptions. They support bounded episode observations, not claims about the whole series or manga chapters."});
    }
    const data=await requestAAR("/lore/arc-index/mal:"+p.mal,fetcher);
    if(data.mal_id!==p.mal)return result({error:"Provider identity mismatch"},502);
    return result({mode:p.mode,mal_id:p.mal,title:safeString(data.title,180),through_episode:p.through,
      arcs:(Array.isArray(data.arcs)?data.arcs:[]).map(x=>arc(x,p.through)).filter(Boolean),
      limits:"Arc boundaries alone do not establish plot emphasis or progression."});
  }catch(e){
    return result({error:"Story source unavailable",reason:safeString(e.message,100),
                   retryable:true},503);
  }
}
