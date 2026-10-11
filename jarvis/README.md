# JARVIS Neural Lab

An experimental two-path interface for ChatGPT Plus and **genuine** LoRA-based neural adaptation. Not AGENTS.md, vector memory, or a librarian.

## Exactly what works

- THINK: ChatGPT Plus requests using the officially authenticated **Codex CLI**. Codex is oriented toward coding and is not identical to the GPT-6 ChatGPT chat UI. No GPT weights are updated.
- TEACH: Explicit user-authored, verified example pairs stored privately on your Mac. Those are **training examples**, NOT retrieved to answer future queries.
- COMPARE: same Cloudflare-hosted Gemma 2B model, first without and then with an actual LoRA trained using those examples. This is neural adaptation in the answering Gemma model, not in GPT.
- Public site is only an interface. Plus subscription access requires a locally running bridge. No local LLM or GPU required on your Mac.

## 1. Pair the website to ChatGPT Plus

Requirements: Node 22+, ChatGPT Plus subscription and the official Codex CLI.

    npm install -g @openai/codex
    codex login

These steps must be performed locally by the subscription owner. Then from a checkout of this HUB repository:

    npm run jarvis:bridge

The local bridge listens ONLY at http://127.0.0.1:8765 and prints a random pairing token. Visit the JARVIS page on HUB and enter that token. It is intentionally not stored in browser localStorage or GitHub. A terminal/daemon process must remain running for the site to communicate with the bridge.

For local web development, run npm run dev and open http://127.0.0.1:8787/jarvis/ (or the port Wrangler prints).

Security: commands are invoked with a read-only sandbox inside an empty temporary directory, no direct file-edit permissions. Keep the bridge pairing token private.

## 2. Teach it using verified examples

Use TEACH and write your own input/ideal-answer pair. Examples are stored locally in ~/.jarvis-neural-lab/training.jsonl and never automatically injected into the model at inference time.

To export, press Export JSONL. Saving a pair does not update weights. Collect varied examples (the script requires at least 12, but a much larger, high-quality set is needed for robust improvements).

## 3. Train with free cloud GPU time

Open a free Kaggle Notebook GPU runtime (availability and quota are NOT guaranteed), upload the private JSONL, and paste or upload jarvis/train.py.

Run these two Kaggle notebook cells:

    !pip -q install "transformers>=4.45,<5" peft accelerate datasets safetensors sentencepiece
    !TRAIN_JSONL=/kaggle/working/jarvis-training.jsonl python train.py

Accept the model license for google/gemma-2b-it on Hugging Face if requested.

The script uses unquantized Gemma 2B FP16 with a rank-8 LoRA trained on verified data. It produces adapter_config.json and adapter_model.safetensors in jarvis-adapter; holdout.jsonl contains examples EXCLUDED from training. Do not report learning success without tests on unseen examples. To train another version starting with your existing adapter, set PRIOR_ADAPTER to its folder in the Kaggle runtime.

Kaggle GPU allocation may fail or be slow; this is NOT a guaranteed free continuously running training service.

## 4. Deploy the trained adapter to Cloudflare

Cloudflare's LoRA beta supports the specific base @cf/google/gemma-2b-it-lora. The current beta has adapter requirements including a size cap and supported configuration.

Use your own account, sign into Wrangler, then run:

    npx wrangler login
    npx wrangler ai finetune create @cf/google/gemma-2b-it-lora jarvis-v1 /path/to/jarvis-adapter
    npx wrangler ai finetune list

Use the new adapter ID or name; for each retraining version create a new upload/name. The Cloudflare beta does not edit an existing adapter in place.

Set these LOCAL environment variables before restarting the bridge:

    export CF_ACCOUNT_ID="your-account-id"
    export CF_AI_TOKEN="your-private-Workers-AI-token"
    export CF_LORA_ID="jarvis-v1"
    npm run jarvis:bridge

No tokens in a public repository or browser. Do not set CF_AI_TOKEN in public frontend JavaScript. The bridge proxies authenticated Cloudflare calls and returns answers.

In COMPARE, use an unseen test input. The only neural difference is Gemma base vs Gemma + your learned LoRA.

## Privacy and limitations

- No conversation scraping or invisible training. Only examples explicitly saved in TEACH are collected.
- Your verified examples stay on your computer until you deliberately upload them to Kaggle. Cloudflare processes inference requests, and third-party notebooks process what you upload.
- No transfer of these learned weights into GPT itself is possible.
- GPT and Gemma are separate systems. They share a visual interface but NOT internal intelligence.
- Free Workers AI inference is quota-limited (currently 10,000 Neurons/day); free Kaggle GPU allocations may be unavailable.
- You must perform login and account token setup yourself. GitHub access cannot authorize those credentials.
- Do not expose the bridge to the internet or disable its local address, origin checks or pairing token.
- Site may require Cloudflare deployment if not auto-deployed from GitHub.

Official docs: https://developers.openai.com/siwc/token-sharing-open-source ; https://learn.chatgpt.com/docs/cli/reference ; https://developers.cloudflare.com/workers-ai/features/fine-tunes/loras/ ; https://developers.cloudflare.com/workers-ai/platform/pricing/ .
