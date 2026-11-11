/**
 * build_demo_tenant.mjs — Niche-Aware Demo Tenant Provisioning v2
 *
 * For each lead: Firecrawl → 4-pass LLM → Supabase provision → seed all 4 tables
 *
 * Usage:
 *   node build_demo_tenant.mjs --lead-id <uuid>
 *   node build_demo_tenant.mjs --all [--limit N]
 *   node build_demo_tenant.mjs --dry-run
 *   node build_demo_tenant.mjs --force
 *   node build_demo_tenant.mjs --reseed-only --lead-id <uuid>   # skip auth/client creation
 *   node build_demo_tenant.mjs --reseed-only --all
 */

import { createClient } from '@supabase/supabase-js'
import { makeLlm } from './lib/llm.mjs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFileSync, existsSync, copyFileSync } from 'fs'
import { unlink } from 'fs/promises'
import { resolve, dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'
import { randomBytes } from 'crypto'

const execFileAsync = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Load .env.local ────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    }
  } catch { /* no .env.local */ }
}
loadEnv()

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const OPENAI_KEY    = process.env.OPENAI_API_KEY
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY
const SMARTFLOW_ID  = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const APP_URL       = 'https://app.smartflow.rs'
const OPENAI_MODEL  = 'gpt-4o-mini'
// Everything a prospect READS (chats, CRM notes, catalogue copy, onboarding text) is written
// by the stronger model. gpt-4o-mini wrote "definitive krunice", "medicamente", "zakazemo",
// lowercase "vas/vam" and English categories into live demos (found 2026-10-24).
const TEXT_MODEL    = 'gpt-4o'
const SERBIAN_STYLE = `LANGUAGE — this text is read by a Serbian business owner, so it must be flawless:
- Correct Serbian, ekavica, Latin script, with every diacritic (č, ć, š, ž, đ). Names too: Petrović, not Petrovic.
- Formal address is always capitalised: Vi, Vas, Vam, Vaš, Vaša.
- Correct cases, gender and number agreement; no anglicisms, no machine-translated phrasing.
- Categories and descriptions in Serbian, never English ("Stomatološke usluge", not "dental service").
- Prices exactly as given in the catalogue; never round, convert or invent one.`

if (!process.env.GEMINI_API_KEY) { console.error('✗ GEMINI_API_KEY not set in .env.local'); process.exit(1) }
if (!SERVICE_KEY) { console.error('✗ SUPABASE_SERVICE_ROLE_KEY not set in .env.local'); process.exit(1) }

const openai = makeLlm() // Gemini only (lib/llm.mjs), Nikola 2026-11-10; every answer carries resp.provider

// ── Load niche config ──────────────────────────────────────────────────────────
import { analyzeBusiness } from './lib/objection-engine.mjs'
import { salesModelOf } from './lib/sales-model.mjs'
import { OFFER_TERMS_PROMPT, OFFER_TERMS_RULES, normalizeOfferTerms, groundOfferTerms, playbookPromptBlock, isHighTicket, properName, cleanServiceName, formalVi } from './lib/sales-playbook.mjs'
const NICHE_CONFIGS = JSON.parse(readFileSync(resolve(__dirname, 'lib/niche-config.json'), 'utf8'))

const NICHE_KEYWORDS = [
  // ── made-to-measure trades ────────────────────────────────────────────────
  // Placed first: these lost to broader patterns below. "Kuhinje po meri" was
  // hitting nothing and landing on generic; "bazeni" hit /odmor|hotel/ -> travel;
  // "vencanja" hit /catering/ -> food; "stolarija" hit /stan/ -> real-estate.
  { pattern: /pergol|tend[ae]|nadstrešnic|roletn|markiz|staklen[ao]\s*bašt/i,     key: 'pergole' },
  // "proslav" (celebrate) used to be in this list — a dental clinic's own "svečano
  // proslavila prvi rođendan" (celebrated its 1st anniversary) matched it and routed a
  // dental clinic into wedding-venue voice/CRM. "Celebrate" is generic Serbian for any
  // milestone, not wedding-specific like the other terms here.
  { pattern: /venčanj|vencanj|svadb|event\s*(centar|hall)|mladenc/i,               key: 'vencanja' },
  { pattern: /kuhinj|plakar|ormar|namestaj po meri|nameštaj po meri|po\s*meri/i,  key: 'furniture' },
  { pattern: /stolarij|pvc\s*i?\s*alu|alu\s*i?\s*pvc|prozor|garažna\s*vrat/i,    key: 'quote' },
  // Varmus (construction/storage containers) matched nothing here and fell through to
  // 'generic', whose useCatalog:false skips catalog generation outright — a real, well-
  // priced business (2650€+ containers) profiled as unpriced not because scraping failed
  // but because 'generic' never even tries.
  { pattern: /kontejner|tiny\s*home|montažn[aei]\s*(kuć|objekt)|prefabrik/i,       key: 'quote' },
  { pattern: /solarn|fotonapon|toplotn[ae]\s*pump|panel/i,                        key: 'quote' },
  { pattern: /bazen(?!.*hotel)|đakuzi|dzakuzi|saun/i,                             key: 'quote' },
  { pattern: /dental|stomato|zub|ortodon|implant/i,                               key: 'dental' },
  { pattern: /klinik|medic|hospital|ordinacij|doktor|lekar(?!s)/i,                key: 'medical' },
  { pattern: /fitnes|teretana|gym|sport(?!s?\s*shop)|trening|pilates|yoga/i,      key: 'fitness' },
  // ecommerce/shop BEFORE beauty — "Beauty Store" should hit ecommerce, not beauty
  { pattern: /prodavnic|webshop|online\s*shop|e.?commerc|online\s*prodaj|web\s*shop|shop\b|store\b|dodaj u korpu|add to cart|košaric|naruči|poruči online/i, key: 'ecommerce' },
  { pattern: /estetik|lepot|kozmetik|beauty|nokat|trepavic|frizeri|salon|studio|tretman/i, key: 'beauty' },
  { pattern: /klinika_wellness|wellness\s*centar|spa\s*centar/i,                  key: 'beauty' },
  // Bare "stan" (no word boundary) used to match inside "stanje/stanju" (condition) —
  // e.g. a furniture site's "isporučeno u besprekornom stanju" (delivered in perfect
  // condition) was misrouting to real-estate. Same root cause as the stolarija->real-estate
  // bug from the 09-06 audit, just not fully closed — that fix added earlier-matching
  // patterns instead of tightening this one.
  { pattern: /nekretnin|real.?estat|apartman|\bstan(?:a|u|om|ovi|ova|ovima)?\b|agencija za nekret/i, key: 'real-estate' },
  { pattern: /restoran|kafana|pica|burger|catering|ugostiteljst/i,                key: 'food' },
  { pattern: /turizm|putovanj|travel|hotel|smestaj|odmor|letovanj/i,              key: 'travel' },
  { pattern: /namestaj|nameštaj|enterijer|interior|sofa|garnitur|krevet/i,        key: 'furniture' },
  { pattern: /moda|fashion|odjeć|odeca|majic|pantalo|haljin|odeća/i,              key: 'fashion' },
  { pattern: /auto|vozil|automobil|motocikl|polovn/i,                             key: 'auto' },
  { pattern: /konsalting|konsultant|agencij|b2b|uslug|servis/i,                   key: 'services' },
]

const KNOWN_NICHE_KEYS = new Set(['quote','dental','medical','fitness','beauty','real-estate','food','travel','furniture','fashion','auto','ecommerce','services','generic','pergole','vencanja'])

function inferNicheKey(rawNiche, websiteSummary = '', companyName = '') {
  const trimmed = (rawNiche || '').trim().toLowerCase()
  if (KNOWN_NICHE_KEYS.has(trimmed)) return trimmed
  const text = `${rawNiche || ''} ${companyName || ''} ${websiteSummary || ''}`.toLowerCase()
  // Falling through to 'generic' used to mean "never even try a catalog" (useCatalog:
  // false), regardless of what the site scrape itself found — Varmus (containers, 2650€
  // items) and Tandem Skok (11 real items) both had genuinely priced products sitting in
  // businessIntel that never got a chance, because the niche match failed, not because the
  // data was bad. The existing "0 real products — refusing to invent" guard already
  // protects the true no-data case at the content level, so there's no risk in defaulting
  // an unmatched niche to 'services' (same catalog/calendar modules, just a generic label)
  // instead of a bucket that structurally can't ever show real pricing.
  if (!text.trim()) return 'services'
  for (const { pattern, key } of NICHE_KEYWORDS) {
    if (pattern.test(text)) return key
  }
  return 'services'
}

// ── CLI args ───────────────────────────────────────────────────────────────────
const isDryRun    = process.argv.includes('--dry-run')
const isForce     = process.argv.includes('--force')
const isAll       = process.argv.includes('--all')
const isApproved  = process.argv.includes('--approved')  // build only cockpit-approved (pipeline_stage='demo_building')
const isReseedOnly = process.argv.includes('--reseed-only')
const leadIdIdx   = process.argv.indexOf('--lead-id')
const LEAD_ID     = leadIdIdx !== -1 ? process.argv[leadIdIdx + 1] : null
const limitIdx    = process.argv.indexOf('--limit')
const LIMIT       = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : 0

if (!LEAD_ID && !isAll && !isApproved) {
  console.error('Usage: node build_demo_tenant.mjs --lead-id <uuid> | --all | --approved [--limit N] [--dry-run] [--force] [--reseed-only]')
  process.exit(1)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Password generator ─────────────────────────────────────────────────────────
function genPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pw = 'Sf'
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)]
  return pw
}

// ── Timestamp helpers ──────────────────────────────────────────────────────────
// Fractional hours count. setHours() truncated them, so every message of a thread got one
// timestamp and the inbox could show the agent's answer above the customer's question.
function hoursAgo(h, m = 0) {
  const d = new Date(Date.now() - h * 3_600_000 - m * 60_000)
  d.setSeconds(0, 0)
  return d.toISOString()
}
// ── Realistic Serbian mobile phone generator ──────────────────────────────────
// Prefixes: 060–069, 061–069 (Telekom/A1/Yettel ranges)
const SRB_PREFIXES = ['060','061','062','063','064','065','066','069']
const _usedPhones  = new Set()
function randomSrbPhone() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const prefix = SRB_PREFIXES[Math.floor(Math.random() * SRB_PREFIXES.length)]
    const n      = Math.floor(100_0000 + Math.random() * 900_0000).toString()
    const phone  = `+381 ${prefix.slice(1)} ${n.slice(0,3)} ${n.slice(3)}`
    if (!_usedPhones.has(phone)) { _usedPhones.add(phone); return phone }
  }
  return null // extremely unlikely
}

function daysAgo(days, hour = 10, min = 0) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}
function daysFromNow(days, hour = 10, min = 0) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, min, 0, 0)
  return d.toISOString()
}

