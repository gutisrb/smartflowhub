"use client"

import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { motion } from "framer-motion"

interface Rect { top: number; left: number; width: number; height: number }

interface SpotlightProps {
  targetSelector: string
  title: string
  body: string
  index: number
  total: number
  brandColor?: string
  isLast: boolean
  onNext: () => void
  onBack?: () => void
}

const PAD = 10
const CARD_W = 340
const CARD_H_EST = 210

function readRect(sel: string): Rect | null {
  if (typeof document === "undefined") return null
  const el = document.querySelector(sel) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function Spotlight({ targetSelector, title, body, index, total, brandColor = "#10b981", isLast, onNext, onBack }: SpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(null)

  const measure = useCallback(() => {
    const r = readRect(targetSelector)
    if (r) setRect(r)
    else setTimeout(() => setRect(readRect(targetSelector)), 150)
  }, [targetSelector])

  useLayoutEffect(() => { measure() }, [measure, index])

  useEffect(() => {
    const onChange = () => measure()
    window.addEventListener("resize", onChange)
    window.addEventListener("scroll", onChange, true)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("resize", onChange)
      window.removeEventListener("scroll", onChange, true)
      document.body.style.overflow = prev
    }
  }, [measure])

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200
  const vh = typeof window !== "undefined" ? window.innerHeight : 800
  let cardTop = vh / 2 - CARD_H_EST / 2
  let cardLeft = vw / 2 - CARD_W / 2
  if (rect) {
    const below = rect.top + rect.height + PAD + 12
    cardTop = below + CARD_H_EST < vh ? below : Math.max(16, rect.top - CARD_H_EST - 12)
    cardLeft = Math.min(Math.max(16, rect.left), vw - CARD_W - 16)
  }

  return (
    <div className="fixed inset-0 z-[300]">
      {/* dim with a transparent hole over the target (box-shadow spread technique) */}
      {rect ? (
        <motion.div
          initial={false}
          animate={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="absolute rounded-2xl pointer-events-none"
          style={{ boxShadow: "0 0 0 9999px rgba(5,8,12,0.80)", border: `2px solid ${brandColor}` }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "rgba(5,8,12,0.80)" }} />
      )}

      {/* explainer card */}
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="absolute pointer-events-auto rounded-2xl border border-white/10 bg-[#0e1116]/95 backdrop-blur-xl shadow-2xl p-5"
        style={{ top: cardTop, left: cardLeft, width: CARD_W }}
      >
        <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: brandColor }}>
          {index + 1} / {total}
        </div>
        <h3 className="text-lg font-semibold text-white mb-1.5">{title}</h3>
        <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-1.5">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: i === index ? 16 : 6, background: i === index ? brandColor : "rgba(255,255,255,0.2)" }} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {onBack && index > 0 && (
              <button onClick={onBack} className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5 transition-colors">Nazad</button>
            )}
            <button onClick={onNext} className="text-xs font-semibold px-4 py-2 rounded-lg text-[#05080c] transition-transform active:scale-95"
              style={{ background: brandColor }}>
              {isLast ? "Završi" : "Razumem →"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
