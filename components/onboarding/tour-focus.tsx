"use client"

import { useEffect, useRef, useState } from "react"
import type { FocusBeat } from "@/lib/onboarding/tour-slots"
import { setFocus } from "@/lib/onboarding/focus-store"

/**
 * Narration alone doesn't direct the eye: on a dense screen the viewer reads the
 * card, looks up at twenty elements, and doesn't know which one the sentence is
 * about. TourFocus is the camera — it moves attention around the live dashboard.
 *
 * It deliberately does NOT black the page out. An earlier version cut a hole in a
 * near-opaque scrim, which hid the very conversation the narration was describing.
 * A ring plus a light wash reads as "look here" while everything around it stays
 * legible, which is the point: the viewer should be taking in the whole product.
 *
 * Precision (2026-10-24 — "the highlights are kinda off by a little"):
 *  - The ring is re-measured every animation frame while it is up. It used to be
 *    measured once, 60ms after landing, while the module was still sliding in, so
 *    it sat a few pixels off its target for the rest of the beat.
 *  - It takes the target's own corner radius, so a rounded card gets a rounded ring.
 *  - Moving to a NEW target eases; following the SAME target never does, so the ring
 *    is glued to it while things scroll instead of chasing it.
 *  - The ease is computed in the frame loop toward the target's LIVE position (2026-10-27,
 *    "steps 4 and 5 lag behind"). It used to be a CSS transition, and the CRM steps move their
 *    target while the ring travels (the customer file slides in, the page smooth-scrolls), so
 *    every frame restarted a 380ms transition toward a new point and the ring trailed the
 *    target until it stopped, then snapped. Now the ring lands exactly on the target at the end
 *    of the ease, however it moved, and is painted with a transform, not React state.
 *  - Elements marked `data-tour-focus-part="<name>"` are unioned into the target, so
 *    a badge that sits outside its card (the calendar's "upravo zakazano") is inside
 *    the ring, not under the wash.
 *
 * Follow mode: on long pages (see focusFollowFor) the viewer scrolls on their own.
 * The first scroll they make cancels the scripted pan, and from then on the ring
 * lights whichever section fills the screen.
 */

interface Rect { top: number; left: number; width: number; height: number; radius: number }

interface TourFocusProps {
  beats: FocusBeat[]
  /** focus names to follow once the viewer scrolls by hand */
  follow?: string[]
  brandColor?: string
  /** re-runs the sequence when the narration step changes */
  beatKey: string
  /** container scrolled back to the top when a step begins */
  scrollSelector?: string
}

const PAD = 6
// stable default: a fresh [] per render would restart the scripted pan on every render
const NO_FOLLOW: string[] = []
const TWEEN_MS = 380
const focusSel = (name: string) => `[data-tour-focus="${name}"]`
const nameOf = (sel: string) => sel.match(/data-tour-focus="([^"]+)"/)?.[1] ?? null

function measure(sel: string): Rect | null {
  const el = document.querySelector(sel) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  let top = r.top, left = r.left, right = r.right, bottom = r.bottom
  const name = nameOf(sel)
  if (name) {
    document.querySelectorAll(`[data-tour-focus-part="${name}"]`).forEach((p) => {
      const pr = (p as HTMLElement).getBoundingClientRect()
      if (pr.width === 0 && pr.height === 0) return
      top = Math.min(top, pr.top); left = Math.min(left, pr.left)
      right = Math.max(right, pr.right); bottom = Math.max(bottom, pr.bottom)
    })
  }
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0
  return { top, left, width: right - left, height: bottom - top, radius }
}

const mix = (a: Rect, b: Rect, p: number): Rect => ({
  top: a.top + (b.top - a.top) * p, left: a.left + (b.left - a.left) * p,
  width: a.width + (b.width - a.width) * p, height: a.height + (b.height - a.height) * p,
  radius: a.radius + (b.radius - a.radius) * p,
})
// close to the old cubic-bezier(0.2, 0.8, 0.2, 1): fast start, long soft landing
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)

const same = (a: Rect | null, b: Rect | null) =>
  a === b || !!a && !!b && Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5 && a.radius === b.radius

