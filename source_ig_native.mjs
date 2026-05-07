/**
 * SmartFlow Lead Sourcer — Instagram Native API (No Apify)
 *
 * Discovers Serbian service-business accounts at zero Apify cost:
 *   1. Firecrawl search (wraps Google/Bing) across ~15 Serbian business verticals
 *      → returns structured results with Instagram profile URLs
 *   2. Extracts IG handles from URLs and titles
 *   3. Verifies each via Instagram's web_profile_info API (free, no Apify)
 *   4. Filters: 15k–200k followers, business account, Serbian market, not excluded
 *   5. Enriches email: IG business_email → Hunter → raw scrape → Firecrawl
 *   6. Inserts to contacts table (same schema as all other scripts)
 *
 * Does NOT touch source_leads.mjs or source_ig_search.mjs.
 * Cost: Firecrawl search credits only (no Apify). Profile lookups are free.
 *
 * Usage:
 *   node source_ig_native.mjs            — live run
 *   node source_ig_native.mjs --dry-run  — preview candidates, no DB writes
 *   node source_ig_native.mjs --limit 20 — cap inserts at 20
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
const __dirname = dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);

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

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HUNTER_KEY        = process.env.HUNTER_API_KEY;
const FIRECRAWL_KEY     = process.env.FIRECRAWL_API_KEY;
const RAW_SESSION       = process.env.IG_SESSION_ID;
let   SESSION_ID        = RAW_SESSION ? decodeURIComponent(RAW_SESSION) : null;
const SMARTFLOW_ID      = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

const isDryRun     = process.argv.includes('--dry-run');
const verifyOnly   = process.argv.includes('--verify-only');
const limitIdx     = process.argv.indexOf('--limit');
const LIMIT        = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : Infinity;
const HANDLES_CACHE = resolve(__dirname, '.ig_native_handles_cache.json');

const MIN_FOLLOWERS         = 15000;
const MAX_FOLLOWERS         = 200000;
const MAX_HANDLES_TO_VERIFY = 300;
const RESULTS_PER_QUERY     = 20;

// ── Search queries ────────────────────────────────────────────────────────────
// Targeted queries sent to Firecrawl search (wraps Google, geo-targeted to RS).
// Each returns up to RESULTS_PER_QUERY Instagram profile URLs.
// Uses plain ASCII - no Serbian diacritics needed since search is semantic.
const SEARCH_QUERIES = [
  // Automotive
  'instagram.com auto salon prodaja automobila beograd srbija',
  'instagram.com auto servis detailing poliranje beograd',
  // Education
  'instagram.com jezicka skola kurs engleski nemacki beograd',
  'instagram.com IT akademija programiranje kurs online srbija',
  // Hospitality & accommodation
  'instagram.com hotel smestaj novcenje beograd srbija',
  'instagram.com seosko turizam apartmani vikendica srbija',
  // Events & photography
  'instagram.com fotograf studio vencanje portret beograd',
  'instagram.com event agencija organizacija zabave proslava srbija',
  // Home & construction
  'instagram.com solarni sistemi ugradnja paneli srbija',
  'instagram.com gradjevinska firma renovacija kuca srbija',
  // Beauty (new niches)
  'instagram.com tattoo studio tetovaze beograd srbija',
  'instagram.com nail art manikir pedikir studio beograd',
  // Health (new niches)
  'instagram.com privatna klinika bolnica hirurgija srbija',
  'instagram.com veterinar klinika ljubimci beograd srbija',
  // Kids & sports
  'instagram.com skola sporta deca plivanje fudbal beograd',
];

// ── Exclusion categories (same as source_ig_search.mjs) ──────────────────────
const EXCLUDE_CATS = new Set([
  'Clothing (Brand)', 'Boutique store', 'Fashion designer', 'Clothing store',
  "Women's Clothing", "Men's Clothing", 'Cosmetics store',
  'Jewelry/watches', 'Personal blog', 'Public figure',
  'Artist', 'Musician/band', 'Media/news company', 'Shopping & retail',
  'Book series', 'Books', 'TV channel', 'Entertainment website',
  'Sports team', 'Interest',
  'Digital creator', 'Content creator', 'Blogger', 'Creators & Celebrities',
  'Comedian', 'Entertainer', 'Actor/director',
  'Community Organization', 'Community', 'Local business', 'City', 'Region',
  'News & media website', 'News personality', 'News/media website',
  'Government organization', 'Government website', 'Government official',
  'Political party', 'Politician', 'Non-profit organization', 'Nonprofit organization',
  'Magazine', 'Newspaper', 'Broadcasting & media production company',
  'Radio station', 'Podcast',
  'Restaurant', 'Cafe', 'Bar', 'Bar & grill', 'Fast food restaurant',
  'Pizza place', 'Bakery', 'Food & beverage company', 'Winery/vineyard',
]);

const PRODUCT_SELLER_BIO = /\bprodajemo\b|\bwebshop\b|web\s+shop|\bnakit\s+od\b|garderob[au].*brendov|šolj[ae].*jastuci|majice.*jastuci|obuć[au].*brendov|prodaja pratilaca|prodaj[ae] lajkov|kupovina pratilaca|boost.*pratilac/i;

// IG paths that are not user profiles
const IG_NON_PROFILE_PATHS = new Set([
  'p', 'reel', 'reels', 'stories', 'explore', 'tv', 'accounts',
  'about', 'help', 'privacy', 'legal', 'press', 'instagram',
  'popular', 'trending', 'direct',
]);

const LINK_AGGREGATORS = new Set([
  'linktr.ee', 'linktree.com', 'taplink.cc', 'beacons.ai', 'bio.link',
  'opentable.com', 'resy.com', 'booksy.com', 'calendly.com',
  'booking.com', 'tripadvisor.com', 'treatwell.com',
]);

const SOCIAL_DOMAINS = new Set([
  'instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com',
  'youtube.com', 'linkedin.com', 'snapchat.com', 'pinterest.com',
  ...LINK_AGGREGATORS,
]);

const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  'yourbusiness.com', 'yourdomain.com', 'example.com', 'test.com',
  'domain.com', 'yoursite.com', 'yourcompany.com', 'website.com',
  'domena.hr', 'domena.rs', 'website.hr',
]);

const BAD_EMAIL_RX   = /^(noreply@|no-reply@|workspace@|posao@|hr@|kadrovi@|jobs@|career@|zaposlenje@)/i;
const IMAGE_EMAIL_RX = /\.(png|jpg|svg|webp|gif)@/i;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isGarbageEmail(email) {
  if (!email) return true;
  if (BAD_EMAIL_RX.test(email)) return true;
  if (IMAGE_EMAIL_RX.test(email)) return true;
  if (/^%20/.test(email)) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  return PLACEHOLDER_EMAIL_DOMAINS.has(domain);
}

// ── Firecrawl search → extract IG handles ────────────────────────────────────

/**
 * Run a Firecrawl search and return unique IG handles found in results.
 * Uses the Firecrawl API directly for cleaner JSON parsing.
 */
