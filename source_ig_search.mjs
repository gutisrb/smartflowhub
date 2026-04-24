/**
 * SmartFlow Lead Sourcer — Instagram User Search
 *
 * Searches Instagram for Serbian business accounts directly.
 * Returns follower counts in one call — no separate IG verification step needed.
 * Cost: $0.0023/result (apify/instagram-scraper)
 *
 * Usage:
 *   node source_ig_search.mjs --dry-run   — show found leads, no DB insert
 *   node source_ig_search.mjs             — find leads, enrich with email, insert to DB
 *   node source_ig_search.mjs --limit 10  — cap inserts
 */

import { readFileSync } from 'fs';
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

const TOKEN        = process.env.APIFY_TOKEN;
const ACTOR        = 'shu8hvrXbJbY3Eb9W'; // apify/instagram-scraper
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HUNTER_KEY   = process.env.HUNTER_API_KEY;
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

const isDryRun = process.argv.includes('--dry-run');
const limitIdx = process.argv.indexOf('--limit');
const LIMIT    = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : Infinity;

const MIN_FOLLOWERS = 20000;
const MAX_FOLLOWERS = 200000;

// City + service type — what actually works for IG user search
// Avoid pure CTAs (don't appear in usernames), avoid too-generic (no follower filter match)
const SEARCHES = [
  // Belgrade neighborhoods — untapped
  'zemun beograd',
  'novi beograd',
  'vozdovac beograd',
  'zvezdara beograd',
  'palilula beograd',
  'cukarica beograd',
  // Generic business-type words + beograd
  'beograd agencija',
  'beograd servis',
  'beograd hotel',
  'beograd hostel',
  'beograd market',
  'beograd club',
  'beograd lounge',
  'beograd booking',
  'beograd design',
  'beograd solutions',
  'beograd agency',
  'beograd doo',
  'beograd iskustvo',
  'beograd kvalitet',
  // More Novi Sad variety
  'novi sad agencija',
  'novi sad servis',
  'novi sad studio',
  'novi sad hotel',
  'novi sad club',
  // Bilingual combos
  'belgrade club',
  'belgrade agency',
  'belgrade hotel',
  'belgrade design',
  'serbia beograd',
];

// Domains that are link aggregators / booking platforms — not the business's own site
const LINK_AGGREGATORS = new Set([
  'linktr.ee', 'linktree.com', 'taplink.cc', 'beacons.ai', 'bio.link',
  'opentable.com', 'resy.com', 'booksy.com', 'calendly.com',
  'booking.com', 'tripadvisor.com', 'treatwell.com',
]);

// Domains that should never be used as a business email source
const BOGUS_EMAIL_DOMAINS = new Set([
  ...LINK_AGGREGATORS,
  'instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'youtube.com',
  'gmail.com', // only flag if we want to exclude; keep gmails as fallback
]);

// Placeholder/template email domains that website builders leave in
const PLACEHOLDER_EMAIL_DOMAINS = new Set([
  'yourbusiness.com', 'yourdomain.com', 'example.com', 'test.com',
  'domain.com', 'yoursite.com', 'yourcompany.com', 'website.com',
]);
function isPlaceholderEmail(email) {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return PLACEHOLDER_EMAIL_DOMAINS.has(domain);
}

const EXCLUDE_CATS = new Set([
  'Clothing (Brand)', 'Boutique store', 'Fashion designer', 'Clothing store',
  "Women's Clothing", "Men's Clothing", 'Cosmetics store',
  'Jewelry/watches', 'Personal blog', 'Public figure',
  'Artist', 'Musician/band', 'Media/news company', 'Shopping & retail',
  'Book series', 'Books', 'TV channel', 'Entertainment website',
  'Sports team', 'Interest',
  // News, media, government — keep slipping through with broad terms
  'News & media website', 'News personality', 'News/media website',
  'Government organization', 'Government website', 'Government official',
  'Political party', 'Politician', 'Non-profit organization', 'Nonprofit organization',
  'Magazine', 'Newspaper', 'Broadcasting & media production company',
  'Radio station', 'Podcast',
]);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── IG search: start all runs in parallel ─────────────────────────────────────

