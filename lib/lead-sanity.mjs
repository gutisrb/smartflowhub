// The common-sense check a lead must pass before Nikola is asked about it (2026-11-14, after Dexy Co, an Albanian-language clinic and a
// Bosnian used-appliance shop reached his shortlist: "WHERE IS YOUR RATIONALITY / CRITICAL THINKING CHECK?").
//
//   market  Is this a Serbian business? (website domain, place names, language, phone prefix)
//   chain   Is it one shop / one clinic, or a chain with many locations? "Nobody DMs Walmart to buy toys."
//
// Both return ok / review / fail and a reason. Unknown is never ok: a lead we cannot place goes to review with the reason shown.
import { normalize } from './lead-queue.mjs'

const FOREIGN_TLD = /\.(ba|hr|si|me|mk|al|xk|bg|ro|hu|at|de|ch|uk|us|tr|gr)$/
const FOREIGN_PLACES = /\b(laktasi|banja ?luka|banjaluka|sarajevo|mostar|tuzla|zenica|bijeljina|doboj|prijedor|trebinje|kotor varos|brcko|zagreb|rijeka|osijek|ljubljana|maribor|podgorica|budva|herceg novi|skopje|tetovo|bitola|pristina|prishtina|tirana|durres|sofia|bucuresti|wien|vienna|berlin|munchen)\b/
const ALBANIAN = /\b(dhe|mbjellje|flokesh|shtepia|dyqan|porosi|sherbim|shqip\w*|kosove|klinike elitare|specializuar|trajtim)\b/
const FOREIGN_PHONE = /\+\s?(387|385|386|382|389|383|355|359)\s?\d/
const SERBIAN_PLACES = /\b(beograd|novi beograd|zemun|novi sad|nis|kragujevac|subotica|cacak|kraljevo|valjevo|sabac|pancevo|zrenjanin|krusevac|leskovac|smederevo|uzice|vranje|kikinda|sombor|jagodina|pozarevac|loznica|sremska mitrovica|vrsac|obrenovac|srbija|serbia)\b/
const SERBIAN_PHONE = /(\+\s?381|\b0(6[0-9]|1[1-9]|2[1-3]|3[0-5]|4[0-9])[ /-]?\d{3})/

const host = (w) => { try { return new URL(String(w).startsWith('http') ? w : `https://${w}`).hostname.replace(/^www\./, '') } catch { return '' } }

/** @returns {{ verdict: 'ok'|'review'|'fail', reason: string }} */
export function marketCheck({ name = '', bio = '', website = '', siteText = '' } = {}) {
  const h = host(website)
  const text = normalize(`${name} ${bio} ${siteText.slice(0, 4000)}`)
  const foreign = []
  if (FOREIGN_TLD.test(h)) foreign.push(`domain ${h}`)
  const place = text.match(FOREIGN_PLACES)?.[0]; if (place) foreign.push(`place "${place}"`)
  const alb = normalize(`${name} ${bio}`).match(ALBANIAN)?.[0]; if (alb) foreign.push(`Albanian text ("${alb}")`)
  if (FOREIGN_PHONE.test(`${bio} ${siteText.slice(0, 4000)}`)) foreign.push('foreign phone prefix')
  const serbian = /\.rs$/.test(h) || SERBIAN_PLACES.test(text) || SERBIAN_PHONE.test(`${bio} ${siteText.slice(0, 4000)}`)
  if (foreign.length && !serbian) return { verdict: 'fail', reason: `outside Serbia: ${foreign.join(', ')}` }
  if (foreign.length) return { verdict: 'review', reason: `mixed signals (${foreign.join(', ')}) but also Serbian ones: confirm the market` }
  if (!serbian) return { verdict: 'review', reason: 'no Serbian signal found (no .rs domain, city or phone): confirm the market' }
  return { verdict: 'ok', reason: 'Serbian' }
}

/** A personal or hub account lists several other accounts it runs ("CONCIERGE: @a / REAL ESTATE: @b / EVENT: @c"): one person with many ventures, not one business. */
export function hubAccount(bio = '') {
  const labeled = [...String(bio).matchAll(/[A-Za-zČĆŠĐŽčćšđž ]{3,24}:\s*@[\w.]{3,}/g)].length
  const mentions = new Set([...String(bio).matchAll(/@([\w.]{3,})/g)].map((m) => m[1].toLowerCase())).size
  if (labeled >= 2 || mentions >= 3) return { hub: true, reason: `personal / hub account: its bio lists ${mentions} other accounts` }
  return { hub: false, reason: '' }
}

const REMOTE = /dostav\w*|isporuk\w*|slanj\w*|postarin\w*|kurir\w*|korpa|naruc\w*|poruc\w*|porudzbin\w*|online|webshop|e-?shop|zakaz\w*|rezerv\w*|upit\w*|termin\w*|konsultac\w*|procen\w*|ponud\w*|cenovnik/g
/** Can customers buy or ask remotely? (2026-11-15, Nikola on Plus Exclusive: "do they even sell through social media? what is the point if they are purely a physical store?")
 *  Looks for delivery / cart / order / booking / quote words on the business's OWN site. Two or more kinds of evidence = ok. Never a proof of a walk-in store, only a warning. */
