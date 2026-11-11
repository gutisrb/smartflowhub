// How a business sells, which decides everything the demo shows.
//
// Until 2026-10-26 the pipeline had one axis, a 15-way niche label, and only two sales flows
// behind it: book an appointment, or place an order. "services" was the catch-all for
// containers, tiny homes, PVC windows, solar and pools, so a container maker got a clinic's
// calendar, "termin danas u 15h" and 120-minute "durations" (found on Varmus; 11 of the 14
// pipeline demos closed on "potvrdim termin"). The axis that matters is how the customer
// buys:
//
//   booking  the customer reserves a slot with the business     clinic, salon, skydiving, repair shop
//   quote    a made-to-order or high-ticket purchase that goes  containers, tiny homes, windows,
//            through an enquiry and a tailored offer             solar, pools, travel packages
//   order    the customer picks an item and orders it            shops, furniture, fashion
//
// The model is stored per lead (onboarding_copy.sales_model) and also encoded in demo_niche
// ('quote' is a niche key of its own), so every screen that only knows the niche still renders
// the right flow.

export const BOOKING_NICHES = new Set(['dental', 'medical', 'beauty', 'fitness', 'services', 'wellness', 'real-estate'])
// pergole/tende stay on their own niche: those businesses do field visits, so they keep a calendar
export const QUOTE_NICHES = new Set(['quote'])

/** @returns {'booking'|'quote'|'order'} */
export function salesModelOf(niche) {
  const n = String(niche || '').toLowerCase()
  if (QUOTE_NICHES.has(n)) return 'quote'
  if (BOOKING_NICHES.has(n)) return 'booking'
  return 'order'
}

/** The niche key a model needs, keeping the current one when it already fits. */
export function nicheForModel(model, currentNiche) {
  const cur = String(currentNiche || '').toLowerCase()
  if (model === 'quote') return QUOTE_NICHES.has(cur) ? cur : 'quote'
  if (model === 'booking') return BOOKING_NICHES.has(cur) ? cur : 'services'
  return !BOOKING_NICHES.has(cur) && !QUOTE_NICHES.has(cur) && cur && cur !== 'generic' ? cur : 'ecommerce'
}

export const SALES_MODELS = ['booking', 'quote', 'order']
export const normalizeSalesModel = (m) => (SALES_MODELS.includes(String(m || '').toLowerCase()) ? String(m).toLowerCase() : null)
