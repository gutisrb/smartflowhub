// Per-lead sales strategy: how THIS business sells, what stops THIS buyer, and the best
// grounded answer to each worry.
//
// The previous playbook had one hard-wired answer to "to je skupo": guarantee, then payment
// schedule, then "konsultacije". It fit one dental clinic and then got stamped on every demo,
// including businesses with no consultation at all (a container maker was offered a
// "razgovor na konsultacijama" the site never mentions). Nikola, 2026-10-26: financing was an
// EXAMPLE of a good lever for a pricey purchase, not the rule. The agent needs a process that
// works out, per business, which objections buyers really raise and which response fits each.
//
// The process, one reasoning pass per lead (analyzeBusiness):
//   1. Decide how the business sells (booking / quote / order), see lib/sales-model.mjs.
//   2. List the 4-6 things that actually stop someone buying THIS thing at THIS price: not a
//      generic list. A living container worries about transport, permits, insulation and the
//      total cost with assembly; an implant worries about pain, trust and the result.
//   3. For each, pick the approach that fits (diagnose the blocker, restate what the price
//      includes, lower the risk, split the decision, move the next step closer, restructure
//      the payment) and write the reply, in Serbian, using ONLY facts from the business.
//   4. Separately list levers the business has NOT published but a good seller would use
//      (instalments, a site visit, a reservation fee). These are not said in the demo. They are
//      call prep for Nikola: the demo can't claim what the owner hasn't offered, but the
//      conversation with the owner can set them up.
//
// Code, not the prompt, enforces the grounding (same principle as groundOfferTerms): a reply
// that states a number, a guarantee, a discount or an instalment plan the evidence does not
// contain is dropped, and the seed falls back to a plain, non-inventing answer.

import { normalizeOfferTerms } from './sales-playbook.mjs'
import { normalizeSalesModel } from './sales-model.mjs'

const fold = (x) => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj')

export const WORRY_IDS = ['price', 'later', 'trust', 'process', 'stock', 'time', 'fit', 'other']
export const APPROACHES = ['diagnose', 'restate_value', 'lower_risk', 'split_decision', 'next_step', 'payment_structure', 'compare', 'substitute']

