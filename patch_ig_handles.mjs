/**
 * Patch IG handles for the 18 test leads already in DB.
 * Uses raw HTML fetch (not Firecrawl) to find instagram.com/<handle> in href attributes.
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

const TLDS    = new Set(['com','rs','eu','net','org','io','co','biz','info','hr','ba','si','me','de','fr','uk','it','png','jpg','svg','gif','webp','pdf']);
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
  const SKIP = new Set(['p','reel','explore','accounts','stories','tv','reels','direct','sharedData','share']);

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
        if (!SKIP.has(handle) && isValidIgHandle(handle)) return handle;
      }
    } catch { /* try next url */ }
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Fetch the 18 test leads (izvor = meta_ads_scrape, client = SmartFlow)
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?select=id,company_name,website,instagram_handle&client_id=eq.${SMARTFLOW_ID}&izvor=eq.meta_ads_scrape&limit=50`,
    { headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` } }
  );
  const leads = await res.json();
  console.log(`\nPatching IG handles for ${leads.length} leads...\n`);

  let found = 0, alreadyGood = 0, missing = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const domain = lead.website?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    if (!domain) {
      console.log(`[${i+1}/${leads.length}] ${lead.company_name} — no website, skip`);
      missing++;
      continue;
    }

    process.stdout.write(`[${i+1}/${leads.length}] ${lead.company_name} (${domain})... `);
    const igHandle = await findIgOnWebsite(domain);

    if (igHandle) {
      // Patch the DB record
      const patch = await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${lead.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ instagram_handle: igHandle }),
      });
      if (patch.ok || patch.status === 204) {
        console.log(`@${igHandle} ✓`);
        found++;
      } else {
        const err = await patch.text();
        console.log(`@${igHandle} — DB error: ${err.slice(0,80)}`);
      }
    } else {
      const prev = lead.instagram_handle;
      console.log(prev ? `not found (was: ${prev})` : 'not found');
      missing++;
    }

    await sleep(300);
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log(`  Found & patched : ${found}`);
  console.log(`  Not found       : ${missing}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