async function startRun(term) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${TOKEN}&maxItems=10`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchType: 'user', searchLimit: 10, search: term, resultsType: 'details' }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return { term, runId: data.data.id, datasetId: data.data.defaultDatasetId };
}

async function waitAndFetch({ term, runId, datasetId }) {
  let status = 'RUNNING';
  for (let i = 0; i < 60; i++) {
    await sleep(8000);
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${TOKEN}`);
    status = (await s.json()).data?.status;
    if (!['RUNNING', 'READY'].includes(status)) break;
  }
  const r = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${TOKEN}&limit=200`);
  return { term, items: await r.json() };
}

// ── Domain resolution ─────────────────────────────────────────────────────────

const SOCIAL_DOMAINS = new Set([
  'instagram.com', 'facebook.com', 'tiktok.com', 'twitter.com', 'x.com',
  'youtube.com', 'linkedin.com', 'snapchat.com', 'pinterest.com',
  ...LINK_AGGREGATORS,
]);

/** Extract a domain from raw bio text (e.g. "📧 info@salon.rs | 🌐 salon.rs") */
function extractDomainFromBio(bio) {
  if (!bio) return null;
  const URL_RX = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9\-]{1,61}[a-zA-Z0-9]\.[a-z]{2,10})(?:\/[^\s\n]*)?\b/g;
  let match;
  while ((match = URL_RX.exec(bio)) !== null) {
    const domain = match[1].toLowerCase();
    if (!SOCIAL_DOMAINS.has(domain) && !/\.(jpg|jpeg|png|gif|svg|webp)$/i.test(domain)) {
      return domain;
    }
  }
  return null;
}

/** Follow a link aggregator page (linktr.ee, taplink, etc.) to find the real business website */
async function resolveAggregatorUrl(aggregatorUrl) {
  try {
    const { stdout } = await execFileAsync('firecrawl', [
      'scrape', '--url', aggregatorUrl, '--format', 'markdown',
    ], { timeout: 12000 });
    if (!stdout?.trim()) return null;
    const URL_RX = /https?:\/\/(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9\-]{1,61}[a-zA-Z0-9]\.[a-z]{2,10})(?:\/[^\s)'"]*)?/g;
    let match;
    while ((match = URL_RX.exec(stdout)) !== null) {
      const domain = match[1].toLowerCase();
      if (!SOCIAL_DOMAINS.has(domain)) return domain;
    }
  } catch {}
  return null;
}

/** Resolve the best domain for a lead — checks externalUrl, bio, and follows aggregators */
async function resolveDomain(p) {
  const externalUrl = p.externalUrl || null;
  const rawDomain = externalUrl ? (() => { try { return new URL(externalUrl).hostname.replace(/^www\./, ''); } catch { return null; } })() : null;

  // 1. Clean external URL (not an aggregator)
  if (rawDomain && !LINK_AGGREGATORS.has(rawDomain) && !SOCIAL_DOMAINS.has(rawDomain)) return rawDomain;

  // 2. URL found in bio text
  const bioDomain = extractDomainFromBio(p.biography);
  if (bioDomain) return bioDomain;

  // 3. Follow link aggregator to find real website
  if (rawDomain && LINK_AGGREGATORS.has(rawDomain) && externalUrl) {
    process.stdout.write(`  Following ${rawDomain}... `);
    const resolved = await resolveAggregatorUrl(externalUrl);
    if (resolved) { console.log(`→ ${resolved}`); return resolved; }
    console.log('no real URL found');
  }

  return null;
}

// ── Email enrichment ──────────────────────────────────────────────────────────

async function hunterDomain(domain) {
  if (!HUNTER_KEY || !domain) return null;
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${HUNTER_KEY}`
    );
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
    // Reject if the email domain is a platform/aggregator (e.g. Hunter searching linktr.ee)
    const emailDomain = best.value.split('@')[1]?.toLowerCase();
    if (emailDomain && BOGUS_EMAIL_DOMAINS.has(emailDomain)) return null;
    return { email: best.value, name: [best.first_name, best.last_name].filter(Boolean).join(' ') || null, title: best.position || null };
  } catch { return null; }
}

async function findEmailOnWebsite(domain) {
  const urls = [`https://${domain}/kontakt`, `https://${domain}/contact`, `https://${domain}`];
  const SKIP = /noreply|no-reply|example|sentry|wix|schema|privacy|qodeinteractive|\.(png|jpg|svg|css|js)(@|$)/i;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const m = (await res.text()).match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (m && !SKIP.test(m[1])) return m[1];
    } catch {}
  }
  return null;
}

