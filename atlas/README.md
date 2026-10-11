# ATLAS — persistent AI librarian

**Goal:** You say something once. The librarian identifies entities, reconciles them against existing knowledge, updates or creates pages, discovers cross-topic overlaps, assigns priorities, records evidence, and keeps the graph readable months later.

## Status

- Graph logic, provenance, contradictions, entity matching, typed links and private cloud UI are implemented in the public HUB **source code**.
- **No personal knowledge** belongs in the public HUB repository.
- The separate **private** repository `FumblingKnight/Sajo-Atlas` must be created by the user first. It will contain `vault.json` as the canonical graph.
- Cloudflare ATLAS is a separate Worker from HUB and JARVIS. It refuses access until verified Cloudflare Access is configured.
- ChatGPT can maintain the vault through the connected GitHub app when asked to be the librarian. It cannot monitor every conversation automatically or guarantee every new chat reads the vault without invoking the GitHub connection.
- Website capture stores notes as **unprocessed** until an AI librarian processes them. There is no paid hidden LLM API and no false claim of continuous learning.

## Design principles

1. **Page**: stable UUID, title, aliases, type, summary, priority, tags, independent evidence-backed claims, timestamps.
2. **Connection**: edge between two real pages, with relationship type, direction, importance, confidence, source and evidence. Reverse backlinks generated automatically.
3. **Truth and provenance**: original user statements/sources are preserved; explicit facts versus inferred links are distinguished; disputed claims coexist until resolved.
4. **Entity resolution**: exact name/alias matches update the existing page. Fuzzy candidates trigger human/AI review instead of silently merging identities.
5. **Time**: Git commits + per-entity events ensure durable changes; contradictory updates are not erased.
6. **Prioritization**: P0 minor, P1 secondary, P2 established, P3 central. Edges have separate priorities; not every similarity should become an edge.
7. **Retrieval**: lexical/alias search + graph traversal; the librarian must search the vault before edits. Embeddings may later improve candidate recall but cannot become the source of truth.
8. **No lock-in**: `vault.json` is human-readable, versioned, portable and backed by GitHub history. Split into shards and build indexes if scale warrants it.

## Important: finish one-time setup

### 1. Create private data repository

Open https://github.com/new and create **Sajo-Atlas** under **FumblingKnight**. Choose **Private** and initialize with a README. Never turn it public. This is distinct from the existing (public) HUB and from your existing private Philomathy vault.

The GitHub connector currently cannot create repositories, so this is the one GitHub action the user must do. When it exists, ask the librarian to initialize it. The librarian can create `vault.json` using `atlas/templates/vault.json` from HUB and can then add a private `LIBRARIAN.md` containing operational instructions.

**If the GitHub app cannot access the new private repo:** in your GitHub account settings, find the ChatGPT GitHub app installation and add **Sajo-Atlas** to its selected repositories. Do not grant unrelated repositories unnecessarily.

### 2. Deploy separate private cloud Worker

Merging the ATLAS code to HUB main **automatically deploys** its separate Worker through GitHub Actions. You can also use HUB GitHub Actions → **Deploy ATLAS private Worker** → Run workflow to redeploy manually. Existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets are reused. This deploys `sajo-atlas` as a **new** Worker; it does not modify HUB or JARVIS.

Its endpoint will be `https://sajo-atlas.thefumblingknight.workers.dev` if that account subdomain remains unchanged. **The deployed Worker initially returns HTTP 503**, deliberately.

### 3. Protect the Worker with Cloudflare Access

In Cloudflare Zero Trust / Workers & Pages, create an Access application protecting **only** the `sajo-atlas` production Worker. Configure an Allow policy for **only your own verified email**. See https://developers.cloudflare.com/workers/configuration/cloudflare-access/ .

From the Access application, retrieve the **Application AUD** value; from Zero Trust team configuration, retrieve the team domain (e.g. `example.cloudflareaccess.com`). In the `sajo-atlas` Worker settings add environment variables:

- `CF_ACCESS_TEAM_DOMAIN` = your actual team domain.
- `CF_ACCESS_AUD` = that protected app's Access Application AUD.

The Worker cryptographically verifies JWT signatures against your Access team's published keys and checks issuer, audience, and expiry. It does not trust an unauthenticated HTTP header or make the site public when config is absent.

### 4. Connect the private GitHub graph (server side)

Create a **fine-grained GitHub personal access token** limited to exactly the private **Sajo-Atlas** repository, with only **Contents: Read and write**. In Cloudflare Worker → Settings → Variables and Secrets, add as a **Secret** named `ATLAS_GITHUB_TOKEN`. Never place it in HUB, JavaScript, URL, screenshot, or ChatGPT.

Set ordinary Worker variable `ATLAS_REPOSITORY` to `FumblingKnight/Sajo-Atlas` (already the default in `atlas/cloud/wrangler.toml`).

Now the UI can read the private vault via the authorized Worker, queue raw notes, and reconcile structured edits. GitHub file SHA preconditions and retries prevent silent overwrites when changes happen concurrently.

### 5. Start using ChatGPT as librarian

Say: **"Librarian: remember that ..."** or **"Put this in my ATLAS"**. In a chat where the GitHub connector is available, the assistant should:

