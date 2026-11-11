// Pure tour-structure logic for the film onboarding tour: which narration
// beats run, in what order, on which module, and which seeded hero each
// beat spotlights. Kept free of React so it can be unit-tested.

import { salesModelOf } from "../sales-model.mjs"

export type SalesModel = "booking" | "quote" | "order"
/** How this business sells (lib/sales-model.mjs): decides every flow and every word in the demo. */
export const salesModel = (niche: string | null | undefined): SalesModel => salesModelOf(niche) as SalesModel

/** People-facing business (a clinic, a container maker): the heroes are Marija, Dragana, Nikola.
 *  A booking business also has a calendar; a quote business has an offer instead. */
export const isServiceNiche = (niche: string | null | undefined): boolean => salesModel(niche) !== "order"
export const isBookingNiche = (niche: string | null | undefined): boolean => salesModel(niche) === "booking"
export const isQuoteNiche = (niche: string | null | undefined): boolean => salesModel(niche) === "quote"

export type TourSlot =
  | "inbox" | "inbox-intervencija" | "inbox-odgovor"
  | "crm" | "crm-izgubljen" | "katalog"
  | "termini" | "analitika" | "offer"

// module-key → its parent stop; first matching module wins per slot
const MODULE_SLOT: Record<string, Exclude<TourSlot, "inbox-intervencija" | "inbox-odgovor" | "crm-izgubljen">> = {
  "social-chatbot": "inbox",
  "business-crm": "crm", "agent-leads": "crm",
  "agent-database": "katalog",
  "calendar": "termini",
  "chatbot-analytics": "analitika", "analytics": "analitika",
  "ponuda": "offer",
}

const ORDER: TourSlot[] = [
  "inbox", "inbox-intervencija", "inbox-odgovor", "crm", "crm-izgubljen", "katalog", "termini", "analitika", "offer",
]
// sub-beats render on their parent slot's module and only exist when it does
const PARENT: Partial<Record<TourSlot, TourSlot>> = {
  "inbox-intervencija": "inbox",
  "inbox-odgovor": "inbox",
  // the booked customer's file first, then the one who walked away — two files, two beats
  "crm-izgubljen": "crm",
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
  // `lost` = the customer who did NOT convert; their file is the second CRM beat.
  service: { main: "Marija Jović", intervention: "Dragana Simić", lost: "Nikola Perić" },
  product: { main: "Stefan Ilić", intervention: "Jelena Marić", lost: "Jelena Marić" },
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
  "inbox-intervencija": [f("chat-thread"), f("intervencije-stat", 4600)],
  // the flagged thread is already open from the beat before — ring it, then the box you type in
  "inbox-odgovor": [f("chat-thread", 400), f("reply-composer", 2400)],
  // the freshly-written row, then her file opening on top of it
  "crm": [f("crm-hero-row", 600), f("lead-file", 2900)],
  // the one who left: his row, then the outcome block that says where and why, then the thread
  "crm-izgubljen": [f("crm-hero-row", 400), f("lead-outcome", 2700), f("lead-log", 5600)],
  // where the agent's prices and terms come from, then the services themselves
  "katalog": [f("catalog-proof", 600), f("catalog-grid", 3400)],
  // the week first, then the one booking the viewer just watched get made
  "termini": [f("calendar-week"), f("appt-hero", 2200)],
  "analitika": [f("analytics-metrics", 500), f("ai-insights", 2600), f("analytics-funnel", 5200)],
}

/**
 * Long pages the viewer will scroll on their own. Once they do, the ring stops
 * following the script and follows them: whichever of these sections fills the
 * screen is the one lit. Scrolling up from "Put do termina" lands it back on
 * "Šta Vaši kupci stvarno pitaju", and so on.
 */
const SLOT_FOLLOW: Partial<Record<TourSlot, string[]>> = {
  "katalog": ["catalog-proof", "catalog-grid"],
  "analitika": ["analytics-metrics", "analytics-trend", "ai-insights", "analytics-demand", "analytics-funnel", "analytics-products", "analytics-status"],
}

/**
 * The narration card is an overlay that sits beside the highlight (lib/onboarding/place-card).
 * Within one slide the ring can move between several targets; a slide may name a steadier
 * target for the CARD so it doesn't hop with every beat — e.g. on the CRM slides the card stays
 * beside the customer file while the ring moves from the outcome block to the conversation.
 * Slides without an anchor follow the ring (analytics/catalogue follow the viewer's scrolling).
 * The product layout never changes for the tour (2026-10-25: narrowing pages and the customer
 * file for the card was "a bad trade-off for a one-time onboarding").
 */
const SLOT_CARD_ANCHOR: Partial<Record<TourSlot, string>> = {
  "inbox": '[data-tour-focus="chat-thread"]',
  "inbox-intervencija": '[data-tour-focus="chat-thread"]',
  "inbox-odgovor": '[data-tour-focus="chat-thread"]',
  "crm": '[data-tour-focus="lead-file"]',
  "crm-izgubljen": '[data-tour-focus="lead-file"]',
}

export function cardAnchorFor(slot: string | null | undefined): string | null {
  return SLOT_CARD_ANCHOR[slot as TourSlot] ?? null
}

// stable references: TourFocus re-runs its sequence whenever these change identity
const NO_BEATS: FocusBeat[] = []
const NO_FOLLOW: string[] = []

export function focusBeatsFor(slot: string | null | undefined): FocusBeat[] {
  return SLOT_FOCUS[slot as TourSlot] ?? NO_BEATS
}

export function focusFollowFor(slot: string | null | undefined): string[] {
  return SLOT_FOLLOW[slot as TourSlot] ?? NO_FOLLOW
}

export function tourHeroFor(slot: string | null | undefined, isService: boolean): string | null {
  const h = isService ? TOUR_HEROES.service : TOUR_HEROES.product
  switch (slot) {
    case "inbox": case "crm": case "termini":
      return h.main
    // The reply beat continues the escalation thread — the whole point is that
    // YOU answer the customer the agent refused to answer for.
    case "inbox-intervencija": case "inbox-odgovor":
      return h.intervention
    case "crm-izgubljen":
      return h.lost
    default:
      return null
  }
}

/** Whose customer file is open on screen — the hero of each CRM beat. */
export function tourFileFor(slot: string | null | undefined, isService: boolean): string | null {
  return slot === "crm" || slot === "crm-izgubljen" ? tourHeroFor(slot, isService) : null
}
