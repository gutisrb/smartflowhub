"use client"

import { Play } from "lucide-react"
import { OfferContent } from "@/components/onboarding/offer-content"

interface PonudaModuleProps {
  clientName: string
  brandColor?: string
  niche?: string | null
  flows?: { inStore?: boolean; orderTracking?: boolean; stays?: boolean } | null
  onReplay?: () => void
}

export function PonudaModule({ clientName, brandColor = "#10b981", niche, flows, onReplay }: PonudaModuleProps) {
  return (
    <div className="relative">
      <div className="relative mt-2 pb-10">
        <OfferContent brandName={clientName} brandColor={brandColor} niche={niche} flows={flows} />
        {onReplay && (
          <div className="flex justify-center mt-8">
            <button
              onClick={onReplay}
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-zinc-500 hover:text-zinc-200 px-4 py-2.5 rounded-xl border border-white/8 hover:border-white/20 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-200"
            >
              <Play className="w-3.5 h-3.5" /> Ponovo pogledajte obilazak
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
