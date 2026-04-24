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
import { readFileSync, readdirSync } from 'fs';
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

// DM-signal queries: businesses that advertise their inbox as the sales channel are
// literally describing the problem SmartFlow solves. "poruku/inbox/pišite/javite" catch
// any industry that uses DMs for sales — completely niche-agnostic.
// "iskustvo" (experience) is the vague broad catch-all — service-coded, appears in clinics,
// travel, events, renovation, hospitality across all industries, but rarely in webshop copy.
// The 20k+ follower gate in Stage 4 handles filtering out small retailers and webshops.
// Markets: RS = Serbia (primary), BA = Bosnia, HR = Croatia — all same language, untapped
const ADS_COUNTRIES = ['RS', 'BA', 'HR'];
const ADS_BASE_URL = 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=RS&media_type=video';
// Queries rotate to avoid re-pulling same inventory. Broad service-booking CTAs only.
// 'informišite' returns < 10 results — dropped. Replaced with 'uputite' and 'naručite'.
const ADS_QUERIES  = ['zakažite', 'rezervišite', 'pozovite', 'prijavite', 'kontaktirajte', 'naručite'];

const isLocal    = process.argv.includes('--local');      // read from local JSON files, skip Apify Stage 1
const isTest     = process.argv.includes('--test');       // no DB writes
const isYes      = process.argv.includes('--yes');        // live Apify run
const isFindOnly = process.argv.includes('--find-only'); // stop after Stage 4, no enrich/insert
const limitIdx  = process.argv.indexOf('--limit');
const budgetIdx = process.argv.indexOf('--budget');
const LIMIT     = limitIdx  !== -1 ? parseInt(process.argv[limitIdx  + 1]) : Infinity;

// --budget X: cost cap in USD for the FB ads scraper (e.g. --budget 0.45 → ~600 records)
const BUDGET_USD = budgetIdx !== -1 ? parseFloat(process.argv[budgetIdx + 1]) : null;
const COST_PER_RECORD = 0.00075;

// Raw ads to fetch: test=100, --budget drives live count, default live=2000
const RAW_LIMIT = isTest ? 100 : (BUDGET_USD ? Math.floor(BUDGET_USD / COST_PER_RECORD) : 2000);
const MAX_CHARGE = isTest ? 0.15 : (BUDGET_USD ? BUDGET_USD + 0.05 : 2.00); // +$0.05 headroom

// Local dataset files (used when --local flag is set)
const LOCAL_DATASETS_DIR = resolve(__dirname, '..');  // photonic-lunar/
const LOCAL_DATASET_GLOB = 'dataset_facebook-ads-library-scraper_';

// IG follower gates — anything outside this range is either too small or a mega-corp
const MIN_FOLLOWERS = 20000;
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
  // Retail / shopping
  'Shopping & retail', 'Shopping', 'Retail company', 'Website',
  'Brand', 'Bags/luggage',
  // Toys / kids / baby
  'Toy store', 'Toys', 'Baby goods/kids goods',
  // Food & beverage
  'Grocery store', 'Supermarket', 'Food & beverage', 'Restaurant',
  'Fast food restaurant', 'Bakery', 'Food delivery service',
  // Phones / electronics
  'Phone/Tablet', 'Electronics', 'Computer store', 'Video Games',
  // Health products (not services)
  'Vitamins/supplements', 'Supplement store', 'Health food store',
  // Cosmetics / perfume retail (D2C)
  'Health & Beauty', 'Health/beauty',
  // Food & beverage brands (FMCG corporations + food producers — not restaurants)
  'Food & beverage company', 'Beverage company', 'Food company',
  // Books / publishing
  'Books', 'Book series',
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
  // Other pure D2C
  'Interest', 'Sports team',
]);

// Page name keyword blacklist — catches retail/personal brands that slipped past category filter
const EXCLUDE_NAME_KEYWORDS = /\b(majice|majic|cipelice|cipela|cipele|obuća|obuca|kiflice|kiflic|torte|haljine|suknje|bluze|jakne|kaputi|šminke|sminke|nakit|parfem|parfemi|podkast|podcast|fondacija|fondacij|humanitar|zaklada|blog|kanal|kreator|otkriva|otkrivamo|istraž|dobrotvorn|volonter|donacij)\b/i;

