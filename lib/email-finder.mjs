/**
 * lib/email-finder.mjs — ONE place that finds a business's sendable e-mail, cheapest layer first.
 * (Nikola, 2026-11-11: "use hunter.io, use firecrawl on their website… find it by any means and adapt
 * your approach to find it easier systematically next time". Before this, a lead without an address was
 * parked after one regex pass over the home page; SLW Container had its address in its own Instagram bio.)
 *
 * Layers, in order. Each stops the search as soon as it yields an acceptable address:
 *   0 stored    every text we already hold for the lead (bio, ad copy, captions, enrichment, column)  — free
 *   1 site      the site's home + contact-like pages found by LINK, with mailto:, Cloudflare data-cfemail,
 *               "[at]" obfuscation and JSON-LD decoded                                                — free
 *   2 firecrawl the same pages rendered by Firecrawl (JS sites), plus /map?search=kontakt             — Firecrawl credits
 *   3 facebook  the Facebook page's About, rendered by Firecrawl                                      — Firecrawl credits
 *   4 search    Google (Apify) for "@domain" and "<name> kontakt email"                               — ~$0.0001
 *   5 hunter    domain-search, only for a real own domain, only when everything above failed          — 1 Hunter credit
 * Never guesses an address: a guess (info@domain) is accepted only when Hunter verifies it as "valid".
 *
 * Every result carries { email, source, evidence } so a human can see where an address came from.
 */

const MAILBOX = /^(gmail|googlemail|yahoo|hotmail|outlook|live|msn|icloud|mail|ptt|eunet|sbb|open|orion)\./i
const JUNK_LOCAL_EXACT = /^(youremail|your-email|name|ime|email|mail|user|username|test|someone|john|jane|example|sample)$/
const JUNK_LOCAL = /^(noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|webmaster|abuse|privacy|dpo|wordpress|admin@wordpress)/i
const JUNK_DOMAIN = /(sentry|wixpress|example\.|domain\.com|website\.com|yoursite|yourcompany|yourdomain|mysite\.|company\.com|email\.com$|test\.com$|schema\.org|w3\.org|googleusercontent|gstatic|cloudflare|godaddy|wordpress\.|squarespace|shopify|mailchimp|facebook\.com|instagram\.com|fbcdn|gravatar|jquery|bootstrap|fontawesome|polyfill)/i
const ASSET_TAIL = /\.(png|jpe?g|webp|svg|gif|css|js|woff2?|ico|pdf|mp4)$/i
const CONTACT_LINK = /kontakt|contact|o-nama|onama|about|impressum|privacy|privatnost|uslovi|terms|politika|pravila|reklamac|dostava|lokacij|pozovite|javite|ponuda|upit/i
const CONTACT_PATHS = ['', '/kontakt', '/contact', '/kontakt/', '/contact-us', '/kontaktirajte-nas', '/o-nama', '/about', '/uslovi-koriscenja', '/politika-privatnosti']
const NOT_A_SITE = /(^|\.)(facebook|instagram|kupujemprodajem|linktr\.ee|linktree|wa\.me|whatsapp|youtube|tiktok|olx|halooglasi|4zida|nekretnine|google|goo\.gl|bit\.ly|beacons|taplink|lnk\.bio|canva)\b/i

export const hostOf = (site) => {
  try { return new URL(/^https?:/.test(site) ? site : `https://${site}`).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' }
}
/** A domain that belongs to the business itself (not a social page, marketplace or link-in-bio). */
export const ownDomain = (site) => { const h = hostOf(site || ''); return h && !NOT_A_SITE.test(h) ? h : null }

/** Cloudflare "email protection": data-cfemail="hex" — first byte is the XOR key. */
export function decodeCfEmail(hex) {
  try {
    const key = parseInt(hex.slice(0, 2), 16)
    let out = ''
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key)
    return out
  } catch { return '' }
}

