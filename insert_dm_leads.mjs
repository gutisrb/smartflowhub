/**
 * Insert the 10 leads from the 4-credit "ili DM" test run.
 * Data reconstructed from printed output — no API credits needed.
 * IG handle via raw HTML scrape, email via Hunter.io.
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

const SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NzQ4MSwiZXhwIjoyMDg2MDczNDgxfQ.6PsYNOzdZeqpWXW3Pej_oLK5fV2MLDi34-SGkHHje2k';
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const HUNTER_KEY   = 'b18a1b18f913bb7907bff359ec0b8065f58eecfa';

// Reconstructed from --test output (4-credit run, queries: javite se u DM / ili DM / pišite u DM / DM za informacije)
const LEADS = [
  { name: 'Kontrast izdavaštvo',              domain: 'kontrastizdavastvo.rs', likes: 70691,  cats: ['Media/news company'] },
  { name: 'Dnevnik za trudnice',               domain: 'dnevnikzatrudnice.com', likes: 22448,  cats: ['Product/service'] },
  { name: 'Na klik',                           domain: 'naklik.store',          likes: 14106,  cats: ['Convenience Store'] },
  { name: 'Shopomania RS',                     domain: 'shopomania.rs',          likes: 11910,  cats: ['Home & Garden'] },
  { name: 'Bella Vista Beograd',               domain: 'bellavistabeograd.com',  likes: 8293,   cats: ['Local business'] },
  { name: 'Balkan Helicopters',                domain: 'balkanhelicopters.rs',   likes: 6158,   cats: ['Automotives'] },
  { name: 'Mara Home Belgrade',                domain: 'marahome.rs',            likes: 3805,   cats: ['Brand'] },
  { name: 'Redo Gummies',                      domain: 'redogummies.com',        likes: 2706,   cats: ['Health/beauty'] },
  { name: 'Hurem Melemi za kozna oboljenja',   domain: 'huremmelemlek.rs',       likes: 1248,   cats: ['Здравље/лепота'] },
];
// Note: Čarolija.rs skipped — same domain as Na klik (naklik.store), same business

const TLDS    = new Set(['com','rs','eu','net','org','io','co','biz','info','hr','ba','si','me','de','fr','uk','it','png','jpg','svg','gif','webp']);
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

async function findIgOnWebsite(domain) {
  const urls = [`https://${domain}`, `https://www.${domain}`, `https://${domain}/kontakt`, `https://${domain}/contact`];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(10000),
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

function mapNiche(name = '', cats = []) {
  const t = [name, ...cats].join(' ').toLowerCase();
  if (/kozmet|spa|wellness|beauty|health|melemi|gummies|vitamin/.test(t)) return 'klinika_wellness';
  if (/nekretnin|real estate/.test(t)) return 'nekretnine';
  if (/kurs|obuka|škola|edukacij|college|university/.test(t)) return 'edukacija';
  if (/fashion|clothing|moda/.test(t)) return 'fashion';
  if (/home|garden|namestaj|enterijer|zavese/.test(t)) return 'online_prodaja';
  if (/news|media|izdavastvo|knjig/.test(t)) return 'edukacija';
  return 'other';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log(`\nInserting ${LEADS.length} leads from DM test run\n`);

  let inserted = 0, failed = 0, noEmail = 0, noIG = 0;

  for (let i = 0; i < LEADS.length; i++) {
    const lead = LEADS[i];
    console.log(`[${i+1}/${LEADS.length}] ${lead.name}`);

    process.stdout.write(`  IG scrape (${lead.domain})... `);
    const igHandle = await findIgOnWebsite(lead.domain);
    console.log(igHandle ? `@${igHandle}` : 'not found');

    process.stdout.write(`  Hunter (${lead.domain})... `);
    const contact = await hunterDomain(lead.domain);
    console.log(contact ? `${contact.email}${contact.name ? ` (${contact.name})` : ''}` : 'not found');

    const niche = mapNiche(lead.name, lead.cats);
    const record = {
      company_name: lead.name,
      name: lead.name,
      website: `https://${lead.domain}`,
      email: contact?.email || null,
      instagram_handle: igHandle || null,
      instagram_followers: lead.likes,
      niche,
      service: 'social_media_system',
      status: contact?.email ? 'enriched' : 'No Draft',
      izvor: 'meta_ads_scrape',
      kategorija: lead.likes >= 20000 ? 'Vreo' : lead.likes >= 5000 ? 'Topao' : 'Hladan',
      client_id: SMARTFLOW_ID,
      sledeca_akcija: contact?.email ? 'Generisati email draft i poslati' : 'Pronaći kontakt email',
      intake_data: {
        active_ads_count: 1,
        ad_copies: [],
        page_categories: lead.cats,
        page_followers: lead.likes,
        scraped_at: new Date().toISOString(),
        search_queries: ['javite se u DM', 'ili DM', 'pišite u DM', 'DM za informacije'],
        enrichment: {
          instagram_profile: igHandle ? { username: igHandle } : {},
          ...(contact ? { contact: { email: contact.email, name: contact.name, title: contact.title, source: 'hunter' } } : {}),
        },
      },
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(record),
    });

    if (res.ok || res.status === 201) {
      console.log(`  ✓ [${record.status}]${igHandle ? ` @${igHandle}` : ''}\n`);
      inserted++;
      if (!contact?.email) noEmail++;
      if (!igHandle) noIG++;
    } else {
      const err = await res.text();
      console.error(`  ✗ ${err.slice(0,100)}\n`);
      failed++;
    }

    await sleep(400);
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Inserted    : ${inserted}`);
  console.log(`  With email  : ${inserted - noEmail}`);
  console.log(`  With IG     : ${inserted - noIG}`);
  console.log(`  Failed      : ${failed}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
