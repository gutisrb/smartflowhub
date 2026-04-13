/**
 * One-shot: insert the 18 leads from the 2-term test run.
 * Firecrawl each website to find IG handle (free).
 * Hunter.io for decision maker email (free quota).
 * No ScrapeCreators credits spent.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const HUNTER_KEY   = process.env.HUNTER_API_KEY;

// 18 leads from test run (prijavite se + kontaktirajte nas, RS VIDEO sorted by impressions)
const TEST_LEADS = [
  { name: 'TIMOCOM',                                          domain: 'timocom.rs',              likes: 139924, cats: ['Business'] },
  { name: 'DaLux',                                            domain: 'dalux.rs',                likes: 43983,  cats: ['Home & Garden'] },
  { name: 'Workforce - Posao u Sloveniji',                    domain: 'jobsinslovenia.eu',        likes: 37336,  cats: ['Business'] },
  { name: 'Zepter Srbija',                                    domain: 'zepter.rs',               likes: 36023,  cats: ['Shopping'] },
  { name: 'Ekobox Kontejneri',                               domain: 'eko-box.com',              likes: 55163,  cats: ['Construction'] },
  { name: 'Farmina Srbija',                                   domain: 'farmina.com',             likes: 16868,  cats: ['Pet Supplies'] },
  { name: 'ITS - Visoka škola strukovnih studija za IT',      domain: 'upis.its.edu.rs',         likes: 19162,  cats: ['Community College'] },
  { name: 'Premium Genetics',                                 domain: 'premiumgenetics.rs',      likes: 9959,   cats: ['Business'] },
  { name: 'Beostan profesionalni upravnik',                   domain: 'beostanupravnik.com',     likes: 9383,   cats: ['Real Estate'] },
  { name: 'Zlatara Gold Art',                                 domain: 'burmenakit.com',          likes: 7830,   cats: ['Shopping'] },
  { name: 'Atria',                                            domain: 'atria.rs',                likes: 7610,   cats: ['Consulting agency'] },
  { name: 'Pronatal Beograd',                                 domain: 'pronatal.rs',             likes: 4470,   cats: ['Fertility Doctor'] },
  { name: 'Sky Experience',                                   domain: 'wellnessinstitute.rs',    likes: 3883,   cats: ['Gym'] },
  { name: 'Fakultet savremenih umetnosti',                    domain: 'fsu.edu.rs',              likes: 10479,  cats: ['College & university'] },
  { name: 'Škola gitare Starčević',                           domain: 'skolagitare.rs',          likes: 2838,   cats: ['Education'] },
  { name: 'Vrtić Mali istraživači',                           domain: 'maliistrazivaci.rs',      likes: 1201,   cats: ['Child Care'] },
  { name: 'KNAP Tailor',                                      domain: 'knap.rs',                 likes: 558,    cats: ['Clothing (Brand)'] },
  { name: 'LDM Group DOO',                                    domain: 'ldmgroup.rs',             likes: 853,    cats: ['Business'] },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function mapNiche(name = '', cats = []) {
  const t = [name, ...cats].join(' ').toLowerCase();
  if (/kozmet|spa|wellness|estet|stomatol|klinika|ordinacija|bolnica|dermatol|beauty|fertility|gym/.test(t)) return 'klinika_wellness';
  if (/fitness|gym|sport|trening|fitnes|yoga/.test(t)) return 'fitnes';
  if (/restoran|kafana|catering|hotel|vila/.test(t)) return 'ugostiteljstvo';
  if (/nekretnin|real estate|stan /.test(t)) return 'nekretnine';
  if (/kurs|obuka|akademija|edukacij|škola|skola|college|university|child care/.test(t)) return 'edukacija';
  if (/fashion|moda|clothing|garderob|tailor/.test(t)) return 'fashion';
  if (/shopping|shop|prodavnic/.test(t)) return 'online_prodaja';
  return 'other';
}

// Common TLDs — if a "handle" ends with one of these it's a domain, not an IG handle
const TLDS = new Set(['com','rs','eu','net','org','io','co','biz','info','hr','ba','si','me','de','fr','uk','it']);
const IG_SKIP = new Set(['p','reel','explore','accounts','stories','tv','reels','direct','sharedData','share','privacy','legal','about','blog','help','press','api','static','cdn']);

function isValidIgHandle(handle) {
  if (!handle || handle.length < 2 || handle.length > 30) return false;
  if (/^\d+$/.test(handle)) return false;                         // all digits
  if (IG_SKIP.has(handle.toLowerCase())) return false;            // IG internal path
  const lastPart = handle.split('.').pop()?.toLowerCase() || '';
  if (TLDS.has(lastPart)) return false;                           // looks like a domain (dalux.rs, timocom.com)
  if (handle.includes('@')) return false;
  return true;
}

// Scrape website for instagram.com/<handle> links only (explicit URL, not @mentions)
async function findIgOnWebsite(domain) {
  const urls = [`https://${domain}`, `https://${domain}/kontakt`, `https://${domain}/contact`, `https://${domain}/o-nama`];

  for (const url of urls) {
    try {
      const { stdout } = await execFileAsync('firecrawl', [
        'scrape', '--url', url, '--format', 'markdown', '--only-main-content',
      ], { timeout: 15000 });
      if (!stdout) continue;
      // Only match explicit instagram.com/<handle> URLs — no loose @mention fallback
      const matches = [...stdout.matchAll(/instagram\.com\/([a-zA-Z0-9._]{2,30})\/?[^a-zA-Z0-9._]/g)];
      for (const m of matches) {
        const handle = m[1];
        if (isValidIgHandle(handle)) return handle;
      }
    } catch { /* try next url */ }
  }
  return null;
}