async function firecrawlSearch(query) {
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${FIRECRAWL_KEY}`,
      },
      body: JSON.stringify({
        query,
        limit: RESULTS_PER_QUERY,
        country: 'RS',
        lang: 'sr',
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.log(`  Firecrawl search error ${res.status}: ${err.slice(0, 100)}`);
      return [];
    }

    const data = await res.json();
    const results = data?.data?.web || data?.results || data?.data || [];
    if (!Array.isArray(results)) return [];

    const handles = new Set();
    for (const item of results) {
      // 1. Extract from URL: instagram.com/{handle}/...
      const urlMatch = (item.url || '').match(/instagram\.com\/([a-zA-Z0-9._]{3,30})/);
      if (urlMatch && !IG_NON_PROFILE_PATHS.has(urlMatch[1].toLowerCase())) {
        handles.add(urlMatch[1].toLowerCase());
      }
      // 2. Extract from title: "Name (@handle) - Instagram"
      const titleMatch = (item.title || '').match(/@([a-zA-Z0-9._]{3,30})/);
      if (titleMatch && !IG_NON_PROFILE_PATHS.has(titleMatch[1].toLowerCase())) {
        handles.add(titleMatch[1].toLowerCase());
      }
      // 3. Extract from description: any @handle or instagram.com/handle
      const desc = item.description || '';
      for (const m of desc.matchAll(/instagram\.com\/([a-zA-Z0-9._]{3,30})/g)) {
        if (!IG_NON_PROFILE_PATHS.has(m[1].toLowerCase())) handles.add(m[1].toLowerCase());
      }
    }
    return [...handles];
  } catch (err) {
    console.log(`  Search failed: ${err.message}`);
    return [];
  }
}

// ── Instagram profile verification ───────────────────────────────────────────

function igHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'X-IG-App-ID': '936619743392459',
    'Accept': 'application/json',
    'Referer': 'https://www.instagram.com/',
    ...(SESSION_ID ? { 'Cookie': `sessionid=${SESSION_ID}` } : {}),
  };
}

/**
 * Fetch full profile via Instagram's web_profile_info endpoint.
 * Free, no Apify. Returns null on failure, { rateLimited: true } on 429.
 */
async function fetchProfile(username) {
  try {
    const res = await fetch(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      { headers: igHeaders(), signal: AbortSignal.timeout(12000) }
    );
    if (res.status === 429) return { rateLimited: true };
    if (res.status === 404 || !res.ok) return null;
    const data = await res.json();
    if (data.message === 'challenge_required') return { rateLimited: true };
    const user = data?.data?.user;
    if (!user) return null;
    return {
      username:             user.username,
      fullName:             user.full_name || '',
      biography:            user.biography || '',
      followersCount:       user.edge_followed_by?.count || 0,
      isBusinessAccount:    user.is_business_account || false,
      businessCategoryName: user.category_name || user.business_category_name || '',
      externalUrl:          user.external_url || '',
      businessEmail:        user.business_email || null,
      isPrivate:            user.is_private || false,
      postsCount:           user.edge_owner_to_timeline_media?.count || 0,
    };
  } catch {
    return null;
  }
}

function isSerbianMarket(profile) {
  const extDomain = (() => {
    try { return new URL(profile.externalUrl || '').hostname.toLowerCase(); }
    catch { return ''; }
  })();
  const bio = profile.biography.toLowerCase();
  return extDomain.endsWith('.rs')
    || /srbija|srbiji|beograd|novi\s?sad|niš|kragujevac|subotica|čačak|valjevo|užice|smederevo|šabac|pančevo|zrenjanin|leskovac|kikinda/.test(bio)
    || /[šćčžđŠĆČŽĐ]/.test(profile.biography);
}

// ── Domain resolution (mirrors source_ig_search.mjs) ─────────────────────────

function extractDomainFromBio(bio) {
  if (!bio) return null;
  const RX = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9\-]{1,61}[a-zA-Z0-9]\.[a-z]{2,10})(?:\/[^\s\n]*)?\b/g;
  let m;
  while ((m = RX.exec(bio)) !== null) {
    const d = m[1].toLowerCase();
    if (!SOCIAL_DOMAINS.has(d) && !/\.(jpg|jpeg|png|gif|svg|webp)$/i.test(d)) return d;
  }
  return null;
}

async function resolveAggregatorUrl(url) {
  try {
    const { stdout } = await execFileAsync('firecrawl', ['scrape', '--url', url, '--format', 'markdown'], { timeout: 12000 });
    if (!stdout?.trim()) return null;
    const RX = /https?:\/\/(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9\-]{1,61}[a-zA-Z0-9]\.[a-z]{2,10})(?:\/[^\s)'"]*)?/g;
    let m;
    while ((m = RX.exec(stdout)) !== null) {
      const d = m[1].toLowerCase();
      if (!SOCIAL_DOMAINS.has(d)) return d;
    }
  } catch {}
  return null;
}

async function resolveDomain(profile) {
  const externalUrl = profile.externalUrl || null;
  const rawDomain = externalUrl
    ? (() => { try { return new URL(externalUrl).hostname.replace(/^www\./, ''); } catch { return null; } })()
    : null;
  if (rawDomain && !LINK_AGGREGATORS.has(rawDomain) && !SOCIAL_DOMAINS.has(rawDomain)) return rawDomain;
  const bioDomain = extractDomainFromBio(profile.biography);
  if (bioDomain) return bioDomain;
  if (rawDomain && LINK_AGGREGATORS.has(rawDomain) && externalUrl) {
    process.stdout.write(`  Following ${rawDomain}... `);
    const resolved = await resolveAggregatorUrl(externalUrl);
    if (resolved) { console.log(`→ ${resolved}`); return resolved; }
    console.log('(no real URL)');
  }
  return null;
}

// ── Email enrichment (mirrors source_ig_search.mjs) ──────────────────────────

async function hunterDomain(domain) {
  if (!HUNTER_KEY || !domain) return null;
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${HUNTER_KEY}`);
    const emails = (await res.json())?.data?.emails || [];
    if (!emails.length) return null;
    const SENIORITY = ['c_suite', 'vp', 'director', 'manager', 'senior', 'entry'];
    const DEPTS = ['management', 'executive', 'sales', 'marketing'];
    const best = [...emails].sort((a, b) => {
      const dA = DEPTS.includes(a.department) ? 0 : 1, dB = DEPTS.includes(b.department) ? 0 : 1;
      if (dA !== dB) return dA - dB;
      const sA = SENIORITY.indexOf(a.seniority || ''), sB = SENIORITY.indexOf(b.seniority || '');
      if (sA !== sB) return (sA < 0 ? 99 : sA) - (sB < 0 ? 99 : sB);
      return (b.confidence || 0) - (a.confidence || 0);
    })[0];
    if (!best?.value) return null;
    if (SOCIAL_DOMAINS.has(best.value.split('@')[1]?.toLowerCase())) return null;
    return { email: best.value, name: [best.first_name, best.last_name].filter(Boolean).join(' ') || null, title: best.position || null };
  } catch { return null; }
}

