/**
 * sales-playbook.mjs — how the demo agent sells, in layers.
 *
 * One source of truth for every demo the pipeline builds, so a rule is fixed once and
 * every future tenant gets it. Layers stack:
 *
 *   GENERAL       every business, every niche
 *   SERVICE       scheduling-based businesses (clinics, studios, salons, venues)
 *   HIGH_TICKET   any service whose headline price is >= HIGH_TICKET_RSD — dental implants,
 *                 aesthetic surgery, renovations. Triggered by PRICE, not by niche name, so a
 *                 dental clinic selling whitening stays on the normal flow and a spa selling
 *                 a 6-figure package gets the careful one.
 *   PRODUCT       shops that fulfil orders
 *
 * Founding rule (Nikola, 2026-10-23): the agent does what the business ALREADY does by hand,
 * as stated on its own website. It never invents a process, a discount, or a payment plan.
 * Anything it says about terms comes from `offer_terms`, extracted from the site at build
 * time. A null field means "the site doesn't say" — the agent stays silent on it.
 *
 * Why the earlier demo was wrong: it answered a €5.6k price with the bare number plus "Da Vas
 * zakažem?", then offered a cheaper treatment when the lead hesitated. A clinic owner reads
 * that as a bot gambling their biggest sales, and the whole offer looks pointless.
 */

export const HIGH_TICKET_RSD = 100000

export const isHighTicket = (priceRsd) => Number(priceRsd) >= HIGH_TICKET_RSD

/** Shape the extractor must return. Every value quoted from the site, or null. */
export const OFFER_TERMS_PROMPT = `
  "offer_terms": {
    "included": ["what the listed price already includes, short items, e.g. 'pregled', 'plan terapije'"] ,
    "guarantee": "the guarantee WITH its duration per item exactly as the site states it, e.g. '5 godina na krunice, doživotna na implante'. A line or table pairing items with durations (e.g. 'Krunice 5 godina', 'Zubni implanti Doživotna') IS the guarantee — prefer it over generic items like 'popravke u garantnom roku'. null if no guarantee is stated",
    "payment_schedule": "ONLY the steps that carry a fixed amount, in the site's order, each with its own label, as one short chat-ready phrase (e.g. 'rezervacija 500 €, drugi dolazak 2.550 €, treći dolazak 2.550 €'). Skip steps priced 'po cenovniku'. Do not renumber or merge. null if not stated",
    "payment_schedule_applies_to": "the specific package/service the schedule is for (e.g. 'Hollywood smile'), or null if the site presents it for all services",
    "financing": "ONLY if the site explicitly offers payment in rates/kredit/na rate — quote it. If the site says cash/card only, or is silent, null",
    "free_consultation": { "label": "e.g. 'besplatan online pregled'", "how": "what the customer does, as a clause that completes 'dovoljno je da ...', in correct Serbian, e.g. 'pošaljete fotografije zuba i snimak'", "outcome": "what they get back, e.g. 'informativnu ponudu'" },
    "delivery": "shipping/delivery terms for shops, or null",
    "returns": "return/exchange terms, or null",
    "payment_methods": "e.g. 'gotovinsko ili kartično', or null"
  }`

export const OFFER_TERMS_RULES = `
For "offer_terms": copy ONLY what the website states, in short Serbian phrases. Do NOT infer, do NOT
offer standard industry practice. In particular "financing" must be null unless the page literally
offers rates/instalment credit — a site that says "plaćanje je gotovinsko ili kartično" has NO financing.
"free_consultation" is null unless the site names a free/no-obligation first step (besplatan pregled,
online pregled, besplatna procena). Use null for every field the content does not support.`

// Shouting on the site ("ODLOŽENO PLAĆANJE") must not shout in the chat.
const deshout = (v) => (/[A-ZČĆŠĐŽ]{4}/.test(v) && v === v.toUpperCase() ? v.toLowerCase() : v)

