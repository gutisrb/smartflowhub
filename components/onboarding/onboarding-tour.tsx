"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { buildSteps, type ModuleLike } from "@/lib/onboarding/steps"
import type { OnboardingCopy } from "@/lib/onboarding/types"
import { Spotlight } from "./spotlight"

interface OnboardingTourProps {
  modules: ModuleLike[]
  clientName: string
  storedCopy: OnboardingCopy | null
  brandColor?: string
  onNavigate: (key: string) => void
  onComplete: () => void
}

export function OnboardingTour({ modules, clientName, storedCopy, brandColor = "#10b981", onNavigate, onComplete }: OnboardingTourProps) {
  const steps = useMemo(() => buildSteps(modules, storedCopy, clientName), [modules, storedCopy, clientName])
  const [i, setI] = useState(0)
  const step = steps[i]

  // When entering a module step, switch the dashboard to that module so the
  // content area (the spotlight target) renders it.
  useEffect(() => {
    if (step?.kind === "module" && step.moduleKey) onNavigate(step.moduleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  if (!step) return null

  const next = () => { if (i >= steps.length - 1) onComplete(); else setI(i + 1) }
  const back = () => setI((n) => Math.max(0, n - 1))

  if (step.kind === "module") {
    return (
      <Spotlight
        targetSelector={step.targetSelector!}
        title={step.title}
        body={step.body}
        index={i}
        total={steps.length}
        brandColor={brandColor}
        isLast={false}
        onNext={next}
        onBack={back}
      />
    )
  }

  // welcome / finish — full-screen centered glass card
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: "rgba(5,8,12,0.86)" }}>
      <div className="fixed -top-24 -left-24 w-96 h-96 rounded-full blur-[120px] pointer-events-none" style={{ background: `${brandColor}1a` }} />
      <div className="fixed -bottom-24 -right-24 w-96 h-96 rounded-full blur-[100px] pointer-events-none" style={{ background: `${brandColor}10` }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative max-w-md mx-4 rounded-3xl border border-white/10 bg-[#0e1116]/95 backdrop-blur-xl shadow-2xl p-8 text-center"
      >
        <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-5"
          style={{ background: `${brandColor}1f`, border: `1px solid ${brandColor}33` }}>
          <span style={{ color: brandColor }} className="text-xl">{step.kind === "welcome" ? "✦" : "✓"}</span>
        </div>
        <h2 className="text-2xl font-light text-white mb-2 font-outfit">{step.title}</h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-6">{step.body}</p>
        <button onClick={next} className="w-full text-sm font-semibold px-4 py-3 rounded-xl text-[#05080c] transition-transform active:scale-95"
          style={{ background: brandColor }}>
          {step.kind === "welcome" ? "Krenimo →" : "Hajde da počnemo"}
        </button>
        {step.kind === "welcome" && steps.length > 2 && (
          <div className="text-[11px] text-zinc-600 mt-3">{steps.length - 2} koraka · oko 1 minut</div>
        )}
      </motion.div>
    </div>
  )
}
