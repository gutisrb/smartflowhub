// The brief behind each lead's opening wallpaper (generate_intro_art.mjs).
//
// WHY THIS FILE EXISTS (2026-11-10, Nikola: "right now they are very basic and follow the same
// template ... it's mainly the prompt and the inputs that you put in the requests")
//
// What was wrong, in the order it matters:
//   1. createTask(prompt, imageUrls) never put imageUrls in the request. Every render was text-only,
//      so Varmus (modular housing units) opened on a warehouse of steel shipping containers and
//      Tandem (tandem skydiving) on a rack of gear under a sign that said "PACKING".
//   2. The only per-business input was three phrases a model had made up from a niche label and
//      a 300-char summary (room / resolved / hero). Everything else was one fixed paragraph: four
//      phones, a wall screen, an empty chair. Nine businesses, one picture.
//   3. The step needed OpenAI (gpt-4o scene writer). With OpenAI out of credits no tenant got art.
//
// What this does instead: the brief is ASSEMBLED, never invented. Each descriptor is a verbatim
// piece of the business's own evidence (site title / headings / description, catalogue names, the
// Business Sheet sentence on how it sells, real customer questions, alt text and captions of its own
// photos), the palette is READ from its logo pixels and site CSS, and its real photographs ride along
// as reference images, each labelled in the prompt. No model call is needed to build it, so it runs
// offline and the same inputs always give the same prompt.
//
// Mirror, never classify: no niche label decides anything here. What the picture shows follows from
// which evidence exists. Unknown stays unknown: a missing piece is left out of the prompt and listed
// in `notes`, never filled with a category cliché. A lead with no usable photo gets a clearly
// labelled TEXT-ONLY brief; a lead with nothing verified gets NO brief (the app then shows the shared
// backdrop instead of a confident picture of the wrong business).

import { sentencesOf } from './business-facts.mjs'

export const MAX_REFS = 5          // Nikola's ask: more of the site's own images. 5 keeps each one legible to the model; the endpoint takes 10.
const fold = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj')
const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#038;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ').replace(/&#8211;|&ndash;/g, '–').replace(/&#8217;/g, '’').replace(/&#8220;|&#8221;/g, '"')
const squash = (s) => decode(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()

// ───────────────────────────── images found on the business's own pages ─────────────────────────────

/** "k1=v1 k2='v2'" → {k1: 'v1', k2: 'v2'} for one HTML tag. */
function attrsOf(tag) {
  const out = {}
  for (const m of String(tag).matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/g)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '')
  return out
}

/** The widest candidate of a srcset ("a.jpg 480w, b.jpg 1200w") — or the only one. */
function bestOfSrcset(srcset) {
  const items = [...String(srcset || '').matchAll(/(\S+?)(?:\s+(\d+(?:\.\d+)?)([wx]))?\s*(?:,|$)/g)].map((m) => ({ url: m[1], w: m[2] ? Number(m[2]) * (m[3] === 'x' ? 1000 : 1) : 0 })).filter((i) => i.url && !/^data:/i.test(i.url))
  return items.sort((a, b) => b.w - a.w)[0] || null
}

const PLACEHOLDER = /^data:|dummy\.|blank\.|placeholder|\/1x1|pixel\.|spacer|lazy(?:load)?\.(?:png|gif|jpe?g)|loading\.(?:gif|png)|transparent\./i