// ── Firecrawl scrape ───────────────────────────────────────────────────────────
async function scrapeWebsite(websiteUrl) {
  if (!FIRECRAWL_KEY || !websiteUrl) return ''

  let base
  try {
    base = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`
    new URL(base)
  } catch { return '' }

  const domain = new URL(base).hostname.replace(/^www\./, '')

  const HOME_BUDGET = 1500   // homepage is positioning copy; a little goes far
  const OFFER_BUDGET = 7000  // the price table is the point — give it room (and the terms sections that sit under it)
  // Markdown from these sites is mostly image and icon markup. Stripping it leaves
  // the model looking at words instead of wp-content URLs.
  // Every page on these WordPress sites opens with the same 2500 characters of
  // navigation and social icons. Slicing from the top therefore captured the menu
  // three times and cut the price table off the bottom — which is why a clinic
  // publishing a full cenovnik still profiled as having zero services.
  // Cookie-consent plugins (Complianz/Cookiebot etc.) inject their full GDPR banner text
  // as page content, not into a <footer>/<aside> Firecrawl would exclude — on Andži
  // kompani it ate ~1750 of the 1500-char home budget before any real copy showed up,
  // so the site profiled as having zero products despite a working shop page.
  const CONSENT_BANNER_LINE = /upravljanje saglasnostima|tehničko skladištenje ili pristup|prihvatam.*odbijam|cmplz-|cookie-policy|cookiedatabase\.org|korisničko iskustvo, koristimo tehnologije/i
  // \b right after € never matches — € isn't a word char, so there's no boundary between
  // it and a following space. That silently made this never detect any "2650€"-style price
  // (only worked for spelled-out "rsd"/"eur"/"din", which is why Varmus profiled as having
  // zero prices even after its real "Cena od 2650€" text was scraped successfully).
  const PRICE_SIGNAL = /\d[\d.,]{2,}\s?(?:rsd\b|din\b|eur\b|€)|(?:\brsd\b|\bdin\b|\beur\b|€)\s?[\d.,]{2,}/i
  const denoise = (md) => md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')          // images
    .split('\n')
    .filter((line) => {
      const t = line.trim().replace(/^[-*]\s*/, '')
      if (!t) return false
      // A line that is only a link is usually nav — except when the link TEXT is itself
      // a price CTA button ("[Cena od 2650€ +PDV](/kontakt)"). Varmus's real container
      // pricing lived nowhere else on the page but inside exactly this kind of button;
      // stripping it as "just a nav link" is what made a priced business look unpriced.
      if (/^\[[^\]]*\]\([^)]*\)$/.test(t) && !PRICE_SIGNAL.test(t)) return false
      if (/^https?:\/\/\S+$/.test(t)) return false          // bare URL
      if (CONSENT_BANNER_LINE.test(t)) return false          // cookie-consent boilerplate
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const scrapeOne = async (url) => {
    try {
      const { stdout } = await execFileAsync('firecrawl', [
        'scrape', '--url', url, '--format', 'markdown',
        // Serbian WordPress sites bury the price table under a nav menu bigger than
        // the page. Without this the scrape returned menus and the clinic profiled
        // as having no services at all.
        '--only-main-content', '--exclude-tags', 'nav,header,footer,aside',
      ], { timeout: 25000, env: { ...process.env, FIRECRAWL_API_KEY: FIRECRAWL_KEY } })
      return stdout?.trim() || ''
    } catch { return '' }
  }

  // Some sites' "price list" link is the PDF itself (Hotel Radan's /cenovnik-pdf serves
  // the file directly) — Firecrawl's HTML scrape returns nothing useful for those, and a
  // demo that could have shown 10 real priced packages built with zero instead. Download
  // the bytes and run them through pdftotext rather than treating a PDF as a dead end.
  const scrapePdf = async (url) => {
    const pdfPath = resolve(tmpdir(), `sfdemo-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`)
    try {
      await execFileAsync('curl', ['-sL', '-A', 'Mozilla/5.0', '--max-time', '20', '-o', pdfPath, url], { timeout: 25000 })
      const { stdout } = await execFileAsync('pdftotext', ['-layout', pdfPath, '-'], { timeout: 15000 })
      return stdout?.trim() || ''
    } catch {
      return ''
    } finally {
      await unlink(pdfPath).catch(() => {})
    }
  }

  const home = await scrapeOne(base)
  if (!home) {
    console.log(`│         ⚠ Firecrawl returned nothing for ${domain}`)
    return ''
  }

  // Follow the site's OWN links to its price list rather than guessing paths.
  // Cvejanović publishes a full price list at /cenovnik-stomatoloskih-usluga/ —
  // no guessed candidate would ever have produced that URL, so the clinic looked
  // like it had no services at all.
  //
  // A dedicated price page (cenovnik) has to outrank a generic "usluge" (services)
  // nav submenu. OB Esthetics' homepage links to 26 individual /usluge/<treatment>/
  // sub-pages before it ever links to /cenovnik — "first 2 matches" was following
  // "/usluge/" and "/usluge/dermapen/" (one treatment, maybe unpriced) and never
  // reaching the actual price list with 40+ priced procedures.
  const PRICE_LIST_LINK = /cenovnik|price-?list|troškovnik|troskovnik|\bcene\b/i
  // garancij / plaćanje / uslovi / online-pregled / dostava / povrat: the pages where a business states HOW it sells
  // (guarantee, payment split, free first step, shipping, returns) — the sales playbook quotes these, never invents them.
  const OFFER_LINK = /cenovnik|cene|usluge|ponuda|paketi|proizvod|katalog|shop|prodavnic|garancij|pla[cć]anj|uslovi|kreditir|online-pregled|dostav|povrat/i
  // Varmus's real product-category pages (gradjevinski, stambeni, magacinski...) match
  // NONE of the OFFER_LINK keywords — those words are specific to services/retail sites,
  // not this manufacturer's own vocabulary. Excluding obvious non-page links up front
  // (images, uploads, contact/about/blog boilerplate) also matters: an unrelated homepage
  // image filename ("...surf-shop-1200x760.jpg") matched "shop" and got followed as if it
  // were a real offer page, wasting the one slot on something Firecrawl can't even scrape.
  const JUNK_LINK = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i   // NOT .pdf — those are real price lists
  const NON_OFFER_PATH = /\/wp-content\/|\/kontakt\/?$|\/o-nama\/?$|\/about\/?$|\/contact\/?$|\/blog\/?$|\/galerija\/?$|\/privacy|\/cookie-policy/i
  const sameDomain = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') === domain } catch { return false } }
  // Returns every same-domain, non-junk link IN ORDER (duplicates kept) — repetition
  // is what rankLinks' frequency fallback uses.
  // Canonical form for identity checks: no hash, no query, no trailing slash. Without this,
  // `https://site.rs`, `https://site.rs/`, `https://site.rs/#kontakt` and `https://site.rs/?x=1`
  // are four different strings, so neither the `visited` check nor the Set dedupe catches
  // them. On laserestetika.rs that meant both "offer pages" resolved to the homepage — logged
  // as `followed 2 offer page(s): /, /` — and the real /usluge/ catalogue was never fetched.
  const canon = (u) => {
    try { const x = new URL(u); x.hash = ''; x.search = ''; return x.href.replace(/\/$/, '') }
    catch { return u.replace(/[#?].*$/, '').replace(/\/$/, '') }
  }
  const extractLinks = (md) => [...md.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)]
    .map(m => m[1])
    .filter(u => sameDomain(u) && !JUNK_LINK.test(u) && !NON_OFFER_PATH.test(u))
  const rankLinks = (urls, visited) => {
    const seenCanon = new Set([...visited].map(canon))
    const fresh = urls.filter(u => !seenCanon.has(canon(u)))
    // Dedupe on the canonical form, keeping the first spelling of each distinct page.
    const byCanon = new Map()
    for (const u of fresh) if (!byCanon.has(canon(u))) byCanon.set(canon(u), u)
    const unique = [...byCanon.values()]
    const priceListUrls = unique.filter(u => PRICE_LIST_LINK.test(u))
    const otherOfferUrls = unique.filter(u => !PRICE_LIST_LINK.test(u) && OFFER_LINK.test(u))
    const ranked = [...priceListUrls, ...otherOfferUrls]
    if (ranked.length >= 2) return ranked
    // No niche vocabulary matched (or too little of it) — fall back to whichever links
    // repeat most often on the page. A business's own core product/category pages get
    // linked from multiple spots (hero banner, nav, footer); one-off links to contact
    // forms or socials don't. Language-independent, unlike the keyword lists above.
    const counts = new Map()
    for (const u of fresh) counts.set(canon(u), (counts.get(canon(u)) || 0) + 1)
    const byFrequency = [...counts.entries()]
      .filter(([u, n]) => n >= 2 && !ranked.some(r => canon(r) === u))
      .sort((a, b) => b[1] - a[1])
      .map(([u]) => u)
    return [...ranked, ...byFrequency]
  }

  // Sales terms (guarantee, instalments, free first step, delivery, returns) usually sit at the bottom of
  // long price pages, after the per-page budget cuts. Keep a window around every terms keyword from the
  // UNCUT markdown so extractOfferTerms still sees them. Cvejanović: "Krunice 5 godina / Zubni implanti
  // Doživotna" sat at char ~9,000 of a 16,700-char page and never reached the model.
  const TERMS_KEYWORD = /garanc|doživotn|dozivotn|na rate|\brata\b|\brate\b|kredit|bez kamate|besplatn|online pregled|dostav|povrat|zamen[ae]|gotovinsk|kartičn|plaćanj|uslovi/gi
  const termsWindows = []
  const stemCount = new Map()
  const harvestTerms = (md) => {
    if (!md) return
    let last = -1
    for (const m of md.matchAll(TERMS_KEYWORD)) {
      if (m.index < last) continue            // already inside the previous window
      // At most 3 windows per keyword across the whole site. Package sections repeat the same
      // "Popravke u garantnom roku" link; uncapped, those filled the budget before the guarantee
      // table at the bottom of the page was reached.
      const stem = m[0].toLowerCase().slice(0, 6)
      if ((stemCount.get(stem) || 0) >= 3) continue
      stemCount.set(stem, (stemCount.get(stem) || 0) + 1)
      const a = Math.max(0, m.index - 140), b = Math.min(md.length, m.index + 260)
      termsWindows.push(md.slice(a, b).replace(/\s+/g, ' '))
      last = b
    }
  }
  const visited = new Set([base])
  // The homepage is kept SEPARATE from the offer pages rather than being parts[0].
  // Everything is truncated to 12000 chars at the end, and the homepage is marketing prose
  // ("individualni pristup svakom pacijentu") while the offer pages are the actual catalogue —
  // so joining homepage-first meant the truncation ate exactly the content we scraped those
  // pages for. dr Marija Bošković's /usluge/ page names 30 treatments; the builder extracted
  // 3, because most of that page fell off the end of the buffer (2026-09-15).
  const homePart = denoise(home).slice(0, HOME_BUDGET)
  harvestTerms(home)
  const parts = []
  let fetchedCount = 0

  const fetchAndAdd = async (url) => {
    visited.add(url)
    let md = await scrapeOne(url)
    // A "cenovnik" URL that scrapes clean but has no actual prices in it is almost always
    // the HTML wrapper around a PDF download, not a broken link — Hotel Radan's /cenovnik
    // page returns a normal-looking intro paragraph ("Cenovnik u Prolom Banji...") that
    // clears any length check, while the real per-program pricing sits only in the linked
    // PDF. Checking for a price signal here (not just emptiness) is what catches that.
    if (PRICE_LIST_LINK.test(url) && !PRICE_SIGNAL.test(md || '')) {
      const pdfText = await scrapePdf(url)
      if (pdfText) md = md ? `${md}\n\n${pdfText}` : pdfText
    }
    harvestTerms(md)
    if (md) parts.push(denoise(md).slice(0, OFFER_BUDGET))
    fetchedCount++
    return md   // raw (non-denoised) markdown, '' on failure — caller extracts links from this
  }

  // Firecrawl's markdown only carries links it actually rendered. laserestetika.rs builds its
  // nav in JS, so the markdown contained no same-domain links at all and the "offer pages" were
  // the root URL twice — the /usluge/ catalogue was never reachable, even though it sits in the
  // raw HTML as a plain <a href>. A direct HTML fetch is free (no Firecrawl credit), so fall
  // back to scraping hrefs out of the markup whenever the rendered links give us nothing.
  let homeLinks = extractLinks(home)
  if (!rankLinks(homeLinks, visited).length) {
    try {
      const res = await fetch(base, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' },
        signal: AbortSignal.timeout(15000), redirect: 'follow',
      })
      if (res.ok) {
        const html = await res.text()
        const hrefs = [...html.matchAll(/href=["']([^"']+)["']/g)]
          .map(m => { try { return new URL(m[1], base).href } catch { return null } })
          .filter(Boolean)
          .filter(u => sameDomain(u) && !JUNK_LINK.test(u) && !NON_OFFER_PATH.test(u))
        if (hrefs.length) {
          homeLinks = [...homeLinks, ...hrefs]
          console.log(`│         nav not in rendered markdown — recovered ${hrefs.length} link(s) from raw HTML`)
        }
      }
    } catch {}
  }

  const firstHop = rankLinks(homeLinks, visited).slice(0, 2)
  const firstHopContent = []
  for (const url of firstHop) firstHopContent.push(await fetchAndAdd(url))
  // Name the pages, not just the count — "followed 2 offer page(s)" gave no way to tell
  // whether the scraper had reached the catalogue or two contact pages.
  if (firstHop.length) console.log(`│         followed ${firstHop.length} offer page(s): ${firstHop.map(u => { try { return new URL(u).pathname } catch { return u } }).join(', ')}`)

  // First hop landed on a category/index page with no actual prices on it (Varmus's
  // homepage links to "/montazni-gradjevinski-kontejneri/", which is itself just a list
  // of 8 container-type links — the real "Cena od 2650€" text is one click further, on
  // each type's own page). Follow one more hop, bounded, only when we still have nothing.
  let hasPriceSignal = PRICE_SIGNAL.test([...parts, homePart].join(' '))
  if (!hasPriceSignal) {
    const secondHopCandidates = firstHopContent.flatMap(md => rankLinks(extractLinks(md), visited))
      .concat(rankLinks(homeLinks, visited))
    const secondHop = [...new Set(secondHopCandidates)].slice(0, 2)
    for (const url of secondHop) await fetchAndAdd(url)
    if (secondHop.length) console.log(`│         followed ${secondHop.length} more (second hop, no price signal yet)`)
    hasPriceSignal = PRICE_SIGNAL.test([...parts, homePart].join(' '))
  }

  // Last resort: Hotel Radan's real cenovnik lives at a conventional path that is not
  // linked from anywhere Firecrawl can see (not the rendered homepage, not the nav) — I
  // only found it by guessing the same path a human customer would try. A same-domain
  // fetch that 404s is free (Firecrawl returns nothing, no charge for content), so a
  // short guess list costs nothing when wrong and recovers real pricing when right.
  if (!hasPriceSignal) {
    const GUESS_PATHS = ['/cenovnik', '/cene', '/cenovnik-pdf', '/price-list']
    const guesses = GUESS_PATHS.map(p => `${base.replace(/\/$/, '')}${p}`).filter(u => !visited.has(u))
    for (const url of guesses) await fetchAndAdd(url)
    if (PRICE_SIGNAL.test([...parts, homePart].join(' '))) console.log(`│         found pricing via conventional path guess`)
  }

  // Offer pages first, homepage last: whatever gets cut should be the boilerplate.
  const evidence = [...new Set(termsWindows)].join('\n').slice(0, 6000)
  const body = [...parts, homePart].join('\n\n---\n\n').slice(0, 15000)
  return evidence ? `${body}\n\n=== TERMS EVIDENCE (excerpts around guarantee / payment / consultation / delivery wording) ===\n${evidence}` : body
}

// ── Pass 1: Business intelligence extraction ───────────────────────────────────
async function extractBusinessIntel(companyName, niche, websiteContent) {
  const prompt = `Extract business intelligence from this Serbian company's website. Return ONLY raw JSON.

{
  "brand_name": "the business name exactly as the business writes it on its site, with all Serbian diacritics (č, ć, š, ž, đ) and no city suffix",
  "is_directory_or_aggregator": true_or_false,
  "directory_reason": "1 sentence why, or null if not a directory",
  "products_services": [
    { "name": "product/service name", "price": "numeric amount or null", "currency": "RSD or EUR — whichever the site actually shows", "category": "category" }
  ],
  "usp": "main value proposition in 1 sentence",
  "top_categories": ["cat1", "cat2", "cat3"],
  "business_summary": "2-sentence description of what they sell/do"
}

Company: ${companyName}
Niche: ${niche || 'unknown'}
Website content:
${websiteContent || '(no website content)'}

Use ONLY what the website content states. Do NOT invent products, services or prices.
Serbian sites often price in EUR (€, EUR, evra) — report the number as written and set
"currency" accordingly. Never silently treat a euro figure as dinars.
A named treatment, procedure, service or product line counts as an entry even when the site
publishes NO price for it — clinics, studios, agencies and workshops routinely list what they
do without listing what it costs. Set "price": null in that case. Do NOT omit a service just
because it carries no price.
Measured 2026-09-15: without this clause the extractor returned 0 services for an aesthetic-
medicine clinic whose services page names 30 treatments (botulinski toksin, hijaluronski
fileri, mezoterapija…), purely because none of them showed a price. That silently disqualified
an entire high-value niche.
Only return an empty products_services array when the content names nothing the business
actually does. An empty array is a correct answer; a plausible guess is not.

Watch for directories/aggregators/marketplaces — a site whose actual product is a listing of OTHER,
independently-named companies (e.g. "wellness-spa.rs" lists dozens of different named spa HOTELS —
each with its own hotel brand — across Serbia by region and price tier) is not itself a single
business, even though it has plenty of real prices on it.
Set is_directory_or_aggregator: true ONLY when the content is built around named third-party
entities that are not this company (other hotel/venue/shop brand names, "compare offers from
multiple providers", etc). Do NOT set it just because a business offers many products, package
tiers, or destinations under its OWN single brand — a travel agency selling its own Greece/Turkey/
Montenegro packages, or a store selling many product lines, is one business and is_directory_or_aggregator
must be false. The test is "does this content belong to other companies," not "is there a lot of it."
This matters because a demo built on someone else's aggregated catalog would misrepresent a business
that doesn't actually own that inventory — but wrongly flagging a real single business here throws
away a good lead just as badly. Always return valid JSON.`

  const resp = await openai.chat.completions.create({
    model: OPENAI_MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    const intel = JSON.parse(resp.choices[0].message.content || '{}')
    intel.offer_terms = await extractOfferTerms(companyName, websiteContent)
    return intel
  } catch {
    return { brand_name: companyName, products_services: [], usp: '', top_categories: [], business_summary: '', offer_terms: normalizeOfferTerms(null) }
  }
}

/**
 * How the business sells — guarantee, payment structure, free first step, delivery, returns.
 * Its own pass on a stronger model: folded into the services/prices extraction it was mostly
 * missed (gpt-4o-mini returned "popravke u garantnom roku" for a page that states "krunice
 * 5 godina, zubni implanti doživotna"). Roughly two cents per demo; every sentence the sales
 * agent says about terms depends on this being right, so it is not the place to save money.
 */
async function extractOfferTerms(companyName, websiteContent) {
  if (!websiteContent) return normalizeOfferTerms(null)
  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: `Read this Serbian business website content for ${companyName} and extract HOW THEY SELL. Return ONLY raw JSON:\n{${OFFER_TERMS_PROMPT}\n}\n${OFFER_TERMS_RULES}\n\nWebsite content:\n${websiteContent}` }],
    })
    // grounded in code, not trusted from the prompt — see groundOfferTerms
    return groundOfferTerms(JSON.parse(resp.choices[0].message.content || '{}').offer_terms, websiteContent)
  } catch {
    return normalizeOfferTerms(null)
  }
}

