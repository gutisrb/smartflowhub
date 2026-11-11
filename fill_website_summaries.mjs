/**
 * Fill website_summary for enriched leads missing IG bio.
 *
 * Was Jina.ai reader (r.jina.ai) — free, no API key. Switched to Firecrawl on 2026-09-11
 * after it hit a wall running unattended inside run_pipeline.mjs: Cloudflare rate-limits
 * r.jina.ai on burst traffic, and even a 2.5s pace + one retry (added 2026-09-08) still
 * failed all 46/46 leads in a real run. Firecrawl is what the rest of this pipeline
 * already pays for and relies on for every other scrape — using a free, unreliable
 * scraper for just this one step was the actual bug, not the pacing.
 *
 * Saves result to intake_data.enrichment.website_summary in DB.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

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
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const isDryRun     = process.argv.includes('--dry-run');
const limitIdx     = process.argv.indexOf('--limit');
const LIMIT        = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : Infinity;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isJunkUrl(url) {
  if (!url) return true;
  return ['facebook.com', 'instagram.com', 'maps.app.goo', 'whatsapp.com', 'wa.me', 'youtube.com', 't.me'].some(s => url.includes(s));
}

// Same nav/image/cookie-consent denoise logic as build_demo_tenant.mjs's scrapeWebsite —
// kept in sync deliberately so a page that reads clean there reads clean here too.
const CONSENT_BANNER_LINE = /upravljanje saglasnostima|tehničko skladištenje ili pristup|prihvatam.*odbijam|cmplz-|cookie-policy|cookiedatabase\.org|korisničko iskustvo, koristimo tehnologije/i;
const PRICE_SIGNAL = /\d[\d.,]{2,}\s?(?:rsd\b|din\b|eur\b|€)|(?:\brsd\b|\bdin\b|\beur\b|€)\s?[\d.,]{2,}/i;

function denoise(md) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .split('\n')
    .filter((line) => {
      const t = line.trim().replace(/^[-*]\s*/, '');
      if (!t) return false;
      if (/^\[[^\]]*\]\([^)]*\)$/.test(t) && !PRICE_SIGNAL.test(t)) return false;
      if (/^https?:\/\/\S+$/.test(t)) return false;
      if (CONSENT_BANNER_LINE.test(t)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchFirecrawlSummary(url) {
  const base = url.startsWith('http') ? url : `https://${url}`;
  try {
    const { stdout } = await execFileAsync('firecrawl', [
      'scrape', '--url', base, '--format', 'markdown',
      '--only-main-content', '--exclude-tags', 'nav,header,footer,aside',
    ], { timeout: 25000, env: { ...process.env, FIRECRAWL_API_KEY: FIRECRAWL_KEY }, maxBuffer: 5 * 1024 * 1024 });
    if (!stdout?.trim()) return null;
    const content = denoise(stdout);
    const snippet = content.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').slice(0, 600).trim();
    return snippet || null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Website Summary Filler — Firecrawl');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!FIRECRAWL_KEY) { console.error('✗ FIRECRAWL_API_KEY not set'); process.exit(1); }

  const res = await fetch(
    // 'enriched_no_context' is generate_drafts.mjs's own dead-end for a lead that reached
    // it with no website_summary/ad_copies/reels — without also matching that status here,
    // those leads never get a second chance even after this script fills their context in.
    `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${SMARTFLOW_ID}&status=in.(enriched,enriched_no_context)&select=id,company_name,instagram_handle,website,intake_data,status&limit=100`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const leads = await res.json();
  if (!Array.isArray(leads)) { console.error('DB error:', leads); process.exit(1); }

  // Only process leads missing a website_summary. Used to also require a missing IG bio,
  // but generate_drafts.mjs's hasContext check (ad_copies / instagram_reels / website_summary)
  // never looks at bio at all — that condition was silently excluding every lead that HAD a
  // bio but no summary (Varmus, Barcino Tours, LOGERA, JetSet all sat stuck on
  // 'enriched_no_context' this way, invisible to this script despite being exactly the
  // leads it exists to unblock).
  const allTargets = leads.filter(l => {
    const existingSummary = l.intake_data?.enrichment?.website_summary;
    const hasUsableWebsite = l.website && !isJunkUrl(l.website);
    return !existingSummary && hasUsableWebsite;
  });
  // Each lead can take up to ~25s (Firecrawl timeout) + sleep — an uncapped run against a
  // large backlog can run well past a caller's own process timeout (run_pipeline.mjs found
  // this the hard way: 46 leads with several failures ran past a 280s timeout mid-batch).
  const targets = allTargets.slice(0, LIMIT);

  console.log(`Leads missing bio: ${targets.length}/${allTargets.length} targeted (${leads.length} total)\n`);

  let filled = 0, failed = 0;

  for (const lead of targets) {
    const name = (lead.company_name || lead.instagram_handle || '').slice(0, 40);
    console.log(`▶ ${name}`);
    console.log(`  Website: ${lead.website}`);

    const summary = await fetchFirecrawlSummary(lead.website);
    if (!summary) {
      console.log(`  ✗ No content from Firecrawl\n`);
      failed++;
      await sleep(1500);
      continue;
    }

    console.log(`  ✓ Summary: ${summary.slice(0, 120)}...\n`);

    if (!isDryRun) {
      const currentIntake = lead.intake_data || {};
      const enrichment = currentIntake.enrichment || {};
      const patch = {
        intake_data: {
          ...currentIntake,
          enrichment: {
            ...enrichment,
            website_summary: summary,
          },
        },
      };
      // A lead stuck on 'enriched_no_context' (generate_drafts.mjs's dead-end for missing
      // context) needs its status reset too, or filling the summary in here is invisible —
      // generate_drafts.mjs's own queue query doesn't include that status at all.
      if (lead.status === 'enriched_no_context') patch.status = 'enriched';

      await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${lead.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(patch),
      });
      filled++;
    }

    await sleep(1500); // Firecrawl's own per-minute rate limit — stay well under it
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Filled : ${filled}`);
  console.log(`  Failed : ${failed}`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