export function remoteSalesCheck(siteText = '') {
  const hits = [...new Set(normalize(siteText).match(REMOTE) || [])]
  return { ok: hits.length >= 2, evidence: hits.slice(0, 6) }
}

const STORE_WORD = '(?:prodavnic\\w*|radnj\\w*|lokacij\\w*|salon\\w*|objekat\\w*|objekt\\w*|butik\\w*|poslovnic\\w*|filijal\\w*|marketa?|stores?|shops?)'
export const CHAIN_BIO = new RegExp(`\\b(\\d{1,3})\\+?\\s*${STORE_WORD}\\b`)
const CITIES = 'beograd|novi beograd|zemun|novi sad|nis|kragujevac|subotica|cacak|kraljevo|valjevo|sabac|pancevo|zrenjanin|krusevac|leskovac|smederevo|uzice|vranje|kikinda|sombor|jagodina|pozarevac|loznica|sremska mitrovica|vrsac|obrenovac|vrnjacka banja|ruma|indjija|sid|bor|zajecar|pirot|prokuplje|aleksinac|paracin|ub|lazarevac|mladenovac|sopot|barajevo|grocka|surcin'
const ADDRESS = new RegExp(`\\b([a-z]{3,}(?: [a-z.]{2,}){0,3}) (\\d{1,3}[a-z]?)\\b[ ,.\\-–]+(?:\\d{5} )?(${CITIES})\\b`, 'g')

/** Distinct street-address + city pairs in the text of a business's own site. */
export function countAddresses(siteText = '') {
  const seen = new Set()
  for (const m of normalize(siteText).matchAll(ADDRESS)) seen.add(`${m[1].split(' ').slice(-2).join(' ')} ${m[2]} ${m[3]}`)
  return seen.size
}

/**
 * @param {{ name?: string, bio?: string, siteText?: string, followers?: number|null, ads?: number }} [p]
 * @returns {{ verdict: 'ok'|'review'|'fail', reason: string, locations: number|null }}
 */
export function chainCheck({ name = '', bio = '', siteText = '', followers = null, ads = 0 } = {}) {
  const t = normalize(`${name} ${bio}`)
  const stated = t.match(CHAIN_BIO)
  const n = stated ? Number(stated[1]) : 0
  if (/\b(lanac|mreza prodavnica|fransiz\w*|franshiz\w*|franchise|franciza)\b/.test(t)) return { verdict: 'fail', reason: 'chain or franchise wording', locations: n || null }
  if (n >= 8) return { verdict: 'fail', reason: `chain: bio states ${n} ${stated[0].replace(/^\d+\+?\s*/, '')}`, locations: n }
  const storeCities = (t.match(new RegExp(`${STORE_WORD}[^.]{0,40}?((?:\\b(?:${CITIES})\\b[ ,/&i]*){3,})`))?.[1] || '').match(new RegExp(`\\b(?:${CITIES})\\b`, 'g')) || []
  if (new Set(storeCities).size >= 3) return { verdict: 'fail', reason: `chain: bio names stores in ${new Set(storeCities).size} cities`, locations: new Set(storeCities).size }
  const found = countAddresses(siteText)
  if (found >= 8) return { verdict: 'fail', reason: `chain: ${found} different store addresses on its own site`, locations: found }
  const locations = Math.max(n, found)
  if (followers >= 150000 && ads >= 8) return { verdict: 'fail', reason: `national-scale advertiser (${Math.round(followers / 1000)}k followers, ${ads} live ads): has its own marketing and support team`, locations: locations || null }
  if (locations >= 4) return { verdict: 'review', reason: `multi-location business (${locations} locations): confirm it is not a chain`, locations }
  if (!siteText) return { verdict: 'review', reason: 'own site could not be read: store count unknown', locations: null }
  return { verdict: 'ok', reason: locations ? `${locations} location(s)` : 'single location', locations }
}

/** Reads a lead's own site (home page + up to 3 location/contact pages) as plain text. Free: no credits, no browser. */
export async function fetchSiteText(website, { timeoutMs = 9000 } = {}) {
  if (!website) return ''
  const base = String(website).startsWith('http') ? website : `https://${website}`
  const ua = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', 'accept-language': 'sr,en;q=0.8' }
  const get = async (url) => {
    try { const r = await fetch(url, { headers: ua, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) }); return r.ok ? (await r.text()).slice(0, 400000) : '' } catch { return '' }
  }
  const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ')
  const home = await get(base)
  const hostName = host(base)
  const links = [...new Set([...home.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]))]
    .filter((l) => /prodavnic|lokacij|gde-smo|gdje|kontakt|contact|o-nama|radnj|poslovnic|stores|locations|salon/i.test(l))
    .map((l) => { try { return new URL(l, base).href } catch { return '' } })
    .filter((l) => l && host(l) === hostName).slice(0, 3)
  const guesses = ['/prodavnice', '/lokacije', '/gde-smo', '/kontakt', '/stores', '/prodajna-mesta', '/o-nama'].map((p) => new URL(p, base).href)
  const pages = await Promise.all([...new Set([...links, ...guesses])].slice(0, 7).map(get))
  return [home, ...pages].map(strip).join(' ')
}
