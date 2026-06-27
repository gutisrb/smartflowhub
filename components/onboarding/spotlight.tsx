"use client"

import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { motion } from "framer-motion"

interface Rect { top: number; left: number; width: number; height: number }

interface SpotlightProps {
  targetSelector: string
  eyebrow: string
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
const CARD_W = 420
const CARD_H_EST = 250

function readRect(sel: string): Rect | null {
  if (typeof document === "undefined") return null
  const el = document.querySelector(sel) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function Spotlight({ targetSelector, eyebrow, title, body, index, total, brandColor = "#10b981", isLast, onNext, onBack }: SpotlightProps) {
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
  const cardW = Math.min(CARD_W, vw - 32)
  let cardTop = vh / 2 - CARD_H_EST / 2
  let cardLeft = vw / 2 - cardW / 2
  if (rect) {
    const below = rect.top + rect.height + PAD + 14
    cardTop = below + CARD_H_EST < vh ? below : Math.max(16, rect.top - CARD_H_EST - 14)
    cardLeft = Math.min(Math.max(16, rect.left), vw - cardW - 16)
  }

  return (
    <div className="fixed inset-0 z-[300]">
      {/* dim with a transparent hole over the target */}
      {rect ? (
        <motion.div
          initial={false}
          animate={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="absolute rounded-2xl pointer-events-none"
          style={{ boxShadow: "0 0 0 9999px rgba(5,8,12,0.82)", border: `2px solid ${brandColor}`, outline: `1px solid ${brandColor}40` }}
        />
      ) : (
        <div className="absolute inset-0" style={{ background: "rgba(5,8,12,0.82)" }} />
      )}

      {/* explainer card — bold + readable */}
      <motion.div
        key={index}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="absolute pointer-events-auto rounded-3xl border-2 bg-[#0d1016] p-6 md:p-7"
        style={{ top: cardTop, left: cardLeft, width: cardW, borderColor: `${brandColor}55`, boxShadow: `0 24px 60px -12px rgba(0,0,0,0.8), 0 0 50px -20px ${brandColor}` }}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <span className="text-[13px] font-extrabold tracking-wider px-2.5 py-1 rounded-lg" style={{ background: brandColor, color: "#05080c" }}>
            {index + 1} / {total}
          </span>
          <span className="text-[13px] font-bold uppercase tracking-[0.15em]" style={{ color: brandColor }}>{eyebrow}</span>
        </div>
        <h3 className="text-2xl md:text-[26px] font-bold text-white leading-tight mb-2.5 font-outfit">{title}</h3>
        <p className="text-[15px] md:text-base text-zinc-200 leading-relaxed font-medium">{body}</p>

        <div className="flex items-center justify-between mt-6">
          <div className="flex gap-2">
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className="h-2 rounded-full transition-all duration-300"
                style={{ width: i === index ? 22 : 8, background: i === index ? brandColor : "rgba(255,255,255,0.22)" }} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            {onBack && index > 0 && (
              <button onClick={onBack} className="text-sm font-semibold text-zinc-400 hover:text-white px-2 py-2 transition-colors">Nazad</button>
            )}
            <button onClick={onNext} className="text-sm font-bold px-6 py-3 rounded-xl text-[#05080c] transition-transform active:scale-95"
              style={{ background: brandColor, boxShadow: `0 8px 24px -8px ${brandColor}` }}>
              {isLast ? "Završi" : "Dalje →"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
