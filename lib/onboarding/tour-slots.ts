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
  | "crm" | "crm-log"
  | "termini" | "analitika" | "offer"

// module-key → its parent stop; first matching module wins per slot
const MODULE_SLOT: Record<string, Exclude<TourSlot, "inbox-intervencija" | "crm-log">> = {
  "social-chatbot": "inbox",
  "business-crm": "crm", "agent-leads": "crm",
  "calendar": "termini",
  "chatbot-analytics": "analitika", "analytics": "analitika",
  "ponuda": "offer",
}

const ORDER: TourSlot[] = [
  "inbox", "inbox-intervencija", "crm", "crm-log", "termini", "analitika", "offer",
]
// sub-beats render on their parent slot's module and only exist when it does
const PARENT: Partial<Record<TourSlot, TourSlot>> = {
  "inbox-intervencija": "inbox",
  "crm-log": "crm",
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

export function tourHeroFor(slot: string | null | undefined, isService: boolean): string | null {
  const h = isService ? TOUR_HEROES.service : TOUR_HEROES.product
  switch (slot) {
    case "inbox": case "crm": case "crm-log": case "termini":
      return h.main
    case "inbox-intervencija":
      return h.intervention
    default:
      return null
  }
}
