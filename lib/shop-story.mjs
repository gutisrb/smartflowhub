// Demo stories for businesses that sell products, driven by the Business Sheet (lib/business-sheet.mjs).
//
// Before 2026-10-26 every product tenant got the same script: a cash-on-delivery courier order,
// "Koliko košta dostava?", "Ima li ovo u veličini M?" — asked of sofas, perfume and phones alike.
// JetSet, a store where people come in to buy, sell or repair a phone, got courier shipping it
// does not do. Now the flow follows how the business hands things over:
//   in_store            the customer comes in: stock, price, address and hours, the visit is noted
//   courier / delivery  an order with delivery stages the owner (and the agent) can see
// Every fact said by the agent comes from the catalogue, the sheet's verified sentences or the
// owner's own terms. A stage name, a courier, an address: only when the site states it.

import { formatHours } from './business-sheet.mjs'
import { ackPrice, OBJECTION_MIN_RSD, hesitation } from './sales-playbook.mjs'

export const DELIVERY_STAGES = {
  courier: ['Obrađuje se', 'Poslato', 'Dostavljeno'],
  delivery: ['U pripremi', 'Zakazana dostava', 'Isporučeno'],
}
const HOUR = 60

/** Delivery stage of an order of this age (minutes). Orders only; a visit has no stage. */
export function stageFor(status, minAgo, fulfilment) {
  const steps = DELIVERY_STAGES[fulfilment]
  if (!steps) return null
  if (status === 'Isporučeno') return steps[2]
  if (status !== 'Naručio') return null
  return minAgo < 36 * HOUR ? steps[0] : minAgo < 5 * 24 * HOUR ? steps[1] : steps[2]
}

const rsd = (n) => `${Math.round(n).toLocaleString('de-DE')} RSD`
const lower = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s)
const stop = (s) => (/[.!?…]$/.test(s) ? s : `${s}.`)
const ASK_TEAM = 'To potvrđuje naš tim. Prosleđujem pitanje, pa ćete dobiti tačan odgovor.'
/** "2 godine garancije" already says what it is; "5 godina na krunice" needs the word. */
export const guaranteeLine = (g) => (/garanc/i.test(g) ? `Uz to dobijate ${lower(String(g).replace(/[.]$/, ''))}.` : `Uz to dobijate i garanciju: ${lower(String(g).replace(/[.]$/, ''))}.`)
const termsAnswer = (t, field, fallback) => (t?.[field] ? stop(String(t[field]).charAt(0).toUpperCase() + String(t[field]).slice(1)) : fallback)

/** Products the catalogue really lists with a price (services and summary rows have none). */
export function pricedProducts(catalog) {
  return (catalog || []).filter((c) => c.name && c.price_min > 0)
}

/** A believable hero item: mid-priced, photographed, from the biggest product category. */
export function pickHeroItem(catalog) {
  const items = pricedProducts(catalog)
  if (!items.length) return null
  const byCat = {}
  for (const c of items) (byCat[c.category || ''] ||= []).push(c)
  const biggest = Object.values(byCat).sort((a, b) => b.length - a.length)[0]
  const pool = biggest.filter((c) => c.image_url).length >= 3 ? biggest.filter((c) => c.image_url) : biggest
  const sorted = [...pool].sort((a, b) => a.price_min - b.price_min)
  return sorted[Math.floor(sorted.length / 2)]
}

/** "Radnja je u Jurija Gagarina 151a, Novi Beograd, radno vreme pon–pet 10–20h, sub 10–15h." */
export function whereLine(sheet) {
  const loc = sheet?.location
  if (!loc?.address) return null
  const hours = formatHours(loc.hours || [])
  return `Radnja je u ${loc.address}${hours ? `, radno vreme ${hours}` : ''}.`
}

const offerReply = (sheet, kind) => sheet?.offers?.find((o) => o.kind === kind && o.reply)?.reply || null

/**
 * The hero for a store people come into. Asks about a listed item, says it is expensive, gets the
 * business's own answer to that, and announces a visit. The visit is what the agent can record.
 */
