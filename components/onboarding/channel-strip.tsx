"use client"

import { motion, useReducedMotion } from "framer-motion"

/**
 * Four channels in, one agent out — stated literally, in real logos.
 *
 * The generated hero art carries this as an abstract braid of coloured ribbon,
 * which is beautiful but deniable: a viewer can look at it and not register that
 * their Instagram, their Facebook, their WhatsApp and their website are ALL being
 * answered by the same thing. This strip removes the ambiguity.
 *
 * The marks are hand-drawn SVG rather than generated, deliberately. Image models
 * render brand logos warped, and a mangled Instagram glyph reads as counterfeit —
 * it would undo exactly the trust this slide exists to build.
 */

const IG = (
  <path d="M12 2.2c3.2 0 3.6 0 4.9.07 1.2.05 1.8.25 2.2.42.56.22.96.48 1.38.9.42.42.68.82.9 1.38.17.4.37 1 .42 2.2.06 1.3.07 1.7.07 4.9s0 3.6-.07 4.9c-.05 1.2-.25 1.8-.42 2.2-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.4.17-1 .37-2.2.42-1.3.06-1.7.07-4.9.07s-3.6 0-4.9-.07c-1.2-.05-1.8-.25-2.2-.42a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.17-.4-.37-1-.42-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.9c.05-1.2.25-1.8.42-2.2.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.4-.17 1-.37 2.2-.42C8.4 2.2 8.8 2.2 12 2.2Zm0 1.98c-3.14 0-3.51.01-4.75.07-1.15.05-1.77.24-2.18.4-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.16.41-.35 1.03-.4 2.18-.06 1.24-.07 1.61-.07 4.75s.01 3.51.07 4.75c.05 1.15.24 1.77.4 2.18.21.55.47.94.88 1.35.41.41.8.67 1.35.88.41.16 1.03.35 2.18.4 1.24.06 1.61.07 4.75.07s3.51-.01 4.75-.07c1.15-.05 1.77-.24 2.18-.4.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.16-.41.35-1.03.4-2.18.06-1.24.07-1.61.07-4.75s-.01-3.51-.07-4.75c-.05-1.15-.24-1.77-.4-2.18a3.6 3.6 0 0 0-.88-1.35 3.6 3.6 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.18-.4-1.24-.06-1.61-.07-4.75-.07Zm0 3.37a5.03 5.03 0 1 1 0 10.06 5.03 5.03 0 0 1 0-10.06Zm0 8.3a3.27 3.27 0 1 0 0-6.54 3.27 3.27 0 0 0 0 6.54Zm6.4-8.5a1.18 1.18 0 1 1-2.35 0 1.18 1.18 0 0 1 2.35 0Z" />
)
const FB = (
  <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
)
const WA = (
  <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.66-1.6-.9-2.19-.24-.57-.48-.5-.66-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.46s1.06 2.86 1.2 3.06c.15.2 2.08 3.18 5.04 4.46.7.3 1.25.48 1.68.62.7.22 1.35.19 1.86.12.57-.09 1.75-.72 2-1.41.24-.7.24-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.05 21.7h-.01a9.6 9.6 0 0 1-4.9-1.34l-.35-.21-3.64.95.97-3.55-.23-.36a9.58 9.58 0 0 1-1.47-5.12c0-5.3 4.32-9.6 9.63-9.6a9.57 9.57 0 0 1 9.62 9.61c0 5.3-4.32 9.61-9.62 9.61ZM20.5 3.49A11.86 11.86 0 0 0 12.05.01C5.5.01.17 5.33.17 11.87c0 2.09.55 4.13 1.59 5.93L.07 24l6.34-1.66a11.9 11.9 0 0 0 5.64 1.44h.01c6.55 0 11.88-5.32 11.88-11.86 0-3.17-1.24-6.15-3.48-8.39Z" />
)
const WEB = (
  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm7.94 9h-3.2a15.7 15.7 0 0 0-1.2-5.4A8.02 8.02 0 0 1 19.94 11ZM12 4.04c.74 1.06 1.66 3.2 1.83 6.96h-3.66C10.34 7.24 11.26 5.1 12 4.04ZM4.06 13h3.2c.13 2 .53 3.87 1.2 5.4A8.02 8.02 0 0 1 4.06 13Zm3.2-2h-3.2a8.02 8.02 0 0 1 4.4-5.4A15.7 15.7 0 0 0 7.26 11ZM12 19.96c-.74-1.06-1.66-3.2-1.83-6.96h3.66c-.17 3.76-1.09 5.9-1.83 6.96ZM15.54 18.4c.67-1.53 1.07-3.4 1.2-5.4h3.2a8.02 8.02 0 0 1-4.4 5.4Z" />
)

const CHANNELS = [
  { key: "instagram", label: "Instagram", hex: "#E1306C", path: IG },
  { key: "facebook", label: "Facebook", hex: "#1877F2", path: FB },
  { key: "whatsapp", label: "WhatsApp", hex: "#25D366", path: WA },
  { key: "website", label: "Sajt", hex: null, path: WEB },
]

export function ChannelStrip({ brandColor = "#10b981", delay = 0 }: { brandColor?: string; delay?: number }) {
  const reduce = useReducedMotion()

  return (
    <div className="flex items-center gap-3 md:gap-4">
      <div className="flex items-center gap-2 md:gap-2.5">
        {CHANNELS.map((c, i) => (
          <motion.span
            key={c.key}
            title={c.label}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: delay + i * 0.09, ease: [0.16, 1, 0.3, 1] }}
            className="w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center border border-white/10 bg-white/[0.06] backdrop-blur-sm"
          >
            <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] md:w-5 md:h-5" fill={c.hex ?? brandColor}>
              {c.path}
            </svg>
          </motion.span>
        ))}
      </div>

      {/* the convergence, stated in one arrow */}
      <motion.div
        initial={reduce ? false : { opacity: 0, scaleX: 0.4 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.5, delay: delay + 0.42 }}
        style={{ originX: 0 }}
        className="flex items-center gap-2"
      >
        <span className="h-px w-6 md:w-8" style={{ background: `linear-gradient(90deg, transparent, ${brandColor})` }} />
        <span
          className="text-[11px] md:text-[12px] font-bold whitespace-nowrap px-2.5 py-1.5 rounded-lg"
          style={{ color: brandColor, background: `${brandColor}16`, border: `1px solid ${brandColor}38` }}
        >
          jedan agent
        </span>
      </motion.div>
    </div>
  )
}
