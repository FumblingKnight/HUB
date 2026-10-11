# ATLAS — private personal encyclopedia and knowledge graph

ATLAS stores structured knowledge in a **separate private GitHub repository** (`FumblingKnight/Sajo-Atlas`) and provides a private browsing interface through a Cloudflare Worker. Source code remains in public `FumblingKnight/HUB/atlas`; no private knowledge belongs in HUB.

## Current free / no-card configuration

The deployed Cloudflare Worker uses a **single-user passphrase login**, with signed seven-day `Secure`, `HttpOnly`, `SameSite=Strict` session cookies. You do **not** need Cloudflare Zero Trust, R2, GitHub OAuth or a local Mac process. This is suitable for a personal site with a strong passphrase; it does not offer phishing-resistant two-factor authentication, and a strong unguessable password is essential.

### Remaining two one-time Worker secrets

In [Cloudflare dashboard](https://dash.cloudflare.com/) open **Workers & Pages → sajo-atlas → Settings → Variables and Secrets**.

1. Add **Secret** `ATLAS_LOGIN_PASSPHRASE`. Generate a UNIQUE random password (32 or more random characters recommended; minimum 9 with at least one letter, one digit and one special character), and keep it in your password manager. Do not share it in chat or put it in GitHub.
2. Add **Secret** `ATLAS_GITHUB_TOKEN`. Generate a [fine-grained GitHub personal access token](https://github.com/settings/personal-access-tokens/new) for the **FumblingKnight** owner, select repository access **only** to private `Sajo-Atlas`, and choose **Repository permissions → Contents: Read and write**. Save the token in the same Cloudflare Secrets panel, not in Git or client JavaScript.

Existing public configuration `ATLAS_REPOSITORY = "FumblingKnight/Sajo-Atlas"` must remain unchanged. Apply/Deploy the secrets as the Cloudflare UI requests. Then visit **https://sajo-atlas.thefumblingknight.workers.dev/login** and sign in with the passphrase.

Only the login page and its CSS/JS are accessible without an authenticated cookie; the API and private pages remain locked by default. The Worker stores the GitHub token only on the server.

## Everyday workflow

- Tell ChatGPT **"Put this in ATLAS: ..."**; the librarian retrieves private `vault.json` via the GitHub connector, reconciles aliases, creates/updates claims and typed connections, saves source provenance, and commits changes.
- Later say **"Check ATLAS for overlap with ..."**, and it must read the current private vault rather than guessing from built-in memory.
- Visit the website to search, navigate pages, see direct/indirect graph links, and attach images.
- Website inbox entries are stored as **unprocessed**. Automatic LLM analysis of website inbox entries is **not** included; ChatGPT has to process them through the connected GitHub app. ChatGPT Plus is not a continuously running AI backend.

## Images without R2 or billing

Occasional PNG, JPEG, WebP and GIF page images are stored inside the **private** `Sajo-Atlas` GitHub repository under `media/<uuid>.<ext>`; the browser never sees a GitHub access token or private raw URLs.

- Up to **700 KB per image** after conversion. JPEG/PNG/WebP images up to 12 MiB can be downsampled/compressed to WebP in the browser. GIF must already be below the limit.
- Captions, searchable alt text, SHA-256 file digest, MIME type and related page IDs stay in the graph; identical binary content is reused rather than re-uploaded.
- Media is retrieved via authenticated ATLAS endpoints; users never receive GitHub API tokens.
- **Git history keeps binary files even after deletion**, so this is appropriate for occasional images, not a large photo/video library. If images grow substantially, choose external private object storage or Git LFS later. Use frequent independent vault backups.

## Knowledge model

The canonical `vault.json` contains entities, directed typed weighted relationships, evidence-backed claims, sources, review queue, inbox, media references, and change events. Exact titles and aliases reconcile into existing pages; ambiguous near matches enter review rather than silently merging.

Priorities (0–3) represent relevance independently for each page and each connection. Assertions versus inferences are kept distinct, and conflicting facts can coexist pending resolution.

Git is the **permanent record**, not ChatGPT neural weight training or automatically shared memory. A future conversation must retrieve this repository to recover graph relationships.

## Limits and scale

The first implementation uses a single `vault.json` in the private repo. Writes refuse graph data above **750 KB** to avoid GitHub Contents API's 1 MB read limit. Before growth approaches 500–750 KB, migrate to sharded entity files and a generated indexed read model. The current site downloads the graph after login and renders a focused subset of nodes; it does not provide graph database scale yet.

GitHub recommends repository sizes well under a few GB; keep this one preferably below 1 GB, particularly because Git retains historical images. Avoid storing sensitive passwords, credentials, or private data you don't want permanently persisted.

## Deployment and tests

HUB's CI validates ATLAS on every push/PR. On merge to `main`, the workflow **Deploy ATLAS private Worker** deploys the separate Worker automatically using existing Cloudflare Actions secrets. Source code remains separate from the rest of HUB and its other Workers.

Relevant files:
- `atlas/cloud/worker.mjs`: authorized API, GitHub vault storage and login entry.
- `atlas/cloud/session.mjs`: password verification and signed cookie sessions.
- `atlas/cloud/github-media.mjs`: private GitHub image storage.
- `atlas/site/`: static encyclopedia/graph UI and login assets.
- `atlas/core.mjs`: deterministic knowledge reconciliation.
- `FumblingKnight/Sajo-Atlas/LIBRARIAN.md`: durable instructions for the AI librarian.

## Security caveat

A nine-character password is significantly easier to guess than a long random passphrase even with rate limiting; choose an unpredictable password and use a password manager. The Worker now rejects login requests above eight attempts per minute per Cloudflare location (approximately, because distributed rate limit counters are eventually consistent). This simple passphrase-based authentication is a cost-free compromise, not an enterprise identity system. Choose a unique, long random passphrase, do not reuse credentials, and rotate secrets if exposed. The Cloudflare Worker handles only a personal knowledge vault and should not contain credentials or high-stakes secrets among page contents.