/** Every e-mail address in a piece of text/HTML, including the common obfuscations. Order of first appearance. */
export function extractEmails(raw) {
  if (!raw) return []
  let t = String(raw)
  t = t.replace(/data-cfemail="([0-9a-f]+)"/gi, (_, h) => ` ${decodeCfEmail(h)} `)
  t = t.replace(/%40/gi, '@').replace(/&#0?64;|&commat;|&#x40;/gi, '@').replace(/&#0?46;|&#x2e;/gi, '.')
  t = t.replace(/\s*[\[\(\{]\s*(at|et|@)\s*[\]\)\}]\s*/gi, '@').replace(/\s*[\[\(\{]\s*(dot|tacka|tačka)\s*[\]\)\}]\s*/gi, '.')
  const out = []
  for (const m of t.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) {
    const e = m[0].replace(/^[._%+-]+/, '').replace(/[.,;:]+$/, '').toLowerCase()
    const [local, domain] = e.split('@')
    if (!local || !domain || local.length < 3 || !/[a-z]/.test(local) || ASSET_TAIL.test(e) || JUNK_LOCAL.test(local) || JUNK_LOCAL_EXACT.test(local) || JUNK_DOMAIN.test(domain) || local.length > 48) continue
    if (!out.includes(e)) out.push(e)
  }
  return out
}

/** Which of the found addresses to send to: the business's own domain first, then a mailbox it publishes itself. */
export function pickBest(emails, domain) {
  const own = domain ? emails.filter((e) => e.endsWith('@' + domain) || e.split('@')[1].endsWith('.' + domain)) : []
  const rank = (e) => { const l = e.split('@')[0]; return /^(info|office|kontakt|contact|hello|zdravo)/.test(l) ? 0 : /^(prodaja|sales|ordinacija|reception|marketing|ponuda|upit)/.test(l) ? 1 : 2 }
  if (own.length) return own.sort((a, b) => rank(a) - rank(b))[0]
  const box = emails.filter((e) => MAILBOX.test(e.split('@')[1]))
  if (box.length) return box[0]
  // another business domain written on the lead's OWN pages (e.g. SLW's bio: slw@s-logistic.rs, the parent company) is the owner's own address
  return emails[0] || null
}

async function getText(url, ms = 12000) {
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(ms), headers: { 'user-agent': 'Mozilla/5.0 (compatible; SmartflowBot/1.0)', 'accept-language': 'sr,en;q=0.8' } })
    if (!r.ok) return ''
    return await r.text()
  } catch { return '' }
}

function contactLinks(html, base) {
  const out = new Set()
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    const href = m[1]
    if (!CONTACT_LINK.test(href) || /^(mailto|tel|javascript):/i.test(href)) continue
    try { const u = new URL(href, base); if (hostOf(u.href) === hostOf(base) && !ASSET_TAIL.test(u.pathname)) out.add(u.href.split('?')[0]) } catch { /* skip */ }
  }
  return [...out].slice(0, 6)
}

const flatten = (v, out = []) => { if (v == null) return out; if (typeof v === 'string') out.push(v); else if (typeof v === 'object') for (const x of Object.values(v)) flatten(x, out); return out }

// ── layers ─────────────────────────────────────────────────────────────────────────────────────

/** 0: everything already stored for the lead. */
export function fromStored(lead) {
  const texts = [lead.email, ...flatten(lead.intake_data)].filter(Boolean)
  const found = extractEmails(texts.join('\n'))
  return { emails: found, evidence: 'stored lead data (bio / ad copy / captions / enrichment)' }
}

/** 1: the site's own pages, found by link as well as by guessing the path. */
export async function fromSite(website) {
  const dom = ownDomain(website)
  if (!dom) return { emails: [], evidence: null, pages: [] }
  const base = /^https?:/.test(website) ? website : `https://${website}`
  const origin = new URL(base).origin
  const seen = new Set(), pages = []
  const emails = []
  const visit = async (u) => {
    if (seen.has(u) || seen.size >= 10) return ''
    seen.add(u)
    const html = await getText(u)
    if (!html) return ''
    pages.push(u)
    for (const e of extractEmails(html)) if (!emails.includes(e)) emails.push(e)
    return html
  }
  const home = await visit(base)
  for (const p of CONTACT_PATHS.slice(1)) { if (emails.length) break; await visit(origin + p) }
  if (!emails.length) for (const l of contactLinks(home, base)) { if (emails.length) break; await visit(l) }
  return { emails, evidence: emails.length ? `site pages: ${pages.join(' ')}` : null, pages }
}

async function firecrawlScrape(url, key) {
  try {
    const r = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ url, formats: ['markdown', 'rawHtml'], onlyMainContent: false, waitFor: 1500, timeout: 30000 }),
      signal: AbortSignal.timeout(45000),
    })
    if (!r.ok) return ''
    const d = (await r.json())?.data
    return `${d?.markdown || ''}\n${d?.rawHtml || ''}`
  } catch { return '' }
}

