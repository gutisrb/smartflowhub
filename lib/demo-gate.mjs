// The claims gate: may this demo go in front of the business's owner? Pure and deterministic, no model call.
//
// WHY (2026-11-10): nine demos were fact-checked against each business's own site and ALL failed, for eight repeating reasons
// (a concession to the price objection, a webshop script on a quote business, promises the site never makes, one generic
// complaint on every demo, "stručnjak" for a skydiving school, hard-coded slots and reminders, "Zakazano" for a business that
// books nothing, template openers and stale prices). Nothing in the pipeline blocked a send, so Nikola was the gate. This is the
// gate: every rule below is a defect that shipped, written as a check, with the real failing line as its test fixture.
//
// Two kinds of finding: `failures` block the lead (promote_email_ready, send_outreach), `warnings` are listed for the owner read.
// A number in an agent line must be on the business's own pages (fetched live, <del>/<s> prices stripped) or in its Instagram
// captions; if it is only in the stored catalogue it is a warning, if it is nowhere it is a failure.

import { createHash } from 'node:crypto'
import { tourCopy } from './onboarding/tour-copy.mjs'

export const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj')

const CLINIC = new Set(['dental', 'medical'])
const EMOJI = /\p{Extended_Pictographic}/u

// ── rules on what the AGENT says ───────────────────────────────────────────────────────────────
// `unless(ctx)` returns true when the business's own facts make the line legitimate.
export const AGENT_RULES = [
  { id: 'concedes-price', re: /nije mala cifra|slazem se|skroz razumem|razumem vas[.!]?(\s|$)|^jasno[.!]/,
    why: 'agrees with the price objection; the answer is the business’s own plan, guarantee or inclusions' },
  { id: 'order-confirmed', re: /porudzbina je (primljena|potvrdjena)/, unless: (c) => c.flows.orderTracking && /korpa|korpu|dodaj u korpu/.test(c.corpusF),
    why: 'confirms an order the business does not take in chat (a quote or enquiry business confirms a request, not an order)' },
  { id: 'tracking-sms', re: /pracenje posiljke|broj za pracenje/, unless: (c) => /pracenj/.test(c.corpusF),
    why: 'promises parcel tracking the site never mentions' },
  { id: 'cash-on-delivery', re: /pouzec/, unless: (c) => /pouzec/.test(c.corpusF),
    why: 'offers cash on delivery the site does not state' },
  { id: 'personal-callback', re: /se javlja licno|javlja (vam )?se licno|se javljaju licno|javljaju (vam )?se licno/,
    why: 'promises a named person calls back personally; no site states that' },
  { id: 'channel-promise', re: /dobijate na (ovaj|taj) broj/,
    why: 'promises the offer arrives on the customer’s phone number; no site states that channel' },
  { id: 'invented-team', re: /kolege (iz|koje) |vam kolege pripreme|kolege pripreme/,
    why: 'names a department or a team split the business never mentions' },
  { id: 'reminder', re: /podsetnik/, unless: (c) => /podsetnik/.test(c.corpusF),
    why: 'promises a reminder the site never offers' },
  { id: 'hard-slots', re: /\b(danas|sutra) u \d{1,2}\s?h\b|\bu \d{1,2}\s?h ili (u )?\d{1,2}\s?h\b/, unless: (c) => c.flows.calendar,
    why: 'offers appointment slots, but the business books by phone, form or not at all' },
  { id: 'hold-policy', re: /sacuvam vam termin|ceka vas do /,
    why: 'states a hold policy the site never states' },
  { id: 'emoji-in-clinic', test: (line, c) => c.clinic && EMOJI.test(line),
    why: 'emoji in a clinic chat (a medical question gets no smiley)' },
  { id: 'calque', re: /javiti oko resenja|oko resenja/,
    why: 'a calque; Serbian says "u vezi sa rešenjem"' },
]

// ── rules on what the CUSTOMER says ──────────────────────────────────────────────────────────────
export const CUSTOMER_RULES = [
  { id: 'filler-thanks', test: (line) => /^hvala[.!]?$/.test(fold(line).trim()),
    why: '"Hvala." from the customer after a non-answer is filler, not a reaction' },
  { id: 'generic-complaint', re: /stigao mi je ostecen proizvod|kupila sam kod vas pre dve nedelje|proizvod je stigao ostecen/,
    why: 'the same complaint is on every demo; write hero.intervention from this business’s own complaint/warranty policy' },
]

