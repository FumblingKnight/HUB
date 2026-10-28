# Mira ephemeral Hermes feasibility test

Status: **cloud-runner integration experiment, NOT a deployed autonomous assistant**. Isolated from the deployed ATLAS Worker and private Mira memory. No new paid account, hosted server, or cron job.

Simplest target: GitHub Actions runs Hermes for a bounded one-shot task, using Cloudflare Workers AI through an OpenAI-compatible endpoint **only after its free plan and credential scope are verified**. The existing website/ATLAS remain untouched.

## Proven or testable with no secrets
- `node --test atlas/mira-agent-lab/worker.test.mjs` checks the existing fixed-input Cloudflare Worker route with a mocked model (no inference).
- `ci-mock-model.py` runs on 127.0.0.1 only and always returns `HERMES_CI_OK`; `ci-hermes-smoke.sh` invokes the **real Hermes CLI** using its documented one-shot mode. The mocked model proves integration and installation, **not** intelligent reasoning.
- GitHub workflow installs Hermes non-interactively on an ephemeral runner and never passes Cloudflare or private GitHub credentials to Hermes.
- Separately, on main-branch push the workflow attempts an account subscription **read-only** preflight using the existing Cloudflare token. If it lacks billing read permission, the result stays **unverified**. This step does **not** call a model, create a subscription, or print billing details.

## Model choice
The previous `@cf/meta/llama-3.1-8b-instruct` is deprecated and has <8K context. Hermes requires >=64K. The probe now targets `@cf/openai/gpt-oss-20b` (128K context, function calls, normal Workers AI free eligibility). Current pricing: Workers Free 10,000 neurons/day then hard cutoff; Workers Paid can bill for overages. We are not enabling live inference until the **actual account status and free-only controls** are established. No free inference is assumed just because an account exists.

## Next gate
If no billable usage can occur, send **one fixed public prompt** through Cloudflare and prove the actual model output, then connect an isolated Hermes one-shot using a least-privilege path. Do not hand the existing Cloudflare deploy API token to Hermes. No arbitrary internet-borne prompt, private repo contents, scheduled jobs or autonomous tools before a separately verified safety test. The earlier ChatGPT Work PR bridge remains separate.
