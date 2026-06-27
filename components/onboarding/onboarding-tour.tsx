"use client"

import { useEffect, useMemo, useState } from "react"
import { resolveModuleCopy } from "@/lib/onboarding/copy"
import type { OnboardingCopy } from "@/lib/onboarding/types"
import type { ModuleLike } from "@/lib/onboarding/steps"
import { Spotlight } from "./spotlight"
import { WelcomeStep } from "./steps/welcome-step"
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

export function OnboardingTour({ modules, clientName, storedCopy, niche, brandColor = "#10b981", onNavigate, onComplete }: OnboardingTourProps) {
  const moduleSteps = useMemo(
    () => modules.map((m) => ({ key: m.key, title: m.displayName, body: resolveModuleCopy(storedCopy, m.key) })),
    [modules, storedCopy],
  )

  // Screen layout: [0] welcome · [1] agent-demo · [2..] module spotlights · [last] offer
  const firstSpotlight = 2
  const offerIndex = firstSpotlight + moduleSteps.length
  const [i, setI] = useState(0)

  // When entering a spotlight screen, switch the dashboard to that module.
  useEffect(() => {
    if (i >= firstSpotlight && i < offerIndex) {
      onNavigate(moduleSteps[i - firstSpotlight].key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  const next = () => setI((n) => Math.min(n + 1, offerIndex))
  const back = () => setI((n) => Math.max(0, n - 1))

  if (i === 0) {
    return <WelcomeStep brandName={clientName} brandColor={brandColor} welcomeCopy={storedCopy?.welcome} onNext={next} />
  }
  if (i === 1) {
    return <AgentDemoStep brandName={clientName} brandColor={brandColor} niche={niche} onNext={next} />
  }
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