/** 2: the same site rendered (JS shops), plus Firecrawl's own map of contact-like URLs. */
export async function fromFirecrawl(website, key) {
  const dom = ownDomain(website)
  if (!dom || !key) return { emails: [], evidence: null }
  const base = /^https?:/.test(website) ? website : `https://${website}`
  const urls = [base]
  try {
    const r = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ url: base, search: 'kontakt contact o nama', limit: 30 }), signal: AbortSignal.timeout(30000),
    })
    if (r.ok) for (const l of (await r.json())?.links || []) if (CONTACT_LINK.test(l) && !urls.includes(l)) urls.push(l)
  } catch { /* fall through to the home page only */ }
  const emails = []
  const used = []
  for (const u of urls.slice(0, 4)) {
    const txt = await firecrawlScrape(u, key)
    used.push(u)
    for (const e of extractEmails(txt)) if (!emails.includes(e)) emails.push(e)
    if (emails.length) break
  }
  return { emails, evidence: emails.length ? `firecrawl: ${used.join(' ')}` : null }
}

/** 3: the Facebook page's About (contact info lives there when the site has none). */
export async function fromFacebook(fbUrl, key) {
  if (!fbUrl || !key) return { emails: [], evidence: null }
  const u = fbUrl.replace(/\/+$/, '')
  const tries = /share\//.test(u) ? [u] : [u + '/about', u]
  for (const t of tries) {
    const txt = await firecrawlScrape(t, key)
    const emails = extractEmails(txt).filter((e) => !/facebook|meta\./i.test(e))
    if (emails.length) return { emails, evidence: `facebook page: ${t}` }
  }
  return { emails: [], evidence: null }
}

/** 4: Google through Apify: pages that publish "@domain", or the business's name next to "kontakt email". */
export async function fromSearch(lead, apifyToken) {
  if (!apifyToken) return { emails: [], evidence: null }
  const dom = ownDomain(lead.website)
  const name = String(lead.company_name || '').replace(/[|·].*$/, '').trim()
  const queries = [dom ? `"@${dom}"` : null, dom ? `"${dom}" kontakt email` : null, name ? `"${name}" kontakt email Srbija` : null].filter(Boolean)
  try {
    const r = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${apifyToken}&maxTotalChargeUsd=0.5&timeout=120`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries: queries.join('\n'), resultsPerPage: 10, maxPagesPerQuery: 1, languageCode: 'sr', countryCode: 'rs' }), signal: AbortSignal.timeout(130000),
    })
    if (!r.ok) return { emails: [], evidence: null }
    const pages = await r.json()
    const blob = flatten(pages.map((p) => p.organicResults || [])).join('\n')
    let emails = extractEmails(blob)
    // only addresses that belong to this business: its own domain, or a result page that is the business's own
    if (dom) emails = emails.filter((e) => e.endsWith('@' + dom) || MAILBOX.test(e.split('@')[1]) && blob.toLowerCase().includes(dom))
    else emails = emails.filter((e) => name && blob.toLowerCase().includes(name.toLowerCase()) && !MAILBOX.test(e.split('@')[1]))
    return { emails, evidence: emails.length ? `google results for ${queries[0]}` : null }
  } catch { return { emails: [], evidence: null } }
}



const MARKETPLACE = /daibau|companywall|kupujem|halo|olx|bizi\.|wikipedia|tripadvisor|booking\.com|etsy|amazon|ebay|aliexpress|threads\.|twitter|x\.com|pinterest|tiktok|purple\.com|walmart|temu|alibaba/i
const REGISTRY = /(^|\.)(companywall|bizi|pks|firmenregister|poslovna|kompanije)\.(rs|com|org)$/i
const slug = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'dj').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const digitsTail = (t) => t.replace(/\D/g, '').slice(-7)

/**
 * Is this web page about THIS business and not another one with a similar name? True when the page carries the lead's own
 * domain, Instagram handle or one of its phone numbers, or it is a company-registry entry whose address names the business.
 */
export function pageIsAbout(lead, url, text) {
  const t = String(text || '').toLowerCase()
  const dom = ownDomain(lead.website)
  if (dom && t.includes(dom)) return true
  const handle = String(lead.instagram_handle || '').toLowerCase()
  if (handle && handle.length > 4 && t.includes(handle)) return true
  const bio = String(lead.intake_data?.enrichment?.instagram_profile?.bio || '')
  const phones = [...bio.matchAll(/\+?\d[\d\s/().-]{7,}\d/g)].map((m) => digitsTail(m[0])).filter((d) => d.length === 7)
  if (phones.length) {
    const onPage = [...t.matchAll(/\+?\d[\d\s/().-]{7,}\d/g)].map((m) => digitsTail(m[0]))
    if (phones.some((p) => onPage.includes(p))) return true
  }
  const host = hostOf(url)
  const nameSlug = slug(lead.company_name)
  return REGISTRY.test(host) && nameSlug.length > 5 && slug(url).includes(nameSlug.split('-').slice(0, 2).join('-'))
}

/** 4b: Firecrawl web search for the business's NAME (businesses with no own site: Facebook-only shops). The page must name the business. */
export async function fromFirecrawlSearch(lead, key) {
  const name = String(lead.company_name || '').replace(/[|·].*$/, '').trim()
  if (!name || !key) return { emails: [], evidence: null }
  const place = String(lead.intake_data?.enrichment?.instagram_profile?.bio || '').match(/📍\s*([^\n,]+)/)?.[1]?.trim() || ''
  const query = `${name} ${place} kontakt email`.replace(/\s+/g, ' ').trim()
  try {
    const r = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, limit: 8, country: 'RS', lang: 'sr', scrapeOptions: { formats: ['markdown'] } }), signal: AbortSignal.timeout(60000),
    })
    if (!r.ok) return { emails: [], evidence: null }
    const hits = (await r.json())?.data || []
    const emails = []
    let from = null
    for (const h of hits) {
      const txt = `${h.title || ''}\n${h.description || ''}\n${h.markdown || ''}`
      if (!pageIsAbout(lead, h.url || '', txt)) continue // a page about another business (2026-11-11: "Montažne hale" matched Stamil's page)
      for (const e of extractEmails(txt)) if (!emails.includes(e)) { emails.push(e); from ||= h.url }
    }
    return { emails, evidence: emails.length ? `firecrawl search "${query}" → ${from}` : null }
  } catch { return { emails: [], evidence: null } }
}

/** Hunter's verifier: false only when the mailbox is known not to exist. */
export async function notInvalid(email, key) {
  if (!key) return true
  try {
    const r = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${key}`, { signal: AbortSignal.timeout(25000) })
    if (!r.ok) return true
    return (await r.json())?.data?.status !== 'invalid'
  } catch { return true }
}

