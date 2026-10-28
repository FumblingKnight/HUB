# Mira Newspaper cloud runner

This directory contains **generic public runner code only**. Personal newspaper
content, reader feedback, editorial history, and OAuth state belong in the
private `FumblingKnight/Sajo-Atlas` repository.

## Runtime model

- GitHub Actions provides ephemeral compute.
- Hermes Agent provides the agent runtime.
- OpenAI Codex OAuth supplies inference. The cloud runner must use its **own**
  OAuth login; never copy/share an actively refreshed credential with another
  Hermes machine.
- `gpt-5.6-sol` with high reasoning is pinned by the workflow.
- Deterministic code gathers RSS/Atom leads and direct publisher-page evidence.
- Model-generated primary URLs are rejected unless they exist in the candidate
  set gathered by code.
- Urgent alerts require two candidate sources from different publishers.
- Private GitHub files are the durable memory authority.

## Private files

Expected under `mira/newspaper/cloud/` in Sajo-Atlas:

- `editorial_memory.md`
- `state.json`
- `candidate_buffer.json`
- `archive_index.json`
- `auth.enc` after one-time bootstrap

The encrypted OAuth blob uses AES-256-GCM. Its key is a GitHub Actions secret,
not repository content.

## Modes

- `smoke`: syntax/path verification; no private repo or AI needed.
- `auth-check`: verify the dedicated cloud OAuth credential with one tiny
  GPT-5.6 Sol call.
- `hourly`: selective 0–3 story edition.
- `morning`: deeper daily edition with themes, context, rabbit hole and
  watch-next list.

The workflow is intentionally serialized because OAuth refresh state is mutable.

## Research split

Hourly runs are intentionally boring infrastructure: publisher/community feeds are fetched by bounded deterministic code, direct publisher pages are sampled, then Hermes performs one GPT-5.6 Sol High editorial pass with no general browsing tool. This keeps the hourly job predictable and prevents a tool loop from blocking the schedule.

Morning runs scan the full source registry, fetch a larger set of publisher pages, include two rotating community feeds, and give GPT-5.6 Sol High a substantially larger synthesis brief. The model still cannot publish a primary URL that deterministic collection did not supply.

Community feeds are discovery/reaction signals only. They are kept out of the primary candidate set, and a model-proposed discussion link is accepted only if that exact URL was collected from an allowed community feed.

## One-time owner bootstrap

After this code is merged to `main`, run on the owner Mac:

```bash
bash atlas/mira-agent-lab/cloud-news/bootstrap_cloud.sh
```

The script keeps schedules disabled until it has: configured a write deploy key, stored the OAuth-encryption key in macOS Keychain and GitHub Actions, optionally configured the Discord bot, created a **dedicated** Codex OAuth identity in a separate Hermes home, encrypted that auth state into the private repository, and passed `auth-check`, `hourly`, and `morning` cloud workflow runs.

It deliberately never copies the ordinary Mac `~/.hermes/auth.json` into CI.

## Schedule

- Hourly discovery: minute 17 of each hour (GitHub UTC scheduler).
- Premium morning edition: 02:55 UTC, which is 08:25 IST. The target is to have the edition ready around 08:30 IST rather than starting the heavier job at 08:30.

Scheduled runs remain inert until the repository variable `MIRA_NEWSPAPER_CLOUD_ENABLED` is set to `true` by the successful bootstrap.
