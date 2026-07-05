/**
 * SmartFlow Lead Sourcer — ScrapeCreators Instagram Bio/Caption Search
 *
 * Why this exists: the FB Ads Library channel (source_leads.mjs) sorts by impressions_desc,
 * so repeated runs on the same query terms converge on the same top-spending advertisers —
 * a hard ceiling, not just a "stale words" problem. This channel searches Instagram's own
 * bio/caption text (via ScrapeCreators, wrapping Google-indexed IG content), which is a
 * completely different, much larger pool: any Serbian business with an Instagram presence,
 * not just accounts currently paying Facebook for ads.
 *
 * Advantages over source_ig_search.mjs (the Apify caption-search channel):
 *   - No IG_SESSION_ID (Instagram session cookie) dependency — that cookie expires and
 *     needs manual refresh. This uses a plain API key.
 *   - follower_count, is_business_account, and category_name come back in the SAME search
 *     call — no separate profile-verification pass needed for most candidates.
 *   - ~$0.002/request (1 credit) — cheap enough to run the whole term list every time
 *     instead of rationing terms across runs like the FB Ads channel has to.
 *
 * Pipeline:
 *   Stage 1: Search Instagram bio/caption text across a rotating list of Serbian service
 *            business phrases (ScrapeCreators /v1/instagram/search/profiles)
 *   Stage 2: Filter (business account, follower range, Serbian market, category/name exclusions, dedup)
 *   Stage 3: Email enrichment (bio email → Hunter.io → website scrape)
 *   Stage 4: DB upsert (pipeline_stage='novi')
 *
 * Usage:
 *   node source_ig_bio_search.mjs --dry-run   — show found leads, no DB insert, no email enrichment cost
 *   node source_ig_bio_search.mjs             — live run, enrich + insert
 *   node source_ig_bio_search.mjs --limit 15  — cap DB inserts
 *   node source_ig_bio_search.mjs --pages 2   — fetch 2 cursor pages per term instead of 1 (2x cost)
 *
 * NOTE: requires SC_API_KEY / SCRAPECREATORS_KEY to have a paid credit balance.
 * As of 2026-07-05 the shared key was out of credits (confirmed via a live 402) — this
 * script has been written against the documented API but not yet run end-to-end live.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
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

const SC_API_KEY    = process.env.SC_API_KEY || process.env.SCRAPECREATORS_KEY;
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HUNTER_KEY    = process.env.HUNTER_API_KEY;
const SMARTFLOW_ID  = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

const isDryRun  = process.argv.includes('--dry-run');
const limitIdx  = process.argv.indexOf('--limit');
const pagesIdx  = process.argv.indexOf('--pages');
let   LIMIT     = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : Infinity;
const PAGES_PER_TERM = pagesIdx !== -1 ? parseInt(process.argv[pagesIdx + 1]) : 1;
const termsIdx  = process.argv.indexOf('--terms');
const TERMS_CAP = termsIdx !== -1 ? parseInt(process.argv[termsIdx + 1]) : Infinity; // cap on # of terms used, for controlled/cheap test runs

let MIN_FOLLOWERS = 30000;      // default; overridden by machine_config.source_follower_floor
const MAX_FOLLOWERS = 200000;

// ── Search terms ──────────────────────────────────────────────────────────────
// Deliberately NOT niche/vertical words (no "salon", "klinika", "servis" etc). The real
// qualifying signal per the ICP definition (wiki/status.md, 2026-05-21) is "does this
// business get consumer inquiries via DM that could be automated" — that's true across
// every industry, so the search terms stay broad and industry-agnostic on purpose.
// Business-account + follower-range + Serbian filters (Stage 2) do the real narrowing;
// these words are just a way to surface accounts that talk to customers via DM at all.
// Cheap enough (1 credit/term) to run the full list every time — no rationing needed.
const TERMS = [
  'pošaljite nam poruku', 'javite se u poruku', 'kontaktirajte nas za više informacija',
  'pišite nam za sve informacije', 'DM za cene', 'cena u inbox', 'sve informacije u inbox',
  'pošaljite upit', 'za porudžbine pišite nam', 'stanje na upit', 'dostupno na upit',
  'pitajte u komentarima', 'za rezervaciju pišite', 'pošaljite poruku za detalje',
  'poručite putem poruke', 'DM za porudžbinu', 'cena i dostupnost u inbox',
  'besplatna konsultacija', 'zakažite besplatnu procenu', 'pišite nam za rezervaciju',
  'javite se za više detalja', 'pošaljite poruku za rezervaciju', 'za sve upite pišite',
];

// ── Exclusion categories (business-category signals from ScrapeCreators' category_name) ──
// Same principle as source_leads.mjs: exclude D2C retail, media, and personal brands —
// no DM-inquiry use case for a service-automation offer.
const EXCLUDE_CATS = new Set([
  'Clothing (Brand)', 'Boutique store', 'Fashion designer', 'Clothing store',
  "Women's Clothing", "Men's Clothing", 'Cosmetics store', 'Jewelry/watches',
  'Personal blog', 'Public figure', 'Artist', 'Musician/band', 'Media/news company',
  'Shopping & retail', 'Coach', // "Coach" catches personal-brand life-coaches, not clinics
  'Writer', 'Author', 'Entrepreneur', // personal-brand/mentor accounts, not SMBs (2026-07-06 live test)
  'Digital creator', 'Content creator', 'Blogger', 'Comedian', 'Entertainer', 'Actor/director',
  'Community Organization', 'Community', 'Local business', 'City', 'Region',
  'News & media website', 'Government organization', 'Government official', // both org AND person
  'Broadcasting & media production company', 'Political party', 'Non-profit organization',
  'Nonprofit organization', 'Magazine', 'Newspaper', 'Radio station', 'Podcast',
  'Restaurant', 'Cafe', 'Bar', 'Fast food restaurant', 'Pizza place', 'Bakery',
].map(s => s.toLowerCase()));

const EXCLUDE_NAME_KEYWORDS = /\b(majice|majic|cipelice|cipela|cipele|obuća|obuca|kiflice|kiflic|torte|haljine|suknje|bluze|jakne|kaputi|šminke|sminke|nakit|parfem|parfemi|podkast|podcast|fondacija|fondacij|humanitar|zaklada|blog|kanal|kreator|otkriva|otkrivamo|dobrotvorn|volonter|donacij|kladionic|kladion|kazino|casino|betting|lutrij|shein|aliexpress|garderob|butik|kolekcij|fashion|torb[aei]|nakita|narukvic|piercing|pirsing)\b/i;

// ── Serbian market check — STRICT, Serbia-only (not BA/HR/SI — user directive 2026-07-05) ──
// Diacritics alone (š/č/ž/đ/ć) are NOT sufficient: Slovenian/Croatian/Bosnian use the same
// letters. A live test (2026-07-06) let "dm drogerie markt Slovenija" through on diacritics
// alone — real Slovenian-language bio ("Tvoja najljubša drogerija... kozmetiko"), wrong
// country entirely. Require a .rs domain OR explicit Serbia-specific vocabulary instead.
function isSerbianProfile(profile) {
  const bio = profile.biography || '';
  const extDomain = (() => {
    try { return new URL(profile.external_url).hostname.replace(/^www\./, ''); } catch { return ''; }
  })();
  if (extDomain.endsWith('.rs')) return true;
  if (/srbija|serbia|beograd|belgrade|novi sad|niš|kragujevac|subotica|čačak|valjevo|užice|smederevo/i.test(bio)) return true;
  return false;
}

// ── Website classification (reject aggregators / bad hosts as a "domain") ────
const AGGREGATOR_HOSTS = new Set([
  'linktr.ee','linktree.ee','bio.site','taplink.cc','beacons.ai','zaap.bio',
  'allmylinks.com','campsite.bio','lit.link','solo.to','milkshake.app','singlelink.co',
]);
const BAD_WEBSITE_HOSTS = new Set([
  'instagram.com','facebook.com','wa.me','t.me','tiktok.com','youtube.com','youtu.be',
  'maps.google.com','calendly.com','booksy.com','fresha.com','treatwell.com',
  // Generic course/community/funnel platforms — a personal-brand account's "website" is often
  // one of these, not their own domain. Hunter/domain-search on these returns some unrelated
  // employee's email at the platform company itself (caught live 2026-07-06: a juice business's
  // bio linked to a skool.com community, Hunter returned a Skool employee's email, not hers).
  'skool.com','subscribepage.io','teachable.com','kajabi.com','systeme.io',
  // Huge multinational/media domains — even when a real business account, Hunter/domain-search
  // returns a random employee at these, never a relevant contact for a Serbian SMB outreach.
  'bbc.com','bbc.co.uk',
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

function domainOf(url) {
  try { return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, ''); } catch { return null; }
}

// ── Niche mapping (same buckets as source_leads.mjs) ──────────────────────────
function mapNiche(name = '', bio = '', category = '') {
  const t = [name, bio, category].join(' ').toLowerCase();
  if (/kozmet|spa|wellness|estet|stomatol|fizioter|klinika|ordinacija|bolnica|dermatol|beauty/.test(t)) return 'klinika_wellness';
  if (/fitness|gym|sport|trening|fitnes|yoga|pilates/.test(t)) return 'fitnes';
  if (/restoran|kafana|catering|picerija|ugostitelj|hotel|vila/.test(t)) return 'ugostiteljstvo';
  if (/nekretnin|real estate|stan |stanova/.test(t)) return 'nekretnine';
  if (/kurs|obuka|akademija|edukacij|škola|skola|coaching|mentor/.test(t)) return 'edukacija';
  if (/fashion|moda|odeć|odeca|butik|clothing|garderob/.test(t)) return 'fashion';
  return 'other';
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

const GARBAGE_EMAIL = /^(posao|hr|kadrovi|jobs|career|zaposlenje|rekrutacij|knjigovodstvo|racunovodstvo|pravna|administracij)@/i;
const SKIP_EMAIL = /noreply|no-reply|example|johndoe|test@|sentry|wix|schema|privacy|jquery/i;

async function findEmailOnWebsite(domain) {
  const urls = [`https://${domain}/kontakt`, `https://${domain}/contact`, `https://${domain}/o-nama`, `https://${domain}`];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000), redirect: 'follow',
      });
      if (!res.ok) continue;
      const html = await res.text();
      const m = html.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (m && !SKIP_EMAIL.test(m[1]) && !GARBAGE_EMAIL.test(m[1])) return m[1];
    } catch {}
  }
  return null;
}

// ── ScrapeCreators search ──────────────────────────────────────────────────────
async function searchProfiles(query, cursor) {
  const url = new URL('https://api.scrapecreators.com/v1/instagram/search/profiles');
  url.searchParams.set('query', query);
  if (cursor) url.searchParams.set('cursor', cursor);
  const res = await fetch(url, { headers: { 'x-api-key': SC_API_KEY } });
  const json = await res.json();
  if (!json.success) throw new Error(json.message || `HTTP ${res.status}`);
  return json;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!SC_API_KEY) { console.error('✗ SC_API_KEY / SCRAPECREATORS_KEY not set'); process.exit(1); }

  // Cockpit "Novi leadovi" settings gate this channel too — one pause switch,
  // one follower floor, shared with source_leads.mjs.
  try {
    const cfgRes = await fetch(`${SUPABASE_URL}/rest/v1/machine_config?client_id=eq.${SMARTFLOW_ID}&select=*`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const cfg = (await cfgRes.json())[0];
    if (cfg) {
      if (cfg.source_enabled === false) { console.log('⏸  Sourcing is paused (cockpit → Novi leadovi → settings).'); return; }
      if (Number.isFinite(cfg.source_follower_floor)) MIN_FOLLOWERS = cfg.source_follower_floor;
      if (LIMIT === Infinity && Number.isFinite(cfg.source_daily_limit)) LIMIT = cfg.source_daily_limit;
    }
  } catch (e) { console.warn('⚠ Could not read machine_config, using defaults:', e.message); }

  console.log('═══════════════════════════════════════════════════════');
  console.log('  SmartFlow Lead Sourcer — ScrapeCreators IG Bio Search');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN (no DB writes)' : 'LIVE'} | Terms available: ${TERMS.length} (cap: ${Number.isFinite(TERMS_CAP) ? TERMS_CAP : 'none'}) × ${PAGES_PER_TERM} page(s) | Max inserts: ${LIMIT}`);
  console.log(`  Filter: ${MIN_FOLLOWERS / 1000}k–${MAX_FOLLOWERS / 1000}k followers · business account · Serbian market`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Existing DB for dedup
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?select=instagram_handle,email,status&client_id=eq.${SMARTFLOW_ID}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const existingAll = await existingRes.json() || [];
  const existingHandles = new Set(existingAll.map(r => r.instagram_handle?.toLowerCase()).filter(Boolean));
  const contactedEmails = new Set(existingAll.filter(r => ['Kontaktiran','Disqualified','Follow Up','Odgovorio','Zakazan Sastanak'].includes(r.status)).map(r => r.email?.toLowerCase()).filter(Boolean));
  console.log(`Existing in DB: ${existingHandles.size} handles | ${contactedEmails.size} contacted emails\n`);

  // ── Stage 1: search across all terms ──────────────────────────────────────
  console.log('─── Stage 1: Instagram bio/caption search ──────────────');
  const byHandle = new Map();
  const termsToRun = Number.isFinite(TERMS_CAP) ? TERMS.slice(0, TERMS_CAP) : TERMS;
  console.log(`  Using ${termsToRun.length}/${TERMS.length} terms${Number.isFinite(TERMS_CAP) ? ' (--terms cap)' : ''} — est. cost: ${termsToRun.length * PAGES_PER_TERM} credits\n`);
  for (const term of termsToRun) {
    let cursor = null;
    for (let page = 0; page < PAGES_PER_TERM; page++) {
      try {
        const result = await searchProfiles(term, cursor);
        const profiles = result.profiles || [];
        process.stdout.write(`  "${term}"${page > 0 ? ` p${page + 1}` : ''}: ${profiles.length} results\n`);
        for (const p of profiles) {
          if (p.username && !byHandle.has(p.username.toLowerCase())) byHandle.set(p.username.toLowerCase(), p);
        }
        cursor = result.cursor;
        if (!cursor) break;
      } catch (e) {
        console.warn(`  ⚠ "${term}" failed: ${e.message}`);
        break;
      }
      await sleep(200);
    }
  }
  console.log(`\n  Unique profiles found: ${byHandle.size}\n`);

  // ── Stage 2: filter ────────────────────────────────────────────────────────
  console.log('─── Stage 2: Filter ─────────────────────────────────────');
  const dbg = { dup: 0, notBusiness: 0, followers: 0, category: 0, name: 0, notSerbian: 0, passed: 0 };
  const qualified = [];
  for (const [handle, p] of byHandle) {
    if (existingHandles.has(handle))                              { dbg.dup++;         continue; }
    if (!p.is_business_account && !p.is_professional_account)     { dbg.notBusiness++; continue; }
    const followers = p.follower_count || 0;
    if (followers < MIN_FOLLOWERS || followers > MAX_FOLLOWERS)    { dbg.followers++;   continue; }
    if (EXCLUDE_CATS.has((p.category_name || '').toLowerCase()))   { dbg.category++;    continue; }
    if (EXCLUDE_NAME_KEYWORDS.test(p.full_name) || EXCLUDE_NAME_KEYWORDS.test(p.biography)) { dbg.name++; continue; }
    if (!isSerbianProfile(p))                                      { dbg.notSerbian++;  continue; }
    dbg.passed++;
    qualified.push(p);
  }
  qualified.sort((a, b) => (b.follower_count || 0) - (a.follower_count || 0));
  console.log(`  Already in DB    : ${dbg.dup}`);
  console.log(`  Not business acct: ${dbg.notBusiness}`);
  console.log(`  Follower range   : ${dbg.followers}`);
  console.log(`  Excluded category: ${dbg.category}`);
  console.log(`  Excluded name    : ${dbg.name}`);
  console.log(`  Not Serbian      : ${dbg.notSerbian}`);
  console.log(`  Qualified        : ${dbg.passed}\n`);

  if (!qualified.length) { console.log('No qualified leads found.'); return; }

  const toProcess = Number.isFinite(LIMIT) ? qualified.slice(0, LIMIT) : qualified;

  if (isDryRun) {
    console.log('═══════════════════════════════════════════════════════');
    console.log(`  [DRY RUN] Leads that would be enriched + inserted (${toProcess.length}):`);
    toProcess.forEach((p, i) => {
      console.log(`  ${String(i + 1).padStart(2)}. ${(p.full_name || p.username).slice(0, 40).padEnd(40)} @${p.username.padEnd(25)} ${(p.follower_count / 1000).toFixed(1)}k  ${p.category_name || '—'}`);
    });
    return;
  }

  // ── Stage 3: email enrichment ──────────────────────────────────────────────
  console.log(`─── Stage 3: Email enrichment (${toProcess.length} leads) ───────`);
  let emailFound = 0;
  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i];
    console.log(`[${i + 1}/${toProcess.length}] ${p.full_name || p.username} (@${p.username}) ${(p.follower_count / 1000).toFixed(1)}k followers`);
    let contact = null;

    const bio = p.biography || '';
    const bioEmail = bio.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0];
    if (bioEmail && !GARBAGE_EMAIL.test(bioEmail) && !bioEmail.includes('example')) {
      contact = { email: bioEmail.toLowerCase(), name: null, title: null };
      console.log(`  ✓ Email from IG bio: ${bioEmail}`);
    }

    let domain = classifyWebsite(p.external_url) === 'real' ? domainOf(p.external_url) : null;
    if (!contact && domain) {
      process.stdout.write(`  Hunter (${domain})... `);
      const hunterContact = await hunterDomain(domain);
      contact = (hunterContact && !GARBAGE_EMAIL.test(hunterContact.email)) ? hunterContact : null;
      if (contact) {
        console.log(`${contact.email}${contact.name ? ` (${contact.name})` : ''}`);
      } else {
        process.stdout.write('not found → website scrape... ');
        const email = await findEmailOnWebsite(domain);
        console.log(email || 'not found');
        if (email) contact = { email, name: null, title: null };
      }
    } else if (!contact && !domain) {
      console.log('  No website — skipping email enrichment');
    }

    if (contact?.email) emailFound++;
    p._contact = contact;
    p._domain = domain;
    await sleep(300);
  }
  console.log(`  Emails found: ${emailFound}/${toProcess.length}\n`);

  // ── Stage 4: DB upsert ──────────────────────────────────────────────────────
  console.log(`─── Stage 4: DB upsert (${toProcess.length} leads) ────`);
  let inserted = 0, skipped = 0;
  for (const p of toProcess) {
    const leadEmail = p._contact?.email?.toLowerCase();
    if (leadEmail && contactedEmails.has(leadEmail)) { console.log(`  ⟳ skip dup email: ${p.username}`); skipped++; continue; }

    const niche = mapNiche(p.full_name, p.biography, p.category_name);
    const record = {
      company_name       : p.full_name || p.username,
      name               : p.full_name || p.username,
      website            : p._domain ? `https://${p._domain}` : null,
      email              : p._contact?.email || null,
      instagram_handle   : p.username,
      instagram_followers: p.follower_count || 0,
      niche,
      service            : 'social_media_system',
      status             : p._contact?.email ? 'enriched' : 'No Draft',
      izvor              : 'ig_bio_search_scrapecreators',
      kategorija         : (p.follower_count || 0) >= 50000 ? 'Vreo' : (p.follower_count || 0) >= 15000 ? 'Topao' : 'Hladan',
      pipeline_stage     : 'novi',
      intake_data: {
        scraped_at   : new Date().toISOString(),
        scrape_method: 'scrapecreators_ig_bio_search',
        enrichment: {
          instagram_profile: {
            username: p.username, followers: p.follower_count, bio: p.biography || null,
            business_category: p.category_name || null, is_verified: p.is_verified || false,
            external_url: p.external_url || null,
          },
          ...(p._contact ? { contact: { email: p._contact.email, name: p._contact.name, title: p._contact.title, source: 'hunter' } } : {}),
        },
      },
      client_id      : SMARTFLOW_ID,
      sledeca_akcija : p._contact?.email ? 'Generisati email draft i poslati' : 'Pronaći kontakt email',
    };

    // No on_conflict here: (client_id, instagram_handle) has no UNIQUE CONSTRAINT in the DB
    // (8 pre-existing duplicate pairs from other channels block adding one without a cleanup
    // pass first — out of scope here). Stage 2's existingHandles filter already excludes any
    // handle already in the DB before we ever get this far, which is the real dedup guard.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
      body: JSON.stringify(record),
    });

    if (res.ok || res.status === 201) {
      console.log(`  ✓ ${record.company_name} [${record.status}] @${p.username}`);
      inserted++;
    } else {
      console.error(`  ✗ ${record.company_name}: ${(await res.text()).slice(0, 100)}`);
      skipped++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Inserted: ${inserted}  |  Skipped: ${skipped}`);
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