/** 5: Hunter domain-search. One credit per call; only for a real own domain. */
export async function fromHunter(website, key) {
  const dom = ownDomain(website)
  if (!dom || !key) return { emails: [], evidence: null }
  try {
    const r = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(dom)}&limit=10&api_key=${key}`, { signal: AbortSignal.timeout(20000) })
    if (!r.ok) return { emails: [], evidence: `hunter ${r.status}` }
    const list = ((await r.json())?.data?.emails || []).filter((e) => (e.confidence || 0) >= 60).sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    return { emails: list.map((e) => e.value.toLowerCase()), evidence: list.length ? `hunter.io domain-search (${dom}), confidence ${list[0].confidence}` : null }
  } catch { return { emails: [], evidence: null } }
}

/** Last resort: the usual role mailboxes, accepted only if Hunter's verifier says "valid" (never a guess). */
export async function guessVerified(website, key) {
  const dom = ownDomain(website)
  if (!dom || !key) return { emails: [], evidence: null }
  for (const local of ['info', 'office', 'kontakt']) {
    try {
      const r = await fetch(`https://api.hunter.io/v2/email-verifier?email=${local}@${dom}&api_key=${key}`, { signal: AbortSignal.timeout(25000) })
      if (!r.ok) break
      const d = (await r.json())?.data
      if (d?.status === 'valid') return { emails: [`${local}@${dom}`], evidence: `hunter verifier: ${local}@${dom} is valid` }
    } catch { break }
  }
  return { emails: [], evidence: null }
}

/**
 * Find a sendable address for a lead { email, website, company_name, intake_data, facebook_page_url? }.
 * opts: { firecrawlKey, hunterKey, apifyToken, hunter: true|false, log }
 * Returns { email, source, evidence, tried: [layer names] } — email null when every layer failed.
 */
