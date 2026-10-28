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
