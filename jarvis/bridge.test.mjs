import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

async function freePort() {
  return new Promise((resolvePort, reject) => {
    const s = createServer(); s.on("error", reject); s.listen(0, "127.0.0.1", () => {
      const p = s.address().port; s.close(() => resolvePort(p));
    });
  });
}
test("Bridge enforces pairing, origin checks and saves only verified training pairs", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "jarvis-test-"));
  const port = await freePort();
  const child = spawn(process.execPath, [resolve("jarvis/bridge.mjs")], {
    cwd: resolve("."), env: {...process.env,JARVIS_PORT:String(port),JARVIS_DATA_DIR:dataDir}, stdio:"ignore"
  });
  try {
    let token = "";
    for (let i=0;i<50;i++) {
      if (existsSync(join(dataDir,"bridge.token"))) {
        token = readFileSync(join(dataDir,"bridge.token"),"utf8").trim();
        try {
          const r = await fetch("http://127.0.0.1:"+port+"/api/status", {headers:{Authorization:"Bearer "+token}});
          if (r.ok) break;
        } catch {}
      }
      await sleep(100);
    }
    assert.equal(token.length,64);
    const url = "http://127.0.0.1:"+port;
    const noAuth = await fetch(url+"/api/status"); assert.equal(noAuth.status,401);
    const deniedOrigin = await fetch(url+"/api/status", {headers:{Authorization:"Bearer "+token,Origin:"https://malicious.example"}});
    assert.equal(deniedOrigin.status,403);
    const goodHeaders = {Authorization:"Bearer "+token,Origin:"https://hub.thefumblingknight.workers.dev"};
    const ready = await fetch(url+"/api/status",{headers:goodHeaders}); assert.equal(ready.status,200);
    const save = await fetch(url+"/api/lesson",{method:"POST",headers:{...goodHeaders,"Content-Type":"application/json"},body:JSON.stringify({prompt:"A test question",ideal:"The verified answer"})});
    assert.equal(save.status,200);
    const saved = await save.json(); assert.equal(saved.lessonCount,1);
    const download = await fetch(url+"/api/dataset",{headers:goodHeaders}); assert.equal(download.status,200);
    const examples = (await download.text()).trim().split("\n").map(JSON.parse);
    assert.deepEqual(examples,[{prompt:"A test question",ideal:"The verified answer",verified:true}]);
    const noModel = await fetch(url+"/api/infer",{method:"POST",headers:{...goodHeaders,"Content-Type":"application/json"},body:JSON.stringify({prompt:"Hello",mode:"lora"})});
    assert.equal(noModel.status,400);
  } finally {
    child.kill(); await sleep(100); rmSync(dataDir,{recursive:true,force:true});
  }
});