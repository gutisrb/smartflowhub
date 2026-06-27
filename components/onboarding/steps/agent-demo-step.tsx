"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Calendar, ShoppingBag, BarChart3, AlertTriangle, ImageIcon, Instagram } from "lucide-react"
import { getShowcaseConversation, type ChatBeat } from "@/lib/onboarding/conversation"

interface AgentDemoStepProps {
  brandName: string
  brandColor?: string
  niche: string | null
  onNext: () => void
}

const BADGE_ICON = {
  crm: ShoppingBag,
  calendar: Calendar,
  analytics: BarChart3,
  intervencija: AlertTriangle,
} as const

export function AgentDemoStep({ brandName, brandColor = "#10b981", niche, onNext }: AgentDemoStepProps) {
  const conv = useMemo(() => getShowcaseConversation(niche), [niche])
  const [shown, setShown] = useState(0)
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const done = shown >= conv.beats.length

  // Auto-play the thread, beat by beat, with an agent "typing" pause.
  useEffect(() => {
    if (shown >= conv.beats.length) return
    const beat = conv.beats[shown]
    let t1: ReturnType<typeof setTimeout> | undefined
    let t2: ReturnType<typeof setTimeout> | undefined
    if (beat.role === "agent" && beat.typing) {
      setTyping(true)
      t1 = setTimeout(() => { setTyping(false); setShown((s) => s + 1) }, beat.typing)
    } else {
      t2 = setTimeout(() => setShown((s) => s + 1), beat.role === "system" ? 560 : 720)
    }
    return () => { if (t1) clearTimeout(t1); if (t2) clearTimeout(t2) }
  }, [shown, conv])

  // Keep the latest bubble in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [shown, typing])

  const skip = () => { setTyping(false); setShown(conv.beats.length) }
  const initial = brandName?.trim()?.charAt(0).toUpperCase() || "S"

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-4" style={{ background: "rgba(5,8,12,0.88)" }}>
      <div className="fixed -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full blur-[140px] pointer-events-none" style={{ background: `${brandColor}14` }} />

      {/* Heading */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative text-center mb-4 max-w-sm"
      >
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: brandColor }}>Uživo</div>
        <h2 className="text-xl md:text-2xl font-light text-white font-outfit leading-snug">
          Ovako Vaš agent odgovara, prodaje i beleži
        </h2>
        <p className="text-sm text-zinc-500 mt-1.5">Bez Vas. Dok spavate, na poslu, vikendom.</p>
      </motion.div>

      {/* Chat panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#0b0e13]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
      >
        {/* DM header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[#05080c] font-bold text-sm shrink-0" style={{ background: brandColor }}>{initial}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{brandName || "Vaš brend"}</div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: brandColor }} /> aktivan · odgovara odmah
            </div>
          </div>
          <Instagram className="w-4 h-4 text-zinc-600 shrink-0" />
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="h-[58vh] max-h-[420px] overflow-y-auto px-3.5 py-4 space-y-2.5 scrollbar-none">
          <AnimatePresence initial={false}>
            {conv.beats.slice(0, shown).map((beat, i) => (
              <Bubble key={i} beat={beat} brandColor={brandColor} />
            ))}
          </AnimatePresence>
          {typing && <TypingBubble brandColor={brandColor} />}
        </div>
      </motion.div>

      {/* Footer / continue */}
      <div className="relative mt-5 h-11 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.button
              key="next"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              onClick={onNext}
              className="text-sm font-semibold px-6 py-3 rounded-xl text-[#05080c] transition-transform active:scale-95"
              style={{ background: brandColor }}
            >
              Razumem — šta još?
            </motion.button>
          ) : (
            <motion.button
              key="skip"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={skip}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              preskoči →
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Bubble({ beat, brandColor }: { beat: ChatBeat; brandColor: string }) {
  if (beat.role === "system") {
    const Icon = BADGE_ICON[beat.badge ?? "crm"]
    const intervencija = beat.badge === "intervencija"
    const accent = intervencija ? "#ef4444" : brandColor
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="flex justify-center py-1"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-medium"
          style={{ background: `${accent}14`, borderColor: `${accent}33`, color: accent }}>
          <Icon className="w-3.5 h-3.5" />
          {beat.text}
        </div>
      </motion.div>
    )
  }

  const isCustomer = beat.role === "customer"
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}
    >
      <div className={`max-w-[78%] ${isCustomer ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {beat.image && (
          <div className="w-36 h-28 rounded-2xl border border-white/10 overflow-hidden relative"
            style={{ background: "linear-gradient(135deg,#1a1f29,#0d1117)" }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-zinc-500">
              <ImageIcon className="w-6 h-6" />
              <span className="text-[10px]">slika proizvoda</span>
            </div>
          </div>
        )}
        {beat.text && (
          <div
            className={`px-3.5 py-2 text-[13px] leading-relaxed rounded-2xl ${isCustomer ? "text-zinc-100 rounded-br-md" : "text-zinc-100 rounded-bl-md"}`}
            style={isCustomer
              ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.06)" }
              : { background: `${brandColor}1c`, border: `1px solid ${brandColor}30` }}
          >
            {beat.text}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function TypingBubble({ brandColor }: { brandColor: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
      <div className="px-4 py-3 rounded-2xl rounded-bl-md flex items-center gap-1" style={{ background: `${brandColor}1c`, border: `1px solid ${brandColor}30` }}>
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: brandColor }}
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  )
}
