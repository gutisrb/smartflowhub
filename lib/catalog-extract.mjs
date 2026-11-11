// Read the products a site LISTS: any page whose HTML repeats a card with a heading and a price.
//
// Written 2026-10-26: JetSet (used and new phones, repair, buyback) had a catalogue of repair
// services only, because the scrape followed "servis" and "cenovnik" pages and never the
// /prodaja-… pages where ~60 phones are listed with model, condition and price. A shop's demo
// without its products is not its demo. This finds repeated product cards structurally (no
// per-site selectors), so it works for WooCommerce, hand-built cards and most themes alike.

import { parseDocument } from 'htmlparser2'

// "1.990,00 RSD" (Serbian), "57,300.00 RSD" (WooCommerce default), "130 €", "€ 130", "od 25.000 din"
const PRICE_ONLY = /^\s*(?:od\s+)?(?:(€|eur|rsd|din)\s*)?(\d[\d.,\s\u00a0]*\d|\d)\s*(€|eur|evra|rsd|din|dinara)?\.?\s*$/i
/** "57,300.00" and "57.300,00" and "130" all mean what they say. */
function toNumber(token) {
  const t = token.replace(/[\s\u00a0]/g, '')
  const m = t.match(/^(.*?)([.,])(\d{1,2})$/) // a trailing separator + 1-2 digits is the decimal part
  const whole = (m ? m[1] : t).replace(/[.,]/g, '')
  return parseFloat(m ? `${whole}.${m[3]}` : whole)
}
const HEADING = new Set(['h1', 'h2', 'h3', 'h4', 'h5'])

const textOf = (n) => (n.type === 'text' ? n.data : (n.children || []).map(textOf).join(' ')).replace(/[\s\u00a0]+/g, ' ').trim()
const kids = (n) => (n.children || []).filter((c) => c.type === 'tag')
function* walk(n) { yield n; for (const c of n.children || []) yield* walk(c) }

export function parsePrice(raw) {
  const m = String(raw).match(PRICE_ONLY)
  const cur = m && (m[1] || m[3])
  if (!m || !cur) return null // a bare number is not a price
  const value = toNumber(m[2])
  const eur = /€|eur|evra/i.test(cur)
  return { value, currency: eur ? 'EUR' : 'RSD', rsd: Math.round(eur ? value * 117 : value), from: /^\s*od\s/i.test(String(raw)) }
}

/** price elements under a node, counted as minimal matches */
function countPrices(root) {
  return [...walk(root)].filter((x) => x.type === 'tag' && parsePrice(textOf(x)) && !kids(x).some((k) => parsePrice(textOf(k)))).length
}

const signature = (el) => `${el.name}.${(el.attribs?.class || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.')}`

/**
 * @param {string} html
 * @param {string} baseUrl  used to absolutise image URLs
 * @returns {{name:string, specs:string[], condition:string|null, price:{value:number,currency:string,rsd:number}, image:string|null}[]}
 */
export function extractListings(html, baseUrl = '') {
  const doc = parseDocument(html)
  const parentOf = new Map()
  for (const n of walk(doc)) for (const c of n.children || []) parentOf.set(c, n)

  const cards = new Map() // card element -> price node
  for (const n of walk(doc)) {
    if (n.type !== 'tag') continue
    const price = parsePrice(textOf(n))
    // the minimal element that is a price (WooCommerce nests <bdi><span>1.990,00</span> RSD</bdi>)
    if (!price || kids(n).some((k) => parsePrice(textOf(k)))) continue
    let up = n
    for (let i = 0; i < 6 && parentOf.get(up); i++) {
      up = parentOf.get(up)
      if (up.type !== 'tag') break
      const prices = countPrices(up)
      if (prices > 1) break // climbed into the list
      if ([...walk(up)].some((x) => x.type === 'tag' && HEADING.has(x.name) && textOf(x))) {
        // grow to the outermost wrapper that still holds exactly this one price: that is the card
        // (the image usually sits beside the text block, not inside it)
        let card = up
        for (let j = 0; j < 3 && parentOf.get(card)?.type === 'tag'; j++) {
          const p = parentOf.get(card)
          const count = countPrices(p)
          if (count !== 1) break
          card = p
        }
        cards.set(card, n)
        break
      }
    }
  }

  // a real product list repeats: group by structural signature and keep the biggest group(s)
  const groups = new Map()
  for (const el of cards.keys()) { const s = signature(el); groups.set(s, [...(groups.get(s) || []), el]) }
  const real = [...groups.values()].filter((g) => g.length >= 4)

  const abs = (u) => { try { return u ? new URL(u, baseUrl || undefined).href : null } catch { return null } }
  const out = []
  for (const group of real) for (const card of group) {
    const priceNode = cards.get(card)
    const price = parsePrice(textOf(priceNode))
    const heading = [...walk(card)].find((x) => x.type === 'tag' && HEADING.has(x.name) && textOf(x))
    const name = textOf(heading)
    const img = [...walk(card)].find((x) => x.type === 'tag' && x.name === 'img')
    const specs = [...walk(card)].filter((x) => x.type === 'tag' && x.name === 'li').map(textOf).filter(Boolean)
    const small = [...walk(card)].filter((x) => x.type === 'tag' && x.name === 'p').map(textOf).filter((t) => t && t.length < 90)
    if (!name || name.length > 120) continue
    out.push({
      name, specs, price,
      condition: small.find((t) => /novo|polovan|top stanje|kao nov|odlično|dobro|neotpakovan/i.test(t)) || null,
      image: abs(img?.attribs?.src || img?.attribs?.['data-src']),
    })
  }
  return out
}