export function storeStory({ catalog, sheet, strategy, opening = null }) {
  const item = opening?.item?.price_min > 0 ? opening.item : pickHeroItem(catalog)
  if (!item) return null
  const name = item.name
  const cond = item.description && item.description.length < 60 ? lower(item.description) : null
  const priceReply = strategy?.worries?.find((w) => w.id === 'price')?.agent_reply || null
  const where = whereLine(sheet)
  const noBooking = sheet?.booking?.state === 'none'
  // a real opening is used only when it asks about a product this story can answer
  const first = opening?.source !== 'fallback' && opening?.text && opening?.item?.price_min > 0
    ? ['user', opening.text, opening.kind === 'post_reply' ? { type: 'post_reply', image_url: opening.post?.image || null } : undefined].filter(Boolean)
    : item.image_url ? ['user', 'Da li je ovaj još na stanju?', { image_url: item.image_url, type: 'image' }] : ['user', `Da li je ${name} još na stanju?`]
  // "skupo" is staged only when the shop has an answer to it (see OBJECTION_MIN_RSD)
  const objects = !!priceReply && item.price_min >= OBJECTION_MIN_RSD
  const visit = `${where ? ` ${where}` : ''}${noBooking ? ' Zakazivanje nije potrebno.' : ''}`.trim()
  const msgs = [
    first,
    ['assistant', `Zdravo, Stefane 😊 Jeste, ${name} je na stanju${cond ? `: ${cond}` : ''}. Cena je ${rsd(item.price_min)}.`],
    ...(objects
      ? [['user', hesitation(item.name)], ['assistant', `${ackPrice(item.price_min)} ${stop(priceReply)}`.trim()], ...(visit ? [['assistant', visit]] : [])]
      : [['user', 'Gde se nalazite?'], ['assistant', visit || 'Adresu i radno vreme Vam šaljem odmah.']]),
    ['user', 'Super, svraćam danas posle posla.'],
    ['assistant', 'Važi. Vidimo se u radnji.'],
  ]
  return {
    item,
    sale: {
      channel: 'instagram', customer: 'Stefan Ilić', phone: '063 987 6543', msgs,
      crm: {
        full_name: 'Stefan Ilić', telefon: '063 987 6543', kategorija: item.category || 'Proizvodi', proizvod: name,
        status: 'Naručio',
        razlog: objects ? 'Rekao da je skupo — agent je odgovorio uslovima radnje; najavio dolazak danas.' : `Pitao da li je „${name}“ na stanju; najavio dolazak danas.`,
        komentar: 'Dolazi danas posle posla', izvor: 'Instagram',
      },
      appt: null,
    },
  }
}

/** What customers of THIS shop ask. Size questions only for clothes; delivery only if it ships. */
export function productQAFor({ terms: t, niche, catalog, sheet, fulfilment }) {
  const items = pricedProducts(catalog).slice(0, 40)
  const pick = (i) => items[(i * 7) % items.length]
  const qa = []
  for (let i = 0; i < Math.min(4, items.length); i++) {
    const it = pick(i)
    const cond = it.description && it.description.length < 60 ? `: ${lower(it.description)}` : ''
    qa.push([`Da li je ${it.name} još na stanju?`, `Jeste, na stanju je${cond}. Cena je ${rsd(it.price_min)}.`])
  }
  qa.push(['Kako može da se plati?', termsAnswer(t, 'payment_methods', ASK_TEAM)])
  qa.push(['Da li postoji garancija?', t?.guarantee ? `Postoji. ${guaranteeLine(t.guarantee).replace(/^Uz to dobijate /, 'Dobijate ')}` : ASK_TEAM])
  if (fulfilment === 'courier' || fulfilment === 'delivery') {
    qa.push(['Koliko košta dostava?', termsAnswer(t, 'delivery', 'Cenu dostave potvrđujemo prema Vašoj adresi. Iz kog ste grada?')])
    qa.push(['Može li zamena ako ne odgovara?', termsAnswer(t, 'returns', ASK_TEAM)])
  }
  if (fulfilment === 'in_store') {
    const where = whereLine(sheet)
    if (where) qa.push(['Gde se nalazite?', where])
    if (sheet?.booking?.state === 'none') qa.push(['Da li treba da zakažem?', `Ne treba. ${where ? where.replace(/^Radnja je u/, 'Dođite u radnju u') : 'Dođite u toku radnog vremena.'}`])
    for (const o of sheet?.offers || []) if (o.reply && o.kind !== 'product') qa.push([`Kako ide ${lower(o.name)}?`, o.reply])
    const trade = (sheet?.offers || []).find((o) => o.kind === 'product' && /zamen/i.test(o.name) && o.reply)
    if (trade) qa.push(['Mogu li da dam stari telefon u zamenu?', trade.reply])
  }
  if (String(niche).toLowerCase() === 'fashion') qa.push(['Ima li ovo u veličini M?', 'Proveravam koje veličine su na stanju. Šaljem Vam odmah.'])
  if (['fashion', 'furniture'].includes(String(niche).toLowerCase())) qa.push(['Imate li ovo u drugoj boji?', 'Proveravam koje boje su na stanju. Koja Vas zanima?'])
  return qa
}