export const ANALYZE_PROMPT = (ctx) => `You are a senior sales strategist for Serbian small businesses. Study this business, then design how its agent sells in Direct Messages.

BUSINESS: ${ctx.name}

WEBSITE EVIDENCE (the only source of facts about the business):
${ctx.evidence || '(none)'}

CATALOGUE (name — price — category):
${ctx.catalogue || '(none)'}

EXTRACTED TERMS: ${JSON.stringify(ctx.terms || {})}

ALREADY SAID IN THE AGENT'S FIRST MESSAGE: the price and the included items (${(ctx.terms?.included || []).join(', ') || 'none listed'}). The reply to the price worry must add something new, not repeat that list.

${ctx.highTicket ? 'THIS IS A HIGH-TICKET PURCHASE (headline price above 100.000 RSD): at least one call_prep lever MUST be a payment structure the owner could introduce (instalments over many months, a deposit plus balance, or a longer term), because a large one-off sum is the usual reason the sale stalls.\n\n' : ''}Think first, then answer. Return ONLY raw JSON with these keys, in this order:

"buyer": who buys this, how often, what is at stake for them (2 sentences, English).
"price_gap": why the headline price feels big to that buyer, and what they do not yet see that would make it feel fair (1-2 sentences, English).
"sales_model": one of booking | quote | order.
"model_reason": one English sentence saying how a customer really buys from this business.
"worries": 4-6 objects, each with
    "id": price | later | trust | process | stock | time | fit | other,
    "customer_says": the message a real Serbian customer would send, 3-10 words,
    "why": what is really stopping them, specific to this product at this price level (English),
    "approach": diagnose | restate_value | lower_risk | split_decision | next_step | payment_structure | compare | substitute,
    "agent_reply": the best response in Serbian (formal Vi), 1-2 short sentences, statements only (no question mark: a separate line asks for the next step).
"call_prep": 3-5 objects { "lever": one full sentence (8+ words) naming the product and exactly what to offer, e.g. "Let buyers of the 4-implant package pay in 12 monthly instalments after a deposit", "why": why that lever removes this product's specific objection } (English). Cover the families that suit the product and price level: a payment structure (instalments, advance plus balance, longer terms for big-ticket items), a smaller first step the buyer can say yes to, a risk reducer (visit, sample, reservation that can be returned), speed or availability. Never write a family name alone. A lever is something the owner could ADD to the offer (a payment term, a first step, a returnable reservation, a visit, a faster slot). Advice about marketing, tone, photos or what to "highlight" or "emphasize" is NOT a lever.

DEFINITIONS
- booking: the customer books a slot or comes in for a visit, an examination or an on-site estimate (clinics, dentists, salons, studios, skydiving, spas and hotels with treatments, repair shops with a free check). A high price alone does NOT make a business "quote": a clinic selling expensive treatments is still booking, because the next step is a visit.
- quote: made-to-order goods or installations bought through an enquiry and a tailored offer, with NO slot or visit to book first (containers, tiny homes, windows and doors, solar, pools, custom kitchens, pergolas without a site visit, group travel).
- order: the customer picks a ready item from a list and orders it (shop, ready-made furniture, fashion, accommodation with fixed prices).

HOW TO CHOOSE THE APPROACH (do not default to one)
- The gap is perceived value (price covers many parts the buyer does not picture): restate_value by naming the specific parts that are included.
- The purchase is big and considered: split_decision (what the buyer can settle now without committing to the whole), or payment_structure, but only when the evidence states a structure.
- The risk is trust or safety (health, structure, money up front): lower_risk with a stated guarantee, standard, material, process step or reference from the evidence.
- The buyer is unsure it fits: diagnose, naming the one thing that decides fit for this product.
- The buyer wants to wait: next_step, a small action that keeps the lead without pressure.
- A good reply sounds like a competent salesperson who knows the product, not a brochure.

HARD RULES FOR agent_reply
- Every reply must name at least one concrete fact from the evidence, catalogue or terms (an included item, a material, a stated service, a published term). A reply that any other company could send is wrong.
- Never state: a discount, a cheaper alternative the owner did not offer, instalments/rates/financing (unless EXTRACTED TERMS has financing), a guarantee, a delivery time, a quantity or any number that is not in the evidence/catalogue/terms.
- Never invent a consultation, visit, inspection, call or free offer the evidence does not name.
- Do not promise outcomes ("bez dodatnih troškova", "najbolja cena") the evidence does not state.
- Write the way the business's own site writes: reuse its nouns and verbs. No adjectives of praise (vrhunski, kvalitetan, idealan, udoban, moderan, ekskluzivan, pouzdan) unless the site uses that word about that thing.
- No slogans, no exclamation marks, no staged contrasts, no "bez obaveze". Plain sentences.
- If the best answer needs a fact the business has not published, use a weaker grounded approach and put the stronger lever in call_prep.`

/** Words that make a reply claim something the evidence has to support. */
const FINANCING = /\brat[aeiu]\b|na rate|kredit|kamat|odlozen|odloženo|finansir|lizing|installment/i
const DISCOUNT = /popust|akcij|jeftinij|sniz[ae]n|besplatn|gratis|bonus/i
const GUARANTEE = /garanc|garantuj|garantov/i
// praise the evidence does not state: the reply may describe, never promise
// praise reads as generic copy even when the site uses it; the reply has to state a fact instead
const PRAISE = /vrhunsk|moderan|moderne|modernu|modernim|savremen|napredn|idealn|ekskluziv|luksuz|najbolj|kvalitetn|pouzdan|izuzetn|prelep|udobn|elegantn|jedinstven|sveobuhvat|stručnost|strucnost|iskustv/i
const OVERCLAIM = /najbolj|vrhunsk|izuzetn|pouzdan|efikasn|bez dodatnih|bez skrivenih|zagarantovan|sigurno ce|sigurno će|odmah gotov/i

