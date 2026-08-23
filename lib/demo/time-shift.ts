/**
 * Demo tenants are seeded once and then opened by the lead days or weeks later.
 * Without this, every demo silently dies: the inbox empties (its "7 dana" filter
 * finds nothing), analytics reads 0 razgovora, and the calendar shows a blank week.
 *
 * So demo data is re-anchored at READ time instead of being re-seeded: we find how
 * old the newest seeded message is and slide every timestamp forward by that much.
 * Relative spacing (and clock times, for appointments) is preserved, so the story
 * stays intact — the hero conversation is always "a few minutes ago" and the hero
 * booking is always "danas u 15h", whenever the lead happens to log in.
 */

const DAY = 86_400_000
const midnight = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime() }

export interface DemoShift {
  /** exact offset for message/CRM timestamps */
  deltaMs: number
  /** whole-day offset for appointments, so 15:00 stays 15:00 */
  deltaDays: number
}

export const NO_SHIFT: DemoShift = { deltaMs: 0, deltaDays: 0 }

const cache = new Map<string, Promise<DemoShift>>()

/**
 * Resolved once per client per page load; all modules share the same offset.
 * `enabled` MUST be the caller's demo-tenant flag — never shift a live account,
 * whose "newest message an hour ago" is a real fact, not staleness.
 */
export async function getDemoShift(sb: any, clientId: string, enabled = true): Promise<DemoShift> {
  if (!clientId || !enabled) return NO_SHIFT
  const hit = cache.get(clientId)
  if (hit) return hit
  const p = (async (): Promise<DemoShift> => {
    const { data } = await sb
      .from("razgovori")
      .select("created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
    const newest = data?.[0]?.created_at
    if (!newest) return NO_SHIFT
    const seededAt = new Date(newest).getTime()
    const now = Date.now()
    // Fresh seed (or clock skew): leave it alone.
    if (now - seededAt < 30 * 60_000) return NO_SHIFT
    return {
      // newest seeded message lands ~8 minutes ago — "just happened", not "in the future"
      deltaMs: now - seededAt - 8 * 60_000,
      deltaDays: Math.round((midnight(now) - midnight(seededAt)) / DAY),
    }
  })()
  cache.set(clientId, p)
  return p
}

export const shiftIso = (iso: string, deltaMs: number): string =>
  deltaMs ? new Date(new Date(iso).getTime() + deltaMs).toISOString() : iso

export const shiftIsoDays = (iso: string, deltaDays: number): string =>
  deltaDays ? new Date(new Date(iso).getTime() + deltaDays * DAY).toISOString() : iso

/** Shift the named ISO-date fields on a row set. Rows without the field pass through. */
export function shiftRows<T extends Record<string, any>>(
  rows: T[],
  fields: string[],
  deltaMs: number,
): T[] {
  if (!deltaMs) return rows
  return rows.map((r) => {
    const out: Record<string, any> = { ...r }
    for (const f of fields) if (out[f]) out[f] = shiftIso(out[f], deltaMs)
    return out as T
  })
}

/** Same, but whole days — keeps appointment clock times exact. */
export function shiftRowsDays<T extends Record<string, any>>(
  rows: T[],
  fields: string[],
  deltaDays: number,
): T[] {
  if (!deltaDays) return rows
  return rows.map((r) => {
    const out: Record<string, any> = { ...r }
    for (const f of fields) if (out[f]) out[f] = shiftIsoDays(out[f], deltaDays)
    return out as T
  })
}
