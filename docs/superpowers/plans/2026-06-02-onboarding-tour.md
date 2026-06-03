# Onboarding Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium, unskippable, module-aware first-login onboarding tour for the SmartFlow dashboard that walks each client through their own modules with per-brand personalized copy.

**Architecture:** A React overlay (`OnboardingTour`) renders a welcome screen, then for each module the client has it navigates the dashboard to that module and spotlights the content area with an explainer card, then a finish screen. Copy resolves from pre-generated per-brand JSON (stored on `clients.onboarding_copy`) → Serbian per-module defaults. Shown once, gated by `clients.onboarded_at` (+ localStorage mirror); existing clients are backfilled so only new demo tenants / first-time logins see it.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind v4, framer-motion, Supabase JS. Tests: vitest (added by this plan) for pure logic; visual/DOM verified on the running dev server.

**Spec:** `docs/superpowers/specs/2026-06-02-onboarding-tour-design.md`

**Note on target simplification (vs spec):** The spec said highlight the sidebar item; demo tenants use the collapsible *categorized* sidebar, so a module's nav item can be collapsed/hidden. Every module step instead spotlights the **content area** (`[data-tour="module-content"]`), which the tour navigates module-by-module. More robust, showcases the real module, and means `sidebar.tsx` is untouched.

**Note on copy tiers (vs spec):** Spec listed stored → niche → generic. Stored copy is already niche+brand aware (generated at build), so the niche-only tier is redundant. Implemented as stored → per-module default → generic.

---

## File Structure

| File | Responsibility | New/Mod |
|------|----------------|---------|
| `vitest.config.ts` | Test runner config with `@/*` alias | New |
| `package.json` | Add `vitest` devDep + `test` script | Mod |
| `supabase/migrations/20260602_onboarding.sql` | Add columns + backfill | New |
| `lib/onboarding/types.ts` | `TourStep`, `OnboardingCopy` types | New |
| `lib/onboarding/copy.ts` | Per-module Serbian defaults + `resolveModuleCopy` | New |
| `lib/onboarding/copy.test.ts` | Tests for copy resolution | New |
| `lib/onboarding/steps.ts` | `buildSteps()` | New |
| `lib/onboarding/steps.test.ts` | Tests for step building | New |
| `components/onboarding/spotlight.tsx` | Dim + highlight-hole + explainer card | New |
| `components/onboarding/onboarding-tour.tsx` | Controller: welcome/spotlight/finish + navigation | New |
| `app/page.tsx` | Fetch gating fields, render tour, mark complete, `data-tour` on content, localize strings, hide search | Mod |
| `build_demo_tenant.mjs` | Generate + store `onboarding_copy` at demo build | Mod |

---

## Task 1: Test harness (vitest)

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (devDependencies + scripts)

- [ ] **Step 1: Install vitest**

Run: `npm install -D vitest@^3`
Expected: adds `vitest` to devDependencies, no peer errors.

- [ ] **Step 2: Create vitest config with the `@/*` alias**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./") } },
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
})
```

- [ ] **Step 3: Add the test script**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify the runner works (no tests yet → exits cleanly)**

Run: `npm test`
Expected: vitest runs, reports "No test files found" or 0 tests, exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for onboarding logic tests"
```

---

## Task 2: Database migration (gating columns + backfill)

**Files:**
- Create: `supabase/migrations/20260602_onboarding.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260602_onboarding.sql`:
```sql
-- Onboarding tour: gating + per-brand copy
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarded_at    timestamptz;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS onboarding_copy jsonb;

-- Treat all EXISTING clients as already onboarded so live clients (OZ Avala,
-- Harmonija, etc.) never get a surprise tour. Only rows created AFTER this
-- migration (new demo tenants) keep onboarded_at = NULL and get the tour.
UPDATE clients SET onboarded_at = now() WHERE onboarded_at IS NULL;
```

- [ ] **Step 2: Apply it**

Apply via the Supabase SQL editor (paste the file contents and run) **or** `supabase db push` if the CLI is linked **or** the Supabase MCP `apply_migration` tool.

- [ ] **Step 3: Verify columns exist and existing rows are backfilled**

