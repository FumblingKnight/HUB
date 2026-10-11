> **Important — 2026-10-11:** ChatGPT Plus does not currently support installing this custom MCP app. OpenAI's developer-mode documentation limits full custom MCP to Business and Enterprise/Edu (with restricted Pro support). This project cannot use your Plus subscription to call the Cloudflare Worker from ChatGPT. Adding OAuth alone will **not** fix plan eligibility. Do not disable authentication or upgrade your plan solely on the basis of this prototype.
>
> Source: https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt

# JARVIS / cloud-only architecture

**No Mac bridge. No Mac-resident model. No API credits.**

## Architecture and hard limitation

The planned approach was to use ChatGPT **inside ChatGPT** as the reasoning model and connect a remote MCP plugin. **That connection is not available on ChatGPT Plus.** The Worker hosts a *separate* Gemma 2B model that can apply your fine-tuned LoRA.

**GPT weights never change**. Neural adaptation occurs only in Gemma. The learned adapter does not get inserted as prompt memory into GPT. There is no AGENTS.md, RAG or always-running Mac process. The HUB website is a dashboard with setup guidance, not a backdoor to use ChatGPT Plus as a hosted website API.

Relevant docs:
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/siwc/token-sharing-open-source (Plus in remotely hosted third-party apps is not the same as MCP inside ChatGPT)
- https://developers.cloudflare.com/workers-ai/features/fine-tunes/loras/
- https://developers.cloudflare.com/workers-ai/platform/pricing/

## Cloud deployment (already completed; Plus connection blocked)

1. Create a separate **Cloudflare Worker** with this source at jarvis/cloud/worker.mjs, using its jarvis/cloud/wrangler.toml file. Alternatively, use **GitHub Actions → Deploy JARVIS Cloud → Run workflow**, after you add the repository secrets below. This does NOT modify the existing HUB worker.

2. In **GitHub repository Settings → Secrets and variables → Actions**, add CLOUDFLARE_API_TOKEN (restricted deploy permission) and CLOUDFLARE_ACCOUNT_ID. On Cloudflare Worker settings, create a **secret** named JARVIS_PLUGIN_TOKEN: a long random secret you generate yourself. Never enter it in GitHub code or a public URL. The Worker **refuses every /mcp request until the secret is configured**.

3. Open Cloudflare Worker URL /health. It should say adapterDeployed:false and database:false on first setup. Public health reports **no personal information**.

4. **STOP:** ChatGPT Plus cannot connect this custom MCP endpoint under the currently documented plan limits. This is an experimental Worker endpoint, not a functional Plus integration. Keep authentication enabled.

## Persistent training examples in Cloudflare, never GitHub

To enable explicit example storage (optional until you're ready to train):

- Create a Cloudflare D1 database named jarvis-neural-data in Cloudflare dashboard.
- Run the SQL from jarvis/cloud/schema.sql in its console.
- Add its actual database_id to [[d1_databases]] in jarvis/cloud/wrangler.toml and uncomment the binding; redeploy.
- With a supported MCP client, record a specific training example that you **explicitly approve**. The plugin will require user_confirmed=true. Nothing is silently collected.
- Use export_training_batch to retrieve batches of JSONL when you explicitly start training. These are training records, NOT information used for GPT answers.

## Fine-tune without local compute

1. Use a free **Kaggle notebook GPU**, when quota and availability allow.
2. Supply your private exported examples to the notebook; run jarvis/train.py as described in the file.
3. Download the resulting adapter_config.json and adapter_model.safetensors (do not add private examples or adapters to this **public** repository).
4. Upload them via Cloudflare's dashboard/CLI/REST API (the Cloudflare LoRA documentation gives the supported paths).
5. Set **JARVIS_LORA_ID** as a Worker environment variable referencing that deployed adapter; redeploy if required.
6. Use an authorized MCP client to run compare_neural_models with new prompts. Compare the same base model with and without updated LoRA. Hold out unseen tests to measure whether the update generalizes.

Cloudflare's LoRA adapter hosting is currently beta and free; **AI inference still has a free daily cap**. Kaggle GPU is quota-limited. No unmetered always-on, automatic retraining service is promised.

## Deploy without a Mac terminal

This repository includes .github/workflows/deploy-jarvis-cloud.yml. After the two GitHub Actions secrets are set, go to the GitHub **Actions** tab and manually run the workflow. It deploys a separate Worker named jarvis-neural-lab. Keep the private plugin token in the **Cloudflare Worker secret configuration**, not a GitHub Action input.

The Worker is a **private one-user MCP service**. Authentication is required on /mcp. Protect the D1 database and do not expose raw training data to the public website.

## What remains unverified

The repo's CI verifies MCP JSON-RPC tool negotiation, authentication, Cloudflare inference invocation shape, and Python syntax. This does **not** verify your cloud deployment, ChatGPT Plus plugin pairing (unsupported), LoRA quality, or your account's free quotas.

OAuth support alone does not enable custom MCP on ChatGPT Plus. For free cloud-only experimentation, train an open-weight model separately; this does not transfer knowledge into GPT.