/** Normalise whatever the LLM returned into the shape the rest of the pipeline relies on. */
export function normalizeOfferTerms(raw) {
  const s = (v) => (typeof v === 'string' && v.trim() && !/^(null|n\/a|nema)$/i.test(v.trim()) ? deshout(v.trim()) : null)
  const r = raw && typeof raw === 'object' ? raw : {}
  const fc = r.free_consultation && typeof r.free_consultation === 'object' ? r.free_consultation : null
  const label = s(fc?.label)
  return {
    included: (Array.isArray(r.included) ? r.included : []).map(s).filter(Boolean).slice(0, 6),
    // site tables arrive Title Cased ('Zubni implanti Doživotna'); these phrases are embedded mid-sentence
    guarantee: s(r.guarantee)?.toLowerCase() ?? null,
    payment_schedule: s(r.payment_schedule)?.toLowerCase() ?? null,
    payment_schedule_applies_to: s(r.payment_schedule_applies_to),
    financing: s(r.financing),
    free_consultation: label ? { label, how: s(fc.how), outcome: s(fc.outcome) } : null,
    delivery: s(r.delivery),
    returns: s(r.returns),
    payment_methods: s(r.payment_methods),
  }
}

/**
 * Code-level grounding, the same principle as catalogue prices: the prompt says "copy only
 * what the site states", and the model still does not always comply (2026-10-24: L DECOR got
 * "plaćanje na rate u našem maloprodajnom objektu", a phrase found nowhere on its site). Every
 * extracted term must be visibly supported by the scraped text, or it is dropped. A false
 * "na rate" in a demo is worse than none: the owner knows their own terms.
 */
const fold = (x) => String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'dj')
const WORD = /[a-z0-9€]{4,}/g
export function supportedBy(phrase, content) {
  if (!phrase) return false
  const text = fold(content)
  const words = [...new Set(fold(phrase).match(WORD) || [])]
  if (!words.length) return false
  // stems, not exact forms: "garancija" on the page supports "garanciju" in the phrase
  const hits = words.filter((w) => text.includes(w.slice(0, Math.max(4, w.length - 2))))
  return hits.length / words.length >= 0.6
}
const FINANCING_SIGNAL = /na rate|\brat[aeu]\b|kredit|bez kamate|odlozen|odloženo|grejs|installment/i

export function groundOfferTerms(terms, content) {
  const t = normalizeOfferTerms(terms)
  if (!content) return normalizeOfferTerms(null)
  const keep = (v) => (supportedBy(v, content) ? v : null)
  const fc = t.free_consultation
  return {
    included: t.included.filter((i) => supportedBy(i, content)),
    guarantee: keep(t.guarantee),
    payment_schedule: keep(t.payment_schedule),
    payment_schedule_applies_to: t.payment_schedule_applies_to,
    // financing additionally needs an explicit financing word somewhere in the scraped text
    financing: t.financing && FINANCING_SIGNAL.test(fold(content)) ? keep(t.financing) : null,
    free_consultation: fc && supportedBy(fc.label, content) ? fc : null,
    delivery: keep(t.delivery),
    returns: keep(t.returns),
    payment_methods: keep(t.payment_methods),
  }
}

/**
 * A business name as the prospect writes it. Lead rows arrive without diacritics
 * ("Stomatoloska ordinacija Cvejanovic") or with a Cyrillic city tacked on ("Dallas Nameštaj
 * Нови Пазар"). Keep every word of the name, restore diacritics from the site's own spelling
 * and from common trade words, and drop a trailing Cyrillic suffix.
 */
const TRADE_WORDS = { stomatoloska: 'stomatološka', namestaj: 'nameštaj', kozmetika: 'kozmetika', ordinacija: 'ordinacija', klinika: 'klinika', salon: 'salon', studio: 'studio', estetska: 'estetska', centar: 'centar', kuca: 'kuća', masaza: 'masaža', frizerski: 'frizerski', decja: 'dečja', decji: 'dečji', zdravlje: 'zdravlje', apoteka: 'apoteka', pekara: 'pekara', cvecara: 'cvećara', obuca: 'obuća', odeca: 'odeća', nakit: 'nakit', vencanja: 'venčanja', ugostiteljstvo: 'ugostiteljstvo', pergole: 'pergole', stolarija: 'stolarija', kuhinje: 'kuhinje' }
export function properName(current, fromSite) {
  let name = String(current || '').replace(/\s+[\u0400-\u04FF][\u0400-\u04FF\s.-]*$/, '').trim()
  const siteWords = String(fromSite || '').split(/\s+/).filter(Boolean)
  name = name.split(/(\s+)/).map((w) => {
    if (/^\s+$/.test(w)) return w
    const f = fold(w)
    const site = siteWords.find((sw) => fold(sw) === f && sw !== w && /[čćšžđČĆŠŽĐ]/.test(sw))
    const fixed = site || TRADE_WORDS[f]
    if (!fixed || fold(fixed) !== f) return w
    // keep the original's capitalisation pattern
    if (w === w.toUpperCase() && w.length > 1) return fixed.toUpperCase()
    return w[0] === w[0].toUpperCase() ? fixed.charAt(0).toUpperCase() + fixed.slice(1) : fixed.charAt(0).toLowerCase() + fixed.slice(1)
  }).join('')
  return name || String(current || '')
}

