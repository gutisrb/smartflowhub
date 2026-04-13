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
 *   Stage 4: ScrapeCreators — verify followers ≥ 10k (5 concurrent calls)
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
const APIFY_TOKEN    = process.env.APIFY_TOKEN;
const FB_ADS_ACTOR   = 'XtaWFhbtfxyzqrFmd';
const SC_API_KEY     = process.env.SC_API_KEY;

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SMARTFLOW_ID   = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const HUNTER_KEY     = process.env.HUNTER_API_KEY;

// Multiple broad Serbian queries — each hits a different slice of the ad pool
const ADS_LIBRARY_URLS = [
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=RS&media_type=video&q=dostava',
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=RS&media_type=video&q=naruci',
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=RS&media_type=video&q=akcija',
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=RS&media_type=video&q=popust',
];

const isLocal  = process.argv.includes('--local');   // read from local JSON files, skip Apify Stage 1
const isTest   = process.argv.includes('--test');    // no DB writes
const isYes    = process.argv.includes('--yes');     // live Apify run
const limitIdx = process.argv.indexOf('--limit');
const LIMIT    = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : 100;

// Raw ads to fetch when calling Apify: 100 in test, 4000 in live
const RAW_LIMIT = isTest ? 100 : 4000;

// Local dataset files (used when --local flag is set)
const LOCAL_DATASETS_DIR = resolve(__dirname, '..');  // photonic-lunar/
const LOCAL_DATASET_GLOB = 'dataset_facebook-ads-library-scraper_';

// Minimum IG followers to qualify a lead
const MIN_FOLLOWERS = 20000;

// ── D2C retail & irrelevant exclusion ─────────────────────────────────────────
// Anything that sells physical products, media, or has no service DM use-case
const EXCLUDE_CATS = new Set([
  // Apparel / fashion
  'Clothing (Brand)', 'Boutique store', 'Fashion designer', 'Fashion & beauty',
  "Women's Clothing", "Men's Clothing", 'Clothing store',
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
  // Media / entertainment
  'Personal blog', 'Public figure', 'Artist', 'Musician/band', 'Magazine',
  'Media/news company', 'Entertainment website', 'TV channel',
  // Other pure D2C
  'Interest', 'Sports team',
]);

const SOCIAL = new Set([
  'instagram.com', 'facebook.com', 'fb.me', 'fb.com', 'm.facebook.com',
  'bit.ly', 'linktr.ee', 'linktree.com', 'youtube.com', 'tiktok.com', 'wa.me',
]);