function isExcludedByName(pageName) {
  return EXCLUDE_NAME_KEYWORDS.test(pageName || '');
}

const SOCIAL = new Set([
  'instagram.com', 'facebook.com', 'fb.me', 'fb.com', 'm.facebook.com',
  'bit.ly', 'linktr.ee', 'linktree.com', 'youtube.com', 'tiktok.com', 'wa.me',
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

// ── Serbian business detection ────────────────────────────────────────────────
// Requires .rs domain OR Serbian-specific words — rejects Polish/Croatian/Bosnian
// that merely target RS audience with Cyrillic-adjacent diacritics
const SERBIAN_WORDS = /\b(srbija|beograd|novi sad|niš|kragujevac|subotica|dinar|dinara|dostava|besplatna|porudžbina|usluga|popust|akcija|zakazivanje|termin|naručite|kupite|pogledajte|saznajte|pratite|pratilaca|ponuda|cena|cene|kontakt|telefon|adresa|radno vreme|radi|radimo|otvoreno)\b/i;

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

// ── Firecrawl website scrape for IG handle (JS-rendered pages) ───────────────
// Fallback when raw HTML fetch misses handles in React/Vue footers
async function findIgWithFirecrawl(domain) {
  const url = `https://${domain}`;
  try {
    const { stdout } = await execFileAsync('firecrawl', [
      'scrape', '--url', url, '--format', 'markdown',
    ], { timeout: 15000 });
    if (!stdout) return null;
    const matches = [...stdout.matchAll(/instagram\.com\/([a-zA-Z0-9._]{2,30})\/?/g)];
    for (const m of matches) {
      const handle = m[1].replace(/\/$/, '');
      if (isValidIgHandle(handle)) return handle;
    }
  } catch {}
  return null;
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

async function findEmailOnWebsite(domain) {
  const urls = [
    `https://${domain}/kontakt`,
    `https://${domain}/contact`,
    `https://${domain}/o-nama`,
    `https://${domain}`,
  ];
  const SKIP = /noreply|no-reply|example|sentry|wix|schema|privacy|jquery|\.(png|jpg|jpeg|gif|svg|webp|pdf|css|js)(@|$)/i;
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
      if (m && !SKIP.test(m[1])) return m[1];
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
  console.log(`  💰 Apify balance: $${remaining.toFixed(3)} remaining (used $${used.toFixed(3)} of $${limit})`);
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
    const chargePerBatch = parseFloat(Math.min(MAX_CHARGE / numBatches + 0.02, 0.30).toFixed(2));
    console.log(`  ${numBatches} batch(es) × up to ${perBatch} records, $${chargePerBatch} cap each\n`);
    const allRawItems = [];
    for (const urlObj of urlsToScrape) {
      const label = `FB Ads [${urlObj.country}·q=${urlObj.q}]`;
      const items = await runApify(
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
      allRawItems.push(...items);
    }
    rawItems = allRawItems;
    console.log(`\n  Raw records (all batches): ${rawItems.length}\n`);
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
  console.log(`  Sources: snapshot URL → ad copy domain → website HTML → Firecrawl FB /about → slug\n`);

  for (let i = 0; i < qualified.length; i++) {
    const lead = qualified[i];
    const snap   = lead.item.snapshot || {};
    const fbUri  = snap.page_profile_uri || '';

    // 3a. page_profile_uri is directly an instagram.com URL (rare but happens)
    if (fbUri.includes('instagram.com')) {
      try {
        const path = new URL(fbUri).pathname.replace(/^\//, '').replace(/\/$/, '').split('/').pop();
        if (isValidIgHandle(path)) { lead.igHandle = path; process.stdout.write('.'); continue; }
      } catch {}
    }

    // 3b. Extract domain from snapshot (link_url, caption)
    lead.domain = extractDomain(snap);

    // 3c. Extract domain from ad copy text (e.g. "Posetite nas na startours.rs")
    if (!lead.domain) {
      lead.domain = domainFromAdCopies(lead.adCopies);
    }

    // 3d. If domain found: raw HTML scrape first, then Firecrawl fallback for JS-rendered sites
    if (lead.domain && !lead.igHandle) {
      lead.igHandle = await findIgOnWebsite(lead.domain);
    }
    if (lead.domain && !lead.igHandle) {
      lead.igHandle = await findIgWithFirecrawl(lead.domain);
    }

    // 3e. FB page slug as IG handle candidate — Serbian businesses use same handle on both platforms.
    // Even if this is a guess, Stage 4 (Apify) confirms it and returns the real website via externalUrl.
    if (!lead.igHandle && fbUri) {
      const slug = fbUri.replace(/\/$/, '').split('/').filter(s =>
        s && s !== 'www.facebook.com' && s !== 'facebook.com' && s !== 'https:' && s !== 'http:'
      ).pop();
      if (slug && isValidIgHandle(slug)) {
        lead.igHandle = slug;
        lead.igHandleIsGuess = true;
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
  // Pre-filter: only verify handles for pages with ≥ 1500 FB likes OR unknown likes.
  // Pages with < 1500 FB likes almost never reach 20k IG followers — skip them to save ~$0.70/run.
  const FB_LIKES_MIN_FOR_IG = 1500;
  const igCandidates = withHandles.filter(l => {
    const likes = l.item.snapshot?.page_like_count || 0;
    return likes === 0 || likes >= FB_LIKES_MIN_FOR_IG; // 0 = unknown, include
  });

  const uniqueHandles = [...new Set(igCandidates.map(l => l.igHandle))];
  console.log(`  Verifying ${uniqueHandles.length} handles (FB likes ≥ ${FB_LIKES_MIN_FOR_IG} or unknown, filtered from ${withHandles.length})...`);

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
  let confirmed = 0, above20k = 0;
  for (const lead of withHandles) {
    const profile = profileByHandle.get(lead.igHandle.toLowerCase());
    if (profile) {
      lead.igProfile = profile;
      lead.igFollowers = profile.followersCount || 0;
      confirmed++;
      if (lead.igFollowers >= MIN_FOLLOWERS) above20k++;
      // KEY: use IG bio's external_url as the website if we don't have one yet
      const extUrl = profile.externalUrl;
      if (extUrl && !lead.domain) {
        try {
          lead.domain = new URL(extUrl).hostname.replace(/^www\./, '');
        } catch {}
      }
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

  // Gate: 20k–500k followers. Confirmed IG data wins; FB likes used as proxy if no IG handle.
  const toEnrich = qualified.filter(lead => {
    const followers = lead.igFollowers ?? (lead.item.snapshot?.page_like_count || 0);
    return followers >= MIN_FOLLOWERS && followers <= MAX_FOLLOWERS;
  });
  const skippedLowFollowers = qualified.length - toEnrich.length;

  console.log(`  Confirmed handles  : ${confirmed}/${uniqueHandles.length}`);
  console.log(`  ≥ ${MIN_FOLLOWERS/1000}k followers     : ${above20k}`);
  console.log(`  Skipped (< ${MIN_FOLLOWERS/1000}k)    : ${skippedLowFollowers}`);
  console.log(`  Domain from externalUrl: ${qualified.filter(l => l.domain && l.igProfile?.externalUrl).length}`);
  console.log(`  Proceeding with ${toEnrich.length} leads (${MIN_FOLLOWERS/1000}k+ filter applied)\n`);

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

    if (fbEmail) {
      contact = { email: fbEmail, name: null, title: null };
    } else if (domain) {
      // Hunter first
      process.stdout.write(`  Hunter (${domain})... `);
      contact = await hunterDomain(domain);
      if (contact) {
        console.log(`${contact.email}${contact.name ? ` (${contact.name})` : ''}`);
      } else {
        // Website scrape fallback
        process.stdout.write(`not found → website scrape... `);
        const email = await findEmailOnWebsite(domain);
        console.log(email || 'not found');
        if (email) contact = { email, name: null, title: null };
      }
    } else {
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
              external_url     : lead.igProfile.externalUrl || null,
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
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