/** Every picture a page points at, wherever the theme hides it (lazy-load attrs, srcset, CSS backgrounds, og:image, JSON-LD). */
export function extractImageCandidates(html, pageUrl) {
  const out = []
  const abs = (u) => { try { const x = new URL(decode(u).trim(), pageUrl); return /^https?:$/.test(x.protocol) ? x.href : null } catch { return null } }
  const add = (u, extra) => { const url = abs(u); if (url && !PLACEHOLDER.test(url)) out.push({ url, alt: '', via: 'img', width: 0, height: 0, hint: '', page: pageUrl, ...extra }) }
  const H = String(html || '')

  for (const m of H.matchAll(/<img\b[^>]*>/gi)) {
    const a = attrsOf(m[0])
    // a lazy-loading theme keeps the real file in a data-* attr and a 1x1 placeholder in src
    const lazy = a['data-lazyload'] || a['data-src'] || a['data-lazy-src'] || a['data-original'] || a['data-large_image'] || a['data-large-image'] || a['data-full-url']
    const set = bestOfSrcset(a.srcset || a['data-srcset'] || a['data-lazy-srcset'])
    const pick = [lazy, set?.url, a.src].find((u) => u && !PLACEHOLDER.test(u))
    if (!pick) continue
    add(pick, { alt: squash(a.alt), width: Number(a.width) || 0, height: Number(a.height) || 0, hint: `${a.class || ''} ${a.id || ''} ${a.title || ''}`, via: 'img' })
  }
  for (const m of H.matchAll(/<source\b[^>]*>/gi)) {
    const a = attrsOf(m[0]); const s = bestOfSrcset(a.srcset || a['data-srcset'])
    if (s) add(s.url, { via: 'img', hint: 'picture-source' })
  }
  for (const m of H.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrsOf(m[0])
    if (/^(og:image(:secure_url)?|twitter:image(:src)?)$/i.test(a.property || a.name || '') && a.content) add(a.content, { via: 'og' })
  }
  for (const m of H.matchAll(/<link\b[^>]*rel=["']?image_src[^>]*>/gi)) { const a = attrsOf(m[0]); if (a.href) add(a.href, { via: 'og' }) }
  // style="background-image:url(...)" and data-bg / data-background attributes (sliders, hero sections)
  for (const m of H.matchAll(/\b(?:style|data-bg|data-background|data-background-image|data-image-src)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const v = m[1] ?? m[2] ?? ''
    const u = v.match(/url\(\s*['"]?([^'")]+\.(?:jpe?g|png|webp)[^'")]*)['"]?\s*\)/i)
    add(u ? u[1] : (/\.(jpe?g|png|webp)(\?|$)/i.test(v) ? v : ''), { via: 'bg', hint: 'background' })
  }
  for (const m of H.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const u of m[1].matchAll(/url\(\s*['"]?([^'")]+\.(?:jpe?g|png|webp)[^'")]*)['"]?\s*\)/gi)) add(u[1], { via: 'bg', hint: 'background' })
  }
  // JSON-LD: "image" / "logo" of the organisation
  for (const m of H.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let d; try { d = JSON.parse(m[1]) } catch { continue }
    const walk = (n) => {
      if (!n || typeof n !== 'object') return
      if (Array.isArray(n)) return n.forEach(walk)
      for (const k of ['image', 'logo', 'thumbnailUrl', 'photo']) {
        for (const v of [].concat(n[k] || [])) { const u = typeof v === 'string' ? v : v?.url; if (u) add(u, { via: 'jsonld', hint: k === 'logo' ? 'logo' : '' }) }
      }
      Object.values(n).forEach(walk)
    }
    walk(d)
  }
  return out
}

/** Dedup key: the same upload in every size WordPress made of it is one picture. */
export function imageKey(url) {
  try {
    const u = new URL(url)
    return (u.host.replace(/^www\./, '') + u.pathname).toLowerCase().replace(/-(?:scaled|e\d{9,})(?=\.)/g, '').replace(/-\d{2,4}x\d{2,4}(?=\.[a-z]+$)/g, '')
  } catch { return String(url).toLowerCase() }
}
/** Size WordPress puts in the file name ("…-768x1024.jpg"), when the tag carries none. */
const sizeInName = (url) => { const m = String(url).match(/-(\d{2,4})x(\d{2,4})(?=\.[a-z]+(?:\?|$))/i); return m ? { w: Number(m[1]), h: Number(m[2]) } : null }

// What is never a photograph of the business
const JUNK = /(?:^|[\/_.\-\s])(favicon|sprite|icons?|ikonic\w*|ikone|flags?|zastav\w*|payment|placanj\w*|visa|mastercard|maestro|paypal|badges?|avatars?|loaders?|spinner|placeholder|dummy|blank|pixel|spacer|arrows?|stars?|rating|emoji|social|facebook|instagram|whatsapp|viber|tiktok|youtube|tripadvisor|trust[\w-]*|footer|menu|button|cursor|divider|pattern|texture|shadow|overlay|mask|captcha|qr[\w-]*)(?=$|[\/_.\-\s\d])/i
const NOT_PHOTO_EXT = /\.(svg|gif|ico|bmp|pdf)(\?|$)/i
const LOGO = /(?:^|[\/_.\-\s])(logo\w*|logotip|brandmark|znak)(?=$|[\/_.\-\s\d])/i
// a person is a person: not a product, and the prompt forbids people in frame
const PERSON = /(?:^|[\/_.\-\s])(tim|team|doktor|dr|lekar|osoblje|staff|portret|portrait|vlasnik|owner|direktor|ceo|testimonial\w*|recenzij\w*|review\w*|pacijent\w*|patients?|klijent\w*|customers?|selfie)(?=$|[\/_.\-\s\d])/i

const MEANINGLESS_ALT = /^(slide|image|img|photo|slika|banner|logo|home|\d+|untitled)$/i
export const usefulAlt = (alt) => { const a = squash(alt); return a && a.length >= 4 && a.length <= 140 && !MEANINGLESS_ALT.test(a) ? a : '' }

export function isLogoCandidate(c) {
  const s = fold(`${c.url.split('?')[0]} ${c.alt} ${c.hint}`)
  return (c.hint && /(^|\s)logo(\s|$)/.test(fold(c.hint)) && c.via === 'jsonld') || LOGO.test(s) || /\bcropped-.*(logo|icon)/.test(s)
}

/**
 * Pick the pictures worth sending to the image model, best first. `bonus` lets a caller rank its own
 * sources (a hand-chosen hero, a catalogue photo); `pageCounts` penalises what sits on every page.
 * Pure: no network. Probing (real dimensions, a flat-graphic test) is done by the caller on this order.
 */
const SOURCE_ORDER = ['hand', 'site', 'scraped', 'catalogue', 'ig-post']
export function rankReferences(cands, { exclude = [] } = {}) {
  const ban = new Set(exclude.map(imageKey))
  const groups = new Map()
  for (const c of cands) {
    if (!c?.url || NOT_PHOTO_EXT.test(c.url) || ban.has(imageKey(c.url))) continue
    const path = c.url.split('?')[0]
    if (JUNK.test(fold(path)) || /\/wp-content\/plugins\//i.test(path) && !c.bonus) continue
    if (isLogoCandidate(c)) continue
    const k = imageKey(c.url)
    const g = groups.get(k) || { ...c, pages: new Set(), best: c, score: 0 }
    g.pages.add(c.page || '')
    const area = (x) => (x.width || sizeInName(x.url)?.w || 0) * (x.height || sizeInName(x.url)?.h || 0)
    if (area(c) > area(g.best)) { g.best = c; g.url = c.url }          // keep the biggest rendition
    if (!g.alt && c.alt) g.alt = c.alt
    if (c.via === 'og') g.og = true
    if (c.bonus) g.bonus = Math.max(g.bonus || 0, c.bonus)
    // the same file can be on the site AND in the catalogue: label it by the most direct source
    if ((SOURCE_ORDER.indexOf(c.source || 'site')) < (SOURCE_ORDER.indexOf(g.source || 'site'))) g.source = c.source
    g.hint = `${g.hint || ''} ${c.hint || ''}`
    groups.set(k, g)
  }
  const scored = [...groups.values()].map((g) => {
    const w = g.best.width || sizeInName(g.best.url)?.w || 0, h = g.best.height || sizeInName(g.best.url)?.h || 0
    const text = fold(`${g.best.url.split('?')[0]} ${g.alt}`)
    let s = 0
    if (g.og) s += 4
    if (/slide|slider|hero|cover|jumbotron|rev-slidebg|banner|header|background/.test(fold(g.hint))) s += 3
    if (/wp-content\/uploads|\/uploads\/|\/upload\/|\/media\//i.test(g.best.url)) s += 1
    if (Math.min(w, h) >= 500 && Math.max(w, h) >= 800) s += 2; else if (Math.min(w, h) >= 300) s += 1
    if (w && h && Math.min(w, h) < 200) s -= 4                           // a thumbnail or an icon
    if (g.pages.size >= 3 && !g.og) s -= 2                               // sits on every page = site chrome
    if (PERSON.test(text)) { s -= 3; g.person = true }
    if (/\/themes\/|\/assets\/|\/static\//i.test(g.best.url)) s -= 1
    if (usefulAlt(g.alt)) s += 1                                         // the business named what it shows
    s += g.bonus || 0
    return { ...g, score: s, width: w, height: h }
  })
  scored.sort((a, b) => b.score - a.score)
  // a whole album uploaded in one month folder is one angle five times: at most 3 from one folder
  const perDir = new Map(); const out = []
  for (const g of scored) {
    if (g.score < 0 && !g.bonus) continue
    const dir = g.url.split('?')[0].replace(/\/[^/]*$/, '')
    if ((perDir.get(dir) || 0) >= 3) continue
    perDir.set(dir, (perDir.get(dir) || 0) + 1)
    out.push(g)
  }
  return out
}

/** A hand-written `intro` block in sheets/<email>.json: {hero_image, exclude_images[], note}. Read, never required. */
export function applyHandIntro(cands, hand) {
  if (!hand) return { cands, exclude: [] }
  const out = hand.hero_image ? [{ url: hand.hero_image, alt: '', via: 'img', source: 'hand', width: 0, height: 0, hint: 'hand-chosen hero', page: 'hand', bonus: 20 }, ...cands] : cands
  return { cands: out, exclude: hand.exclude_images || [] }
}

// ───────────────────────────── colours read from the business's own logo and site ─────────────────────────────

const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
export const toHex = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`
export function normaliseHex(x) {
  const m = String(x || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return `#${h.toLowerCase()}`
}
export function hexToHsl(hex) {
  const n = normaliseHex(hex); if (!n) return null
  const r = parseInt(n.slice(1, 3), 16) / 255, g = parseInt(n.slice(3, 5), 16) / 255, b = parseInt(n.slice(5, 7), 16) / 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn
  let h = 0, s = 0
  if (d) {
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
    h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
    h *= 60
  }
  return { h, s, l }
}

/** A plain-English name for a colour, so the model is told "deep red", not only "#b3202a". */
export function colourName(hex) {
  const c = hexToHsl(hex); if (!c) return 'unknown colour'
  const { h, s, l } = c
  if (l < 0.1) return 'near-black'
  if (l > 0.94) return 'off-white'
  if (s < 0.1) return l < 0.32 ? 'charcoal grey' : l < 0.6 ? 'mid grey' : 'light grey'
  const hue = h < 15 || h >= 345 ? 'red' : h < 40 ? 'orange' : h < 50 ? 'amber' : h < 65 ? 'yellow' : h < 150 ? 'green' : h < 185 ? 'teal' : h < 215 ? 'sky blue' : h < 255 ? 'blue' : h < 290 ? 'violet' : h < 330 ? 'magenta' : 'rose'
  const tone = l < 0.28 ? 'deep ' : l > 0.72 ? 'light ' : s > 0.75 && l >= 0.38 && l <= 0.62 ? 'vivid ' : ''
  return `${tone}${hue}`
}

/**
 * The colours a logo is actually made of: its most common chromatic pixels, merged when near-identical.
 * Ignores transparency, white, black and grey (a black wordmark has no brand colour to give).
 * @param {{data: Uint8Array|Buffer, width: number, height: number, channels: 3|4}} img raw pixels
 * @returns {{hex: string, share: number}[]} share = fraction of the chromatic pixels
 */
export function dominantColours({ data, width, height, channels }, { max = 3 } = {}) {
  const step = Math.max(1, Math.floor((width * height) / 40000))
  const buckets = new Map()
  let total = 0
  for (let p = 0; p < width * height; p += step) {
    const i = p * channels
    if (channels === 4 && data[i + 3] < 128) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const c = hexToHsl(toHex(r, g, b))
    if (c.s < 0.22 || c.l < 0.12 || c.l > 0.92) continue
    total++
    const key = `${r >> 5}.${g >> 5}.${b >> 5}`
    const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 }
    e.r += r; e.g += g; e.b += b; e.n++
    buckets.set(key, e)
  }
  if (!total) return []
  const list = [...buckets.values()].map((e) => ({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n, n: e.n })).sort((a, b) => b.n - a.n)
  const merged = []
  for (const e of list) {
    const near = merged.find((m) => Math.hypot(m.r - e.r, m.g - e.g, m.b - e.b) < 70)
    if (near) near.n += e.n; else merged.push({ ...e })
  }
  return merged.sort((a, b) => b.n - a.n).slice(0, max).filter((m, i) => i === 0 || m.n / total >= 0.08).map((m) => ({ hex: toHex(m.r, m.g, m.b), share: Math.round((m.n / total) * 100) / 100 }))
}

/** Colours the site itself declares: theme-color / TileColor meta and brand-named CSS variables. */
export function siteColours(html) {
  const H = String(html || ''); const out = []
  const push = (hex, from) => { const n = normaliseHex(hex); if (n && !out.some((o) => o.hex === n)) out.push({ hex: n, from }) }
  for (const m of H.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrsOf(m[0])
    if (/^theme-color$/i.test(a.name || '') && a.content) push(a.content, 'meta theme-color')
    if (/^msapplication-tilecolor$/i.test(a.name || '') && a.content) push(a.content, 'meta TileColor')
  }
  for (const m of H.matchAll(/--([\w-]*?(?:primary|accent|brand|main|theme)[\w-]*)\s*:\s*(#[0-9a-f]{3,6})\b/gi)) push(m[2], `css --${m[1]}`)
  return out.slice(0, 4)
}

// ───────────────────────────── what the business says about itself, verbatim ─────────────────────────────

const NAV_WORDS = /^(pocetna|početna|home|kontakt|contact|o nama|about|meni|menu|pretraga|search|prijava|login|korpa|cart|nazad|vise|više|saznaj vise|saznajte više|usluge|proizvodi|galerija|blog|vesti|akcije|faq|cookie\w*|uslovi\w*|politika\w*)$/i
const COOKIE = /kolacic|kolačić|cookie|privatnost|gdpr|politika/i
const MATERIAL = /\b(drv\w*|hrast\w*|orah\w*|bukv\w*|jasen\w*|cel[ik]\w*|metal\w*|aluminij\w*|staklo|stakl\w*|kamen\w*|mermer\w*|granit\w*|keramik\w*|koz[ae]\b|kozn\w*|tkanin\w*|platn\w*|kadif\w*|plis\w*|bakar\w*|mesing\w*|beton\w*|cigl\w*|pvc|panel\w*|izolacij\w*|sendvic\w*|lamin\w*|mdf|iverica|lakiran\w*|sunđer\w*|sunder\w*|memorijsk\w*|pena|penu|opruga\w*|opruz\w*|poliester\w*|prirodn\w*|masiv\w*|furnir\w*)/i
const AUDIENCE = /namenjen\w*|idealn\w*\s+(?:je\s+)?za|savrsen\w*\s+za|za\s+sve\s+koji|za\s+one\s+koji|nasi\s+(?:klijenti|kupci|gosti|pacijenti|polaznici)|(?:klijenti|kupci|gosti|pacijenti|polaznici)\s+su|za\s+(?:porodic\w*|parov\w*|firm\w*|kompanij\w*|investitor\w*|turist\w*|pocetnik\w*|decu|mlade|profesionalc\w*|ugostitelj\w*)/

/** Cut a verbatim snippet to a readable length without leaving the page's own words. */
const clip = (s, n = 180) => { const t = squash(s); if (t.length <= n) return t; const cut = t.slice(0, n); return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 30)).replace(/[,;:\s-]+$/, '') }

// matchAll needs a global regex; callers pass /…/i for a single tag (the <title>)
const tagText = (html, re) => [...String(html || '').matchAll(re.global ? re : new RegExp(re.source, `${re.flags}g`))].map((m) => squash(m[1])).filter(Boolean)

/**
 * What the site says about itself. Every returned string was cut from the fetched pages (checked
 * against the corpus), so the prompt can quote it without a word of ours inside.
 * @param {{url:string, html:string, text:string}[]} pages  fetchSite().pages
 */
export function extractSiteFacts(pages) {
  const home = pages[0]
  const corpus = pages.map((p) => p.text || '').join('\n')
  const facts = { title: null, description: null, headings: [], materials: [], audience: [] }
  if (!home) return facts
  const title = tagText(home.html, /<title[^>]*>([\s\S]*?)<\/title>/i)[0]
  if (title) facts.title = clip(title, 110)
  for (const m of home.html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrsOf(m[0])
    if (/^(description|og:description)$/i.test(a.name || a.property || '') && a.content && !facts.description) facts.description = clip(a.content, 240)
  }
  const siteName = fold(facts.title || '').split(/[|–—-]/)[0].trim()
  const seen = new Set()
  for (const p of pages.slice(0, 4)) {
    for (const t of tagText(p.html, /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)) {
      const f = fold(t)
      if (t.length < 5 || t.length > 110 || NAV_WORDS.test(t) || COOKIE.test(t) || seen.has(f) || f === siteName) continue
      if (/^\d+[\d.,\s]*$/.test(t) || /^[A-ZŠĐŽČĆ\s]{3,}$/.test(t) && t.length < 6) continue
      seen.add(f); facts.headings.push(t)
    }
  }
  facts.headings = facts.headings.slice(0, 8)
  const sentences = [...new Set(pages.flatMap((p) => sentencesOf(p.text || '')))].filter((s) => s.length >= 30 && s.length <= 220 && !COOKIE.test(fold(s)))
  facts.materials = sentences.filter((s) => MATERIAL.test(fold(s))).slice(0, 3).map((s) => clip(s, 200))
  facts.audience = sentences.filter((s) => AUDIENCE.test(fold(s))).slice(0, 2).map((s) => clip(s, 200))
  // nothing may leave this function that is not in the fetched text
  const flat = (x) => fold(x).replace(/[^a-z0-9]+/g, ' ').trim()
  const haystack = flat(`${corpus} ${squash(home.html)}`)
  const keep = (arr) => arr.filter((s) => haystack.includes(flat(s)))
  facts.materials = keep(facts.materials); facts.audience = keep(facts.audience)
  facts.headings = keep(facts.headings)
  return facts
}

/** An Instagram caption made safe to quote: first sentence, no hashtags, links, phones or emoji. */
export function cleanCaption(c, n = 120) {
  const t = String(c || '').replace(/https?:\/\/\S+|www\.\S+/g, ' ').replace(/#[\p{L}\d_]+/gu, ' ').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, ' ').replace(/\+?\d[\d\s/()-]{7,}\d/g, ' ').replace(/[\p{Extended_Pictographic}‍️]/gu, ' ').replace(/\s+/g, ' ').trim()
  const first = t.split(/(?<=[.!?])\s+/)[0] || ''
  return first.length >= 8 ? clip(first, n) : ''
}

// ───────────────────────────── the brief ─────────────────────────────

const q = (s) => `“${s}”`
const list = (arr) => arr.join('; ')

const GENERIC_OFFER = /^proizvodi iz prodavnice$/i
function sellsLine({ catalogue, sheet, facts }) {
  const names = []
  for (const c of catalogue || []) { const n = squash(c.name); if (n && !names.some((x) => fold(x) === fold(n))) names.push(n) }
  // a facts-only sheet names offers by template ("Proizvodi iz prodavnice"); only a verified or hand sheet names them for real
  const sheetNames = sheet?.source && sheet.source !== 'facts' ? (sheet.offers || []).map((o) => squash(o.name)).filter((n) => n && !GENERIC_OFFER.test(n)) : []
  const all = [...sheetNames, ...names.filter((n) => !sheetNames.some((s) => fold(s) === fold(n)))].slice(0, 9)
  return { all, fromSheet: sheetNames.length > 0 }
}

/** The sentence from the site that says how the business is bought from (Business Sheet: verbatim). */
function howBought(sheet) {
  if (!sheet) return null
  const o = sheet.offers?.[sheet.primary ?? 0]
  if (o?.quote && sheet.source && sheet.source !== 'facts') return o.quote
  if (sheet.booking?.quote) return sheet.booking.quote
  return null
}

/**
 * Assemble the director's brief for one business.
 * @param {object} i
 * @param {string} i.name                 business name
 * @param {string|null} i.site            its domain
 * @param {string} i.accent               the app's accent colour (demo_brand_color), a hex
 * @param {object|null} i.sheet           Business Sheet (clients.onboarding_copy.business_sheet)
 * @param {{name:string}[]} i.catalogue   its catalogue rows (names only are used)
 * @param {ReturnType<typeof extractSiteFacts>|null} i.facts
 * @param {{url:string, caption?:string, source:string, width?:number, height?:number}[]} i.refs  probed, ranked, deduped
 * @param {{hex:string, share:number}[]} i.logoColours   from the logo's pixels
 * @param {{hex:string, from:string}[]} i.siteColours    from the site's own meta/CSS
 * @param {string[]} i.customerQuestions  real comments under its own posts
 * @param {string|null} i.handNote        hand-written line from sheets/<email>.json intro.note
 * @returns {{ level: 'photos'|'text-only'|'none', prompt: string|null, refs: object[], notes: string[], sources: object }}
 */
export function buildIntroBrief(i) {
  const notes = []
  const refs = (i.refs || []).slice(0, MAX_REFS)
  const sells = sellsLine(i)
  const ownWords = [i.facts?.description, i.facts?.title].filter(Boolean)
  const headings = (i.facts?.headings || []).filter((h) => !ownWords.some((w) => fold(w).includes(fold(h))))
  const bought = howBought(i.sheet)
  const hasFacts = !!(sells.all.length || ownWords.length || headings.length)

  if (!refs.length && !hasFacts) {
    return { level: 'none', prompt: null, refs: [], notes: ['no site photo, no catalogue, no site text: nothing verified to draw from. No art is generated; the intro shows the shared backdrop.'], sources: {} }
  }
  const level = refs.length ? 'photos' : 'text-only'
  if (!refs.length) notes.push('TEXT-ONLY: no usable photograph was found on its site, catalogue or Instagram posts. The picture is built from its written facts alone and will be a plausible, not a verified, view of its premises.')

  const accent = normaliseHex(i.accent) || '#10b981'
  const brand = (i.logoColours || []).map((c) => c.hex)
  const declared = (i.siteColours || []).map((c) => c.hex).filter((h) => !brand.includes(h))
  const P = []

  P.push(`A wide 16:9 opening photograph for the business "${i.name}"${i.site ? ` (${i.site})` : ''}. It has to look like a photograph of THIS business's own world, not a generic picture of its category: someone who runs it should recognise their own work in it within a second. Everything below was taken from the business's own website, logo, catalogue or Instagram. What is not known is simply not described, so never fill a gap with a stock idea of what such a business usually looks like.`)

  P.push(`PHOTOGRAPHIC LOOK: bright, airy, premium editorial commercial photography; medium-format camera, 45mm lens at f/5.6, natural mid-morning daylight, soft even illumination with clean whites and accurate, honest colour, a touch of fine film grain, realistic depth of field with the hero sharp and the background falling away gently. Calm, confident and optimistic. NOT dark, NOT night-time, NOT moody, NOT a CGI render, NOT an advertisement.`)

  // WHAT IT SELLS ------------------------------------------------------------------------------
  const sell = []
  if (sells.all.length) sell.push(`WHAT THIS BUSINESS SELLS, in its own catalogue and pages: ${list(sells.all.map(q))}. These are the things the picture is about; the objects, work or results in frame must be the real kind of thing named here.`)
  else notes.push('catalogue names: none on record')
  if (ownWords.length) sell.push(`IT DESCRIBES ITSELF AS: ${ownWords.map(q).join(' and ')}.${headings.length ? ` Other headings on its site: ${headings.slice(0, 5).map(q).join(', ')}.` : ''} Let the mood of the picture follow these words (their register: premium, practical, playful, clinical, family-run…) without ever rendering the words themselves.`)
  else if (headings.length) sell.push(`HEADINGS ON ITS SITE: ${headings.slice(0, 6).map(q).join(', ')}.`)
  else notes.push('self-description: the site gave no title, description or usable headings')
  if (bought) sell.push(`HOW IT IS BOUGHT FROM, in the business's own sentence: ${q(clip(bought, 220))}. The scene should look like the place where that actually happens.`)
  else notes.push('how it is bought: the site does not say, so the scene does not claim a way of buying')
  P.push(sell.join(' '))

  // WHAT IT LOOKS LIKE ---------------------------------------------------------------------------
  if (i.facts?.materials?.length) P.push(`WHAT IT IS MADE OF AND HOW IT LOOKS, from its site: ${i.facts.materials.map(q).join(' ')} Render those materials and finishes truthfully: grain, weave, metal, glass and paint as a close-up would show them.`)
  else notes.push('materials: the site states none, so the prompt gives none and leans on the photographs')

  // WHO BUYS ------------------------------------------------------------------------------------
  const who = []
  if (i.facts?.audience?.length) who.push(`The site says who it is for: ${i.facts.audience.map(q).join(' ')}`)
  const qs = (i.customerQuestions || []).slice(0, 3)
  if (qs.length) who.push(`Real questions its customers ask under its own posts: ${qs.map(q).join(', ')}. Read them only to understand who is buying and what they care about (what they want to see, what they worry about); style the scene for that buyer. Never render these words.`)
  if (who.length) P.push(`WHO BUYS: ${who.join(' ')}`)
  else notes.push('who buys: neither the site nor its customers\' comments say, so the prompt leaves the buyer out')

  // REFERENCE PHOTOS -----------------------------------------------------------------------------
  if (refs.length) {
    const lines = refs.map((r, n) => `Image ${n + 1}${n === 0 ? ' (lead reference)' : ''}: ${r.sourceLabel || 'from its own pages'}${r.caption ? `, captioned ${q(r.caption)}` : ', no caption'}.`)
    P.push(`REFERENCE PHOTOGRAPHS (${refs.length} attached, in this order). These are real photographs of this business's own products or premises, and they are the ground truth for what things look like: shape, proportions, materials, finish, colour, doors and windows, how it is installed or laid out. Reproduce that look faithfully and do not swap in a generic version of the category. ${lines.join(' ')} The references may contain people, lettering, logos or screen-grab furniture: use none of them. No person, face, hand, text or logo from a reference may appear in the result.`)
  } else {
    P.push(`NO REFERENCE PHOTOGRAPH is attached for this business. Build the scene only from the written facts above; where they are silent, keep surfaces and furniture plain and neutral instead of guessing brand details, and do not copy the look of any famous brand in its category.`)
  }

  // COLOUR ---------------------------------------------------------------------------------------
  const col = []
  if (brand.length) col.push(`The business's own colours, read from its logo: ${brand.map((h) => `${colourName(h)} (${h})`).join(', ')}${declared.length ? `; its site also declares ${declared.map((h) => `${colourName(h)} (${h})`).join(', ')}` : ''}. Let these show up in the real objects, materials and fabrics of the scene where the references show them; never recolour a real product to match.`)
  else if (declared.length) col.push(`The business's site declares these colours: ${declared.map((h) => `${colourName(h)} (${h})`).join(', ')}. Let them show up in the scene only where the references show them.`)
  else { col.push(`The business's colours could not be read from a logo or the site; take every colour from the reference photographs alone.`); notes.push('palette: no chromatic logo colour and no site colour found') }
  col.push(`ONE accent light, ${colourName(accent)} (${accent}), the colour of the app the viewer opens next: it appears only as the soft glow on the screen of the single phone in the frame and as a faint reflection on the surface beneath it. Nothing else in the scene is tinted ${colourName(accent)}.`)
  P.push(`COLOUR: ${col.join(' ')}`)

  // SCENE ---------------------------------------------------------------------------------------
  const scene = []
  if (refs.length) {
    scene.push(`THE SCENE: one coherent photograph of one real place, never a collage or a split frame. Take the setting, light and surroundings from Image 1 and put ${sells.all[0] ? q(sells.all[0]) : 'what Image 1 shows'} there as the sharply focused hero, filling the right two-thirds of the frame`)
    if (refs.length > 1) scene.push(`; let what Images 2 to ${refs.length} show appear in the same space, slightly behind or beside the hero, softer in focus, each as faithful to its own photograph as the hero is to Image 1`)
    scene.push(`. The work is FINISHED and ready: clean, complete, arranged with care, as if it had just been handed over.`)
  } else {
    scene.push(`THE SCENE: one coherent interior or exterior where ${sells.all[0] ? q(sells.all[0]) : 'this business'} would really be found, in bright daylight, with the finished work arranged with care in the right two-thirds of the frame, the key light falling on the single most characteristic object the written facts name.`)
  }
  scene.push(` One detail ties it to why the viewer is here: a single modern smartphone rests on a natural surface of this setting, mid-foreground, its screen showing an open messaging conversation drawn only as soft abstract bubbles, no readable text, no app interface, no app logo. Nobody is in the room: the work is done and the conversation is being handled.`)
  P.push(scene.join(''))

  if (i.handNote) P.push(`ADDED BY HAND FOR THIS BUSINESS: ${i.handNote}`)

  P.push(`LAYOUT, which the app depends on: wide 16:9, filling the frame edge to edge with NO black letterbox bars. The LEFT 40% of the frame is calm and low in detail, plain wall, floor, sky or soft out-of-focus background, no objects and no bright highlights, because a headline sits over it. All subjects live in the right 60%. Depth: foreground phone, hero in the middle distance, the rest receding.`)

  P.push(`ABSOLUTELY FORBIDDEN: robots, androids, humanoid figures, glowing brains, circuit-board patterns, holograms, sci-fi interfaces; people, faces or hands; ANY readable text, letters, numbers, signage lettering, brand names or watermarks, and any logo or monogram (signs, boxes and packaging stay blank); charts, graphs or dashboard panels; cartoon, illustration or 3D-render styling; dark or night-time lighting; a generic stock version of this kind of business.`)

  const prompt = P.join('\n\n')
  const sources = {
    sells: sells.fromSheet ? 'sheet+catalogue' : sells.all.length ? 'catalogue' : null,
    ownWords: ownWords.length ? 'site title/description' : null,
    bought: bought ? (i.sheet?.source && i.sheet.source !== 'facts' ? `sheet (${i.sheet.source})` : 'site sentence') : null,
    palette: brand.length ? 'logo pixels' : declared.length ? 'site css/meta' : null,
    refs: refs.map((r) => r.source),
  }
  return { level, prompt, refs, notes, sources }
}

/** Why a reference is labelled the way it is, in the words the model reads. */
export function sourceLabel(source, caption) {
  if (source === 'hand') return 'chosen by hand as the lead image of this business'
  if (source === 'ig-post') return 'a photo from its own Instagram post'
  if (source === 'catalogue') return 'its own catalogue photo'
  if (source === 'scraped') return 'a product or gallery photo taken from its website'
  return 'a photo from its own website'
}