const STOP = new Set(['koji', 'koja', 'koje', 'kojim', 'sada', 'samo', 'može', 'mozete', 'možete', 'jeste', 'jesu', 'biti', 'kada', 'kako', 'zato', 'tako', 'nema', 'imate', 'vama', 'vase', 'vaše', 'vasem', 'vašem', 'vasu', 'vašu', 'cena', 'cene', 'razumem', 'uključeno', 'ukljuceno', 'ukljucuje', 'uključuje', 'dogovor', 'dogovorimo', 'odluku', 'odluka'])
/** Share of the reply's content words (stemmed) that the business itself used. */
export function groundedRatio(reply, ev) {
  const words = [...new Set((fold(reply).match(/[a-z0-9]{5,}/g) || []).filter((w) => !STOP.has(w)))]
  if (!words.length) return 1
  return words.filter((w) => ev.includes(w.slice(0, Math.max(4, w.length - 2)))).length / words.length
}

/**
 * Keep only the worries whose reply the evidence supports. `evidenceText` is everything the
 * business has said (site text + catalogue + terms) in one string.
 */
export function groundWorries(worries, { evidenceText, terms }) {
  const ev = fold(evidenceText || '')
  const t = normalizeOfferTerms(terms)
  const out = []
  for (const w of Array.isArray(worries) ? worries : []) {
    const reply = String(w?.agent_reply || '').trim()
    const says = String(w?.customer_says || '').trim()
    if (!reply || !says || reply.includes('?')) continue
    const f = fold(reply)
    if (FINANCING.test(f) && !t.financing && !FINANCING.test(ev)) continue
    if (GUARANTEE.test(f) && !t.guarantee && !GUARANTEE.test(ev)) continue
    if (DISCOUNT.test(f) && !DISCOUNT.test(ev)) continue
    const over = f.match(new RegExp(OVERCLAIM.source, 'gi')) || []
    if (over.some((w) => !ev.includes(w.trim()))) continue
    // acronyms and standards (ISO, CE, HACCP…) only when the business names them
    const acronyms = reply.match(/\b[A-Z]{2,}[A-Z0-9]*\b/g) || []
    if (acronyms.some((a) => !ev.includes(a.toLowerCase()))) continue
    // the reply must be made of the business's own words: invented praise ("visokokvalitetnih",
    // "idealna", "udobnost") is exactly what makes copy read as generic
    if (PRAISE.test(f)) continue
    if (groundedRatio(reply, ev) < 0.78) continue
    // every number in the reply must appear in what the business published
    const nums = f.match(/\d[\d.,]*/g) || []
    if (nums.some((n) => !ev.includes(n.replace(/[.,]$/, '')) && !ev.includes(n.replace(/[.,]/g, '')))) continue
    out.push({
      id: WORRY_IDS.includes(w.id) ? w.id : 'other',
      customer_says: says,
      why: String(w.why || '').trim(),
      approach: APPROACHES.includes(w.approach) ? w.approach : 'restate_value',
      agent_reply: reply,
    })
  }
  return out
}

export function normalizeStrategy(raw, { evidenceText, terms, fallbackModel = undefined }) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const worries = groundWorries(r.worries, { evidenceText, terms })
  return {
    sales_model: normalizeSalesModel(r.sales_model) || fallbackModel || 'booking',
    model_reason: String(r.model_reason || '').trim(),
    buyer: String(r.buyer || '').trim(),
    price_gap: String(r.price_gap || '').trim(),
    worries,
    call_prep: (Array.isArray(r.call_prep) ? r.call_prep : [])
      .map((c) => ({ lever: String(c?.lever || '').trim(), why: String(c?.why || '').trim() }))
      .filter((c) => c.lever.split(/\s+/).length >= 6 && !/^(highlight|emphasi[sz]e|explain|showcase|provide (customer|detailed|a detailed|information)|mention|communicate)/i.test(c.lever)).slice(0, 4),
    analyzed_at: new Date().toISOString(),
  }
}

