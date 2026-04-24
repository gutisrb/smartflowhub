/**
 * Enrich specific No Draft leads using Firecrawl + Hunter.io only.
 * No Apify, no ScrapeCreators.
 *
 * For each lead:
 *   1. Determine domain (from website field, IG handle guess, or Firecrawl IG bio)
 *   2. Hunter.io domain search
 *   3. Raw website HTML scrape
 *   4. Firecrawl website scrape (JS-rendered)
 *   5. Update DB: email + status → enriched
 *
 * Usage:
 *   node enrich_no_draft.mjs --dry-run
 *   node enrich_no_draft.mjs
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HUNTER_KEY   = process.env.HUNTER_API_KEY;
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const isDryRun     = process.argv.includes('--dry-run');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const LEAD_IDS = [
  '8b593f25-0173-470e-989d-c6d1bd1ee2a3',  // Stamenković Dental
  '56832744-07b8-43f4-9cdb-fcc426e7b74f',  // Poliklinika Diva
  '4d415151-ffaa-40f5-a21b-8121c067aab6',  // Nameštaj Artisan Wood
  '16477199-df0a-4e02-9632-0707280c604a',  // Billionaire Belgrade
  '9aeebdb1-bb7f-447e-b936-eaf8b3b64f81',  // mb_laser_estetic_centar
  'f82ea648-0cfa-4673-9a41-7cf62663d7f3',  // Numanović Nameštaj
  '88923fb1-fe70-450d-a3d5-38c0566b3148',  // OPAL plastična hirurgija
  '83bf40f6-62ae-4c2b-814b-08475fbf4d7e',  // Glossa centar za njemački
  '02d16e3b-d1a8-45e6-9703-cdacf982db94',  // Atlas opšta bolnica
  'adf09ee3-b11d-4fc0-8bcb-d7ce27c52e82',  // Sole Azur turistička
  '76216531-79d9-46b0-a35d-fd79a395165e',  // BOKA design
  'fe808970-b0fa-4c9d-8741-b98390059846',  // LuxSpa
  '439a067c-622f-44e3-9038-c7742f6efce9',  // led_neon_industrija
];

// Known handle → likely domain mappings for leads without website
const HANDLE_DOMAIN_GUESSES = {
  'mb_laser_estetic_centar': ['mblaser.rs', 'mblaserestetika.rs', 'mb-laser.rs'],
  'namestajnumanovic':       ['namestajnumanovic.rs', 'numanovic.rs'],
  'glossacentar':            ['glossacentar.rs', 'glossa.rs'],
  'led_neon_industrija':     ['ledneon.rs', 'led-neon.rs', 'ledneonindustrija.rs'],
  'atlas_bolnica':           ['atlasklinika.rs', 'atlasbeograd.rs'],
};

const SKIP_EMAIL = /noreply|no-reply|support|admin|info@facebook|privacy|legal|example|test@|@gmail\.com$|@yahoo|@hotmail/i;

function extractEmail(text) {
  const matches = [...(text || '').matchAll(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g)];
  for (const m of matches) {
    if (!SKIP_EMAIL.test(m[1])) return m[1];
  }
  return null;
}

function cleanDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const h = u.hostname.replace(/^www\./, '');
    if (['facebook.com','instagram.com','maps.app.goo.gl','whatsapp.com','youtube.com','t.me','google.com'].some(s => h.includes(s))) return null;
    return h;
  } catch { return null; }
}

async function hunterSearch(domain) {
  if (!domain || !HUNTER_KEY) return null;
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=5&api_key=${HUNTER_KEY}`);
    const d = await res.json();
    const emails = d?.data?.emails || [];
    // Prefer decision-maker roles
    const dm = emails.find(e => /director|founder|owner|ceo|manager|head|chief|marketing|sales/i.test(e.position || ''));
    return dm?.value || emails[0]?.value || null;
  } catch { return null; }
}

async function websiteScrapeEmail(domain) {
  const urls = [`https://${domain}`, `https://www.${domain}`, `https://${domain}/contact`, `https://${domain}/kontakt`, `https://${domain}/o-nama`];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const email = extractEmail(await res.text());
      if (email) return email;
    } catch {}
  }
  return null;
}

async function firecrawlScrapeEmail(domain) {
  try {
    const { stdout } = await execFileAsync('firecrawl', ['scrape', '--url', `https://${domain}`, '--format', 'markdown'], { timeout: 15000 });
    return extractEmail(stdout);
  } catch { return null; }
}

async function firecrawlFbAboutEmail(fbUrl) {
  if (!fbUrl?.includes('facebook.com')) return null;
  try {
    const aboutUrl = fbUrl.replace(/\/?$/, '/about');
    const { stdout } = await execFileAsync('firecrawl', ['scrape', '--url', aboutUrl, '--format', 'markdown'], { timeout: 20000 });
    return extractEmail(stdout);
  } catch { return null; }
}

async function findWebsiteViaFirecrawlIG(handle) {
  if (!handle) return null;
  try {
    const { stdout } = await execFileAsync('firecrawl', ['scrape', '--url', `https://www.instagram.com/${handle}/`, '--format', 'markdown'], { timeout: 15000 });
    // Look for website in bio
    const urlMatch = stdout?.match(/https?:\/\/(?!instagram\.com|facebook\.com|linktr\.ee)[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}[^\s)"]*/);
    if (urlMatch) return cleanDomain(urlMatch[0]);
  } catch {}
  return null;
}