export async function findEmail(lead, opts = {}) {
  const { firecrawlKey = process.env.FIRECRAWL_API_KEY, hunterKey = process.env.HUNTER_API_KEY, apifyToken = null, hunter = true, log = () => {} } = opts
  const tried = []
  let dom = ownDomain(lead.website)
  const accept = async (layer, r) => {
    tried.push(layer)
    // every address is checked with Hunter's verifier before it is accepted (2026-11-12: info@elandomis.com is on Elan Domis's own site and does not
    // exist; elandomis@hotmail.com, on its contact page, does). The best candidate that is not "invalid" wins.
    let list = [...(r.emails || [])]
    if (hunter && hunterKey && layer !== 'hunter' && layer !== 'hunter-verified') {
      const ok = []
      const ranked = [...list].sort((a, b) => Number(pickBest([b], dom) === b) - Number(pickBest([a], dom) === a))
      for (const x of ranked.slice(0, 4)) if (await notInvalid(x, hunterKey)) ok.push(x)
      list = ok
    }
    const e = pickBest(list, dom)
    if (e) { log(`  ✓ ${layer}: ${e}`); return { email: e, source: layer, evidence: r.evidence, tried } }
    log(`  · ${layer}: nothing`)
    return null
  }
  let hit
  if ((hit = await accept('stored', fromStored(lead)))) return hit
  // a lead whose "website" is a Facebook/marketplace link may still have its real domain in the bio's link or stored text
  if (!dom) {
    const cand = flatten(lead.intake_data).flatMap((t) => [...String(t).matchAll(/https?:\/\/[^\s"')<>]+/g)].map((m) => m[0])).find((u) => ownDomain(u))
    if (cand) { dom = ownDomain(cand); lead = { ...lead, website: cand }; log(`  own domain found in stored text: ${dom}`) }
  }
  if (dom && (hit = await accept('site', await fromSite(lead.website)))) return hit
  if (dom && (hit = await accept('firecrawl', await fromFirecrawl(lead.website, firecrawlKey)))) return hit
  const fb = lead.facebook_page_url || lead.intake_data?.facebook_page_url || (/facebook\.com/.test(lead.website || '') ? lead.website : null)
  if (fb && (hit = await accept('facebook', await fromFacebook(fb, firecrawlKey)))) return hit
  if (apifyToken && (hit = await accept('search', await fromSearch({ ...lead, website: dom ? lead.website : null }, apifyToken)))) return hit
  if ((hit = await accept('websearch', await fromFirecrawlSearch(lead, firecrawlKey)))) return hit
  if (hunter && dom) {
    if ((hit = await accept('hunter', await fromHunter(lead.website, hunterKey)))) return hit
    if ((hit = await accept('hunter-verified', await guessVerified(lead.website, hunterKey)))) return hit
  }
  return { email: null, source: null, evidence: null, tried }
}

/** Does the lead's website exist? DNS failures and 5xx = dead; 403/429 = a bot wall, the site is there. (2026-11-11: dentistmladenovic.rs was in the IG bio and does not resolve.) */
export async function siteAlive(site) {
  const url = /^https?:/.test(site) ? site : `https://${site}`
  try {
    const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'Mozilla/5.0' } })
    return r.status < 500
  } catch (e) {
    const code = String(e?.cause?.code || e?.code || '')
    return !/ENOTFOUND|ECONNREFUSED|EAI_AGAIN/.test(code) && !/ENOTFOUND/.test(String(e?.cause?.message || ''))
  }
}

/**
 * A lead with no own website (its IG link is Facebook, a marketplace ad, a link-in-bio or nothing) may still have one.
 * Search for it by name + place; accept a domain only when its page carries the lead's own Instagram handle or phone number
 * (pageIsAbout), so another business with a similar name is never taken. (2026-11-11: 19 of 28 new leads were archived for "no website".)
 */
export async function findWebsite(lead, key = process.env.FIRECRAWL_API_KEY) {
  const name = String(lead.company_name || '').replace(/[|·•].*$/, '').replace(/\p{Extended_Pictographic}/gu, '').trim()
  if (!name || !key) return null
  const bio = String(lead.intake_data?.enrichment?.instagram_profile?.bio || '')
  const place = bio.match(/📍\s*([^\n,|]+)/)?.[1]?.trim() || ''
  const query = `${name} ${place} sajt`.replace(/\s+/g, ' ').trim()
  try {
    const r = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, limit: 8, country: 'RS', lang: 'sr', scrapeOptions: { formats: ['markdown'] } }), signal: AbortSignal.timeout(60000),
    })
    if (!r.ok) return null
    const handle = String(lead.instagram_handle || '').toLowerCase()
    const phones = [...bio.matchAll(/\+?\d[\d\s/().-]{7,}\d/g)].map((m) => m[0].replace(/\D/g, '').slice(-7)).filter((d) => d.length === 7)
    for (const h of (await r.json())?.data || []) {
      const dom = ownDomain(h.url)
      if (!dom || REGISTRY.test(dom) || MARKETPLACE.test(dom)) continue
      const txt = `${h.title || ''}\n${h.description || ''}\n${h.markdown || ''}`.toLowerCase()
      // the page must be the lead's: it links to its Instagram account, or shows one of its phone numbers (a similar name is not enough)
      const igLink = handle.length > 3 && (txt.includes(`instagram.com/${handle}`) || txt.includes(`@${handle}`))
      const onPage = [...txt.matchAll(/\+?\d[\d\s/().-]{7,}\d/g)].map((m) => m[0].replace(/\D/g, '').slice(-7))
      if (igLink || phones.some((p) => onPage.includes(p))) return new URL(h.url).origin
    }
  } catch { /* none */ }
  return null
}
