"use client"

import { useEffect, useMemo, useState, type ReactElement } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { expandTourSlots, isServiceNiche, type TourSlot } from "@/lib/onboarding/tour-slots"
import { GlyphIntake, GlyphBoundary, GlyphRecord, GlyphSlot, GlyphPattern, GlyphOutlet } from "@/components/onboarding/tour-glyphs"

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

/**
 * Every card carries one idea and ends with one emerald line — the `punch`.
 * That line is the thing we want the viewer still thinking about on the next
 * beat, so it is the only coloured text on the card and always the last thing
 * read. Body copy stays near-white: this is read once, at a glance, over a
 * moving dashboard, and grey loses that fight.
 */
type StepDef = {
  moduleKey: string
  Glyph: (p: { className?: string }) => ReactElement
  eyebrow: string
  title: string
  body: string
  punch: string
  cta?: string
}

export function OnboardingTour({ modules, clientName, niche, brandColor = "#10b981", onNavigate, onPlayback, onSlot, onComplete }: OnboardingTourProps) {
  const isService = isServiceNiche(niche)

  const COPY: Record<TourSlot, StepDef> = useMemo(() => ({
    inbox: {
      moduleKey: "", Glyph: GlyphIntake, eyebrow: "Uživo",
      title: isService ? "Prodaja se dešava. Bez Vas." : "Porudžbina se pravi. Bez Vas.",
      body: isService
        ? "Marija pita cenu. Kaže da je skupo. Agent nudi povoljniju uslugu, dobija „da“ i zakazuje termin."
        : "Stefan šalje sliku. Agent je prepoznaje, nudi zamenu za rasprodati artikal i uzima adresu.",
      punch: "Vi ovo gledate. Niste otkucali ni slovo.",
    },
    "inbox-intervencija": {
      moduleKey: "", Glyph: GlyphBoundary, eyebrow: "Granica",
      title: "Ne izmišlja. Zove Vas.",
      body: isService
        ? "Pitanje koje sme da odluči samo lekar agent ne dira. Upisuje pacijenta, obaveštava Vas i staje."
        : "Reklamaciju agent ne rešava sam. Upisuje kupca, obaveštava Vas i staje.",
      punch: "Vaše ime nikad ne stoji iza pogrešnog odgovora.",
    },
    crm: {
      moduleKey: "", Glyph: GlyphRecord, eyebrow: isService ? "Karton" : "Kartica kupca",
      title: "Zapisano — i ono što niste čuli.",
      body: isService
        ? "Marija je u bazi sa celim razgovorom. I Nikola, koji NIJE zakazao, sa razlogom zašto."
        : "Stefan je u bazi sa celom porudžbinom. I Jelena, koja se žalila, sa razlogom zašto.",
      punch: isService ? "Nijedan pacijent više ne nestaje." : "Nijedan kupac više ne nestaje.",
    },
    termini: {
      moduleKey: "", Glyph: GlyphSlot, eyebrow: "Raspored",
      title: "Kalendar se popunio sam.",
      body: isService
        ? "Nijedan poziv, nijedan upis. Termin u 15h dogovorio je agent — kao i ostale ove nedelje."
        : "Sve što agent dogovori sleće ovde, sa uslugom i cenom — danas, sutra, sledeće nedelje.",
      punch: isService ? "Vi se samo pojavite." : "Vi samo isporučite.",
    },
    analitika: {
      moduleKey: "", Glyph: GlyphPattern, eyebrow: "Istina",
      title: "Zašto ljudi ne zakažu — konačno piše.",
      body: "Šta najviše pitaju. Šta ih zaustavi pred zakazivanje. U koje sate Vas traže.",
      punch: "To Vam nijedan izveštaj do sada nije mogao reći.",
    },
    offer: {
      moduleKey: "", Glyph: GlyphOutlet, eyebrow: `Za ${clientName || "Vaš brend"}`,
      title: "Ovo nije snimak. Ovo je Vaš nalog.",
      body: "Radi na nalozima koje već imate. Ništa se ne seli i ništa se ne menja.",
      punch: "Ostanite i kliknite šta god želite.",
      cta: "Uđite u dashboard",
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
        className="fixed top-4 right-4 md:top-6 md:right-8 z-[320] text-[12px] font-semibold text-[#c9d6d4] hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 bg-[#0b0e14]/80 backdrop-blur transition-colors">
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
              <div className="hidden md:flex w-14 h-14 rounded-2xl items-center justify-center shrink-0 relative"
                style={{ background: `${brandColor}16`, border: `1px solid ${brandColor}45`, color: brandColor }}>
                <step.Glyph className="w-7 h-7" />
                {(step.slot === "inbox" || step.slot === "inbox-intervencija") && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse" style={{ background: brandColor, boxShadow: `0 0 8px ${brandColor}` }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="text-[11px] font-black tracking-wider px-2 py-0.5 rounded-md tabular-nums" style={{ background: brandColor, color: "#05080c" }}>
                    {i + 1}/{steps.length}
                  </span>
                  <span className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: brandColor }}>{step.eyebrow}</span>
                </div>
                <h3 className="text-[21px] md:text-[30px] font-bold text-white leading-[1.06] tracking-[-0.02em] font-outfit">{step.title}</h3>
                <p className="text-[14px] md:text-[16px] text-[#e8eff0] leading-[1.4] font-medium mt-1.5">
                  {step.body}{" "}
                  <span className="font-bold" style={{ color: brandColor }}>{step.punch}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                {i > 0 && (
                  <button onClick={back} className="text-sm font-semibold text-[#c9d6d4] hover:text-white px-2.5 py-2.5 transition-colors">Nazad</button>
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