/** "Where is my order?" — answered from the order's own stage. Never a made-up tracking number. */
/** @param {{fulfilment: string, couriers?: string[]}} o */
export function trackingQA({ fulfilment, couriers = [] }) {
  if (fulfilment === 'courier') return ['Gde je moja porudžbina?', `Proverila sam: Vaša porudžbina je poslata${couriers[0] ? ` (${couriers[0]})` : ''}.`, 'Poslato']
  if (fulfilment === 'delivery') return ['Gde je moja porudžbina?', 'Proverila sam: dostava Vaše porudžbine je zakazana.', 'Zakazana dostava']
  return null
}

/** Authored threads for the last day of a store people come into, built from its own offers. */
export function bgStoreConvos({ terms, niche, catalog, sheet }) {
  const qa = productQAFor({ terms, niche, catalog, sheet, fulfilment: 'in_store' })
  const names = ['Ana Kovačević', 'Petar Nikolić', 'Jovana Ilić', 'Marko Savić', 'Tamara Đorđević', 'Luka Pavlović', 'Milica Jovanović', 'Nemanja Ristić', 'Sara Marković', 'Filip Stojanović', 'Katarina Lukić', 'Stefan Petrović']
  const ch = ['instagram', 'whatsapp', 'facebook', 'instagram', 'instagram', 'whatsapp', 'instagram', 'facebook', 'whatsapp', 'instagram', 'instagram', 'facebook']
  const st = ['Novi', 'Naručio', 'Zainteresovan', 'Naručio', 'Isporučeno', 'Novi', 'Naručio', 'Zainteresovan', 'Isporučeno', 'Naručio', 'Zainteresovan', 'Naručio']
  return names.map((name, i) => {
    const [q, a] = qa[(i * 5) % qa.length]
    const msgs = [['user', q], ['assistant', a]]
    if (st[i] === 'Naručio') msgs.push(['user', 'Važi, svraćam sutra.'], ['assistant', 'Vidimo se u radnji 👍'])
    if (st[i] === 'Isporučeno') msgs.push(['user', 'Hvala, bio sam juče, sve je super.'], ['assistant', 'Drago nam je, hvala Vam 🙏'])
    if (st[i] === 'Zainteresovan') msgs.push(['user', 'Razmisliću.'], ['assistant', 'Važi, tu sam ako Vas još nešto zanima.'])
    return { name, ch: ch[i], st: st[i], msgs }
  })
}

/**
 * The hero for a shop that ships: asks about a listed item (by photo when there is one), says it is
 * expensive, gets the business's own answer, orders. No stock-out, no cheaper "alternative", no
 * delivery promise the shop has not made: only its stated delivery terms.
 */