/** Headline price in RSD (EUR x 117, same rule as the catalogue) — decides the high-ticket playbook layer. */
function headlinePriceRsd(intel) {
  const prices = (intel?.products_services || []).map(p => {
    const n = parseFloat(String(p.price ?? '').replace(/\./g, '').replace(',', '.'))
    if (!n || n <= 0) return 0
    return /eur|€/i.test(p.currency || '') ? n * 117 : n
  })
  return prices.length ? Math.max(...prices) : 0
}

// ── Pass 2: Conversation generation ───────────────────────────────────────────
async function generateConversations(companyName, nicheKey, businessIntel, nicheConfig) {
  const products = (businessIntel.products_services || []).slice(0, 6)
    .map(p => `- ${p.name}${p.price ? ` (${p.price} ${p.currency || 'RSD'})` : ''}`)
    .join('\n')

  const channels = nicheConfig.channels || ['Instagram', 'WhatsApp', 'Facebook', 'Web']
  const crmSingular = nicheConfig.terminology?.singular || 'Klijent'

  const prompt = `You generate realistic Serbian social inbox conversations for a SmartFlow AI demo.

Company: ${companyName}
Industry: ${nicheConfig.label || nicheKey}
Products/services:
${products}

${businessIntel.business_summary ? `Business: ${businessIntel.business_summary}` : ''}

Generate 18 conversations spread across the last 30 days. Return ONLY raw JSON:
{
  "conversations": [
    {
      "id": "conv_1",
      "platform": "Instagram|WhatsApp|Facebook|Web",
      "customer_name": "Serbian full name",
      "messages": [
        { "role": "user", "text": "customer message in Serbian" },
        { "role": "assistant", "text": "AI response in Serbian, specific to their products" }
      ]
    }
  ]
}

REQUIREMENTS:
1. At least 4 conversations must use platform "WhatsApp"
2. At least 6 must use "Instagram", 2 "Facebook", 2 "Web"
3. Conversations: 2-6 messages each (vary the length — some short, some longer)
4. The LAST message in exactly ONE conversation must be: { "role": "system", "text": "[HUMAN_NEEDED]" }
   (This shows human escalation — customer is upset, asks for manager, or has a complex issue)
5. ALL text in Serbian (Latin script). Names: common Serbian first+last names.
6. Reference REAL products/services from the list above.
7. Include at least 3 returning customers (reference a previous visit/purchase).
8. AI responses are specific, helpful, reference real products/prices.
9. Include at least 2 complaints or difficult situations (urgent, frustrated customer tone).
10. Include at least 2 short conversations (just 2 messages — customer asks quick question, AI answers).
11. Vary the conversation types: price inquiry, booking request, service question, follow-up, complaint, gift idea, group inquiry, returning client.
12. Prices in conversations are quoted in RSD exactly as the catalogue lists them.

${SERBIAN_STYLE}

${playbookPromptBlock({ isService: !!nicheConfig.useCalendar, strategy: businessIntel.sales_strategy, highTicket: isHighTicket(headlinePriceRsd(businessIntel)), offerTerms: businessIntel.offer_terms })}`

  const resp = await openai.chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.85,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    const data = JSON.parse(resp.choices[0].message.content || '{}')
    return Array.isArray(data.conversations) ? data.conversations : []
  } catch {
    return []
  }
}