/** A business always addresses a customer formally: vas/vam/vaš… → Vas/Vam/Vaš… (gpt still slips). */
export function formalVi(text) {
  return String(text || '').replace(/(^|[^\p{L}])(vi|vas|vam|vama|vaš|vaša|vaše|vašeg|vašem|vašim|vašu|vaši|vaših|vašoj|vašom)(?=[^\p{L}]|$)/gu, (m, pre, w) => pre + w.charAt(0).toUpperCase() + w.slice(1))
}

// ── Prompt rules (fed to the GPT conversation generator and exported for the live agent) ──
export const RULES_GENERAL = [
  'Never answer a price with the bare number. State the price, then what it includes (only from the offer terms / catalogue).',
  'Never lower the price, never offer a discount, and never steer to a cheaper alternative unless the owner configured one.',
  'Only state terms (guarantee, payment split, financing, delivery, returns) that appear in the OFFER TERMS. If a term is not listed, do not mention it; if asked, say the team confirms it and flag the chat for a human.',
  'Never mention rates / instalments / "na rate" unless OFFER TERMS contains a financing entry.',
  'Write like a person in chat: 1-3 short sentences per message, never a paragraph or a pasted block.',
  'If the customer hesitates or ends with "hvala" / "razmislim", make exactly one real attempt (value, then the business\'s own next step) before letting go, and always leave the door open.',
  'Questions that need an expert (medical, legal, technical) or any complaint: do not answer, collect name + phone, write [HUMAN_NEEDED].',
]
export const RULES_SERVICE = [
  'Goal: a booked slot. Offer two concrete times, confirm name + phone, repeat the day and hour back.',
]
export const RULES_HIGH_TICKET = [
  'Never book the expensive treatment itself in chat. Offer the business\'s own low-commitment first step ONLY if OFFER TERMS names one; otherwise move to the booking the business actually takes.',
  'On a price objection use the response worked out for THIS business in SALES STRATEGY (it picks the approach that fits the buyer: restating what the price covers, lowering the risk, splitting the decision, a stated payment structure). Never default to one fixed answer.',
]
export const RULES_QUOTE = [
  'Goal: a qualified enquiry. The customer is buying something made to order, so the agent collects name, phone and the location or requirement the offer depends on, then confirms that the offer is being prepared.',
  'Never book an appointment or a consultation the business does not offer. The next step is the tailored offer.',
  'On a price objection use the response worked out for THIS business in SALES STRATEGY; never a discount and never instalments unless OFFER TERMS lists them.',
]
export const RULES_PRODUCT = [
  'Goal: a completed order — item, name, phone, address, payment method — using only the delivery and payment terms the shop states.',
  'If an item is sold out, offer the closest in-stock item; this is substitution, not a price downsell.',
]

export function salesRulesFor({ isService, highTicket, model = undefined }) {
  const m = model || (isService ? 'booking' : 'order')
  const rules = [...RULES_GENERAL, ...(m === 'quote' ? RULES_QUOTE : m === 'booking' ? RULES_SERVICE : RULES_PRODUCT), ...(m === 'booking' && highTicket ? RULES_HIGH_TICKET : [])]
  return rules.map((r, i) => `${i + 1}. ${r}`).join('\n')
}

