"use client"

import { motion } from "framer-motion"
import { Check, Phone, CalendarClock } from "lucide-react"

const CAL_LINK = "https://cal.com/smartflow.rs/20min"
const PHONE = "+381 64 118 2200"

interface OfferContentProps {
  brandName: string
  brandColor?: string
}

/**
 * The SmartFlow offer. Rendered both as the onboarding finale (offer-step)
 * and as the persistent "Ponuda" tab. Copy reviewed against the copywriting +
 * marketing-psychology skills: plain Serbian, risk reversal, value anchor,
 * one clear action.
 */
export function OfferContent({ brandName, brandColor = "#10b981" }: OfferContentProps) {
  const steps = [
    { n: "1", title: "Postavljanje — 300€", body: "Agent, CRM i katalog, spremni za Vaš nalog za 7 dana." },
    { n: "2", title: "10 dana besplatno", body: "Radi na Vašim pravim porukama. Bez obaveze, bez kartice." },
    { n: "3", title: "Ako ostane — 350–500€ / mesečno", body: "Zavisi od broja brendova i kanala. Nikad naplata po satu." },
  ]
  return (
    <div className="w-full max-w-md mx-auto text-center">
      <div className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: brandColor }}>
        Ponuda za {brandName || "Vaš brend"}
      </div>
      <h2 className="text-2xl md:text-[30px] font-light text-white font-outfit leading-tight">
        Sve što ste videli — uživo za 7 dana
      </h2>
      <p className="text-sm md:text-[15px] text-zinc-400 leading-relaxed mt-3">
        Postavimo sistem na Vaš Instagram, Facebook i sajt. Vi probate. Ako ostane, plaćate.
      </p>

      {/* Value path */}
      <div className="mt-6 space-y-2.5 text-left">
        {steps.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, delay: i * 0.08 }}
            className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-bold shrink-0 mt-0.5"
              style={{ background: `${brandColor}1c`, color: brandColor, border: `1px solid ${brandColor}30` }}>{s.n}</div>
            <div>
              <div className="text-[15px] font-semibold text-white">{s.title}</div>
              <div className="text-[13px] text-zinc-500 leading-relaxed">{s.body}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Risk reversal */}
      <div className="mt-4 flex items-start gap-2 text-left rounded-2xl px-4 py-3" style={{ background: `${brandColor}10`, border: `1px solid ${brandColor}24` }}>
        <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: brandColor }} />
        <p className="text-[13px] text-zinc-300 leading-relaxed">
          Ne plaćate mesečno dok ne vidite da radi. Posle 10 dana Vi odlučujete — bez obaveze.
        </p>
      </div>

      {/* Value anchor */}
      <p className="text-[12px] text-zinc-500 leading-relaxed mt-3">
        Honorarac za društvene mreže košta više — a ne radi noću, vikendom i praznikom. Sistem radi non-stop.
      </p>

      {/* CTAs */}
      <a href={CAL_LINK} target="_blank" rel="noreferrer"
        className="mt-6 w-full inline-flex items-center justify-center gap-2 text-sm font-semibold px-4 py-3.5 rounded-xl text-[#05080c] transition-transform active:scale-95"
        style={{ background: brandColor }}>
        <CalendarClock className="w-4 h-4" /> Zakažite poziv (20 min)
      </a>
      <a href={`tel:${PHONE.replace(/\s/g, "")}`}
        className="mt-2.5 w-full inline-flex items-center justify-center gap-2 text-[13px] text-zinc-400 hover:text-white transition-colors py-2">
        <Phone className="w-3.5 h-3.5" /> ili pozovite {PHONE}
      </a>
    </div>
  )
}
