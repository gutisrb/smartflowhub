"use client"

/**
 * Six glyphs, one mechanism.
 *
 * Off-the-shelf icons (a chat bubble, a database can, a bar chart) label the
 * module the viewer is already looking at — they say nothing. These trace a
 * single object through the system instead: a message arrives, meets a boundary,
 * becomes a record, becomes a booked slot, becomes a pattern, becomes revenue.
 * Read in order they are one drawing in six frames, which is exactly what the
 * tour is claiming happens to every DM the clinic receives.
 *
 * Drawn on a 24×24 grid, 1.6 stroke, inheriting currentColor.
 */

type GlyphProps = { className?: string }

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}

/** 1 — Intake: a message enters and is answered. */
export function GlyphIntake({ className }: GlyphProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.5 12h4" strokeOpacity={0.5} />
      <path d="M5 9.5 7.5 12 5 14.5" strokeOpacity={0.5} />
      <path d="M10 5h9.5a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H14l-3.5 3v-3h-.5A1.5 1.5 0 0 1 8.5 14.5v-8A1.5 1.5 0 0 1 10 5Z" />
      <path d="m12 10.6 1.8 1.9 3.4-3.6" strokeWidth={1.9} />
    </svg>
  )
}

/** 2 — Boundary: the message stops at a line the agent will not cross. */
export function GlyphBoundary({ className }: GlyphProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.5 8.5h6.5a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H6l-2.5 2.2V15" strokeOpacity={0.55} />
      <path d="M14 3v18" strokeDasharray="2.2 2.6" strokeOpacity={0.8} />
      <path d="M18.6 8.2a1 1 0 0 1 1.7 0l3 5.4a1 1 0 0 1-.85 1.5h-6a1 1 0 0 1-.86-1.5Z" transform="translate(-4.2 0)" strokeWidth={1.75} />
      <path d="M15.25 11.3v1.5M15.25 14.5v.05" strokeWidth={1.9} />
    </svg>
  )
}

/** 3 — Record: the conversation collapses into a filed card. */
export function GlyphRecord({ className }: GlyphProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 3.4h10A1.6 1.6 0 0 1 18.6 5v14A1.6 1.6 0 0 1 17 20.6H7A1.6 1.6 0 0 1 5.4 19V5A1.6 1.6 0 0 1 7 3.4Z" />
      <path d="M8.6 8.2h4.6" strokeWidth={2} />
      <path d="M8.6 11.6h6.8" strokeOpacity={0.6} />
      <path d="M8.6 14.8h5.2" strokeOpacity={0.6} />
      <circle cx="16.4" cy="17.4" r="3" fill="currentColor" stroke="none" opacity={0.22} />
      <path d="m15.1 17.4 1 1 2-2.2" strokeWidth={1.9} />
    </svg>
  )
}

/** 4 — Slot: one cell in the week turns solid. */
export function GlyphSlot({ className }: GlyphProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.4 5.6h15.2A1.4 1.4 0 0 1 21 7v12.6a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 19.6V7a1.4 1.4 0 0 1 1.4-1.4Z" />
      <path d="M3 10h18" strokeOpacity={0.7} />
      <path d="M7.6 3v4M16.4 3v4" strokeWidth={1.9} />
      <rect x="12.6" y="12.4" width="6" height="5.4" rx="1.2" fill="currentColor" stroke="none" />
      <path d="M6 13.6h3.4M6 16.6h3.4" strokeOpacity={0.4} />
    </svg>
  )
}

/** 5 — Pattern: scattered answers resolve into a readable shape. */
export function GlyphPattern({ className }: GlyphProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="5" cy="6.4" r="1.05" fill="currentColor" stroke="none" opacity={0.45} />
      <circle cx="9.4" cy="4.4" r="1.05" fill="currentColor" stroke="none" opacity={0.45} />
      <circle cx="13.6" cy="7" r="1.05" fill="currentColor" stroke="none" opacity={0.45} />
      <circle cx="18.4" cy="4.8" r="1.05" fill="currentColor" stroke="none" opacity={0.45} />
      <path d="M4 20.6V16" strokeWidth={2.2} strokeOpacity={0.5} />
      <path d="M9.4 20.6v-7.4" strokeWidth={2.2} strokeOpacity={0.7} />
      <path d="M14.8 20.6v-4.2" strokeWidth={2.2} strokeOpacity={0.55} />
      <path d="M20.2 20.6V10.4" strokeWidth={2.4} />
    </svg>
  )
}

/** 6 — Outlet: many messages in, one booked appointment out. */
export function GlyphOutlet({ className }: GlyphProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.6 6.6h3.2M2.6 12h3.2M2.6 17.4h3.2" strokeOpacity={0.5} strokeWidth={1.9} />
      <path d="M8.4 5.2h9.2l-4 6.8 4 6.8H8.4" strokeOpacity={0.85} />
      <path d="M13.2 12h8.2" strokeWidth={2.1} />
      <path d="m18.8 9.2 2.8 2.8-2.8 2.8" strokeWidth={2.1} />
    </svg>
  )
}
