"use client"

/**
 * Seven marks, one mechanism.
 *
 * Two earlier versions failed the same way: they were line DRAWINGS. Multiple
 * strokes, a filled shape behind them, small interior detail — legible at 64px in
 * a design tool, grey mush at the 28px the narration card actually renders.
 *
 * These are solid silhouettes with the detail KNOCKED OUT of the fill (evenodd),
 * which is how real icon sets survive small sizes: one shape, one colour, holes
 * where the meaning is. No strokes at all. Read in order they trace one message
 * through the system — arrives, hits a boundary, gets a human reply, becomes a
 * record, becomes a booked slot, becomes a pattern, becomes revenue.
 */

type GlyphProps = { className?: string }

const box = { viewBox: "0 0 32 32", fill: "currentColor", xmlns: "http://www.w3.org/2000/svg" }

/** 1 — Intake: a message lands, already answered. */
export function GlyphIntake({ className }: GlyphProps) {
  return (
    <svg {...box} className={className}>
      <path
        fillRule="evenodd" clipRule="evenodd"
        d="M6 4h20a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4h-8.7l-6.6 5.3A1.2 1.2 0 0 1 8.8 28.4V24H6a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Zm8.1 15.1 9-9.3-2.9-2.8-6.1 6.4-3.2-3.3L8 13.1l6.1 6Z"
      />
    </svg>
  )
}

/** 2 — Boundary: it stops, and tells you. */
export function GlyphBoundary({ className }: GlyphProps) {
  return (
    <svg {...box} className={className}>
      <path
        fillRule="evenodd" clipRule="evenodd"
        d="M16 1.6 3.4 6.4v9.1c0 6.8 4.6 12.9 12.6 15.1 8-2.2 12.6-8.3 12.6-15.1V6.4L16 1.6Zm2 19.6h-4v-4h4v4Zm0-6.4h-4V8.4h4v6.4Z"
      />
    </svg>
  )
}

/** 3 — Reply: you take the thread over yourself. */
export function GlyphHandover({ className }: GlyphProps) {
  return (
    <svg {...box} className={className}>
      <path
        fillRule="evenodd" clipRule="evenodd"
        d="M6 3h20a4 4 0 0 1 4 4v9.6a4 4 0 0 1-4 4h-1.6a8.6 8.6 0 0 0-3.2-3.5 5.2 5.2 0 1 0-6.4 0 8.6 8.6 0 0 0-3.2 3.5H10l-5.7 4.6A1.1 1.1 0 0 1 2.5 24.4V20.4A4 4 0 0 1 2 18.6V7a4 4 0 0 1 4-4Z"
      />
      <path d="M18 19.4c3.8 0 6.9 2.9 7.2 6.6.1.9-.6 1.6-1.5 1.6h-11.4c-.9 0-1.6-.7-1.5-1.6.3-3.7 3.4-6.6 7.2-6.6Z" />
      <circle cx="18" cy="13.4" r="3.4" />
    </svg>
  )
}

/** 4 — Record: the conversation files itself. */
export function GlyphRecord({ className }: GlyphProps) {
  return (
    <svg {...box} className={className}>
      <path
        fillRule="evenodd" clipRule="evenodd"
        d="M8 2h16a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Zm2.4 8.4h11.2v-3H10.4v3Zm0 6.2h11.2v-3H10.4v3Zm0 6.2h6.4v-3h-6.4v3Z"
      />
    </svg>
  )
}

/** 4b — Catalog: the shelf the agent quotes from, and the owner controls. */
export function GlyphCatalog({ className }: GlyphProps) {
  return (
    <svg {...box} className={className}>
      <path
        fillRule="evenodd" clipRule="evenodd"
        d="M3 3.5h26a1.6 1.6 0 0 1 1.6 1.6v3.4a1.6 1.6 0 0 1-1.6 1.6H3a1.6 1.6 0 0 1-1.6-1.6V5.1A1.6 1.6 0 0 1 3 3.5Zm0 9.4h26a1.6 1.6 0 0 1 1.6 1.6v3.4a1.6 1.6 0 0 1-1.6 1.6H3a1.6 1.6 0 0 1-1.6-1.6v-3.4A1.6 1.6 0 0 1 3 12.9Zm0 9.4h16.4a1.6 1.6 0 0 1 1.6 1.6v3.4a1.6 1.6 0 0 1-1.6 1.6H3a1.6 1.6 0 0 1-1.6-1.6v-3.4A1.6 1.6 0 0 1 3 22.3Z"
      />
      <circle cx="26.4" cy="25.6" r="4.4" />
      <path d="M24.3 25.7l1.5 1.5 2.9-3.2" stroke="#05140d" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** 5 — Slot: one cell in the week turns solid. */
export function GlyphSlot({ className }: GlyphProps) {
  return (
    <svg {...box} className={className}>
      <path
        fillRule="evenodd" clipRule="evenodd"
        d="M9 2v3H7a4 4 0 0 0-4 4v3h26V9a4 4 0 0 0-4-4h-2V2h-4v3h-6V2H9ZM3 15v11a4 4 0 0 0 4 4h18a4 4 0 0 0 4-4V15H3Zm14.5 3.5h7.2v6.4h-7.2v-6.4Z"
      />
    </svg>
  )
}

/** 6 — Pattern: scattered answers resolve into a shape. */
export function GlyphPattern({ className }: GlyphProps) {
  return (
    <svg {...box} className={className}>
      <circle cx="6.5" cy="7" r="2.2" opacity={0.42} />
      <circle cx="14" cy="4.2" r="2.2" opacity={0.42} />
      <circle cx="21.5" cy="7.4" r="2.2" opacity={0.42} />
      <rect x="3" y="19" width="6.4" height="10.4" rx="2" opacity={0.5} />
      <rect x="12.8" y="13.6" width="6.4" height="15.8" rx="2" opacity={0.75} />
      <rect x="22.6" y="8" width="6.4" height="21.4" rx="2" />
    </svg>
  )
}

/** 7 — Outlet: many messages in, one closed sale out. */
export function GlyphOutlet({ className }: GlyphProps) {
  return (
    <svg {...box} className={className}>
      <rect x="1" y="6.4" width="6.4" height="3.4" rx="1.7" opacity={0.4} />
      <rect x="1" y="14.3" width="6.4" height="3.4" rx="1.7" opacity={0.4} />
      <rect x="1" y="22.2" width="6.4" height="3.4" rx="1.7" opacity={0.4} />
      <path
        fillRule="evenodd" clipRule="evenodd"
        d="M10.4 3.6h11.8a1.5 1.5 0 0 1 1.3 2.2L19 14.4h-4.6l3.6-6.6h-7.6V3.6Zm0 24.8h11.8a1.5 1.5 0 0 0 1.3-2.2L19 17.6h-4.6l3.6 6.6h-7.6v4.2Z"
      />
      <path d="M17.6 13.9h8.9v-3.4l5.5 5.5-5.5 5.5v-3.4h-8.9v-4.2Z" />
    </svg>
  )
}