// ── Pass 3: CRM contacts for demo_crm ─────────────────────────────────────────
async function generateDemoCrm(companyName, nicheKey, businessIntel, nicheConfig, conversations) {
  const convIds = conversations.slice(0, 6).map((c, i) => c.id || `conv_${i + 1}`)
  const statuses = nicheConfig.terminology?.statuses || ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija']
  const singular = nicheConfig.terminology?.singular || 'Klijent'
  const products = (businessIntel.products_services || []).slice(0, 5).map(p => p.name).join(', ')

  // Build a niche-appropriate status distribution hint
  const isOrderNiche = ['ecommerce', 'furniture', 'fashion', 'supplements'].includes(nicheKey)
  const isApptNiche  = ['dental', 'medical', 'beauty', 'fitness', 'services', 'wellness'].includes(nicheKey)
  const distHint = isOrderNiche
    ? '~25% Novi, ~20% Zainteresovan, ~30% Naručio, ~10% Isporučeno, ~10% Reklamacija, ~5% Intervencija'
    : isApptNiche
      ? '~25% Novi, ~20% Zainteresovan, ~25% Zakazano, ~15% Završeno, ~10% Reklamacija, ~5% Intervencija'
      : '~30% Novi, ~25% Zainteresovan, ~20% ' + statuses[2] + ', ~15% ' + statuses[3] + ', ~8% Reklamacija, ~2% Intervencija'

  const prompt = `Generate CRM contacts for a Serbian business demo dashboard.

Company: ${companyName}
Industry: ${nicheConfig.label || nicheKey}
${products ? `Products/services: ${products}` : ''}
Available conversation IDs (link some contacts to these): ${convIds.join(', ')}

Return ONLY raw JSON:
{
  "contacts": [
    {
      "id_razgovora": "conv_1 or null",
      "full_name": "Serbian full name",
      "telefon": "+381 6x xxx xxxx",
      "kategorija": "category in Serbian, matching the catalogue categories",
      "proizvod": "specific product/service they inquired about",
      "status": "MUST be one of EXACTLY: ${statuses.join('|')}",
      "razlog": "one Serbian sentence: why they are Zainteresovan or Reklamacija (null otherwise)",
      "izvor": "Instagram|WhatsApp|Facebook|Web|Preporuka|Telefon"
    }
  ]
}

Rules:
- Generate 14-16 contacts
- Status distribution: ${distHint}
- CRITICAL: Use ONLY the exact status values listed above — no other values allowed
- Link first 5-6 contacts to conversation IDs (others have null id_razgovora)
- ALL names in Serbian. Telefon format: +381 6x xxx xxxx
- Proizvod must reference real products/services from the business
- Include 2 Reklamacija contacts with specific razlog
- Include 1 Intervencija contact (urgent issue)
- razlog is useful for Zainteresovan (why they haven't ordered) and Reklamacija (what's wrong)

${SERBIAN_STYLE}`

  const resp = await openai.chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    const data = JSON.parse(resp.choices[0].message.content || '{}')
    return Array.isArray(data.contacts) ? data.contacts : []
  } catch {
    return []
  }
}

// ── Pass 4: Services catalog + appointments ────────────────────────────────────
async function generateCatalogAndCalendar(companyName, nicheKey, businessIntel, nicheConfig) {
  const useCalendar = nicheConfig.useCalendar
  const useCatalog  = nicheConfig.useCatalog
  const isVisual    = nicheConfig.isVisualNiche
  const singular    = nicheConfig.terminology?.singular || 'Klijent'

  if (!useCatalog && !useCalendar) return { services: [], appointments: [] }

  // Currency has to survive into this string — extractBusinessIntel tags EUR prices as
  // EUR, but this prompt's own "convert EUR at 117" rule below is worthless if the number
  // arrives here with no unit. A bare "(2650)" reads as RSD by default, which is how a
  // real 310.000+ RSD container sale profiled as a 2.650 RSD toy — the same currency-blind
  // failure mode as the Cvejanović EUR bug, just one prompt earlier in the pipeline.
  const products = (businessIntel.products_services || []).slice(0, 8)
    .map(p => `- ${p.name}${p.price ? ` (${p.price} ${p.currency || 'RSD'})` : ''}${p.category ? ` [${p.category}]` : ''}`)
    .join('\n')

  const catalogPart = useCatalog ? `
"services": [
  {
    "name": "the service/product name only, as a customer would say it — no price-list labels like 'cena', 'cena paketa', 'cenovnik'. Payment steps (rezervacija termina, avans, drugi dolazak) are NOT services — leave them out",
    "category": "category in Serbian (e.g. 'Implantologija', 'Oralna hirurgija', 'Nameštaj za dnevnu sobu')",
    "description": "1-2 sentence description in flawless Serbian",
    "price_min": number_or_null,
    "price_max": number_or_null,
    "duration_minutes": number_or_null,
    "color_hex": "#hexcolor",
    "is_featured": true_or_false,
    "sort_order": number
  }
]` : ''

  const calendarPart = useCalendar ? `
"appointments": [
  {
    "customer_name": "Serbian full name",
    "customer_phone": "+381 6x xxx xxxx",
    "service_name": "service name from catalog",
    "service_color": "#hexcolor matching the service",
    "starts_at": "ISO datetime (spread across next 14 days, business hours 9-18h)",
    "ends_at": "ISO datetime (starts_at + duration)",
    "status": "confirmed|cancelled|completed|no_show",
    "urgency": "low|medium|high|null",
    "urgency_reason": "AI note about why this is urgent (if high) or null",
    "source": "WhatsApp|Instagram|Facebook|Web|Telefon"
  }
]` : ''

  // MAINTAINERS: never put a concrete, copyable figure in the rules below. The EUR-conversion
  // rule used to carry a worked example with real numbers in it; gpt-4o-mini lifted the example
  // figure straight out of the instructions and shipped it as a genuine price for a clinic whose
  // website publishes no prices at all — and that fabricated median then cleared the AOV gate
  // (2026-09-15). State the operation, never an illustrative amount.
  const prompt = `Generate realistic demo catalog/calendar data for a Serbian business.

Company: ${companyName}
Industry: ${nicheConfig.label || nicheKey}
Known products/services:
${products || '(infer from industry)'}

Return ONLY raw JSON:
{${catalogPart ? '\n' + catalogPart + (calendarPart ? ',' : '') : ''}${calendarPart ? '\n' + calendarPart : ''}
}

${useCatalog ? `Services catalog rules:
- Use ONLY the products/services listed above. Do not add, rename or invent any.
- Do not invent prices. If a listed item has no price, set price_min and price_max to null.
- Use colors from this palette: #0ea5e9 #10b981 #f97316 #8b5cf6 #ec4899 #ef4444 #f59e0b #06b6d4
- Mark 2-3 as is_featured: true
- Carry through the exact price given for each item; never substitute a plausible one
- price_min/price_max are ALWAYS in RSD. If a listed item's price is given in EUR, multiply it
  by 117. If it is given in RSD, leave it exactly as is. If it has no price, null.
  Never write a number that does not come from the list above.
- Include duration_minutes for scheduling niches
- sort_order: 1 = most popular` : ''}

${useCalendar ? `Calendar rules:
- Generate 18-22 appointments spread across next 14 days
- Business hours: 9:00-18:00
- Status mix: ~65% confirmed, ~15% completed, ~10% cancelled, ~10% no_show
- Urgency: ~15% high (with AI urgency_reason), ~25% medium, ~60% low/null
- High urgency reasons are brief clinical/commercial notes in Serbian
- Include some double-bookings (same time slot, different customers) — real clinics have these` : ''}

ALL text in Serbian.

${SERBIAN_STYLE}`

  const resp = await openai.chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.75,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: prompt }],
  })

  try {
    const data = JSON.parse(resp.choices[0].message.content || '{}')
    return {
      services:     Array.isArray(data.services)     ? data.services     : [],
      appointments: Array.isArray(data.appointments) ? data.appointments : [],
    }
  } catch {
    return { services: [], appointments: [] }
  }
}

// ── Validation ─────────────────────────────────────────────────────────────────
function validateConversations(conversations, nicheConfig) {
  const errors = []

  if (conversations.length < 8) errors.push('Too few conversations (need ≥8)')

  const hasHumanNeeded = conversations.some(c =>
    (c.messages || []).some(m => m.text === '[HUMAN_NEEDED]')
  )
  if (!hasHumanNeeded) errors.push('Missing [HUMAN_NEEDED] message')

  const platforms = new Set(conversations.map(c => (c.platform || '').toLowerCase()))
  if (!platforms.has('whatsapp')) errors.push('Missing WhatsApp channel')

  return errors
}

// ── Supabase provisioning ──────────────────────────────────────────────────────
/**
 * A rebuilt lead gets a brand-new tenant (new client id), which used to leave the opening
 * wallpaper behind on the old one: Cvejanović was rebuilt 2026-09-15 and opened on a flat
 * dark screen. Carry the art over — same business, same picture — instead of paying for a
 * new image or shipping a demo without one.
 */
