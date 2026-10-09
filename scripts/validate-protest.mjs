import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";

/* Structural checks for the GitHub-backed protest timeline. These checks
   cannot establish whether a reported fact or an external source is true. */
const root = "public/protest/";
const data = JSON.parse(readFileSync(root+"events.json", "utf8"));
const statuses = new Set(["confirmed","corroborated","unverified","disputed"]);
const IDs = new Set(), semantic = new Set();
const validDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s+"T12:00:00Z"));
const validOffset = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(s) && !Number.isNaN(Date.parse(s));
const validIST = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?\+05:30$/.test(s) && validOffset(s);
const url = v => { try { const u = new URL(v); return u.protocol === "https:" && u.hostname.includes(".") && !u.username && !u.password; } catch { return false; } };

assert.equal(data.schema_version,3,"Required schema v3; refresh README and writer prompts");
assert.ok(data.meta && typeof data.meta === "object");
assert.equal(data.meta.timezone,"Asia/Kolkata");
assert.ok(validDate(data.meta.scheduled_for),"Invalid planned date");
assert.ok(validOffset(data.meta.last_checked_at),"Invalid last research timestamp");
assert.ok(validOffset(data.meta.published_at),"Invalid last publishing timestamp");
assert.ok(["planned","active","concluded","unconfirmed"].includes(data.meta.event_status),"Invalid event state");
assert.ok(Array.isArray(data.events) && Array.isArray(data.discussions));
for(const e of data.events){
  assert.match(e.id,/^Event \d+$/,"Use stable Event NN IDs");
  assert.ok(!IDs.has(e.id),"Duplicate Event ID: "+e.id); IDs.add(e.id);
  assert.ok(validDate(e.date),"Invalid date "+e.id);
  assert.ok(typeof e.title === "string" && e.title.trim(),"Missing title "+e.id);
  assert.ok(typeof e.description === "string" && e.description.trim(),"Missing description "+e.id);
  assert.ok(typeof e.category === "string" && e.category.trim(),"Missing category "+e.id);
  assert.ok(statuses.has(e.status),"Invalid status "+e.id);
  for(const f of ["occurred_at","reported_at","scheduled_at"]){
    assert.ok(Object.hasOwn(e,f),"Missing field "+f+" "+e.id);
    assert.ok(e[f] === null || validIST(e[f]),"Bad "+f+": "+e.id);
  }
  assert.ok(Object.hasOwn(e,"occurred_on") && (e.occurred_on===null || validDate(e.occurred_on)),"Invalid occurred_on "+e.id);
  assert.ok(!Object.hasOwn(e,"event_time_display"),"Legacy time string must not be used: "+e.id);
  assert.ok(!Object.hasOwn(e,"event_time"),"Legacy time field must not be used: "+e.id);
  assert.ok(Array.isArray(e.sources) && e.sources.length>0,"Missing sources: "+e.id);
  if(e.evidence!==undefined)assert.ok(Array.isArray(e.evidence),"Evidence must be array: "+e.id);
  const key=e.date+"|"+e.title.trim().toLowerCase().replace(/\s+/g," ");
  assert.ok(!semantic.has(key),"Possible duplicate same day/title: "+key); semantic.add(key);
  const links=new Set();
  for(const s of e.sources){
    assert.ok(s && url(s.url),"Invalid HTTPS source: "+e.id);
    assert.ok(s.label && typeof s.label === "string","Missing source label: "+e.id);
    assert.ok(!links.has(s.url),"Duplicate link in event: "+e.id);
    links.add(s.url);
  }
}
const discussionIDs=new Set();
for(const d of data.discussions){
  assert.match(d.id,/^Community \d+$/,"Use stable Community NN IDs");
  assert.ok(!discussionIDs.has(d.id),"Duplicate discussion ID: "+d.id);discussionIDs.add(d.id);
  assert.ok(validDate(d.date),"Bad discussion date "+d.id);
  assert.ok(typeof d.title==="string"&&d.title.trim());
  assert.ok(typeof d.summary==="string"&&d.summary.trim());
  assert.ok(typeof d.community==="string"&&d.community.trim());
  assert.ok(url(d.url),"Bad discussion URL: "+d.id);
  if(d.related)assert.ok(IDs.has(d.related),"Discussion points to missing event "+d.related);
}
for(const filename of ["index.html","site.css","app.js","README.md"]){
  assert.ok(existsSync(root+filename),"Missing frontend asset "+filename);
}
const html=readFileSync(root+"index.html","utf8");
assert.ok(html.includes('/protest/app.js')&&html.includes('/protest/site.css'),"HTML references missing assets");
const js=readFileSync(root+"app.js","utf8");
for(const f of ["occurred_at","reported_at","scheduled_at"]){
  assert.ok(js.includes(f),"Frontend does not read "+f);
}
console.log("Timeline schema v3 valid:",data.events.length,"events,",data.discussions.length,"community threads.");
