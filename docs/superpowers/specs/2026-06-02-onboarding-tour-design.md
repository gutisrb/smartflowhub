# Design: First-Login Onboarding Tour

**Date:** 2026-06-02
**Status:** Approved (design)
**Repo:** photonic-lunar/ai-growth-dashboard (the complete app)

---

## Problem / Goal

Demo-tenant recipients (leads) log into `app.smartflow.rs` and land in a multi-module dashboard with zero guidance. We want a premium, **unskippable, interactive, module-aware** first-login walkthrough that:
1. Walks the user page-by-page through each module *their* client actually has.
2. Is **personalized per brand** using lead intel (pre-generated at demo build).
3. Doubles as a sales wow-moment for the demo.

It also serves real paying clients on their first login. Audience priority: demo recipients first.

---

## Scope

**In scope (v1):**
- First-login guided **spotlight tour** (welcome → per-module spotlight → finish), once per client.
- Module-aware: tour adapts to whatever modules the client has (dental demo ≠ bookstore ≠ OZ Avala).
- **Pre-generated per-brand copy** stored at demo-build time, with niche-aware + generic Serbian fallback.
- Gating via `clients.onboarded_at` (+ localStorage mirror); **backfill existing clients as onboarded**.
- Bundled polish: localize the English sci-fi placeholder strings the tour spotlights; hide the dead header search.

**Out of scope (phase 2):**
- "Replay guide" control in Settings.
- Live LLM generation of copy on login.
- Tour completion analytics.

---

## Audience & Trigger

- After Supabase auth + `clientId` resolved + modules loaded: if `clients.onboarded_at` is null AND `filteredModules.length > 0` → run tour.
- Runs **once**. On finish: set `onboarded_at = now()` and `localStorage['sf_onboarded_<clientId>'] = '1'`.
- "Unskippable" = no dismiss/X; user advances via "Razumem →" through to the finish step (Back allowed, Skip not).

---

## Data Model

Supabase migration (`supabase/migrations/<ts>_onboarding.sql`):
```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarded_at  timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_copy jsonb;
-- Treat all EXISTING clients as already onboarded so live clients never get a surprise tour.
UPDATE clients SET onboarded_at = now() WHERE onboarded_at IS NULL;
```
`build_demo_tenant.mjs` must **not** set `onboarded_at` on newly created tenants (leave null → they get the tour).

`onboarding_copy` shape:
```json
{ "welcome": "string", "modules": { "<moduleKey>": "string" }, "finish": "string" }
```

---

## Components & Files

**New:**
- `lib/onboarding/types.ts` — `TourStep`, `OnboardingCopy` types.
- `lib/onboarding/copy.ts` — Serbian `DEFAULT_MODULE_COPY` + optional `NICHE_MODULE_COPY`; `resolveCopy()`.
- `lib/onboarding/steps.ts` — `buildSteps(modules, copy, clientName, brandColor)`.
- `components/onboarding/spotlight.tsx` — dim + highlight-cutout layer + floating card.
- `components/onboarding/onboarding-tour.tsx` — controller/overlay.

**Modified:**
- `app/page.tsx` — fetch `onboarded_at`/`onboarding_copy`; `showOnboarding` state; render tour; `onNavigate=setActiveModule`; `markOnboarded`; add `data-tour` attrs; localize placeholder strings; hide search.
- `components/dashboard/sidebar.tsx` — add `data-tour="module-<key>"` to each module button.
- `build_demo_tenant.mjs` — after seeding, LLM-generate `onboarding_copy` JSON and store on the tenant's `clients` row.
- `supabase/migrations/<ts>_onboarding.sql` — new.

---

## Types (`lib/onboarding/types.ts`)
```ts
export type TourStepKind = 'welcome' | 'module' | 'finish'
export interface TourStep {
  kind: TourStepKind
  moduleKey?: ModuleKey
  targetSelector?: string   // e.g. [data-tour="module-social-chatbot"]
  title: string
  body: string
}
export interface OnboardingCopy {
  welcome: string
  modules: Record<string, string>
  finish: string
}
```

## Step builder (`lib/onboarding/steps.ts`)
`buildSteps(modules, copy, clientName, brandColor) => TourStep[]`:
1. **welcome** — title = `copy?.welcome` or `Dobrodošli, ${clientName} 👋`; body = personalized line or generic.
2. **module step per module** (in sidebar order) — title = `module.displayName`; body = `resolveCopy(copy, niche, key)`; `targetSelector = [data-tour="module-${key}"]`.
3. **finish** — title `Spremni ste`; body `copy?.finish` or default; CTA = jump to first inbox/chat module.

