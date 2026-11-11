// The Business Reality Sheet: what this business sells and HOW its customers actually buy,
// every claim tied to a sentence from the business's own site.
//
// Why it exists (2026-10-26): the demo pipeline picked a template and filled it in. First a 15-way
// niche label, then a 3-way "sales model" label. Both put JetSet (a phone store with repairs and
// buyback whose homepage says "Dođi bez zakazivanja") on an appointment calendar, and put shops
// on schedule statuses. The same defect was logged on 2026-09-03 (a bike shop selling face cream).
// A template wins whenever real data does not fit. So there is no template any more: the demo is
// DERIVED from this sheet, and a field without a verified quote is `unknown`, never filled in.
//
//   offers[]   each line the business sells: how it is bought and how it reaches the customer
//   booking    required | none | unknown   (+ the sentence)
//   shipping   couriers / cash on delivery, only when the site names them
//   location   address and opening hours from the site's own structured data
//   primary    the offer whose conversation is the demo's hero
//
// Code, not the prompt, enforces it: verifySheet() drops every claim whose quote is not verbatim
// in the fetched text, and the booking decision comes from detectBooking() (negations win).

import { detectBooking, detectCouriers, detectCod, quoteInText, findStatement } from './business-facts.mjs'
import { groundedRatio } from './objection-engine.mjs'

const fold = (x) => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'dj')

export const KINDS = ['product', 'service', 'buyback', 'made_to_order']
export const HOW_BOUGHT = ['order', 'reserve_slot', 'walk_in', 'quote', 'reserve_for_pickup']
export const FULFILMENT = ['courier', 'delivery', 'pickup', 'in_store', 'on_site', 'none']

export const SHEET_PROMPT = (ctx) => `You describe how a Serbian business REALLY sells, from its own website text, so a demo can mirror it. Mirror, never improve: if the site does not say it, it is not true.

BUSINESS: ${ctx.name}

WEBSITE TEXT (the only source; every quote you give must be copied from it word for word):
${ctx.evidence}

FACTS ALREADY ESTABLISHED BY CODE (do not contradict them):
- Booking: ${ctx.facts.booking.booking}${ctx.facts.booking.quote ? ` — "${ctx.facts.booking.quote}"` : ''}
- Couriers named: ${ctx.facts.couriers.join(', ') || 'none'}
- Cash on delivery stated: ${ctx.facts.cod ? 'yes' : 'no'}

Return ONLY raw JSON:
{
  "offers": [
    {
      "name": "what is sold, as the site names it (Serbian)",
      "kind": "product | service | buyback | made_to_order",
      "how_bought": "order | reserve_slot | walk_in | quote | reserve_for_pickup",
      "fulfilment": "courier | delivery | pickup | in_store | on_site | none",
      "quote": "ONE sentence copied word for word from the website text that shows how this is bought",
      "reply": "how the business's DM agent answers the most common question about this offer: 1-2 Serbian sentences, formal Vi, using ONLY what the website text says (no prices, numbers or promises it does not state)"
    }
  ],
  "primary": 0,
  "stages": ["the real steps a customer goes through, 3-5 short Serbian labels, in order"]
}

RULES
- One offer per revenue line (a phone store that also repairs and buys phones has three). Do not merge, do not invent.
- how_bought: order = picks it and orders online/DM; reserve_slot = books a time with the business; walk_in = just comes in (estimate/repair/handover on the spot); quote = enquiry then a tailored offer; reserve_for_pickup = asks if it is in stock, then collects in the store.
- fulfilment: courier/delivery = it is sent or delivered to the customer; in_store = the customer collects or the work happens in the store; on_site = the business goes to the customer; none = no physical handover.
- If the site says "bez zakazivanja" the business is NOT reserve_slot.
- primary = index of the offer most of the DMs will be about.
- An offer without a word-for-word quote must be left out.`

const norm = (s) => String(s || '').trim()

/** schema.org JSON-LD → address + opening hours, verbatim from the page. */
export function detectLocation(html) {
  const blocks = [...String(html || '').matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)]
  let address = null
  let hours = []
  for (const b of blocks) {
    let data
    try { data = JSON.parse(b[1]) } catch { continue }
    // the address and the opening hours often sit on different nodes (Place vs Store/Organization)
    for (const n of [].concat(data?.['@graph'] || data)) {
      const a = n?.address
      if (!address && a?.streetAddress) address = [String(a.streetAddress).replace(/[.,\s]+$/, ''), a.addressLocality].filter(Boolean).join(', ')
      if (!hours.length && n?.openingHours) hours = [].concat(n.openingHours).map(norm).filter(Boolean)
    }
  }
  return address ? { address, hours } : null
}

