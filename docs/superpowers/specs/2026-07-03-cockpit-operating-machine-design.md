# Cockpit = the machine you fly in 15 min/day

## Goal

Turn the cockpit ("Danas") into the single screen where Nikola runs the whole outreach
machine: new qualified leads come in nightly, he approves the good ones (→ demo builds),
approves their email (→ sends), and tracks replies. Two clicks per lead. Everything else
automatic. Kills the current "156 old drafts I can't clear" problem.

---

## PART 1 — How Nikola operates it (the only part that matters day-to-day)

A lead moves through 5 stages, left→right. Nikola clicks twice.

```
1. NOVI LEADOVI     machine finds them overnight (≥30K followers, real business)
   👁 click a lead → their Instagram + Lead Intel (everything scraped) open in a new tab
   ✅ Odobri   ❌ Odbaci
        │ approve
        ▼
2. PRAVI SE DEMO    system builds their personalized demo automatically (a few min)
        │
        ▼
3. EMAIL SPREMAN    email written, their demo login inside
   ✅ Odobri → email šalje se
        │
        ▼
4. POSLATO          tracking: otvoreno / odgovorio / zakazao
        │ warm reply
        ▼
5. ODGOVORI         handle the warm ones — open convo, book the call
```

**Daily ritual (~15 min):** open cockpit → glance at the top numbers → go down NOVI, approve
good leads → go down EMAIL SPREMAN, approve emails → reply to anyone in ODGOVORI → done.

**Top stat strip** = the 5 stage counts (Novi, Demo se pravi, Email spreman, Poslato danas,
Odgovori). Each number is a pile of real work, nothing decorative.

**Rule that fixes the junk:** a lead is in exactly ONE stage. Acting on it moves it to the next
stage, so it leaves the current list. Nothing lingers. Nothing un-clearable.

---

## PART 2 — The machine behind it (runs itself)

Four background jobs (launchd) do the work; the cockpit only sets flags they read.

| Job | When | Does |
|---|---|---|
| `source` | daily ~06:00 | `source_leads.mjs`, follower floor **30K** → new leads land at stage `novi` |
| `build-approved` | every ~10 min | for stage `demo_building`: `build_demo_tenant.mjs` → `generate_drafts.mjs` → stage `email_ready` |
| `send-approved` | daily hour (or on-demand) | `send_outreach.mjs --mode approved` → stage `sent` |
| `sync-inbox` | every 4h (exists) | detect replies; warm reply → stage `replied` |

Browser never runs scripts — it writes a stage/flag, the job picks it up (same safe pattern as
today's send-approve gate).

---

## PART 3 — What gets built

**Data:** add `pipeline_stage` column to `contacts` (values: `novi`, `demo_building`,
`email_ready`, `sent`, `replied`, `discarded`, `archived`, `booked`, `lost`). This is the clean
spine — no more deriving stage from tangled legacy `status`.

**Cockpit (`command-center-module.tsx`) — rebuilt** as the 5 stage-lists above + stat strip.
- Row click → `LeadIntelligenceViewer` (already exists, shows scraped intel).
- "Instagram" button → opens `instagram.com/{handle}` in a new tab.
- NOVI row: **Odobri** (`pipeline_stage='demo_building'`) / **Odbaci** (`discarded`).
- EMAIL SPREMAN row: **Odobri** (`approved_to_send=true`) — reuses the gate already built.
- Acting on a row removes it from the list immediately (optimistic update).

**Scripts:**
- `source_leads.mjs` — follower floor → 30K; new inserts set `pipeline_stage='novi'`.
- `build_demo_tenant.mjs` — add a mode that builds only `pipeline_stage='demo_building'` leads;
  on success set `email_ready`. Quality gate: confirm the built demo actually plays its
  onboarding tour before promoting (the 22 old demos never got personalized onboarding — new ones must).
- `send_outreach.mjs` — already has `--mode approved`; on send set `pipeline_stage='sent'`.
- `sync_inbox.mjs` — warm reply sets `pipeline_stage='replied'`.
- `generate_drafts.mjs` prompt — remove the "plaćate tek kada je sve aktivno" offer line (no offer in email).

**Scheduling:** launchd plists for `source`, `build-approved`, `send-approved` (sync-inbox exists).

**Old data:** set `pipeline_stage='archived'` for all 703 existing leads EXCEPT genuinely warm/active
ones (replied warm, in-contract like Aleksandar MN, booked) which go to `replied`/`booked` so they
stay visible. Report the archived-vs-kept counts; reversible (just a flag). The cockpit shows only
active stages, so the archive is out of sight but not deleted.

---

## Out of scope (later)

- **The offer** — Nikola is still deciding it; it's a call topic, never in the email. No cockpit
  work depends on it.
- **Hard-deleting** dead sub-30K never-replied leads — archive is enough for now; deletion is a
  separate opt-in pass, shown for approval first.

## Verification

1. `tsc` clean.
2. Source job (dry-run) returns only ≥30K leads, sets them `novi`.
3. Approve a `novi` lead in cockpit → build-approved job builds its demo + draft → it appears in
   EMAIL SPREMAN → approve → `send_outreach --mode approved --dry-run` targets exactly it.
4. Cockpit shows only active stages; archived legacy leads absent; counts match reality.
5. A built demo plays its onboarding tour before reaching EMAIL SPREMAN.
