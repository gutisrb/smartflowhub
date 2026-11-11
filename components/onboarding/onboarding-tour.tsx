"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement, type CSSProperties } from "react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { expandTourSlots, salesModel, cardAnchorFor, type TourSlot } from "@/lib/onboarding/tour-slots"
import { tourCopy } from "@/lib/onboarding/tour-copy.mjs"
import { subscribeFocus, getFocus, getServerFocus, type FocusRect } from "@/lib/onboarding/focus-store"
import { placeCard, CARD_MAX, type Placement } from "@/lib/onboarding/place-card"
import { GlyphIntake, GlyphBoundary, GlyphHandover, GlyphRecord, GlyphCatalog, GlyphSlot, GlyphPattern, GlyphOutlet } from "@/components/onboarding/tour-glyphs"

interface ModuleLike { key: string }

interface OnboardingTourProps {
  modules: ModuleLike[]
  clientName: string
  niche: string | null
  brandColor?: string
  onNavigate: (key: string) => void
  onPlayback: (on: boolean) => void
  onSlot?: (slot: string) => void
  onComplete: () => void
  /** how the business hands things over (Business Sheet flows): a store people visit, or a shop that ships */
  flows?: { inStore?: boolean; orderTracking?: boolean; stays?: boolean } | null
}

/**
 * Every card carries one idea and ends with one coloured line — the `punch`.
 * That line is the thing we want the viewer still thinking about on the next
 * beat, so it is the only coloured text on the card and always the last thing
 * read. Body copy stays near-white: this is read once, over a moving dashboard.
 */
type StepDef = {
  moduleKey: string
  Glyph: (p: { className?: string }) => ReactElement
  eyebrow: string
  title: string
  body: string
  punch: string
  cta?: string
}

const GLYPH: Record<TourSlot, StepDef["Glyph"]> = {
  inbox: GlyphIntake, "inbox-intervencija": GlyphBoundary, "inbox-odgovor": GlyphHandover,
  crm: GlyphRecord, "crm-izgubljen": GlyphRecord, katalog: GlyphCatalog,
  termini: GlyphSlot, analitika: GlyphPattern, offer: GlyphOutlet,
}

const LG = "(min-width: 1024px)"