/**
 * Turn a model answer into a sheet in which every claim is verified against `evidenceText`.
 * @param {object|null} raw    the model's JSON (or a hand-written sheet)
 * @param {{evidenceText:string, html?:string}} src
 */
export function verifySheet(raw, { evidenceText, html = '' }) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const offers = []
  for (const o of Array.isArray(r.offers) ? r.offers : []) {
    if (!norm(o?.name) || !quoteInText(o.quote, evidenceText)) continue // no verbatim quote, no offer
    offers.push({
      name: norm(o.name),
      kind: KINDS.includes(o.kind) ? o.kind : 'service',
      how_bought: HOW_BOUGHT.includes(o.how_bought) ? o.how_bought : 'walk_in',
      fulfilment: FULFILMENT.includes(o.fulfilment) ? o.fulfilment : 'none',
      quote: norm(o.quote),
      // the agent's stock answer about this offer, kept only if it is made of the site's own words
      reply: norm(o.reply) && !norm(o.reply).includes('?') && groundedRatio(norm(o.reply), fold(evidenceText)) >= 0.7 ? norm(o.reply) : null,
    })
  }
  const facts = detectBooking(evidenceText)
  // a stated "no booking" is final; a stated booking instruction is trusted; silence stays unknown
  // what is booked: a time slot (clinic, salon) or dates (a hotel stay); a slot calendar fits only the first
  const booking = { state: facts.booking, quote: facts.quote, unit: facts.booking === 'required' && /datum|boravak|nocenj|smestaj|sob[eu]\b/.test(fold(facts.quote)) ? 'dates' : facts.booking === 'required' ? 'slot' : null }
  // a negation on the site also demotes any offer the model called reserve_slot
  if (booking.state === 'none') for (const o of offers) if (o.how_bought === 'reserve_slot') o.how_bought = 'walk_in'
  const couriers = detectCouriers(evidenceText)
  return {
    version: 1,
    source: r.source || 'llm',
    offers,
    primary: Number.isInteger(r.primary) && r.primary >= 0 && r.primary < offers.length ? r.primary : 0,
    booking,
    shipping: { couriers, cod: detectCod(evidenceText) },
    location: detectLocation(html),
    stages: (Array.isArray(r.stages) ? r.stages : []).map(norm).filter(Boolean).slice(0, 6),
  }
}

/** Niches where an appointment is how the work happens even when the homepage never says "zakažite". */
const APPOINTMENT_BY_NATURE = new Set(['dental', 'medical', 'beauty'])

/**
 * Everything the product shows is derived here, from the sheet, by rule.
 * @returns {{calendar:boolean, orderTracking:boolean, quote:boolean, walkIn:boolean, inStore:boolean, primary:object|null, reason:Record<string,string>}}
 */
export function deriveFlows(sheet, niche = '') {
  const offers = sheet?.offers || []
  const b = sheet?.booking?.state || 'unknown'
  const implied = b === 'unknown' && APPOINTMENT_BY_NATURE.has(String(niche).toLowerCase())
  const stays = b === 'required' && sheet?.booking?.unit === 'dates'
  const calendar = (b === 'required' && !stays) || implied
  const orderTracking = offers.some((o) => o.kind === 'product' && ['courier', 'delivery'].includes(o.fulfilment))
  const quote = offers.some((o) => o.how_bought === 'quote' || o.kind === 'made_to_order')
  const walkIn = offers.some((o) => o.how_bought === 'walk_in')
  const inStore = offers.some((o) => o.fulfilment === 'in_store' || o.how_bought === 'reserve_for_pickup')
  return {
    calendar, stays, orderTracking, quote, walkIn, inStore,
    primary: offers[sheet?.primary ?? 0] || null,
    reason: {
      calendar: stays ? `stays are booked by date on the site: "${sheet.booking.quote}"` : calendar ? (implied ? `appointment is how ${niche} work happens (the site does not say otherwise)` : `site: "${sheet.booking.quote}"`) : b === 'none' ? `site says no booking: "${sheet.booking.quote}"` : 'the site never mentions booking',
    },
  }
}

