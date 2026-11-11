// Collects everything the opening-wallpaper brief (lib/intro-art.mjs) is built from, for ONE tenant,
// and probes the pictures so the count it reports is the count that would really be sent.
// Read-only: HTTP GETs of the business's own public pages and files on disk. No database write, no paid call.
//
// Where a lead's real pictures come from, best first (all of them are the business's own):
//   site       og:image, slider / hero, gallery and product <img> on its homepage and key pages
//   scraped    clients.onboarding_copy.product_images  (scrape_catalog_images.mjs)
//   catalogue  services_catalog.image_url
//   ig-post    its own Instagram post photos, stored in public/onboarding/posts (collect_customer_voice.mjs)

import sharp from 'sharp'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { fetchSite } from './site-evidence.mjs'
import { usable, cleanQuestion } from './customer-voice.mjs'
import {
  extractImageCandidates, rankReferences, applyHandIntro, isLogoCandidate, dominantColours, siteColours,
  extractSiteFacts, cleanCaption, usefulAlt, sourceLabel, MAX_REFS,
} from './intro-art.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const UA = 'Mozilla/5.0 (Macintosh) SmartflowDemoBuilder'
const PER_SOURCE_CAP = { catalogue: 3, 'ig-post': 2, scraped: 4 }   // one source must not be the whole picture

/** Bytes of a picture: a file under public/ for "/onboarding/…", otherwise an HTTP GET with the site as referer. */
export async function fetchBuffer(url, referer) {
  if (url.startsWith('/')) {
    const p = resolve(ROOT, 'public', url.slice(1))
    if (!existsSync(p)) throw new Error('missing file')
    return readFileSync(p)
  }
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': UA, accept: 'image/*,*/*;q=0.5', ...(referer ? { referer } : {}) } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const type = r.headers.get('content-type') || ''
  if (!/^image\//i.test(type)) throw new Error(`not an image (${type || 'no content-type'})`)
  const buf = Buffer.from(await r.arrayBuffer())
  if (buf.length > 20 * 1024 * 1024) throw new Error('over 20 MB')
  return buf
}

async function averageHash(buf) {
  const px = await sharp(buf).resize(8, 8, { fit: 'fill' }).greyscale().raw().toBuffer()
  const mean = px.reduce((s, v) => s + v, 0) / px.length
  return [...px].map((v) => (v >= mean ? 1 : 0))
}
const hamming = (a, b) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0)

/** Is this download a photograph worth sending? Real size, not a banner strip, not a flat graphic. */
export async function probeReference(buf, { minShort = 320, minLong = 640 } = {}) {
  let meta
  try { meta = await sharp(buf).metadata() } catch { return { ok: false, reason: 'unreadable image' } }
  const { width = 0, height = 0 } = meta
  if (Math.min(width, height) < minShort || Math.max(width, height) < minLong) return { ok: false, reason: `too small (${width}x${height})`, width, height }
  if (Math.max(width, height) / Math.min(width, height) > 3.2) return { ok: false, reason: `banner strip (${width}x${height})`, width, height }
  const stats = await sharp(buf).stats()
  const sd = stats.channels.slice(0, 3).reduce((s, c) => s + c.stdev, 0) / 3
  if (sd < 14) return { ok: false, reason: 'flat graphic, not a photograph', width, height }
  return { ok: true, width, height, bytes: buf.length, hash: await averageHash(buf) }
}

/** Walk the ranked list, probing in order, until MAX_REFS pictures pass (or the list or the budget runs out). */
export async function selectReferences(ranked, { referer, max = MAX_REFS, budget = 18, caps = PER_SOURCE_CAP } = {}) {
  const chosen = [], rejected = [], used = {}
  let tried = 0
  for (const g of ranked) {
    if (chosen.length >= max || tried >= budget) break
    const src = g.source || 'site'
    if ((used[src] || 0) >= (caps[src] ?? max)) continue
    tried++
    try {
      const buf = await fetchBuffer(g.url, referer)
      const p = await probeReference(buf, src === 'ig-post' ? { minShort: 300, minLong: 500 } : undefined)
      if (!p.ok) { rejected.push({ url: g.url, reason: p.reason }); continue }
      // the same photo at another URL / crop is one reference
      if (chosen.some((c) => hamming(c.hash, p.hash) <= 5)) { rejected.push({ url: g.url, reason: 'near-duplicate of a chosen reference' }); continue }
      const caption = src === 'ig-post' ? g.alt : usefulAlt(g.alt)
      chosen.push({ url: g.url, source: src, sourceLabel: sourceLabel(src), caption: caption || '', width: p.width, height: p.height, bytes: p.bytes, hash: p.hash, buf, score: g.score, person: !!g.person })
      used[src] = (used[src] || 0) + 1
    } catch (e) { rejected.push({ url: g.url, reason: e.message }) }
  }
  return { chosen, rejected, tried }
}

