"use client"

import { useEffect, useMemo, useState } from "react"
import type { OnboardingCopy } from "@/lib/onboarding/types"
import type { ModuleLike } from "@/lib/onboarding/steps"
import { Spotlight } from "./spotlight"
import { IntroStep } from "./steps/intro-step"
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

const SERVICE_NICHES = new Set(["dental", "medical", "beauty", "fitness", "services", "wellness", "real-estate"])

// Map each real module to its place in the story.
const STORY_KEY: Record<string, "inbox" | "crm" | "calendar" | "catalog" | "analytics"> = {
  "social-chatbot": "inbox", "chatter-assistant": "inbox",
  "business-crm": "crm", "agent-leads": "crm", "crm-kanban-board": "crm",
  "calendar": "calendar",
  "agent-database": "catalog",
  "chatbot-analytics": "analytics", "analytics": "analytics",
}
const STORY_ORDER = ["inbox", "crm", "calendar", "catalog", "analytics"]

type Copy = { eyebrow: string; title: string; body: string }

const SERVICE_COPY: Record<string, Copy> = {
  inbox: { eyebrow: "Stiže poruka", title: "Razgovor koji agent vodi sam", body: "Marija Vam je pisala. Agent je odgovorio za par sekundi, predložio povoljniju varijantu kad je rekla da je skupo, i zakazao termin — bez Vas. Ovo je pravi razgovor iz Vašeg inboxa." },
  crm: { eyebrow: "Kupac upisan", title: "Marija je već u bazi", body: "Ime, telefon, šta je tražila i zašto je razgovor završio — sve se upisalo samo. Tu je i Nikola, koji nije našao termin subotom: i to je zabeleženo." },
  calendar: { eyebrow: "Termin zakazan", title: "Već u Vašem kalendaru", body: "Termin koji je agent dogovorio — Marija Jović, danas u 15h. Niste ništa kucali ni zvali." },
  catalog: { eyebrow: "Vaš katalog", title: "Odavde agent zna cene", body: "Agent cene, usluge i dostupnost vuče odavde — zato su odgovori uvek tačni." },
  analytics: { eyebrow: "Sve izmereno", title: "Svaki ishod, sa razlogom", body: "Šta kupci najviše pitaju, šta prodaje, i zašto razgovor stane — kao kod Nikole. Podaci su Vaši." },
}
const PRODUCT_COPY: Record<string, Copy> = {
  inbox: { eyebrow: "Stiže poruka", title: "Razgovor koji agent vodi sam", body: "Stefan je poslao sliku proizvoda. Agent ga je prepoznao, ponudio zamenu za rasprodati artikal, uzeo adresu i potvrdio porudžbinu — bez Vas." },
  crm: { eyebrow: "Kupac upisan", title: "Stefan je već u bazi", body: "Ime, telefon, adresa, šta je poručio i status porudžbine — sve se upisalo samo. Tu je i Jelena, čija je reklamacija odmah prosleđena timu." },
  calendar: { eyebrow: "Termini", title: "Zakazivanje, ako Vam treba", body: "Ako nudite i termine, agent ih zakazuje i upisuje ovde — automatski." },
  catalog: { eyebrow: "Vaš magacin", title: "Odavde agent zna stanje", body: "Agent proverava cene i šta je na stanju odavde — zato nikad ne proda nešto čega nema." },
  analytics: { eyebrow: "Sve izmereno", title: "Svaki ishod, sa razlogom", body: "Šta kupci najviše traže, šta prodaje, i gde razgovor stane. Podaci su Vaši." },
}

export function OnboardingTour({ modules, clientName, niche, brandColor = "#10b981", onNavigate, onComplete }: OnboardingTourProps) {
  const isService = SERVICE_NICHES.has((niche || "").toLowerCase())
  const COPY = isService ? SERVICE_COPY : PRODUCT_COPY

  const steps = useMemo(() => {
    const seen = new Set<string>()
    return modules
      .map((m) => ({ m, story: STORY_KEY[m.key] }))
      .filter((x) => x.story && !seen.has(x.story) && (seen.add(x.story), true))
      .sort((a, b) => STORY_ORDER.indexOf(a.story!) - STORY_ORDER.indexOf(b.story!))
      .map((x) => ({ key: x.m.key, ...COPY[x.story!] }))
  }, [modules, COPY])

  // [0] intro · [1..] story spotlights (real modules) · [last] offer
  const firstSpotlight = 1
  const offerIndex = firstSpotlight + steps.length
  const [i, setI] = useState(0)

  useEffect(() => {
    if (i >= firstSpotlight && i < offerIndex) onNavigate(steps[i - firstSpotlight].key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  const next = () => setI((n) => Math.min(n + 1, offerIndex))
  const back = () => setI((n) => Math.max(0, n - 1))

  if (i === 0) return <IntroStep brandColor={brandColor} onNext={next} />
  if (i >= firstSpotlight && i < offerIndex) {
    const s = steps[i - firstSpotlight]
    return (
      <Spotlight
        targetSelector={CONTENT_TARGET}
        eyebrow={s.eyebrow}
        title={s.title}
        body={s.body}
        index={i - firstSpotlight}
        total={steps.length}
        brandColor={brandColor}
        isLast={false}
        onNext={next}
        onBack={back}
      />
    )
  }
  return <OfferStep brandName={clientName} brandColor={brandColor} onFinish={onComplete} />
}
