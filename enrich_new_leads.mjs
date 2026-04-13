/**
 * 1. Remove duplicate leads (same company_name, keep the newer/better one)
 * 2. For each lead missing IG: scrape website (homepage + /kontakt + /o-nama + /contact)
 * 3. For each lead missing email: Hunter.io + contact page email scrape
 * 4. PATCH DB records with whatever we find
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
  const urls = [
    `https://${domain}`,
    `https://www.${domain}`,
    `https://${domain}/kontakt`,
    `https://${domain}/o-nama`,
    `https://${domain}/contact`,
    `https://${domain}/about`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000),
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

async function findEmailOnWebsite(domain) {
  const urls = [
    `https://${domain}/kontakt`,
    `https://${domain}/contact`,
    `https://${domain}/o-nama`,
    `https://${domain}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const html = await res.text();
      const m = html.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (m && !m[1].includes('example.') && !m[1].includes('sentry.') && !m[1].includes('wix') && !m[1].includes('schema')) {
        return m[1];
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
    return best.value;
  } catch { return null; }
}

async function patch(id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  return res.ok || res.status === 204;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Fetch all meta_ads_scrape leads from today
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?select=id,company_name,website,email,instagram_handle,created_at&client_id=eq.${SMARTFLOW_ID}&izvor=eq.meta_ads_scrape&created_at=gte.2026-04-02T00:00:00Z&order=created_at.desc`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const all = await res.json();
  console.log(`Fetched ${all.length} leads from today\n`);

  // Step 1: deduplicate by company_name — keep newest (already first due to order=desc), delete older dupes
  const seen = new Map();
  const toDelete = [];
  for (const lead of all) {
    const key = lead.company_name.trim().toLowerCase();
    if (seen.has(key)) {
      toDelete.push(lead.id); // older duplicate
    } else {
      seen.set(key, lead);
    }
  }

  if (toDelete.length) {
    console.log(`Removing ${toDelete.length} duplicate(s)...`);
    for (const id of toDelete) {
      await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${id}`, {
        method: 'DELETE',
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
    }
    console.log(`Done\n`);
  }

  const leads = [...seen.values()];
  console.log(`${leads.length} unique leads to enrich\n`);

  let igFound = 0, emailFound = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const domain = lead.website?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    const needIG    = !lead.instagram_handle;
    const needEmail = !lead.email;

    if (!needIG && !needEmail) {
      console.log(`[${i+1}/${leads.length}] ${lead.company_name} — already complete ✓`);
      continue;
    }

    const missing = [needEmail && '❌ email', needIG && '❌ IG'].filter(Boolean).join(' ');
    console.log(`[${i+1}/${leads.length}] ${lead.company_name} (${missing})`);

    let ig = null;
    let email = null;

    if (domain) {
      if (needIG) {
        process.stdout.write(`  IG scrape... `);
        ig = await findIgOnWebsite(domain);
        console.log(ig ? `@${ig}` : 'not found');
      }

      if (needEmail) {
        process.stdout.write(`  Hunter... `);
        email = await hunterDomain(domain);
        if (email) {
          console.log(email);
        } else {
          process.stdout.write(`not found → website scrape... `);
          email = await findEmailOnWebsite(domain);
          console.log(email || 'not found');
        }
      }
    } else {
      console.log(`  No website — skipping enrichment`);
    }

    // PATCH if we found anything
    const update = {};
    if (ig) { update.instagram_handle = ig; igFound++; }
    if (email) {
      update.email = email;
      update.status = 'enriched';
      update.sledeca_akcija = 'Generisati email draft i poslati';
      emailFound++;
    }

    if (Object.keys(update).length) {
      await patch(lead.id, update);
      console.log(`  → patched DB ✓`);
    }

    await sleep(400);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  IG handles found    : ${igFound}`);
  console.log(`  Emails found        : ${emailFound}`);
  console.log(`  Duplicates removed  : ${toDelete.length}`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
