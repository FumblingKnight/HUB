import test from "node:test";
import assert from "node:assert/strict";
import {readReviewedMediaClaims} from "./mira-media-claims.mjs";
const cards=[
 ["anime","https://myanimelist.net/anime/49784","Iruma S3",3,"episode",1,1,"late_school",
  "The class prepares for a festival.",
  [["Distributor","https://example.org/watch/episode1","licensed_episode","supports","2026-11-04","Synopsis"]]],
 ["anime","https://myanimelist.net/anime/49784","Iruma S3",3,"episode",25,25,"development",
  "Future spoiler.",
  [["Distributor","https://example.org/watch/episode25","licensed_episode","supports","2026-11-04","Do not leak"]]],
 ["manhwa","mangabaka:1464","Infinite Mage",null,"chapter",null,null,"development",
  "No chapter bounds.",
  [["Publisher","https://example.org/info","publisher_synopsis","supports","2026-11-04","Broad"]]],
];
const env={ATLAS_REPOSITORY:"FumblingKnight/Sajo-Atlas",ATLAS_GITHUB_TOKEN:"test-token-not-real"};
const wrap=(data)=>async (_url,_opts)=>new Response(JSON.stringify({
  encoding:"base64",size:Buffer.byteLength(data),content:Buffer.from(data).toString("base64")
}),{status:200});
test("private narrative cache returns only scoped MAL-anime claims",async()=>{
  let seenUrl,seenAuth;
  const loader=async (url,opts)=>{seenUrl=url;seenAuth=opts.headers.authorization;return wrap(JSON.stringify(cards))();};
  const r=await readReviewedMediaClaims(env,49784,6,loader);
  assert.equal(r.length,1);
  assert.equal(r[0].facet,"late_school");
  assert.equal(r[0].status,"SUPPORTED_IN_SCOPE");
  assert.ok(r[0].evidence[0].url.startsWith("https://"));
  assert.ok(!JSON.stringify(r).includes("Future spoiler"));
  assert.ok(seenUrl.endsWith("/contents/mira/media-index/story-service/narrative-cards.json"));
  assert.equal(seenAuth,"Bearer test-token-not-real");
});
test("abstains when no spoiler horizon is supplied",async()=>{
  await assert.rejects(readReviewedMediaClaims(env,49784,0,()=>{throw Error("unexpected fetch")}));
});
test("rejects unsupported private repository envelope",async()=>{
  await assert.rejects(readReviewedMediaClaims(env,49784,6,async()=>new Response(JSON.stringify({
    encoding:"base64",size:1000000,content:"bad"}),{status:200})));
});
test("no external URL with javascript scheme is included",async()=>{
  const v=[["anime","https://myanimelist.net/anime/5","Test",1,"episode",1,1,
    "romance","Source assertion",[["Provider","javascript:alert(1)","licensed_episode","supports","2026","Bad"]]]];
  const r=await readReviewedMediaClaims(env,5,1,wrap(JSON.stringify(v)));
  assert.deepEqual(r,[]);
});
