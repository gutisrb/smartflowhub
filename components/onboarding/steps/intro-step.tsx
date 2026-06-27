"use client"

import { motion } from "framer-motion"

interface IntroStepProps {
  brandColor?: string
  onNext: () => void
}

export function IntroStep({ brandColor = "#10b981", onNext }: IntroStepProps) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4 overflow-hidden" style={{ background: "#05080c" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-xl text-center"
      >
        {/* Hero visualization */}
        <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl mb-7">
          <img src="/onboarding/intro-bg.jpg" alt="" className="w-full h-44 md:h-56 object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(5,8,12,0) 50%, rgba(5,8,12,0.9))" }} />
        </div>

        <div className="text-[11px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: brandColor }}>SmartFlow</div>
        <h1 className="text-2xl md:text-[32px] font-light text-white font-outfit leading-tight">
          AI prodavac za Vaše društvene mreže
        </h1>
        <p className="text-sm md:text-[15px] text-zinc-400 leading-relaxed mt-3 max-w-md mx-auto">
          Kupci Vam pišu sa Instagrama, Facebooka, sajta i telefona — više nego što ijedan tim stigne da isprati.
          SmartFlow odgovori na svaku poruku za par sekundi, vodi kupca do kupovine, i sve zabeleži.
          Svaki razgovor postaje podatak koji je Vaš.
        </p>

        <button onClick={onNext}
          className="mt-7 inline-flex text-sm font-semibold px-7 py-3.5 rounded-xl text-[#05080c] transition-transform active:scale-95"
          style={{ background: brandColor }}>
          Pokažite mi kako radi →
        </button>
      </motion.div>
    </div>
  )
}
