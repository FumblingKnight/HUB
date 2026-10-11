import test from "node:test";
import assert from "node:assert/strict";
import {isAuthConfigured,passwordMatches,issueSession,verifySession} from "./session.mjs";
const pass="test-s3cret-very-long-random-passphrase-2026";
test("unconfigured auth denies access",()=>assert.equal(isAuthConfigured({}),false));
test("password verifies and rejects incorrect input",async()=>{
 assert.equal(await passwordMatches(pass,pass),true);
 assert.equal(await passwordMatches("wrong",pass),false);
});
test("signed session is valid then expires",async()=>{
 const issued=await issueSession(pass,Date.UTC(2026,9,12));
 const header=issued.split(";")[0];
 assert.equal(await verifySession(header,pass,Date.UTC(2026,9,13)),true);
 assert.equal(await verifySession(header,pass,Date.UTC(2026,9,21)),false);
 assert.equal(await verifySession(header,pass+"x",Date.UTC(2026,9,13)),false);
});
test("no forged token accepted",async()=>{
 const cookie=(await issueSession(pass)).split(";")[0];
 const parts=cookie.split(".");
 const prefix=parts[1].charAt(0)==="A"?"B":"A";
 const tampered=parts[0]+"."+prefix+parts[1].slice(1);
 assert.equal(await verifySession(tampered,pass),false);
});

test("nine-character mixed password is supported",async()=>{
 const short="Abc123@xy";
 assert.equal(isAuthConfigured({ATLAS_LOGIN_PASSPHRASE:short}),true);
 assert.equal(await passwordMatches(short,short),true);
 const cookie=(await issueSession(short)).split(";")[0];
 assert.equal(await verifySession(cookie,short),true);
});
test("weak or underlength passwords are rejected",()=>{
 for(const password of ["Abc12@xy","abcdefghi","123456789","Abcdef123","Abcdef@@@"]){
  assert.equal(isAuthConfigured({ATLAS_LOGIN_PASSPHRASE:password}),false);
 }
});