Run this check script (save as `tmp_verify_onboarding.mjs`, then delete after):
```js
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
for (const l of readFileSync(".env.local","utf8").split("\n")){const m=l.match(/^([^#=]+)=(.*)/);if(m)process.env[m[1].trim()]=m[2].trim();}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from("clients").select("id,name,onboarded_at,onboarding_copy").limit(5);
console.log(error ?? data);
```
Run: `node tmp_verify_onboarding.mjs`
Expected: rows print with `onboarded_at` populated (non-null) and `onboarding_copy` null; no "column does not exist" error. Then `rm tmp_verify_onboarding.mjs`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260602_onboarding.sql
git commit -m "feat: add onboarded_at + onboarding_copy columns with backfill"
```

---

## Task 3: Onboarding types

**Files:**
- Create: `lib/onboarding/types.ts`

- [ ] **Step 1: Write the types**

Create `lib/onboarding/types.ts`:
```ts
import type { ModuleKey } from "@/lib/modules/types"

export type TourStepKind = "welcome" | "module" | "finish"

export interface TourStep {
  kind: TourStepKind
  moduleKey?: ModuleKey
  targetSelector?: string
  title: string
  body: string
}

export interface OnboardingCopy {
  welcome: string
  modules: Record<string, string>
  finish: string
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add lib/onboarding/types.ts
git commit -m "feat: add onboarding types"
```

---

## Task 4: Copy resolver (TDD)

**Files:**
- Create: `lib/onboarding/copy.ts`
- Test: `lib/onboarding/copy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/onboarding/copy.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { resolveModuleCopy, DEFAULT_MODULE_COPY } from "./copy"

describe("resolveModuleCopy", () => {
  it("prefers stored per-brand copy when present", () => {
    const stored = { welcome: "w", finish: "f", modules: { "agent-leads": "CUSTOM" } }
    expect(resolveModuleCopy(stored, "agent-leads")).toBe("CUSTOM")
  })
  it("falls back to the per-module default when stored is missing the key", () => {
    const stored = { welcome: "w", finish: "f", modules: {} }
    expect(resolveModuleCopy(stored, "agent-leads")).toBe(DEFAULT_MODULE_COPY["agent-leads"])
  })
  it("falls back to default when stored is null", () => {
    expect(resolveModuleCopy(null, "calendar")).toBe(DEFAULT_MODULE_COPY["calendar"])
  })
  it("falls back to a generic string for an unknown module key", () => {
    expect(resolveModuleCopy(null, "totally-unknown")).toBe("Ovde upravljate ovim delom Vašeg sistema.")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/onboarding/copy.test.ts`
Expected: FAIL — cannot import `./copy` (module not found).

- [ ] **Step 3: Write the implementation**

Create `lib/onboarding/copy.ts`:
```ts
import type { OnboardingCopy } from "./types"

const GENERIC = "Ovde upravljate ovim delom Vašeg sistema."

export const DEFAULT_MODULE_COPY: Record<string, string> = {
  "social-chatbot": "Sve poruke sa Instagrama, Facebooka i sajta na jednom mestu — agent odgovara, a Vi uskačete kada treba.",
  "chatter-assistant": "Sve poruke sa Instagrama, Facebooka i sajta na jednom mestu — agent odgovara, a Vi uskačete kada treba.",
  "website-chatbot": "Četbot na Vašem sajtu — hvata posetioce i pretvara ih u kontakte.",
  "agent-leads": "Ovde se sami beleže svi zainteresovani — ime, kontakt, šta su tražili i u kojoj su fazi.",
  "business-crm": "Ovde se sami beleže svi zainteresovani — ime, kontakt, šta su tražili i u kojoj su fazi.",
  "crm-kanban-board": "Vaši kontakti na kanban tabli — povucite ih kroz faze.",
  "multi-tenant-crm": "Pregled kontakata po brendovima.",
  "agent-database": "Vaš katalog — agent odavde vuče tačne podatke i cene kada kupac pita.",
  "calendar": "Termini koje agent zakazuje, pregledno po danima.",
  "chatbot-analytics": "Šta kupci najviše pitaju, šta konvertuje i gde odustaju.",
  "analytics": "Šta kupci najviše pitaju, šta konvertuje i gde odustaju.",
  "email-outreach": "Vaši kontakti, poslate poruke i odgovori — sve na jednom mestu.",
  "pipeline": "Pregled svih prilika kroz faze — od prvog kontakta do zaključenja.",
  "growth-engine": "Centralni pregled svih kontakata i njihovog napretka.",
  "social-jobs": "Vaši oglasi za posao na jednom mestu.",
  "social-candidates": "Kandidati koji su se prijavili — pregledno i organizovano.",
  "settings": "Brendovi, obaveštenja i podešavanja naloga.",
}

export function resolveModuleCopy(stored: OnboardingCopy | null, moduleKey: string): string {
  return stored?.modules?.[moduleKey] ?? DEFAULT_MODULE_COPY[moduleKey] ?? GENERIC
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/onboarding/copy.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/copy.ts lib/onboarding/copy.test.ts
git commit -m "feat: add onboarding copy resolver with Serbian defaults"
```

---

## Task 5: Step builder (TDD)

**Files:**
- Create: `lib/onboarding/steps.ts`
- Test: `lib/onboarding/steps.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/onboarding/steps.test.ts`:
```ts
import { describe, it, expect } from "vitest"
import { buildSteps } from "./steps"

const modules = [
  { key: "social-chatbot", displayName: "AI Agent" },
  { key: "agent-leads", displayName: "CRM" },
]

describe("buildSteps", () => {
  it("returns welcome + one step per module + finish, in order", () => {
    const steps = buildSteps(modules, null, "Crowndental")
    expect(steps.map(s => s.kind)).toEqual(["welcome", "module", "module", "finish"])
  })
  it("uses the module displayName as the step title and a content-area target", () => {
    const steps = buildSteps(modules, null, "Crowndental")
    expect(steps[1].title).toBe("AI Agent")
    expect(steps[1].moduleKey).toBe("social-chatbot")
    expect(steps[1].targetSelector).toBe('[data-tour="module-content"]')
  })
  it("uses stored welcome/finish copy when present, else a default welcome with the client name", () => {
    const stored = { welcome: "Zdravo!", finish: "Kraj.", modules: {} }
    expect(buildSteps(modules, stored, "X")[0].title).toBe("Zdravo!")
    expect(buildSteps(modules, null, "Crowndental")[0].title).toContain("Crowndental")
  })
  it("handles an empty module list (welcome + finish only)", () => {
    expect(buildSteps([], null, "X").map(s => s.kind)).toEqual(["welcome", "finish"])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/onboarding/steps.test.ts`
Expected: FAIL — cannot import `./steps`.

- [ ] **Step 3: Write the implementation**

Create `lib/onboarding/steps.ts`:
```ts
import type { ModuleKey } from "@/lib/modules/types"
import type { TourStep, OnboardingCopy } from "./types"
import { resolveModuleCopy } from "./copy"

export interface ModuleLike {
  key: string
  displayName: string
}

const CONTENT_TARGET = '[data-tour="module-content"]'

export function buildSteps(
  modules: ModuleLike[],
  copy: OnboardingCopy | null,
  clientName: string,
): TourStep[] {
  const welcome: TourStep = {
    kind: "welcome",
    title: copy?.welcome ?? `Dobrodošli${clientName ? `, ${clientName}` : ""} 👋`,
    body: "Provešću Vas kroz Vaš sistem — za manje od minuta.",
  }
  const moduleSteps: TourStep[] = modules.map((m) => ({
    kind: "module",
    moduleKey: m.key as ModuleKey,
    targetSelector: CONTENT_TARGET,
    title: m.displayName,
    body: resolveModuleCopy(copy, m.key),
  }))
  const finish: TourStep = {
    kind: "finish",
    title: copy?.finish ?? "Spremni ste!",
    body: "Probajte da pošaljete poruku Vašem agentu i vidite kako radi uživo.",
  }
  return [welcome, ...moduleSteps, finish]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/onboarding/steps.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: Commit**

```bash
git add lib/onboarding/steps.ts lib/onboarding/steps.test.ts
git commit -m "feat: add onboarding step builder"
```

---

## Task 6: Spotlight component

**Files:**
- Create: `components/onboarding/spotlight.tsx`

(Verified visually on the dev server in Task 8; no unit test — it's pure DOM/measurement.)

- [ ] **Step 1: Write the component**

Create `components/onboarding/spotlight.tsx`:
```tsx
"use client"

import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { motion } from "framer-motion"

interface Rect { top: number; left: number; width: number; height: number }

interface SpotlightProps {
  targetSelector: string
  title: string
  body: string
  index: number
  total: number
  brandColor?: string
  isLast: boolean
  onNext: () => void
  onBack?: () => void
}

const PAD = 10
const CARD_W = 340
const CARD_H_EST = 210

function readRect(sel: string): Rect | null {
  if (typeof document === "undefined") return null
  const el = document.querySelector(sel) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function Spotlight({ targetSelector, title, body, index, total, brandColor = "#10b981", isLast, onNext, onBack }: SpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(null)

  const measure = useCallback(() => {
    const r = readRect(targetSelector)
    if (r) setRect(r)
    else setTimeout(() => setRect(readRect(targetSelector)), 150)
  }, [targetSelector])

  useLayoutEffect(() => { measure() }, [measure, index])

  useEffect(() => {
    const onChange = () => measure()
    window.addEventListener("resize", onChange)
    window.addEventListener("scroll", onChange, true)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("resize", onChange)
      window.removeEventListener("scroll", onChange, true)
      document.body.style.overflow = prev
    }
  }, [measure])

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200
  const vh = typeof window !== "undefined" ? window.innerHeight : 800
  let cardTop = vh / 2 - CARD_H_EST / 2
  let cardLeft = vw / 2 - CARD_W / 2
  if (rect) {
    const below = rect.top + rect.height + PAD + 12
    cardTop = below + CARD_H_EST < vh ? below : Math.max(16, rect.top - CARD_H_EST - 12)
    cardLeft = Math.min(Math.max(16, rect.left), vw - CARD_W - 16)
  }

  return (
    <div className="fixed inset-0 z-[300]">
      {/* dim with a transparent hole over the target (box-shadow spread technique) */}
      {rect ? (
        <motion.div
          initial={false}
          animate={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="absolute rounded-2xl pointer-events-none"
          style={{ boxShadow: "0 0 0 9999px rgba(5,8,12,0.80)", border: `2px solid ${brandColor}`, position: "absolute" }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "rgba(5,8,12,0.80)" }} />
      )}

      {/* explainer card */}
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="absolute pointer-events-auto rounded-2xl border border-white/10 bg-[#0e1116]/95 backdrop-blur-xl shadow-2xl p-5"
        style={{ top: cardTop, left: cardLeft, width: CARD_W }}
      >
        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: brandColor }}>
          {index + 1} / {total}
        </div>
        <h3 className="text-lg font-semibold text-white mb-1.5">{title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: i === index ? 16 : 6, background: i === index ? brandColor : "rgba(255,255,255,0.2)" }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {onBack && index > 0 && (
              <button onClick={onBack} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5 transition-colors">Nazad</button>
            )}
            <button onClick={onNext} className="text-xs font-semibold px-4 py-2 rounded-lg text-[#05080c] transition-transform active:scale-95"
              style={{ background: brandColor }}>
              {isLast ? "Završi" : "Razumem →"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors from this file.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/spotlight.tsx
git commit -m "feat: add onboarding spotlight overlay"
```

---

## Task 7: Onboarding tour controller

**Files:**
- Create: `components/onboarding/onboarding-tour.tsx`

- [ ] **Step 1: Write the component**

Create `components/onboarding/onboarding-tour.tsx`:
```tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { buildSteps, type ModuleLike } from "@/lib/onboarding/steps"
import type { OnboardingCopy } from "@/lib/onboarding/types"
import { Spotlight } from "./spotlight"

interface OnboardingTourProps {
  modules: ModuleLike[]
  clientName: string
  storedCopy: OnboardingCopy | null
  brandColor?: string
  onNavigate: (key: string) => void
  onComplete: () => void
}

export function OnboardingTour({ modules, clientName, storedCopy, brandColor = "#10b981", onNavigate, onComplete }: OnboardingTourProps) {
  const steps = useMemo(() => buildSteps(modules, storedCopy, clientName), [modules, storedCopy, clientName])
  const [i, setI] = useState(0)
  const step = steps[i]

  // When entering a module step, switch the dashboard to that module so the
  // content area (the spotlight target) renders it.
  useEffect(() => {
    if (step?.kind === "module" && step.moduleKey) onNavigate(step.moduleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  if (!step) return null

  const next = () => { if (i >= steps.length - 1) onComplete(); else setI(i + 1) }
  const back = () => setI((n) => Math.max(0, n - 1))

  if (step.kind === "module") {
    return (
      <Spotlight
        targetSelector={step.targetSelector!}
        title={step.title}
        body={step.body}
        index={i}
        total={steps.length}
        brandColor={brandColor}
        isLast={false}
        onNext={next}
        onBack={back}
      />
    )
  }

  // welcome / finish — full-screen centered glass card
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: "rgba(5,8,12,0.86)" }}>
      <div className="fixed -top-24 -left-24 w-96 h-96 rounded-full blur-[120px] pointer-events-none" style={{ background: `${brandColor}1a` }} />
      <div className="fixed -bottom-24 -right-24 w-96 h-96 rounded-full blur-[100px] pointer-events-none" style={{ background: `${brandColor}10` }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-w-md mx-4 rounded-3xl border border-white/10 bg-[#0e1116]/95 backdrop-blur-xl shadow-2xl p-8 text-center"
      >
        <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-5"
          style={{ background: `${brandColor}1f`, border: `1px solid ${brandColor}33` }}>
          <span style={{ color: brandColor }} className="text-xl">{step.kind === "welcome" ? "✦" : "✓"}</span>
        </div>
        <h2 className="text-2xl font-light text-white mb-2 font-outfit">{step.title}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-6">{step.body}</p>
        <button onClick={next} className="w-full text-sm font-semibold px-4 py-3 rounded-xl text-[#05080c] transition-transform active:scale-95"
          style={{ background: brandColor }}>
          {step.kind === "welcome" ? "Krenimo →" : "Hajde da počnemo"}
        </button>
        {step.kind === "welcome" && steps.length > 2 && (
          <div className="text-[11px] text-zinc-600 mt-3">{steps.length - 2} koraka · oko 1 minut</div>
        )}
      </motion.div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/onboarding/onboarding-tour.tsx
git commit -m "feat: add onboarding tour controller"
```

---

## Task 8: Wire into the dashboard (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Import the tour + add gating state**

After the existing imports (near line 26), add:
```tsx
import { OnboardingTour } from "@/components/onboarding/onboarding-tour"
import type { OnboardingCopy } from "@/lib/onboarding/types"
```
Inside `DashboardPage`, after the `unreadBellCount` state (≈line 40), add:
```tsx
const [onboardedAt, setOnboardedAt] = useState<string | null>(null)
const [onboardingCopy, setOnboardingCopy] = useState<OnboardingCopy | null>(null)
const [showOnboarding, setShowOnboarding] = useState(false)
```

- [ ] **Step 2: Fetch the gating fields in `checkSession`**

In `checkSession`, change the clients select (≈lines 60-64) from:
```tsx
const { data } = await supabase
  .from('clients')
  .select('id, name, demo_niche')
  .eq('email', session.user.email)
  .single()
```
to:
```tsx
const { data } = await supabase
  .from('clients')
  .select('id, name, demo_niche, onboarded_at, onboarding_copy')
  .eq('email', session.user.email)
  .single()
```
And inside the `if (data) {` block (after `setDemoNiche`), add:
```tsx
setOnboardedAt((data as any).onboarded_at ?? null)
setOnboardingCopy((data as any).onboarding_copy ?? null)
```

- [ ] **Step 3: Compute when to show the tour**

After the "Ensure active module is in available set" effect (≈line 86), add:
```tsx
// Show onboarding once, after modules are ready, if not yet onboarded
useEffect(() => {
  if (isLoading || !clientId || filteredModules.length === 0) return
  if (onboardedAt) return
  if (typeof window !== "undefined" && localStorage.getItem(`sf_onboarded_${clientId}`)) return
  setShowOnboarding(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isLoading, clientId, onboardedAt, filteredModules.length])
```

- [ ] **Step 4: Add the completion handler**

Near `handleLogout` (≈line 131), add:
```tsx
const markOnboarded = useCallback(async () => {
  setShowOnboarding(false)
  if (!clientId) return
  if (typeof window !== "undefined") localStorage.setItem(`sf_onboarded_${clientId}`, "1")
  await supabase.from('clients').update({ onboarded_at: new Date().toISOString() }).eq('id', clientId)
}, [clientId, supabase])
```
(`clientId` is the parent/group id for group clients — correct: gating is per top-level login.)

- [ ] **Step 5: Add the `data-tour` hook to the content wrapper**

Find the content wrapper (≈line 381): `<div className="max-w-[1600px] mx-auto">` and change it to:
```tsx
<div className="max-w-[1600px] mx-auto" data-tour="module-content">
```

- [ ] **Step 6: Render the tour overlay**

Just before the final closing `</div>` of the root return (after the Intervencija toast stack block, ≈line 480), add:
```tsx
{showOnboarding && (
  <OnboardingTour
    modules={filteredModules}
    clientName={clientName}
    storedCopy={onboardingCopy}
    onNavigate={(key) => setActiveModule(key as any)}
    onComplete={markOnboarded}
  />
)}
```

- [ ] **Step 7: Verify on the dev server (full flow)**

Pre-req: dev server running (`npm run dev`). Reset the test tenant so the tour re-triggers:
```bash
node -e 'import("@supabase/supabase-js").then(async({createClient})=>{const fs=await import("fs");for(const l of fs.readFileSync(".env.local","utf8").split("\n")){const m=l.match(/^([^#=]+)=(.*)/);if(m)process.env[m[1].trim()]=m[2].trim();}const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const{error}=await sb.from("clients").update({onboarded_at:null}).eq("email","office@crowndental.rs");console.log(error??"reset ok");})'
```
Then in the browser at http://localhost:3000, clear localStorage for the site, log in as `office@crowndental.rs` / `SfCSecR4B9HV`.
Expected: welcome screen → "Krenimo" → each module's content spotlighted with Serbian copy + "Razumem →" → finish → "Hajde da počnemo" closes it. Reload → tour does NOT reappear.

- [ ] **Step 8: Verify an existing client is unaffected**

Log in as an existing client (e.g. OZ Avala) — confirm NO tour appears (backfilled `onboarded_at`).

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx
git commit -m "feat: trigger onboarding tour on first login"
```

---

## Task 9: Localization polish + hide dead search

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Localize the loader/empty strings**

In `app/page.tsx`, replace these English placeholder strings with Serbian:
- `Initialising Growth Engine` → `Učitavanje sistema`
- `Connecting to your obsidian data nodes...` → `Povezivanje sa Vašim podacima...`
- `Synchronizing` → `Sinhronizacija`
- `Accessing encrypted lead nodes...` → `Učitavanje Vaših kontakata...`
- `Awaiting secure handshake with client node...` → `Povezivanje sa Vašim nalogom...`
- `Module node offline or restricted` → `Modul trenutno nije dostupan`

- [ ] **Step 2: Hide the dead header search**

Remove (or comment out) the non-functional search block (≈lines 336-343, the `<div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full ...">` containing the `Universal Search...` input).

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (expected: clean). Reload the dev server and confirm the loader text is Serbian and the search box is gone.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "polish: localize loader strings to Serbian, hide dead search box"
```

---

## Task 10: Generate per-brand copy at demo build

**Files:**
- Modify: `build_demo_tenant.mjs`

- [ ] **Step 1: Locate the insertion point**

Open `build_demo_tenant.mjs`. Find where the demo `clients` row + its `client_modules` are created and the demo `clientId` (referred to as `demoClientId` in its stats code) is known, and where the brand/niche/products are available (website summary / niche / catalog). The new code runs AFTER modules are seeded, BEFORE the script's final summary.

- [ ] **Step 2: Add the copy generator function**

Near the top-level helpers in `build_demo_tenant.mjs`, add:
```js
async function generateOnboardingCopy({ brandName, niche, productSummary, moduleKeys }) {
  const sys = `Ti si copywriter za SmartFlow. Napiši kratak, topao onboarding tekst na srpskom za dashboard brenda "${brandName}" (delatnost: ${niche}). Vrati ISKLJUČIVO JSON: {"welcome": "...", "modules": { "<key>": "..." }, "finish": "..."}. "welcome": jedna rečenica dobrodošlice koja pomene brend. Za svaki ključ iz [${moduleKeys.join(", ")}] jedna rečenica šta taj modul radi baš za ovaj brend. "finish": jedna rečenica ohrabrenja. Bez emodžija osim 👋 u welcome. Kontekst proizvoda/usluga: ${productSummary || "n/a"}.`
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: "gpt-4o-mini", temperature: 0.5, response_format: { type: "json_object" }, messages: [{ role: "user", content: sys }] }),
    })
    const data = await res.json()
    const txt = data?.choices?.[0]?.message?.content
    if (!txt) return null
    const parsed = JSON.parse(txt)
    if (parsed && parsed.welcome && parsed.modules) return parsed
    return null
  } catch (e) {
    console.warn("onboarding copy generation failed (will fall back to defaults):", e.message)
    return null
  }
}
```

- [ ] **Step 3: Call it and store the result**

At the insertion point from Step 1 (after modules seeded, `demoClientId` known), add:
```js
const onboardingCopy = await generateOnboardingCopy({
  brandName: companyName,                 // the lead's brand name in scope
  niche: demoNiche || niche || "biznis",  // whatever niche var the script uses
  productSummary: websiteSummary || "",   // whatever summary var the script uses
  moduleKeys,                              // the array of module keys just seeded for this tenant
})
if (onboardingCopy) {
  await sb.from("clients").update({ onboarding_copy: onboardingCopy }).eq("id", demoClientId)
  console.log("  ✓ onboarding copy stored")
}
// NOTE: do NOT set onboarded_at on new tenants — leaving it null is what triggers the tour.
```
Adjust the variable names in the call (`companyName`, `demoNiche`, `niche`, `websiteSummary`, `moduleKeys`, `demoClientId`, `sb`) to match the identifiers already used in `build_demo_tenant.mjs`.

- [ ] **Step 4: Verify against one tenant (dry, then real)**

Rebuild copy for one existing demo to confirm the JSON stores correctly:
```bash
node build_demo_tenant.mjs --company "Crowndental" --reseed-only
```
Then verify:
```bash
node -e 'import("@supabase/supabase-js").then(async({createClient})=>{const fs=await import("fs");for(const l of fs.readFileSync(".env.local","utf8").split("\n")){const m=l.match(/^([^#=]+)=(.*)/);if(m)process.env[m[1].trim()]=m[2].trim();}const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const{data}=await sb.from("clients").select("name,onboarding_copy").ilike("name","%crowndental%").limit(1);console.log(JSON.stringify(data,null,2));})'
```
Expected: `onboarding_copy` is a populated JSON object with `welcome`, `modules`, `finish`. (If `--reseed-only`/`--company` flags differ in this script, use the script's actual single-tenant invocation.)

- [ ] **Step 5: Commit**

```bash
git add build_demo_tenant.mjs
git commit -m "feat: generate per-brand onboarding copy at demo build"
```

---

## Final verification

- [ ] **Run all unit tests:** `npm test` → all pass.
- [ ] **Typecheck:** `npx tsc --noEmit` → clean.
- [ ] **E2E manual (dev server):** reset `office@crowndental.rs` `onboarded_at=null`, log in → full tour (welcome → modules with personalized copy → finish) → completes → does not recur on reload.
- [ ] **Regression:** existing client (OZ Avala / Harmonija) → no tour; modules + Intervencija toasts still work.
- [ ] **Mobile:** narrow the window → spotlight card stays on-screen, readable, advances.

---

## Acceptance criteria (from spec)
1. New demo tenant first login → welcome → per-module spotlight (Serbian copy) → finish; `onboarded_at` set; no recur. ✅ Task 8/10
2. Reset `onboarded_at=null` → tour re-shows. ✅ Task 8
3. Existing clients never see it. ✅ Task 2 backfill + Task 8
4. Personalized copy when present, clean fallback when absent. ✅ Task 4/10
5. Unskippable, can't dismiss without completing; mobile OK. ✅ Task 6/7
6. No English sci-fi placeholder strings / dead search remain. ✅ Task 9
