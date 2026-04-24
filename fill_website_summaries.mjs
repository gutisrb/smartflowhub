/**
 * Fill website_summary for enriched leads missing IG bio.
 * Uses Jina.ai reader (r.jina.ai) — free, no API key required.
 * Saves result to intake_data.enrichment.website_summary in DB.
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const isDryRun     = process.argv.includes('--dry-run');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isJunkUrl(url) {
  if (!url) return true;
  return ['facebook.com', 'instagram.com', 'maps.app.goo', 'whatsapp.com', 'wa.me', 'youtube.com', 't.me'].some(s => url.includes(s));
}

async function fetchJinaSummary(url) {
  const jinaUrl = `https://r.jina.ai/${url}`;
  try {
    const res = await fetch(jinaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Strip Jina header lines (Title:, URL:, Markdown Content:)
    const content = text.replace(/^(Title:|URL:|Markdown Content:|={3,})[^\n]*\n/gm, '').trim();
    // Take first meaningful 600 chars
    const snippet = content.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').slice(0, 600).trim();
    return snippet || null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Website Summary Filler — Jina.ai reader');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${SMARTFLOW_ID}&status=eq.enriched&select=id,company_name,instagram_handle,website,intake_data&limit=100`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const leads = await res.json();
  if (!Array.isArray(leads)) { console.error('DB error:', leads); process.exit(1); }

  // Only process leads missing IG bio
  const targets = leads.filter(l => {
    const bio = l.intake_data?.enrichment?.instagram_profile?.bio;
    const existingSummary = l.intake_data?.enrichment?.website_summary;
    const hasUsableWebsite = l.website && !isJunkUrl(l.website);
    return !bio && !existingSummary && hasUsableWebsite;
  });

  console.log(`Leads missing bio: ${targets.length}/${leads.length}\n`);

  let filled = 0, failed = 0;

  for (const lead of targets) {
    const name = (lead.company_name || lead.instagram_handle || '').slice(0, 40);
    console.log(`▶ ${name}`);
    console.log(`  Website: ${lead.website}`);

    const summary = await fetchJinaSummary(lead.website);
    if (!summary) {
      console.log(`  ✗ No content from Jina\n`);
      failed++;
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

    await sleep(300);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Filled : ${filled}`);
  console.log(`  Failed : ${failed}`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