async function inheritIntroArt(sb, oldClientId, newClientId) {
  if (!oldClientId || oldClientId === newClientId) return
  const { data: old } = await sb.from('clients').select('onboarding_copy').eq('id', oldClientId).single()
  const art = old?.onboarding_copy?.intro_art
  if (!art) return
  const dir = resolve(__dirname, 'public/onboarding/intro')
  const from = resolve(dir, `${oldClientId}.jpg`)
  if (!existsSync(from)) return
  copyFileSync(from, resolve(dir, `${newClientId}.jpg`))
  const { data: cur } = await sb.from('clients').select('onboarding_copy').eq('id', newClientId).single()
  await sb.from('clients').update({ onboarding_copy: { ...(cur?.onboarding_copy || {}),
    intro_art: `/onboarding/intro/${newClientId}.jpg`, intro_art_at: old.onboarding_copy.intro_art_at || new Date().toISOString(),
    brand_logo: old.onboarding_copy.brand_logo || null } }).eq('id', newClientId)
  console.log(`│  ✓ Intro art inherited from previous tenant`)
}

async function provisionTenant(sb, lead, brandName, password) {
  const email = lead.email
  let authEmail = email

  // Create auth user
  const { data: authData, error: authErr } = await sb.auth.admin.createUser({
    email: authEmail,
    password,
    email_confirm: true,
  })

  if (authErr) {
    if (authErr.message.toLowerCase().includes('already') || authErr.code === 'email_exists') {
      const hash = randomBytes(3).toString('hex')
      authEmail = email.replace('@', `+demo${hash}@`)
      const { error: retryErr } = await sb.auth.admin.createUser({
        email: authEmail, password, email_confirm: true,
      })
      if (retryErr) throw new Error(`Auth user error (suffix): ${retryErr.message}`)
      console.log(`  Auth: ${authEmail} (suffixed)`)
    } else {
      throw new Error(`Auth user error: ${authErr.message}`)
    }
  } else {
    console.log(`  Auth: ${authEmail} (${authData?.user?.id || 'created'})`)
  }

  // Get or create client record
  const { data: existing } = await sb
    .from('clients').select('id').eq('email', authEmail).maybeSingle()

  let clientId
  if (existing) {
    clientId = existing.id
    console.log(`  Client: ${clientId} (already exists)`)
  } else {
    const { data: newClient, error: clientErr } = await sb
      .from('clients')
      .insert({ name: brandName || lead.company_name, email: authEmail })
      .select('id').single()
    if (clientErr) throw new Error(`Client insert: ${clientErr.message}`)
    clientId = newClient.id
    console.log(`  Client: ${clientId} (created)`)
  }

  return { clientId, authEmail }
}

// ── Module provisioning ────────────────────────────────────────────────────────
async function provisionModules(sb, clientId, nicheKey, nicheConfig) {
  const baseKeys = nicheConfig.modules || ['business-crm', 'social-chatbot', 'chatbot-analytics']
  // Every demo tenant also gets the persistent "Ponuda" tab (the offer).
  const moduleKeys = [...baseKeys, 'ponuda']

  const LABEL_MAP = {
    'business-crm':      nicheConfig.crmLabel || 'Klijenti',
    'social-chatbot':    'AI Inbox',
    'agent-database':    nicheConfig.catalogLabel || 'Usluge',
    'calendar':          nicheConfig.calendarLabel || 'Termini',
    'chatbot-analytics': 'Analitika',
    'ponuda':            'Ponuda',
  }

  // Fix: analytics key must be 'chatbot-analytics', not 'analytics'
  const modules = moduleKeys.map((key, i) => ({
    client_id:    clientId,
    module_key:   key,       // already correct from niche-config.json
    is_enabled:   true,
    display_name: LABEL_MAP[key] || key,
    sort_order:   i + 1,
    settings:     null,
  }))

  // Delete stale modules (e.g. from old provisioning with wrong key)
  await sb.from('client_modules').delete().eq('client_id', clientId)

  const { error } = await sb
    .from('client_modules')
    .upsert(modules, { onConflict: 'client_id,module_key' })
  if (error) throw new Error(`Modules upsert: ${error.message}`)
  console.log(`  Modules: ${modules.map(m => m.module_key).join(', ')}`)
}

// ── Update client with niche ───────────────────────────────────────────────────
async function updateClientNiche(sb, clientId, nicheKey, brandColor) {
  const { error } = await sb
    .from('clients')
    .update({ demo_niche: nicheKey, demo_brand_color: brandColor })
    .eq('id', clientId)
  if (error) console.warn(`  ⚠ Failed to update demo_niche: ${error.message}`)
  else console.log(`  Niche: ${nicheKey}`)
}

// ── Seeders ────────────────────────────────────────────────────────────────────
const FEMALE_NAMES = new Set(['jovana', 'milica', 'ana', 'nina', 'iva', 'tamara', 'jelena', 'marija', 'maja', 'aleksandra', 'katarina', 'tijana'])
const PIC_MALE   = ['https://randomuser.me/api/portraits/men/32.jpg', 'https://randomuser.me/api/portraits/men/47.jpg', 'https://randomuser.me/api/portraits/men/67.jpg', 'https://randomuser.me/api/portraits/men/77.jpg']
const PIC_FEMALE = ['https://randomuser.me/api/portraits/women/44.jpg', 'https://randomuser.me/api/portraits/women/23.jpg', 'https://randomuser.me/api/portraits/women/61.jpg', 'https://randomuser.me/api/portraits/women/5.jpg']

function pickPic(name, idx) {
  const first = (name || '').split(' ')[0].toLowerCase()
  const pics = FEMALE_NAMES.has(first) ? PIC_FEMALE : PIC_MALE
  return pics[idx % pics.length]
}

const VALID_PLATFORMS = new Set(['instagram', 'facebook', 'website', 'whatsapp'])

// Distribute conversations across 30 days — weighted toward recent (more activity = more convincing demo)
const CONV_SPREAD_HOURS = [
  1, 4, 11, 20, 32, 47, 66, 90, 120, 156,
  200, 252, 312, 380, 456, 528, 600, 648, 696, 720,
]

async function seedRazgovori(sb, clientId, conversations) {
  const msgs = []
  conversations.forEach((conv, convIdx) => {
    const convId   = `demo_${clientId.slice(0, 8)}_${conv.id || convIdx + 1}`
    const pic      = pickPic(conv.customer_name, convIdx)
    const baseH    = CONV_SPREAD_HOURS[convIdx] ?? (720 + convIdx * 24)
    const platform = VALID_PLATFORMS.has((conv.platform || '').toLowerCase())
      ? conv.platform.toLowerCase() : 'instagram'

    ;(conv.messages || []).forEach((msg, msgIdx) => {
      msgs.push({
        id_razgovora: convId,
        role:         ['assistant', 'system'].includes(msg.role) ? msg.role : 'user',
        // the agent always addresses the customer formally (Vas/Vam), whatever the model wrote
        message:      msg.role === 'assistant' ? formalVi(msg.text || '') : (msg.text || ''),
        // two minutes apart: the agent answers right away
        created_at:   hoursAgo(baseH, -msgIdx * 2),
        platform,
        client_id:    clientId,
        metadata:     { name: conv.customer_name, profile_pic: pic },
      })
    })
  })

  const BATCH = 50
  for (let i = 0; i < msgs.length; i += BATCH) {
    const { error } = await sb.from('razgovori').insert(msgs.slice(i, i + BATCH))
    if (error) throw new Error(`Razgovori batch: ${error.message}`)
  }
  console.log(`  Inbox: ${msgs.length} messages across ${conversations.length} conversations`)
}

async function seedDemoCrm(sb, clientId, contacts, conversations, nicheConfig) {
  // Build conv ID map so we can properly link
  const convIdMap = {}
  conversations.forEach((c, i) => {
    convIdMap[c.id || `conv_${i + 1}`] = `demo_${clientId.slice(0, 8)}_${c.id || i + 1}`
  })

  // Accept statuses from the niche config — never hardcode appointment statuses for product niches
  const nicheStatuses = nicheConfig?.terminology?.statuses || []
  const VALID_STATUSES = new Set([
    ...nicheStatuses,
    'Novi', 'Zainteresovan', 'Reklamacija', 'Intervencija', // always valid
  ])
  const VALID_IZVORI   = new Set(['Instagram', 'WhatsApp', 'Facebook', 'Web', 'Preporuka', 'Telefon'])

  const rows = contacts.map((c, i) => ({
    client_id:       clientId,
    id_razgovora:    c.id_razgovora ? (convIdMap[c.id_razgovora] || null) : null,
    full_name:       c.full_name || 'Klijent',
    email:           c.email || null,
    telefon:         randomSrbPhone(),
    kategorija:      c.kategorija || null,
    proizvod:        c.proizvod || null,
    status:          VALID_STATUSES.has(c.status) ? c.status : 'Novi',
    razlog:          c.razlog || null,
    status_porudzbine: c.status_porudzbine || null,
    izvor:           VALID_IZVORI.has(c.izvor) ? c.izvor : 'Instagram',
    komentar:        c.komentar || null,
    created_at:      daysAgo(i + 1, 9 + (i % 8), (i * 17) % 60),
  }))

  const { error } = await sb.from('demo_crm').insert(rows)
  if (error) throw new Error(`demo_crm insert: ${error.message}`)
  console.log(`  CRM: ${rows.length} contacts inserted`)
}

// Payment steps are not services: Cvejanović's "Rezervacija termina 500 €" (the deposit) was
// listed as a 58.500 RSD treatment and quoted back as one.
const PAYMENT_STEP = /^(rezervacija( termina)?|avans|akontacija|depozit|uplata|kapara|(prvi|drugi|treći|treci|četvrti) dolazak)\b/i

async function seedServicesCatalog(sb, clientId, services) {
  services = services.filter((s) => !PAYMENT_STEP.test(String(s.name || '').trim()))
  if (!services.length) return
  const rows = services.map((s, i) => ({
    client_id:       clientId,
    name:            cleanServiceName(s.name) || `Usluga ${i + 1}`,
    category:        s.category || null,
    description:     s.description || null,
    price_min:       typeof s.price_min === 'number' ? s.price_min : null,
    price_max:       typeof s.price_max === 'number' ? s.price_max : null,
    duration_minutes: typeof s.duration_minutes === 'number' ? s.duration_minutes : null,
    image_url:       s.image_url || null,
    color_hex:       /^#[0-9a-fA-F]{6}$/.test(s.color_hex || '') ? s.color_hex : '#6366f1',
    is_featured:     !!s.is_featured,
    metadata:        s.metadata || null,
    sort_order:      typeof s.sort_order === 'number' ? s.sort_order : i + 1,
  }))

  const { error } = await sb.from('services_catalog').insert(rows)
  if (error) throw new Error(`services_catalog insert: ${error.message}`)
  console.log(`  Catalog: ${rows.length} services inserted`)
}