/** Block appended to the GPT conversation prompt: playbook + the tenant's real terms. */
export function playbookPromptBlock({ isService, highTicket, offerTerms, model = undefined, strategy = undefined }) {
  const t = offerTerms || {}
  const lines = [
    t.included?.length && `Included in prices: ${t.included.join(', ')}`,
    t.guarantee && `Guarantee: ${t.guarantee}`,
    t.payment_schedule && `Payment structure: ${t.payment_schedule}`,
    t.financing ? `Financing: ${t.financing}` : 'Financing: NONE — never mention rates or instalments',
    t.free_consultation && `Free first step: ${t.free_consultation.label}${t.free_consultation.how ? ` (${t.free_consultation.how})` : ''}${t.free_consultation.outcome ? ` → ${t.free_consultation.outcome}` : ''}`,
    t.delivery && `Delivery: ${t.delivery}`,
    t.returns && `Returns: ${t.returns}`,
    t.payment_methods && `Payment methods: ${t.payment_methods}`,
  ].filter(Boolean)
  // The generator's own format rules own the [HUMAN_NEEDED] system message (exactly one per batch);
  // the literal token in a behavioural rule made the model scatter it through assistant text.
  const rules = salesRulesFor({ isService, highTicket, model }).replace('write [HUMAN_NEEDED]', 'hand over to a human (the single escalation conversation required by the format rules)')
  const worries = (strategy?.worries || []).map((w) => `- ${w.id} (${w.approach}): customer says "${w.customer_says}" → agent replies "${w.agent_reply}"`)
  return `SALES PLAYBOOK — the AI agent must follow these rules in every conversation:
${rules}
${worries.length ? `\nSALES STRATEGY for this business (use these responses when the matching worry comes up):\n${worries.join('\n')}\n` : ''}
OFFER TERMS (the ONLY terms the agent may state):
${lines.length ? lines.join('\n') : '(none extracted — state no terms)'}`
}

