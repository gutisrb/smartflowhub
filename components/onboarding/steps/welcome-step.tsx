"use client"

import { motion } from "framer-motion"

interface WelcomeStepProps {
  brandName: string
  brandColor?: string
  welcomeCopy?: string | null
  onNext: () => void
}

export function WelcomeStep({ brandName, brandColor = "#10b981", welcomeCopy, onNext }: WelcomeStepProps) {
  const heading = welcomeCopy?.trim() || `Dobrodošli, ${brandName || "tu ste"} 👋`
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4" style={{ background: "rgba(5,8,12,0.9)" }}>
      <div className="fixed -top-24 -left-24 w-96 h-96 rounded-full blur-[130px] pointer-events-none" style={{ background: `${brandColor}1c` }} />
      <div className="fixed -bottom-24 -right-24 w-96 h-96 rounded-full blur-[110px] pointer-events-none" style={{ background: `${brandColor}12` }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-w-md mx-4 rounded-3xl border border-white/10 bg-[#0e1116]/95 backdrop-blur-xl shadow-2xl p-8 md:p-10 text-center"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-6 text-2xl"
          style={{ background: `${brandColor}1f`, border: `1px solid ${brandColor}33`, color: brandColor }}>✦</div>
        <h2 className="text-2xl md:text-[28px] font-light text-white font-outfit leading-tight">{heading}</h2>
        <p className="text-sm md:text-[15px] text-zinc-400 leading-relaxed mt-3">
          Napravili smo Vam sistem koji sam vodi razgovore sa kupcima. Za jedan minut da Vam pokažem šta radi.
        </p>
        <button onClick={onNext}
          className="mt-7 w-full text-sm font-semibold px-4 py-3.5 rounded-xl text-[#05080c] transition-transform active:scale-95"
          style={{ background: brandColor }}>
          Krenimo →
        </button>
        <div className="text-[11px] text-zinc-600 mt-3">traje oko minut · možete da preskočite korake</div>
      </motion.div>
    </div>
  )
}