async function enrichLead(lead) {
  const name = lead.company_name || lead.id;
  console.log(`\n▶ ${name} (@${lead.instagram_handle || '—'})`);

  let domain = cleanDomain(lead.website);
  let email = null;

  // 1. Try existing website domain
  if (domain) {
    console.log(`  Domain from DB: ${domain}`);
    email = await hunterSearch(domain);
    if (email) { console.log(`  ✓ Hunter: ${email}`); return { email, domain }; }
    email = await websiteScrapeEmail(domain);
    if (email) { console.log(`  ✓ Website scrape: ${email}`); return { email, domain }; }
    email = await firecrawlScrapeEmail(domain);
    if (email) { console.log(`  ✓ Firecrawl: ${email}`); return { email, domain }; }
    console.log(`  No email via website`);
  }

  // 2. Handle-based domain guesses
  const handle = lead.instagram_handle;
  const guesses = HANDLE_DOMAIN_GUESSES[handle] || [];
  if (handle && !guesses.length) guesses.push(`${handle.replace(/_/g, '')}.rs`, `${handle.replace(/_/g, '-')}.rs`);
  for (const g of guesses) {
    console.log(`  Trying guessed domain: ${g}`);
    email = await hunterSearch(g);
    if (email) { console.log(`  ✓ Hunter (guess): ${email}`); return { email, domain: g }; }
    email = await websiteScrapeEmail(g);
    if (email) { console.log(`  ✓ Scrape (guess): ${email}`); return { email, domain: g }; }
  }

  // 3. Try finding website from IG bio via Firecrawl
  if (handle && !domain) {
    console.log(`  Trying IG bio scrape for website...`);
    const igDomain = await findWebsiteViaFirecrawlIG(handle);
    if (igDomain) {
      console.log(`  Found domain from IG bio: ${igDomain}`);
      email = await hunterSearch(igDomain);
      if (email) { console.log(`  ✓ Hunter (IG bio): ${email}`); return { email, domain: igDomain }; }
      email = await websiteScrapeEmail(igDomain);
      if (email) { console.log(`  ✓ Scrape (IG bio): ${email}`); return { email, domain: igDomain }; }
    }
  }

  // 4. FB about page
  const fbUrl = lead.intake_data?.facebook_page_url;
  if (fbUrl) {
    console.log(`  Trying FB about page...`);
    email = await firecrawlFbAboutEmail(fbUrl);
    if (email) { console.log(`  ✓ FB about: ${email}`); return { email, domain }; }
  }

  console.log(`  ✗ No email found`);
  return { email: null, domain };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  No Draft Lead Enrichment — Firecrawl + Hunter.io only');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'} | ${LEAD_IDS.length} leads`);
  console.log('═══════════════════════════════════════════════════════════');

  // Fetch lead data
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?id=in.(${LEAD_IDS.join(',')})&select=id,company_name,instagram_handle,website,intake_data`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const leads = await res.json();
  if (!Array.isArray(leads)) { console.error('DB error:', leads); process.exit(1); }
  console.log(`Loaded ${leads.length} leads\n`);

  let enriched = 0, failed = 0;

  for (const lead of leads) {
    const { email, domain } = await enrichLead(lead);

    if (!isDryRun) {
      const patch = { status: email ? 'enriched' : 'No Draft' };
      if (email) patch.email = email;
      if (domain && !lead.website) patch.website = `https://${domain}`;

      if (email) {
        await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
          body: JSON.stringify(patch),
        });
        enriched++;
      } else {
        failed++;
      }
    }

    await sleep(500);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Enriched : ${enriched}/${leads.length}`);
  console.log(`  No email : ${failed}`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
