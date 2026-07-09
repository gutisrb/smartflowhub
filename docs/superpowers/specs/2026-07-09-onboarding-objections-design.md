# Onboarding Tour — Objection Coverage (Intervention, Logs, Tracking)

**Date:** 2026-07-09 · **Branch:** `feat/onboarding-tour` · **Status:** approved by Nikola (design), pending implementation

## Problem

The onboarding tour (Inbox → CRM → Termini → Analitika → Ponuda) proves the AI can
*sell and schedule*, but leaves the lead's three biggest trust objections unanswered
at the exact moment they form:

1. **Control/risk** — "What happens when the AI doesn't know? It could say something
   wrong to a patient." Dental demos show `Intervencije 0` and no intervention story
   is seeded for service niches at all, so the safety mechanism is invisible.
2. **Accountability** — "I wasn't there — how do I know what it told people?" The
   lead-intelligence viewer (full per-customer conversation log + reason + manual
   contact log) exists but the tour never opens it.
3. **Leakage** — "What about inquiries it *doesn't* close?" The no-sale hero with a
   logged reason (Nikola Perić, Saturday-only) is already seeded but never featured.
   For product niches the equivalent is order tracking (Stefan Ilić, `status_porudzbine`).

Guardrails carried over from strategy (do not violate):
- **No prices anywhere in the demo/tour** — price is a call-only topic.
- **No assumptions about the lead's current process** — no "before/after" comparisons.
  The stories *show* capability; the lead supplies the comparison himself.

## Design

Keep the 5 module stops. Deepen two of them with a second narration beat each,
plus one trust line in the offer. Tour goes from 5 cards to 7. All copy in Serbian,
niche-branched (service vs product) like existing copy.

### Beat: Inbox #2 — "Kada agent ne zna — ne izmišlja" (NEW)

After Marija's booking playback completes and the user clicks Dalje, the tour stays
on the inbox module, switches the selected conversation to a new **intervention hero**,
and replays it live:

- **Service niches** (new seed, `interventionStory(nicheKey)` in
  `seed_onboarding_story.mjs`): a patient asks an expert-judgment question the agent
  must not answer. Dental: *"Pijem antikoagulantnu terapiju (Marivarin) — da li smem
  da izvadim zub?"* Agent explicitly declines to guess, says the doctor will reply
  personally, collects name+phone, fires `[HUMAN_NEEDED]` system message
  (`human_needed: true`). Hero name: **Dragana Simić** (unused by background fill).
  Per-niche question map mirrors the existing `svc` map (dental=anticoagulant,
  beauty=allergic reaction after treatment, fitness=training with an injury,
  generic=needs expert assessment). CRM row: status `Intervencija`, razlog:
  "Medicinsko pitanje — zahteva procenu lekara. Prosleđeno." (niche-worded).
- **Product niches**: reuse the already-seeded Jelena Marić damaged-product
  intervention hero — no new seed needed.

Narration card (service): eyebrow `Uživo · Intervencija`, title
**"Kada agent ne zna — ne izmišlja"**, body: *"Pacijent pita ono što sme da odluči
samo lekar. Agent ne nagađa: obaveštava Vas i predaje razgovor — a Vi odgovarate
iz ovog istog inboxa."* Product variant references Jelena's complaint.

**Choreography detail:** during playback, gate the amber `Intervencija` chip/header
so it appears only once the reveal reaches the end
(`showHuman = humanNeeded && (!demoPlayback || pbCount >= fullMessages.length)`) —
the escalation should *happen on screen*, not be pre-lit. Optional (should, not must):
fire the existing intervencija toast when the beat completes.

### Beat: CRM #2 — "Svaka reč, zabeležena" (NEW)

Beat 1 unchanged (hero row highlighted at top). On Dalje, the tour stays on the CRM
module and **auto-opens the existing `LeadIntelligenceViewer`** on the hero row —
full conversation log, status, and reason visible.

Narration (service): eyebrow `Dosije pacijenta`, title **"Svaka reč, zabeležena"**,
body: *"Kliknite bilo kog pacijenta — ceo razgovor, status i razlog su tu. I Nikola,
koji NIJE zakazao, upisan je sa razlogom: čeka termin subotom. Nijedan upit ne
propada."* Product variant: order tracking — *"Stefanova porudžbina se prati do
isporuke — status „Poslato“. I Jelena, koja se žalila, zabeležena je sa razlogom.
Ništa ne propada."*

### Offer — one trust line (EDIT)

In `offer-content.tsx` risk-reversal block, append: *"Radi na nalozima koje već
imate — Instagram, Facebook, WhatsApp i sajt. Ništa se ne menja i ništa ne migrira."*
Answers the integration fear without assuming anything about their stack.

## Mechanics

- **Tour model** (`onboarding-tour.tsx`): `ORDER` becomes
  `["inbox","inbox-intervencija","crm","crm-log","termini","analitika","offer"]`.
  Sub-beats resolve to their parent slot's `moduleKey` (no extra navigation).
  Progress dots reflect 7 steps. Skip works at every beat.
- **Page wiring** (`app/page.tsx`): `tourSlot` already flows. Add a niche-branched
  hero map replacing the hardcoded `tourHeroName = "Marija Jović"`:
  - **Bug fix (pre-existing):** product demos never match highlights because their
    hero is Stefan Ilić. Hero by slot+niche: inbox/crm/termini → Marija Jović
    (service) / Stefan Ilić (product); inbox-intervencija → Dragana Simić (service)
    / Jelena Marić (product).
  - `inboxPlayback` true for both inbox beats. New prop to `SocialChatbotModule`:
    `tourFocusName` — selects that conversation by name (restarting the reveal,
    which already keys off `selectedId`).
  - New prop to `AgentLeadsModule`: `tourOpenLogName` — when set and rows are
    loaded, calls `setSelectedLead(heroRow)` to open the viewer; clears on tour exit.
- **Seeding** (`seed_onboarding_story.mjs`): add third hero for service niches
  (id pattern `%_hero_intervencija`), covered by the existing idempotent
  `%_hero%` cleanup. After merge, re-run for existing demos (incl.
  `dentalux@live.com`) so live demos get the story.

## Out of scope

- No new modules, tabs, or explainer pages; objections are answered inside the flow.
- No pricing, ROI calculators, or current-process comparisons (guardrails above).
- The legacy spotlight tour (`lib/onboarding/steps.ts` `buildSteps`) is not extended;
  if confirmed dead code during implementation, note it — removal is a separate cleanup.

## Acceptance

1. Dental demo: 7 cards; intervention conversation plays live on beat 2; amber
   state appears only at reveal end; CRM beat 2 opens the viewer on Marija with
   the conversation log visible; Nikola Perić visible with his logged reason.
2. Product demo: same beats via Stefan/Jelena; CRM beat 2 shows order status "Poslato".
3. `Preskoči obilazak` exits cleanly from every beat (playback stops, viewer closes).
4. No price strings anywhere in tour copy. Mobile layout unbroken.
5. Highlight-name bug fixed: product-niche CRM/Termini rows highlight their hero.
