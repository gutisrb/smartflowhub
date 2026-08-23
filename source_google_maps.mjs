/**
 * source_google_maps.mjs — geo + category lead sourcing via Google Maps.
 *
 * WHY THIS CHANNEL EXISTS
 * The Facebook Ads Library only ever finds a business if it happens to be running
 * ads the week we look. That biases the whole funnel toward whoever is advertising
 * right now, and it silently misses the highest-AOV verticals we actually want —
 * pergola installers, kitchen studios, dental clinics — most of which are busy,
 * profitable, and advertise in bursts or not at all.
 *
 * Google Maps has the opposite shape: it is a near-complete census of physical
 * Serbian businesses by category and city, with a website and phone attached. So
 * this script enumerates the high-ticket verticals directly rather than waiting
 * for them to show up in an ad scrape.
 *
 * The two gates from lib/lead-score.mjs still apply downstream:
 *   AOV — is their ticket big enough for a monthly retainer at all?
 *   MIS — are they already paying to generate the messages we would answer?
 * Maps gives us neither, so leads land as `No Draft` for enrichment rather than
 * going straight to a demo build. Maps finds the business; enrichment decides
 * whether it is worth anything.
 *
 * COST
 * Apify compsy/google-maps-scraper is pay-per-result. Every run is capped by
 * --max (default 60) and prints its own bill before spending anything; --dry-run
 * costs zero and just prints the query plan.
 *
 * Usage:
 *   node source_google_maps.mjs --dry-run              — query plan + cost, no API calls
 *   node source_google_maps.mjs --yes                  — live run, default caps
 *   node source_google_maps.mjs --yes --max 30         — cap results
 *   node source_google_maps.mjs --yes --vertical pergole --city Beograd
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { isPermabanned } from './lib/permaban.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APIFY_TOKEN  = process.env.APIFY_TOKEN;
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const MAPS_ACTOR   = 'nwua9Gu5YrADL7ZDj'; // compsy/google-maps-scraper

const argv      = process.argv;
const isDryRun  = argv.includes('--dry-run');
const isYes     = argv.includes('--yes');
const argOf     = (f, d = null) => { const i = argv.indexOf(f); return i !== -1 ? argv[i + 1] : d; };
const MAX       = Number(argOf('--max', 60));
const ONLY_VERT = argOf('--vertical');
const ONLY_CITY = argOf('--city');

// ── The target list ──────────────────────────────────────────────────────────
// Chosen by average order value, not by category glamour. Each vertical here has
// a median ticket comfortably over the 15.000 RSD gate, and a purchase considered
// enough that customers ask questions before buying — which is the DM volume we
// are selling the answer to.
const VERTICALS = [
  { key: 'pergole',      queries: ['bioklimatske pergole', 'pergole i nadstrešnice'], aov: '70.000–150.000' },
  { key: 'stolarija',    queries: ['PVC stolarija', 'aluminijumska stolarija'],       aov: '30.000–70.000'  },
  { key: 'kuhinje',      queries: ['kuhinje po meri', 'nameštaj po meri'],            aov: '50.000–200.000' },
  { key: 'namestaj',     queries: ['salon nameštaja'],                                 aov: '25.000–100.000' },
  { key: 'stomatologija',queries: ['stomatološka ordinacija', 'zubni implanti'],      aov: '25.000–90.000'  },
  { key: 'estetika',     queries: ['klinika estetske hirurgije', 'transplantacija kose'], aov: '80.000–300.000' },
  { key: 'solarni',      queries: ['solarni paneli', 'toplotne pumpe'],               aov: '200.000+'       },
  { key: 'bazeni',       queries: ['bazeni i saune'],                                  aov: '150.000+'       },
  { key: 'vencanja',     queries: ['sala za venčanja', 'restoran za svadbe'],          aov: '100.000+'       },
];

const CITIES = ['Beograd', 'Novi Sad', 'Niš', 'Kragujevac', 'Subotica'];

// Never waste a paid result on a chain, a marketplace or a directory.
const EXCLUDE_NAME = /\b(temu|shein|aliexpress|emmezeta|jysk|forma ideale|merkur|metro|lidl|maxi|idea|univerexport|olx|kupujem ?prodajem|halo ?oglasi|4zida|nekretnine\.rs)\b/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function cleanDomain(url) {
  if (!url) return null;
  try {
    const h = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    if (/facebook|instagram|google|maps\.app|linktr\.ee|wa\.me|booking\.com/.test(h)) return null;
    return h;
  } catch { return null; }
}

/** Serbian-market check: a .rs domain, or a Serbian city in the address. */
function isSerbian(item) {
  const dom = cleanDomain(item.website) || '';
  if (/\.rs$/.test(dom)) return true;
  const addr = `${item.address || ''} ${item.city || ''}`;
  return /srbij|beograd|novi sad|niš|nis|kragujevac|subotica|zrenjanin|pančevo|čačak|kraljevo|leskovac/i.test(addr);
}

function buildPlan() {
  const plan = [];
  for (const v of VERTICALS) {
    if (ONLY_VERT && v.key !== ONLY_VERT) continue;
    for (const city of CITIES) {
      if (ONLY_CITY && city !== ONLY_CITY) continue;
      for (const q of v.queries) plan.push({ vertical: v.key, aov: v.aov, city, query: `${q} ${city}` });
    }
  }
  return plan;
}

