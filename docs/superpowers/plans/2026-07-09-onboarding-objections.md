# Onboarding Objection Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two narration beats to the onboarding tour (live AI→human intervention handoff; CRM conversation-log/tracking) plus one integration-trust line in the offer, so the demo answers the lead's control, accountability, and leakage objections before they form.

**Architecture:** The film-style tour (`components/onboarding/onboarding-tour.tsx`) keeps its 5 module stops but expands to 7 narration cards via two sub-beats that reuse their parent stop's module. Tour-structure logic (slot expansion, hero-name mapping) is extracted to a pure, tested module `lib/onboarding/tour-slots.ts`. A third hero conversation (service-niche intervention) is seeded by `seed_onboarding_story.mjs`; the modules learn two small tour props (`tourFocusName`, `tourOpenLogName`).

**Tech Stack:** Next.js 16 / React client components, Supabase (`razgovori`, `demo_crm` tables), vitest (node env, `lib/**/*.test.ts` only), framer-motion (existing patterns).

**Spec:** `docs/superpowers/specs/2026-07-09-onboarding-objections-design.md`

## Global Constraints

- All user-facing copy is Serbian, formal "Vi" register, matching existing tour copy tone.
- **No prices anywhere** in tour/demo copy (prices are call-only).
- **No assumptions about the lead's current process** — no before/after comparison copy.
- Hero names must not collide with background-fill names in `seed_onboarding_story.mjs` (service intervention hero = **Dragana Simić**, verified unused).
- Repo: `/Users/johhn/.gemini/antigravity/playground/photonic-lunar/ai-growth-dashboard`, branch `feat/onboarding-tour`. Never run `send_outreach.mjs`; seeding demo tenants is allowed.
- Verify commands: `npm test` (vitest), `npx tsc --noEmit`.

---

### Task 1: Pure tour-structure module (`tour-slots.ts`) — TDD

**Files:**
- Create: `lib/onboarding/tour-slots.ts`
- Test: `lib/onboarding/tour-slots.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces (used by Tasks 3 and 6):
  - `SERVICE_NICHES: Set<string>`, `isServiceNiche(niche: string | null | undefined): boolean`
  - `type TourSlot = "inbox" | "inbox-intervencija" | "crm" | "crm-log" | "termini" | "analitika" | "offer"`
  - `expandTourSlots(moduleKeys: string[]): { slot: TourSlot; moduleKey: string }[]`
  - `TOUR_HEROES = { service: { main: "Marija Jović", intervention: "Dragana Simić" }, product: { main: "Stefan Ilić", intervention: "Jelena Marić" } }`
  - `tourHeroFor(slot: string | null | undefined, isService: boolean): string | null`

- [ ] **Step 1: Write the failing test**

```ts
// lib/onboarding/tour-slots.test.ts
import { describe, it, expect } from "vitest"
import { expandTourSlots, tourHeroFor, isServiceNiche } from "./tour-slots"

describe("expandTourSlots", () => {
  it("expands a full module set to 7 beats in order, sub-beats reusing the parent moduleKey", () => {
    const out = expandTourSlots(["social-chatbot", "agent-leads", "calendar", "chatbot-analytics"])
    expect(out.map(o => o.slot)).toEqual([
      "inbox", "inbox-intervencija", "crm", "crm-log", "termini", "analitika", "offer",
    ])
    expect(out[0].moduleKey).toBe("social-chatbot")
    expect(out[1].moduleKey).toBe("social-chatbot") // sub-beat stays on the inbox module
    expect(out[2].moduleKey).toBe("agent-leads")
    expect(out[3].moduleKey).toBe("agent-leads")    // sub-beat stays on the CRM module
    expect(out[6].moduleKey).toBe("ponuda")          // offer fallback always appended
  })
  it("omits sub-beats when the parent slot has no module", () => {
    const out = expandTourSlots(["calendar"])
    expect(out.map(o => o.slot)).toEqual(["termini", "offer"])
  })
  it("first matching module wins a slot", () => {
    const out = expandTourSlots(["business-crm", "agent-leads"])
    expect(out.find(o => o.slot === "crm")!.moduleKey).toBe("business-crm")
  })
})

