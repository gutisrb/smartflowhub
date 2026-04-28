/**
 * Targeted enrichment for the 11 quality leads with 15k+ IG and no email.
 * Steps:
 *   1. Disqualify 7 garbage leads (media, SaaS, foreign brands, etc.)
 *   2. Fix known websites missing from DB (e.g. Studio lepote SAVE TIME)
 *   3. For leads with website: Hunter.io + raw HTML + Firecrawl
 *   4. For leads without website: try FB profile scrape + IG handle domain guesses
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const execFileAsync = promisify(execFile);

function loadEnv() {
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HUNTER_KEY   = process.env.HUNTER_API_KEY;
const CLIENT_ID    = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Step 1: Disqualify 7 garbage leads ────────────────────────────────────────
const DISQUALIFY_IDS = [
  '440cedec-2922-4410-89a4-4548272d4ec0', // Fitness Inbox — fitness content creator
  '653a47f8-e585-4ddd-b114-fd2cf2f51b54', // World Inbox — random international
  '4f0be2bd-aeeb-4833-b4c3-e28093142f02', // InboxDollars — US rewards site
  '2c7f5de3-39f9-4830-aa2e-c61b1b2cbfcb', // BeDeM — design market event
  '8ca5d0dd-fab6-4495-b792-9ea098fbe9ff', // Auto Oglasi Srbija — listings platform
  'bad7a899-3b29-4144-ab39-0955da96a110', // Wati — SaaS company
  '713ac589-002b-4517-bbb6-9ed96158e9e2', // Nameštaj Bonsai FIT — no IG handle verified
];

console.log('=== Step 1: Disqualifying 7 garbage leads ===');
const { error: dqErr } = await sb.from('contacts')
  .update({ status: 'Disqualified' })
  .in('id', DISQUALIFY_IDS)
  .eq('client_id', CLIENT_ID);
if (dqErr) console.error('  DQ error:', dqErr.message);
else console.log(`  ✓ ${DISQUALIFY_IDS.length} leads disqualified\n`);

// ── Step 2: Fix known websites not stored in DB ────────────────────────────────
const WEBSITE_FIXES = [
  { id: '6cfcf323-8523-4b34-9b1a-c0fa858c35fd', website: 'https://savetimestudio.com', name: 'Studio lepote SAVE TIME' },
];

console.log('=== Step 2: Fixing missing websites ===');
for (const fix of WEBSITE_FIXES) {
  await sb.from('contacts').update({ website: fix.website }).eq('id', fix.id);
  console.log(`  ✓ ${fix.name} → ${fix.website}`);
}
console.log();

// ── Enrichment helpers ────────────────────────────────────────────────────────

const SENIORITY_ORDER = ['c_suite', 'vp', 'director', 'manager', 'senior', 'entry'];
const TARGET_DEPTS    = ['management', 'executive', 'sales', 'marketing'];

async function hunterDomain(domain) {
  if (!domain) return null;
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${HUNTER_KEY}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const emails = data?.data?.emails || [];
    if (!emails.length) return null;
    const sorted = [...emails].sort((a, b) => {
      const aDept = TARGET_DEPTS.includes(a.department) ? 0 : 1;
      const bDept = TARGET_DEPTS.includes(b.department) ? 0 : 1;
      if (aDept !== bDept) return aDept - bDept;
      const aR = SENIORITY_ORDER.indexOf(a.seniority || '');
      const bR = SENIORITY_ORDER.indexOf(b.seniority || '');
      if ((aR === -1 ? 99 : aR) !== (bR === -1 ? 99 : bR))
        return (aR === -1 ? 99 : aR) - (bR === -1 ? 99 : bR);
      return (b.confidence || 0) - (a.confidence || 0);
    });
    const best = sorted[0];
    return best?.value || null;
  } catch { return null; }
}

const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
const SKIP_EMAIL = /noreply|no-reply|example|johndoe|test@|sentry|wix|schema|privacy|jquery|qodeinteractive|@website\.|@domena\.|^(posao|hr|kadrovi|jobs|career|zaposlenje|rekrutacij)@|\.(png|jpg|jpeg|gif|svg|webp|pdf|css|js)(@|$)|@domain\.|iam\.gserviceaccount|johndoe|mail@domain|info@website|ime@domena/i;

function pickEmail(html) {
  const found = (html.match(EMAIL_RE) || [])
    .map(e => e.toLowerCase().replace(/^%20/, ''))
    .filter(e => e.length < 80 && !SKIP_EMAIL.test(e) && e.includes('.'));
  // prefer non-generic
  const generic = /^(info|kontakt|contact|podrska|support|office|hello|mail|admin)@/i;
  const specific = found.filter(e => !generic.test(e));
  return specific[0] || found[0] || null;
}

async function rawScrapeEmail(baseUrl) {
  const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
  const base = url.replace(/\/$/, '');
  const pages = [base, `${base}/kontakt`, `${base}/contact`, `${base}/o-nama`];
  for (const pageUrl of pages) {
    try {
      const res = await fetch(pageUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartFlow/1.0)' },
        signal: AbortSignal.timeout(8000), redirect: 'follow',
      });
      if (!res.ok) continue;
      const html = await res.text();
      const e = pickEmail(html);
      if (e) return e;
    } catch { /* try next */ }
  }
  return null;
}

