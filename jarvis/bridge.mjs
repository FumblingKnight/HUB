#!/usr/bin/env node
// Local-only, explicitly paired bridge. No model runs on this computer.
import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const PORT = Number(process.env.JARVIS_PORT || 8765);
const DATA_DIR = process.env.JARVIS_DATA_DIR || join(homedir(), ".jarvis-neural-lab");
mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const TOKEN_PATH = join(DATA_DIR, "bridge.token");
const DATASET_PATH = join(DATA_DIR, "training.jsonl");
if (!existsSync(TOKEN_PATH)) writeFileSync(TOKEN_PATH, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
const TOKEN = readFileSync(TOKEN_PATH, "utf8").trim();
const allowed = new Set(
  (process.env.JARVIS_ORIGINS || "https://hub.thefumblingknight.workers.dev,http://localhost:8787,http://127.0.0.1:8787,http://127.0.0.1:8765").split(",").map(s => s.trim())
);
const withCors = (request) => {
  const origin = request.headers.origin;
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Vary": "Origin" };
  if (origin && allowed.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS";
    headers["Access-Control-Allow-Private-Network"] = "true";
  }
  return headers;
};
function answer(request, response, code, result) {
  response.writeHead(code, { ...withCors(request), "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(result));
}
function authorized(request) {
  const raw = String(request.headers.authorization || "");
  const given = raw.startsWith("Bearer ") ? raw.slice(7) : "";
  const left = Buffer.from(given);
  const right = Buffer.from(TOKEN);
  return left.length === right.length && timingSafeEqual(left, right);
}
function lessonsCount() {
  if (!existsSync(DATASET_PATH)) return 0;
  return readFileSync(DATASET_PATH, "utf8").split("\n").filter(line => line.trim()).length;
}
function readBody(request) {
  return new Promise((resolve, reject) => {
    let input = "";
    request.on("data", chunk => {
      input += chunk;
      if (input.length > 28000) { reject(Error("Request too large.")); request.destroy(); }
    });
    request.on("end", () => {
      try { resolve(JSON.parse(input || "{}")); } catch { reject(Error("Invalid JSON.")); }
    });
    request.on("error", reject);
  });
}
function requiredText(value, name) {
  if (typeof value !== "string" || !value.trim() || value.length > 10000) throw Error(name + " must be 1–10,000 characters.");
  return value.trim();
}
function codexAvailable() {
  return spawnSync("codex", ["--version"], { timeout: 4000, encoding: "utf8" }).status === 0;
}
let thinking = false;
function askCodex(prompt) {
  if (thinking) return Promise.reject(Error("A GPT request is already running."));
  thinking = true;
  const dir = mkdtempSync(join(tmpdir(), "jarvis-lab-"));
  const outputFile = join(dir, "answer.txt");
  // Run outside all repos; refuse write access; don't import user AGENTS.md.
  const args = ["exec", "--ephemeral", "--ignore-user-config", "--skip-git-repo-check", "--sandbox", "read-only", "--output-last-message", outputFile, "-"];
  return new Promise((resolve, reject) => {
    const child = spawn("codex", args, { cwd: dir, env: process.env, stdio: ["pipe", "ignore", "pipe"] });
    let errorText = "";
    let finished = false;
    const timer = setTimeout(() => child.kill("SIGKILL"), 180000);
    const finish = (error, text) => {
      if (finished) return;
      finished = true; clearTimeout(timer); thinking = false;
      rmSync(dir, { recursive: true, force: true });
      error ? reject(error) : resolve(text);
    };
    child.stderr.on("data", chunk => { errorText = (errorText + chunk.toString()).slice(-1500); });
    child.on("error", error => finish(Error("Codex CLI unavailable: " + error.message)));
    child.on("close", code => {
      if (finished) return;
      if (code !== 0) return finish(Error("Codex exited unsuccessfully. Check 'codex login' in your terminal. " + errorText.slice(-600)));
      try {
        const text = readFileSync(outputFile, "utf8").trim();
        if (!text) throw Error("Codex returned no text.");
        finish(null, text);
      } catch (error) { finish(error); }
    });
    child.stdin.end("Respond to this user question directly and concisely. No files, commands, tools or application changes are needed.\n\n" + prompt);
  });
}
async function cloudflareInfer(prompt, useLora) {
  const { CF_ACCOUNT_ID, CF_AI_TOKEN, CF_LORA_ID } = process.env;
  if (!CF_ACCOUNT_ID || !CF_AI_TOKEN) throw Error("Cloudflare AI is not connected; set CF_ACCOUNT_ID and CF_AI_TOKEN in your local environment.");
  if (useLora && !CF_LORA_ID) throw Error("No trained adapter configured. Train a LoRA and set CF_LORA_ID.");
  const model = "@cf/google/gemma-2b-it-lora";
  const url = "https://api.cloudflare.com/client/v4/accounts/" + encodeURIComponent(CF_ACCOUNT_ID) + "/ai/run/" + model;
  const body = { messages: [{ role: "user", content: prompt }], max_tokens: 400 };
  if (useLora) body.lora = CF_LORA_ID;
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: "Bearer " + CF_AI_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(70000)
  });
  const data = await response.json();
  if (!response.ok || data.success === false) throw Error("Cloudflare inference failed (" + response.status + "): " + (data.errors?.[0]?.message || "Check quotas/model/adapter."));
  const result = data.result || data;
  return result.response || result.output?.[0]?.content || JSON.stringify(result);
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !allowed.has(origin)) return answer(request, response, 403, { error: "Unapproved browser origin." });
  if (request.method === "OPTIONS") {
    response.writeHead(204, withCors(request)); return response.end();
  }
  if (!authorized(request)) return answer(request, response, 401, { error: "Pairing token missing or incorrect." });
  const path = new URL(request.url || "/", "http://127.0.0.1").pathname;
  try {
    if (path === "/api/status" && request.method === "GET") {
      return answer(request, response, 200, { lessonCount: lessonsCount(), codexAvailable: codexAvailable(), loraReady: Boolean(process.env.CF_LORA_ID && process.env.CF_ACCOUNT_ID && process.env.CF_AI_TOKEN) });
    }
    if (path === "/api/dataset" && request.method === "GET") {
      response.writeHead(200, { ...withCors(request), "Content-Type": "application/x-ndjson; charset=utf-8", "Content-Disposition": 'attachment; filename="jarvis-training.jsonl"' });
      return response.end(existsSync(DATASET_PATH) ? readFileSync(DATASET_PATH) : "");
    }
    if (request.method !== "POST") return answer(request, response, 404, { error: "Unknown route." });
    const body = await readBody(request);
    if (path === "/api/lesson") {
      const prompt = requiredText(body.prompt, "Situation");
      const ideal = requiredText(body.ideal, "Ideal answer");
      appendFileSync(DATASET_PATH, JSON.stringify({ prompt, ideal, verified: true }) + "\n", { mode: 0o600 });
      return answer(request, response, 200, { saved: true, lessonCount: lessonsCount() });
    }
    if (path === "/api/think") {
      const prompt = requiredText(body.prompt, "Prompt");
      return answer(request, response, 200, { answer: await askCodex(prompt), engine: "chatgpt-plus-codex" });
    }
    if (path === "/api/infer") {
      const prompt = requiredText(body.prompt, "Prompt");
      if (body.mode !== "base" && body.mode !== "lora") throw Error("mode must be base or lora.");
      return answer(request, response, 200, { answer: await cloudflareInfer(prompt, body.mode === "lora"), engine: body.mode });
    }
    return answer(request, response, 404, { error: "Unknown route." });
  } catch (error) {
    const message = String(error.message || "Unexpected error.");
    return answer(request, response, /already running/.test(message) ? 429 : 400, { error: message });
  }
});
server.listen(PORT, "127.0.0.1", () => {
  console.log("JARVIS bridge bound to http://127.0.0.1:" + PORT);
  console.log("Pairing token (keep private): " + TOKEN);
  console.log("Saved lessons: " + DATASET_PATH);
  console.log("Nothing here updates GPT neural weights.");
});