import test from "node:test";
import assert from "node:assert/strict";
import {imageFormat,MAX_IMAGE_BYTES} from "./github-media.mjs";
test("valid file signatures",()=>{
 assert.equal(imageFormat(Uint8Array.from([137,80,78,71,13,10,26,10])).mime,"image/png");
 assert.equal(imageFormat(Uint8Array.from([255,216,255])).mime,"image/jpeg");
 assert.equal(imageFormat(new TextEncoder().encode("RIFF1234WEBP")).mime,"image/webp");
 assert.equal(imageFormat(new TextEncoder().encode("GIF89a")).mime,"image/gif");
});
test("unsafe and unknown formats rejected",()=>{
 assert.equal(imageFormat(new TextEncoder().encode("<svg onload=evil()>")),null);
 assert.equal(imageFormat(new TextEncoder().encode("<html>")),null);
 assert.equal(MAX_IMAGE_BYTES,700000);
});
