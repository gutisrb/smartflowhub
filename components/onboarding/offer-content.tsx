"use client"

import { motion } from "framer-motion"
import { Phone, CalendarClock, Zap, ShieldCheck, MessageSquare, ArrowRight } from "lucide-react"

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
 * "Ponuda" tab. Sells the outcome — no prices here (those belong on the call).
 * One job: make them want to book. Copy run through copywriting + marketing-psychology.
 */
export function OfferContent({ brandName, brandColor = "#10b981", onPrimary, compact }: OfferContentProps) {
  const benefits = [
    { icon: Zap, title: "Odgovara za par sekundi", body: "Dan i noć, vikendom i praznikom. Kupac nikad ne čeka." },
    { icon: MessageSquare, title: "Vodi kupca do kupovine", body: "Predlaže, reši primedbu na cenu, zakaže ili primi porudžbinu." },
    { icon: ShieldCheck, title: "Nijedan upit ne propada", body: "Svaki kupac upisan, ispraćen i zabeležen — automatski." },
  ]

  return (
    <div className={`w-full ${compact ? "max-w-3xl" : "max-w-4xl"} mx-auto`}>
      {/* hero */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}
        className="relative rounded-3xl overflow-hidden border border-white/10"
      >
        <img src="/onboarding/ponuda-hero.jpg" alt="" className="w-full h-[200px] md:h-[300px] object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(5,8,12,0.1) 0%, rgba(5,8,12,0.55) 55%, #05080c 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-9">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: brandColor }}>
            SmartFlow za {brandName || "Vaš brend"}
          </div>
          <h2 className="text-[26px] md:text-[40px] font-bold text-white font-outfit leading-[1.05] max-w-xl">
            Prodavac koji nikad ne spava
          </h2>
        </div>
      </motion.div>

      {/* sub */}
      <p className="text-[15px] md:text-[17px] text-zinc-300 leading-relaxed mt-5 md:mt-6 max-w-2xl">
        Sve što ste upravo videli — agent koji odgovara, prodaje i zakazuje — radi uživo na Vašem Instagramu,
        Facebooku i sajtu. <span className="text-white font-semibold">Vi dobijate gotove rezultate.</span>
      </p>

      {/* benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
        {benefits.map((b, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
            className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${brandColor}18`, border: `1px solid ${brandColor}35` }}>
              <b.icon className="w-4.5 h-4.5" style={{ color: brandColor }} />
            </div>
            <p className="text-[15px] font-semibold text-white leading-tight">{b.title}</p>
            <p className="text-[13px] text-zinc-400 leading-relaxed mt-1.5">{b.body}</p>
          </motion.div>
        ))}
      </div>

      {/* risk reversal */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl px-5 py-4" style={{ background: `${brandColor}10`, border: `1px solid ${brandColor}24` }}>
        <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" style={{ color: brandColor }} />
        <p className="text-[14px] text-zinc-200 leading-relaxed">
          <span className="font-semibold text-white">Probate ga uživo, na svojim kupcima.</span>{" "}
          Postavimo ga na Vaše naloge i pustimo da radi — pre bilo kakve obaveze. Detalje rešavamo u kratkom pozivu.
        </p>
      </div>

      {/* CTA */}
      <div className="mt-6 flex flex-col items-center">
        <a href={CAL_LINK} target="_blank" rel="noreferrer" onClick={() => onPrimary?.()}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2.5 text-base font-bold px-8 py-4 rounded-2xl text-[#05080c] transition-transform active:scale-[0.98] hover:scale-[1.01]"
          style={{ background: brandColor, boxShadow: `0 14px 40px -10px ${brandColor}` }}>
          <CalendarClock className="w-5 h-5" /> Zakažite poziv — 20 minuta
        </a>
        <a href={`tel:${PHONE.replace(/\s/g, "")}`}
          className="mt-3 inline-flex items-center gap-2 text-[14px] text-zinc-400 hover:text-white transition-colors py-1.5">
          <Phone className="w-4 h-4" /> ili pozovite direktno {PHONE}
        </a>
        {onPrimary && (
          <button onClick={onPrimary}
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
            Uđite u svoj dashboard <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
