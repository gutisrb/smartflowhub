// One status system for every screen that shows a lead (inbox, CRM table, customer file,
// analytics). Before this there were five colour maps that disagreed with each other
// (Zakazano was emerald in two places and cyan in two; Intervencija red here, orange there),
// and the inbox coloured conversations by social channel, so an owner could not tell at a
// glance which conversations need them, which were won and which went quiet (2026-10-25).
//
// Six buckets, agreed with Nikola:
//   Intervencija  — a human must answer (flagged, complaint)
//   Novi          — first contact, nothing decided yet
//   U razgovoru   — conversation in progress
//   Zakazano / Naručeno / Zaposlen — won (label follows the business type)
//   Bez odgovora  — the customer has been silent > 24h ("left on seen")
//   Izgubljen     — silent > 7 days, or marked lost
//
// Silence counts whoever wrote last. The agent answers every message within seconds, so a
// thread that ends on the customer ends on a closer ("Hvala, razmisliću") — three days later
// that customer has gone quiet, not "U razgovoru". A message that really waits on a person
// is flagged human_needed and lands in Intervencija before silence is looked at.

export type LeadBucket = "needs_human" | "new" | "active" | "won" | "no_reply" | "lost"

export interface BucketStyle { label: string; color: string; order: number }

export const BUCKET_STYLE: Record<LeadBucket, BucketStyle> = {
  needs_human: { label: "Intervencija", color: "#f59e0b", order: 0 },
  new:         { label: "Novi",         color: "#38bdf8", order: 1 },
  active:      { label: "U razgovoru",  color: "#a78bfa", order: 2 },
  won:         { label: "Zakazano",     color: "#10b981", order: 3 },
  no_reply:    { label: "Bez odgovora", color: "#94a3b8", order: 4 },
  lost:        { label: "Izgubljen",    color: "#f43f5e", order: 5 },
}
export const BUCKET_ORDER: LeadBucket[] = ["needs_human", "new", "active", "won", "no_reply", "lost"]

const HOUR = 3_600_000
export const NO_REPLY_AFTER = 24 * HOUR
export const LOST_AFTER = 7 * 24 * HOUR

const NEEDS = new Set(["intervencija", "reklamacija"])
const WON = new Set(["zakazano", "završeno", "zavrseno", "naručio", "narucio", "poručio", "porucio", "isporučeno", "isporuceno", "dostavljeno", "zaposlen", "ponuda"])
const LOST = new Set(["izgubljen", "lost", "otkazano", "odbijen"])
const NEW = new Set(["novi", "novi lead", "new"])

const PRODUCT_NICHES = new Set(["ecommerce", "furniture", "fashion", "food", "auto", "supplements", "products"])

// ── Per-business wording ────────────────────────────────────────────────────────────────
// demo_crm stores one of a few fixed status words (a CHECK constraint), but a phone shop's
// customers do not "Zakazano": they announce a visit, they collect. Each business's own words live
// in its Business Sheet (onboarding_copy.business_sheet.status_labels) and are registered here once
// when the tenant loads. The registry is module-level on purpose: one browser session shows one
// business, and every screen that prints a status already goes through this file.
let TENANT_LABELS: Record<string, string> = {}
let TENANT_WON_TILE: string | null = null
export function setStatusLabels(labels?: Record<string, string> | null, wonTile?: string | null) {
  TENANT_LABELS = Object.fromEntries(Object.entries(labels || {}).map(([k, v]) => [k.toLowerCase(), v]))
  TENANT_WON_TILE = wonTile || null
}

/** "Zakazano" for services, "Naručeno" for shops, "Zaposlen" for employment agencies. */
export function wonLabel(niche?: string | null, crmStatus?: string | null): string {
  const s = (crmStatus || "").toLowerCase()
  if (s && TENANT_LABELS[s]) return TENANT_LABELS[s]
  if (!s && TENANT_WON_TILE) return TENANT_WON_TILE
  if (s === "zaposlen") return "Zaposlen"
  if (s === "ponuda") return "Ponuda"
  if (["naručio", "narucio", "poručio", "porucio", "isporučeno", "isporuceno", "dostavljeno"].includes(s)) return "Naručeno"
  if ((niche || "").toLowerCase() === "quote") return "Ponuda"
  if (PRODUCT_NICHES.has((niche || "").toLowerCase())) return "Naručeno"
  return "Zakazano"
}

export interface BucketInput {
  crmStatus?: string | null
  humanNeeded?: boolean
  lastAt?: string | number | Date | null
  /** visible messages in the thread (first contact = 1–2) */
  messageCount?: number
  now?: number
}

export function bucketFor(i: BucketInput): LeadBucket {
  const s = (i.crmStatus || "").trim().toLowerCase()
  if (i.humanNeeded || NEEDS.has(s)) return "needs_human"
  if (WON.has(s)) return "won"
  if (LOST.has(s)) return "lost"
  const now = i.now ?? Date.now()
  const at = i.lastAt != null ? new Date(i.lastAt).getTime() : NaN
  if (Number.isFinite(at)) {
    const silent = now - at
    if (silent > LOST_AFTER) return "lost"
    if (silent > NO_REPLY_AFTER) return "no_reply"
  }
  if (NEW.has(s)) return "new"
  if (!s && (i.messageCount ?? 99) <= 2) return "new"
  return "active"
}

/**
 * CRM rows have no message thread attached, so an open lead's silence is measured from its
 * last activity.
 */
export function bucketForRow(row: { status?: string | null; updated_at?: string | null; created_at?: string | null }, now?: number): LeadBucket {
  return bucketFor({ crmStatus: row.status, lastAt: row.updated_at || row.created_at, now })
}

/**
 * A made-to-order business converts to an OFFER, not a booking. demo_crm only accepts a fixed
 * set of status values (a CHECK constraint, Postgres), so the conversion is stored as "Zakazano"
 * and shown as "Ponuda" wherever the business is a 'quote' one. One place decides the word.
 */
export function displayStatus(status?: string | null, niche?: string | null): string {
  const s = status || ""
  if (TENANT_LABELS[s.toLowerCase()]) return TENANT_LABELS[s.toLowerCase()]
  return (niche || "").toLowerCase() === "quote" && s.toLowerCase() === "zakazano" ? "Ponuda" : s
}

export function bucketLabel(b: LeadBucket, niche?: string | null, crmStatus?: string | null): string {
  return b === "won" ? wonLabel(niche, crmStatus) : BUCKET_STYLE[b].label
}
