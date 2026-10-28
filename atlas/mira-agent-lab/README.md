# Mira free-cloud AI feasibility probe

Status: **isolated proof, NOT a production agent**. This is intentionally independent from the deployed `sajo-atlas` Worker, ATLAS, Signals, personal memory and the Work handoff. This directory contains no personal data.

Aim: establish whether the existing Cloudflare account can execute a bounded LLM inference without the Mac and without introducing a paid API provider, using Cloudflare Workers AI's free allocation.

- `node --test atlas/mira-agent-lab/worker.test.mjs` tests the route without network or credentials.
- Only `POST /probe` with `{"kind":"public-smoke"}` may invoke AI, using a fixed public prompt. No user text or private GitHub context is ever sent to the model.
- A GitHub workflow runs tests on PR/push, with **no Cloudflare secrets**.
- The live remote test is **manual opt-in only** via the separate `Mira free cloud AI probe` workflow's `run_live_ai` switch; it uses already-configured Cloudflare deploy credentials, does not publish the Worker, and exits after a single request. Remote development consumes real Workers AI allocation. On a paid Workers AI plan, overage beyond the free daily allocation can be billed; verify current plan/usage before enabling.
- Do not wire the deployment workflow for `atlas/cloud/` to this experiment.
- Do not install Hermes or OpenClaw into an Actions runner with private checkout/secrets until the free inference and data isolation question is resolved.
- GitHub Models was retired July 30, 2026. Hermes' anonymous OpenCode Free provider was removed upstream after 403 responses; don't plan around either.

Acceptance gate: one actual, verified live inference (model, response, zero extra charge confirmation) before adding a task runner, private memory context, tool calls, scheduled execution or user notifications. Existing Mira remains paused except this bounded user-requested feasibility effort.
