# Jantar Mantar timeline — publication contract

This directory is the **sole public data store** for the timeline at `/protest/`.

- `events.json`: canonical fact/event ledger and separate Reddit discussion desk.
- `index.html`: presentation layout.
- `site.css`: presentation styles.
- `app.js`: frontend data reader, filters, deduplication, error handling.

## Data contract v2

`schema_version: 2` and:

```json
{
  "meta": {
    "title": "Jantar Mantar / October 10",
    "location": "New Delhi, India",
    "timezone": "Asia/Kolkata",
    "scheduled_for": "2026-10-10",
    "event_status": "planned",
    "last_checked_at": "2026-10-09T00:00:00.000Z",
    "published_at": "2026-10-09T00:00:00.000Z",
    "notice": "...",
    "methodology": "..."
  },
  "events": [],
  "discussions": [],
  "history": []
}
```

Every `events[]` item needs a **stable and unique** `id`, `date` (YYYY-MM-DD), `title`, `category`, `description`, `status`, and `sources` array. Optional: `event_time` (ISO8601 with offset *only when verifiable*; otherwise null), `event_time_display` (explicitly identify publication-time vs event-time), `context`, `evidence` (array of concise source-grounded strings), `priority` (`major` or `standard`). Valid statuses: `confirmed`, `corroborated`, `unverified`, `disputed`. **Confirmed means the described development occurred or statement was made, not that every allegation embedded in it is correct.**

A source is `{"label":"Publisher / item","url":"https://...","type":"wire|report|primary|reddit|video","note":"publication time / caveat"}`. Use actual direct links only. Do not attach a topical homepage or fabricated deep URL.

`discussions[]` items need stable `id`, `date`, `community`, `title`, `url`, `summary`, `signal` (evidentiary caveat), `kind`, optional `related`. These are reader-relevant discussions, not confirmed protest events.

## Editorial rules

1. Read the *current* `events.json` and exact GitHub blob SHA before editing. Do not rely on cached chat history or recreate an older copy.
2. Confirm a new fact with primary or credible reporting; attach precise working source links.
3. Compare the underlying **who/what/when/where**, not titles alone. Update existing records when a report supplies new detail or contradicts an earlier version. New entries are only for distinct underlying developments. Keep IDs stable. Never renumber.
4. Separate police statements, organiser claims, eyewitness accounts, Reddit commentary, and independent observations. No engagement, repost or headline counts are considered independent verification. Attribute political allegations to their speakers.
5. Preserve every existing item and citation unless there is evidence it is false, redundant, or the link is broken; document corrections in `history`.
6. Use Indian Standard Time for public display. NEVER invent time-of-day when only a publication date is available.
7. The primary task checks news at HH:00. The secondary pass at HH:05 enriches evidence and discussions, avoiding duplicate entries or redundant website redesigns.
8. On every primary check, update `meta.last_checked_at` to the actual time the research finished; only update `meta.published_at` and append to `history` on meaningful source/content changes. If the site is not deployed, do not imply it is.
9. Before writing, validate all required fields, URL schemes, duplicate IDs, unique event+date pairs, and original JSON parseability. Use `update_file` with current SHA. On concurrent edit failure, refetch, merge and retry once; never force overwrite newer work.
10. Do not fabricate events to populate empty hours. Do not delete `discussions[]` just because a later search missed the thread. Keep update history compact (e.g. last 40 changes); Git history preserves older revisions.
11. Keep this publication strictly informational. Present police/organiser/opposition claims with context and uncertainty rather than endorsements. Never describe CJP as a formally ECI-registered electoral party without registration evidence.

## UI deployment and monitoring

The browser requests `/protest/events.json` with a fresh cache-busting query every five minutes while visible, and again when the tab regains focus. The response is validated and the UI recovers from transient fetch failures.

Changes committed in GitHub do not necessarily mean Cloudflare has published them. Check actual website deployment separately. No notification delivery is required; the user reads the site directly.
