// Read-only MangaBaka print-theme lookup for Mira; no secrets, no bulk scraping.
// It queries the provider's preindexed catalogue and validates the exact MyAnimeList identity.
const ROOT="https://api.mangabaka.org";
const KINDS=new Set(["manga","manhwa","manhua","novel"]);
const WEIGHTS=new Set(["core","defining","recurrent","incidental","unweighted"]);
const safe=value=>typeof value==="string"?value.slice(0,200):"";
async function get(path,fetcher){
 const u=new URL(path,ROOT);
 if(u.origin!==ROOT)throw Error("Unsafe API URL");
 const r=await fetcher(u.href,{headers:{"accept":"application/json","user-agent":"Mira-Media/1.0"},
     signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error(r.status===429?"Source rate limited":"MangaBaka HTTP "+r.status);
 if(Number(r.headers.get("content-length")||0)>1_800_000)throw Error("Oversized response");
 const txt=await r.text();if(txt.length>1_800_000)throw Error("Oversized response");
 const v=JSON.parse(txt);
 if(v.status!==200)throw Error("Provider reported error");
 return v;
}
function exactId(x,mal,medium){
 return x&&x.type===medium&&x.content_rating==="safe"&&
   Number(x.source?.my_anime_list?.id)===mal;
}
export async function printThemes({title,mal,medium},fetcher=fetch){
 if(typeof title!=="string"||title.trim().length<2||title.length>200||
    !Number.isInteger(mal)||mal<1||mal>1_000_000||!KINDS.has(medium))
   throw Error("Exact print identity required");
 const search=new URL("/v2/series/search",ROOT);
 search.searchParams.set("q",title.trim());
 search.searchParams.set("type",medium);
 search.searchParams.set("content_rating","safe");
 search.searchParams.set("limit","8");
 const data=await get(search.pathname+search.search,fetcher);
 const candidates=(Array.isArray(data.data)?data.data:[]).filter(x=>exactId(x,mal,medium));
 if(candidates.length!==1)return {mode:"print-themes",title,mal_id:mal,medium,
   status:candidates.length?"AMBIGUOUS_IDENTITY":"NOT_INDEXED_OR_ID_MISMATCH",tags:[],
   limits:"Cross-provider identity requires a unique MAL ID match; no story claims are made."};
 const id=candidates[0].id;
 if(!Number.isInteger(id)||id<1)throw Error("Invalid provider ID");
 const full=await get("/v2/series/"+id+"?schema=full",fetcher);
 const item=full.data;
 if(!exactId(item,mal,medium)||item.id!==id)throw Error("Full record identity mismatch");
 const weightOrder={core:0,defining:1,recurrent:2,incidental:3,unweighted:4};
 const tags=(Array.isArray(item.tags)?item.tags:[]).filter(x=>
   x&&Number.isInteger(x.id)&&typeof x.name==="string"&&
   x.is_spoiler!==true&&x.content_rating==="safe"&&WEIGHTS.has(x.weight)
 ).sort((a,b)=>weightOrder[a.weight]-weightOrder[b.weight]||a.name.localeCompare(b.name));
 const projected=tags.slice(0,60).map(x=>({
   id:x.id,name:safe(x.name),weight:x.weight,
   path:safe(x.name_path),genre:x.is_genre===true
 }));
 const name=(Array.isArray(item.titles)?item.titles:[]).find(x=>x.language==="en"&&x.is_primary)?.title||
            (Array.isArray(item.titles)?item.titles:[]).find(x=>x.language==="en")?.title||title;
 return {mode:"print-themes",status:"MATCHED_MAL_ID",title:safe(name),mal_id:mal,
   medium,source:"https://mangabaka.org/"+id,source_provider:"MangaBaka",
   catalogue_updated:safe(item.last_updated_at,60),
   total_chapters:Number.isInteger(item.total_chapters)?item.total_chapters:null,
   tags:projected,counts:{shown:projected.length,matched_nonspoiler:tags.length,
     strong:tags.filter(x=>x.weight==="core"||x.weight==="defining").length},
   limits:"Tag weights indicate how central a theme is overall, NOT when it occurs or how long an arc lasts. Unknown or spoiler-tagged claims are withheld. Provider classification, not independently verified plot chronology."};
}