async function runActor(searchTerms, maxResults) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${MAPS_ACTOR}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: searchTerms,
        maxCrawledPlacesPerSearch: Math.ceil(maxResults / searchTerms.length),
        language: 'sr',
        countryCode: 'rs',
        skipClosedPlaces: true,
        scrapeContacts: true,
      }),
    },
  );
  const run = await res.json();
  const runId = run?.data?.id;
  if (!runId) throw new Error(`actor start failed: ${JSON.stringify(run).slice(0, 300)}`);

  process.stdout.write('  running');
  for (let i = 0; i < 90; i++) {
    await sleep(5000);
    const s = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)).json();
    const st = s?.data?.status;
    process.stdout.write('.');
    if (st === 'SUCCEEDED') {
      const items = await (await fetch(
        `https://api.apify.com/v2/datasets/${s.data.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=500`
      )).json();
      console.log(` done (${items.length} places)`);
      return items;
    }
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(st)) throw new Error(`actor ${st}`);
  }
  throw new Error('actor timed out after 7.5 min');
}

async function main() {
  const plan = buildPlan();
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Google Maps Sourcing — high-AOV verticals');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN (no API calls, no cost)' : 'LIVE'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Query plan: ${plan.length} searches, capped at ${MAX} places total\n`);
  const byVert = {};
  for (const p of plan) (byVert[p.vertical] ??= []).push(p.city);
  for (const [v, cities] of Object.entries(byVert)) {
    const aov = VERTICALS.find(x => x.key === v).aov;
    console.log(`  ${v.padEnd(15)} AOV ${aov.padEnd(14)} ${[...new Set(cities)].join(', ')}`);
  }

  if (isDryRun) {
    console.log(`\nWould scrape up to ${MAX} places (~$${(MAX * 0.007).toFixed(2)} at ~$0.007/place).`);
    console.log('Re-run with --yes to execute.');
    return;
  }
  if (!isYes) {
    console.log('\nRefusing to spend without --yes. Use --dry-run to preview.');
    process.exit(1);
  }

  const existing = await (await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?select=website,company_name&client_id=eq.${SMARTFLOW_ID}`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  )).json();
  const seenDomains = new Set((existing || []).map(r => cleanDomain(r.website)).filter(Boolean));
  const seenNames   = new Set((existing || []).map(r => (r.company_name || '').toLowerCase().trim()).filter(Boolean));
  console.log(`\nAlready in DB: ${seenDomains.size} domains / ${seenNames.size} names\n`);

  const items = await runActor(plan.map(p => p.query), MAX);

  const dbg = { noWebsite: 0, notSerbian: 0, dup: 0, excluded: 0, permaban: 0, inserted: 0 };
  for (const it of items) {
    const name = (it.title || '').trim();
    const domain = cleanDomain(it.website);

    if (!name || EXCLUDE_NAME.test(name))            { dbg.excluded++;   continue; }
    if (isPermabanned({ pageName: name, website: it.website })) { dbg.permaban++; continue; }
    // No website means no catalogue to scrape, which means no AOV, which means we
    // cannot qualify them and the demo would be generic. Those are worth 10x less.
    if (!domain)                                      { dbg.noWebsite++;  continue; }
    if (!isSerbian(it))                               { dbg.notSerbian++; continue; }
    if (seenDomains.has(domain) || seenNames.has(name.toLowerCase())) { dbg.dup++; continue; }

    const match = plan.find(p => (it.searchString || '').includes(p.query.split(' ').slice(0, 2).join(' ')));
    const record = {
      company_name       : name,
      name,
      website            : `https://${domain}`,
      email              : null,
      telefon            : it.phone || null,
      lokacija           : it.city || it.address || null,
      instagram_handle   : null,
      instagram_followers: 0,
      niche              : match?.vertical || 'usluge',
      service            : 'social_media_system',
      // Maps gives no email and no ad data, so this lead is not qualified yet —
      // it goes to enrichment, never straight to a demo build.
      status             : 'No Draft',
      izvor              : 'google_maps',
      kategorija         : 'Hladan',
      pipeline_stage     : 'novi',
      sledeca_akcija     : 'Pronaći kontakt email + proveriti aktivne oglase (MIS)',
      comment            : `Google Maps · ${match?.vertical ?? '?'} · očekivani AOV ${match?.aov ?? '?'} RSD · ${it.totalScore ? `ocena ${it.totalScore} (${it.reviewsCount} recenzija)` : 'bez ocena'}`,
      intake_data: {
        scraped_at   : new Date().toISOString(),
        scrape_method: 'apify_google_maps',
        source       : 'google_maps',
        maps: {
          place_id: it.placeId || null,
          category: it.categoryName || null,
          rating: it.totalScore ?? null,
          reviews: it.reviewsCount ?? null,
          address: it.address || null,
          vertical: match?.vertical ?? null,
          expected_aov: match?.aov ?? null,
        },
      },
      client_id: SMARTFLOW_ID,
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
      body: JSON.stringify(record),
    });
    if (res.ok || res.status === 201) {
      console.log(`  ✓ ${name} — ${domain} [${record.niche}]`);
      seenDomains.add(domain); seenNames.add(name.toLowerCase());
      dbg.inserted++;
    } else {
      console.error(`  ✗ ${name}: ${(await res.text()).slice(0, 120)}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Inserted     : ${dbg.inserted}`);
  console.log(`  No website   : ${dbg.noWebsite}   (can't scrape a catalogue → can't score AOV)`);
  console.log(`  Not Serbian  : ${dbg.notSerbian}`);
  console.log(`  Duplicate    : ${dbg.dup}`);
  console.log(`  Chain/portal : ${dbg.excluded}`);
  console.log(`  Permabanned  : ${dbg.permaban}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\nNext: node enrich_missing.mjs   (find emails + ad activity → MIS)');
}

main().catch(e => { console.error('✗ Fatal:', e.message); process.exit(1); });