/** The one reply the seed uses for a given worry id, or null when the engine had none that held. */
export const replyFor = (strategy, id) => strategy?.worries?.find((w) => w.id === id) || null

/**
 * One reasoning pass: how it sells + its real objections. `openai` is an initialised client so
 * this stays testable and the scripts keep one place for keys.
 */
export async function analyzeBusiness(openai, { name, evidence, catalogue, terms, fallbackModel, highTicket = false }) {
  const evidenceText = [evidence, catalogue, JSON.stringify(terms || {})].filter(Boolean).join('\n')
  const ask = async (extra = '') => {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      // deterministic: the same lead must get the same model and replies on every run
      temperature: 0,
      seed: 7,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: ANALYZE_PROMPT({ name, evidence: String(evidence || '').slice(0, 9000), catalogue, terms, highTicket }) + extra }],
    })
    return JSON.parse(resp.choices[0].message.content || '{}')
  }
  try {
    const first = await ask()
    let strategy = normalizeStrategy(first, { evidenceText, terms, fallbackModel })
    // The price reply is the one the demo cannot do without. When it was rejected (praise, a number
    // the site never states, a claim it cannot support), ask once more with the reason spelled out.
    if (evidenceText.length > 400 && !strategy.worries.some((w) => w.id === 'price')) {
      const retry = await ask(`\n\nYOUR PREVIOUS PRICE REPLY WAS REJECTED because it contained praise adjectives, claims or numbers the business never states. Rewrite ALL replies: each one must be built from concrete things the evidence names (an included item, a material, a step, a published term, a place) and must not contain praise words such as vrhunski, moderan, idealan, kvalitetan, iskustvo, stručnost. For the price worry say what the price covers or how the purchase works, using only named facts.`)
      const again = normalizeStrategy(retry, { evidenceText, terms, fallbackModel })
      if (again.worries.length >= strategy.worries.length) strategy = { ...again, sales_model: strategy.sales_model, model_reason: strategy.model_reason, buyer: strategy.buyer, price_gap: strategy.price_gap }
    }
    return strategy
  } catch (e) {
    // Never present a failure as a decision: the caller must not save an analysis that did not run.
    return { ...normalizeStrategy(null, { evidenceText, terms, fallbackModel }), failed: true, error: String(e?.message || e) }
  }
}

/** Private call-prep sheet for Nikola, one lead. Never shown to the lead. */
export function callPrepMarkdown({ name, strategy, terms }) {
  const t = normalizeOfferTerms(terms)
  const have = [
    t.financing && `plaćanje: ${t.financing}`,
    t.payment_schedule && `faze plaćanja: ${t.payment_schedule}`,
    t.guarantee && `garancija: ${t.guarantee}`,
    t.free_consultation && `besplatan prvi korak: ${t.free_consultation.label}`,
    t.delivery && `isporuka: ${t.delivery}`,
  ].filter(Boolean)
  return `# ${name} — priprema za razgovor\n\n` +
    `**Kako prodaju:** ${strategy.sales_model} — ${strategy.model_reason}\n\n` +
    `## Šta već objavljuju\n${have.length ? have.map((h) => `- ${h}`).join('\n') : '- ništa o uslovima plaćanja ili prvom koraku'}\n\n` +
    `## Čega se kupac plaši i kako agent odgovara u demou\n` +
    (strategy.worries.map((w) => `- **${w.id}** — „${w.customer_says}“ (${w.approach}): ${w.agent_reply}`).join('\n') || '- (nijedan odgovor nije prošao proveru činjenica)') + '\n\n' +
    `## Šta predložiti vlasniku na razgovoru (nije na sajtu, ne pominje se u demou)\n` +
    (strategy.call_prep.map((c) => `- **${c.lever}** — ${c.why}`).join('\n') || '- —') + '\n'
}