async function findEmailOnWebsite(domain) {
  const SKIP = /noreply|no-reply|example|sentry|wix|schema|privacy|qodeinteractive|\.(png|jpg|svg|css|js)(@|$)/i;
  for (const path of ['/kontakt', '/contact', '']) {
    try {
      const res = await fetch(`https://${domain}${path}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000), redirect: 'follow',
      });
      if (!res.ok) continue;
      const m = (await res.text()).match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (m && !SKIP.test(m[1])) return m[1];
    } catch {}
  }
  return null;
}

async function firecrawlWebsite(domain) {
  const result = { email: null, summary: null };
  if (!domain) return result;
  const SKIP_EMAIL = /noreply|no-reply|example|sentry|wix|schema|privacy|qodeinteractive|\.(png|jpg|svg|css|js)(@|$)/i;
  for (const path of ['/kontakt', '/contact', '/o-nama', '']) {
    try {
      const { stdout } = await execFileAsync('firecrawl', ['scrape', '--url', `https://${domain}${path}`, '--format', 'markdown'], { timeout: 15000 });
      if (!stdout?.trim()) continue;
      if (!result.email) {
        const m = stdout.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
        if (m && !SKIP_EMAIL.test(m[1]) && !m[1].includes('example')) result.email = m[1];
      }
      if (!result.summary && path === '') {
        const lines = stdout.split('\n').map(l => l.replace(/[#*_\[\]()]/g, '').trim()).filter(l => l.length >= 80);
        if (lines[0]) result.summary = lines[0].slice(0, 300);
      }
      if (result.email && result.summary) break;
    } catch {}
  }
  return result;
}

function mapNiche(bio = '', cat = '') {
  const t = (bio + ' ' + cat).toLowerCase();
  if (/kozmet|spa|wellness|estet|stomatol|fizioter|klinika|ordinacija|bolnica|dermatol|beauty|dental/.test(t)) return 'klinika_wellness';
  if (/fitness|gym|sport|trening|fitnes|yoga|pilates/.test(t)) return 'fitnes';
  if (/restoran|kafana|catering|picerija|hotel|vila|lounge|bar/.test(t)) return 'ugostiteljstvo';
  if (/nekretnin|real estate|stan/.test(t)) return 'nekretnine';
  if (/kurs|obuka|akademija|edukacij|škola|coaching/.test(t)) return 'edukacija';
  if (/putovanj|travel|turist|agencij|tur/.test(t)) return 'putovanja';
  if (/enterijer|interior|nameštaj|namestaj|decor|dizajn/.test(t)) return 'enterijer';
  return 'other';
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SmartFlow Lead Sourcer — Instagram Native API (No Apify)');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'} | Queries: ${SEARCH_QUERIES.length} | Apify: $0`);
  console.log('  Flow: Firecrawl search → IG handle → web_profile_info verify');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ── Load existing DB handles + emails ────────────────────────────────────
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${SMARTFLOW_ID}&select=instagram_handle,email`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const existingAll   = await existingRes.json();
  const existingHandles = new Set(existingAll.map(r => r.instagram_handle?.toLowerCase()).filter(Boolean));
  const existingEmails  = new Set(existingAll.map(r => r.email?.toLowerCase()).filter(Boolean));
  console.log(`DB: ${existingHandles.size} handles, ${existingEmails.size} emails\n`);

  // ── Stage 1: Firecrawl search → collect handles ───────────────────────────
  let uniqueHandles;

  if (verifyOnly && existsSync(HANDLES_CACHE)) {
    const cached = JSON.parse(readFileSync(HANDLES_CACHE, 'utf8'));
    uniqueHandles = cached.filter(h => !existingHandles.has(h));
    console.log(`─── Stage 1: Skipped (--verify-only) — ${uniqueHandles.length} handles from cache\n`);
  } else {
    console.log('─── Stage 1: Firecrawl search ────────────────────────────');
    const seenThisRun = new Set();
    const allHandles  = [];

    for (const query of SEARCH_QUERIES) {
      if (allHandles.length >= MAX_HANDLES_TO_VERIFY) {
        console.log(`  Cap reached (${MAX_HANDLES_TO_VERIFY}) — stopping search`);
        break;
      }
      process.stdout.write(`  "${query.slice(0, 55)}"... `);
      const found = await firecrawlSearch(query);
      const newHandles = found.filter(h => !existingHandles.has(h) && !seenThisRun.has(h));
      for (const h of newHandles) seenThisRun.add(h);
      allHandles.push(...newHandles);
      console.log(`${newHandles.length} new (${found.length} found)`);
      await sleep(1000);
    }

    uniqueHandles = allHandles.slice(0, MAX_HANDLES_TO_VERIFY);
    // Save to cache so --verify-only can reuse without re-spending search credits
    writeFileSync(HANDLES_CACHE, JSON.stringify(uniqueHandles));
    console.log(`\n  Total unique new handles to verify: ${uniqueHandles.length} (saved to cache)\n`);
  }

  if (!uniqueHandles.length) {
    console.log('No new handles found — all search results already in DB.');
    return;
  }

  // ── Stage 2: Profile verification via Instagram API ───────────────────────
  console.log('─── Stage 2: Profile verification ───────────────────────');
  const candidates = [];

  for (let i = 0; i < uniqueHandles.length; i++) {
    const username = uniqueHandles[i];
    process.stdout.write(`  [${i + 1}/${uniqueHandles.length}] @${username}... `);

    let profile = await fetchProfile(username);

    if (profile?.rateLimited) {
      // Try without session cookie — session may be flagged separately from IP
      const savedSession = SESSION_ID;
      SESSION_ID = null;
      process.stdout.write('rate limited — retrying anon... ');
      profile = await fetchProfile(username);
      if (profile && !profile.rateLimited) {
        console.log('anon works — dropping session for this run');
        // SESSION_ID stays null for the rest of the run
      } else {
        SESSION_ID = savedSession;
        console.log('rate limited — waiting 90s');
        await sleep(90000);
        profile = await fetchProfile(username);
        if (!profile || profile.rateLimited) { console.log('still limited — stopping'); break; }
      }
    }

    if (!profile)                                              { console.log('not found'); await sleep(600); continue; }
    if (profile.isPrivate)                                     { console.log('private'); await sleep(400); continue; }
    if (!profile.isBusinessAccount)                            { console.log('not business'); await sleep(400); continue; }
    const f = profile.followersCount;
    if (f < MIN_FOLLOWERS || f > MAX_FOLLOWERS)                { console.log(`${(f/1000).toFixed(0)}k (out of range)`); await sleep(400); continue; }
    const cats = (profile.businessCategoryName || '').split(',').map(c => c.trim());
    if (cats.some(c => EXCLUDE_CATS.has(c)))                  { console.log(`excl: ${profile.businessCategoryName}`); await sleep(400); continue; }
    if (PRODUCT_SELLER_BIO.test(profile.biography || ''))     { console.log('product seller'); await sleep(400); continue; }
    if (!isSerbianMarket(profile))                             { console.log('not Serbian'); await sleep(400); continue; }

    console.log(`✓ ${(f/1000).toFixed(1)}k | ${profile.businessCategoryName || 'no cat'}`);
    candidates.push(profile);
    await sleep(800);
  }

  console.log(`\n  Qualified (15k+, business, Serbian): ${candidates.length}\n`);
  if (!candidates.length) { console.log('No qualified candidates this run.'); return; }

  candidates.sort((a, b) => b.followersCount - a.followersCount);
  const toProcess = Number.isFinite(LIMIT) ? candidates.slice(0, LIMIT) : candidates;

  if (isDryRun) {
    console.log('─── DRY RUN — candidates ─────────────────────────────────');
    for (const p of toProcess) {
      console.log(`  @${p.username} — ${(p.followersCount/1000).toFixed(1)}k — ${p.businessCategoryName || '—'}`);
      if (p.biography) console.log(`    Bio: ${p.biography.replace(/\n/g, ' ').slice(0, 100)}`);
      if (p.businessEmail) console.log(`    IG email: ${p.businessEmail}`);
      console.log(`    URL: ${p.externalUrl || '—'}`);
    }
    console.log(`\n  ${toProcess.length} leads found. Remove --dry-run to insert.`);
    return;
  }

  // ── Stage 3: Enrich + insert ──────────────────────────────────────────────
  console.log('─── Stage 3: Enrich + insert ─────────────────────────────\n');
  let emailFound = 0, inserted = 0, failed = 0;

  for (const p of toProcess) {
    const name = (p.fullName || p.username).slice(0, 60);
    console.log(`\n  ${name} (@${p.username}) — ${(p.followersCount/1000).toFixed(1)}k`);
    if (p.biography) console.log(`  Bio: ${p.biography.replace(/\n/g, ' ').slice(0, 100)}`);

    // Priority 1: IG business_email (set explicitly by the business in their profile)
    let contact = null;
    if (p.businessEmail && !isGarbageEmail(p.businessEmail)) {
      contact = { email: p.businessEmail, name: null, title: 'IG profile email' };
      console.log(`  IG email: ${p.businessEmail}`);
    }

    const domain = await resolveDomain(p);
    console.log(`  Domain: ${domain || '—'} | Cat: ${p.businessCategoryName || '—'}`);

    if (!contact && domain) {
      process.stdout.write('  Hunter... ');
      contact = await hunterDomain(domain);
      if (contact) {
        console.log(`${contact.email}${contact.name ? ` (${contact.name})` : ''}`);
      } else {
        process.stdout.write('not found → scrape... ');
        const email = await findEmailOnWebsite(domain);
        if (email && !isGarbageEmail(email)) {
          contact = { email, name: null, title: null };
          console.log(email);
        } else {
          console.log('not found → Firecrawl');
        }
      }
    }

    let websiteSummary = null;
    if (domain) {
      process.stdout.write('  Firecrawl... ');
      const fc = await firecrawlWebsite(domain);
      if (!contact && fc.email && !isGarbageEmail(fc.email)) {
        contact = { email: fc.email, name: null, title: null };
        console.log(`email: ${fc.email}${fc.summary ? ', summary: ok' : ''}`);
      } else {
        console.log(fc.summary ? 'summary: ok' : 'no result');
      }
      websiteSummary = fc.summary || null;
    }

    if (contact?.email && existingEmails.has(contact.email.toLowerCase())) {
      console.log('  ⟳ skip — email already in DB'); failed++; continue;
    }
    if (contact?.email) emailFound++;

    const followers = p.followersCount;
    const niche = mapNiche(p.biography || '', p.businessCategoryName || '');

    const intake_data = {
      active_ads_count: 0, ad_copies: [], source: 'ig_native_search',
      scraped_at: new Date().toISOString(),
      enrichment: {
        instagram_profile: {
          username: p.username, followers, bio: p.biography || null,
          business_category: p.businessCategoryName || null,
          external_url: p.externalUrl || null, posts_count: p.postsCount || 0,
        },
        ...(websiteSummary ? { website_summary: websiteSummary } : {}),
        ...(contact ? { contact: { email: contact.email, name: contact.name, title: contact.title } } : {}),
      },
    };

    const record = {
      company_name:        name,
      name,
      website:             domain ? `https://${domain}` : null,
      email:               contact?.email || null,
      instagram_handle:    p.username,
      instagram_followers: followers,
      niche,
      service:             'social_media_system',
      status:              contact?.email ? 'enriched' : 'enriched_no_email',
      izvor:               'ig_native_search',
      kategorija:          followers >= 50000 ? 'Vreo' : followers >= 15000 ? 'Topao' : 'Hladan',
      intake_data,
      client_id:           SMARTFLOW_ID,
      sledeca_akcija:      contact?.email ? 'Generisati email draft i poslati' : 'Pronaći kontakt email',
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(record),
    });

    if (res.ok || res.status === 201) {
      console.log(`  ✓ Inserted [${record.status}]`);
      inserted++;
      existingHandles.add(p.username.toLowerCase());
      if (contact?.email) existingEmails.add(contact.email.toLowerCase());
    } else {
      const err = await res.text();
      if (res.status === 409 || err.includes('duplicate')) {
        console.log('  ⟳ Already exists');
      } else {
        console.error(`  ✗ ${err.slice(0, 100)}`); failed++;
      }
    }

    await sleep(400);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Queries run      : ${SEARCH_QUERIES.length}`);
  console.log(`  Handles verified : ${uniqueHandles.length}`);
  console.log(`  Qualified        : ${candidates.length}`);
  console.log(`  Inserted         : ${inserted}`);
  console.log(`  With email       : ${emailFound}`);
  console.log(`  Skipped/failed   : ${failed}`);
  if (inserted > 0) {
    console.log('\n  Next:');
    console.log('    node enrich_missing.mjs');
    console.log('    node generate_drafts.mjs --mode initial');
    console.log('    node send_outreach.mjs --dry-run');
  }
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => console.error('Fatal:', err.message));
