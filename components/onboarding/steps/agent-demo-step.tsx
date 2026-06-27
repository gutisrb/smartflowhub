"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Calendar, ShoppingBag, BarChart3, AlertTriangle, ImageIcon, Bot } from "lucide-react"
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

// The AI Inbox renders business/agent messages in this violet→pink gradient.
const AGENT_GRADIENT = "linear-gradient(125deg, #7c3aed 0%, #c026d3 52%, #db2777 100%)"

export function AgentDemoStep({ brandName, brandColor = "#10b981", niche, onNext }: AgentDemoStepProps) {
  const conv = useMemo(() => getShowcaseConversation(niche), [niche])
  const [shown, setShown] = useState(0)
  const [typing, setTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const done = shown >= conv.beats.length
  const custInitial = conv.customerName.charAt(0).toUpperCase()

  useEffect(() => {
    if (shown >= conv.beats.length) return
    const beat = conv.beats[shown]
    let t1: ReturnType<typeof setTimeout> | undefined
    let t2: ReturnType<typeof setTimeout> | undefined
    if (beat.role === "agent" && beat.typing) {
      setTyping(true)
      t1 = setTimeout(() => { setTyping(false); setShown((s) => s + 1) }, beat.typing)
    } else {
      t2 = setTimeout(() => setShown((s) => s + 1), beat.role === "system" ? 560 : 760)
    }
    return () => { if (t1) clearTimeout(t1); if (t2) clearTimeout(t2) }
  }, [shown, conv])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [shown, typing])

  const skip = () => { setTyping(false); setShown(conv.beats.length) }

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-4" style={{ background: "rgba(5,8,12,0.9)" }}>
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative text-center mb-4 max-w-md"
      >
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] mb-1.5" style={{ color: brandColor }}>1 · Stiže poruka</div>
        <h2 className="text-xl md:text-2xl font-light text-white font-outfit leading-snug">U Vašem AI Inboxu, uživo</h2>
        <p className="text-sm text-zinc-500 mt-1.5">Kupac piše. Agent odgovara, predlaže, i zaključuje — sam.</p>
      </motion.div>

      {/* Inbox-style conversation panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0b0e13]/97 backdrop-blur-xl shadow-2xl overflow-hidden"
      >
        {/* Conversation header — who's messaging */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 bg-zinc-700">{custInitial}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">{conv.customerName}</div>
            <div className="text-[11px] text-zinc-500">{conv.channel} DM</div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: `${brandColor}14`, color: brandColor, border: `1px solid ${brandColor}30` }}>
            <Bot className="w-3 h-3" /> AI aktivan
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="h-[54vh] max-h-[400px] overflow-y-auto px-3.5 py-4 space-y-2.5 scrollbar-none">
          <AnimatePresence initial={false}>
            {conv.beats.slice(0, shown).map((beat, i) => (
              <Bubble key={i} beat={beat} brandColor={brandColor} custInitial={custInitial} />
            ))}
          </AnimatePresence>
          {typing && <TypingBubble />}
        </div>

        {/* Inbox footer */}
        <div className="px-4 py-2.5 border-t border-white/5 bg-white/[0.02] flex items-center gap-2 text-[11px] text-zinc-500">
          <Bot className="w-3.5 h-3.5" style={{ color: brandColor }} />
          {brandName || "Vaš"} AI Agent obrađuje poruke 24/7
        </div>
      </motion.div>

      <div className="relative mt-5 h-11 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.button key="next" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onClick={onNext}
              className="text-sm font-semibold px-6 py-3 rounded-xl text-[#05080c] transition-transform active:scale-95" style={{ background: brandColor }}>
              I sve ovo se beleži — pokaži →
            </motion.button>
          ) : (
            <motion.button key="skip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={skip}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">preskoči →</motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Bubble({ beat, brandColor, custInitial }: { beat: ChatBeat; brandColor: string; custInitial: string }) {
  if (beat.role === "system") {
    const Icon = BADGE_ICON[beat.badge ?? "crm"]
    const intervencija = beat.badge === "intervencija"
    const accent = intervencija ? "#ef4444" : brandColor
    return (
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex justify-center py-1">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-medium" style={{ background: `${accent}14`, borderColor: `${accent}33`, color: accent }}>
          <Icon className="w-3.5 h-3.5" /> {beat.text}
        </div>
      </motion.div>
    )
  }

  const isAgent = beat.role === "agent"
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className={`flex items-end gap-2 ${isAgent ? "justify-end" : "justify-start"}`}>
      {!isAgent && <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">{custInitial}</div>}
      <div className={`max-w-[76%] flex flex-col gap-1 ${isAgent ? "items-end" : "items-start"}`}>
        {beat.image && (
          <div className="w-36 h-28 rounded-2xl border border-white/10 overflow-hidden relative" style={{ background: "linear-gradient(135deg,#1a1f29,#0d1117)" }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-zinc-500">
              <ImageIcon className="w-6 h-6" /><span className="text-[10px]">slika proizvoda</span>
            </div>
          </div>
        )}
        {beat.text && (
          <div className={`px-3.5 py-2 text-[13px] leading-relaxed text-white ${isAgent ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md"}`}
            style={isAgent ? { background: AGENT_GRADIENT } : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {beat.text}
          </div>
        )}
      </div>
    </motion.div>
  )
}

function TypingBubble() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
      <div className="px-4 py-3 rounded-2xl rounded-br-md flex items-center gap-1" style={{ background: AGENT_GRADIENT }}>
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-white/80"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </div>
    </motion.div>
  )
}