/** A site's gallery / projects pages: where the real photographs live, but not on fetchSite()'s price-and-terms list. */
async function galleryPages(home, have) {
  if (!home) return []
  const host = new URL(home.url).host
  const links = [...home.html.matchAll(/href=["']([^"'#?]+)["']/gi)].map((m) => { try { return new URL(m[1], home.url).href } catch { return null } })
    .filter((h) => h && new URL(h).host === host && /galerij|gallery|projekt|portfolio|radov|realizacij|referenc|kolekcij|proizvod|ponuda|enterijer|ordinacij|oprema|prostor/i.test(new URL(h).pathname) && !/\.(jpg|png|webp|pdf|css|js)$/i.test(h) && !have.has(h))
  const out = []
  for (const u of [...new Set(links)].slice(0, 3)) {
    try {
      const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': UA } })
      if (r.ok) out.push({ url: r.url, html: await r.text() })
    } catch { /* a page that will not load is simply not a source */ }
  }
  return out
}

/** The logo's own colours (raster or SVG), read from its pixels. */
async function logoColoursOf(url, referer) {
  try {
    const buf = await fetchBuffer(url, referer)
    const { data, info } = await sharp(buf, { density: 144 }).resize(240, 240, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    return dominantColours({ data, width: info.width, height: info.height, channels: 4 })
  } catch { return [] }
}

function readHandSheet(email) {
  const p = resolve(ROOT, 'sheets', `${email}.json`)
  if (!existsSync(p)) return null
  try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null }
}

/**
 * Everything the brief needs for one tenant.
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{id:string, name:string, email:string, demo_brand_color?:string, onboarding_copy?:object}} client
 */
export async function gatherIntroInputs(sb, client) {
  const oc = client.onboarding_copy || {}
  const { data: lead } = await sb.from('contacts').select('website,website_summary').or(`demo_tenant_email.eq.${client.email},email.eq.${client.email}`).limit(1)
  const website = lead?.[0]?.website || (oc.catalog_source ? `https://${oc.catalog_source}` : null)
  const { data: rows } = await sb.from('services_catalog').select('name,image_url,sort_order').eq('client_id', client.id).eq('is_active', true).order('sort_order').limit(60)
  const hand = readHandSheet(client.email)?.intro || null

  const site = await fetchSite(website)
  const extra = await galleryPages(site.home, new Set(site.pages.map((p) => p.url)))
  const pages = [...site.pages, ...extra.map((p) => ({ ...p, text: '' }))]
  const origin = site.home ? new URL(site.home.url).origin : null

  // every picture the business has put out, from every place we already keep them
  let cands = []
  for (const p of pages) cands.push(...extractImageCandidates(p.html, p.url).map((c) => ({ ...c, source: 'site' })))
  for (const u of oc.product_images || []) cands.push({ url: u, alt: '', via: 'img', width: 0, height: 0, hint: '', page: 'scraped', source: 'scraped', bonus: 1 })
  for (const r of rows || []) if (r.image_url) cands.push({ url: r.image_url, alt: r.name, via: 'img', width: 0, height: 0, hint: '', page: 'catalogue', source: 'catalogue', bonus: 1.5 })
  const posts = oc.customer_voice?.posts || []
  for (const p of posts) if (p.image) cands.push({ url: p.image, alt: cleanCaption(p.caption), via: 'img', width: 0, height: 0, hint: '', page: 'ig', source: 'ig-post', bonus: 0.5 })

  // the logo: the one already stored for the tenant, else the best logo-looking file on its pages
  const logoUrl = oc.brand_logo || cands.filter((c) => c.source === 'site' && isLogoCandidate(c)).sort((a, b) => (/\.svg/i.test(a.url) - /\.svg/i.test(b.url)) || ((/logo/i.test(b.hint) | 0) - (/logo/i.test(a.hint) | 0)))[0]?.url || null

  const hh = applyHandIntro(cands, hand)
  const ranked = rankReferences(hh.cands, { exclude: hh.exclude })
  const { chosen, rejected, tried } = await selectReferences(ranked, { referer: origin })

  const logoColours = logoUrl ? await logoColoursOf(logoUrl, origin) : []
  const facts = extractSiteFacts(site.pages)
  const voiceQs = (oc.customer_voice?.questions || []).concat(posts.flatMap((p) => p.questions || []))
  const customerQuestions = [...new Set(voiceQs.map(cleanQuestion).filter(usable))].slice(0, 3)

  return {
    name: client.name, site: website ? String(website).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '') : null,
    accent: client.demo_brand_color || '#10b981',
    sheet: oc.business_sheet || null,
    catalogue: (rows || []).map((r) => ({ name: r.name })),
    facts, refs: chosen, rejected, tried, candidates: ranked.length,
    logo: { url: logoUrl, colours: logoColours },
    logoColours, siteColours: siteColours(site.home?.html), customerQuestions,
    handNote: hand?.note || null,
    pagesFetched: pages.length,
  }
}