export function orderStory({ catalog, terms, strategy, fulfilment, opening = null }) {
  const item = opening?.item?.price_min > 0 ? opening.item : pickHeroItem(catalog)
  if (!item) return null
  const t = terms || {}
  // the business's own answer; else its stated guarantee; else a comparison from its own catalogue
  // the business's own answer, else its stated guarantee. "Here are other models" is not an
  // answer to "skupo" — it is a downsell, so without either the beat is not staged at all
  const priceReply = strategy?.worries?.find((w) => w.id === 'price')?.agent_reply
    || (t.guarantee ? guaranteeLine(t.guarantee) : '')
  const objects = !!priceReply && item.price_min >= OBJECTION_MIN_RSD
  const fromCustomer = opening?.source !== 'fallback' && opening?.text && opening?.item?.price_min > 0
  // a site heading ("BRZA ISPORUKE") is not a sentence the agent can repeat: only a real one
  const delivery = t.delivery && String(t.delivery).trim().split(/\s+/).length >= 4 ? ` ${stop(String(t.delivery).charAt(0).toUpperCase() + String(t.delivery).slice(1))}` : ''
  const stage = DELIVERY_STAGES[fulfilment]?.[0] || 'Obrađuje se'
  const msgs = [
    // the name stays in the nominative: "Imate li Ugaona garnitura…" is not Serbian
    fromCustomer
      ? ['user', opening.text, opening.kind === 'post_reply' ? { type: 'post_reply', image_url: opening.post?.image || null } : undefined].filter(Boolean)
      : item.image_url ? ['user', 'Imate li ovo?', { image_url: item.image_url, type: 'image' }] : ['user', `Zanima me ${item.name}. Da li je još u ponudi?`],
    // answer what was asked: a photo gets the name, "još u ponudi?" gets a yes
    ['assistant', `Zdravo, Stefane 😊 ${fromCustomer ? `${item.name}, cena je` : item.image_url ? `To je ${item.name}, cena je` : 'Jeste, u ponudi je. Cena je'} ${rsd(item.price_min)}.`],
    ...(objects ? [['user', hesitation(item.name)], ['assistant', `${ackPrice(item.price_min)} ${stop(priceReply)}`.trim()], ['user', 'Dobro, naručujem.']] : [['user', 'Može, naručujem.']]),
    ['assistant', 'Važi. Pošaljite mi ime, broj telefona i adresu za dostavu.'],
    ['user', 'Stefan Ilić, 063 987 6543, Kralja Petra 12, Novi Sad'],
    ['assistant', `Hvala, porudžbina je upisana.${delivery}`],
  ]
  const byImage = !fromCustomer && !!item.image_url
  return {
    item,
    sale: {
      channel: 'instagram', customer: 'Stefan Ilić', phone: '063 987 6543', msgs,
      crm: {
        full_name: 'Stefan Ilić', telefon: '063 987 6543', kategorija: item.category || 'Proizvodi', proizvod: item.name,
        status: 'Naručio', status_porudzbine: stage,
        razlog: objects ? 'Rekao da je skupo — agent je odgovorio uslovima prodavnice i primio porudžbinu.' : `Pitao da li je „${item.name}“ u ponudi i naručio.`,
        komentar: 'Adresa: Kralja Petra 12, Novi Sad', izvor: 'Instagram',
      },
      appt: null,
    },
  }
}

/** Authored threads for the last day of a shop that ships, from its catalogue and its own terms. */
export function bgShopConvos({ terms, niche, catalog, sheet, fulfilment }) {
  const qa = productQAFor({ terms, niche, catalog, sheet, fulfilment })
  const track = trackingQA({ fulfilment, couriers: sheet?.shipping?.couriers || [] })
  const names = ['Ivana Petrović', 'Dragan Tomić', 'Jelena Marinović', 'Vesna Đorđević', 'Miloš Jovanović', 'Tijana Kostić', 'Bojan Lukić', 'Marija Stanković', 'Aleksandar Mitić', 'Sofija Ilić', 'Vuk Pavlović', 'Nina Ristić']
  const ch = ['instagram', 'facebook', 'instagram', 'whatsapp', 'instagram', 'website', 'facebook', 'whatsapp', 'instagram', 'website', 'facebook', 'instagram']
  const st = ['Naručio', 'Novi', 'Zainteresovan', 'Naručio', 'Isporučeno', 'Naručio', 'Zainteresovan', 'Naručio', 'Novi', 'Isporučeno', 'Zainteresovan', 'Naručio']
  return names.map((name, i) => {
    if (track && i === 3) return { name, ch: ch[i], st: 'Naručio', stage: track[2], msgs: [['user', track[0]], ['assistant', track[1]]] }
    const [q, a] = qa[(i * 5) % qa.length]
    const msgs = [['user', q], ['assistant', a]]
    if (st[i] === 'Naručio') msgs.push(['user', 'Naručujem.'], ['assistant', 'Pošaljite mi ime, broj telefona i adresu za dostavu.'], ['user', 'Poslao sam u poruci.'], ['assistant', 'Hvala, porudžbina je primljena ✅'])
    if (st[i] === 'Isporučeno') msgs.push(['user', 'Stiglo je, hvala!'], ['assistant', 'Drago nam je, hvala na poverenju 🙏'])
    if (st[i] === 'Zainteresovan') msgs.push(['user', 'Razmisliću.'], ['assistant', 'Važi, tu sam ako Vas još nešto zanima.'])
    return { name, ch: ch[i], st: st[i], msgs }
  })
}
