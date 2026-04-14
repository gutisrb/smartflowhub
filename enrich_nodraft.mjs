/**
 * Enrich 'No Draft' leads that have a website but no email.
 * Strategy: Firecrawl contact/o-nama page → raw scrape → Hunter.io
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
const FCKEY        = process.env.FIRECRAWL_API_KEY;

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const SKIP_EMAIL = /noreply|no-reply|example|sentry|wix|schema|privacy|jquery|firstname\.lastname/i;
const BOGUS_DOM  = new Set(['instagram.com','facebook.com','sentry.io','example.com']);

function isBogusEmail(e) {
  if (!e) return true;
  if (SKIP_EMAIL.test(e)) return true;
  const domain = e.split('@')[1]?.toLowerCase();
  return domain ? BOGUS_DOM.has(domain) : true;
}

function extractDomain(website) {
  try {
    return new URL(website.startsWith('http') ? website : 'https://' + website)
      .hostname.replace(/^www\./, '');
  } catch { return null; }
}

async function firecrawlWebsite(domain) {
  if (!FCKEY) return null;
  const urls = [
    `https://${domain}/kontakt`,
    `https://${domain}/contact`,
    `https://${domain}/o-nama`,
    `https://${domain}`,
  ];
  for (const url of urls) {
    try {
      const { stdout } = await execFileAsync('firecrawl', [
        'scrape', '--url', url, '--format', 'markdown',
      ], { timeout: 20000, env: { ...process.env, FIRECRAWL_API_KEY: FCKEY } });
      if (!stdout) continue;
      const m = stdout.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (m && !isBogusEmail(m[1])) return m[1];
    } catch {}
  }
  return null;
}

async function rawScrape(domain) {
  const urls = [
    `https://${domain}/kontakt`,
    `https://${domain}/contact`,
    `https://${domain}/o-nama`,
    `https://${domain}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(8000), redirect: 'follow',
      });
      if (!res.ok) continue;
      const html = await res.text();
      const m = html.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (m && !isBogusEmail(m[1])) return m[1];
    } catch {}
  }
  return null;
}

const SENIORITY = ['c_suite','vp','director','manager','senior','entry'];
const DEPTS     = ['management','executive','sales','marketing'];

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
    if (!best?.value || isBogusEmail(best.value)) return null;
    return { email: best.value, name: [best.first_name, best.last_name].filter(Boolean).join(' ') || null };
  } catch { return null; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const { data: leads, error } = await sb.from('contacts')
    .select('id, company_name, website, email')
    .eq('client_id', CLIENT_ID)
    .eq('status', 'No Draft')
    .not('website', 'is', null);

  if (error) { console.error(error.message); process.exit(1); }

  const toEnrich = (leads || []).filter(l => !l.email && l.website);
  console.log(`\nNo Draft leads with website but no email: ${toEnrich.length}\n`);

  let enriched = 0;

  for (let i = 0; i < toEnrich.length; i++) {
    const lead = toEnrich[i];
    const domain = extractDomain(lead.website);
    if (!domain) { console.log(`[${i+1}] ${lead.company_name}: bad domain`); continue; }

    console.log(`[${i+1}/${toEnrich.length}] ${lead.company_name} (${domain})`);

    // 1. Hunter first (decision maker)
    process.stdout.write(`  Hunter... `);
    const h = await hunterDomain(domain);
    if (h) {
      console.log(h.email);
      await sb.from('contacts').update({ email: h.email, status: 'enriched', ...(h.name ? { name: h.name } : {}) }).eq('id', lead.id);
      enriched++;
      await sleep(300);
      continue;
    }

    // 2. Firecrawl website (contact page)
    process.stdout.write(`not found → Firecrawl... `);
    const fcEmail = await firecrawlWebsite(domain);
    if (fcEmail) {
      console.log(fcEmail);
      await sb.from('contacts').update({ email: fcEmail, status: 'enriched' }).eq('id', lead.id);
      enriched++;
      await sleep(300);
      continue;
    }

    // 3. Raw scrape fallback
    process.stdout.write(`not found → raw scrape... `);
    const rawEmail = await rawScrape(domain);
    if (rawEmail) {
      console.log(rawEmail);
      await sb.from('contacts').update({ email: rawEmail, status: 'enriched' }).eq('id', lead.id);
      enriched++;
    } else {
      console.log('not found');
    }

    await sleep(300);
  }

  console.log(`\n═══════════════════════════════════════`);
  console.log(`  Enriched: ${enriched}/${toEnrich.length}`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
