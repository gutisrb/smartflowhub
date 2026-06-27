"use client"

import { useEffect, useMemo, useState } from "react"
import { resolveModuleCopy } from "@/lib/onboarding/copy"
import type { OnboardingCopy } from "@/lib/onboarding/types"
import type { ModuleLike } from "@/lib/onboarding/steps"
import { Spotlight } from "./spotlight"
import { IntroStep } from "./steps/intro-step"
import { AgentDemoStep } from "./steps/agent-demo-step"
import { OfferStep } from "./steps/offer-step"

interface OnboardingTourProps {
  modules: ModuleLike[]
  clientName: string
  storedCopy: OnboardingCopy | null
  niche: string | null
  brandColor?: string
  onNavigate: (key: string) => void
  onComplete: () => void
}

const CONTENT_TARGET = '[data-tour="module-content"]'

// Modules covered elsewhere in the story (the conversation = inbox, offer = ponuda)
// or not part of the narrative — skipped in the spotlight walk.
const SKIP_IN_WALK = new Set([
  "social-chatbot", "chatter-assistant", "ponuda", "settings", "website-chatbot",
])

// Story narration for each module — frames it as the next beat of the sale,
// not a feature description. Falls back to the per-module default copy.
const STORY_COPY: Record<string, string> = {
  "business-crm": "Kupac se upravo sam upisao ovde — ime, kontakt i šta je tražio. Ništa ne kucate ručno.",
  "agent-leads": "Kupac se upravo sam upisao ovde — ime, kontakt i šta je tražio. Ništa ne kucate ručno.",
  "crm-kanban-board": "Svaki kupac iz razgovora sleti ovde, u Vašu bazu — spreman za sledeći korak.",
  "agent-database": "Agent cene i podatke vuče odavde, iz Vašeg kataloga — odgovori su uvek tačni.",
  "calendar": "Termin koji je agent zakazao sleteo je ovde, u Vaš kalendar.",
  "chatbot-analytics": "Svaki razgovor je izmeren: šta kupci pitaju, šta prodaje i u koje vreme. Podaci su Vaši.",
  "analytics": "Svaki razgovor je izmeren: šta kupci pitaju, šta prodaje i u koje vreme. Podaci su Vaši.",
}

export function OnboardingTour({ modules, clientName, storedCopy, niche, brandColor = "#10b981", onNavigate, onComplete }: OnboardingTourProps) {
  const moduleSteps = useMemo(
    () => modules
      .filter((m) => !SKIP_IN_WALK.has(m.key))
      .map((m) => ({ key: m.key, title: m.displayName, body: STORY_COPY[m.key] ?? resolveModuleCopy(storedCopy, m.key) })),
    [modules, storedCopy],
  )

  // Screens: [0] intro · [1] agent-demo (Inbox) · [2..] story spotlights · [last] offer
  const firstSpotlight = 2
  const offerIndex = firstSpotlight + moduleSteps.length
  const [i, setI] = useState(0)

  useEffect(() => {
    if (i === 1) {
      onNavigate("social-chatbot") // play the conversation in the AI Inbox context
    } else if (i >= firstSpotlight && i < offerIndex) {
      onNavigate(moduleSteps[i - firstSpotlight].key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  const next = () => setI((n) => Math.min(n + 1, offerIndex))
  const back = () => setI((n) => Math.max(0, n - 1))

  if (i === 0) return <IntroStep brandColor={brandColor} onNext={next} />
  if (i === 1) return <AgentDemoStep brandName={clientName} brandColor={brandColor} niche={niche} onNext={next} />
  if (i >= firstSpotlight && i < offerIndex) {
    const step = moduleSteps[i - firstSpotlight]
    return (
      <Spotlight
        targetSelector={CONTENT_TARGET}
        title={step.title}
        body={step.body}
        index={i - firstSpotlight}
        total={moduleSteps.length}
        brandColor={brandColor}
        isLast={false}
        onNext={next}
        onBack={back}
      />
    )
  }
  return <OfferStep brandName={clientName} brandColor={brandColor} onFinish={onComplete} />
}