/** Firecrawl a domain ONCE — returns { email, summary } */
async function firecrawlWebsite(domain) {
  const result = { email: null, summary: null };
  if (!domain) return result;
  const SKIP_EMAIL = /noreply|no-reply|example|sentry|wix|schema|privacy|qodeinteractive|\.(png|jpg|svg|css|js)(@|$)/i;
  for (const path of ['/kontakt', '/contact', '/o-nama', '']) {
    try {
      const { stdout } = await execFileAsync('firecrawl', [
        'scrape', '--url', `https://${domain}${path}`, '--format', 'markdown',
      ], { timeout: 15000 });
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

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SmartFlow Lead Sourcer — Instagram User Search');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'} | Searches: ${SEARCHES.length} | ~$${(SEARCHES.length * 10 * 0.0023).toFixed(2)}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load existing handles + emails for dedup
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${SMARTFLOW_ID}&select=instagram_handle,email`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const existingAll = await existingRes.json();
  const existingHandles = new Set(existingAll.map(r => r.instagram_handle?.toLowerCase()).filter(Boolean));
  const existingEmails  = new Set(existingAll.map(r => r.email?.toLowerCase()).filter(Boolean));
  console.log(`Existing in DB: ${existingHandles.size} handles | ${existingEmails.size} emails\n`);

  // ── Start runs in batches of 4 (free plan: 8192MB / 1024MB per run = 8 max) ──
  // Wait for each batch to finish before starting next to stay under memory limit
  console.log('─── Launching searches (batches of 4) ───────────────────\n');
  const BATCH = 4;
  const results = [];
  for (let i = 0; i < SEARCHES.length; i += BATCH) {
    const batch = SEARCHES.slice(i, i + BATCH);
    const started = await Promise.allSettled(batch.map(term => startRun(term)));
    const activeRuns = [];
    for (let j = 0; j < started.length; j++) {
      if (started[j].status === 'fulfilled') {
        activeRuns.push(started[j].value);
        process.stdout.write(`  ✓ Started "${batch[j]}"\n`);
      } else {
        console.log(`  ✗ Failed to start "${batch[j]}": ${started[j].reason?.message?.slice(0, 80)}`);
      }
    }
    // Wait for this batch to complete before starting next
    const batchResults = await Promise.allSettled(activeRuns.map(run => waitAndFetch(run)));
    results.push(...batchResults);
    if (i + BATCH < SEARCHES.length) await sleep(500);
  }
  console.log(`\n  All batches done.\n`);

  const seen = new Set();
  const candidates = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { term, items } = result.value;
    if (!Array.isArray(items)) continue;
    let newFound = 0;
    for (const p of items) {
      if (!p.username || seen.has(p.username.toLowerCase())) continue;
      seen.add(p.username.toLowerCase());
      const f = p.followersCount || 0;
      if (!p.isBusinessAccount) continue;
      if (f < MIN_FOLLOWERS || f > MAX_FOLLOWERS) continue;
      if (p.private) continue;
      const cats = (p.businessCategoryName || '').split(',').map(c => c.trim()).filter(Boolean);
      if (cats.some(c => EXCLUDE_CATS.has(c))) continue;
      if (existingHandles.has(p.username.toLowerCase())) continue;
      candidates.push(p);
      newFound++;
    }
    console.log(`  "${term}" → ${newFound} new qualified`);
  }

  candidates.sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0));
  const toProcess = Number.isFinite(LIMIT) ? candidates.slice(0, LIMIT) : candidates;

  console.log(`\n  Found ${candidates.length} unique qualified leads (processing ${toProcess.length})\n`);
  if (!toProcess.length) { console.log('No new leads found.'); return; }

  // ── Enrich with email ─────────────────────────────────────────────────────
  if (!isDryRun) console.log('─── Email enrichment ────────────────────────────────────\n');

  let emailFound = 0, inserted = 0, failed = 0;

  for (const p of toProcess) {
    const f = ((p.followersCount || 0) / 1000).toFixed(1);
    const name = (p.fullName || p.username).slice(0, 40);

    console.log(`\n  ${name} (@${p.username}) — ${f}k followers`);
    if (p.biography) console.log(`  Bio: ${p.biography.replace(/\n/g, ' ').slice(0, 100)}`);

    if (isDryRun) {
      console.log(`  ExternalUrl: ${p.externalUrl || '—'} | Cat: ${p.businessCategoryName || '—'}`);
      continue;
    }

    // Resolve best domain: externalUrl → bio URL → follow aggregator
    const domain = await resolveDomain(p);
    console.log(`  Domain: ${domain || '—'} | Cat: ${p.businessCategoryName || '—'}`);

    // No domain at all — Instagram only
    if (!domain) {
      const niche = mapNiche(p.biography || '', p.businessCategoryName || '');
      const followers = p.followersCount || 0;
      const intake_data = {
        active_ads_count: 0, ad_copies: [], source: 'ig_user_search',
        scraped_at: new Date().toISOString(),
        enrichment: { instagram_profile: {
          username: p.username, followers, bio: p.biography || null,
          business_category: p.businessCategoryName || null,
          is_verified: p.verified || false, posts_count: p.postsCount || 0,
        }},
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
        body: JSON.stringify({
          company_name: name, name, email: null, instagram_handle: p.username,
          instagram_followers: followers, niche, service: 'social_media_system',
          status: 'Instagram only', izvor: 'ig_user_search',
          kategorija: followers >= 50000 ? 'Vreo' : followers >= 15000 ? 'Topao' : 'Hladan',
          intake_data, client_id: SMARTFLOW_ID,
          sledeca_akcija: 'Kontaktirati direktno na Instagramu',
        }),
      });
      if (res.ok || res.status === 201) { console.log(`  ✓ Inserted [Instagram only]`); inserted++; }
      existingHandles.add(p.username.toLowerCase());
      await sleep(300);
      continue;
    }

    // Enrich: Hunter first (fast), then raw scrape, then Firecrawl ONCE for both email + summary
    let contact = null;

    process.stdout.write(`  Hunter... `);
    contact = await hunterDomain(domain);
    if (contact) {
      console.log(`${contact.email}${contact.name ? ` (${contact.name})` : ''}`);
    } else {
      process.stdout.write(`not found → website... `);
      const email = await findEmailOnWebsite(domain);
      if (email) {
        contact = { email, name: null, title: null };
        console.log(email);
      } else {
        console.log(`not found → Firecrawl`);
      }
    }

    // Firecrawl once: always for summary, also for email if still missing
    process.stdout.write(`  Firecrawl... `);
    const fc = await firecrawlWebsite(domain);
    if (!contact && fc.email) {
      contact = { email: fc.email, name: null, title: null };
      console.log(`email: ${fc.email}${fc.summary ? ', summary: ok' : ''}`);
    } else {
      console.log(fc.summary ? 'summary: ok' : 'no summary');
    }
    const websiteSummary = fc.summary || null;

    if (contact?.email && isPlaceholderEmail(contact.email)) {
      console.log(`  ⚠  placeholder email (${contact.email}) — clearing`);
      contact = null;
    }

    if (contact?.email && existingEmails.has(contact.email.toLowerCase())) {
      console.log(`  ⟳ skip — email already in DB`);
      failed++;
      continue;
    }

    if (contact?.email) emailFound++;

    const niche = mapNiche(p.biography || '', p.businessCategoryName || '');
    const followers = p.followersCount || 0;

    const intake_data = {
      active_ads_count: 0, ad_copies: [], source: 'ig_user_search',
      scraped_at: new Date().toISOString(),
      enrichment: {
        instagram_profile: {
          username: p.username, followers, bio: p.biography || null,
          business_category: p.businessCategoryName || null,
          is_verified: p.verified || false,
          external_url: p.externalUrl || null,
          posts_count: p.postsCount || 0,
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
      izvor:               'ig_user_search',
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
        console.log(`  ⟳ Already exists`);
      } else {
        console.error(`  ✗ ${err.slice(0, 100)}`);
        failed++;
      }
    }

    await sleep(400);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  if (isDryRun) {
    console.log(`  DRY RUN — ${toProcess.length} leads found, no DB writes`);
  } else {
    console.log(`  Inserted : ${inserted}`);
    console.log(`  With email: ${emailFound}`);
    console.log(`  Failed   : ${failed}`);
    console.log('\n  Next: node generate_drafts.mjs --mode initial');
  }
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => console.error('Fatal:', err.message));
