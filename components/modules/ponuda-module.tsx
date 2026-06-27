"use client"

import { OfferContent } from "@/components/onboarding/offer-content"

interface PonudaModuleProps {
  clientName: string
  brandColor?: string
}

export function PonudaModule({ clientName, brandColor = "#10b981" }: PonudaModuleProps) {
  return (
    <div className="relative">
      <div className="fixed -top-32 right-0 w-[32rem] h-[32rem] rounded-full blur-[140px] pointer-events-none" style={{ background: `${brandColor}10` }} />
      <div className="relative max-w-md mx-auto rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl shadow-2xl p-7 md:p-9 mt-2">
        <OfferContent brandName={clientName} brandColor={brandColor} />
      </div>
    </div>
  )
}
