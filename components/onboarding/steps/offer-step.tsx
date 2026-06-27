"use client"

import { motion } from "framer-motion"
import { OfferContent } from "@/components/onboarding/offer-content"

interface OfferStepProps {
  brandName: string
  brandColor?: string
  /** Finish the tour (marks onboarded) and drops the user into the live app. */
  onFinish: () => void
}

export function OfferStep({ brandName, brandColor = "#10b981", onFinish }: OfferStepProps) {
  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto px-4 py-10 flex items-start md:items-center justify-center" style={{ background: "#05080c" }}>
      <div className="fixed inset-0 bg-cover bg-center opacity-55 pointer-events-none" style={{ backgroundImage: "url(/onboarding/welcome-bg.jpg)" }} />
      <div className="fixed inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 50%, rgba(5,8,12,0.62), rgba(5,8,12,0.88))" }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0e1116]/95 backdrop-blur-xl shadow-2xl p-7 md:p-9"
      >
        <OfferContent brandName={brandName} brandColor={brandColor} />
        <button onClick={onFinish}
          className="mt-5 w-full text-[13px] text-zinc-400 hover:text-white transition-colors py-2.5 border-t border-white/5">
          Uđite u sistem i istražite sami →
        </button>
      </motion.div>
    </div>
  )
}