// ── The AOV gate ─────────────────────────────────────────────────────────────
// At a ~400 EUR/mo retainer the system has to plausibly return 2.000–4.000 EUR/mo.
// Work that backwards against the client's own price list:
//   dental implant  60.000 RSD → 4 extra cases/mo covers it many times over
//   pergola        120.000 RSD → ONE extra sale pays for two years
//   leather jacket  25.000 RSD → ~10 extra sales/mo. Plausible at 39k followers
//   chocolate        2.000 RSD → ~150 extra orders/mo. Not plausible, ever
//
// Follower count was never the qualifier — average order value is. Below this
// line the arithmetic cannot work no matter how many DMs they receive, so we
// refuse to spend a demo build on them.
export const MIN_AOV_RSD = 15000

export function assessAov(services = []) {
  const prices = services
    .map(s => (typeof s.price_min === 'number' ? s.price_min : null))
    .filter(p => p && p > 0)
    .sort((a, b) => a - b)
  if (prices.length < 2) return { aov: null, verdict: 'unknown', prices }
  const median = prices[Math.floor(prices.length / 2)]
  return {
    aov: median,
    verdict: median >= MIN_AOV_RSD ? 'pass' : 'fail',
    prices,
  }
}

async function seedAppointments(sb, clientId, appointments, services) {
  if (!appointments.length) return

  // Build service color map + duration from catalog seed
  const serviceColors = {}
  const serviceDurations = {}
  services.forEach(s => {
    if (s.name) {
      serviceColors[s.name]    = s.color_hex || '#6366f1'
      serviceDurations[s.name] = s.duration_minutes || 60
    }
  })

  const VALID_STATUSES = new Set(['confirmed', 'cancelled', 'completed', 'no_show'])
  const VALID_URGENCY  = new Set(['low', 'medium', 'high'])

  const now = new Date()
  const SPREAD = appointments.length

  const rows = appointments.map((a, i) => {
    // Spread appointments: first 30% in the past (-4 to -1 days), rest in the future (1-12 days)
    const fraction = i / SPREAD
    const dayOffset = fraction < 0.3
      ? Math.round(-4 + fraction / 0.3 * 3)   // -4 to -1 for past appointments
      : Math.round(1 + (fraction - 0.3) / 0.7 * 11) // 1 to 12 for future
    const hour      = 9 + (i % 8)             // 9h–17h
    const minute    = [0, 30][i % 2]
    const startsAt  = daysFromNow(dayOffset, hour, minute)

    // Status must match temporal logic: past appts = completed/no_show, future = confirmed/cancelled
    const isPast = dayOffset < 0
    const deterministicStatus = isPast
      ? (i % 5 === 0 ? 'no_show' : 'completed')
      : (i % 7 === 0 ? 'cancelled' : 'confirmed')

    const duration = serviceDurations[a.service_name] || a.duration_minutes || 60
    const endsAt   = (() => {
      const d = new Date(startsAt)
      d.setMinutes(d.getMinutes() + duration)
      return d.toISOString()
    })()

    return {
      client_id:      clientId,
      customer_name:  a.customer_name || 'Klijent',
      customer_phone: randomSrbPhone(),
      service_name:   a.service_name || 'Usluga',
      service_color:  serviceColors[a.service_name] || a.service_color || '#6366f1',
      starts_at:      startsAt,
      ends_at:        endsAt,
      status:         deterministicStatus,
      urgency:        VALID_URGENCY.has(a.urgency) ? a.urgency : null,
      urgency_reason: a.urgency_reason || null,
      source:         a.source || 'Instagram',
      notes:          a.notes || null,
    }
  })

  const BATCH = 50
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await sb.from('appointments').insert(rows.slice(i, i + BATCH))
    if (error) throw new Error(`appointments batch: ${error.message}`)
  }
  console.log(`  Calendar: ${rows.length} appointments inserted`)
}

// ── Delete stale seeds (for --reseed-only) ────────────────────────────────────
async function deleteStaleSeeds(sb, clientId) {
  await Promise.all([
    sb.from('demo_crm').delete().eq('client_id', clientId),
    sb.from('services_catalog').delete().eq('client_id', clientId),
    sb.from('appointments').delete().eq('client_id', clientId),
    sb.from('razgovori').delete().eq('client_id', clientId).like('id_razgovora', `demo_${clientId.slice(0, 8)}_%`),
  ])
}

// ── Build demo for one lead ────────────────────────────────────────────────────
/**
 * Where a lead goes when its build is skipped. A NEW lead is parked at 'sourced' for a human
 * look. A lead that already has a working demo keeps its stage: a failed REBUILD (site down,
 * catalogue unreadable) used to un-approve it, which is how Belodore dropped out of the queue
 * on 2026-10-24 while its existing demo was fine.
 */
function parkStage(lead) {
  return lead?.demo_client_id && lead?.demo_built_at ? {} : { pipeline_stage: 'sourced' }
}

