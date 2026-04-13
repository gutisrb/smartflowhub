/**
 * Enrich top 50 Novi Lead leads
 * Strategy (in order):
 *   1. Stored website → Hunter → website scrape
 *   2. No website → ScrapeCreators IG profile (external_url) → Hunter → website scrape
 *   3. Still nothing → Firecrawl FB about page → Hunter → website scrape
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createClient } from '@supabase/supabase-js';

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
const CLIENT_ID    = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const HUNTER_KEY   = process.env.HUNTER_API_KEY;
const SC_API_KEY   = process.env.SC_API_KEY;
const TARGET       = 50;  // keep going until this many are enriched
const BATCH_SIZE   = 200; // max leads to attempt

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
const KAT_ORDER = { Vreo: 0, Topao: 1, Hladan: 2 };

const BOGUS_RE     = /\.(webp|png|jpg|jpeg|gif|svg)(@|$)/i;
const BOGUS_DOMAIN = new Set(['instagram.com','facebook.com','temu.com','pubgmobile.com','api.whatsapp.com','maps.app.goo.gl','play.google.com']);
const SOCIAL_DOM   = new Set(['instagram.com','facebook.com','api.whatsapp.com','maps.app.goo.gl','temu.com','bit.ly','linktr.ee','fb.com','fb.me','youtube.com','tiktok.com']);
const SKIP_EMAIL   = /noreply|no-reply|example|sentry|wix|schema|privacy|jquery|firstname\.lastname/i;

function isBogusEmail(e) {
  if (!e) return true;
  if (BOGUS_RE.test(e)) return true;
  if (SKIP_EMAIL.test(e)) return true;
  const domain = e.split('@')[1]?.toLowerCase();
  if (domain && BOGUS_DOMAIN.has(domain)) return true;
  return false;
}

function extractDomain(url) {
  if (!url) return null;
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    if (SOCIAL_DOM.has(host)) return null;
    return host;
  } catch { return null; }
}

const SENIORITY = ['c_suite','vp','director','manager','senior','entry'];
const DEPTS     = ['management','executive','sales','marketing'];

async function hunter(domain) {
  try {
    const r = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${HUNTER_KEY}`);
    if (!r.ok) return null;
    const emails = (await r.json())?.data?.emails || [];
    if (!emails.length) return null;
    const best = [...emails].sort((a,b) => {
      const dA = DEPTS.includes(a.department)?0:1, dB = DEPTS.includes(b.department)?0:1;
      if (dA !== dB) return dA - dB;
      const sA = SENIORITY.indexOf(a.seniority||''), sB = SENIORITY.indexOf(b.seniority||'');
      if (sA !== sB) return (sA<0?99:sA)-(sB<0?99:sB);
      return (b.confidence||0)-(a.confidence||0);
    })[0];
    if (!best?.value || isBogusEmail(best.value)) return null;
    return { email: best.value, name: [best.first_name,best.last_name].filter(Boolean).join(' ')||null };
  } catch { return null; }
}

async function webscrape(domain) {
  const urls = [
    `https://${domain}/kontakt`,
    `https://${domain}/contact`,
    `https://${domain}/o-nama`,
    `https://${domain}`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000), redirect: 'follow'
      });
      if (!r.ok) continue;
      const html = await r.text();
      const m = html.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (m && !isBogusEmail(m[1])) return m[1];
    } catch {}
  }
  return null;
}

// Extract domain from ad copy text (looks for .rs, .ba, .hr etc URLs)
function domainFromAdCopies(adCopies = []) {
  const LOCAL_TLDS = /\.(rs|ba|hr|si|me|com|net|org|eu|shop|store)(\/|$|\s)/i;
  for (const copy of adCopies) {
    // Match plain domains like "startours.rs" or URLs
    const matches = [...(copy||'').matchAll(/(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9][a-zA-Z0-9\-]{1,60}\.[a-z]{2,10})(?:\/[^\s]*)?/g)];
    for (const m of matches) {
      const host = m[1].toLowerCase();
      if (LOCAL_TLDS.test(host + '/') && !SOCIAL_DOM.has(host)) return host;
    }
  }
  return null;
}

// Firecrawl scrape of a website URL — extract email
async function firecrawlWebsite(domain) {
  const FCKEY = process.env.FIRECRAWL_API_KEY;
  if (!FCKEY) return null;
  const urls = [`https://${domain}/kontakt`, `https://${domain}`];
  for (const url of urls) {
    try {
      const { stdout } = await execFileAsync('firecrawl', [
        'scrape', '--url', url, '--format', 'markdown',
      ], {
        timeout: 20000,
        env: { ...process.env, FIRECRAWL_API_KEY: FCKEY },
      });
      if (!stdout) continue;
      const m = stdout.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (m && !isBogusEmail(m[1])) return m[1];
    } catch {}
  }
  return null;
}

async function findEmailForLead(lead) {
  // Step 1: stored website
  let domain = extractDomain(lead.website);

  // Step 2: domain from ad copies (free, no API)
  if (!domain) {
    domain = domainFromAdCopies(lead.intake_data?.ad_copies);
    if (domain) process.stdout.write(`  domain from ad copy: ${domain}\n`);
  }

  // Step 3: guess domain from IG handle / company name slug (try common TLDs)
  if (!domain && lead.instagram_handle) {
    const slug = lead.instagram_handle.toLowerCase().replace(/[^a-z0-9]/g, '');
    const candidates = [`${slug}.rs`, `${slug}.com`];
    for (const candidate of candidates) {
      try {
        const r = await fetch(`https://${candidate}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000), redirect: 'follow',
        });
        if (r.ok) { domain = candidate; break; }
      } catch {}
    }
    if (domain) process.stdout.write(`  guessed domain: ${domain}\n`);
  }

  if (domain) {
    // Try Hunter first (decision maker)
    process.stdout.write(`  Hunter (${domain})... `);
    const h = await hunter(domain);
    if (h) {
      console.log(`${h.email}${h.name ? ` (${h.name})` : ''}`);
      return { ...h, domain };
    }

    // Firecrawl website scrape (gets more emails than raw fetch)
    process.stdout.write(`not found → Firecrawl... `);
    const fcEmail = await firecrawlWebsite(domain);
    if (fcEmail) {
      console.log(fcEmail);
      return { email: fcEmail, name: null, domain };
    }

    // Raw fetch fallback
    process.stdout.write(`not found → raw scrape... `);
    const email = await webscrape(domain);
    if (email) {
      console.log(email);
      return { email, name: null, domain };
    }
    console.log('not found');
  } else {
    console.log(`  No domain found`);
  }

  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const { data: leads, error } = await sb.from('contacts')
    .select('id, company_name, website, instagram_handle, kategorija, instagram_followers, intake_data')
    .eq('client_id', CLIENT_ID)
    .eq('status', 'Novi Lead')
    .gte('created_at', '2026-04-08T00:00:00');

  if (error) { console.error(error.message); process.exit(1); }

  const sorted = (leads||[]).sort((a,b) => {
    const k = (KAT_ORDER[a.kategorija]??9)-(KAT_ORDER[b.kategorija]??9);
    return k!==0 ? k : (b.instagram_followers||0)-(a.instagram_followers||0);
  });

  const candidates = sorted.slice(0, BATCH_SIZE);
  console.log(`\nTarget: ${TARGET} enriched leads | Candidates: ${candidates.length}\n`);

  let enriched = 0;

  for (let i = 0; i < candidates.length; i++) {
    if (enriched >= TARGET) break;

    const lead = candidates[i];
    console.log(`[${i+1}/${candidates.length}] ${lead.company_name} [${lead.kategorija}] ${lead.instagram_followers||0}f  (enriched: ${enriched}/${TARGET})`);

    const result = await findEmailForLead(lead);

    if (result?.email) {
      const update = { email: result.email, status: 'enriched' };
      if (result.name) update.name = result.name;
      if (result.domain && !lead.website) update.website = `https://${result.domain}`;
      await sb.from('contacts').update(update).eq('id', lead.id);
      enriched++;
    }

    await sleep(500);
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  Enriched: ${enriched}/${TARGET} target`);
  console.log(`  Attempted: ${Math.min(candidates.length, TARGET + (enriched < TARGET ? candidates.length : 0))} leads`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