const contentTokens = (s) => fold(s).replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length >= 3)

/** Does a customer opener look like something this business's customers really wrote? */
export function openerIsReal(opener, questions) {
  const o = contentTokens(opener)
  if (!o.length) return true // "?" or an emoji: nothing to invent
  const qs = (questions || []).map((q) => (typeof q === 'string' ? q : q?.text)).filter(Boolean)
  for (const q of qs) {
    const t = new Set(contentTokens(q))
    const hit = o.filter((x) => t.has(x)).length
    if (o.length <= 2 ? hit === o.length : hit / o.length >= 0.6) return true
  }
  return false
}

// ── numbers: every amount, duration or percentage the agent states must be stated by the business ──
const NUM = /(\d{1,3}(?:[.\s]\d{3})+|\d+(?:[.,]\d+)?)\s*(rsd|din(?:ara)?|eur|€|evra|m²|m2|cm|mm|kg|km|dana|dan|radnih dana|nedelj\w*|mesec\w*|godin\w*|godine|%|kvadrat\w*)/gi
export const normNum = (raw) => {
  const s = String(raw).trim()
  if (/^\d{1,3}([.\s]\d{3})+$/.test(s)) return s.replace(/[.\s]/g, '')
  return s.replace(',', '.').replace(/\s/g, '')
}
export function numbersIn(text) {
  const out = []
  for (const m of String(text).matchAll(NUM)) out.push({ raw: m[0].trim(), n: normNum(m[1]), unit: m[2].toLowerCase() })
  return out
}
/** Every number written anywhere in a text, normalised: "44.400,00" -> 44400, "5 600" -> 5600. */
export function numberSet(text) {
  const set = new Set()
  // a grouped number ("44.400,00", "5 600") or a plain one; whitespace never glues two separate numbers together
  for (const m of String(text).matchAll(/\d{1,3}(?:[. ]\d{3})+(?:,\d+)?(?!\d)|\d+(?:[.,]\d+)?/g)) {
    const raw = m[0].trim()
    set.add(normNum(raw))
    set.add(raw.replace(/[.,\s]/g, ''))
    const dec = raw.match(/^(\d{1,3}(?:[. ]\d{3})*),(\d{1,2})$/) // 44.400,00 -> 44400
    if (dec) set.add(dec[1].replace(/[.\s]/g, ''))
  }
  return set
}

/**
 * @param {{
 *   threads: { id: string, role: string, message: string }[],
 *   crm: { id_razgovora?: string, status?: string, razlog?: string, komentar?: string }[],
 *   flows: any, niche?: string, model?: string,
 *   corpus: string,                       // the business's own pages, fetched live
 *   captions?: string[],                  // its own Instagram captions
 *   otherSources?: string[],              // stored catalogue / sheet / terms text: weaker than the live pages
 *   questions?: any[],                    // customer_voice.questions
 *   statusLabels?: Record<string,string>, // business_sheet.status_labels
 *   heroOwn?: boolean,                    // the hero was hand-written from the site (sheets/<email>.json)
 * }} d
 */