async function buildDemoForLead(sb, lead) {
  const name = lead.company_name || '(no name)'
  console.log(`\n┌─ ${name}`)
  console.log(`│  ID:      ${lead.id}`)
  console.log(`│  Email:   ${lead.email}`)
  console.log(`│  Website: ${lead.website || '(none)'}`)

  if (lead.demo_built_at && !isForce && !isReseedOnly) {
    console.log(`│  ↷ Already built (${lead.demo_built_at}) — skipping (use --force or --reseed-only)`)
    console.log(`└─────`)
    return { skipped: true }
  }

  if (isReseedOnly && !lead.demo_client_id) {
    console.log(`│  ↷ No demo_client_id — skipping reseed (run without --reseed-only first)`)
    console.log(`└─────`)
    return { skipped: true }
  }

  if (isDryRun) {
    const igCategory = lead.intake_data?.enrichment?.instagram_profile?.business_category || ''
    const nicheKey = inferNicheKey(lead.niche || lead.niche_v2, igCategory, lead.company_name || '')
    console.log(`│  ✓ [DRY RUN] niche=${nicheKey}, modules=${NICHE_CONFIGS[nicheKey]?.modules?.join(',')}`)
    console.log(`└─────`)
    return { dryRun: true }
  }

  // Step 1: Firecrawl
  console.log(`│  [1/5] Scraping website...`)
  let websiteContent = ''
  try {
    websiteContent = await scrapeWebsite(lead.website)
    console.log(`│         ${websiteContent.length} chars scraped`)
  } catch (err) {
    console.log(`│         ⚠ Scrape failed: ${err.message}`)
  }

  // Determine niche
  const rawNiche = lead.niche_v2 || lead.niche || ''
  const igCategory = lead.intake_data?.enrichment?.instagram_profile?.business_category || ''
  const nicheKey = inferNicheKey(rawNiche, `${igCategory} ${websiteContent.slice(0, 800)}`, lead.company_name || '')
  const nicheConfig = NICHE_CONFIGS[nicheKey] || NICHE_CONFIGS.generic
  console.log(`│  Niche: ${nicheKey} (from "${rawNiche || 'unknown'}")`)

  // No scraped content means every downstream fact would be invented. The prompt
  // no longer guesses, so the build would produce an empty shell anyway — stop here
  // and keep the four GPT calls and the tenant row unspent.
  if (!websiteContent.trim()) {
    console.log(`│  ⛔ No website content scraped — refusing to build a demo on invented data.`)
    // pipeline_stage moves off 'demo_building' on every skip path below (not just this
    // one) — --approved's query is `pipeline_stage='demo_building' AND demo_built_at IS
    // NULL`, which never changes on a skip, so an unpatched skip gets re-scraped from
    // scratch on every single future pipeline run forever. Confirmed this burned real
    // Firecrawl credits repeatedly today (VILLA Palace retried on every ~25min loop tick
    // with an identical "0 products" result each time). 'sourced' is reversible — a human
    // or a future qualify_queue.mjs pass can still re-promote it deliberately.
    await sb.from('contacts').update({
      ...parkStage(lead),
      comment: 'Demo preskočen: sajt nije skrejpovan, nema realnih podataka za demo.',
    }).eq('id', lead.id)
    return { skipped: 'no_website_content' }
  }

  // Step 2a: Business intelligence extraction
  console.log(`│  [2a/5] Extracting business intel...`)
  const businessIntel = await extractBusinessIntel(name, nicheKey, websiteContent)
  const brandName = businessIntel.brand_name || name
  console.log(`│         Brand: ${brandName} | ${(businessIntel.products_services || []).length} products/services found`)
  if (process.env.DEBUG_INTEL) console.log('DEBUG products_services:', JSON.stringify(businessIntel.products_services))

  // Step 2a+: HOW does this business sell, and what stops its buyers? One reasoning pass
  // (lib/objection-engine.mjs) decides booking / quote / order from the site itself, writes the
  // grounded objection replies, and re-keys the niche when the keyword guess was wrong
  // (a container maker is not an appointment business; a phone-repair shop is not a car dealer).
  const catalogueLines = (businessIntel.products_services || []).slice(0, 25).map(p => `${p.name} — ${p.price ? `${p.price} ${p.currency || 'RSD'}` : 'cena nije navedena'} — ${p.category || ''}`).join('\n')
  const strategy = await analyzeBusiness(openai, { name, evidence: websiteContent, catalogue: catalogueLines, terms: businessIntel.offer_terms, fallbackModel: salesModelOf(nicheKey), highTicket: headlinePriceRsd(businessIntel) >= 100000 })
  // The model's booking/quote/order guess is NOT used to re-key the niche any more: that single
  // label is what put JetSet on a calendar. The Business Sheet (Step 7b) decides from the site's own
  // sentences. The objection strategy is kept: it is grounded reply by reply.
  console.log(`│         Objection strategy: ${strategy.failed ? 'failed (' + strategy.error.slice(0, 50) + ')' : strategy.worries.length + ' grounded replies'}`)
  businessIntel.sales_strategy = strategy.failed ? null : strategy

  // A directory/aggregator (e.g. wellness-spa.rs, listing dozens of separate spa hotels by
  // region and price tier) has plenty of real prices on it, but they belong to OTHER
  // businesses, not this lead — a demo built from that catalogue misrepresents a company
  // that doesn't own that inventory. Caught this manually on Wellness Spa on 09-10 after
  // already having "fixed" it once; this check is meant to catch the next one automatically.
  if (businessIntel.is_directory_or_aggregator) {
    console.log(`│  ⛔ Site is a directory/aggregator, not a single business: ${businessIntel.directory_reason || '(no reason given)'}`)
    await sb.from('contacts').update({
      status: 'Disqualified',
      ...parkStage(lead),
      comment: `Demo preskočen: sajt je direktorijum/agregator, ne pojedinačan biznis. ${businessIntel.directory_reason || ''}`.trim(),
    }).eq('id', lead.id)
    return { skipped: 'directory_or_aggregator' }
  }

  // A catalogue niche with no scraped products has nothing real to show. The old
  // code invented one here, which is how a bike shop ended up selling face cream.
  //
  // Checked HERE, immediately after intel extraction, rather than after 2b/2c: this is a
  // terminal decision that does not depend on the conversations or the CRM contacts, and
  // running it last meant every skipped lead still paid for 18 generated conversations and
  // 14 CRM contacts first (observed on dr Marija Bošković, 2026-09-15).
  if (nicheConfig.useCatalog && !(businessIntel.products_services || []).length) {
    console.log(`│  ⛔ No real products/services found on the site — refusing to invent a catalogue.`)
    await sb.from('contacts').update({
      ...parkStage(lead),
      comment: 'Demo preskočen: na sajtu nije pronađen nijedan proizvod/usluga za katalog.',
    }).eq('id', lead.id)
    return { skipped: 'no_catalog_source' }
  }

  await sleep(800)

  // Step 2b: Generate conversations
  console.log(`│  [2b/5] Generating conversations...`)
  let conversations = []
  let attempts = 0
  while (attempts < 3) {
    conversations = await generateConversations(brandName, nicheKey, businessIntel, nicheConfig)
    const errors = validateConversations(conversations, nicheConfig)
    if (errors.length === 0) break
    console.log(`│         ⚠ Validation (attempt ${attempts + 1}): ${errors.join(', ')} — retrying`)
    attempts++
    await sleep(500)
  }
  if (conversations.length === 0) {
    // The fallback wrote the raw niche key straight into customer dialogue —
    // "zanima me cena vaših usluga za generic?" — and shipped it as a real demo.
    // Three failed attempts means something is wrong with this lead's data;
    // sending them a canned conversation is worse than sending nothing.
    console.log(`│  ⛔ Conversation generation failed 3× — refusing to ship canned dialogue.`)
    await sb.from('contacts').update({
      ...parkStage(lead),
      comment: 'Demo preskočen: generisanje razgovora nije prošlo validaciju 3 puta.',
    }).eq('id', lead.id)
    return { skipped: 'conversation_generation_failed' }
  }
  console.log(`│         ${conversations.length} conversations generated`)

  await sleep(800)

  // Step 2c: CRM contacts
  console.log(`│  [2c/5] Generating CRM contacts...`)
  const crmContacts = await generateDemoCrm(brandName, nicheKey, businessIntel, nicheConfig, conversations)
  console.log(`│         ${crmContacts.length} contacts`)

  await sleep(800)

  // Step 2d: Catalog + calendar (if needed)
  let services = [], appointments = []
  if (nicheConfig.useCatalog || nicheConfig.useCalendar) {
    console.log(`│  [2d/5] Generating catalog/calendar...`)
    const result = await generateCatalogAndCalendar(brandName, nicheKey, businessIntel, nicheConfig)
    services     = result.services || []
    appointments = result.appointments || []

    // Ground every price in code, not in the prompt.
    //
    // The catalog prompt says "do not invent prices; if a listed item has no price, set
    // price_min/price_max to null". gpt-4o-mini ignores it. On laserestetika.rs — a clinic
    // whose site publishes no prices anywhere — it produced a 655.200 RSD median in one run
    // (lifted from a worked example in the prompt) and a 10.000 RSD median in the next. The
    // first sailed through the AOV gate, the second failed it. Both numbers were fabricated,
    // so the gate was judging the lead on fiction either way, and a fabricated price in a
    // demo is exactly what gets a founder caught out on a call.
    //
    // A model instruction cannot be trusted for this. Prices are now taken only from the
    // scraped `products_services` list, matched by name; anything the generator invented for
    // an item with no scraped price is discarded.
    const scrapedPrices = new Map()
    for (const ps of businessIntel.products_services || []) {
      const val = typeof ps.price === 'string' ? parseFloat(ps.price.replace(/[^\d.]/g, '')) : ps.price
      if (!val || !Number.isFinite(val)) continue
      const rsd = String(ps.currency || 'RSD').toUpperCase().startsWith('EUR') || ps.currency === '€'
        ? Math.round(val * 117) : Math.round(val)
      scrapedPrices.set(String(ps.name || '').trim().toLowerCase(), rsd)
    }
    let stripped = 0
    for (const svc of services) {
      const key = String(svc.name || '').trim().toLowerCase()
      const real = scrapedPrices.get(key)
      if (real != null) { svc.price_min = real; svc.price_max = real; continue }
      if (svc.price_min != null || svc.price_max != null) stripped++
      svc.price_min = null
      svc.price_max = null
    }
    if (stripped) console.log(`│         stripped ${stripped} invented price(s) — kept only prices found on the site`)
    console.log(`│         ${services.length} services, ${appointments.length} appointments`)
    if (process.env.DEBUG_INTEL) console.log('DEBUG services:', JSON.stringify(services))
    await sleep(800)
  }

  // ── AOV gate ────────────────────────────────────────────────────────────
  // Runs BEFORE provisioning, which is what the old comment here claimed while the
  // code did the opposite: provisionTenant() ran first, so every lead the gate
  // rejected left an orphaned Supabase tenant and auth user behind.
  const aov = assessAov(services)
  if (aov.verdict === 'fail' && !process.argv.includes('--ignore-aov')) {
    console.log(`│  ⛔ AOV GATE: median price ${aov.aov.toLocaleString('de-DE')} RSD < ${MIN_AOV_RSD.toLocaleString('de-DE')} RSD`)
    console.log(`│     At a ~400 EUR/mo retainer this business would need an implausible number of`)
    console.log(`│     extra sales to break even. Skipping build. Override with --ignore-aov.`)
    await sb.from('contacts').update({
      status: 'Disqualified',
      ...parkStage(lead),
      comment: `AOV gate: medijana cene ${aov.aov} RSD (prag ${MIN_AOV_RSD}). Prenizak tiket za mesečni retainer.`,
    }).eq('id', lead.id)
    return { skipped: 'aov', aov: aov.aov }
  }
  // Categories where a single transaction is unambiguously above the floor no matter what the
  // site publishes: dental implants and prosthetics, aesthetic medicine, property, weddings,
  // pergolas. These businesses very often publish no price list at all ("cena na
  // konsultacijama" is the norm in Serbian aesthetic medicine), so demanding a scraped price
  // disqualifies the *best* leads in the pipeline for a reason that has nothing to do with
  // whether they can afford a retainer. dr Marija Bošković — 60k followers, Belgrade
  // aesthetic-medicine clinic, 30 named treatments — was rejected exactly this way on
  // 2026-09-15. Deliberately narrow: beauty salons, gyms and auto shops are NOT here, because
  // for those the floor is a real question.
  const HIGH_TICKET_NICHES = new Set(['dental', 'medical', 'real-estate', 'vencanja', 'pergole'])
  const MIN_SERVICES_FOR_EXEMPTION = 5

  if (aov.verdict === 'pass') console.log(`│  ✓ AOV gate: median ${aov.aov.toLocaleString('de-DE')} RSD`)
  else if (aov.verdict === 'unknown' && HIGH_TICKET_NICHES.has(nicheKey) && services.length >= MIN_SERVICES_FOR_EXEMPTION) {
    console.log(`│  ✓ AOV gate: no published prices, but "${nicheKey}" is high-ticket by category`)
    console.log(`│     (${services.length} named services found — category exemption, not a guess).`)
  }
  else {
    console.log(`│  ⛔ AOV UNKNOWN: only ${aov.prices.length} priced item(s) in the catalogue.`)
    console.log(`│     We cannot price this business, so we cannot judge whether it can afford us,`)
    console.log(`│     and a demo built on unpriced guesses is the cream-fallback failure again.`)
    console.log(`│     Scrape a real price list first. Override with --ignore-aov.`)
    if (!process.argv.includes('--ignore-aov')) {
      await sb.from('contacts').update({
        ...parkStage(lead),
        comment: `AOV nepoznat: samo ${aov.prices.length} stavki sa cenom. Potreban cenovnik pre demoa.`,
      }).eq('id', lead.id)
      return { skipped: 'aov_unknown', aov: null }
    }
  }

  // Step 3: Provision tenant (skip if --reseed-only)
  let clientId, authEmail, password
  // A lead that already has a working tenant is rebuilt INTO it (same login), never into a
  // new one. --force used to provision a fresh tenant with new credentials, which broke the
  // demo link for anyone already emailed and left the opening wallpaper on the old tenant
  // (Cvejanović, 2026-09-15). The old tenant is only abandoned if it no longer exists.
  let reuse = isReseedOnly
  if (!reuse && lead.demo_client_id && lead.demo_tenant_email) {
    const { data: existing } = await sb.from('clients').select('id').eq('id', lead.demo_client_id).maybeSingle()
    reuse = !!existing
  }
  if (reuse) {
    clientId  = lead.demo_client_id
    authEmail = lead.demo_tenant_email
    password  = lead.demo_tenant_password
    console.log(`│  [3/5] Rebuilding into existing client ${clientId} (login unchanged)`)
    await deleteStaleSeeds(sb, clientId)
    // The display name came from the lead row ("Stomatoloska ordinacija Cvejanovic", "Dallas
    // Nameštaj Нови Пазар"). Restore diacritics from the site's spelling; never drop words.
    const { data: cur } = await sb.from('clients').select('name').eq('id', clientId).maybeSingle()
    const fixedName = properName(cur?.name, brandName)
    if (cur?.name && fixedName !== cur.name) {
      await sb.from('clients').update({ name: fixedName }).eq('id', clientId)
      console.log(`│  ✓ Name corrected: "${cur.name}" → "${fixedName}"`)
    }
  } else {
    console.log(`│  [3/5] Provisioning Supabase tenant...`)
    password = genPassword()
    const provisioned = await provisionTenant(sb, lead, brandName, password)
    clientId  = provisioned.clientId
    authEmail = provisioned.authEmail
    await inheritIntroArt(sb, lead.demo_client_id, clientId)
  }

  // Step 4: Upsert modules + niche
  console.log(`│  [4/5] Provisioning modules + niche...`)
  await provisionModules(sb, clientId, nicheKey, nicheConfig)
  await updateClientNiche(sb, clientId, nicheKey, nicheConfig.brandColor)

  // Step 5: Seed all tables
  console.log(`│  [5/5] Seeding data...`)
  await seedRazgovori(sb, clientId, conversations)
  await seedDemoCrm(sb, clientId, crmContacts, conversations, nicheConfig)
  if (nicheConfig.useCatalog && services.length) await seedServicesCatalog(sb, clientId, services)
  if (nicheConfig.useCalendar && appointments.length) await seedAppointments(sb, clientId, appointments, services)

  // Step 6: Generate per-brand onboarding copy and store on clients row
  try {
    const moduleKeys = nicheConfig.modules || ['business-crm', 'social-chatbot', 'chatbot-analytics']
    const productSummary = businessIntel?.business_summary || ''
    const sys = `Ti si copywriter za SmartFlow. Napiši kratak, topao onboarding tekst na srpskom za dashboard brenda "${brandName}" (delatnost: ${nicheKey}). Vrati ISKLJUČIVO JSON objekat: {"welcome": "...", "modules": { "<key>": "..." }, "finish": "..."}. "welcome": jedna rečenica dobrodošlice koja pomene brend (završava sa 👋). Za svaki ključ iz [${moduleKeys.map(k => `"${k}"`).join(', ')}] jedna rečenica šta taj modul radi baš za ovaj brend. "finish": jedna rečenica ohrabrenja. Bez emodžija osim 👋 u welcome. Kontekst: ${productSummary || 'n/a'}.`
    const resp = await openai.chat.completions.create({
      model: TEXT_MODEL,
      temperature: 0.5,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: sys }],
    })
    const parsed = JSON.parse(resp.choices[0].message.content || '{}')
    // MERGE, never replace: onboarding_copy also carries intro_art / brand_logo (written later by
    // generate_intro_art.mjs) and offer_terms. A plain overwrite here wiped the opening wallpaper
    // every time a demo was re-seeded — that is why Cvejanović opened on a flat dark screen.
    const { data: cur } = await sb.from('clients').select('onboarding_copy').eq('id', clientId).single()
    const merged = { ...(cur?.onboarding_copy || {}), ...(parsed?.welcome && parsed?.modules ? parsed : {}), offer_terms: businessIntel?.offer_terms || null,
      sales_strategy: businessIntel?.sales_strategy || null,
      // Shown in the catalogue as "Povezano sa <domain>". Only scrape_catalog_images.mjs wrote this
      // before, so 33 of 35 demos had no proof the catalogue came from the prospect's own site.
      catalog_source: lead.website ? String(lead.website).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '') : (cur?.onboarding_copy?.catalog_source ?? null),
      catalog_synced_at: new Date().toISOString() }
    await sb.from('clients').update({ onboarding_copy: merged }).eq('id', clientId)
    console.log(`│  ✓ Onboarding copy + offer terms stored`)
  } catch (e) {
    console.warn(`│  ⚠ Onboarding copy skipped: ${e.message}`)
  }

  // Step 7: Writeback to contacts
  if (reuse) {
    await sb.from('contacts').update({ demo_built_at: new Date().toISOString() }).eq('id', lead.id)
  } else {
    const { error: wbErr } = await sb.from('contacts').update({
      demo_tenant_email:    authEmail,
      demo_tenant_password: password,
      demo_tenant_url:      APP_URL,
      demo_built_at:        new Date().toISOString(),
      demo_client_id:       clientId,
    }).eq('id', lead.id)
    if (wbErr) throw new Error(`Writeback failed: ${wbErr.message}`)
  }

  // Step 7b: the Business Reality Sheet decides the tabs, statuses and story (build_sheets.mjs):
  // what this business sells and how its customers buy, each claim tied to a sentence on its site,
  // plus the products its listing pages show. Before this existed a template label decided, and a
  // phone store whose site says "bez zakazivanja" got a calendar (JetSet, 2026-10-26).
  if (authEmail) {
    try {
      const { stdout } = await execFileAsync('node', [resolve(__dirname, 'build_sheets.mjs'), '--email', authEmail, '--import-listings'], { maxBuffer: 10 * 1024 * 1024 })
      console.log(stdout.split('\n').filter(Boolean).map((l) => `│  ${l}`).join('\n'))
    } catch (e) { console.warn(`│  ⚠ Business Sheet failed: ${e.message}`) }
  }

  // Step 8: Seed the connected onboarding story (same customer across Inbox + CRM + Termini)
  if (authEmail) {
    try {
      await execFileAsync('node', [resolve(__dirname, 'seed_onboarding_story.mjs'), '--email', authEmail])
      console.log(`│  ✓ Onboarding story seeded`)
    } catch (e) { console.warn(`│  ⚠ Story seed skipped: ${e.message}`) }
  }

  // Step 9: does the demo look like this business? A failing demo is flagged on the lead and must
  // not be sent until fixed (audit_demo_reality.mjs lists every defect that has shipped before).
  if (authEmail) {
    try {
      await execFileAsync('node', [resolve(__dirname, 'audit_demo_reality.mjs'), '--email', authEmail])
      console.log(`│  ✓ Reality audit passed`)
    } catch (e) {
      const report = String(e.stdout || e.message).split('\n').filter((l) => /✗/.test(l)).map((l) => l.trim()).join(' · ')
      console.warn(`│  ⛔ Reality audit FAILED: ${report}`)
      await sb.from('contacts').update({ comment: `DEMO NIJE SPREMAN (audit): ${report}`.slice(0, 900) }).eq('id', lead.id)
    }
  }

  // Step 10: the demo as its owner will read it (every tour card, the three hero chats, the CRM lines,
  // the Ponuda tab) saved to owner_reads/<email>.txt. The audit says nothing contradicts the site; only
  // a read says whether it sells. READ THIS FILE as the owner before the demo goes anywhere.
  if (authEmail) {
    try {
      const { stdout } = await execFileAsync('node', [resolve(__dirname, 'owner_read.mjs'), '--email', authEmail, '--quiet'])
      console.log(`│  📖 ${stdout.trim().split('\n').pop()}`)
    } catch (e) { console.warn(`│  ⚠ Owner read failed: ${e.message}`) }
  }

  console.log(`│`)
  console.log(`│  ✅ Done! Niche: ${nicheKey}`)
  console.log(`│  Login URL: ${APP_URL}`)
  console.log(`│  Email:     ${authEmail}`)
  if (password) console.log(`└─ Password:  ${password}`)
  else console.log(`└─────`)

  return { clientId, authEmail, password }
}

