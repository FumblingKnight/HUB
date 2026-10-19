import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";
test("Mira context API remains inaccessible without a login",async()=>{
 const response=await worker.fetch(new Request("https://atlas.example/api/mira/context?q=Mira"),{ATLAS_LOGIN_PASSPHRASE:"LongValidSecretPassphraseABC123!"});
 assert.equal(response.status,401);
 assert.equal((await response.json()).error,"Login required");
});
test("Mira context page remains inaccessible without a login",async()=>{
 const response=await worker.fetch(new Request("https://atlas.example/mira.html"),{ATLAS_LOGIN_PASSPHRASE:"LongValidSecretPassphraseABC123!"});
 assert.equal(response.status,303);
 assert.equal(response.headers.get("location"),"/login");
});
