// Pure tour-structure logic for the film onboarding tour: which narration
// beats run, in what order, on which module, and which seeded hero each
// beat spotlights. Kept free of React so it can be unit-tested.

export const SERVICE_NICHES = new Set([
  "dental", "medical", "beauty", "fitness", "services", "wellness", "real-estate",
])

export const isServiceNiche = (niche: string | null | undefined): boolean =>
  SERVICE_NICHES.has((niche || "").toLowerCase())

export type TourSlot =
  | "inbox" | "inbox-intervencija"
  | "crm"
  | "termini" | "analitika" | "offer"

// module-key → its parent stop; first matching module wins per slot
const MODULE_SLOT: Record<string, Exclude<TourSlot, "inbox-intervencija">> = {
  "social-chatbot": "inbox",
  "business-crm": "crm", "agent-leads": "crm",
  "calendar": "termini",
  "chatbot-analytics": "analitika", "analytics": "analitika",
  "ponuda": "offer",
}

const ORDER: TourSlot[] = [
  "inbox", "inbox-intervencija", "crm", "termini", "analitika", "offer",
]
// sub-beats render on their parent slot's module and only exist when it does
const PARENT: Partial<Record<TourSlot, TourSlot>> = {
  "inbox-intervencija": "inbox",
}

export function expandTourSlots(moduleKeys: string[]): { slot: TourSlot; moduleKey: string }[] {
  const bySlot: Partial<Record<TourSlot, string>> = {}
  for (const key of moduleKeys) {
    const slot = MODULE_SLOT[key]
    if (slot && !bySlot[slot]) bySlot[slot] = key
  }
  // the offer finale always runs, even if ponuda isn't in the module list
  if (!bySlot["offer"]) bySlot["offer"] = "ponuda"
  return ORDER.flatMap((slot) => {
    const moduleKey = bySlot[PARENT[slot] ?? slot]
    return moduleKey ? [{ slot, moduleKey }] : []
  })
}

// Seeded hero customers (seed_onboarding_story.mjs) each beat points at.
export const TOUR_HEROES = {
  service: { main: "Marija Jović", intervention: "Dragana Simić" },
  product: { main: "Stefan Ilić", intervention: "Jelena Marić" },
} as const

/** One "look here" moment: a marked element, and how long into the step it happens. */
export interface FocusBeat {
  selector: string
  /** ms after the narration step begins */
  at: number
}

const f = (name: string, at = 700): FocusBeat => ({ selector: `[data-tour-focus="${name}"]`, at })

// What the eye should be on during each narration step. The modules mark these
// elements with data-tour-focus. Steps with several beats pan between them, which
// is how Analitika gets to show the headline numbers AND the insights below the
// fold without the viewer having to go looking.
const SLOT_FOCUS: Partial<Record<TourSlot, FocusBeat[]>> = {
  // the live conversation is the whole story here — nothing else competes
  "inbox": [f("chat-thread")],
  // the escalation plays out in the thread first; only once it has landed does the
  // Intervencije counter mean anything, so the ring moves there afterwards
  "inbox-intervencija": [f("chat-thread"), f("intervencije-stat", 7000)],
  // the freshly-written row, not the whole 200-row table. The patient file opens
  // on top of it partway through the beat, so the ring stops there.
  "crm": [f("crm-hero-row", 900), f("lead-file", 4600)],
  // the week first, then the one booking the viewer just watched get made
  "termini": [f("calendar-week"), f("appt-hero", 3400)],
  "analitika": [f("analytics-metrics", 600), f("ai-insights", 4200), f("analytics-funnel", 10500)],
}

// stable reference: TourFocus re-runs its sequence whenever `beats` changes identity
const NO_BEATS: FocusBeat[] = []

export function focusBeatsFor(slot: string | null | undefined): FocusBeat[] {
  return SLOT_FOCUS[slot as TourSlot] ?? NO_BEATS
}

export function tourHeroFor(slot: string | null | undefined, isService: boolean): string | null {
  const h = isService ? TOUR_HEROES.service : TOUR_HEROES.product
  switch (slot) {
    case "inbox": case "crm": case "termini":
      return h.main
    case "inbox-intervencija":
      return h.intervention
    default:
      return null
  }
}