// ── Fallback conversations if LLM fails validation ─────────────────────────────
function buildFallbackConversations(brandName, nicheKey) {
  return [
    {
      id: 'conv_1', platform: 'instagram', customer_name: 'Jovana Petrović',
      messages: [
        { role: 'user', text: `Zdravo, zanima me cena vaših usluga za ${nicheKey}?` },
        { role: 'assistant', text: `Zdravo Jovana! Svakako, mogu da Vam pošaljem cenovnik. Koji termin Vam odgovara?` },
        { role: 'user', text: 'Sledeće nedelje bi mi odgovaralo.' },
        { role: 'assistant', text: 'Odlično! Imam slobodan termin u četvrtak u 10:00. Odgovara li Vam to?' },
      ],
    },
    {
      id: 'conv_2', platform: 'whatsapp', customer_name: 'Marko Nikolić',
      messages: [
        { role: 'user', text: 'Pozdrav, da li imate popust za stalne klijente?' },
        { role: 'assistant', text: 'Zdravo Marko! Da, nudimo 10% popust za stalne klijente. Možete iskoristiti odmah.' },
      ],
    },
    {
      id: 'conv_3', platform: 'facebook', customer_name: 'Ana Jovanović',
      messages: [
        { role: 'user', text: 'Nisam zadovoljna sa posednjom uslugom. Molim pojašnjenje.' },
        { role: 'assistant', text: 'Žao mi je što ste imali loše iskustvo. Možete li mi reći šta se desilo da bih mogao/la da pomognem?' },
        { role: 'user', text: 'Nikad ne odgovarate na poruke. Ovo je neprihvatljivo.' },
        { role: 'system', text: '[HUMAN_NEEDED]' },
      ],
    },
    {
      id: 'conv_4', platform: 'website', customer_name: 'Stefan Milić',
      messages: [
        { role: 'user', text: 'Kako mogu da zakažem termin?' },
        { role: 'assistant', text: 'Zdravo! Možete zakazati termin direktno ovde ili nas kontaktirati na +381 11 xxx xxxx. Koji termin Vam odgovara?' },
      ],
    },
  ]
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Cockpit "Demo se pravi" pause switch — operator can pause auto demo building.
  if (isApproved) {
    const { data: cfg } = await sb.from('machine_config').select('build_enabled').eq('client_id', SMARTFLOW_ID).maybeSingle()
    if (cfg && cfg.build_enabled === false) {
      console.log('⏸  Demo building is paused (cockpit → Demo se pravi → settings). Nothing to do.')
      return
    }
  }

  let leads = []

  const selectFields = 'id, company_name, email, website, niche, niche_v2, demo_built_at, demo_client_id, demo_tenant_email, demo_tenant_password'

  if (LEAD_ID) {
    const { data, error } = await sb.from('contacts').select(selectFields).eq('id', LEAD_ID).single()
    if (error) { console.error(`✗ Lead not found: ${error.message}`); process.exit(1) }
    leads = [data]
  } else if (isApproved) {
    // Cockpit-approved leads only: pipeline_stage='demo_building', not yet built.
    let q = sb
      .from('contacts')
      .select(selectFields)
      .eq('client_id', SMARTFLOW_ID)
      .eq('pipeline_stage', 'demo_building')
      .is('demo_built_at', null)
      .not('email', 'is', null)
      .order('instagram_followers', { ascending: false })
    if (LIMIT > 0) q = q.limit(LIMIT)
    const { data, error } = await q
    if (error) { console.error(`✗ Fetch error: ${error.message}`); process.exit(1) }
    leads = data || []
  } else {
    let q = sb
      .from('contacts')
      .select(selectFields)
      .eq('client_id', SMARTFLOW_ID)
      .in('status', ['enriched', 'No Draft', 'Kontaktiran'])
      .not('email', 'is', null)
      .order('instagram_followers', { ascending: false })

    if (!isForce && !isReseedOnly) q = q.is('demo_built_at', null)
    if (isReseedOnly) q = q.not('demo_client_id', 'is', null)
    if (LIMIT > 0) q = q.limit(LIMIT)

    const { data, error } = await q
    if (error) { console.error(`✗ Fetch error: ${error.message}`); process.exit(1) }
    leads = data || []
  }

  const date = new Date().toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' })
  console.log(`\nSmartFlow Demo Builder v2 — ${date}`)
  console.log(`Leads: ${leads.length}${isDryRun ? ' [DRY RUN]' : ''}${isForce ? ' [FORCE]' : ''}${isReseedOnly ? ' [RESEED-ONLY]' : ''}`)
  console.log(`OpenAI: ${OPENAI_MODEL}  |  Firecrawl: ${FIRECRAWL_KEY ? 'available' : 'NOT SET'}`)

  if (leads.length === 0) {
    console.log('\nNo leads to process.')
    return
  }

  let built = 0, skipped = 0, failed = 0

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    try {
      const result = await buildDemoForLead(sb, lead)
      if (result.skipped) skipped++
      else if (!result.dryRun) built++
    } catch (err) {
      console.error(`\n✗ FAILED [${lead.company_name}]: ${err.message}`)
      failed++
    }

    if (i < leads.length - 1 && !isDryRun) await sleep(1500)
  }

  console.log(`\n──────────────────────────────────────`)
  console.log(`Built: ${built} | Skipped: ${skipped} | Failed: ${failed}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