// ── Seeded hero conversations (deterministic, grounded in offer_terms) ──
// Every line here was read aloud for grammar (2026-10-24: "Hvala, javim se" and the bare
// "Pre toga: slanje fotografija" were called out). Prices are stated as "Cena je …" so the
// service name never has to be declined, which is where generated Serbian goes wrong.
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const lower = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s)
const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} i ${a[a.length - 1]}` : a[0] || '')
const first = (full) => String(full).split(' ')[0]
const end = (s) => (/[.!?…]$/.test(s) ? s : `${s}.`)

/** "Hollywood smile – cena paketa" → "Hollywood smile": price-list labels are not service names. */
export function cleanServiceName(name) {
  return String(name || '').replace(/\s*[–—-]\s*(cena|cene|cenovnik|paket cena|price)\b.*$/i, '').replace(/\s*\((cena|cene)[^)]*\)\s*$/i, '').trim()
}

/** "Hollywood smile" stays as written; "Zubni implanti - jedan zub" reads lowercase mid-sentence. */
export function inSentence(name) {
  const n = String(name || '').trim()
  const foreign = /[wxyq]/i.test(n) || /[A-ZČĆŠŽĐ]/.test(n.slice(1))
  return foreign ? n : lower(n)
}
/** "koliko košta" vs "koliko koštaju": decided by the head noun of the name. */
export function priceQuestion(name) {
  // the head noun stands before a preposition: "Ispun kod dece" is one ispun, not "dece"
  const words = String(name || '').split(/\s[-–/]\s|\//)[0].trim().split(/\s+/)
  const cut = words.findIndex((w, i) => i > 0 && /^(kod|za|na|sa|od|do|iz|u|po|bez|i)$/i.test(w))
  const head = (cut > 0 ? words.slice(0, cut) : words).pop().toLowerCase()
  // foreign/brand names ("Hollywood smile", "All on 4") are treated as singular
  const plural = !/[wxyq]/i.test(String(name)) && (/[^aeiou]i$/.test(head) || (/e$/.test(head) && !/(nje|će|lje|stvo|šte|ište|ne)$/.test(head)))
  return `Zdravo, koliko ${plural ? 'koštaju' : 'košta'} ${inSentence(name)}?`
}

function includedSentence(t) {
  return t?.included?.length ? ` U cenu je uključeno: ${list(t.included.slice(0, 4).map(lower))}.` : ''
}
function guaranteeSentence(t) {
  return t?.guarantee ? ` Na radove dajemo garanciju: ${lower(t.guarantee).replace(/[.]$/, '')}.` : ''
}
/** Financing if the site lists it; otherwise the real payment structure; otherwise nothing. */
function paymentSentence(t, sale = '') {
  if (t?.financing) return ` ${end(cap(t.financing))}`
  const scope = t?.payment_schedule_applies_to
  const applies = !scope || String(sale).toLowerCase().includes(String(scope).toLowerCase().split(/\s+/)[0])
  if (t?.payment_schedule && applies) return ` Plaćanje ide u fazama: ${lower(t.payment_schedule).replace(/[.]$/, '')}.`
  return ''
}
/** "besplatan online pregled: dovoljno je da pošaljete …, a mi Vam šaljemo informativnu ponudu" */
function firstStepPhrase(fc) {
  if (!fc) return ''
  const how = fc.how ? `: dovoljno je da ${fc.how.replace(/^da\s+/i, '').replace(/[.]$/, '')}` : ''
  const outcome = fc.outcome ? `, a mi Vam šaljemo ${fc.outcome.replace(/[.]$/, '')}` : ''
  return `${lower(fc.label)}${how}${outcome}`
}

const CLINIC = new Set(['dental', 'medical'])
const priceWorry = (strategy) => strategy?.worries?.find((w) => w.id === 'price')?.agent_reply || ''
const laterWorry = (strategy) => strategy?.worries?.find((w) => w.id === 'later')?.agent_reply || ''

// ── Voice ─────────────────────────────────────────────────────────────────────────────────
// How a salesperson actually writes in a Serbian DM. Rewritten 2026-10-27 after Nikola heard
// ChatGPT in "Razumem, to je ozbiljna odluka", "Rado ću Vam objasniti", "odlučite na miru",
// "Zabeleženo ✅". A person acknowledges in two or three words that fit the amount, then says
// something concrete, then proposes the next step. `AI_TELLS` is enforced by audit_demo_reality.mjs.
export const AI_TELLS = /to je ozbiljna odluka|razumem, to je|rado ću vam objasniti|odlučite na miru|uporedite na miru|zabeleženo ✅|^odlično[.!]|^razumem\.(\s|$)/i

// below this a "skupo" beat is not worth staging: the answer is the price itself
export const OBJECTION_MIN_RSD = 30000

/**
 * Acknowledging a price objection: never. 2026-11-10 (nine demos fact-checked against their sites): "Nije mala cifra,
 * slažem se." and "Jasno." agree with the customer that the price is too high, which no owner wants his agent to say.
 * The answer is the business's own (payment plan, guarantee, what the price includes) and it opens the reply.
 * Kept as a function so every caller reads the same rule; it returns '' and callers trim.
 */
export function ackPrice(_priceRsd) {
  return ''
}
/** "U cenu ulaze pregled, plan terapije i privremene krunice." */
function includedLine(t) {
  return t?.included?.length ? ` U cenu ulaze ${list(t.included.slice(0, 4).map(lower))}.` : ''
}
/**
 * The business's own payment plan, the strongest answer to "skupo" when it has one: only what the
 * site states (financing, or a schedule as written there), else null and the beat falls back to
 * its other stated terms. 2026-10-27: "Ne plaćate sve odjednom" alone is no answer; the plan is.
 */
function instalmentsLine(t, sale) {
  if (t?.financing) return `Može. ${end(cap(t.financing))}`
  const scope = t?.payment_schedule_applies_to
  const applies = !scope || String(sale).toLowerCase().includes(String(scope).toLowerCase().split(/\s+/)[0])
  // the schedule as the site writes it; counting its commas lied ("500 €, pa dve uplate" is three)
  if (t?.payment_schedule && applies) return `Plaćanje ide u delovima: ${lower(t.payment_schedule).replace(/[.]$/, '')}.`
  return null // the site says nothing about it: the hero does not stage a plan it cannot state
}

/** What a hesitating customer types, the same line in every demo is a template. Stable per business. */
const HESITATIONS = ['Malo mi je skupo trenutno.', 'To je dosta za mene.', 'Skupo je, iskreno.']
export function hesitation(seed) {
  let h = 0
  for (const ch of String(seed || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return HESITATIONS[h % HESITATIONS.length]
}
/** Answer to "skupo": the business's own answer, else its stated guarantee/payment, else nothing. */
function priceReply({ strategy, terms, sale, model }) {
  const worked = priceWorry(strategy)
  if (worked) return end(worked)
  const reassurance = `${guaranteeSentence(terms)}${paymentSentence(terms, sale)}`.trim()
  if (reassurance) return reassurance
  return model === 'quote' && terms?.delivery ? `U cenu ulaze i ${lower(String(terms.delivery)).replace(/[.]$/, '')}.` : ''
}

/**
 * The tour's "sale" hero for a business customers book with, or ask an offer from.
 * `opening` (lib/customer-voice.mjs) says how THIS business's customers start: their own words,
 * as a DM or as a reply to the post they saw. `objection` is what really holds them back, in
 * their words (e.g. "Da li može na rate?"); without one the customer says the price is high.
 * Returns { msgs, stepName, highTicket, status, razlog, books }.
 */
export function buildSaleMessages({ svc, terms, customer = 'Marija Jović', model = 'booking', strategy = null, niche = null, opening = null, objection = null, followUp = null, calendar = true }) {
  const t = terms || {}
  const name = first(customer)
  // a clinic's patient is not greeted with an emoji (clinic fact-checks 2026-11-10: "jars on a medical question")
  const smile = CLINIC.has(String(niche).toLowerCase()) ? '' : ' 😊'
  const highTicket = isHighTicket(svc.priceRsd)
  const fc = t.free_consultation
  const reply = priceReply({ strategy, terms: t, sale: svc.sale, model })
  const firstMsg = opening?.text
    ? ['user', opening.text, opening.kind === 'post_reply' ? { type: 'post_reply', image_url: opening.post?.image || null, post_caption: opening.post?.caption?.slice(0, 140) || null } : undefined].filter(Boolean)
    : ['user', svc.price ? priceQuestion(svc.sale) : `Zdravo, zanima me ${inSentence(svc.sale)}. Ima li slobodnih termina?`]
  const fromPost = opening?.kind === 'post_reply'

  if (model === 'quote') {
    const where = t.delivery ? 'Na koju lokaciju bi išla isporuka? Da Vam pošaljemo ponudu sa prevozom do Vas.' : 'Recite mi gde i za šta Vam treba, pa Vam pošaljemo ponudu baš za to.'
    const answer = svc.price && !fromPost
      ? `Zdravo, ${name}${smile} Cena je ${svc.price}.${includedLine(t)}`
      : `Zdravo, ${name}${smile} Za taj objekat šaljemo ponudu sa svim stavkama.${t.delivery ? ` ${end(cap(t.delivery))}` : ''}`
    const msgs = [firstMsg, ['assistant', `${answer} ${where}`.trim()]]
    msgs.push(['user', followUp || 'Poslaću Vam lokaciju.'])
    const objects = !!(svc.price && !fromPost && reply)
    if (objects) {
      msgs.push(['user', 'Malo je preko budžeta, iskreno.'])
      msgs.push(['assistant', `${ackPrice(svc.priceRsd)} ${reply}`.trim()])
      msgs.push(['assistant', 'Pošaljite mi ime i broj telefona za ponudu.'])
    } else {
      msgs.push(['assistant', 'Može. Pošaljite mi ime i broj telefona za ponudu.'])
    }
    msgs.push(['user', `${customer}, 064 123 4567`], ['assistant', `Hvala, ${name}. Zahtev za ponudu je upisan i prosleđen.`])
    return {
      msgs, stepName: `Ponuda: ${svc.sale}`, highTicket, status: 'Zakazano', books: false,
      razlog: `${fromPost ? 'Pitala za objekat sa objave' : 'Pitala za cenu'} — agent je rekao šta ulazi u cenu i prikupio podatke za ponudu.`,
    }
  }

  // booking: the business's own first step when it names one, a first examination for a clinic,
  // otherwise the service itself. Never an invented consultation.
  const stepName = highTicket && fc?.label ? cap(fc.label) : highTicket && CLINIC.has(String(niche).toLowerCase()) ? 'Prvi pregled' : cap(svc.sale)
  // a first step done from home (Cvejanović: "Pošaljte fotografije zuba i rendgenski snimak") is not
  // a slot in the calendar: the chat ends with the patient sending them, not with "danas u 15h"
  const remote = highTicket && !!fc && /online|fotograf|snim/i.test(`${fc.label} ${fc.how || ''}`)
  const named = stepName !== cap(svc.sale) // "za prvi pregled", so the booking says what is booked
  const slotsFor = named ? `Za ${lower(stepName)} imam danas u 15h ili u 16h.` : 'Danas u 15h ili u 16h.'
  const step = highTicket && fc ? `Najlakši prvi korak je ${firstStepPhrase(fc)}.` : ''
  // An objection is staged only when this business has a real answer to it. A customer saying
  // "skupo" and the agent answering "Jasno." with nothing behind it teaches the owner nothing.
  // The best answer to money worries is the business's own payment plan, stated as the site states
  // it; else its stated terms (guarantee, free first step, what the price includes).
  const priced = Number(svc.priceRsd) >= OBJECTION_MIN_RSD
  const plan = priced ? instalmentsLine(t, svc.sale) : null
  const answer = plan ? plan : priced && reply ? reply : null
  const beat = answer ? hesitation(svc.sale) : null
  // The site states no calendar a customer books a slot in (phone, e-mail or a form): the agent never offers
  // "danas u 15h", it asks when the customer wants to come and records the request (2026-11-10: DENTALUX, a
  // clinic that books by phone, got "danas u 15h" and "stiže Vam podsetnik").
  if (!calendar && !remote) {
    const msgs = [firstMsg]
    msgs.push(['assistant', svc.price ? `Zdravo, ${name}${smile} Cena je ${svc.price}.${includedLine(t)}` : `Zdravo, ${name}${smile} Koji dan i vreme Vam odgovaraju?`])
    if (svc.price) {
      if (beat) msgs.push(['user', beat], ['assistant', answer])
      msgs.push(['assistant', 'Koji dan i vreme Vam odgovaraju?'])
    }
    msgs.push(['user', 'Radnim danom, posle 16h.'], ['assistant', 'Pošaljite mi ime i broj telefona.'], ['user', `${customer}, 064 123 4567`])
    msgs.push(['assistant', `Hvala, ${name}. Zahtev za termin je upisan i prosleđen.`])
    const asked = beat ? 'Rekla da je skupo' : svc.price ? `Pitala za cenu (${svc.price})` : 'Pitala za termin'
    const did = beat ? (plan ? 'objasnio kako se plaća' : 'odgovorio uslovima koje imate') : includedLine(t) ? 'rekao šta ulazi u cenu' : null
    return { msgs, stepName, highTicket, status: 'Zainteresovan', books: false,
      razlog: `${asked} — agent je ${did ? `${did} i ` : ''}upisao željeni termin za potvrdu.` }
  }
  const msgs = [firstMsg]
  if (!svc.price) {
    msgs.push(['assistant', `Zdravo, ${name}${smile} Ima, danas u 15h ili u 16h. Šta Vam više odgovara?`])
  } else {
    msgs.push(['assistant', `Zdravo, ${name}${smile} Cena je ${svc.price}.${includedLine(t)}`])
    // two messages, the way a person texts: the answer, then the next step
    if (beat) msgs.push(['user', beat], ['assistant', answer])
    if (remote) msgs.push(['assistant', `${step} Sve to možete da pošaljete i ovde, u poruci.`])
    else if (beat) msgs.push(['assistant', `${step ? `${step} ` : ''}Ako Vam odgovara, ${slotsFor.charAt(0).toLowerCase()}${slotsFor.slice(1, -1)}, pa Vas upišem.`])
    else msgs.push(['user', 'Kada imate slobodno?'], ['assistant', `${step ? `${step} ` : ''}${slotsFor} Šta Vam više odgovara?`])
  }
  if (remote) {
    msgs.push(['user', 'Važi, šaljem večeras.'], ['assistant', 'Pošaljite mi i ime i broj telefona, da znamo čiji su snimci.'], ['user', `${customer}, 064 123 4567`])
    msgs.push(['assistant', `Hvala, ${name}. Čim pogledamo šta pošaljete, javljamo Vam se na ovaj broj.`])
  } else {
    msgs.push(['user', 'Može u 15h.'], ['assistant', 'Pošaljite mi ime i broj telefona, pa Vas upisujem.'], ['user', `${customer}, 064 123 4567`])
    msgs.push(['assistant', `Upisani ste${named ? ` za ${lower(stepName)},` : ''} danas u 15h ✅${highTicket && fc?.how ? ` Do tada je dovoljno da ${fc.how.replace(/^da\s+/i, '').replace(/[.]$/, '')}.` : ''}`])
  }
  const next = remote ? `prvi korak: ${lower(fc.label)}` : 'termin'
  const asked = beat ? 'Rekla da je skupo' : `Pitala za cenu (${svc.price})`
  const inclusions = !!includedLine(t)
  const did = beat ? (plan ? 'objasnio kako se plaća' : 'odgovorio uslovima koje imate') : inclusions ? 'rekao šta ulazi u cenu' : null
  const razlog = !svc.price ? 'Pitala za slobodan termin — agent je ponudio dva i zakazao.'
    : remote ? `${asked} — agent je ${did ? `${did} i ` : ''}dogovorio ${next}. Šalje snimke.` : `${asked} — agent je ${did ? `${did} i ` : ''}zakazao ${named ? lower(stepName) : 'termin'}.`
  return { msgs, stepName, highTicket, status: 'Zakazano', razlog, books: !!svc.price ? !remote : true }
}

export const LEFT_ON = 'Hvala, javiću se.'

/**
 * The tour's "left without buying" hero. Asks the price, says thanks and leaves, the agent
 * makes ONE real attempt (the response worked out for this business, else a plain next step),
 * and he doesn't reply. The CRM razlog names the exact message.
 */
export function buildHesitationMessages({ svc, terms, customer = 'Nikola Perić', model = 'booking', strategy = null, niche = null, calendar = true }) {
  const t = terms || {}
  const name = first(customer)
  const smile = CLINIC.has(String(niche).toLowerCase()) ? '' : ' 😊'
  const fc = t.free_consultation
  const worked = laterWorry(strategy) || priceWorry(strategy)
  const reassurance = `${guaranteeSentence(t)}${paymentSentence(t, svc.sale)}`.trim()
  if (!svc.price) {
    const msgs = [
      ['user', `Zdravo, zanima me ${inSentence(svc.sale)}. Ima li slobodnih termina?`],
      ['assistant', calendar ? `Zdravo, ${name}${smile} Ima, sutra u 10h ili u 17h. Koje vreme Vam odgovara?` : `Zdravo, ${name}${smile} Koji dan i vreme Vam odgovaraju?`],
      ['user', LEFT_ON],
      ['assistant', 'Važi. Ako Vam zatreba termin, samo pišite ovde.'],
    ]
    return { msgs, razlog: `Pitao je za slobodne termine i otišao uz „${LEFT_ON}“ Agent je ostavio razgovor otvoren.`, leftOn: LEFT_ON }
  }
  let attempt, offered
  if (model === 'quote') {
    attempt = `Važi.${worked ? ` ${end(worked)}` : ''} Ako hoćete, pripremimo Vam ponudu za Vašu lokaciju, pa je imate pri ruci kad odlučujete. Da je pripremim?`
    offered = 'ponudu za njegovu lokaciju'
  } else if (fc) {
    attempt = `Važi. Ako želite prvo da vidite plan, najlakši korak je ${firstStepPhrase(fc)}. ${/online|fotograf|snim/i.test(`${fc.label} ${fc.how || ''}`) ? 'Sve to možete da pošaljete i ovde, u poruci.' : 'Da Vas upišem?'}`
    offered = lower(fc.label)
  } else {
    attempt = `Važi.${worked ? ` ${end(worked)}` : reassurance ? ` ${reassurance}` : ''} Ako Vam zatreba termin, samo pišite ovde.`
    offered = 'nastavak razgovora'
  }
  const msgs = [
    ['user', priceQuestion(svc.sale)],
    ['assistant', `Zdravo, ${name}${smile} Cena je ${svc.price}.${includedLine(t)}`],
    ['user', LEFT_ON],
    ['assistant', attempt],
  ]
  const razlog = `Pitao je za cenu (${svc.price}) i otišao uz „${LEFT_ON}“ Agent je ponudio ${offered} i čeka odgovor.`
  return { msgs, razlog, leftOn: LEFT_ON }
}

/** Plain-text export of the playbook for pasting into the live agent's system prompt. */
export function playbookMarkdown() {
  const sec = (title, rules) => `## ${title}\n${rules.map((r) => `- ${r}`).join('\n')}\n`
  return `# Sales playbook — paste into the services agent's system prompt\n\n` +
    `Founding rule: do what the business already does by hand, as stated on its own website. Never invent a process, discount or payment plan. State terms only from the OFFER TERMS section the tenant provides; a missing term means stay silent.\n\n` +
    sec('General (every business)', RULES_GENERAL) + '\n' +
    sec('Scheduling-based services', RULES_SERVICE) + '\n' +
    sec('Made-to-order / quote businesses', RULES_QUOTE) + '\n' +
    sec(`High-ticket services (headline price >= ${HIGH_TICKET_RSD.toLocaleString('de-DE')} RSD)`, RULES_HIGH_TICKET) + '\n' +
    sec('Product shops', RULES_PRODUCT)
}
