# Protest timeline — writer contract (schema v3)

**Canonical site:** `/protest/`. **Canonical data:** `public/protest/events.json`. Two ChatGPT tasks update the same JSON through the GitHub connector: researcher at HH:00 IST, editor at HH:05 IST. Website code in `index.html`, `site.css`, `app.js` is stable and should not be re-designed hourly.

## The entire time rule

There are exactly **three machine-readable clocks**, each ISO 8601 with explicit +05:30 offset, or `null`:

| Field | Meaning | Example | What the website labels it |
|---|---|---|---|
| `occurred_at` | Confirmed time the incident **happened** | `2026-10-09T11:02:00+05:30` | EVENT TIME |
| `reported_at` | Independently sourced **article/post publication** time | `2026-10-09T11:02:00+05:30` | REPORTED |
| `scheduled_at` | Publicly **scheduled** future action, not confirmation it happened | `2026-10-10T10:00:00+05:30` | SCHEDULED |

**NEVER copy a publication time into `occurred_at`.** When event clock unavailable but report clock known, use `occurred_at:null`, `reported_at:<timestamp>`. The left rail then displays `09 OCT · 11:02 · REPORTED`. Never write freeform strings like "Time unknown" or manually embed publication times into headline text. If all clocks are null, the rail displays `DATE ONLY`, never a made-up time.

The mandatory `date` is the known event calendar day or the day reporting emerged if event day is not established (`YYYY-MM-DD`). If an incident happened on a different date than its article was published, put the known incident date in `occurred_on`, with exact incident time unknown. The UI marks `INCIDENT: 08 OCT` while correctly labelling `16:40 · REPORTED` for the linked article the next day. Do not infer exact clock time from vague phrases ("Thursday morning"). Frontend parses fields, **never** `event_time_display`; that legacy field was removed.

## Data schema

```json
{
  "schema_version": 3,
  "meta": {
    "title": "Jantar Mantar / October 10",
    "location": "New Delhi, India",
    "timezone": "Asia/Kolkata",
    "scheduled_for": "2026-10-10",
    "event_status": "planned",
    "last_checked_at": "2026-10-09T15:00:00.000Z",
    "published_at": "2026-10-09T15:00:00.000Z",
    "notice": "Short source-led status, attributed and without speculation",
    "methodology": "Brief evidence standard"
  },
  "events": [{
    "id": "Event 11",
    "date": "2026-10-09",
    "occurred_at": null,
    "reported_at": "2026-10-09T16:30:00+05:30",
    "scheduled_at": null,
    "occurred_on": null,
    "category": "Police / security",
    "title": "A short factual headline",
    "status": "confirmed",
    "description": "What is verifiably known and who says so.",
    "context": "What is NOT established or disputed.",
    "evidence": ["Sourced supporting note"],
    "sources": [{
      "label": "Publication · specific item",
      "url": "https://example.com/real-article",
      "type": "report",
      "note": "Published Oct 9 16:30 IST"
    }]
  }],
  "discussions": [{
    "id": "Community 01",
    "date": "2026-10-09",
    "community": "r/delhi",
    "title": "What is being discussed",
    "url": "https://www.reddit.com/r/delhi/comments/actualid/",
    "summary": "Actual thread content; no representative public-opinion inference.",
    "signal": "Evidentiary caveat",
    "kind": "news discussion",
    "related": "Event 11"
  }],
  "history": []
}
```

Actual source URLs MUST be direct checked https links, never invented. Use `status` from `confirmed,corroborated,unverified,disputed`. A documented **statement** is "confirmed" only as a statement, not for the truth of the embedded allegations. Organiser and police claims must be attributed, cross-checked where possible, and not adopted as fact. Neither Reddit upvotes nor five reports repeating a single claim establish independent confirmation. Do not assert formal ECI registration for any movement without official evidence.

## Persistent update procedure

1. FETCH the latest `events.json`, `README.md`, and current blob SHA from `FumblingKnight/HUB` every run. The JSON is the memory; never reconstruct it from chat/task summary.
2. Check source links and identify truly new who/what/where/when events. For fresh evidence of an existing event, enrich the existing ID. Never create the same underlying story twice. Multiple independent developments in one hour mean separate items.
3. Assign unique stable `Event NN` IDs and `Community NN` IDs, incrementing from the largest existing value; IDs never change. Preserve all other entries. Corrections belong in existing entries with a brief audit `history` record.
4. For each new record explicitly fill all four structured time fields; if a time is not supported, use `null`. A report's publication clock goes ONLY in `reported_at`; a planned timetable goes ONLY in `scheduled_at`. Store times with +05:30 offset. `date` remains required.
5. Before committing, validate JSON parseability; schema_version=3; unique IDs; required strings; dates; allowed status; clocks null or valid ISO+offset; all sources actual HTTPS URLs. Run or use equivalent checks from `scripts/validate-protest.mjs`.
6. Re-fetch GitHub blob SHA before commit, use optimistic SHA update. On conflict refetch, merge non-overlapping work and retry once. NEVER clobber the other task's changes. Check resulting commit SHA.
7. Primary hourly researcher updates `meta.last_checked_at` after a successful research pass even if quiet. Only update `meta.published_at` and append to `history` when meaningful content changes. Secondary HH:05 editor finds real Reddit threads, corrections and deeper context; no redundant commit if nothing changed.
8. Avoid padding the timeline with invented entries or dramatic language. If the event status changes, verify before setting `active` or `concluded`. Retain date-specific uncertainty.
9. Site performs data refresh every five minutes while open and on return. This only loads newly deployed JSON; GitHub write success does NOT guarantee Cloudflare deployment. If connector write fails, report failure, never claim the page updated.
10. Keep the UI structural files unchanged on scheduled cycles unless a reproducible bug requires a targeted fix.

## Source hierarchy and limitations

- Primary statements, official advisories and actual verified footage help establish the statement/observable incident; they do not automatically prove accusations.
- Credible independent journalism provides additional corroboration and context.
- Reddit threads, comments and viral clips have high value as leads and community perspectives, but are separately labelled and attributed. Do not manufacture quotes or extrapolate consensus.
- Timestamps on a screenshot/video upload aren't necessarily when the recorded action happened.
- On a quiet hourly research run, display the changed `last_checked_at`, NOT a fictional hourly entry.

No notifications requested. User reads the GitHub-backed web page directly.
