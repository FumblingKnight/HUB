import test from "node:test";
import assert from "node:assert/strict";
import {groupStories,findStory,detailHref,validLink,safeImage,normalizeCoverage} from "./story-model.mjs";
import {readFile} from "node:fs/promises";
const base={id:"one",story_id:"event-42",title:"A major announcement",category:"reddit",summary:"Original",source_url:"https://reddit.com/r/example",source_kind:"community",relevance:2,urgency:1,coverage:[{url:"https://www.reddit.com/r/example",label:"Real discussion",type:"community",note:"Evidence"}]};
const official={...base,id:"two",title:"A different angle on the same event",source_url:"https://example.org/story",source_kind:"reporting",coverage:[{url:"https://example.org/story",label:"Independent coverage",type:"reporting"}]};
test("same event gets one story, unique sources, and keeps canonical editorial summary",()=>{
 const [story]=groupStories([base,official]);
 assert.equal(story.count,2);
 assert.equal(story.summary,"Original");
 assert.equal(story.story_id,"event-42");
 assert.equal(story.coverage.length,3); // reddit.com and www.reddit.com are distinct HTTPS addresses
 assert.equal(story.coverage.find(x=>x.url==="https://www.reddit.com/r/example").note,"Evidence");
});
test("platform identity is not sufficient to merge unrelated topics",()=>{
 const group=groupStories([base,{...official,story_id:"another-event"}]);
 assert.equal(group.length,2);
});
test("current reports appear before archived ones even when old item is urgent",()=>{
 const active={...base,story_id:"fresh",urgency:1};
 const expired={...official,story_id:"past",status:"archived",urgency:3,expires_at:"2026-10-20T00:00:00Z"};
 assert.equal(groupStories([expired,active],Date.parse("2026-10-22T00:00:00Z"))[0].story_id,"fresh");
});
test("reject unsafe event IDs, URLs, unsupported image hosts and malicious schemes",()=>{
 assert.equal(detailHref("good-id"),"/story.html?id=good-id");
 assert.equal(detailHref("../steal"),null);
 for(const url of ["javascript:alert(1)","http://example.com","https://name:password@example.com"])assert.equal(validLink(url),null);
 assert.equal(safeImage("https://evil.example/image.jpg"),null);
 assert.equal(safeImage("https://i.ytimg.com/vi/IBTK8PGe_Oo/hqdefault.jpg"),"https://i.ytimg.com/vi/IBTK8PGe_Oo/hqdefault.jpg");
 assert.equal(safeImage("https://i.ytimg.com/evil/foo.jpg"),null);
});
test("unknown story ID returns null without silently guessing a title match",()=>{
 assert.equal(findStory([base],"missing"),null);
 assert.equal(findStory([base],"event-42").title,"A major announcement");
});
test("duplicate coverage within the same item deduplicates and retains original note",()=>{
 const only=normalizeCoverage({...base,coverage:[{url:base.source_url,label:"Source annotated",note:"Verified",type:"official"},{url:base.source_url,label:"Another label",note:"Should lose"}]});
 assert.equal(only.filter(x=>x.url===base.source_url).length,1);
 assert.equal(only[0].note,"Verified");
});
test("web views have internal story deep links and required protected site asset references",async()=>{
 const pages=["mira.html","story.html","home.html"];
 for(const page of pages){const html=await readFile(new URL("./"+page,import.meta.url),"utf8");assert.match(html,/viewer-shell.js/);}
 const detail=await readFile(new URL("./story.html",import.meta.url),"utf8");
 assert.match(detail,/\/story\.js/);assert.match(detail,/story-community-panel/);assert.match(detail,/story-sources/);
 const feed=await readFile(new URL("./mira.html",import.meta.url),"utf8");
 assert.match(feed,/\/mira-reader\.js/);assert.match(feed,/\/signals-reader\.css/);
});
