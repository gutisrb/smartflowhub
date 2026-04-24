/**
 * Re-discover IG handles for existing SmartFlow leads that have no handle
 * or a handle that ScrapeCreators couldn't confirm.
 *
 * Sources tried in order per lead:
 *   1. Raw HTML scrape of business website
 *   2. Firecrawl scrape of business website (handles JS-rendered footers)
 *   3. Firecrawl scrape of FB /about page
 *
 * After handles are found, verifies followers via ScrapeCreators.
 * Leads with confirmed < 20k followers are marked Disqualified (not deleted).
 *
 * Usage:
 *   node fix_ig_handles.mjs --dry-run   — preview without DB changes
 *   node fix_ig_handles.mjs             — live run
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

const SC_KEY        = process.env.SC_API_KEY || '7goPweFVUAbts7pj3JsPaDpVLQC3';
const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SMARTFLOW_ID  = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const MIN_FOLLOWERS = 20000;

const isDryRun = process.argv.includes('--dry-run');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const IG_SKIP = new Set(['p','reel','explore','accounts','stories','tv','reels','direct','share','privacy','legal','about','blog','help','press','api','static','cdn','sharedData','google','shopify','facebook','youtube','instagram','twitter','tiktok','linkedin','meta','pinterest','snapchat','whatsapp']);
const TLDS    = new Set(['com','rs','eu','net','org','io','co','biz','info','hr','ba','si','me','de','fr','uk','it','png','jpg','svg','gif','webp','pdf','php','js','css','html','htm','xml','json']);

function isValidIgHandle(h) {
  if (!h || h.length < 2 || h.length > 30) return false;
  if (/^\d+$/.test(h)) return false;
  if (IG_SKIP.has(h.toLowerCase())) return false;
  const last = h.split('.').pop()?.toLowerCase() || '';
  if (TLDS.has(last)) return false;
  if (h.includes('@') || h.includes(' ')) return false;
  return true;
}

function extractIgFromText(text) {
  const matches = [...text.matchAll(/instagram\.com\/([a-zA-Z0-9._]{2,30})\/?/g)];
  for (const m of matches) {
    const h = m[1].replace(/\/$/, '');
    if (isValidIgHandle(h)) return h;
  }
  return null;
}

async function findIgRawHtml(domain) {
  const urls = [`https://${domain}`, `https://www.${domain}`, `https://${domain}/kontakt`, `https://${domain}/contact`, `https://${domain}/o-nama`];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const h = extractIgFromText(await res.text());
      if (h) return h;
    } catch {}
  }
  return null;
}

async function findIgFirecrawlWebsite(domain) {
  try {
    const { stdout } = await execFileAsync('firecrawl', ['scrape', '--url', `https://${domain}`, '--format', 'markdown'], { timeout: 15000 });
    if (stdout) return extractIgFromText(stdout);
  } catch {}
  return null;
}

async function findIgFirecrawlFbAbout(fbUrl) {
  if (!fbUrl?.includes('facebook.com')) return null;
  try {
    const aboutUrl = fbUrl.replace(/\/?$/, '/about');
    const { stdout } = await execFileAsync('firecrawl', ['scrape', '--url', aboutUrl, '--format', 'markdown'], { timeout: 20000 });
    if (stdout) {
      const section = stdout.match(/[Ww]ebsites? and social links?([\s\S]{0,800})/)?.[1] || stdout;
      return extractIgFromText(section);
    }
  } catch {}
  return null;
}

async function scCreatorsProfile(handle) {
  try {
    const res = await fetch(
      `https://api.scrapecreators.com/v1/instagram/profile?handle=${encodeURIComponent(handle)}`,
      { headers: { 'x-api-key': SC_KEY }, signal: AbortSignal.timeout(15000) }
    );
    const d = await res.json();
    const u = d?.data?.user;
    if (!u) return null;
    return { followersCount: u.edge_followed_by?.count ?? 0, username: u.username };
  } catch {}
  return null;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SmartFlow — Re-discover IG handles for existing leads');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN (no DB writes)' : 'LIVE'}`);
  console.log(`  Min followers: ${MIN_FOLLOWERS / 1000}k`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Load all non-disqualified leads with no handle OR unverified handle
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${SMARTFLOW_ID}` +
    `&kategorija=neq.Disqualified&status=neq.Disqualified&status=neq.Kontaktiran` +
    `&select=id,name,company_name,instagram_handle,instagram_followers,website,intake_data` +
    `&order=company_name.asc`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const leads = await res.json();
  if (!Array.isArray(leads)) { console.error('DB error:', leads); process.exit(1); }
  console.log(`Loaded ${leads.length} leads to check\n`);

  // ── Stage 1: Re-find missing/unverified handles ───────────────────────────────
  console.log('─── Stage 1: Handle re-discovery ────────────────────────────');
  let found = 0, already = 0, failed = 0;

  for (const lead of leads) {
    const name    = lead.company_name || lead.name;
    const domain  = lead.website?.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').split('/')[0];
    const fbUrl   = lead.intake_data?.facebook_page_url;
    const current = lead.instagram_handle;

    process.stdout.write(`  ${name.slice(0, 30).padEnd(30)} current: @${(current || '—').padEnd(25)} `);

    let newHandle = null;

    // Try website raw HTML first (fast)
    if (domain && !newHandle) newHandle = await findIgRawHtml(domain);
    // Firecrawl website (handles JS-rendered footers like Geppetto)
    if (domain && !newHandle) newHandle = await findIgFirecrawlWebsite(domain);
    // Firecrawl FB about page
    if (fbUrl && !newHandle)  newHandle = await findIgFirecrawlFbAbout(fbUrl);

    if (newHandle && newHandle !== current) {
      console.log(`→ @${newHandle} ← NEW`);
      lead._newHandle = newHandle;
      found++;
    } else if (current) {
      console.log(`(kept)`);
      already++;
    } else {
      console.log(`not found`);
      failed++;
    }

    await sleep(200);
  }

  console.log(`\n  New handles found: ${found} | Already had handle: ${already} | Not found: ${failed}\n`);

  // ── Stage 2: ScrapeCreators verification ─────────────────────────────────────
  console.log('─── Stage 2: ScrapeCreators follower verification ───────────');
  const toVerify = leads.filter(l => l._newHandle || (l.instagram_handle && !l.instagram_followers));
  console.log(`  Verifying ${toVerify.length} handles...\n`);

  for (const lead of toVerify) {
    const handle = lead._newHandle || lead.instagram_handle;
    process.stdout.write(`  @${handle}... `);
    const profile = await scCreatorsProfile(handle);
    if (profile) {
      lead._followers = profile.followersCount;
      console.log(`${(profile.followersCount / 1000).toFixed(1)}k followers`);
    } else {
      console.log(`not found`);
    }
    await sleep(300);
  }

  // ── Stage 3: DB updates ───────────────────────────────────────────────────────
  if (isDryRun) {
    console.log('\n[DRY RUN] No DB changes written.');
    return;
  }

  console.log('\n─── Stage 3: DB updates ─────────────────────────────────────');
  let updated = 0, disqualified = 0;

  for (const lead of leads) {
    const handle    = lead._newHandle || lead.instagram_handle;
    const followers = lead._followers ?? lead.instagram_followers;
    const name      = lead.company_name || lead.name;

    if (!handle) continue;

    const patch = {};
    if (lead._newHandle && lead._newHandle !== lead.instagram_handle) {
      patch.instagram_handle = lead._newHandle;
    }
    if (lead._followers != null) {
      patch.instagram_followers = lead._followers;
    }

    // Mark Disqualified if confirmed below threshold
    if (lead._followers != null && lead._followers < MIN_FOLLOWERS) {
      patch.kategorija = 'Disqualified';
      patch.status     = 'Disqualified';
      console.log(`  ✗ Disqualified: ${name} (@${handle} — ${(lead._followers / 1000).toFixed(1)}k < ${MIN_FOLLOWERS / 1000}k)`);
      disqualified++;
    } else if (Object.keys(patch).length > 0) {
      console.log(`  ✓ Updated: ${name}${lead._newHandle ? ` → @${lead._newHandle}` : ''}${lead._followers != null ? ` (${(lead._followers / 1000).toFixed(1)}k followers)` : ''}`);
      updated++;
    }

    if (Object.keys(patch).length === 0) continue;

    await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Handles updated    : ${updated}`);
  console.log(`  Disqualified       : ${disqualified}`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