export function OnboardingTour({ modules, niche, brandColor = "#10b981", onNavigate, onPlayback, onSlot, onComplete, flows }: OnboardingTourProps) {
  // The words live in lib/onboarding/tour-copy.mjs (also printed by owner_read.mjs). Step 1 is the same card on every
  // demo; the chat beside it is the proof and carries the business's own detail.
  const COPY = useMemo(
    () => tourCopy({ model: salesModel(niche), niche, flows }) as Record<TourSlot, Omit<StepDef, "moduleKey" | "Glyph">>,
    // the page hands over a fresh object each render; key on what it contains
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [niche, flows?.inStore, flows?.orderTracking, flows?.stays],
  )

  const steps = useMemo(
    () => expandTourSlots(modules.map((m) => m.key)).map(({ slot, moduleKey }) => ({ ...COPY[slot], Glyph: GLYPH[slot], moduleKey, slot })),
    [modules, COPY],
  )

  const [i, setI] = useState(0)
  const step = steps[i]
  const last = i === steps.length - 1

  // How long each beat needs to actually finish playing before advancing is
  // meaningful — the control stays locked until its story has run. Long enough
  // for the beat to land, short enough that nobody feels held hostage.
  const READY_MS: Record<string, number> = {
    inbox: 7000,
    "inbox-intervencija": 5500,
    "inbox-odgovor": 2500,
    katalog: 2500,
    crm: 4000,
    "crm-izgubljen": 5000,
    termini: 3000,
    analitika: 6000,
    offer: 0,
  }
  const readyAfter = READY_MS[step?.slot ?? ""] ?? 0
  const [ready, setReady] = useState(readyAfter === 0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!step) return
    onNavigate(step.moduleKey)
    onPlayback(step.slot === "inbox" || step.slot === "inbox-intervencija")
    onSlot?.(step.slot)

    setReady(readyAfter === 0)
    setElapsed(0)
    if (readyAfter === 0) return
    const t0 = Date.now()
    const tick = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / readyAfter)
      setElapsed(p)
      if (p >= 1) { setReady(true); clearInterval(tick) }
    }, 90)
    return () => clearInterval(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  const finish = () => { onPlayback(false); onComplete() }
  const next = () => { if (!ready) return; if (last) finish(); else setI((n) => n + 1) }
  const back = () => setI((n) => Math.max(0, n - 1))

  // Space and Enter advance; both are ignored while the beat is still playing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        if (ready) next()
      } else if (e.key === "ArrowLeft" && i > 0) {
        e.preventDefault(); back()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, i, last])

  const target = useCardTarget(cardAnchorFor(step?.slot))
  const isLg = useIsLg()
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardH, setCardH] = useState(320)
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setCardH(el.getBoundingClientRect().height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [i, isLg])

  if (!step) return null

  const isBar = last || !isLg
  // Light card on a dark product: the one thing on screen nobody can overlook (2026-10-25).
  const ink = readableOn(CARD_BG, brandColor)

  const progress = (
    <div className="flex items-center gap-1" aria-hidden>
      {steps.map((_, idx) => (
        <span key={idx} className="h-1.5 rounded-full transition-[width,background-color] duration-300"
          style={{ width: idx === i ? 18 : 6, background: idx === i ? ink : idx < i ? `${ink}80` : "rgba(11,18,20,0.15)" }} />
      ))}
    </div>
  )

  const nextButton = (
    <button
      onClick={next}
      disabled={!ready}
      aria-label={ready ? (last ? step.cta || "Završi" : "Dalje") : "Sačekajte da se korak završi"}
      className="relative overflow-hidden text-[15px] font-bold px-5 py-2.5 rounded-xl transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.97] flex items-center gap-2 shrink-0 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        background: ready ? ink : `${ink}26`,
        color: ready ? "#ffffff" : ink,
        boxShadow: ready ? `0 10px 24px -10px ${ink}` : "none",
      }}
    >
      {/* the button fills as the beat plays — the wait reads as progress, not as a dead control */}
      {!ready && (
        <span className="absolute inset-y-0 left-0 pointer-events-none" style={{ width: `${elapsed * 100}%`, background: `${ink}33`, transition: "width 90ms linear" }} />
      )}
      <span className="relative flex items-center gap-2 whitespace-nowrap">
        {last ? (step.cta || "Završi") : "Dalje"} <ArrowRight className="w-4 h-4" />
      </span>
    </button>
  )

  // Bar: final slide (no highlight) and small screens.
  if (isBar) {
    return (
      <div data-tour-ui className="fixed z-[315] pointer-events-auto inset-x-0 bottom-0 px-3 pb-3 lg:bottom-6 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:w-[min(780px,calc(100vw-160px))] lg:px-0 lg:pb-0">
        <div key={i} className="tour-card-in rounded-2xl px-5 py-4 shadow-[0_30px_80px_rgba(0,0,0,0.65)]" style={{ background: CARD_BG }}>
          <div className="flex items-center gap-4">
            <span className="text-[12px] font-black tracking-wider px-2 py-0.5 rounded-md tabular-nums text-white" style={{ background: ink }}>{i + 1}/{steps.length}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-black uppercase tracking-[0.18em]" style={{ color: ink }}>{step.eyebrow}</p>
              <p className="text-[15px] font-semibold text-[#0B1214] leading-snug truncate">{step.title}</p>
            </div>
            {i > 0 && <button onClick={back} className="text-[15px] font-semibold text-[#45524F] hover:text-[#0B1214] px-2 py-2 transition-colors">Nazad</button>}
            {nextButton}
          </div>
        </div>
      </div>
    )
  }

  const vp = typeof window === "undefined" ? { width: 1728, height: 1000, top: 64 } : { width: window.innerWidth, height: window.innerHeight, top: 64 }
  const place: Placement = target
    ? placeCard(target, cardH, vp)
    : { side: "inside", left: vp.width - CARD_MAX - 32, top: Math.max(vp.top + 16, (vp.height - cardH) / 2), width: CARD_MAX }
  const tight = place.width < 340
  // pointer: on the edge facing the highlight, level with its middle
  const arrow = target && place.side !== "inside" ? (() => {
    if (place.side === "right" || place.side === "left") {
      const y = Math.max(24, Math.min(cardH - 24, target.top + Math.min(target.height, 240) / 2 - place.top))
      return { [place.side === "right" ? "left" : "right"]: -7, top: y - 7 } as CSSProperties
    }
    const x = Math.max(24, Math.min(place.width - 24, target.left + target.width / 2 - place.left))
    return { [place.side === "below" ? "top" : "bottom"]: -7, left: x - 7 } as CSSProperties
  })() : null

  return (
    // pointer-events-auto: an open customer file (Radix dialog) sets the body to none
    <div data-tour-ui className="fixed z-[315] pointer-events-auto"
      style={{ left: place.left, top: place.top, width: place.width, transition: "left 300ms cubic-bezier(.2,.8,.2,1), top 300ms cubic-bezier(.2,.8,.2,1), width 300ms cubic-bezier(.2,.8,.2,1)" }}>
      <div ref={cardRef} key={i}
        className="tour-card-in relative rounded-2xl shadow-[0_30px_80px_rgba(0,0,0,0.65),0_0_0_1px_rgba(255,255,255,0.5)]"
        style={{ background: CARD_BG, ["--tour-ink" as string]: ink } as CSSProperties}>
        {arrow && <span aria-hidden className="absolute w-3.5 h-3.5 rotate-45" style={{ ...arrow, background: CARD_BG }} />}
        <div className={cn("relative flex flex-col", tight ? "p-5" : "p-6")}>
          <div className="flex items-center gap-2.5">
            <span className="text-[12px] font-black tracking-wider px-2 py-0.5 rounded-md tabular-nums text-white" style={{ background: ink }}>
              {i + 1}/{steps.length}
            </span>
            <span className={cn("font-black uppercase truncate", tight ? "text-[11px] tracking-[0.1em]" : "text-[12px] tracking-[0.18em]")} style={{ color: ink }}>{step.eyebrow}</span>
            <span className="ml-auto w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${ink}14`, color: ink }}>
              <step.Glyph className="w-[18px] h-[18px]" />
            </span>
          </div>
          <h3 className={cn("mt-3 font-bold text-[#0B1214] leading-[1.12] tracking-[-0.02em] font-outfit", tight ? "text-[21px]" : "text-[25px]")}>{step.title}</h3>
          <p className={cn("mt-2.5 text-[#2F3B39] leading-[1.55]", tight ? "text-[14px]" : "text-[15.5px]")}>{step.body}</p>
          <p className={cn("mt-2.5 font-semibold leading-[1.45]", tight ? "text-[14px]" : "text-[15.5px]")} style={{ color: ink }}>{step.punch}</p>
          <div className={cn("mt-5 pt-4 border-t border-black/[0.08] flex gap-3", tight ? "flex-col items-stretch" : "items-center")}>
            {progress}
            <div className={cn("flex items-center gap-1", tight ? "justify-between" : "ml-auto")}>
              {i > 0 && <button onClick={back} className="text-[14px] font-semibold text-[#45524F] hover:text-[#0B1214] px-2.5 py-2 transition-colors">Nazad</button>}
              {nextButton}
            </div>
          </div>
          <button onClick={finish} className="mt-2.5 self-start text-[12.5px] font-medium text-[#6B7976] hover:text-[#0B1214] transition-colors whitespace-nowrap">
            Preskoči obilazak
          </button>
        </div>
      </div>
    </div>
  )
}