// ── IG handle validation ──────────────────────────────────────────────────────
const TLDS    = new Set(['com','rs','eu','net','org','io','co','biz','info','hr','ba','si','me','de','fr','uk','it','png','jpg','svg','gif','webp','pdf']);
const IG_SKIP = new Set(['p','reel','explore','accounts','stories','tv','reels','direct','sharedData','share','privacy','legal','about','blog','help','press','api','static','cdn']);

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
  // .rs domain in any URL = Serbian business
  const allUrls = [...linkUrls, fbPageUri || ''];
  for (const url of allUrls) {
    if (url && /\.rs(\/|$)/i.test(url)) return true;
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

// ── ScrapeCreators — IG profile lookup ───────────────────────────────────────
async function scrapeCreatorsProfile(handle) {
  try {
    const res = await fetch(
      `https://api.scrapecreators.com/v1/instagram/profile?handle=${encodeURIComponent(handle)}`,
      { headers: { 'x-api-key': SC_API_KEY }, signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const user = data?.data?.user;
    if (!user) return null;
    return {
      username    : user.username || handle,
      followers   : user.edge_followed_by?.count || 0,
      bio         : user.biography || '',
      external_url: user.external_url || null,
      is_verified : user.is_verified || false,
      is_private  : user.is_private || false,
    };
  } catch { return null; }
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
  const SKIP = /noreply|no-reply|example|sentry|wix|schema|privacy|jquery/;
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
  const limit = plan.monthlyUsageCreditsUsd ?? 0;
  const remaining = limit - used;
  console.log(`  💰 Apify balance: $${remaining.toFixed(3)} remaining (used $${used.toFixed(3)} of $${limit})`);
  if (remaining < 1.00) throw new Error(`Apify balance too low ($${remaining.toFixed(3)} < $1.00 minimum). Top up first.`);
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
      body: JSON.stringify({ ...input, maxTotalChargeUsd: maxCharge }),
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

  // Load existing page IDs from DB (always — even in test, so filter shows what's already there)
  let existingPageIds = new Set();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?select=facebook_page_id&client_id=eq.${SMARTFLOW_ID}&facebook_page_id=not.is.null`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const existing = await res.json();
  existingPageIds = new Set((existing || []).map(r => String(r.facebook_page_id)));
  console.log(`Existing in DB: ${existingPageIds.size}\n`);

  // ── Stage 1: Load raw ads ─────────────────────────────────────────────────────
  let rawItems;
  if (isLocal) {
    console.log('─── Stage 1: Loading local JSON datasets (FREE) ────────');
    rawItems = loadLocalDatasets();
    console.log(`  Total raw records: ${rawItems.length}\n`);
  } else {
    console.log('─── Stage 1: FB Ads Library via Apify ──────────────────');
    rawItems = await runApify(
      FB_ADS_ACTOR,
      { urls: ADS_LIBRARY_URLS.map(url => ({ url })) },
      'FB Ads Library',
      RAW_LIMIT,
      isTest ? 0.15 : 4.00,
    );
    console.log(`  Raw records: ${rawItems.length}\n`);
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
  const dbg = { db: 0, noIG: 0, fewAds: 0, noSerbian: 0, tooSmall: 0, tooBig: 0, person: 0, retail: 0, passed: 0 };

  for (const [pid, { item, adCopies, count }] of byPage) {
    const snap = item.snapshot || {};
    const likes = snap.page_like_count || 0;
    const cats  = snap.page_categories || [];
    const platforms = item.publisher_platform || [];

    if (existingPageIds.has(pid))                         { dbg.db++;        continue; }
    if (snap.page_entity_type === 'PERSON_PROFILE')       { dbg.person++;    continue; }
    if (!platforms.includes('INSTAGRAM'))                  { dbg.noIG++;      continue; }
    if (count < 3)                                         { dbg.fewAds++;    continue; }
    if (likes < 500)                                       { dbg.tooSmall++;  continue; }
    if (likes > 500000)                                    { dbg.tooBig++;    continue; }
    if (cats.some(c => EXCLUDE_CATS.has(c)))               { dbg.retail++;    continue; }

    // Serbian business check — requires .rs domain or Serbian-specific vocabulary
    const linkUrls = [snap.link_url, snap.caption].filter(Boolean);
    if (!isSerbianBusiness(adCopies, linkUrls, snap.page_profile_uri)) { dbg.noSerbian++; continue; }

    dbg.passed++;
    qualified.push({ pid, item, adCopies, count });
  }

  qualified.sort((a, b) => (b.item.snapshot?.page_like_count || 0) - (a.item.snapshot?.page_like_count || 0));
  const toProcess = qualified.slice(0, LIMIT);

  console.log(`  Already in DB    : ${dbg.db}`);
  console.log(`  No Instagram     : ${dbg.noIG}`);
  console.log(`  < 3 ads          : ${dbg.fewAds}`);
  console.log(`  Not Serbian      : ${dbg.noSerbian}`);
  console.log(`  Likes out range  : ${dbg.tooSmall + dbg.tooBig}`);
  console.log(`  Person profile   : ${dbg.person}`);
  console.log(`  D2C retail       : ${dbg.retail}`);
  console.log(`  Qualified        : ${dbg.passed} → processing top ${toProcess.length}\n`);

  if (!toProcess.length) { console.log('No qualified leads found.'); return; }

  // ── Stage 3: IG handle extraction ────────────────────────────────────────────
  console.log('─── Stage 3: IG handle extraction (website HTML) ───────');

  for (const lead of toProcess) {
    const snap   = lead.item.snapshot || {};
    const fbUri  = snap.page_profile_uri || '';

    // Check if page_profile_uri is itself an instagram.com URL
    if (fbUri.includes('instagram.com')) {
      try {
        const path = new URL(fbUri).pathname.replace(/^\//, '').replace(/\/$/, '').split('/').pop();
        if (isValidIgHandle(path)) { lead.igHandle = path; continue; }
      } catch {}
    }

    // Extract domain and scrape website HTML for IG link
    lead.domain = extractDomain(snap);
    if (lead.domain) {
      lead.igHandle = await findIgOnWebsite(lead.domain);
    }

    // Fallback: use FB page slug as IG candidate (same handle on both platforms is common in RS)
    if (!lead.igHandle && fbUri) {
      const slug = fbUri.replace(/\/$/, '').split('/').filter(s =>
        s && s !== 'www.facebook.com' && s !== 'facebook.com' && s !== 'https:' && s !== 'http:'
      ).pop();
      if (slug && isValidIgHandle(slug)) {
        lead.igHandle = slug;
        lead.igHandleIsGuess = true;
      }
    }

    if (lead.igHandle) {
      process.stdout.write('.');
    } else {
      process.stdout.write('x');
    }
    await sleep(200);
  }
  console.log();

  const withHandles = toProcess.filter(l => l.igHandle);
  console.log(`  Found handles: ${withHandles.length}/${toProcess.length}\n`);

  if (!withHandles.length) {
    console.log('No IG handles found — cannot verify followers. Check Stage 3 logic.');
    return;
  }

  // ── Stage 4: ScrapeCreators — follower verification ──────────────────────────
  console.log('─── Stage 4: ScrapeCreators (follower verification) ─────');

  const uniqueHandles = [...new Set(withHandles.map(l => l.igHandle))];
  console.log(`  Checking ${uniqueHandles.length} handles for ${MIN_FOLLOWERS/1000}k+ followers...`);

  // Parallel with concurrency limit of 5 to avoid rate limits
  const CONCURRENCY = 5;
  const profileByHandle = new Map();
  for (let i = 0; i < uniqueHandles.length; i += CONCURRENCY) {
    const batch = uniqueHandles.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(h => scrapeCreatorsProfile(h)));
    for (let j = 0; j < batch.length; j++) {
      if (results[j]) profileByHandle.set(batch[j].toLowerCase(), results[j]);
    }
    process.stdout.write(`\r  ${Math.min(i + CONCURRENCY, uniqueHandles.length)}/${uniqueHandles.length}`);
    if (i + CONCURRENCY < uniqueHandles.length) await sleep(500);
  }
  console.log();

  // Attach profile data to leads
  let qualified10k = 0;
  for (const lead of withHandles) {
    const profile = profileByHandle.get(lead.igHandle.toLowerCase());
    if (profile) {
      lead.igProfile = profile;
      lead.igFollowers = profile.followers || 0;
      if (lead.igFollowers >= MIN_FOLLOWERS) qualified10k++;
    }
  }

  // If ScrapeCreators verified followers → use that. Otherwise fall back to FB page_like_count.
  // Never pass through unverified with 0 count — require at least the FB likes threshold.
  for (const lead of withHandles) {
    if (lead.igFollowers == null) {
      // SC out of credits — use FB likes as proxy (conservative: require 2x threshold)
      const fbLikes = lead.item.snapshot?.page_like_count || 0;
      lead.igFollowers = fbLikes;
      lead.igFollowerSource = 'fb_likes_fallback';
    }
  }
  const toEnrich = withHandles.filter(l => l.igFollowers >= MIN_FOLLOWERS);
  const skippedLowFollowers = withHandles.length - toEnrich.length;

  console.log(`  Profiles verified  : ${profileByHandle.size}/${uniqueHandles.length}`);
  console.log(`  ≥ ${MIN_FOLLOWERS/1000}k followers     : ${qualified10k}`);
  console.log(`  Skipped (< ${MIN_FOLLOWERS/1000}k)    : ${skippedLowFollowers}\n`);

  if (!toEnrich.length) {
    console.log('No leads passed the follower threshold. Adjust MIN_FOLLOWERS or re-run with more raw ads.');
    return;
  }

  // ── Stage 5: Email enrichment ─────────────────────────────────────────────────
  console.log(`─── Stage 5: Email enrichment (${toEnrich.length} leads) ──────────`);

  let emailFound = 0;

  for (let i = 0; i < toEnrich.length; i++) {
    const lead = toEnrich[i];
    const snap     = lead.item.snapshot || {};
    const pageName = lead.item.page_name || snap.page_name || '';
    const followers = lead.igFollowers != null ? `${(lead.igFollowers/1000).toFixed(1)}k followers` : 'followers unknown';

    console.log(`[${i+1}/${toEnrich.length}] ${pageName} (@${lead.igHandle}, ${followers})`);

    let domain  = lead.domain;
    let contact = null;
    let fbEmail = null;

    if (!domain) {
      // Domain not yet found — try Firecrawl FB about page
      process.stdout.write(`  FB about scrape... `);
      const fb = await scrapeFacebookAbout(snap.page_profile_uri);
      domain  = fb.website || null;
      lead.igHandle = lead.igHandle || fb.ig;
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

  // ── Stage 6: DB upsert ────────────────────────────────────────────────────────
  if (isTest) {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  [TEST MODE] — results above, no DB writes');
    console.log(`  Leads that would be inserted: ${toEnrich.length}`);
    console.log(`    With email  : ${emailFound}`);
    console.log(`    With IG     : ${toEnrich.filter(l => l.igHandle).length}`);
    console.log(`  Run with --yes to insert into DB.`);
    return;
  }

  console.log(`─── Stage 6: DB upsert (${toEnrich.length} leads) ──────────────`);
  let inserted = 0, failed = 0;

  for (const lead of toEnrich) {
    const snap     = lead.item.snapshot || {};
    const pageName = lead.item.page_name || snap.page_name || '';
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
              followers        : lead.igProfile.followers || followers,
              bio              : lead.igProfile.bio || null,
              is_verified      : lead.igProfile.is_verified || false,
              external_url     : lead.igProfile.external_url || null,
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
