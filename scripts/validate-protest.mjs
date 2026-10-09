import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";
const root = "public/protest/";
const path = root + "events.json";
const data = JSON.parse(readFileSync(path, "utf8"));
const statuses = new Set(["confirmed", "corroborated", "unverified", "disputed"]);
const ids = new Set(), semantic = new Set();
const isIso = str => typeof str === "string" && !Number.isNaN(Date.parse(str)) && /(?:Z|[+-]\d\d:\d\d)$/.test(str);
const isoDate = str => typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str) && !Number.isNaN(Date.parse(str + "T12:00:00Z"));
const safeUrl = str => {try { const url=new URL(str);return url.protocol==="https:" && url.hostname.includes(".") && !url.username && !url.password; }catch{return false;}};
assert.equal(data.schema_version,2,"Expected schema v2");
assert.ok(data.meta && typeof data.meta==="object");
assert.equal(data.meta.timezone,"Asia/Kolkata");
assert.ok(isoDate(data.meta.scheduled_for));
assert.ok(isIso(data.meta.last_checked_at));
assert.ok(isIso(data.meta.published_at));
assert.ok(Array.isArray(data.events),"events must be an array");
assert.ok(Array.isArray(data.discussions),"discussions must be an array");
for (const e of data.events) {
  assert.ok(typeof e.id==="string"&&e.id.length>2,"Event ID missing");
  assert.ok(!ids.has(e.id),"Duplicate ID: "+e.id);ids.add(e.id);
  assert.ok(isoDate(e.date),"Invalid event date for "+e.id);
  assert.ok(typeof e.title==="string"&&e.title.trim());
  assert.ok(typeof e.description==="string"&&e.description.trim());
  assert.ok(statuses.has(e.status),"Unknown status on "+e.id);
  assert.ok(typeof e.category==="string"&&e.category.trim());
  if(e.event_time!=null)assert.ok(isIso(e.event_time),"Bad event time: "+e.id);
  assert.ok(Array.isArray(e.sources)&&e.sources.length>0,"No sources: "+e.id);
  const key=e.date+"|"+e.title.trim().toLowerCase();
  assert.ok(!semantic.has(key),"Repeated date/title: "+key);semantic.add(key);
  for (const s of e.sources){assert.ok(s&&safeUrl(s.url),"Invalid source URL: "+e.id);assert.ok(typeof s.label==="string"&&s.label.trim(),"Missing source name: "+e.id);}
  if(e.evidence!=null)assert.ok(Array.isArray(e.evidence),"Evidence must be array: "+e.id);
}
const discussionIds=new Set();
for(const item of data.discussions){
  assert.ok(item.id&&item.title&&item.community&&item.summary);
  assert.ok(isoDate(item.date),"Invalid discussion date: "+item.id);
  assert.ok(safeUrl(item.url),"Bad discussion URL: "+item.id);
  assert.ok(!discussionIds.has(item.id),"Duplicate discussion ID: "+item.id);
  discussionIds.add(item.id);
}
for (const filename of ["index.html","site.css","app.js","README.md"]){assert.ok(existsSync(root+filename),"Missing site asset: "+filename);}
const html=readFileSync(root+"index.html","utf8");
assert.ok(html.includes("/protest/site.css")&&html.includes("/protest/app.js"),"Front-end assets not referenced");
console.log("Timeline validated:",data.events.length,"events;",data.discussions.length,"Reddit / community entries.");