async function firecrawlEmail(baseUrl) {
  const url = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
  const base = url.replace(/\/$/, '');
  const pages = [base, `${base}/kontakt`, `${base}/contact`, `${base}/o-nama`];
  for (const pageUrl of pages) {
    try {
      const { stdout } = await execFileAsync('firecrawl', [
        'scrape', '--url', pageUrl, '--format', 'markdown', '--only-main-content',
      ], { timeout: 20000 });
      const e = pickEmail(stdout);
      if (e) return e;
    } catch { /* try next */ }
  }
  return null;
}

async function extractEmailFromUrl(url) {
  process.stdout.write('    raw HTML... ');
  const raw = await rawScrapeEmail(url);
  if (raw) { console.log(raw); return raw; }
  process.stdout.write('Firecrawl... ');
  const fc = await firecrawlEmail(url);
  if (fc) { console.log(fc); return fc; }
  console.log('not found');
  return null;
}

// Try to find a website for leads that have only a FB numeric ID (no direct URL)
async function findWebsiteViaFb(fbId) {
  if (!fbId) return null;
  const fbUrl = `https://www.facebook.com/profile.php?id=${fbId}`;
  try {
    const { stdout } = await execFileAsync('firecrawl', [
      'scrape', '--url', fbUrl, '--format', 'markdown', '--only-main-content',
    ], { timeout: 20000 });
    // Look for website URLs in the FB about text
    const urlMatch = stdout.match(/https?:\/\/(?!facebook|instagram|twitter|t\.me|wa\.me|youtube|youtu\.be|linktree|linktr\.ee|linkin\.bio)[a-zA-Z0-9][\w.-]+\.[a-zA-Z]{2,}[^\s"')>]*/g);
    if (urlMatch && urlMatch.length) {
      const cleaned = urlMatch[0].replace(/[.,;)]+$/, '');
      return cleaned;
    }
    return null;
  } catch { return null; }
}

// Try common domain patterns from IG handle
async function guessDomainFromHandle(handle) {
  if (!handle) return null;
  const slug = handle.replace(/[._]/g, '-').replace(/--+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  const slug2 = handle.replace(/[._]/g, '').toLowerCase();
  const candidates = [
    `https://${handle}.rs`, `https://${slug}.rs`,
    `https://${handle}.com`, `https://${slug}.com`,
    `https://${slug2}.rs`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: 'HEAD', signal: AbortSignal.timeout(5000), redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartFlow/1.0)' },
      });
      if (res.ok || res.status === 405) return url;
    } catch { /* try next */ }
  }
  return null;
}