/**
 * The business's own words for the stored status values (demo_crm only stores a fixed few).
 * Only walk-in/in-store businesses and made-to-order ones need their own.
 */
export function statusLabelsFor(flows) {
  if (flows.stays) return { labels: { Zakazano: 'Rezervisano', Završeno: 'Boravak završen' }, won_tile: 'Rezervisano' }
  if (flows.calendar) return { labels: {}, won_tile: null }
  // a quote business is seeded with 'Zakazano' whether or not it also tracks orders (2026-11-11: Nameštaj Modesta)
  if (flows.quote) return { labels: { Zakazano: 'Ponuda' }, won_tile: 'Ponuda' }
  if (flows.inStore && !flows.orderTracking) return { labels: { Naručio: 'Najavio dolazak', Isporučeno: 'Kupio', Zakazano: 'Ponuda', Završeno: 'Realizovano' }, won_tile: 'Najavili dolazak' }
  // no calendar, no stays: the schedule words never reach the owner (2026-11-11 gate: Nameštaj Modesta showed "Zakazano" with no booking)
  if (!flows.orderTracking) return { labels: { Zakazano: 'Ponuda', Završeno: 'Realizovano' }, won_tile: null }
  return { labels: {}, won_tile: null }
}

/** One model pass. Never saves a failure: the caller gets `failed` and must stop. */
export async function extractSheet(openai, { name, evidenceText, html = '', corpus = null }) {
  const facts = { booking: detectBooking(evidenceText), couriers: detectCouriers(evidenceText), cod: detectCod(evidenceText) }
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o', temperature: 0, seed: 7, response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: SHEET_PROMPT({ name, evidence: String(evidenceText).slice(0, 12000), facts }) }],
    })
    return verifySheet(JSON.parse(resp.choices[0].message.content || '{}'), { evidenceText: corpus || evidenceText, html })
  } catch (e) {
    return { failed: true, error: String(e?.message || e) }
  }
}

/**
 * Without a model (no credits, or as a floor): the offers a site states in so many words. A shop
 * with a cart sells products by order; a sentence about delivery says how they reach the customer.
 * Every offer still carries its verbatim sentence. Anything subtler stays unknown.
 */
export function factsOnlySheet({ evidenceText, html = '', niche = '' }) {
  const find = (re) => findStatement(evidenceText, re)
  const cart = find(/dodaj u korpu|u korpu|vasa korpa|naruci online|poruci online|poruci\w* odmah|naruci\w* odmah|online prodavnic|web ?shop|kupi online|online preko sajta|kupovin\w* online|online kupovin/)
  const ships = find(/dostav|isporuk|kurir|saljemo|posta/)
  // big things are delivered (and often assembled), parcels are couriered
  const bulky = /montaz|unos|kljuc u ruke|na lokaciju|na adresu i/.test(fold(ships || '')) || ['furniture', 'quote'].includes(String(niche).toLowerCase())
  const offers = cart ? [{
    name: 'Proizvodi iz prodavnice', kind: 'product', how_bought: 'order',
    fulfilment: ships ? (bulky ? 'delivery' : 'courier') : 'none',
    quote: cart,
  }] : []
  return verifySheet({ offers, primary: 0, source: 'facts' }, { evidenceText, html })
}

const DAYS = { Monday: 'pon', Tuesday: 'uto', Wednesday: 'sre', Thursday: 'čet', Friday: 'pet', Saturday: 'sub', Sunday: 'ned' }
/** "Monday,Tuesday,Wednesday,Thursday,Friday 10:00-20:00" → "pon–pet 10–20h" (only patterns it can read exactly). */
export function formatHours(hours = []) {
  const parts = []
  for (const h of hours) {
    const m = String(h).match(/^([A-Za-z,\s-]+)\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/)
    if (!m) return null
    const days = m[1].split(/[,\s]+/).filter(Boolean).map((d) => DAYS[d])
    if (days.some((d) => !d)) return null
    const span = days.length > 2 ? `${days[0]}–${days[days.length - 1]}` : days.join(' i ')
    const t = (hh, mm) => (mm === '00' ? `${+hh}` : `${+hh}:${mm}`)
    parts.push(`${span} ${t(m[2], m[3])}–${t(m[4], m[5])}h`)
  }
  return parts.length ? parts.join(', ') : null
}