## Copy resolution (`lib/onboarding/copy.ts`)
`resolveCopy(stored, niche, key) = stored?.modules?.[key] ?? NICHE_MODULE_COPY[niche]?.[key] ?? DEFAULT_MODULE_COPY[key]`.
`DEFAULT_MODULE_COPY` (Serbian) covers all ModuleKeys, e.g.:
- `social-chatbot` / `chatter-assistant`: "Sve poruke sa Instagrama, Facebooka i sajta na jednom mestu — agent odgovara, a Vi uskačete kad treba."
- `agent-leads` / `business-crm`: "Ovde se sami beleže svi zainteresovani — ime, kontakt, šta su tražili i u kojoj su fazi."
- `agent-database`: "Vaš katalog — agent odavde vuče tačne podatke i cene kada kupac pita."
- `calendar`: "Termini koje agent zakazuje, pregledno po danima."
- `chatbot-analytics` / `analytics`: "Šta kupci najviše pitaju, šta konvertuje i gde odustaju."
- `settings`: "Brendovi, obaveštenja i podešavanja naloga."

## Spotlight (`components/onboarding/spotlight.tsx`)
- Props: `targetSelector`, `title`, `body`, `index`, `total`, `onNext`, `onBack`, `brandColor`.
- Locate target via `document.querySelector`; read `getBoundingClientRect()`; render full-screen dim with a rounded "hole" around the target (+8px pad) using a large `box-shadow` spread on a positioned div (cutout technique).
- Floating glass card positioned adjacent to the target, auto-flipping to stay on screen; shows counter `index / total`, title, body, progress dots, "Razumem →".
- Recompute rect on `resize` + `scroll` (throttled via rAF). Lock `body` scroll while active.
- If target missing → render card centered (no hole). framer-motion animates hole + card between steps.

## Controller (`components/onboarding/onboarding-tour.tsx`)
- Props: `modules`, `clientName`, `demoNiche`, `storedCopy`, `brandColor`, `onNavigate(moduleKey)`, `onComplete()`.
- Builds steps once. On entering a `module` step: call `onNavigate(moduleKey)`, then `requestAnimationFrame` (+150ms retry) before measuring the target.
- `welcome`/`finish` → full-screen centered glass card variant (blur orbs, brand accent, large Outfit heading, primary button). `module` → `<Spotlight>`.
- No close button. Back allowed; no skip. Finish → `onComplete()`.

## `page.tsx` integration
- Extend the `clients` select in `checkSession` to also pull `onboarded_at, onboarding_copy`.
- `showOnboarding = isAuthenticated && !isLoading && filteredModules.length > 0 && onboardedAt == null && !localStorage['sf_onboarded_<clientId>']`.
- Render `<OnboardingTour .../>` at root z-index above everything; `onNavigate = setActiveModule`.
- `markOnboarded`: `update clients set onboarded_at = now() where id = <clientId>` (parent/group id for group clients), set localStorage, hide.
- Add `data-tour="module-content"` to the content wrapper; sidebar buttons get `data-tour="module-<key>"`.

## Visual spec (decided — matches app)
- Dim: obsidian + backdrop-blur. Accent: emerald, or `demo_brand_color` when present.
- Glass card: `bg-[#0e1116]/95`, `border-white/10`, Outfit headings, framer-motion transitions.
- Welcome/finish: centered card, blur orbs, brand-accent heading + subline + primary CTA.
- Spotlight card: 320–360px, counter `n / N`, title, body, dots, "Razumem →".
- Mobile: spotlight becomes a bottom-sheet card; auto-open sidebar when a module step targets a sidebar item.

## Edge cases
- Modules still loading → don't start (guard on `isLoading`).
- Missing `onboarding_copy` → niche/default copy.
- Target not found (timing) → retry once after 150ms; else center card.
- Resize/scroll → recompute rect. Body scroll locked during tour.
- Error fetching the new client fields → treat as onboarded (never block the app).
- Group clients (Harmonija) → run once; write `onboarded_at` on the parent group id; tour the unified module set.
- Existing clients → backfilled, never see the tour.

## Acceptance criteria
1. New demo tenant first login → welcome → each of its modules spotlighted with correct Serbian copy → finish; `onboarded_at` set; reload does not re-show.
2. Reset `onboarded_at = null` → tour shows again.
3. Existing clients (OZ Avala, Harmonija) do NOT see the tour.
4. Personalized copy used when present; clean fallback when absent.
5. No mobile layout break; spotlight positions correctly; cannot skip without completing.
6. No English sci-fi placeholder text remains on loader/empty/search screens.

## Testing
- Manual: log into the Crowndental demo tenant (reset `onboarded_at` to re-run) → verify full flow.
- Unit: `buildSteps` returns `welcome + N + finish` in sidebar order; `resolveCopy` fallback chain (stored → niche → default).
- Regression: OZ Avala + Harmonija logins unaffected.

## Rollout
1. Run migration (add columns + backfill existing clients).
2. Deploy app with the tour + localization polish.
3. Update `build_demo_tenant.mjs` so new demos generate personalized `onboarding_copy` and leave `onboarded_at` null.