export function TourFocus({ beats, follow = NO_FOLLOW, brandColor = "#10b981", beatKey, scrollSelector }: TourFocusProps) {
  const [visible, setVisible] = useState(false)
  const ringRef = useRef<HTMLDivElement>(null)
  const activeSel = useRef<string | null>(null)
  // what the ring shows this frame, and the ease toward a new target (from where it was)
  const shown = useRef<Rect | null>(null)
  const tween = useRef<{ from: Rect; t0: number } | null>(null)

  const point = (sel: string | null) => {
    if (sel === activeSel.current) return
    activeSel.current = sel
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    // a ring that is not up yet simply appears on its target
    tween.current = shown.current && !still ? { from: shown.current, t0: performance.now() } : null
  }

  // Scripted pan: every step starts at the top of the page, then the ring lands
  // on each target in turn — until the viewer scrolls by hand (follow mode).
  useEffect(() => {
    // clearing the target is enough: the frame loop below drops the ring on its next tick
    activeSel.current = null

    const scroller = scrollSelector
      ? (document.querySelector(scrollSelector) as HTMLElement | null)
      : null
    scroller?.scrollTo({ top: 0, behavior: "smooth" })

    let alive = true
    let userDriven = false
    const timers: ReturnType<typeof setTimeout>[] = []

    // Targets are rendered by modules that fetch their own data, so a beat can
    // fire before its element exists (the CRM hero row is the slow one). Retry
    // briefly rather than silently skipping the beat.
    const land = (sel: string, tries = 0) => {
      if (!alive || userDriven) return
      const el = document.querySelector(sel) as HTMLElement | null
      if (!el) {
        if (tries < 25) timers.push(setTimeout(() => land(sel, tries + 1), 300))  // slow modules (analytics) load late
        return
      }
      // Scroll only when the target really isn't readable yet. Centring a tall
      // element (the chat thread, the calendar) pushed the page down and cut off
      // the header, so: if its top is already in frame, leave the page alone.
      const r = el.getBoundingClientRect()
      const topVisible = r.top >= 64 && r.top < window.innerHeight * 0.5
      const fitsBelow = r.bottom <= window.innerHeight - 40
      if (!topVisible && !fitsBelow) {
        const tall = r.height > window.innerHeight - 200
        el.scrollIntoView({ behavior: "smooth", block: tall ? "start" : "center" })
      }
      point(sel)
    }
    for (const beat of beats) timers.push(setTimeout(() => land(beat.selector), beat.at))

    // Follow mode — engaged only by the viewer's own input, never by our scrolls.
    const followSels = follow.map(focusSel)
    const pickVisible = () => {
      let best: string | null = null, bestScore = 0
      const vTop = 64, vBottom = window.innerHeight
      const vMid = (vTop + vBottom) / 2
      for (const sel of followSels) {
        const el = document.querySelector(sel) as HTMLElement | null
        if (!el) continue
        const r = el.getBoundingClientRect()
        const visible = Math.max(0, Math.min(r.bottom, vBottom) - Math.max(r.top, vTop))
        if (visible <= 0) continue
        // how much of the screen it fills, nudged toward whatever sits mid-screen
        const fill = visible / Math.min(r.height, vBottom - vTop)
        const centred = 1 - Math.min(1, Math.abs((r.top + r.bottom) / 2 - vMid) / (vBottom - vTop))
        const score = fill * 0.7 + centred * 0.3
        if (score > bestScore) { bestScore = score; best = sel }
      }
      if (best) point(best)
    }
    let raf = 0
    const onScroll = () => {
      if (!userDriven || followSels.length === 0) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(pickVisible)
    }
    const takeOver = () => {
      if (userDriven || followSels.length === 0) return
      userDriven = true
      timers.forEach(clearTimeout)
    }
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) takeOver()
    }
    window.addEventListener("wheel", takeOver, { passive: true })
    window.addEventListener("touchmove", takeOver, { passive: true })
    window.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onScroll, true)

    return () => {
      alive = false
      timers.forEach(clearTimeout)
      cancelAnimationFrame(raf)
      window.removeEventListener("wheel", takeOver)
      window.removeEventListener("touchmove", takeOver)
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onScroll, true)
    }
  }, [beatKey, beats, follow, scrollSelector])

  // Glue: re-measure the active target every frame. One getBoundingClientRect per
  // frame is cheap, and it is the only way to stay exact while modules animate in,
  // pages scroll and dialogs open underneath the ring.
  useEffect(() => {
    let raf = 0
    let up = false
    const paint = (r: Rect) => {
      const el = ringRef.current
      if (!el) return
      el.style.transform = `translate3d(${r.left - PAD}px, ${r.top - PAD}px, 0)`
      el.style.width = `${r.width + PAD * 2}px`
      el.style.height = `${r.height + PAD * 2}px`
      el.style.borderRadius = `${Math.min(r.radius + PAD, 28)}px`
    }
    const tick = (now: number) => {
      const sel = activeSel.current
      const target = sel ? measure(sel) : null
      let next = target
      const tw = tween.current
      if (target && tw) {
        const p = Math.min(1, (now - tw.t0) / TWEEN_MS)
        if (p >= 1) tween.current = null
        else next = mix(tw.from, target, easeOut(p))
      }
      if (!same(next, shown.current)) {
        shown.current = next
        if (next) paint(next)
      }
      // React only hears about the ring appearing or going away, never about a frame
      if (!!next !== up) { up = !!next; setVisible(up) }
      // the narration card positions itself beside whatever is highlighted
      setFocus({ selector: target ? sel : null, rect: target })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); setFocus({ selector: null, rect: null }) }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[305] pointer-events-none transition-opacity duration-200"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden
    >
      <div
        ref={ringRef}
        className="absolute left-0 top-0"
        style={{
          // crisp edge, quiet halo, light wash — the rest of the dashboard stays readable
          border: `2px solid ${brandColor}`,
          boxShadow: `0 0 0 4px ${brandColor}26, 0 0 0 9999px rgba(5,8,12,0.48)`,
          willChange: "transform, width, height",
        }}
      />
    </div>
  )
}
