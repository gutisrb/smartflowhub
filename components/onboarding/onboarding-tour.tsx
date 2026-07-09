"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageCircle, Database, Calendar, BarChart3, Sparkles, ArrowRight, ShieldAlert, FileText } from "lucide-react"
import { expandTourSlots, isServiceNiche, type TourSlot } from "@/lib/onboarding/tour-slots"

interface ModuleLike { key: string }

interface OnboardingTourProps {
  modules: ModuleLike[]
  clientName: string
  niche: string | null
  brandColor?: string
  onNavigate: (key: string) => void
  onPlayback: (on: boolean) => void
  onSlot?: (slot: string) => void
  onComplete: () => void
}

type StepDef = { moduleKey: string; icon: any; eyebrow: string; title: string; body: string; cta?: string }

export function OnboardingTour({ modules, clientName, niche, brandColor = "#10b981", onNavigate, onPlayback, onSlot, onComplete }: OnboardingTourProps) {
  const isService = isServiceNiche(niche)

  const COPY: Record<TourSlot, StepDef> = useMemo(() => ({
    inbox: {
      moduleKey: "", icon: MessageCircle, eyebrow: "Uživo · AI Inbox",
      title: "Razgovor koji agent vodi sam",
      body: isService
        ? "Marija Vam piše. Gledajte uživo — agent odgovara, reši primedbu na cenu i zakaže termin, ovde u Vašem inboxu. Bez Vas."
        : "Stefan šalje sliku proizvoda. Gledajte uživo — agent je prepozna, ponudi zamenu i napravi porudžbinu, ovde u Vašem inboxu. Bez Vas.",
    },
    "inbox-intervencija": {
      moduleKey: "", icon: ShieldAlert, eyebrow: "Uživo · Intervencija",
      title: "Kada agent ne zna — ne izmišlja",
      body: isService
        ? "Pacijent pita ono što sme da odluči samo lekar. Agent ne nagađa: obaveštava Vas i predaje razgovor — a Vi odgovarate iz ovog istog inboxa."
        : "Jelena javlja da je proizvod stigao oštećen. Agent ne raspravlja: obaveštava Vas i predaje razgovor — a Vi odgovarate iz ovog istog inboxa.",
    },
    crm: {
      moduleKey: "", icon: Database, eyebrow: "Automatski upis",
      title: isService ? "Marija je već u bazi" : "Stefan je već u bazi",
      body: isService
        ? "Čim se razgovor završio, kupac je upisan ovde — na vrhu liste. Ime, telefon, usluga i status „Zakazano“. Niste kucali ništa."
        : "Čim je porudžbina napravljena, kupac je upisan ovde — na vrhu liste. Ime, kontakt, proizvod i status. Niste kucali ništa.",
    },
    "crm-log": {
      moduleKey: "", icon: FileText, eyebrow: isService ? "Dosije pacijenta" : "Dosije kupca",
      title: "Svaka reč, zabeležena",
      body: isService
        ? "Kliknite bilo kog pacijenta — ceo razgovor, status i razlog su tu. I Nikola, koji NIJE zakazao, upisan je sa razlogom: čeka termin subotom. Nijedan upit ne propada."
        : "Stefanova porudžbina se prati do isporuke — status „Poslato“. I Jelena, koja se žalila, zabeležena je sa razlogom. Ništa ne propada.",
    },
    termini: {
      moduleKey: "", icon: Calendar, eyebrow: "Termin zakazan",
      title: "Već u Vašem kalendaru",
      body: "Termin koji je agent dogovorio sedi u rasporedu — danas u 15h. Vi se samo pojavite.",
    },
    analitika: {
      moduleKey: "", icon: BarChart3, eyebrow: "Sve izmereno",
      title: "Svaki razgovor postaje podatak",
      body: "Koliko upita stiže, šta prodaje i koji kanal vuče — sve se broji samo. Vaš dan, na prvi pogled.",
    },
    offer: {
      moduleKey: "", icon: Sparkles, eyebrow: `Ponuda za ${clientName || "Vaš brend"}`,
      title: "Ovo je Vaš sistem",
      body: "Sve što ste videli radi uživo na Vašim mrežama. Pogledajte ponudu kad ste spremni — a dashboard je već Vaš za istraživanje.",
      cta: "Završi i istraži",
    },
  }), [isService, clientName])

  const steps = useMemo(
    () => expandTourSlots(modules.map((m) => m.key)).map(({ slot, moduleKey }) => ({ ...COPY[slot], moduleKey, slot })),
    [modules, COPY],
  )

  const [i, setI] = useState(0)
  const step = steps[i]
  const last = i === steps.length - 1

  useEffect(() => {
    if (!step) return
    onNavigate(step.moduleKey)
    onPlayback(step.slot === "inbox" || step.slot === "inbox-intervencija")
    onSlot?.(step.slot)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  const finish = () => { onPlayback(false); onComplete() }
  const next = () => { if (last) finish(); else setI((n) => n + 1) }
  const back = () => setI((n) => Math.max(0, n - 1))

  if (!step) return null

  return (
    <>
      {/* skip */}
      <button onClick={finish}
        className="fixed top-4 right-4 md:top-6 md:right-8 z-[320] text-[12px] font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 bg-[#0b0e14]/80 backdrop-blur transition-colors">
        Preskoči obilazak →
      </button>

      {/* narration — fixed bottom bar, never covers the module content */}
      <div className="fixed inset-x-0 bottom-0 z-[315] pointer-events-none">
        <div className="mx-auto max-w-[1180px] px-3 md:px-6 pb-4 md:pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto rounded-2xl border bg-[#0b0e14]/95 backdrop-blur-xl shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] px-5 md:px-7 py-4 md:py-5 flex items-center gap-5"
              style={{ borderColor: `${brandColor}40` }}
            >
              <div className="hidden md:flex w-12 h-12 rounded-2xl items-center justify-center shrink-0 relative"
                style={{ background: `${brandColor}18`, border: `1px solid ${brandColor}40` }}>
                <step.icon className="w-5 h-5" style={{ color: brandColor }} />
                {(step.slot === "inbox" || step.slot === "inbox-intervencija") && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse" style={{ background: brandColor, boxShadow: `0 0 8px ${brandColor}` }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-[12px] font-extrabold tracking-wider px-2 py-0.5 rounded-md" style={{ background: brandColor, color: "#05080c" }}>
                    {i + 1} / {steps.length}
                  </span>
                  <span className="text-[12px] font-bold uppercase tracking-[0.15em]" style={{ color: brandColor }}>{step.eyebrow}</span>
                </div>
                <h3 className="text-lg md:text-2xl font-bold text-white leading-tight font-outfit">{step.title}</h3>
                <p className="text-[13px] md:text-[15px] text-zinc-300 leading-snug font-medium mt-0.5">{step.body}</p>
              </div>
              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                {i > 0 && (
                  <button onClick={back} className="text-sm font-semibold text-zinc-400 hover:text-white px-2.5 py-2.5 transition-colors">Nazad</button>
                )}
                <button onClick={next}
                  className="text-sm font-bold px-5 md:px-7 py-3 rounded-xl text-[#05080c] transition-transform active:scale-95 flex items-center gap-2"
                  style={{ background: brandColor, boxShadow: `0 8px 24px -8px ${brandColor}` }}>
                  {last ? (step.cta || "Završi") : "Dalje"} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
          {/* progress dots */}
          <div className="flex justify-center gap-1.5 mt-3">
            {steps.map((_, idx) => (
              <span key={idx} className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: idx === i ? 26 : 7, background: idx === i ? brandColor : "rgba(255,255,255,0.2)" }} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
