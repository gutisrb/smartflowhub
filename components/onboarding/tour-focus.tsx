"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { FocusBeat } from "@/lib/onboarding/tour-slots"

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
 * A beat can hold several targets in sequence (see FocusBeat.at), so a step like
 * Analitika can pan from the headline numbers down to the insights below the fold
 * instead of asking the viewer to find them.
 */

interface Rect { top: number; left: number; width: number; height: number }

interface TourFocusProps {
  beats: FocusBeat[]
  brandColor?: string
  /** re-runs the sequence when the narration step changes */
  beatKey: string
  /** container scrolled back to the top when a step begins */
  scrollSelector?: string
}

const PAD = 12

function readRect(sel: string): Rect | null {
  const el = document.querySelector(sel) as HTMLElement | null
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function TourFocus({ beats, brandColor = "#10b981", beatKey, scrollSelector }: TourFocusProps) {
  const [rect, setRect] = useState<Rect | null>(null)
  const activeSel = useRef<string | null>(null)

  // Run the beat's sequence: every step starts at the top of the page, then the
  // ring lands on each target in turn.
  useEffect(() => {
    setRect(null)
    activeSel.current = null

    const scroller = scrollSelector
      ? (document.querySelector(scrollSelector) as HTMLElement | null)
      : null
    scroller?.scrollTo({ top: 0, behavior: "smooth" })

    if (beats.length === 0) return

    let alive = true
    const timers: any[] = []

    // Targets are rendered by modules that fetch their own data, so a beat can
    // fire before its element exists (the CRM hero row is the slow one). Retry
    // briefly rather than silently skipping the beat.
    const land = (sel: string, tries = 0) => {
      const el = document.querySelector(sel) as HTMLElement | null
      if (!el) {
        if (tries < 8) timers.push(setTimeout(() => { if (alive) land(sel, tries + 1) }, 350))
        return
      }
      activeSel.current = sel
      // Scroll only when the target really isn't readable yet. Centring a tall
      // element (the chat thread, the calendar) pushed the page down and cut off
      // the header, so: if its top is already in frame, leave the page alone.
      const r = el.getBoundingClientRect()
      const topVisible = r.top >= 64 && r.top < window.innerHeight * 0.5
      const fitsBelow = r.bottom <= window.innerHeight - 200
      const needsScroll = !topVisible && !fitsBelow
      if (needsScroll) {
        // tall targets align to their top; short ones can afford to be centred
        const tall = r.height > window.innerHeight - 320
        el.scrollIntoView({ behavior: "smooth", block: tall ? "start" : "center" })
      }
      timers.push(setTimeout(() => { if (alive) setRect(readRect(sel)) }, needsScroll ? 620 : 60))
    }

    for (const beat of beats) {
      timers.push(setTimeout(() => { if (alive) land(beat.selector) }, beat.at))
    }

    return () => { alive = false; timers.forEach(clearTimeout) }
  }, [beatKey, beats, scrollSelector])

  // keep the ring glued to its target while the page moves under it
  useEffect(() => {
    const sync = () => { if (activeSel.current) setRect(readRect(activeSel.current)) }
    window.addEventListener("resize", sync)
    window.addEventListener("scroll", sync, true)
    return () => {
      window.removeEventListener("resize", sync)
      window.removeEventListener("scroll", sync, true)
    }
  }, [])

  return (
    <AnimatePresence>
      {rect && (
        <motion.div
          key="tour-focus"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[305] pointer-events-none"
        >
          <motion.div
            initial={false}
            animate={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
            }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="absolute rounded-2xl"
            style={{
              // light wash instead of a blackout — the rest of the dashboard stays readable
              boxShadow: `0 0 0 9999px rgba(5,8,12,0.42), 0 0 70px -18px ${brandColor}`,
              border: `1.5px solid ${brandColor}aa`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
