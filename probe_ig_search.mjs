/**
 * IG User Search probe — $0.30 budget
 * Searches for Serbian business accounts across multiple terms.
 * Returns follower counts directly — no second profile lookup needed.
 * Cost: $0.0023/result × ~130 results = ~$0.30
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

const TOKEN = process.env.APIFY_TOKEN;
const ACTOR = 'shu8hvrXbJbY3Eb9W'; // apify/instagram-scraper
const MIN_FOLLOWERS = 20000;
const MAX_FOLLOWERS = 200000;

const SEARCHES = [
  'beograd klinika',
  'beograd fitnes',
  'beograd nekretnine',
  'beograd studio',
  'beograd putovanja',
  'beograd restoran',
  'beograd akademija',
  'srbija klinika',
  'srbija fitnes',
  'beograd spa wellness',
];

const EXCLUDE_CATS = new Set([
  'Clothing (Brand)', 'Boutique store', 'Fashion designer', 'Clothing store',
  'Cosmetics store', 'Jewelry/watches', 'Personal blog', 'Public figure',
  'Artist', 'Musician/band', 'Media/news company', 'Shopping & retail',
]);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runSearch(term, limit = 10) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${TOKEN}&maxItems=${limit}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchType: 'user',
        searchLimit: limit,
        search: term,
        resultsType: 'details',
      }),
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(`${term}: ${data.error.message}`);
  const runId = data.data.id;
  const datasetId = data.data.defaultDatasetId;

  let status = 'RUNNING';
  for (let i = 0; i < 60; i++) {
    await sleep(8000);
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${TOKEN}`);
    status = (await s.json()).data?.status;
    if (!['RUNNING', 'READY'].includes(status)) break;
  }

  const r = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${TOKEN}&limit=200`);
  return await r.json();
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  IG User Search Probe — $0.30 budget');
  console.log(`  Searches: ${SEARCHES.length} × ~10 results = ~${SEARCHES.length * 10} accounts`);
  console.log(`  Filter: ${MIN_FOLLOWERS/1000}k–${MAX_FOLLOWERS/1000}k followers, business accounts`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const seen = new Set();
  const results = [];

  for (const term of SEARCHES) {
    process.stdout.write(`  Searching "${term}"... `);
    try {
      const items = await runSearch(term, 10);
      let found = 0;
      for (const p of items) {
        if (!p.username || seen.has(p.username)) continue;
        seen.add(p.username);
        const f = p.followersCount || 0;
        if (!p.isBusinessAccount) continue;
        if (f < MIN_FOLLOWERS || f > MAX_FOLLOWERS) continue;
        if (p.private) continue;
        if (EXCLUDE_CATS.has(p.businessCategoryName)) continue;
        results.push(p);
        found++;
      }
      console.log(`${items.length} accounts → ${found} qualified`);
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
    }
    await sleep(1000);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  QUALIFIED LEADS (${MIN_FOLLOWERS/1000}k–${MAX_FOLLOWERS/1000}k followers, business):`);
  console.log('═══════════════════════════════════════════════════════════\n');

  results.sort((a, b) => (b.followersCount || 0) - (a.followersCount || 0));

  for (const p of results) {
    const f = ((p.followersCount || 0) / 1000).toFixed(1);
    const name = (p.fullName || p.username).slice(0, 35).padEnd(35);
    const handle = ('@' + p.username).padEnd(30);
    const cat = (p.businessCategoryName || '—').slice(0, 25).padEnd(25);
    const url = p.externalUrl || '—';
    console.log(`  ${name} ${handle} ${f}k  ${cat}  ${url}`);
    if (p.biography) console.log(`    Bio: ${p.biography.replace(/\n/g, ' ').slice(0, 80)}`);
  }

  console.log(`\n  Total qualified: ${results.length} (from ${seen.size} unique accounts checked)`);
}

main().catch(err => console.error('Fatal:', err.message));
