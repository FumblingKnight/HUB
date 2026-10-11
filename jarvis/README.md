# JARVIS / cloud-only architecture

**No Mac bridge. No Mac-resident model. No API credits.**

## Architecture and hard limitation

Use ChatGPT **inside ChatGPT** as the capable reasoning model. Connect the Cloudflare Worker in this repo as a remote MCP plugin. The Worker hosts a *separate* Gemma 2B model that can apply your fine-tuned LoRA.

**GPT weights never change**. Neural adaptation occurs only in Gemma. The learned adapter does not get inserted as prompt memory into GPT. There is no AGENTS.md, RAG or always-running Mac process. The HUB website is a dashboard with setup guidance, not a backdoor to use ChatGPT Plus as a hosted website API.

Relevant docs:
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://developers.openai.com/siwc/token-sharing-open-source (Plus in remotely hosted third-party apps is not the same as MCP inside ChatGPT)
- https://developers.cloudflare.com/workers-ai/features/fine-tunes/loras/
- https://developers.cloudflare.com/workers-ai/platform/pricing/

## One-time cloud setup (no terminal needed)

1. Create a separate **Cloudflare Worker** with this source at jarvis/cloud/worker.mjs, using its jarvis/cloud/wrangler.toml file. Alternatively, use **GitHub Actions → Deploy JARVIS Cloud → Run workflow**, after you add the repository secrets below. This does NOT modify the existing HUB worker.

2. In **GitHub repository Settings → Secrets and variables → Actions**, add CLOUDFLARE_API_TOKEN (restricted deploy permission) and CLOUDFLARE_ACCOUNT_ID. On Cloudflare Worker settings, create a **secret** named JARVIS_PLUGIN_TOKEN: a long random secret you generate yourself. Never enter it in GitHub code or a public URL. The Worker **refuses every /mcp request until the secret is configured**.

3. Open Cloudflare Worker URL /health. It should say adapterDeployed:false and database:false on first setup. Public health reports **no personal information**.

4. In **ChatGPT → Plugins → Add custom MCP server**, add your Worker HTTPS URL ending in /mcp, and configure the connection authentication for the bearer secret you configured. Check that the connection UI supports the chosen auth method for your workspace; **this step has not been verified against your account**. Do not select no-auth just to bypass it. Install the resulting private plugin.

5. Ask ChatGPT to run neural_training_status. For a base-versus-LoRA test, use compare_neural_models. Until you upload an actual LoRA, it correctly says *not trained*.

## Persistent training examples in Cloudflare, never GitHub

To enable explicit example storage (optional until you're ready to train):

- Create a Cloudflare D1 database named jarvis-neural-data in Cloudflare dashboard.
- Run the SQL from jarvis/cloud/schema.sql in its console.
- Add its actual database_id to [[d1_databases]] in jarvis/cloud/wrangler.toml and uncomment the binding; redeploy.
- Then ask ChatGPT to record a specific training example that you **explicitly approve**. The plugin will require user_confirmed=true. Nothing is silently collected.
- Use export_training_batch to retrieve batches of JSONL when you explicitly start training. These are training records, NOT information used for GPT answers.

## Fine-tune without local compute

1. Use a free **Kaggle notebook GPU**, when quota and availability allow.
2. Supply your private exported examples to the notebook; run jarvis/train.py as described in the file.
3. Download the resulting adapter_config.json and adapter_model.safetensors (do not add private examples or adapters to this **public** repository).
4. Upload them via Cloudflare's dashboard/CLI/REST API (the Cloudflare LoRA documentation gives the supported paths).
5. Set **JARVIS_LORA_ID** as a Worker environment variable referencing that deployed adapter; redeploy if required.
6. Ask ChatGPT to run compare_neural_models with new prompts. Compare the same base model with and without updated LoRA. Hold out unseen tests to measure whether the update generalizes.

Cloudflare's LoRA adapter hosting is currently beta and free; **AI inference still has a free daily cap**. Kaggle GPU is quota-limited. No unmetered always-on, automatic retraining service is promised.

## Deploy without a Mac terminal

This repository includes .github/workflows/deploy-jarvis-cloud.yml. After the two GitHub Actions secrets are set, go to the GitHub **Actions** tab and manually run the workflow. It deploys a separate Worker named jarvis-neural-lab. Keep the private plugin token in the **Cloudflare Worker secret configuration**, not a GitHub Action input.

The Worker is a **private one-user MCP service**. Authentication is required on /mcp. Protect the D1 database and do not expose raw training data to the public website.

## What remains unverified

The repo's CI verifies MCP JSON-RPC tool negotiation, authentication, Cloudflare inference invocation shape, and Python syntax. This does **not** verify your cloud deployment, ChatGPT plugin pairing, LoRA quality, or your account's free quotas.

If your ChatGPT plugin connection requires an OAuth discovery provider rather than a static bearer token, we must implement that provider or use an authorized hosting option. Never remove access controls to work around an authentication mismatch.