// ── Step 3 & 4: Enrich all 11 keepers ─────────────────────────────────────────
const KEEPER_IDS = [
  'e9cc1dd2-0b7d-45b8-9fe2-f49e6a2517a4', // Spec. dr Milica Milenović — drmilica.com
  '71bee457-ee2a-470f-82ab-7063a8a57f1e', // mb_laser_estetic_centar — no website
  'acb4965a-69b6-4029-8f2e-d2f2d57450d2', // Premium Beauty — no website
  '492be845-901a-4eb6-b01d-ecb7ebe82bdb', // wellbe — trywellbe.rs
  '791978b2-e073-4c63-83db-ac2ca641e4c4', // divalasercentar — divashop.rs
  '81e3167c-5031-4a72-bf28-982a4a3d75de', // pronadjimajstora — no website
  '6cfcf323-8523-4b34-9b1a-c0fa858c35fd', // Studio lepote SAVE TIME — savetimestudio.com (just fixed)
  '7168a009-b526-4e8b-b026-04b8c2e76ff4', // led_neon_industrija — led-neon-industrija.shop
  '766c0f39-a2f9-4d8a-a121-5b3710aa506b', // Doràn Clinic — no website
  'ce76fe4f-68a5-423b-9011-0ca12a04086c', // Avangarda Events — no website
  'e9ffe42f-43ed-4733-9bba-91fcacbd2e3f', // ivanovicnamestaj — no website
];

const { data: keepers, error: kErr } = await sb.from('contacts')
  .select('id, company_name, instagram_handle, website, intake_data')
  .in('id', KEEPER_IDS);
if (kErr) { console.error(kErr.message); process.exit(1); }

console.log(`=== Steps 3 & 4: Enriching ${keepers.length} leads ===\n`);

for (const lead of keepers) {
  console.log(`[${lead.company_name}] (@${lead.instagram_handle})`);

  let website = lead.website;

  // If no website, try finding one
  if (!website) {
    const fbId = lead.intake_data?.facebook_page_id;
    if (fbId) {
      process.stdout.write('  Finding website via FB profile... ');
      const found = await findWebsiteViaFb(fbId);
      if (found) { console.log(found); website = found; }
      else {
        console.log('not found');
        process.stdout.write('  Guessing domain from IG handle... ');
        const guessed = await guessDomainFromHandle(lead.instagram_handle);
        if (guessed) { console.log(guessed); website = guessed; }
        else console.log('not found');
      }
    } else {
      process.stdout.write('  Guessing domain from IG handle... ');
      const guessed = await guessDomainFromHandle(lead.instagram_handle);
      if (guessed) { console.log(guessed); website = guessed; }
      else console.log('not found');
    }

    // Save discovered website
    if (website) {
      await sb.from('contacts').update({ website }).eq('id', lead.id);
    }
  }

  if (!website) {
    console.log('  ✗ No website found — skipping email enrichment\n');
    continue;
  }

  // Extract domain for Hunter
  let domain = null;
  try {
    const u = new URL(website.startsWith('http') ? website : `https://${website}`);
    domain = u.hostname.replace(/^www\./, '');
  } catch { domain = website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]; }

  // Hunter first
  process.stdout.write(`  Hunter (${domain})... `);
  let email = await hunterDomain(domain);
  if (email) { console.log(email); }
  else {
    console.log('not found');
    email = await extractEmailFromUrl(website);
  }

  if (email) {
    await sb.from('contacts').update({ email, status: 'enriched' }).eq('id', lead.id);
    console.log(`  ✓ Saved: ${email}\n`);
  } else {
    console.log('  ✗ No email found\n');
  }

  await sleep(400);
}

// ── Summary ────────────────────────────────────────────────────────────────────
const { data: final } = await sb.from('contacts')
  .select('company_name, instagram_handle, instagram_followers, email, status')
  .in('id', KEEPER_IDS)
  .order('instagram_followers', { ascending: false });

console.log('=== Final State ===');
let found = 0;
for (const l of final) {
  const mark = l.email ? '✓' : '✗';
  console.log(`  ${mark} ${l.company_name} (@${l.instagram_handle}) [${l.status}]: ${l.email || 'no email'}`);
  if (l.email) found++;
}
console.log(`\nEmails found: ${found}/${KEEPER_IDS.length}`);