1. Retrieve `FumblingKnight/Sajo-Atlas/vault.json` and inspect existing entities, aliases, graph neighborhoods, sources, reviews and inbox.
2. Identify facts, entities, claims, relationships, confidence and candidate overlaps from your new information. Never claim verification when only your statement is available.
3. Reconcile into existing pages when identification is clear. On ambiguity, ask the user rather than inventing an edge.
4. Commit the changes to **the private Sajo-Atlas repo only**, retaining stable IDs, sources, priorities and history. Avoid creating duplicate near-synonym pages.
5. Confirm what was added, updated, connected or marked for review. For large or sensitive submissions, confirm before persistence.
6. On later requests, **retrieve** the vault again: built-in ChatGPT memory alone is not a sufficient guarantee of long-term graph consistency.

You can also write a note directly on the web UI. This will queue it in `inbox`, but it **does not automatically extract structured knowledge** without a future authorized librarian pass.

## Implemented HTTP API

All routes (including UI assets) require a verified Cloudflare Access identity, and data never ships in static asset builds.

- `GET /api/graph`: private graph JSON (authenticated).
- `POST /api/inbox`: raw note (up to 8,000 chars), queued as unprocessed, never misleadingly marked as classified.
- `POST /api/entity`: structured entity reconciliation using `atlas/core.mjs`. Returns a review item rather than making uncertain fuzzy merges. This is for authorized UI workflows, not an unauthenticated webhook.

## Known limitations and future development

- The current `vault.json` is a **first-version** portable store, suitable for initial growth, not an infinitely scalable graph database. Evolve to sharded entity files, an indexed read model and search after real use warrants it.
- Automatic semantic extraction of webpage inbox notes needs a trigger into an authorized AI session or a separately deployed model/API; ChatGPT Plus cannot be assumed to provide a free always-running backend inference API.
- Relationship inference cannot legitimately mean "connect everything to everything." Valuable links need types, confidence, evidence and relevance; weak/noisy relations stay suggested.
- Revisions currently have Git history and an in-graph event log. Advanced graph diffing, automatic contradiction adjudication and a review queue editor remain future work.
- The private GitHub PAT has write authority to the vault. Protect and rotate it as you would any other secret.
- No local Mac daemon is needed; this is a cloud-first architecture with a private Git backend.


## Image and media architecture

ATLAS distinguishes **knowledge** (versioned private Git), **binary assets** (private Cloudflare R2), and **derived indexes** (optional future D1). This prevents images from swelling the Git repository on every revision. Private image upload and authenticated viewing are implemented: users attach PNG, JPEG, WebP or GIF images up to 8 MiB to a selected encyclopedia page; the binary goes to R2 while only its immutable ID, key, file size, caption, alt text and page association go in \`vault.json\`. Reusing an image across pages can later be implemented as an additional association, without a second R2 object.

**R2 setup is optional; text-only graph usage works without it.** In the Cloudflare dashboard:

1. Open R2 Object Storage and create a **Standard-class PRIVATE** bucket named \`sajo-atlas-media\`. Do NOT turn on public access or an \`r2.dev\` public endpoint. Cloudflare may require enabling R2 for your account.
2. In HUB's \`atlas/cloud/wrangler.toml\`, add:
   \`\`\`toml
   [[r2_buckets]]
   binding = "MEDIA"
   bucket_name = "sajo-atlas-media"
   \`\`\`
3. Commit this configuration to HUB and wait for the ATLAS deploy workflow; the Worker will gain the \`MEDIA\` binding. Binding R2 does **not** require S3 keys. If your account does not have R2 provisioned or your deployment token lacks R2 binding permissions, stop and leave media unconfigured rather than exposing a public bucket.
4. In ATLAS, open a page and use the private Attach image control. File magic bytes are validated against content type; SVG/HTML uploads are rejected. Files remain inaccessible without Cloudflare Access authentication.

All uploads are stored in the private R2 bucket and retrieved through \`GET /api/media/:id\` only after Access authorization. \`POST /api/media\` validates origin, entity existence, file length, MIME and image signature. The Worker deletes the new R2 object if metadata persistence fails.

**Free-tier planning, checked October 2026:**

- GitHub recommends small repos (ideally under 1 GB) and individual Git objects around 1 MB. GitHub REST Contents API supports normal JSON reads only up to 1 MB; therefore this first-version monolithic \`vault.json\` must be sharded before reaching that threshold. The LIBRARIAN.md protocol recommends planning this at ~500 KB.
- Git LFS free allowance is 10 GiB storage and 10 GiB/month bandwidth on GitHub Free; unnecessary for this architecture.
- R2 Standard free monthly allowance is 10 GB-month storage, 1 million Class A ops and 10 million Class B ops, with free Internet egress. **These are allowances, not guaranteed hard spending limits.** Set billing/budget alerts or a zero-dollar spending limit where available and monitor R2 usage.
- D1 Free offers 5 GB total, 500 MB per database, 5 million rows read/day, 100,000 rows written/day. D1 is useful for a future derived graph/search index, not as the only source of truth.

Official docs:
- https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits
- https://docs.github.com/en/rest/repos/contents
- https://docs.github.com/en/billing/concepts/product-billing/git-lfs
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/r2/get-started/workers-api/
- https://developers.cloudflare.com/d1/platform/limits/

