"use client"

import { motion } from "framer-motion"
import { Phone, CalendarClock, ArrowRight } from "lucide-react"

const CAL_LINK = "https://cal.com/smartflow.rs/20min"
const PHONE = "+381 64 118 2200"

interface OfferContentProps {
  brandName: string
  brandColor?: string
  /** when set (film finale), a secondary "enter dashboard" action is shown and primary also fires this */
  onPrimary?: () => void
  /** tighter vertical rhythm for the film stage */
  compact?: boolean
}

/**
 * The SmartFlow close. Rendered both as the onboarding finale and the persistent
 * "Ponuda" tab. No prices — those belong on the call.
 *
 * Laid out to be read in one screen, without scrolling, because during the tour a
 * fixed narration bar owns the bottom of the viewport: an earlier stacked version
 * pushed the CTA underneath it. So the argument runs in two columns — the claim on
 * the left, the proof of it on the right — and the CTA sits on the fold, not below it.
 *
 * The hero image is a wash behind the headline rather than a banner above it; a
 * 300px letterbox bought atmosphere at the cost of the only button that matters.
 */

const HANDOFF: { before: string; after: string }[] = [
  { before: "Odgovarate na ista pitanja, po ceo dan", after: "Odgovor za 30 sekundi — i u 23h" },
  { before: "Prepisujete ime i broj u svesku", after: "Upisano samo, sa celim razgovorom" },
  { before: "Termine dogovarate telefonom, u pauzi", after: "Termin već stoji u kalendaru" },
  { before: "Ne znate ko nije zakazao — ni zašto", after: "Piše, poimence, sa razlogom" },
]

export function OfferContent({ brandName, brandColor = "#10b981", onPrimary }: OfferContentProps) {
  return (
    <div className="w-full max-w-[1100px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-5 lg:gap-7 items-stretch">

        {/* claim */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="relative rounded-3xl overflow-hidden border border-white/10 px-6 py-7 md:px-8 md:py-9 flex flex-col justify-center min-h-[300px]"
        >
          <img src="/onboarding/ponuda-hero.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(115deg, #05080c 26%, rgba(5,8,12,0.82) 58%, rgba(5,8,12,0.5) 100%)" }} />

          <div className="relative">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] mb-3" style={{ color: brandColor }}>
              SmartFlow za {brandName || "Vaš brend"}
            </div>
            <h2 className="text-[32px] md:text-[46px] font-bold text-white font-outfit leading-[0.98] tracking-[-0.03em]">
              Poruke ulaze.<br />
              <span style={{ color: brandColor }}>Termini izlaze.</span>
            </h2>
            <p className="text-[15px] md:text-[16px] text-[#e8eff0] leading-[1.45] mt-4 max-w-md">
              Odgovor, primedba na cenu, upis u bazu, mesto u kalendaru — sve između se odradi samo.{" "}
              <span className="text-white font-semibold">Vi vidite gotov rezultat.</span>
            </p>
          </div>
        </motion.div>

        {/* proof: what stops being your job */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-3xl border border-white/10 bg-white/[0.025] overflow-hidden flex flex-col"
        >
          <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 px-5 py-3 border-b border-white/10">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9fb0ad]">Danas to radite Vi</span>
            <span aria-hidden className="w-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: brandColor }}>Od sutra to radi sistem</span>
          </div>

          {HANDOFF.map((row) => (
            <div
              key={row.before}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 px-5 py-3.5 border-b border-white/[0.06] last:border-b-0 flex-1"
            >
              <span className="text-[13px] text-[#a9b8b5] leading-snug">{row.before}</span>
              <ArrowRight className="w-4 h-4 shrink-0" style={{ color: brandColor }} />
              <span className="text-[13px] text-white font-semibold leading-snug">{row.after}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* close: risk reversal and the call, side by side so both sit on the fold */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18 }}
        className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 items-center rounded-3xl px-6 py-5"
        style={{ background: `${brandColor}0e`, border: `1px solid ${brandColor}2e` }}
      >
        <p className="text-[14px] text-[#e8eff0] leading-relaxed">
          <span className="font-bold text-white">Probate ga uživo, na svojim pacijentima.</span>{" "}
          Postavimo ga na Instagram, Facebook i sajt koje već imate — ništa se ne seli, ništa ne menja,
          i Vaši ljudi ne uče novi softver. Detalje rešavamo u pozivu od 20 minuta.
        </p>

        <div className="flex flex-col items-center lg:items-end shrink-0">
          <a href={CAL_LINK} target="_blank" rel="noreferrer" onClick={() => onPrimary?.()}
            className="w-full lg:w-auto inline-flex items-center justify-center gap-2.5 text-[15px] font-bold px-7 py-3.5 rounded-2xl text-[#05080c] transition-transform active:scale-[0.98] hover:scale-[1.02] whitespace-nowrap"
            style={{ background: brandColor, boxShadow: `0 14px 40px -10px ${brandColor}` }}>
            <CalendarClock className="w-[18px] h-[18px]" /> Zakažite poziv — 20 minuta
          </a>
          <a href={`tel:${PHONE.replace(/\s/g, "")}`}
            className="mt-2.5 inline-flex items-center gap-2 text-[13px] text-[#c9d6d4] hover:text-white transition-colors">
            <Phone className="w-3.5 h-3.5" /> ili pozovite {PHONE}
          </a>
        </div>
      </motion.div>
    </div>
  )
}