// Hunter.io domain search
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

async function main() {
  console.log(`\nInserting ${TEST_LEADS.length} test leads → Firecrawl IG + Hunter email\n`);

  let inserted = 0, failed = 0, noEmail = 0, noIG = 0;

  for (let i = 0; i < TEST_LEADS.length; i++) {
    const lead = TEST_LEADS[i];
    console.log(`[${i + 1}/${TEST_LEADS.length}] ${lead.name}`);
    console.log(`  ${lead.domain} | ${lead.likes.toLocaleString()} FB likes`);

    // Firecrawl for IG
    process.stdout.write(`  Firecrawl → IG... `);
    const igHandle = await findIgOnWebsite(lead.domain);
    console.log(igHandle ? `@${igHandle}` : 'not found');

    // Hunter for email
    process.stdout.write(`  Hunter: ${lead.domain}... `);
    const contact = await hunterDomain(lead.domain);
    console.log(contact ? `${contact.email}${contact.name ? ` (${contact.name})` : ''}` : 'not found');

    const niche = mapNiche(lead.name, lead.cats);
    const intake_data = {
      active_ads_count: 2, // appeared in 2 test queries
      ad_copies: [],
      page_categories: lead.cats,
      page_followers: lead.likes,
      scraped_at: new Date().toISOString(),
      enrichment: {
        instagram_profile: igHandle
          ? { username: igHandle, followers: lead.likes, follower_count: lead.likes }
          : {},
        ...(contact ? { contact: { email: contact.email, name: contact.name, title: contact.title, source: 'hunter' } } : {}),
      },
    };

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
      intake_data,
      client_id: SMARTFLOW_ID,
      sledeca_akcija: contact?.email ? 'Generisati email draft i poslati' : 'Pronaći kontakt email',
    };

    // Insert — dedup by (client_id, company_name) isn't a DB constraint so just try insert
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
      const label = contact?.email ? 'enriched' : 'No Draft';
      console.log(`  ✓ [${label}]${igHandle ? ` @${igHandle}` : ''}\n`);
      inserted++;
      if (!contact?.email) noEmail++;
      if (!igHandle) noIG++;
    } else {
      const err = await res.text();
      console.error(`  ✗ ${err.slice(0, 100)}\n`);
      failed++;
    }

    await sleep(500);
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Inserted    : ${inserted}`);
  console.log(`  With email  : ${inserted - noEmail}`);
  console.log(`  With IG     : ${inserted - noIG}`);
  console.log(`  Failed      : ${failed}`);
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