describe("tourHeroFor", () => {
  it("maps main-hero slots by niche type", () => {
    expect(tourHeroFor("inbox", true)).toBe("Marija Jović")
    expect(tourHeroFor("crm", false)).toBe("Stefan Ilić")
    expect(tourHeroFor("crm-log", true)).toBe("Marija Jović")
    expect(tourHeroFor("termini", false)).toBe("Stefan Ilić")
  })
  it("maps the intervention beat to the intervention hero", () => {
    expect(tourHeroFor("inbox-intervencija", true)).toBe("Dragana Simić")
    expect(tourHeroFor("inbox-intervencija", false)).toBe("Jelena Marić")
  })
  it("returns null for slots without a hero and for null slot", () => {
    expect(tourHeroFor("analitika", true)).toBeNull()
    expect(tourHeroFor("offer", false)).toBeNull()
    expect(tourHeroFor(null, true)).toBeNull()
  })
})

describe("isServiceNiche", () => {
  it("recognizes service niches case-insensitively; product/unknown/null are false", () => {
    expect(isServiceNiche("dental")).toBe(true)
    expect(isServiceNiche("Dental")).toBe(true)
    expect(isServiceNiche("ecommerce")).toBe(false)
    expect(isServiceNiche(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/onboarding/tour-slots.test.ts`
Expected: FAIL — "Cannot find module './tour-slots'"

- [ ] **Step 3: Write the implementation**

```ts
// lib/onboarding/tour-slots.ts
// Pure tour-structure logic for the film onboarding tour: which narration
// beats run, in what order, on which module, and which seeded hero each
// beat spotlights. Kept free of React so it can be unit-tested.

export const SERVICE_NICHES = new Set([
  "dental", "medical", "beauty", "fitness", "services", "wellness", "real-estate",
])

export const isServiceNiche = (niche: string | null | undefined): boolean =>
  SERVICE_NICHES.has((niche || "").toLowerCase())

export type TourSlot =
  | "inbox" | "inbox-intervencija"
  | "crm" | "crm-log"
  | "termini" | "analitika" | "offer"

// module-key → its parent stop; first matching module wins per slot
const MODULE_SLOT: Record<string, Exclude<TourSlot, "inbox-intervencija" | "crm-log">> = {
  "social-chatbot": "inbox",
  "business-crm": "crm", "agent-leads": "crm",
  "calendar": "termini",
  "chatbot-analytics": "analitika", "analytics": "analitika",
  "ponuda": "offer",
}

const ORDER: TourSlot[] = [
  "inbox", "inbox-intervencija", "crm", "crm-log", "termini", "analitika", "offer",
]
// sub-beats render on their parent slot's module and only exist when it does
const PARENT: Partial<Record<TourSlot, TourSlot>> = {
  "inbox-intervencija": "inbox",
  "crm-log": "crm",
}

export function expandTourSlots(moduleKeys: string[]): { slot: TourSlot; moduleKey: string }[] {
  const bySlot: Partial<Record<TourSlot, string>> = {}
  for (const key of moduleKeys) {
    const slot = MODULE_SLOT[key]
    if (slot && !bySlot[slot]) bySlot[slot] = key
  }
  // the offer finale always runs, even if ponuda isn't in the module list
  if (!bySlot["offer"]) bySlot["offer"] = "ponuda"
  return ORDER.flatMap((slot) => {
    const moduleKey = bySlot[PARENT[slot] ?? slot]
    return moduleKey ? [{ slot, moduleKey }] : []
  })
}

// Seeded hero customers (seed_onboarding_story.mjs) each beat points at.
export const TOUR_HEROES = {
  service: { main: "Marija Jović", intervention: "Dragana Simić" },
  product: { main: "Stefan Ilić", intervention: "Jelena Marić" },
} as const

export function tourHeroFor(slot: string | null | undefined, isService: boolean): string | null {
  const h = isService ? TOUR_HEROES.service : TOUR_HEROES.product
  switch (slot) {
    case "inbox": case "crm": case "crm-log": case "termini":
      return h.main
    case "inbox-intervencija":
      return h.intervention
    default:
      return null
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/onboarding/tour-slots.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/tour-slots.ts lib/onboarding/tour-slots.test.ts
git commit -m "feat(onboarding): pure tour-slot expansion + hero mapping with tests"
```

---

### Task 2: Seed the intervention hero + fix missing HUMAN_NEEDED flags

**Files:**
- Modify: `seed_onboarding_story.mjs` (message loop ~line 217; `productStory` nosale ~line 98; new function after `serviceStory` ~line 78; scenarios array ~line 208)

**Interfaces:**
- Consumes: existing `serviceStory`/`productStory`/`seedTenant` structure.
- Produces: hero conversation `demo_${cid8}_hero3` (service niches) whose customer is **"Dragana Simić"** with a `system` message carrying `metadata.human_needed: true`; product nosale (Jelena Marić) gains the same system message. The inbox module derives its amber `humanNeeded` state exclusively from such system messages, so without them no intervention UI ever shows.

- [ ] **Step 1: Support per-message extra metadata in the hero loop**

In `seedTenant`, the hero scenario loop currently reads:

```js
  for (const { key, s, baseOffsetMin } of scenarios) {
    s.msgs.forEach(([role, text], i) => {
      const ts = new Date(now - (baseOffsetMin * 60000) + i * 40000).toISOString() // 40s apart
      razgovori.push({ id_razgovora: key, role, message: text, platform: s.channel, client_id: cid, created_at: ts, metadata: { name: s.customer, profile_pic: pic(s.customer) } })
    })
```

Change the forEach to accept an optional third tuple element merged into metadata:

```js
  for (const { key, s, baseOffsetMin } of scenarios) {
    s.msgs.forEach(([role, text, extraMeta], i) => {
      const ts = new Date(now - (baseOffsetMin * 60000) + i * 40000).toISOString() // 40s apart
      razgovori.push({ id_razgovora: key, role, message: text, platform: s.channel, client_id: cid, created_at: ts, metadata: { name: s.customer, profile_pic: pic(s.customer), ...(extraMeta || {}) } })
    })
```

- [ ] **Step 2: Add `interventionStory(nicheKey)` after `serviceStory`**

```js
// Third hero (service niches): an expert-judgment question the agent must NOT
// answer — it escalates instead. This is the tour's "kada agent ne zna" beat.
function interventionStory(nicheKey) {
  const q = {
    dental:  { ask: "Zdravo, pijem antikoagulantnu terapiju (Marivarin). Da li smem da izvadim zub?", domain: "lekara", razlog: "Medicinsko pitanje (antikoagulantna terapija) — zahteva procenu lekara. Prosleđeno." },
    medical: { ask: "Zdravo, na hroničnoj sam terapiji — da li smem na zahvat koji ste mi preporučili?", domain: "lekara", razlog: "Medicinsko pitanje — zahteva procenu lekara. Prosleđeno." },
    beauty:  { ask: "Posle prošlog tretmana imala sam jaku reakciju na koži. Da li smem ponovo?", domain: "stručnjaka", razlog: "Moguća alergijska reakcija — zahteva procenu stručnjaka. Prosleđeno." },
    fitness: { ask: "Oporavljam se od povrede ramena — koje treninge smem da radim?", domain: "trenera", razlog: "Trening uz povredu — zahteva procenu trenera. Prosleđeno." },
  }[nicheKey] || { ask: "Imam specifičnu situaciju — treba mi stručna procena pre nego što zakažem.", domain: "stručnjaka", razlog: "Zahteva stručnu procenu. Prosleđeno." }
  return {
    channel: "instagram", customer: "Dragana Simić", phone: "062 334 5566",
    msgs: [
      ["user", q.ask],
      ["assistant", `Zdravo, Dragana 😊 Ovo je pitanje za našeg ${q.domain} — ne bih da nagađam. Prosleđujem Vaš upit odmah i javiće Vam se lično. Mogu li da zabeležim ime i broj telefona?`],
      ["user", "Dragana Simić, 062 334 5566"],
      ["assistant", "Zabeleženo ✅ Javiće Vam se lično u najkraćem roku. Hvala na strpljenju 🙏"],
      ["system", "[HUMAN_NEEDED]", { human_needed: true }],
    ],
    crm: { full_name: "Dragana Simić", telefon: "062 334 5566", kategorija: "Upit", proizvod: "Stručna procena", status: "Intervencija", razlog: q.razlog, izvor: "Instagram" },
    appt: null,
  }
}
```

- [ ] **Step 3: Register the third scenario for service niches**

In `seedTenant`, replace:

```js
  const scenarios = [
    { key: `demo_${cid8}_hero1`, s: sale, baseOffsetMin: 12 },   // most recent -> top of inbox
    { key: `demo_${cid8}_hero2`, s: nosale, baseOffsetMin: 90 },
  ]
```

with:

```js
  const scenarios = [
    { key: `demo_${cid8}_hero1`, s: sale, baseOffsetMin: 12 },   // most recent -> top of inbox
    // service niches get a dedicated intervention hero (tour beat 2);
    // product niches already use their nosale (complaint) for that beat
    ...(isService ? [{ key: `demo_${cid8}_hero3`, s: interventionStory(niche), baseOffsetMin: 45 }] : []),
    { key: `demo_${cid8}_hero2`, s: nosale, baseOffsetMin: 90 },
  ]
```

- [ ] **Step 4: Give the product intervention hero its missing system flag**

In `productStory`'s `nosale` (Jelena Marić), append the system message after the last assistant message:

```js
    msgs: [
      ["user", "Stigao mi je oštećen proizvod 😞"],
      ["assistant", "Mnogo mi je žao zbog toga 🙏 Odmah prosleđujem Vas našem timu da to reše i pošalju zamenu."],
      ["user", "Hvala"],
      ["assistant", "Tim Vam se javlja u najkraćem roku. Imate moju poruku zabeleženu."],
      ["system", "[HUMAN_NEEDED]", { human_needed: true }],
    ],
```

- [ ] **Step 5: Syntax-check the script**

Run: `node --check seed_onboarding_story.mjs`
Expected: no output (exit 0). Do NOT run the seeder against Supabase yet — that happens in Task 7 after the UI can display the story.

- [ ] **Step 6: Commit**

```bash
git add seed_onboarding_story.mjs
git commit -m "feat(demo-seed): service intervention hero + HUMAN_NEEDED system flags"
```

---

### Task 3: Inbox module — tour focus + gated intervention reveal

**Files:**
- Modify: `components/modules/social-chatbot-module.tsx` (props interface ~line 425-433; component signature ~line 456; new effect near the playback effect ~line 638; humanNeeded render sites ~lines 1052, 1075, 1150, and profile badge ~line 1248)

**Interfaces:**
- Consumes: conversations built by `fetchConversations` (each has `candidateName`, `humanNeeded`), playback state `pbCount`/`fullMessages` (existing).
- Produces: new optional prop **`tourFocusName?: string`** — when set, the module selects the conversation whose `candidateName` equals it (restarting the playback reveal, which already keys off `selectedId`). During playback, intervention UI on the selected conversation appears only once the reveal completes.

- [ ] **Step 1: Add the prop**

In `SocialChatbotModuleProps` add:

```ts
    demoPlayback?: boolean
    /** onboarding tour: select this customer's conversation (by metadata name) */
    tourFocusName?: string
```

and destructure it in the component signature:

```ts
export function SocialChatbotModule({ clientId, selectedBrandIds, clientName, nicheKey, demoPlayback, tourFocusName }: SocialChatbotModuleProps) {
```

- [ ] **Step 2: Select the focused conversation when the tour asks**

Insert directly above the `// ── Onboarding live playback` block:

```ts
    // ── Onboarding tour: focus a specific hero conversation by customer name ──
    useEffect(() => {
        if (!tourFocusName || conversations.length === 0) return
        const hit = conversations.find((c: any) => (c.candidateName || "") === tourFocusName)
        if (hit && hit.id !== selectedId) setSelectedId(hit.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tourFocusName, conversations])
```

- [ ] **Step 3: Gate the selected conversation's intervention UI during playback**

Below `const currentMessages = demoPlayback ? fullMessages.slice(0, pbCount) : fullMessages` add:

```ts
    // During tour playback the escalation should HAPPEN on screen, not be pre-lit:
    // amber intervention state on the open conversation appears only once the
    // reveal reaches the end of the thread.
    const showSelectedHuman = !!selected?.humanNeeded && (!demoPlayback || pbCount >= fullMessages.length)
```

Then replace `selected.humanNeeded` with `showSelectedHuman` at these render sites (leave the conversation-list badge at ~line 1000 untouched — it's per-row, not the staged reveal):
- Chat header wrapper class (~line 1052): `selected.humanNeeded ? "border-amber-500/25 bg-amber-500/[0.04]" : ...` → `showSelectedHuman ? ... : ...`
- Chat header "Intervencija" pill condition (~line 1075): `{selected.humanNeeded && (` → `{showSelectedHuman && (`
- Chat footer status block (~line 1150, both the wrapper class ternary and the `selected.humanNeeded ? (...)` content ternary) → `showSelectedHuman`
- Profile sidebar badge (~line 1248): `{selected.humanNeeded && (` → `{showSelectedHuman && (`

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 (pre-existing warnings unrelated to this file are acceptable; no NEW errors referencing `social-chatbot-module.tsx`)

- [ ] **Step 5: Commit**

```bash
git add components/modules/social-chatbot-module.tsx
git commit -m "feat(inbox): tourFocusName selection + playback-gated intervention reveal"
```

---

### Task 4: CRM module — auto-open the lead-intelligence viewer

**Files:**
- Modify: `components/modules/agent-leads-module.tsx` (props interface ~line 44-49; signature ~line 125; new effect near `const [selectedLead, setSelectedLead]` ~line 130)

**Interfaces:**
- Consumes: `leads` state (rows with `full_name`), `setSelectedLead` (opens `LeadIntelligenceViewer` — already rendered when `selectedLead` is set).
- Produces: new optional prop **`tourOpenLogName?: string`** — when set and the named row exists, the viewer opens on it; when it clears, the viewer closes.

- [ ] **Step 1: Add the prop**

In `AgentLeadsModuleProps` add below `tourHighlightName?: string;`:

```ts
    /** onboarding tour: auto-open the lead-intelligence viewer on this row */
    tourOpenLogName?: string;
```

Destructure in the signature:

```ts
export function AgentLeadsModule({ clientId, selectedBrandIds, terminology: propTerminology, demoMode, nicheKey, tourHighlightName, tourOpenLogName }: AgentLeadsModuleProps) {
```

- [ ] **Step 2: Open/close the viewer with the prop**

Below the `selectedLead` state declaration add:

```ts
    // Onboarding tour: open the conversation-log viewer on the hero row while
    // the "crm-log" beat is active; close it when the beat ends or tour exits.
    useEffect(() => {
        if (!tourOpenLogName) { setSelectedLead(null); return }
        if (leads.length === 0) return
        const hit = leads.find((l: any) => l.full_name === tourOpenLogName)
        if (hit) setSelectedLead(hit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tourOpenLogName, leads.length])
```

(`useEffect` is already imported in this file.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no new errors referencing `agent-leads-module.tsx`

- [ ] **Step 4: Commit**

```bash
git add components/modules/agent-leads-module.tsx
git commit -m "feat(crm): tourOpenLogName auto-opens lead-intelligence viewer"
```

---

### Task 5: Tour component — 7 beats with new narration copy

**Files:**
- Modify: `components/onboarding/onboarding-tour.tsx` (imports; delete local `SERVICE_NICHES`/`SLOT`/`ORDER` ~lines 20-32; `COPY` map ~lines 37-68; `steps` useMemo ~lines 70-79; `onPlayback` call ~line 88)

**Interfaces:**
- Consumes: `expandTourSlots`, `isServiceNiche` from `@/lib/onboarding/tour-slots` (Task 1).
- Produces: `onSlot` now also emits `"inbox-intervencija"` and `"crm-log"` (page wiring in Task 6 depends on these exact strings); playback stays on for both inbox beats.

- [ ] **Step 1: Swap structure logic to the tested module**

Replace the imports/constants block:

```ts
import { MessageCircle, Database, Calendar, BarChart3, Sparkles, ArrowRight, ShieldAlert, FileText } from "lucide-react"
import { expandTourSlots, isServiceNiche, type TourSlot } from "@/lib/onboarding/tour-slots"
```

Delete the local `SERVICE_NICHES`, `SLOT`, and `ORDER` declarations (lines 20, 25-32). Delete the unused `Play` import if flagged. Change:

```ts
  const isService = isServiceNiche(niche)
```

- [ ] **Step 2: Add the two new COPY entries**

Inside the `COPY` useMemo, after the `inbox` entry add:

```ts
    "inbox-intervencija": {
      moduleKey: "", icon: ShieldAlert, eyebrow: "Uživo · Intervencija",
      title: "Kada agent ne zna — ne izmišlja",
      body: isService
        ? "Pacijent pita ono što sme da odluči samo lekar. Agent ne nagađa: obaveštava Vas i predaje razgovor — a Vi odgovarate iz ovog istog inboxa."
        : "Jelena javlja da je proizvod stigao oštećen. Agent ne raspravlja: obaveštava Vas i predaje razgovor — a Vi odgovarate iz ovog istog inboxa.",
    },
```

After the `crm` entry add:

```ts
    "crm-log": {
      moduleKey: "", icon: FileText, eyebrow: isService ? "Dosije pacijenta" : "Dosije kupca",
      title: "Svaka reč, zabeležena",
      body: isService
        ? "Kliknite bilo kog pacijenta — ceo razgovor, status i razlog su tu. I Nikola, koji NIJE zakazao, upisan je sa razlogom: čeka termin subotom. Nijedan upit ne propada."
        : "Stefanova porudžbina se prati do isporuke — status „Poslato“. I Jelena, koja se žalila, zabeležena je sa razlogom. Ništa ne propada.",
    },
```

Type the map as `Record<TourSlot, StepDef>` so a missing slot is a compile error.

- [ ] **Step 3: Build steps via expandTourSlots and keep playback on both inbox beats**

Replace the `steps` useMemo body:

```ts
  const steps = useMemo(
    () => expandTourSlots(modules.map((m) => m.key)).map(({ slot, moduleKey }) => ({ ...COPY[slot], moduleKey, slot })),
    [modules, COPY],
  )
```

In the navigation effect, replace `onPlayback(step.slot === "inbox")` with:

```ts
    onPlayback(step.slot === "inbox" || step.slot === "inbox-intervencija")
```

The pulsing dot on the narration icon (`step.slot === "inbox"` ~line 121) should also cover the new live beat:

```ts
                {(step.slot === "inbox" || step.slot === "inbox-intervencija") && (
```

- [ ] **Step 4: Typecheck + full test run**

Run: `npx tsc --noEmit && npm test`
Expected: tsc exit 0; vitest suites (incl. Task 1's) PASS

- [ ] **Step 5: Commit**

```bash
git add components/onboarding/onboarding-tour.tsx
git commit -m "feat(onboarding): intervention + conversation-log beats (7-card tour)"
```

---

### Task 6: Page wiring — niche-correct heroes + new props (fixes product-hero bug)

**Files:**
- Modify: `app/page.tsx` (hero const ~line 51; `renderModule` cases ~lines 271, 278, 299)

**Interfaces:**
- Consumes: `isServiceNiche`, `tourHeroFor` (Task 1); `tourFocusName` (Task 3); `tourOpenLogName` (Task 4); slot strings from Task 5.
- Produces: none further.

- [ ] **Step 1: Replace the hardcoded hero**

Line 51 currently: `const tourHeroName = showOnboarding ? "Marija Jović" : null` — this never matches product-demo heroes (Stefan Ilić), so their CRM/Termini highlights silently no-op. Replace with:

```ts
  const tourIsService = isServiceNiche(demoNiche)
  const tourHeroName = showOnboarding ? tourHeroFor(tourSlot, tourIsService) : null
```

Add the import:

```ts
import { isServiceNiche, tourHeroFor } from "@/lib/onboarding/tour-slots"
```

- [ ] **Step 2: Wire the modules**

Line ~271 (AgentLeadsModule, demo branch) — highlight on both CRM beats, open the log on the second:

```tsx
        if (demoNiche) return <AgentLeadsModule clientId={effectiveClientId} demoMode nicheKey={inferNicheKey(demoNiche)} tourHighlightName={(tourSlot === 'crm' || tourSlot === 'crm-log') ? tourHeroName ?? undefined : undefined} tourOpenLogName={tourSlot === 'crm-log' ? tourHeroName ?? undefined : undefined} />
```

Line ~278 (CalendarModule) — unchanged call shape; the hero name is now niche-correct automatically.

Line ~299 (SocialChatbotModule) — add the focus prop:

```tsx
        return <SocialChatbotModule clientId={effectiveClientId} selectedBrandIds={isBookStoreClient && selectedBrandIds.length > 0 ? selectedBrandIds : undefined} clientName={clientName} nicheKey={demoNiche ? inferNicheKey(demoNiche) : undefined} demoPlayback={inboxPlayback} tourFocusName={tourSlot === 'inbox' || tourSlot === 'inbox-intervencija' ? tourHeroName ?? undefined : undefined} />
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0, no new errors referencing `app/page.tsx`

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(onboarding): niche-correct tour heroes + beat prop wiring (fixes product hero highlight)"
```

---

### Task 7: Offer trust line, reseed live demos, end-to-end verify

**Files:**
- Modify: `components/onboarding/offer-content.tsx` (risk-reversal paragraph ~lines 72-75)

**Interfaces:**
- Consumes: everything above.
- Produces: final user-visible state; reseeded `dentalux@live.com` tenant.

- [ ] **Step 1: Integration trust line in the risk-reversal block**

Replace the paragraph:

```tsx
        <p className="text-[14px] text-zinc-200 leading-relaxed">
          <span className="font-semibold text-white">Probate ga uživo, na svojim kupcima.</span>{" "}
          Postavimo ga na naloge koje već imate — Instagram, Facebook, WhatsApp i sajt — i pustimo da radi,
          pre bilo kakve obaveze. Ništa se ne menja i ništa ne migrira. Detalje rešavamo u kratkom pozivu.
        </p>
```

- [ ] **Step 2: Full check**

Run: `npx tsc --noEmit && npm test && npx eslint components/onboarding lib/onboarding`
Expected: all pass; eslint may show pre-existing `any` warnings elsewhere but none new in these paths

- [ ] **Step 3: Reseed the DENTALUX demo (allowed: no external send)**

Run: `node seed_onboarding_story.mjs --email dentalux@live.com`
Expected output line like: `Stomatološka ordinacija DENTALUX (dental, service): N msgs, 3 CRM, M appt ✓` — note **3 CRM** rows (Marija, Dragana, Nikola)

- [ ] **Step 4: Verify seeded rows**

```bash
node -e "
import('dotenv').catch(()=>{});
" && node --input-type=module -e "
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
for (const l of readFileSync('.env.local','utf8').split('\n')) { const m=l.match(/^([^#=]+)=(.*)/); if(m) process.env[m[1].trim()]=m[2].trim() }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data: c } = await sb.from('clients').select('id').eq('email','dentalux@live.com').single()
const { data: crm } = await sb.from('demo_crm').select('full_name,status,razlog').eq('client_id', c.id).like('id_razgovora','%_hero%')
console.log(crm)
const { data: sys } = await sb.from('razgovori').select('id_razgovora,role,metadata').eq('client_id', c.id).like('id_razgovora','%_hero3').eq('role','system')
console.log(sys)
"
```

Expected: CRM shows Marija Jović (Zakazano), Dragana Simić (Intervencija), Nikola Perić (Zainteresovan); the system row has `metadata.human_needed: true`.

- [ ] **Step 5: Manual browser pass (hand to Nikola — no Playwright)**

Dev server on :3000. Reset `onboarded_at` for the dentalux tenant if needed to replay the tour, then verify the spec's acceptance list: 7 cards; intervention plays live with amber appearing at reveal end; crm-log opens the viewer on Marija; Nikola Perić's razlog visible; skip exits cleanly from every beat; no prices anywhere.

- [ ] **Step 6: Commit + vault update**

```bash
git add components/onboarding/offer-content.tsx
git commit -m "feat(offer): integration trust line — runs on existing accounts, nothing migrates"
```

Then update the vault: `wiki/status.md` Current section, one `log.md` line, and add DENTALUX to `wiki/clients.md` (demo built 2026-07-08, dentalux@live.com, dental niche, 61.8k IG).

---

## Self-Review Notes

- **Spec coverage:** intervention beat (Tasks 2, 3, 5, 6), log/tracking beat (Tasks 4, 5, 6), offer trust line (Task 7), hero-name bug (Task 6), HUMAN_NEEDED gap incl. product-side fix (Task 2), skip-exit safety (viewer closes via Task 4's clear-on-unset; playback stops via existing `onPlayback(false)` in `finish`).
- **Legacy `lib/onboarding/steps.ts` (`buildSteps`)**: only referenced by its own test — dead code for the film tour; per spec it is NOT extended. Leave as-is; separate cleanup.
- **Type consistency check:** prop names `tourFocusName` (inbox), `tourOpenLogName` (CRM), slot strings `"inbox-intervencija"`/`"crm-log"` used identically in Tasks 3-6.