export function checkDemo(d) {
  const flows = d.flows || {}
  const niche = String(d.niche || '').toLowerCase()
  const clinic = CLINIC.has(niche)
  const live = `${d.corpus || ''}\n${(d.captions || []).join('\n')}`
  const ctx = { flows, clinic, corpusF: fold(live) }
  const failures = []
  const warnings = []
  const fail = (rule, where, text, why) => failures.push({ rule, where, text: String(text).slice(0, 200), why })
  const warn = (rule, where, text, why) => warnings.push({ rule, where, text: String(text).slice(0, 200), why })

  // 0. there must be something to verify against
  if ((d.corpus || '').length < 500) fail('no-site-text', '-', '', 'the business’s site could not be read, so no claim can be verified')

  const byThread = new Map()
  for (const m of d.threads || []) { if (!byThread.has(m.id)) byThread.set(m.id, []); byThread.get(m.id).push(m) }
  const heroIds = [...byThread.keys()].filter((id) => /hero/.test(id)).sort()

  // 1. what the agent says, everywhere (hero, background and filler threads)
  const seen = new Set()
  for (const m of d.threads || []) {
    if (m.role !== 'assistant') continue
    const f = fold(m.message)
    for (const r of AGENT_RULES) {
      const hit = r.test ? r.test(m.message, ctx) : r.re.test(f)
      if (!hit || (r.unless && r.unless(ctx))) continue
      const key = `${r.id}|${f}`
      if (seen.has(key)) continue // the same filler line a hundred times is one finding
      seen.add(key)
      fail(r.id, m.id, m.message, r.why)
    }
  }

  // 2. what the customer says in the hero threads
  for (const id of heroIds) for (const m of byThread.get(id)) {
    if (m.role !== 'user') continue
    for (const r of CUSTOMER_RULES) {
      const hit = r.test ? r.test(m.message) : r.re.test(fold(m.message))
      if (!hit) continue
      if (r.id === 'generic-complaint' && d.heroOwn) continue
      fail(r.id, id, m.message, r.why)
    }
  }
  // the opener of the sale hero is what a real customer of THIS business wrote
  const hero1 = heroIds.find((id) => /hero1$/.test(id))
  const opener = hero1 && byThread.get(hero1).find((m) => m.role === 'user')
  if (opener) {
    if (!(d.questions || []).length) fail('no-real-comments', hero1, opener.message, 'no real customer question is stored, so the opener cannot come from this business’s customers')
    else if (!openerIsReal(opener.message, d.questions)) fail('template-opener', hero1, opener.message, 'not close to any real comment under this business’s posts')
  }

  // 3. numbers: every amount/duration/percentage the agent (or the CRM reason) states
  const liveNums = numberSet(live)
  const otherNums = numberSet((d.otherSources || []).join('\n'))
  const lines = [
    ...(d.threads || []).filter((m) => m.role === 'assistant').map((m) => ({ where: m.id, text: m.message })),
    ...(d.crm || []).filter((r) => /hero/.test(r.id_razgovora || '')).flatMap((r) => [r.razlog, r.komentar].filter(Boolean).map((t) => ({ where: `crm:${r.id_razgovora}`, text: t }))),
  ]
  const numSeen = new Set()
  for (const l of lines) for (const x of numbersIn(l.text)) {
    if (Number(x.n) <= 1) continue
    const key = `${x.n}${x.unit}|${l.where}`
    if (numSeen.has(key)) continue
    numSeen.add(key)
    if (liveNums.has(x.n)) continue
    if (otherNums.has(x.n)) warn('number-not-on-site', l.where, `${x.raw} (in: ${l.text})`, 'only in the stored catalogue/sheet, not on the pages fetched now (price may be stale)')
    else fail('number-not-on-site', l.where, `${x.raw} (in: ${l.text})`, 'this amount/duration is on none of the business’s pages or captions')
  }

  // 4. the CRM must not speak a booking language the business does not have
  if (!flows.calendar && !flows.stays) {
    const labels = d.statusLabels || {}
    const bad = new Set()
    for (const r of d.crm || []) if (['Zakazano', 'Završeno'].includes(r.status) && !labels[r.status]) bad.add(r.status)
    for (const s of bad) fail('crm-booking-status', 'crm', s, `CRM shows "${s}" for a business with no booking; map it with status_labels or do not seed it`)
  }

  // 5. tour cards: no role the business does not have
  try {
    const tour = tourCopy({ model: d.model || 'quote', niche, flows })
    const card = JSON.stringify(tour['inbox-intervencija'] || {})
    if (/stru[cč]njak|trener/i.test(card) && !/strucnjak|trener/.test(ctx.corpusF)) fail('card-role', 'tour:inbox-intervencija', card, 'the card names a role (stručnjak/trener) the business does not use')
  } catch { /* tour copy not available for this model */ }

  // 6. a hand-written hero is the only intervention that can come from the business's own policy
  if (!d.heroOwn) warn('generic-intervention', 'hero3', '', 'the intervention hero is the niche default; a hand sheet should write it from the business’s own policy')

  const hash = createHash('sha1').update(JSON.stringify([d.threads, d.crm])).digest('hex').slice(0, 16)
  return { ok: failures.length === 0, failures, warnings, hash }
}
