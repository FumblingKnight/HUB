"use strict";
const ORIGIN = "http://127.0.0.1:8765";
const q = (id) => document.getElementById(id);
let pairedToken = "";
let isBusy = false;
function status(message, ready = false) { q("status").innerHTML = ""; const dot = document.createElement("i"); q("status").append(dot, document.createTextNode(message)); q("status").classList.toggle("ready", ready); }
function setText(id, value) { q(id).textContent = value; }
function lock(form, yes) { for (const button of form.querySelectorAll("button")) button.disabled = yes; }
async function api(path, body) {
  if (!pairedToken) throw Error("Connect your local bridge first.");
  const response = await fetch(ORIGIN + "/api/" + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer " + pairedToken, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });
  if (!response.ok) {
    let info = {};
    try { info = await response.json(); } catch {}
    throw Error(info.error || "Bridge error (" + response.status + ").");
  }
  return response;
}
async function refreshStatus() {
  const data = await (await api("status")).json();
  status("Connected", true);
  setText("lessonCount", data.lessonCount + " verified examples");
  if (!data.codexAvailable) setText("connectMessage", "Connected, but Codex CLI is not installed or is not on PATH. See setup.");
  else setText("connectMessage", data.loraReady ? "Codex ready. Cloudflare LoRA configured." : "Codex found. Cloudflare LoRA is not configured yet.");
}
document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => {
  const key = button.dataset.tab;
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("selected", b === button));
  ["think", "compare", "teach"].forEach((name) => q(name + "Panel").classList.toggle("hidden", name !== key));
}));
q("connectBtn").addEventListener("click", async () => {
  const value = q("token").value.trim();
  if (!value) return;
  pairedToken = value;
  try { await refreshStatus(); q("connectCard").classList.add("connected"); q("token").value = ""; }
  catch (error) { pairedToken = ""; status("Not connected"); setText("connectMessage", error.message + " Confirm your local bridge is running."); }
});
q("thinkForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (isBusy) return;
  isBusy = true; lock(e.target, true); setText("thinkOutput", "Thinking via authenticated Codex CLI…");
  try { const json = await (await api("think", { prompt: q("thinkPrompt").value })).json(); setText("thinkOutput", json.answer); }
  catch (error) { setText("thinkOutput", error.message); }
  finally { lock(e.target, false); isBusy = false; }
});
q("compareForm").addEventListener("submit", async (e) => {
  e.preventDefault(); lock(e.target, true);
  setText("baseOutput", "Evaluating unmodified model…"); setText("loraOutput", "Evaluating adapter…");
  const prompt = q("comparePrompt").value;
  const [base, learned] = await Promise.allSettled([
    api("infer", { prompt, mode: "base" }).then((r) => r.json()),
    api("infer", { prompt, mode: "lora" }).then((r) => r.json())
  ]);
  setText("baseOutput", base.status === "fulfilled" ? base.value.answer : base.reason.message);
  setText("loraOutput", learned.status === "fulfilled" ? learned.value.answer : learned.reason.message);
  lock(e.target, false);
});
q("teachForm").addEventListener("submit", async (e) => {
  e.preventDefault(); lock(e.target, true);
  try {
    await api("lesson", { prompt: q("lessonInput").value, ideal: q("lessonAnswer").value });
    q("lessonInput").value = ""; q("lessonAnswer").value = ""; setText("lessonMessage", "Saved locally. No model weights have changed yet.");
    await refreshStatus();
  } catch (error) { setText("lessonMessage", error.message); }
  finally { lock(e.target, false); }
});
q("exportBtn").addEventListener("click", async () => {
  try {
    const response = await api("dataset");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "jarvis-training.jsonl"; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { setText("lessonMessage", error.message); }
});