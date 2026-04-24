/**
 * Quick probe: what data does apify/instagram-scraper return for hashtag posts?
 * Just fetch 10 posts, print all fields — specifically checking for follower count.
 * Cost: ~$0.023 (10 results × $0.0023)
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  console.log('Probing apify/instagram-scraper hashtag mode — 10 posts from #beograd...\n');

  const res = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR}/runs?token=${TOKEN}&maxItems=10`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchType: 'user',
        searchLimit: 10,
        search: 'beograd klinika',
        resultsType: 'details',
      }),
    }
  );
  const data = await res.json();
  if (data.error) { console.error('Error:', data.error.message); process.exit(1); }
  const runId = data.data.id;
  const datasetId = data.data.defaultDatasetId;
  console.log(`Run: ${runId}`);

  let status = 'RUNNING';
  for (let i = 0; i < 60; i++) {
    await sleep(10000);
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${TOKEN}`);
    status = (await s.json()).data?.status;
    process.stdout.write(`\r${status} (${(i+1)*10}s)...`);
    if (!['RUNNING', 'READY'].includes(status)) break;
  }
  console.log('\n');

  const r = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${TOKEN}&limit=3`);
  const items = await r.json();
  if (!items.length) { console.log('No results.'); return; }

  // Print all top-level keys from first item
  const first = items[0];
  console.log('=== FIELDS IN FIRST RESULT ===');
  for (const [k, v] of Object.entries(first)) {
    const val = typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 80);
    console.log(`  ${k.padEnd(30)} ${val}`);
  }

  console.log('\n=== OWNER/AUTHOR FIELDS ===');
  const ownerKeys = ['ownerUsername', 'ownerFullName', 'ownerFollowersCount', 'followers', 'likesCount', 'commentsCount', 'videoViewCount'];
  for (const k of ownerKeys) {
    console.log(`  ${k.padEnd(30)} ${first[k] ?? '(not present)'}`);
  }

  // Check if there's any nested object with follower info
  console.log('\n=== NESTED OBJECTS ===');
  for (const [k, v] of Object.entries(first)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      console.log(`  ${k}:`, JSON.stringify(v).slice(0, 120));
    }
  }
}

run().catch(err => console.error('Fatal:', err.message));