const CARD_BG = "#F6F9F8"

/** The brand colour, darkened until it reads on the light card (WCAG 4.5:1). */
function readableOn(bg: string, hex: string): string {
  const rgb = (h: string) => { const n = parseInt(h.replace("#", "").slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
  const lum = ([r, g, b]: number[]) => {
    const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const Lb = lum(rgb(bg))
  let c = /^#[0-9a-f]{6}/i.test(hex) ? rgb(hex) : [16, 185, 129]
  for (let k = 0; k < 20; k++) {
    const L = lum(c)
    if ((Lb + 0.05) / (L + 0.05) >= 4.5) break
    c = c.map((v) => Math.round(v * 0.88))
  }
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

function useIsLg() {
  const [isLg, setIsLg] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia(LG)
    const sync = () => setIsLg(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])
  return isLg
}

/**
 * What the card sits beside: the slide's steady anchor when it is on screen, otherwise
 * whatever the ring is highlighting (published by TourFocus).
 */
function useCardTarget(anchor: string | null): FocusRect | null {
  const focus = useSyncExternalStore(subscribeFocus, getFocus, getServerFocus)
  const [anchorRect, setAnchorRect] = useState<FocusRect | null>(null)
  useEffect(() => {
    if (!anchor) return
    let raf = 0, last = ""
    const tick = () => {
      const el = document.querySelector(anchor) as HTMLElement | null
      const r = el?.getBoundingClientRect()
      const next = r && r.width > 0 ? { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) } : null
      const key = next ? `${next.top},${next.left},${next.width},${next.height}` : ""
      if (key !== last) { last = key; setAnchorRect(next) }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); setAnchorRect(null) }
  }, [anchor])
  return (anchor && anchorRect) || focus.rect
}
