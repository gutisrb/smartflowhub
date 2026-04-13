/**
 * Fix suspect IG handles and delete leads with < 10k confirmed followers.
 *
 * Targets: all "enriched" leads with instagram_followers < 10000 OR NULL
 *
 * Pipeline:
 *   1. Fetch suspect leads from DB (52 total)
 *   2. Firecrawl FB /about page → find real IG link (most reliable source)
 *   3. Update DB with corrected IG handles
 *   4. Batch Apify IG Profile Scraper on ALL handles (old + corrected)
 *   5. Update instagram_followers in DB
 *   6. Delete leads with confirmed followersCount < 10000
 *      (no-IG-found leads are KEPT unless they have confirmed low followers)
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

const APIFY_TOKEN      = 'process.env.APIFY_TOKEN';
const IG_PROFILE_ACTOR = 'dSCLg0C3YEZ83HzYX';
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SMARTFLOW_ID     = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const MIN_FOLLOWERS    = 10000;

const isDryRun = process.argv.includes('--dry-run');

const IG_SKIP = new Set(['p','reel','explore','accounts','stories','tv','reels','direct','share','privacy','legal','about','blog','help','press','api','static','cdn','sharedData']);
const TLDS    = new Set(['com','rs','eu','net','org','io','co','biz','info','hr','ba','si','me','de','fr','uk','it','png','jpg','svg','gif','webp','pdf']);

function isValidIgHandle(h) {
  if (!h || h.length < 2 || h.length > 30) return false;
  if (/^\d+$/.test(h)) return false;
  if (IG_SKIP.has(h.toLowerCase())) return false;
  const last = h.split('.').pop()?.toLowerCase() || '';
  if (TLDS.has(last)) return false;
  if (h.includes('@') || h.includes(' ')) return false;
  return true;
}

// ── Firecrawl FB about scrape → find IG handle ───────────────────────────────
async function scrapeFbAboutForIg(fbPageUrl) {
  if (!fbPageUrl || !fbPageUrl.includes('facebook.com')) return null;
  try {
    const aboutUrl = fbPageUrl.replace(/\/?$/, '/about');
    const { stdout } = await execFileAsync('firecrawl', ['scrape', '--url', aboutUrl, '--format', 'markdown'], { timeout: 20000 });
    if (!stdout) return null;

    // IG links appear in "Websites and social links" section — look there first
    const wsSection = stdout.match(/[Ww]ebsites? and social links?([\s\S]{0,800})/)?.[1] || stdout;
    for (const m of [...wsSection.matchAll(/instagram\.com\/([a-zA-Z0-9._]{2,30})\/?/g)]) {
      const h = m[1].replace(/\/$/, '');
      if (isValidIgHandle(h)) return h;
    }
    return null;
  } catch (err) {
    console.warn(`    ⚠ Firecrawl error: ${err.message?.slice(0, 60)}`);
    return null;
  }
}

// ── Apify IG Profile Scraper (batch) ─────────────────────────────────────────
async function runIgProfileScraper(handles) {
  if (!handles.length) return [];
  console.log(`\n▶ IG Profile Scraper — ${handles.length} handles (max $0.50)...`);

  const balRes = await fetch(`https://api.apify.com/v2/users/me?token=${APIFY_TOKEN}`);
  const balData = await balRes.json();
  const used      = balData?.data?.monthlyUsage?.totalCostUsd ?? 0;
  const limit     = balData?.data?.plan?.monthlyUsageCreditsUsd ?? 0;
  const remaining = limit - used;
  console.log(`  💰 Apify balance: $${remaining.toFixed(3)} remaining`);
  if (remaining < 0.50) throw new Error(`Balance too low ($${remaining.toFixed(2)}) — need at least $0.50`);

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${IG_PROFILE_ACTOR}/runs?token=${APIFY_TOKEN}&maxItems=${handles.length}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: handles, maxTotalChargeUsd: 0.50 }) }
  );
  const runData = await runRes.json();
  if (runData.error) throw new Error(`Actor start failed: ${runData.error.message}`);
  const { id: runId, defaultDatasetId: datasetId } = runData.data;
  console.log(`  Run: ${runId} | Dataset: ${datasetId}`);

  let status = 'RUNNING';
  for (let i = 0; i < 60; i++) {
    await sleep(10000);
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    status = (await s.json()).data?.status;
    process.stdout.write(`\r  ${status} (${(i + 1) * 10}s)...`);
    if (!['RUNNING', 'READY'].includes(status)) break;
  }
  console.log();
  if (!['SUCCEEDED', 'FINISHED'].includes(status)) {
    console.warn(`  ⚠ Ended: ${status}`);
    return [];
  }

  let items = [], offset = 0;
  while (true) {
    const r = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=200&offset=${offset}`);
    const batch = await r.json();
    const arr = Array.isArray(batch) ? batch : (batch.items || []);
    items = items.concat(arr);
    if (arr.length < 200) break;
    offset += arr.length;
  }
  console.log(`  ✓ ${items.length} profiles returned`);
  return items;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SmartFlow — Fix IG handles + delete low-follower leads');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('  Target: enriched leads with followers < 10k or NULL');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Fetch all enriched leads with suspect IG followers
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${SMARTFLOW_ID}&status=eq.enriched` +
    `&or=(instagram_followers.lt.${MIN_FOLLOWERS},instagram_followers.is.null)` +
    `&select=id,company_name,instagram_handle,instagram_followers,intake_data,website` +
    `&order=company_name.asc`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const leads = await res.json();
  if (!Array.isArray(leads)) { console.error('DB error:', leads); process.exit(1); }
  console.log(`📋 ${leads.length} suspect leads loaded\n`);

  // ── Stage 1: Firecrawl FB /about for all with FB URL ─────────────────────────
  console.log('─── Stage 1: Firecrawl FB /about pages ─────────────────────');
  let firecrawlFound = 0, firecrawlSkipped = 0, firecrawlFailed = 0;

  for (const lead of leads) {
    const fbUrl = lead.intake_data?.facebook_page_url;
    if (!fbUrl) {
      console.log(`  — ${lead.company_name}: no FB URL (current: @${lead.instagram_handle || '—'})`);
      firecrawlSkipped++;
      continue;
    }

    process.stdout.write(`  Scraping ${lead.company_name} (${fbUrl.split('/').pop() || fbUrl.slice(-20)})... `);
    const igHandle = await scrapeFbAboutForIg(fbUrl);

    if (igHandle) {
      const isNew = igHandle !== lead.instagram_handle;
      console.log(`@${igHandle}${isNew ? ' ← NEW' : ' (same)'}`);
      lead._firecrawlIg = igHandle;
      if (isNew) firecrawlFound++;
    } else {
      console.log(`not found (was: @${lead.instagram_handle || '—'})`);
      firecrawlFailed++;
    }
    await sleep(300);
  }

  console.log(`\n  Firecrawl results: ${firecrawlFound} new handles, ${firecrawlFailed} not found, ${firecrawlSkipped} no FB URL\n`);

  // ── Stage 2: Patch corrected IG handles into DB ───────────────────────────────
  if (!isDryRun) {
    console.log('─── Stage 2: Patch corrected handles into DB ────────────────');
    for (const lead of leads) {
      if (!lead._firecrawlIg || lead._firecrawlIg === lead.instagram_handle) continue;
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
        body: JSON.stringify({ instagram_handle: lead._firecrawlIg }),
      });
      if (patchRes.ok) {
        console.log(`  ✓ ${lead.company_name}: @${lead.instagram_handle || '—'} → @${lead._firecrawlIg}`);
        lead.instagram_handle = lead._firecrawlIg; // update in-memory
      } else {
        console.error(`  ✗ ${lead.company_name}: ${(await patchRes.text()).slice(0, 80)}`);
      }
    }
    console.log();
  }

  // ── Stage 3: Batch IG Profile Scraper ────────────────────────────────────────
  // Use firecrawl-corrected handle if found, else existing handle, skip those with no handle
  const handleMap = new Map(); // handle → lead[]
  for (const lead of leads) {
    const h = lead._firecrawlIg || lead.instagram_handle;
    if (h && isValidIgHandle(h)) {
      if (!handleMap.has(h.toLowerCase())) handleMap.set(h.toLowerCase(), []);
      handleMap.get(h.toLowerCase()).push(lead);
      lead._handleToScrape = h;
    }
  }
  const uniqueHandles = [...handleMap.keys()];

  console.log(`─── Stage 3: IG Profile Scraper (${uniqueHandles.length} handles) ─────────`);
  let profiles = [];
  if (!isDryRun && uniqueHandles.length) {
    try {
      profiles = await runIgProfileScraper(uniqueHandles);
    } catch (err) {
      console.warn(`  ⚠ IG scraper failed: ${err.message} — cannot verify followers, aborting deletion`);
      return;
    }
  } else if (isDryRun) {
    console.log(`  [DRY RUN] Would scrape: ${uniqueHandles.join(', ')}`);
  }

  const profileByHandle = new Map(profiles.map(p => [p.username?.toLowerCase(), p]));

  // Assign profile data to leads
  for (const lead of leads) {
    const h = lead._handleToScrape?.toLowerCase();
    if (!h) continue;
    const profile = profileByHandle.get(h);
    if (profile) {
      lead._confirmedFollowers = profile.followersCount ?? 0;
      lead._profileFound = true;
      console.log(`  @${h}: ${(lead._confirmedFollowers / 1000).toFixed(1)}k followers`);
    } else {
      lead._profileFound = false;
      console.log(`  @${h}: not found on Instagram (account may be private/deleted)`);
    }
  }

  // ── Stage 4: Update followers in DB ──────────────────────────────────────────
  if (!isDryRun && profiles.length) {
    console.log('\n─── Stage 4: Update follower counts in DB ───────────────────');
    for (const lead of leads) {
      if (lead._confirmedFollowers == null) continue;
      const patch = {
        instagram_followers: lead._confirmedFollowers,
        intake_data: {
          ...(lead.intake_data || {}),
          enrichment: {
            ...(lead.intake_data?.enrichment || {}),
            instagram_profile: {
              ...(lead.intake_data?.enrichment?.instagram_profile || {}),
              followers: lead._confirmedFollowers,
              verified_at: new Date().toISOString(),
            },
          },
        },
      };
      const r = await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      });
      if (r.ok) {
        console.log(`  ✓ ${lead.company_name} → ${(lead._confirmedFollowers / 1000).toFixed(1)}k followers`);
      } else {
        console.error(`  ✗ ${lead.company_name}: ${(await r.text()).slice(0, 80)}`);
      }
    }
  }

  // ── Stage 5: Delete leads with confirmed < 10k followers ─────────────────────
  console.log('\n─── Stage 5: Deletion audit ─────────────────────────────────');

  const toDelete = [];
  const toKeep   = [];

  for (const lead of leads) {
    if (lead._confirmedFollowers != null) {
      // We have a confirmed follower count
      if (lead._confirmedFollowers < MIN_FOLLOWERS) {
        toDelete.push({ lead, reason: `confirmed ${(lead._confirmedFollowers / 1000).toFixed(1)}k followers` });
      } else {
        toKeep.push({ lead, reason: `✓ ${(lead._confirmedFollowers / 1000).toFixed(1)}k followers` });
      }
    } else if (lead._profileFound === false) {
      // Handle exists but IG profile not found (private/deleted account)
      toDelete.push({ lead, reason: `IG account @${lead._handleToScrape} not found (private/deleted)` });
    } else {
      // No handle at all — keep (may have good email)
      toKeep.push({ lead, reason: 'no IG handle (kept — check email quality manually)' });
    }
  }

  console.log(`\n  KEEP  (${toKeep.length}):`);
  for (const { lead, reason } of toKeep) {
    console.log(`    ${lead.company_name.padEnd(35)} ${reason}`);
  }
  console.log(`\n  DELETE (${toDelete.length}):`);
  for (const { lead, reason } of toDelete) {
    console.log(`    ${lead.company_name.padEnd(35)} ${reason}`);
  }

  if (isDryRun) {
    console.log('\n[DRY RUN] No deletions performed.');
    return;
  }

  if (!toDelete.length) {
    console.log('\n  Nothing to delete.');
    return;
  }

  console.log(`\n  Deleting ${toDelete.length} leads...`);
  let deleted = 0, failedDeletes = 0;
  for (const { lead } of toDelete) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${lead.id}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (r.ok) {
      console.log(`  ✓ DELETED: ${lead.company_name}`);
      deleted++;
    } else {
      console.error(`  ✗ DELETE failed: ${lead.company_name}: ${(await r.text()).slice(0, 80)}`);
      failedDeletes++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Handles corrected  : ${firecrawlFound}`);
  console.log(`  Profiles verified  : ${profiles.length}`);
  console.log(`  Leads deleted      : ${deleted}`);
  console.log(`  Leads kept         : ${toKeep.length}`);
  if (failedDeletes) console.log(`  Delete failures    : ${failedDeletes}`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
