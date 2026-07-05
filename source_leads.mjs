/**
 * SmartFlow Lead Sourcer — Apify Edition
 *
 * Strategy: NO niche queries. Find Serbian businesses running VIDEO ads on Instagram
 * with 3+ active campaigns → verify 10k+ real Instagram followers → enrich with email.
 *
 * Pipeline:
 *   Stage 1: Load raw ad records (Apify live OR local JSON files with --local)
 *   Stage 2: Post-filter (INSTAGRAM publisher, 3+ ads per page, Serbian language)
 *   Stage 3: IG handle extraction (website HTML scrape)
 *   Stage 4: Apify IG Profile Scraper — verify followers ≥ 10k (batch)
 *   Stage 5: Email enrichment (Firecrawl FB about + Hunter.io + website scrape)
 *   Stage 6: DB upsert
 *
 * Usage:
 *   node source_leads.mjs --local         — use local JSON datasets (FREE, no Apify Stage 1)
 *   node source_leads.mjs --local --test  — local data, no DB writes
 *   node source_leads.mjs --test          — live Apify, 100 records, no DB writes (~$0.08)
 *   node source_leads.mjs --yes           — live Apify, 2000 records (~$1.75 total)
 *   node source_leads.mjs --yes --limit 30 — cap DB inserts at 30
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch {}
}
loadEnv();

// ── Config ────────────────────────────────────────────────────────────────────
const APIFY_TOKEN        = process.env.APIFY_TOKEN;
const FB_ADS_ACTOR       = 'XtaWFhbtfxyzqrFmd';
const SCRAPECREATORS_KEY = process.env.SC_API_KEY || process.env.SCRAPECREATORS_KEY;

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SMARTFLOW_ID   = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const HUNTER_KEY     = process.env.HUNTER_API_KEY;

// DM-signal queries: broad action/benefit words that appear in any service business's ad copy.
// PRINCIPLE: queries are a mechanical key, not a niche selector. Cast the widest net.
// AVOID: ecommerce words (kupi/popust), international words (hotel/spa), city terms.
// Markets: RS (Serbia) + BA (Bosnia) + HR (Croatia) — same language family, 3× pool
const ADS_COUNTRIES = ['RS'];
const ADS_BASE_URL = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=RS&media_type=video';
// B4 remaining — fresh, never run before. Track usage in MEMORY.md after each run.
// Used: B0(kontaktirajte...), B1(otkrijte...), B2(preuzmite...), B3(vaši snovi...),
//       B4 partial(rezultati/uspeh/kvalitet — 2026-05-05), B5(vaš/nas — EXHAUSTED)
const ADS_QUERIES  = ['pouzdano', 'profesionalno', 'stručnost', 'iskustvo'];

const isLocal    = process.argv.includes('--local');      // read from local JSON files, skip Apify Stage 1
const isTest     = process.argv.includes('--test');       // no DB writes
const isYes      = process.argv.includes('--yes');        // live Apify run
const isFindOnly = process.argv.includes('--find-only'); // stop after Stage 4, no enrich/insert
const skipIg     = process.argv.includes('--skip-ig');   // skip parallel IG caption search (use when Apify memory is constrained)
const limitIdx  = process.argv.indexOf('--limit');
const budgetIdx = process.argv.indexOf('--budget');
const fileIdx   = process.argv.indexOf('--file');
const FILE_PATH = fileIdx !== -1 ? process.argv[fileIdx + 1] : null; // --file <path>: load single JSON file
let LIMIT       = limitIdx  !== -1 ? parseInt(process.argv[limitIdx  + 1]) : Infinity;

// --budget X: cost cap in USD for the FB ads scraper (e.g. --budget 0.45 → ~600 records)
const BUDGET_USD = budgetIdx !== -1 ? parseFloat(process.argv[budgetIdx + 1]) : null;
const COST_PER_RECORD = 0.00075;

// Raw ads to fetch: test=100, --budget drives live count, default live=2000
const RAW_LIMIT = isTest ? 100 : (BUDGET_USD ? Math.floor(BUDGET_USD / COST_PER_RECORD) : 2000);
const MAX_CHARGE = isTest ? 0.15 : (BUDGET_USD ? BUDGET_USD + 0.05 : 2.00); // +$0.05 headroom

// Local dataset files (used when --local flag is set)
const LOCAL_DATASETS_DIR = resolve(__dirname, '..');  // photonic-lunar/
const LOCAL_DATASET_GLOB = 'dataset_facebook-ads-library-scraper_';

// IG follower gates — raised from 15K → 30K based on send analysis (2026-05-07):
// every replied lead in our 338-send history had 22K+ followers (or a decision-maker email).
// 15K-floor accounts had ~0% reply rate — pain not felt at that scale.
let MIN_FOLLOWERS = 30000;      // default; overridden by machine_config.source_follower_floor in main()
const MAX_FOLLOWERS = 200000;  // cap at 200k — above this are large corps with dedicated CS teams

// ── D2C retail & irrelevant exclusion ─────────────────────────────────────────
// Anything that sells physical products, media, or has no service DM use-case
const EXCLUDE_CATS = new Set([
  // Apparel / fashion
  'Clothing (Brand)', 'Boutique store', 'Fashion designer', 'Fashion & beauty',
  "Women's Clothing", "Men's Clothing", 'Clothing store', 'Apparel & Clothing',
  'Apparel', 'Clothing',
  // Accessories / beauty
  'Jewelry/watches', 'Jewelry', 'Jewelry & Watches', 'Eyewear',
  'Cosmetics store', 'Beauty, cosmetics & personal care',
  // Toys / kids / baby
  'Toy store', 'Toys', 'Baby goods/kids goods',
  // Food & beverage
  'Grocery store', 'Supermarket', 'Food & beverage', 'Restaurant',
  'Fast food restaurant', 'Bakery', 'Food delivery service',
  // Electronics, supplements, books intentionally NOT excluded — niche brands are valid leads
  // Cosmetics / perfume retail (D2C) — NOTE: 'Health & Beauty' intentionally NOT excluded
  // because FB uses it for clinics/wellness too. Name keywords catch retail cosmetics instead.
  // Food & beverage brands (FMCG corporations + food producers — not restaurants)
  'Food & beverage company', 'Beverage company', 'Food company',
  // Media / entertainment
  'Personal blog', 'Public figure', 'Artist', 'Musician/band', 'Magazine',
  'Media/news company', 'Entertainment website', 'TV channel',
  // Banking / financial services (can't benefit — no social media inquiry flow)
  'Bank', 'Banking', 'Financial institution', 'Financial services',
  'Insurance company', 'Insurance broker', 'Credit union', 'Savings institution',
  'Mortgage brokers', 'Investment management',
  // Non-profit / charity / government (no sales motion)
  'Nonprofit organization', 'Non-profit organization', 'Charity organization',
  'Charity', 'Government organization', 'Public & government service',
  'Public utility', 'Religious organization', 'Political party',
  // Personal brands / lifestyle coaching (not a business with inquiry volume)
  'Dating Service', 'Life Coach', 'Coach', 'Motivational speaker',
  'Personal coaching',
  // Large corporate retail / delivery platforms (already have CS infrastructure)
  'Department store', 'Superstore', 'Delivery service', 'Food delivery service',
  'Pharmacy', 'Drug store', 'Drugstore', 'Discount store',
  // Gambling / betting / lottery
  'Gambling', 'Casino', 'Sports betting', 'Lottery', 'Betting center',
  // Other pure D2C
  'Interest', 'Sports team',
]);

// Page name keyword blacklist — catches retail/personal brands that slipped past category filter
const EXCLUDE_NAME_KEYWORDS = /\b(majice|majic|cipelice|cipela|cipele|obuća|obuca|kiflice|kiflic|torte|haljine|suknje|bluze|jakne|kaputi|šminke|sminke|nakit|parfem|parfemi|podkast|podcast|fondacija|fondacij|humanitar|zaklada|blog|kanal|kreator|otkriva|otkrivamo|istraž|dobrotvorn|volonter|donacij|kladionic|kladion|kazino|casino|betting|lutrij|temu|shein|aliexpress|garderob|butik|kolekcij|aksesoir|fashion|torb[aei]|nakita|narukvic|minđuš|mindjus|ogrlica|piercing|pirsing|bisuter)\b/i;

function isExcludedByName(pageName) {
  return EXCLUDE_NAME_KEYWORDS.test(pageName || '');
}

const SOCIAL = new Set([
  'instagram.com', 'facebook.com', 'fb.me', 'fb.com', 'm.facebook.com',
  'bit.ly', 'linktr.ee', 'linktree.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'wa.me',
]);

// Ad-network / tracking domains — if this is the link_url, the page isn't a real direct advertiser
const AD_NETWORK_DOMAINS = new Set([
  'ad.doubleclick.net', 'doubleclick.net', 'googleadservices.com', 'googlesyndication.com',
  'ads.google.com',
]);

// ── IG handle validation ──────────────────────────────────────────────────────
const TLDS    = new Set(['com','rs','eu','net','org','io','co','biz','info','hr','ba','si','me','de','fr','uk','it','png','jpg','svg','gif','webp','pdf','php','js','css','html','htm','xml','json']);
// Known platform/brand slugs that will never be a real Serbian business IG handle
const IG_SKIP = new Set(['p','reel','explore','accounts','stories','tv','reels','direct','sharedData','share','privacy','legal','about','blog','help','press','api','static','cdn',
  'google','shopify','facebook','youtube','instagram','twitter','tiktok','linkedin','meta','pinterest','snapchat','whatsapp']);

function isValidIgHandle(h) {
  if (!h || h.length < 2 || h.length > 30) return false;
  if (/^\d+$/.test(h)) return false;
  if (IG_SKIP.has(h.toLowerCase())) return false;
  const last = h.split('.').pop()?.toLowerCase() || '';
  if (TLDS.has(last)) return false;
  if (h.includes('@')) return false;
  return true;
}

// ── BCS (Serbian/Bosnian/Croatian) business detection ─────────────────────────
// Requires .rs/.ba/.hr domain OR BCS-specific vocabulary — rejects unrelated languages
const SERBIAN_WORDS = /\b(srbija|beograd|novi sad|niš|kragujevac|subotica|dinar|dinara|dostava|besplatna|porudžbina|usluga|popust|akcija|zakazivanje|termin|naručite|kupite|pogledajte|saznajte|pratite|pratilaca|ponuda|cena|cene|kontakt|telefon|adresa|radno vreme|radi|radimo|otvoreno|preuzmite|rezervišite|pokrenite|rešite|proverite|smanjite|kreirajte|otkrijte|promenite|poboljšajte|povećajte|garantujemo|rezultati|iskustvo|kvalitet|profesionalno|naručite|zakažite|javite|pošaljite|saznajte|ostvarite|sačuvajte|obezbedite|izgradite|priuštite|uštedite|dostupno)\b/i;

function isSerbianBusiness(texts, linkUrls, fbPageUri) {
  // .rs / .ba / .hr domain in any URL = regional business (Serbia, Bosnia, Croatia)
  const allUrls = [...linkUrls, fbPageUri || ''];
  for (const url of allUrls) {
    if (url && /\.(rs|ba|hr)(\/|$)/i.test(url)) return true;
  }
  // Serbian-specific vocabulary in ad copy
  const combined = texts.join(' ');
  if (SERBIAN_WORDS.test(combined)) return true;
  return false;
}

// ── Niche mapping ─────────────────────────────────────────────────────────────
function mapNiche(pageName = '', adBody = '', cats = []) {
  const t = [pageName, adBody, ...cats].join(' ').toLowerCase();
  if (/kozmet|spa|wellness|estet|stomatol|fizioter|klinika|ordinacija|bolnica|dermatol|beauty/.test(t)) return 'klinika_wellness';
  if (/fitness|gym|sport|trening|fitnes|yoga|pilates/.test(t)) return 'fitnes';
  if (/restoran|kafana|catering|picerija|ugostitelj|hotel|vila/.test(t)) return 'ugostiteljstvo';
  if (/nekretnin|real estate|stan |stanova/.test(t)) return 'nekretnine';
  if (/kurs|obuka|akademija|edukacij|škola|skola|coaching|mentor/.test(t)) return 'edukacija';
  if (/fashion|moda|odeć|odeca|butik|clothing|garderob/.test(t)) return 'fashion';
  if (/online shop|e-commerce|prodavnic|webshop|shopping/.test(t)) return 'online_prodaja';
  return 'other';
}

// ── Extract domain from ad copy text (e.g. "Posetite nas na startours.rs") ──
function domainFromAdCopies(adCopies = []) {
  const LOCAL_TLDS = /\.(rs|ba|hr|si|me|com|net|org|eu|shop|store)(\/|$|\s)/i;
  for (const copy of adCopies) {
    const matches = [...(copy || '').matchAll(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9\-]{1,60}\.[a-z]{2,10})(?:\/[^\s]*)?/g)];
    for (const m of matches) {
      const host = m[1].toLowerCase();
      if (LOCAL_TLDS.test(host + '/') && !SOCIAL.has(host)) return host;
    }
  }
  return null;
}

// ── Extract domain from ad snapshot ──────────────────────────────────────────
function extractDomain(snap) {
  if (snap?.link_url) {
    try {
      const h = new URL(snap.link_url).hostname.replace(/^www\./, '');
      if (h && !SOCIAL.has(h) && !h.includes('facebook') && !h.includes('instagram')) return h;
    } catch {}
  }
  const cap = (snap?.caption || '').trim();
  if (cap && !cap.includes(' ') && cap.includes('.')) {
    const d = cap.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').split('/')[0];
    if (!SOCIAL.has(d) && !d.includes('facebook') && !d.includes('instagram')) return d;
  }
  return null;
}

// ── Raw HTML website scrape for IG handle ────────────────────────────────────
async function findIgOnWebsite(domain) {
  const urls = [
    `https://${domain}`,
    `https://www.${domain}`,
    `https://${domain}/kontakt`,
    `https://${domain}/o-nama`,
    `https://${domain}/contact`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const html = await res.text();
      const matches = [...html.matchAll(/instagram\.com\/([a-zA-Z0-9._]{2,30})\/?["'\s>\\]/g)];
      for (const m of matches) {
        const handle = m[1].replace(/\/$/, '');
        if (isValidIgHandle(handle)) return handle;
      }
    } catch {}
  }
  return null;
}

// ── Firecrawl website scrape for IG handle + email (JS-rendered pages) ───────
// Returns { handle, email } — both resolved in one pass so Stage 5 can reuse without re-scraping.
// Fallback when raw HTML fetch misses handles in React/Vue footers.
async function findIgAndEmailWithFirecrawl(domain) {
  const result = { handle: null, email: null };
  const SKIP_EMAIL = /noreply|no-reply|example|johndoe|test@|sentry|wix|schema|privacy|jquery|qodeinteractive|@website\.|@domena\.|^(posao|hr|kadrovi|jobs|career|zaposlenje|rekrutacij|workspace)@|\.(png|jpg|jpeg|gif|svg|webp|pdf|css|js)(@|$)/i;
  for (const path of ['', '/kontakt', '/o-nama', '/contact', '/about']) {
    try {
      const { stdout } = await execFileAsync('firecrawl', [
        'scrape', '--url', `https://${domain}${path}`, '--format', 'markdown',
      ], { timeout: 15000 });
      if (!stdout) continue;
      if (!result.handle) {
        const matches = [...stdout.matchAll(/instagram\.com\/([a-zA-Z0-9._]{2,30})\/?/g)];
        for (const m of matches) {
          const handle = m[1].replace(/\/$/, '');
          if (isValidIgHandle(handle)) { result.handle = handle; break; }
        }
      }
      if (!result.email) {
        const m = stdout.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
        if (m && !SKIP_EMAIL.test(m[1]) && emailDomainMatches(m[1], domain)) result.email = m[1];
      }
      if (result.handle && result.email) break;
    } catch {}
  }
  return result;
}

// ── Scrape Facebook /about for website + IG + email ──────────────────────────
async function scrapeFacebookAbout(fbPageUri) {
  if (!fbPageUri) return {};
  try {
    const aboutUrl = fbPageUri.replace(/\/?$/, '/about');
    const { stdout } = await execFileAsync('firecrawl', [
      'scrape', '--url', aboutUrl, '--format', 'markdown',
    ], { timeout: 15000 });
    if (!stdout) return {};

    let website = null;
    const CDN_HOSTS = /^(scontent|static|lookaside|external|video|z-p|l\.facebook|www\.facebook|instagram\.com|fbcdn\.net)/;
    const wsSection = stdout.match(/[Ww]ebsites? and social links?([\s\S]{0,600})/)?.[1] || stdout;
    const urlMatches = [...wsSection.matchAll(/\[?(https?:\/\/[^\s\)\]\"\'\\]+)/g)];
    for (const m of urlMatches) {
      try {
        const u = new URL(m[1]);
        const host = u.hostname.replace(/^www\./, '');
        if (!CDN_HOSTS.test(host) && !SOCIAL.has(host)) { website = host; break; }
      } catch {}
    }

    let ig = null;
    const igMatches = [...stdout.matchAll(/instagram\.com\/([a-zA-Z0-9._]{2,30})\/?/g)];
    for (const m of igMatches) {
      const handle = m[1].replace(/\/$/, '');
      if (isValidIgHandle(handle)) { ig = handle; break; }
    }

    let email = null;
    const emailMatch = stdout.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    if (emailMatch && !emailMatch[1].includes('facebook.com') && !emailMatch[1].includes('sentry')
        && !emailMatch[1].includes('example') && !emailMatch[1].includes('schema')) {
      email = emailMatch[1];
    }

    return { website, ig, email };
  } catch { return {}; }
}


// ── Hunter.io ─────────────────────────────────────────────────────────────────
const SENIORITY = ['c_suite', 'vp', 'director', 'manager', 'senior', 'entry'];
const DEPTS     = ['management', 'executive', 'sales', 'marketing'];

async function hunterDomain(domain) {
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${HUNTER_KEY}`);
    if (!res.ok) return null;
    const emails = (await res.json())?.data?.emails || [];
    if (!emails.length) return null;
    const best = [...emails].sort((a, b) => {
      const dA = DEPTS.includes(a.department) ? 0 : 1, dB = DEPTS.includes(b.department) ? 0 : 1;
      if (dA !== dB) return dA - dB;
      const sA = SENIORITY.indexOf(a.seniority || ''), sB = SENIORITY.indexOf(b.seniority || '');
      if (sA !== sB) return (sA < 0 ? 99 : sA) - (sB < 0 ? 99 : sB);
      return (b.confidence || 0) - (a.confidence || 0);
    })[0];
    if (!best?.value) return null;
    return { email: best.value, name: [best.first_name, best.last_name].filter(Boolean).join(' ') || null, title: best.position || null };
  } catch { return null; }
}

// ── Linktree / aggregator URL resolution ─────────────────────────────────────
const AGGREGATOR_HOSTS = new Set([
  'linktr.ee','linktree.ee','bio.site','taplink.cc','beacons.ai','zaap.bio',
  'allmylinks.com','campsite.bio','lit.link','solo.to','milkshake.app','singlelink.co',
]);
const BAD_WEBSITE_HOSTS = new Set([
  'instagram.com','facebook.com','wa.me','t.me','tiktok.com','youtube.com','youtu.be',
  'maps.google.com','help.instagram.com','webinarjam.com','alteg.io','booksy.com',
  'fresha.com','treatwell.com','calendly.com',
]);

function classifyWebsite(url) {
  if (!url) return 'none';
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    if (BAD_WEBSITE_HOSTS.has(host) || [...BAD_WEBSITE_HOSTS].some(b => host.includes(b))) return 'bad';
    if (AGGREGATOR_HOSTS.has(host) || [...AGGREGATOR_HOSTS].some(a => host.includes(a))) return 'aggregator';
    return 'real';
  } catch { return 'none'; }
}

async function resolveAggregatorUrl(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartFlow/1.0)' },
      signal: AbortSignal.timeout(8000), redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    const SOCIAL = ['instagram.com','facebook.com','tiktok.com','twitter.com','youtube.com','linkedin.com','wa.me','t.me'];
    const links = [...html.matchAll(/href=["'](https?:\/\/[^"'#?]{4,})["']/g)].map(m => m[1]);
    for (const link of links) {
      try {
        const host = new URL(link).hostname.replace(/^www\./, '');
        if (!host || SOCIAL.some(s => host.includes(s)) || classifyWebsite(link) !== 'real') continue;
        if (host.includes('.') && !host.startsWith('cdn') && !host.startsWith('static')) return host;
      } catch {}
    }
    return null;
  } catch { return null; }
}

// Returns true if the email's domain plausibly belongs to the same business as websiteDomain.
// Rejects emails scraped from wrong-company templates (e.g. theme builder's own address).
function emailDomainMatches(email, websiteDomain) {
  try {
    const emailDomain = email.split('@')[1]?.toLowerCase().replace(/^www\./, '');
    if (!emailDomain) return false;
    const siteDomain = websiteDomain.toLowerCase().replace(/^www\./, '');
    const personal = /^(gmail|yahoo|hotmail|outlook)\.(com|rs|net|ba|hr)$/.test(emailDomain);
    return personal || emailDomain === siteDomain || siteDomain.endsWith('.' + emailDomain);
  } catch { return true; }
}

async function findEmailOnWebsite(domain) {
  const urls = [
    `https://${domain}/kontakt`,
    `https://${domain}/contact`,
    `https://${domain}/o-nama`,
    `https://${domain}`,
  ];
  const SKIP = /noreply|no-reply|example|johndoe|test@|sentry|wix|schema|privacy|jquery|qodeinteractive|@website\.|@domena\.|^(posao|hr|kadrovi|jobs|career|zaposlenje|rekrutacij|workspace)@|\.(png|jpg|jpeg|gif|svg|webp|pdf|css|js)(@|$)/i;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const html = await res.text();
      const m = html.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (m && !SKIP.test(m[1]) && emailDomainMatches(m[1], domain)) return m[1];
    } catch {}
  }
  return null;
}

// ── Apify helpers ─────────────────────────────────────────────────────────────
async function checkApifyBalance() {
  const res  = await fetch(`https://api.apify.com/v2/users/me?token=${APIFY_TOKEN}`);
  const data = await res.json();
  const plan = data?.data?.plan || {};
  const used = data?.data?.monthlyUsage?.totalCostUsd ?? 0;
  // FREE plan may store limit under different field — default to $5 if missing/zero
  const limit = plan.monthlyUsageCreditsUsd || plan.maxMonthlyUsageUsd || 5;
  const remaining = limit - used;
  // Warn if the balance looks unrealistically high (stale cache — Apify known issue)
  if (remaining === limit && used === 0 && limit <= 5) {
    console.log(`  💰 Apify balance: ~$${remaining.toFixed(2)} (⚠ usage may be cached — actual balance unknown)`);
  } else {
    console.log(`  💰 Apify balance: $${remaining.toFixed(3)} remaining (used $${used.toFixed(3)} of $${limit})`);
  }
  if (remaining < 0.25) throw new Error(`Apify balance too low ($${remaining.toFixed(3)} < $0.25 minimum). Top up first.`);
  return remaining;
}

async function runApify(actorId, input, label, maxItems, maxCharge = 0.50) {
  if (!maxItems) throw new Error(`BUG: runApify(${label}) called without maxItems — uncapped run refused.`);
  console.log(`\n▶ ${label} — ${actorId} | maxItems: ${maxItems} | max charge: $${maxCharge}...`);
  await checkApifyBalance();

  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}&maxItems=${maxItems}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // NOTE: do NOT pass maxTotalChargeUsd — the Apify monthly hard limit check rejects explicit values.
      // maxItems is the cost cap for PPE actors (items × $0.00075). That's sufficient.
      body: JSON.stringify(input),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(`${label} start failed: ${data.error.message}`);

  const runId     = data.data.id;
  const datasetId = data.data.defaultDatasetId;
  console.log(`  Run: ${runId} | Dataset: ${datasetId}`);

  let status = 'RUNNING';
  for (let i = 0; i < 120; i++) {
    await sleep(10000);
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    status = (await s.json()).data?.status;
    process.stdout.write(`\r  ${status} (${(i+1)*10}s)...`);
    if (!['RUNNING', 'READY'].includes(status)) break;
  }
  console.log();
  if (!['SUCCEEDED', 'FINISHED'].includes(status)) {
    console.warn(`  ⚠ Actor ended with status: ${status}`);
    if (status === 'FAILED' || status === 'TIMED-OUT') throw new Error(`Actor ${status}`);
  }

  let items = [], offset = 0;
  while (true) {
    const r = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=200&offset=${offset}`
    );
    const batch = await r.json();
    const arr = Array.isArray(batch) ? batch : (batch.items || []);
    items = items.concat(arr);
    if (arr.length < 200) break;
    offset += arr.length;
  }
  console.log(`  ✓ ${items.length} results`);
  return items;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── ScrapeCreators: fetch a single IG profile ─────────────────────────────────
async function scrapeCreatorsProfile(handle) {
  try {
    const res = await fetch(
      `https://api.scrapecreators.com/v1/instagram/profile?handle=${encodeURIComponent(handle)}`,
      { headers: { 'x-api-key': SCRAPECREATORS_KEY }, signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const u = json?.data?.user;
    if (!u) return null;
    return {
      username      : u.username || handle,
      followersCount: u.edge_followed_by?.count ?? 0,
      externalUrl   : u.external_url || null,
      biography     : u.biography   || null,
      isVerified    : u.is_verified  || false,
    };
  } catch { return null; }
}

// ── Load local dataset files ──────────────────────────────────────────────────
function loadLocalDatasets() {
  if (FILE_PATH) {
    const data = JSON.parse(readFileSync(FILE_PATH, 'utf8'));
    const arr = Array.isArray(data) ? data : [];
    console.log(`  Loaded ${arr.length} records from ${FILE_PATH.split('/').pop()}`);
    return arr;
  }
  const files = readdirSync(LOCAL_DATASETS_DIR)
    .filter(f => f.startsWith(LOCAL_DATASET_GLOB) && f.endsWith('.json'))
    .map(f => join(LOCAL_DATASETS_DIR, f));
  if (!files.length) throw new Error(`No local dataset files found in ${LOCAL_DATASETS_DIR} matching ${LOCAL_DATASET_GLOB}*.json`);
  let all = [];
  for (const f of files) {
    const data = JSON.parse(readFileSync(f, 'utf8'));
    all = all.concat(Array.isArray(data) ? data : []);
    console.log(`  Loaded ${Array.isArray(data) ? data.length : 0} records from ${f.split('/').pop()}`);
  }
  return all;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // Read cockpit "Novi leadovi" settings. Operator can pause sourcing or tune
  // the daily count / follower floor from the node's settings menu.
  try {
    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/machine_config?client_id=eq.${SMARTFLOW_ID}&select=*`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const cfg = (await cfgRes.json())[0];
    if (cfg) {
      if (cfg.source_enabled === false) {
        console.log('⏸  Sourcing is paused (cockpit → Novi leadovi → settings). Nothing to do.');
        return;
      }
      if (Number.isFinite(cfg.source_follower_floor)) MIN_FOLLOWERS = cfg.source_follower_floor;
      if (LIMIT === Infinity && Number.isFinite(cfg.source_daily_limit)) LIMIT = cfg.source_daily_limit;
    }
  } catch (e) { console.warn('⚠ Could not read machine_config, using defaults:', e.message); }

  const estCostAds = (RAW_LIMIT * 0.00075).toFixed(2);
  const modeLabel = isLocal
    ? `LOCAL (free, no Apify Stage 1)${isTest ? ' · TEST (no DB writes)' : ''}`
    : isTest ? `TEST (no DB writes, ~$${estCostAds} Apify)` : `LIVE (~$${estCostAds} Apify)`;

  console.log('═══════════════════════════════════════════════════════');
  console.log('  SmartFlow Lead Sourcer — Apify Edition');
  console.log(`  Mode: ${modeLabel} | Max inserts: ${LIMIT}`);
  console.log(`  Filter: VIDEO · RS · INSTAGRAM · 3+ ads · Serbian language · ${MIN_FOLLOWERS/1000}k+ IG followers`);
  console.log('═══════════════════════════════════════════════════════\n');

  if (!isLocal && !isTest && !isYes) {
    console.error('✗ Specify a mode:');
    console.error('  node source_leads.mjs --local         (free, uses local JSON files)');
    console.error('  node source_leads.mjs --local --test  (free, no DB writes)');
    console.error('  node source_leads.mjs --test          (live Apify, ~$0.08, no DB writes)');
    console.error('  node source_leads.mjs --yes           (live Apify, ~$1.75)');
    process.exit(1);
  }

  // Load existing contacts for dedup — by page_id, email, and IG handle
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?select=facebook_page_id,email,instagram_handle,status,kategorija&client_id=eq.${SMARTFLOW_ID}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const existingAll = await existingRes.json() || [];
  const existingPageIds   = new Set(existingAll.filter(r => r.facebook_page_id).map(r => String(r.facebook_page_id)));
  // Only block on email/IG if already contacted or disqualified — don't block enriched duplicates that haven't been sent yet
  const contactedEmails   = new Set(existingAll.filter(r => ['Kontaktiran','Disqualified','Follow Up','Odgovorio','Zakazan Sastanak'].includes(r.status)).map(r => r.email?.toLowerCase()).filter(Boolean));
  const contactedHandles  = new Set(existingAll.filter(r => ['Kontaktiran','Disqualified','Follow Up','Odgovorio','Zakazan Sastanak'].includes(r.status)).map(r => r.instagram_handle?.toLowerCase()).filter(Boolean));
  console.log(`Existing in DB: ${existingPageIds.size} page IDs | ${contactedEmails.size} contacted emails | ${contactedHandles.size} contacted handles\n`);

  // Launch IG caption search in parallel with FB ads (only on live --yes runs, unless --skip-ig)
  let igProcess = null, igOutput = '';
  if (isYes && !skipIg && process.env.IG_SESSION_ID) {
    const { spawn } = await import('child_process');
    igProcess = spawn('node', [resolve(__dirname, 'source_ig_search.mjs')], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: __dirname,
    });
    igProcess.stdout.on('data', d => { igOutput += d; });
    igProcess.stderr.on('data', d => { igOutput += d; });
    console.log('  ▶ IG caption search launched in parallel\n');
  }

  // ── Stage 1: Load raw ads ─────────────────────────────────────────────────────
  let rawItems;
  if (isLocal) {
    console.log('─── Stage 1: Loading local JSON datasets (FREE) ────────');
    rawItems = loadLocalDatasets();
    console.log(`  Total raw records: ${rawItems.length}\n`);
  } else {
    console.log('─── Stage 1: FB Ads Library via Apify ──────────────────');
    // Build URLs across all target countries × all queries
    const urlsToScrape = [];
    for (const country of ADS_COUNTRIES) {
      const base = ADS_BASE_URL.replace('country=RS', `country=${country}`);
      for (const q of ADS_QUERIES) {
        urlsToScrape.push({ url: `${base}&q=${encodeURIComponent(q)}`, country, q });
      }
    }
    const numBatches    = urlsToScrape.length;
    const perBatch      = Math.ceil(RAW_LIMIT / numBatches);
    const chargePerBatch = parseFloat((MAX_CHARGE / numBatches + 0.02).toFixed(2));
    console.log(`  ${numBatches} batch(es) × up to ${perBatch} records, $${chargePerBatch} cap each\n`);
    const allRawItems = [];
    for (const urlObj of urlsToScrape) {
      const label = `FB Ads [${urlObj.country}·q=${urlObj.q}]`;
      let items = [];
      try {
        items = await runApify(
          FB_ADS_ACTOR,
          {
            urls: [{ url: urlObj.url }],
            'scrapePageAds.countryCode': urlObj.country,
            'scrapePageAds.activeStatus': 'active',
            'scrapePageAds.sortBy': 'impressions_desc',
          },
          label,
          perBatch,
          chargePerBatch,
        );
      } catch (e) {
        console.warn(`  ⚠ Batch ${label} failed (${e.message}) — skipping, continuing with other batches`);
      }
      allRawItems.push(...items);
    }
    rawItems = allRawItems;
    console.log(`\n  Raw records (all batches): ${rawItems.length}`);
    // Auto-save for replay with --local --file
    const saveTag = ADS_QUERIES.slice(0,2).join('_').replace(/[^a-z0-9]/gi, '');
    const savePath = join(LOCAL_DATASETS_DIR, `${LOCAL_DATASET_GLOB}${new Date().toISOString().slice(0,10)}_${saveTag}.json`);
    writeFileSync(savePath, JSON.stringify(rawItems, null, 2));
    console.log(`  💾 Saved to ${savePath.split('/').pop()} (replay with --local --file ${savePath})\n`);
  }

  // ── Stage 2: Post-filter ──────────────────────────────────────────────────────
  console.log('─── Stage 2: Post-filter ───────────────────────────────');

  // Deduplicate by page_id and count ad occurrences per page
  const byPage = new Map(); // page_id → { item, adCopies, count }
  for (const item of rawItems) {
    const pid = String(item.page_id || '');
    if (!pid || pid === 'null') continue;
    if (!byPage.has(pid)) {
      byPage.set(pid, { item, adCopies: [], count: 0 });
    }
    const entry = byPage.get(pid);
    entry.count++;
    const txt = item.snapshot?.body?.text;
    if (txt && !entry.adCopies.includes(txt)) entry.adCopies.push(txt);
  }
  console.log(`  Unique pages: ${byPage.size}`);

  const qualified = [];
  const dbg = { db: 0, noIG: 0, fewAds: 0, noSerbian: 0, person: 0, retail: 0, adNetwork: 0, passed: 0 };

  for (const [pid, { item, adCopies, count }] of byPage) {
    const snap = item.snapshot || {};
    const likes = snap.page_like_count || 0;
    const cats  = snap.page_categories || [];
    const platforms = item.publisher_platform || [];
    const pageName = snap.page_name || item.page_name || '';

    if (existingPageIds.has(pid))                         { dbg.db++;        continue; }
    if (snap.page_entity_type === 'PERSON_PROFILE')       { dbg.person++;    continue; }
    if (!platforms.includes('INSTAGRAM'))                  { dbg.noIG++;      continue; }
    if (count < 1)                                         { dbg.fewAds++;    continue; }
    // No FB likes range filter — FB likes are independent of IG followers and not a valid proxy.
    // No FB likes filter — FB and IG audiences are independent. A business can have 300 FB likes
    // and 80k IG followers. The 20k IG follower gate lives in Stage 4 where we actually know it.
    // Skip ads whose link goes to an ad-network domain — not a real direct advertiser
    try {
      const linkHost = snap.link_url ? new URL(snap.link_url).hostname : '';
      if (AD_NETWORK_DOMAINS.has(linkHost))               { dbg.adNetwork++; continue; }
    } catch {}
    if (cats.some(c => EXCLUDE_CATS.has(c)))               { dbg.retail++;    continue; }
    // Name-based keyword filter — catches retail/personal brands with generic FB categories
    if (isExcludedByName(pageName))                        { dbg.retail++;    continue; }

    // Serbian business check — requires .rs domain or Serbian-specific vocabulary
    const linkUrls = [snap.link_url, snap.caption].filter(Boolean);
    if (!isSerbianBusiness(adCopies, linkUrls, snap.page_profile_uri)) { dbg.noSerbian++; continue; }

    dbg.passed++;
    qualified.push({ pid, item, adCopies, count });
  }

  qualified.sort((a, b) => (b.item.snapshot?.page_like_count || 0) - (a.item.snapshot?.page_like_count || 0));

  console.log(`  Already in DB    : ${dbg.db}`);
  console.log(`  No Instagram     : ${dbg.noIG}`);
  console.log(`  < 1 ad           : ${dbg.fewAds}`);
  console.log(`  Not Serbian      : ${dbg.noSerbian}`);
  console.log(`  Person profile   : ${dbg.person}`);
  console.log(`  D2C retail       : ${dbg.retail}`);
  console.log(`  Ad network       : ${dbg.adNetwork}`);
  console.log(`  Qualified        : ${dbg.passed} → processing all ${qualified.length} (DB limit: ${LIMIT})\n`);

  if (!qualified.length) { console.log('No qualified leads found.'); return; }

  // ── Stage 3: IG handle extraction (multi-source) ─────────────────────────────
  console.log('─── Stage 3: IG handle extraction (multi-source) ───────');
  console.log(`  Sources: profile_uri → link_url/caption IG → website HTML → Firecrawl website → FB slug\n`);

  for (let i = 0; i < qualified.length; i++) {
    const lead = qualified[i];
    const snap   = lead.item.snapshot || {};
    const fbUri  = snap.page_profile_uri || '';

    // 3a. page_profile_uri is directly an instagram.com URL (rare but happens)
    // HIGH confidence: the ad itself told us this handle — no cross-check needed.
    if (fbUri.includes('instagram.com')) {
      try {
        const path = new URL(fbUri).pathname.replace(/^\//, '').replace(/\/$/, '').split('/').pop();
        if (isValidIgHandle(path)) { lead.igHandle = path; lead.igHandleConfidence = 'high'; process.stdout.write('.'); continue; }
      } catch {}
    }

    // 3a.5. link_url or caption points directly to instagram.com/<handle> — very common: businesses
    // run ads with IG as the CTA destination. extractDomain filters these out as social links,
    // so we must extract the handle here before that step discards them.
    // HIGH confidence: same reasoning as 3a.
    if (!lead.igHandle) {
      for (const src of [snap.link_url, snap.caption]) {
        if (!src) continue;
        const m = src.match(/instagram\.com\/([a-zA-Z0-9._]{2,30})\/?(?:[?#]|$)/);
        if (m && isValidIgHandle(m[1])) { lead.igHandle = m[1]; lead.igHandleConfidence = 'high'; process.stdout.write('L'); break; }
      }
      if (lead.igHandle) continue;
    }

    // 3b. Extract domain from snapshot (link_url, caption)
    lead.domain = extractDomain(snap);

    // 3c. Extract domain from ad copy text (e.g. "Posetite nas na startours.rs")
    if (!lead.domain) {
      lead.domain = domainFromAdCopies(lead.adCopies);
    }

    // 3d. If domain found: raw HTML scrape first, then Firecrawl fallback for JS-rendered sites.
    // Firecrawl also extracts email in the same pass — cached on lead.fcEmail for Stage 5 reuse.
    // LOW confidence: this regex-matches the first instagram.com link found anywhere on the page,
    // including leftover template/demo widgets that have nothing to do with the business
    // (e.g. a furniture-store demo IG badge sitting in a website theme's footer). Stage 4
    // cross-checks the resolved profile's own external_url against this domain before trusting it.
    if (lead.domain && !lead.igHandle) {
      lead.igHandle = await findIgOnWebsite(lead.domain);
      if (lead.igHandle) lead.igHandleConfidence = 'low';
    }
    if (lead.domain && !lead.igHandle) {
      const fc = await findIgAndEmailWithFirecrawl(lead.domain);
      if (fc.handle) { lead.igHandle = fc.handle; lead.igHandleConfidence = 'low'; }
      if (fc.email)  lead.fcEmail  = fc.email;
    }

    // 3e. FB page slug as IG handle candidate — Serbian businesses use same handle on both platforms.
    // LOW confidence (guess): Stage 4 requires Apify to confirm the account exists AND cross-checks
    // its external_url before trusting it — existence alone isn't proof it's the same business.
    if (!lead.igHandle && fbUri) {
      const slug = fbUri.replace(/\/$/, '').split('/').filter(s =>
        s && s !== 'www.facebook.com' && s !== 'facebook.com' && s !== 'https:' && s !== 'http:'
      ).pop();
      if (slug && isValidIgHandle(slug)) {
        lead.igHandle = slug;
        lead.igHandleIsGuess = true;
        lead.igHandleConfidence = 'low';
      }
    }

    await sleep(100);
  }

  const withHandles = qualified.filter(l => l.igHandle);
  const noHandleLeads = qualified.filter(l => !l.igHandle);
  console.log(`  Handle candidates: ${withHandles.length}/${qualified.length} (${noHandleLeads.length} have numeric FB IDs — no slug available)\n`);

  // ── Stage 4: Apify IG Profile Scraper — confirm handles + follower count ──────
  // Batch call: one run for all handles. ~$0.005/profile, capped at 60 profiles ($0.30 max).
  console.log('─── Stage 4: Apify IG Profile Scraper (batch) ──────────────');

  const IG_PROFILE_ACTOR = 'dSCLg0C3YEZ83HzYX';
  // No FB likes pre-filter — FB and IG audiences are independent; a business can have 500 FB likes
  // and 50k IG followers. Only Stage 4 (real IG profile) is authoritative.
  const igCandidates = withHandles;

  const uniqueHandles = [...new Set(igCandidates.map(l => l.igHandle))];
  console.log(`  Verifying ${uniqueHandles.length} handles (all, no FB likes pre-filter)...`);

  const profileByHandle = new Map();
  if (uniqueHandles.length > 0) {
    const igItems = await runApify(
      IG_PROFILE_ACTOR,
      { usernames: uniqueHandles },
      'IG Profile Scraper',
      uniqueHandles.length,
      parseFloat((uniqueHandles.length * 0.006).toFixed(2)), // $0.006/profile headroom
    );
    for (const p of igItems) {
      if (p.username) profileByHandle.set(p.username.toLowerCase(), p);
    }
    console.log(`  Profiles returned: ${igItems.length}`);
  }

  // Attach confirmed profile data to leads; unconfirmed slug guesses = mark invalid
  let confirmed = 0, above20k = 0, rejectedMismatch = 0;
  for (const lead of withHandles) {
    let profile = profileByHandle.get(lead.igHandle.toLowerCase());

    // Low-confidence handles (website scrape / FB slug guess) can pick up an IG account that
    // exists but belongs to someone else entirely — e.g. a leftover demo widget on a template
    // site. Apify only confirms the account is real, not that it's the same business. So for
    // low-confidence handles, require the profile's own external link to point back to the same
    // domain we scraped it from. A hard mismatch (e.g. our domain tartufidamar.rs vs the
    // profile's ozdesignfurniture.com.au) means we grabbed the wrong account — drop it.
    let mismatchRejected = false;
    if (profile && lead.igHandleConfidence === 'low' && lead.domain) {
      const profileUrl = profile.externalUrls?.[0]?.url || profile.externalUrl || null;
      if (profileUrl) {
        let profileHost = null;
        try { profileHost = new URL(profileUrl.startsWith('http') ? profileUrl : `https://${profileUrl}`).hostname.replace(/^www\./, ''); } catch {}
        if (profileHost && profileHost !== lead.domain && !profileHost.endsWith('.' + lead.domain) && !lead.domain.endsWith('.' + profileHost)) {
          rejectedMismatch++;
          mismatchRejected = true;
          profile = null;
          lead.igHandle = null;
          lead.igHandleIsGuess = false;
        }
      }
    }

    if (profile) {
      lead.igProfile = profile;
      lead.igFollowers = profile.followersCount || 0;
      confirmed++;
      if (lead.igFollowers >= MIN_FOLLOWERS) above20k++;
      // Extract website from IG profile's externalUrls array (actor returns array, not string)
      if (!lead.domain) {
        const urls = profile.externalUrls || [];
        for (const entry of urls) {
          const raw = entry?.url || entry;
          if (!raw || typeof raw !== 'string') continue;
          const kind = classifyWebsite(raw);
          if (kind === 'real') {
            try { lead.domain = new URL(raw).hostname.replace(/^www\./, ''); break; } catch {}
          } else if (kind === 'aggregator' && !lead._aggregatorUrl) {
            lead._aggregatorUrl = raw; // resolve in Stage 5
          }
        }
      }
    } else if (mismatchRejected) {
      // Cross-check above already cleared igHandle — do not fall back to FB likes,
      // that would let the rejected/wrong account back in via the follower gate.
    } else if (lead.igHandleIsGuess) {
      // Slug guess rejected by Apify — clear it so we don't insert a wrong handle
      lead.igHandle = null;
      lead.igHandleIsGuess = false;
    } else {
      // Handle was found via website scrape but Apify couldn't verify — keep it
      lead.igFollowers = lead.item.snapshot?.page_like_count || 0;
      lead.igFollowerSource = 'fb_likes_fallback';
    }
  }

  // Strict gate: must have 15k–200k IG followers. No exceptions.
  const igVerified = qualified.filter(lead => {
    const followers = lead.igFollowers ?? 0;
    return followers >= MIN_FOLLOWERS && followers <= MAX_FOLLOWERS;
  });

  // Only proceed with IG-verified leads that passed the follower gate. No unverified no-handle leads.
  const toEnrich = igVerified;

  const skippedLowFollowers = qualified.length - toEnrich.length;

  console.log(`  Confirmed handles  : ${confirmed}/${uniqueHandles.length}`);
  if (rejectedMismatch > 0) console.log(`  Rejected (wrong account, domain mismatch): ${rejectedMismatch}`);
  console.log(`  ≥ ${MIN_FOLLOWERS/1000}k followers (IG verified) : ${igVerified.length}`);
  console.log(`  Skipped (< ${MIN_FOLLOWERS/1000}k or unverified)  : ${skippedLowFollowers}`);
  console.log(`  Proceeding with ${toEnrich.length} leads total\n`);

  // ── --find-only: print leads, then fall through to DB insert (status = No Draft)
  if (isFindOnly) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Leads found (inserting to DB as No Draft — skipping email enrichment):');
    console.log('═══════════════════════════════════════════════════════════');
    toEnrich.forEach((l, i) => {
      const followers = ((l.igFollowers ?? l.item.snapshot?.page_like_count ?? 0) / 1000).toFixed(1);
      const name = (l.item.snapshot?.page_name || '').slice(0, 40).padEnd(40);
      const handle = ('@' + (l.igHandle || '—')).padEnd(28);
      console.log(`  ${String(i+1).padStart(2)}. ${name} ${handle} ${followers}k followers`);
    });
    console.log(`\n  Total: ${toEnrich.length} — proceeding to DB insert without enrichment.\n`);
    // Skip Stage 5 (email enrichment) — leads go in as No Draft
    for (const lead of toEnrich) { lead.contact = null; lead.domainFinal = lead.domain || null; }
    // Fall through to Stage 6
  }

  // ── Stage 5: Email enrichment (skipped when --find-only) ─────────────────────
  let emailFound = 0;
  if (isFindOnly) {
    console.log('─── Stage 5: Skipped (--find-only) — leads will be inserted as No Draft ──\n');
  } else {
  console.log(`─── Stage 5: Email enrichment (${toEnrich.length} leads) ──────────`);

  for (let i = 0; i < toEnrich.length; i++) {
    const lead = toEnrich[i];
    const snap     = lead.item.snapshot || {};
    const pageName = lead.item.page_name || snap.page_name || '';
    const followers = lead.igFollowers != null ? `${(lead.igFollowers/1000).toFixed(1)}k followers` : 'followers unknown';

    console.log(`[${i+1}/${toEnrich.length}] ${pageName}${lead.igHandle ? ` (@${lead.igHandle})` : ' (no IG handle)'} ${followers}`);

    let domain  = lead.domain;
    let contact = null;
    let fbEmail = null;

    if (!domain && snap.page_profile_uri) {
      // Last resort: Firecrawl FB /about for website + IG + email
      process.stdout.write(`  FC about... `);
      const fb = await scrapeFacebookAbout(snap.page_profile_uri);
      domain  = fb.website || null;
      if (!lead.igHandle && fb.ig) lead.igHandle = fb.ig;
      fbEmail = fb.email;
      console.log(`website: ${domain || '—'} | email: ${fb.email || '—'}`);
      if (domain) lead.domain = domain;
    }

    const GARBAGE_EMAIL = /^(posao|hr|kadrovi|jobs|career|zaposlenje|rekrutacij|knjigovodstvo|racunovodstvo|pravna|administracij|office\.hr|info\.hr)@/i;
    const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/;

    // IG bio email — cheapest, check first
    const bio = lead.igProfile?.biography || '';
    const bioEmail = bio.match(EMAIL_RE)?.[0];
    if (bioEmail && !GARBAGE_EMAIL.test(bioEmail) && !bioEmail.includes('example') && !bioEmail.includes('domain.com')) {
      contact = { email: bioEmail.toLowerCase(), name: null, title: null };
      console.log(`  ✓ Email from IG bio: ${bioEmail}`);
    }

    // Resolve aggregator URL → real domain (if no direct domain yet)
    if (!contact && !domain && lead._aggregatorUrl) {
      process.stdout.write(`  Resolving aggregator (${lead._aggregatorUrl.slice(0, 40)})... `);
      const resolved = await resolveAggregatorUrl(lead._aggregatorUrl);
      if (resolved) { domain = resolved; lead.domain = resolved; console.log(resolved); }
      else console.log('no real URL found');
    }

    // Strip bad/useless website domains so we don't waste Hunter/scrape calls
    if (domain && classifyWebsite(`https://${domain}`) !== 'real') domain = null;

    // Use email found by Firecrawl in Stage 3 (same scrape, no extra cost)
    if (!contact && lead.fcEmail && !GARBAGE_EMAIL.test(lead.fcEmail)) {
      contact = { email: lead.fcEmail, name: null, title: null };
      console.log(`  ✓ Email from Stage 3 Firecrawl: ${lead.fcEmail}`);
    } else if (!contact && fbEmail && !GARBAGE_EMAIL.test(fbEmail)) {
      contact = { email: fbEmail, name: null, title: null };
    } else if (!contact && domain) {
      // Hunter first
      process.stdout.write(`  Hunter (${domain})... `);
      const hunterContact = await hunterDomain(domain);
      contact = (hunterContact && !GARBAGE_EMAIL.test(hunterContact.email)) ? hunterContact : null;
      if (contact) {
        console.log(`${contact.email}${contact.name ? ` (${contact.name})` : ''}`);
      } else {
        // Website scrape fallback
        process.stdout.write(`not found → website scrape... `);
        const email = await findEmailOnWebsite(domain);
        console.log(email || 'not found');
        if (email && !GARBAGE_EMAIL.test(email)) contact = { email, name: null, title: null };
      }
    } else if (!contact) {
      console.log(`  No website — skipping email enrichment`);
    }

    if (contact?.email) emailFound++;
    lead.contact = contact;
    lead.domainFinal = domain;

    await sleep(400);
  }
  console.log(`  Emails found: ${emailFound}/${toEnrich.length}\n`);
  } // end Stage 5 (skipped when --find-only)

  // ── Stage 6: DB upsert ────────────────────────────────────────────────────────
  if (isTest) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  [TEST MODE] — results above, no DB writes');
    const wouldInsert = Number.isFinite(LIMIT) ? Math.min(toEnrich.length, LIMIT) : toEnrich.length;
    console.log(`  Leads that would be inserted: ${wouldInsert} (of ${toEnrich.length} qualified)`);
    console.log(`    With email  : ${emailFound}`);
    console.log(`    With IG     : ${toEnrich.filter(l => l.igHandle).length}`);
    console.log(`  Run with --yes to insert into DB.`);
    return;
  }

  const toInsert = Number.isFinite(LIMIT) ? toEnrich.slice(0, LIMIT) : toEnrich;
  console.log(`─── Stage 6: DB upsert (${toInsert.length}/${toEnrich.length} leads, limit: ${LIMIT}) ────`);
  let inserted = 0, failed = 0;

  for (const lead of toInsert) {
    const snap     = lead.item.snapshot || {};
    const pageName = lead.item.page_name || snap.page_name || '';

    // Skip if we already contacted this business via a different FB page ID
    const leadEmail  = lead.contact?.email?.toLowerCase();
    const leadHandle = lead.igHandle?.toLowerCase();
    if (leadEmail  && contactedEmails.has(leadEmail))   { console.log(`  ⟳ skip dup email:  ${pageName}`);  failed++; continue; }
    if (leadHandle && contactedHandles.has(leadHandle)) { console.log(`  ⟳ skip dup handle: ${pageName}`);  failed++; continue; }
    const domain   = lead.domainFinal;
    const niche    = mapNiche(pageName, lead.adCopies[0] || '', snap.page_categories || []);
    const likes    = snap.page_like_count || 0;
    const followers = lead.igFollowers || likes;

    const intake_data = {
      active_ads_count   : lead.count,
      ad_copies          : lead.adCopies.slice(0, 5),
      ad_cta             : snap.cta_text || null,
      ad_title           : snap.title || null,
      ad_display_format  : 'VIDEO',
      publisher_platforms: lead.item.publisher_platform || [],
      ad_start_date      : lead.item.start_date_formatted || null,
      facebook_page_id   : lead.item.page_id,
      facebook_page_url  : snap.page_profile_uri || null,
      page_categories    : snap.page_categories || [],
      page_followers     : likes,
      scraped_at         : new Date().toISOString(),
      scrape_method      : 'apify_no_query_video',
      enrichment: {
        instagram_profile: lead.igProfile
          ? {
              username         : lead.igProfile.username,
              followers        : lead.igProfile.followersCount || followers,
              following        : lead.igProfile.followingCount || 0,
              posts_count      : lead.igProfile.postsCount || 0,
              bio              : lead.igProfile.biography || null,
              business_category: lead.igProfile.businessCategoryName || null,
              is_verified      : lead.igProfile.isVerified || false,
              external_url     : lead.igProfile.externalUrls?.[0]?.url || null,
            }
          : lead.igHandle
            ? { username: lead.igHandle, followers }
            : {},
        ...(lead.contact ? { contact: { email: lead.contact.email, name: lead.contact.name, title: lead.contact.title, source: 'hunter' } } : {}),
      },
    };

    const record = {
      company_name      : pageName,
      name              : pageName,
      website           : domain ? `https://${domain}` : null,
      email             : lead.contact?.email || null,
      instagram_handle  : lead.igHandle || null,
      instagram_followers: followers,
      facebook_page_id  : String(lead.item.page_id),
      niche,
      service           : 'social_media_system',
      status            : lead.contact?.email ? 'enriched' : 'No Draft',
      izvor             : 'meta_ads_scrape',
      kategorija        : followers >= 50000 ? 'Vreo' : followers >= 15000 ? 'Topao' : 'Hladan',
      pipeline_stage    : 'novi',   // lands in the cockpit's "Novi leadovi" for approve/discard
      intake_data,
      client_id         : SMARTFLOW_ID,
      sledeca_akcija    : lead.contact?.email ? 'Generisati email draft i poslati' : 'Pronaći kontakt email',
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?on_conflict=client_id,facebook_page_id`, {
      method : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey'       : SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer'       : 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(record),
    });

    if (res.ok || res.status === 201) {
      console.log(`  ✓ ${pageName} [${record.status}]${lead.igHandle ? ` @${lead.igHandle}` : ''}`);
      inserted++;
    } else {
      console.error(`  ✗ ${pageName}: ${(await res.text()).slice(0, 100)}`);
      failed++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Inserted      : ${inserted}`);
  console.log(`    With email  : ${inserted - failed > 0 ? toEnrich.filter(l => l.contact?.email).length : 0}`);
  console.log(`    No email    : ${toEnrich.filter(l => !l.contact?.email).length}`);
  console.log(`  Failed        : ${failed}`);
  console.log('\n  node generate_drafts.mjs --mode initial');
  console.log('  node send_outreach.mjs --dry-run');

  // Wait for IG caption search to finish and print its output
  if (igProcess) {
    console.log('\n\n' + '═'.repeat(56));
    console.log('  Waiting for IG caption search to finish...');
    console.log('═'.repeat(56));
    await new Promise(r => igProcess.on('close', r));
    console.log(igOutput);
  }
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
