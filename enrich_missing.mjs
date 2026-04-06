/**
 * Targeted enrichment for enriched leads missing email/IG handle.
 *
 * Phase 1: Extract directly from existing intake_data (ad copies, etc.)
 * Phase 2: Scan business websites for instagram.com/<handle> links (free, no API)
 * Phase 3: Hunter.io domain search for emails
 * Phase 4: Apify IG Profile for confirmed handles still missing profile data
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.trim() && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);

const SUPABASE_URL  = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NzQ4MSwiZXhwIjoyMDg2MDczNDgxfQ.6PsYNOzdZeqpWXW3Pej_oLK5fV2MLDi34-SGkHHje2k';
const HUNTER_KEY    = 'b18a1b18f913bb7907bff359ec0b8065f58eecfa';
const APIFY_TOKEN   = 'process.env.APIFY_TOKEN';
const IG_PROFILE_ACTOR = 'dSCLg0C3YEZ83HzYX';
const CLIENT_ID     = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function extractDomain(website) {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, '');
  } catch { return null; }
}

// Scan business website HTML for instagram.com/<handle> links
async function findIgOnWebsite(url) {
  if (!url) return null;
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;
  try {
    const res = await fetch(fullUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SmartFlow/1.0)' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const html = await res.text();
    const SKIP = new Set(['p', 'reel', 'explore', 'accounts', 'stories', 'tv', 'reels', 'direct', 'sharedData']);
    const matches = [...html.matchAll(/instagram\.com\/([a-zA-Z0-9._]{2,30})\/?["'\s>]/g)];
    for (const m of matches) {
      const handle = m[1];
      if (!SKIP.has(handle) && !/^\d+$/.test(handle)) return handle;
    }
    return null;
  } catch { return null; }
}

// Hunter.io domain search — returns best contact
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
      const aScore = aR === -1 ? 99 : aR;
      const bScore = bR === -1 ? 99 : bR;
      if (aScore !== bScore) return aScore - bScore;
      return (b.confidence || 0) - (a.confidence || 0);
    });
    const best = sorted[0];
    if (!best?.value) return null;
    return {
      email: best.value,
      name: [best.first_name, best.last_name].filter(Boolean).join(' ') || null,
      title: best.position || null,
      source: 'hunter',
    };
  } catch { return null; }
}

// Firecrawl scrape for email
async function firecrawlEmail(url) {
  if (!url || url.includes('instagram.com')) return null;
  const base = url.replace(/\/$/, '');
  const pages = [base, `${base}/kontakt`, `${base}/contact`, `${base}/o-nama`, `${base}/pages/contact`];
  const EMAIL_RE = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  const BAD = ['sentry', 'example', 'domain.com', 'wix', 'shopify', 'noreply', 'no-reply', '.png', '.jpg'];

  for (const pageUrl of pages) {
    try {
      const { stdout } = await execFileAsync('firecrawl', [
        'scrape', '--url', pageUrl, '--format', 'markdown', '--only-main-content',
      ], { timeout: 15000 });
      const emails = (stdout.match(EMAIL_RE) || []).filter(e => !BAD.some(b => e.toLowerCase().includes(b)) && e.length < 60);
      if (emails.length) return emails[0].toLowerCase();
    } catch { /* try next */ }
  }
  return null;
}

// Apify balance guard
async function checkApifyBalance() {
  const res = await fetch(`https://api.apify.com/v2/users/me?token=${APIFY_TOKEN}`);
  const data = await res.json();
  const plan = data?.data?.plan || {};
  const used = data?.data?.monthlyUsage?.totalCostUsd ?? 0;
  const limit = plan.monthlyUsageCreditsUsd ?? 0;
  const remaining = limit - used;
  console.log(`  Apify balance: $${remaining.toFixed(3)} remaining`);
  if (remaining < 0.50) throw new Error(`Apify balance too low ($${remaining.toFixed(3)})`);
  return remaining;
}

async function runApifyIgProfile(handles) {
  if (!handles.length) return [];
  await checkApifyBalance();
  console.log(`\n▶ Apify IG Profile for ${handles.length} handles...`);
  const res = await fetch(
    `https://api.apify.com/v2/acts/${IG_PROFILE_ACTOR}/runs?token=${APIFY_TOKEN}&maxItems=${handles.length * 2}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: handles,
        maxTotalChargeUsd: 0.30,
      }),
    }
  );
  const data = await res.json();
  if (data.error) { console.warn('Apify error:', data.error.message); return []; }

  const runId = data.data.id;
  const datasetId = data.data.defaultDatasetId;
  let status = 'RUNNING';
  for (let i = 0; i < 30; i++) {
    await sleep(8000);
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    status = (await s.json()).data?.status;
    process.stdout.write(`\r  ${status} (${(i+1)*8}s)...`);
    if (!['RUNNING', 'READY'].includes(status)) break;
  }
  console.log();
  if (status !== 'SUCCEEDED') { console.warn('  Apify ended:', status); return []; }

  const r = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=200`);
  const items = await r.json();
  console.log(`  ✓ ${items.length} profiles fetched`);
  return Array.isArray(items) ? items : [];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const { data: leads, error } = await supabase
  .from('kontakti')
  .select('id, company_name, email, instagram_handle, website, izvor, intake_data')
  .eq('client_id', CLIENT_ID)
  .eq('status', 'enriched');

if (error) { console.error(error.message); process.exit(1); }

const noEmail = leads.filter(l => !l.email);
const noIG    = leads.filter(l => !l.instagram_handle);

console.log(`\nEnriched leads total: ${leads.length}`);
console.log(`No email: ${noEmail.length} | No IG: ${noIG.length}\n`);

// ─── Phase 1: Extract directly from intake_data ───────────────────────────────
console.log('=== Phase 1: Extract from existing data ===');

// Solar Medical: email and IG in ad copy @mentions
const smc = leads.find(l => l.company_name?.toLowerCase().includes('solar medical'));
if (smc && (!smc.email || !smc.instagram_handle)) {
  const adText = (smc.intake_data?.ad_copies || []).join(' ');
  const emails = adText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
  const atHandles = [...new Set(adText.match(/@([a-zA-Z0-9._]{3,30})/g) || [])].map(h => h.slice(1));
  const email = emails?.find(e => !e.includes('example') && !e.includes('domain.com'));
  const igHandle = atHandles.find(h => h.includes('solar') || h.length > 5);

  const updates = {};
  if (email && !smc.email) updates.email = email.toLowerCase();
  if (igHandle && !smc.instagram_handle) updates.instagram_handle = igHandle;

  if (Object.keys(updates).length) {
    await supabase.from('kontakti').update(updates).eq('id', smc.id);
    console.log(`  ✓ Solar Medical: ${JSON.stringify(updates)}`);
  }
}

// Any meta_ads lead with email visible in ad copy but not yet saved
for (const lead of leads.filter(l => !l.email && l.izvor === 'meta_ads_scrape')) {
  const adText = (lead.intake_data?.ad_copies || []).join(' ');
  const emails = adText.match(/\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g);
  const email = emails?.find(e => !e.includes('domain.com') && !e.includes('example'));
  if (email) {
    await supabase.from('kontakti').update({ email: email.toLowerCase() }).eq('id', lead.id);
    console.log(`  ✓ ${lead.company_name}: email=${email} (from ad copy)`);
  }
}

// ─── Phase 2: Scan websites for IG handles ───────────────────────────────────
console.log('\n=== Phase 2: Scan websites for IG handles ===');

const noIGWithWebsite = leads.filter(l =>
  !l.instagram_handle &&
  l.website &&
  !l.website.includes('instagram.com') &&
  !l.website.includes('facebook.com') &&
  !l.website.includes('wa.me') &&
  !l.website.includes('tinyurl.com') &&
  !l.website.includes('temu.com')
);

console.log(`  Checking ${noIGWithWebsite.length} leads with real websites...`);

for (const lead of noIGWithWebsite) {
  process.stdout.write(`  ${lead.company_name}... `);
  const handle = await findIgOnWebsite(lead.website);
  if (handle) {
    await supabase.from('kontakti').update({ instagram_handle: handle }).eq('id', lead.id);
    console.log(`@${handle} ✓`);
    // Update local copy so Apify phase sees it
    lead.instagram_handle = handle;
  } else {
    // Try FB page slug as IG handle guess
    const fbSlug = lead.intake_data?.facebook_page_url?.match(/facebook\.com\/([^/?#]+)\/?$/)?.[1];
    if (fbSlug && !/^\d+$/.test(fbSlug) && fbSlug.length > 3) {
      console.log(`no IG on site | trying FB slug: ${fbSlug}`);
      // Will verify via Apify in Phase 4
      lead._fb_slug_guess = fbSlug.toLowerCase();
    } else {
      console.log('no IG found');
    }
  }
}

// ─── Phase 3: Hunter.io for all real domains ─────────────────────────────────
console.log('\n=== Phase 3: Hunter.io domain search ===');

// Refresh leads after Phase 1 updates
const { data: leadsNow } = await supabase
  .from('kontakti')
  .select('id, company_name, email, instagram_handle, website, izvor, intake_data')
  .eq('client_id', CLIENT_ID)
  .eq('status', 'enriched')
  .is('email', null);

const toHunt = (leadsNow || []).filter(l => {
  const w = l.website;
  if (!w) return false;
  const bad = ['instagram.com', 'facebook.com', 'wa.me', 'tinyurl.com', 'temu.com', 'alteg.io'];
  return !bad.some(b => w.includes(b));
});

console.log(`  Running Hunter for ${toHunt.length} leads...`);

for (const lead of toHunt) {
  const domain = extractDomain(lead.website);
  if (!domain) continue;
  process.stdout.write(`  ${lead.company_name} (${domain})... `);
  const result = await hunterDomain(domain);
  if (result) {
    const enrichmentUpdate = {
      ...(lead.intake_data || {}),
      enrichment: {
        ...(lead.intake_data?.enrichment || {}),
        contact: { email: result.email, name: result.name, title: result.title, source: 'hunter' },
        decision_maker: { email: result.email, source: 'hunter' },
      }
    };
    await supabase.from('kontakti').update({
      email: result.email,
      intake_data: enrichmentUpdate,
    }).eq('id', lead.id);
    console.log(`${result.email} (${result.name || 'no name'}) ✓`);
  } else {
    console.log('not in Hunter');
  }
  await sleep(300); // rate limit
}

// ─── Phase 3b: Firecrawl for still-missing emails ────────────────────────────
console.log('\n=== Phase 3b: Firecrawl contact pages ===');

const { data: stillNoEmail } = await supabase
  .from('kontakti')
  .select('id, company_name, email, website')
  .eq('client_id', CLIENT_ID)
  .eq('status', 'enriched')
  .is('email', null);

const firecrawlTargets = (stillNoEmail || []).filter(l => {
  const w = l.website;
  if (!w) return false;
  const bad = ['instagram.com', 'facebook.com', 'wa.me', 'tinyurl.com', 'temu.com', 'alteg.io'];
  return !bad.some(b => w.includes(b));
});

console.log(`  Firecrawl scraping ${firecrawlTargets.length} leads...`);
for (const lead of firecrawlTargets) {
  process.stdout.write(`  ${lead.company_name}... `);
  const email = await firecrawlEmail(lead.website);
  if (email) {
    await supabase.from('kontakti').update({ email }).eq('id', lead.id);
    console.log(`${email} ✓`);
  } else {
    console.log('no email');
  }
}

// ─── Phase 4: Apify IG Profile for unverified handles ────────────────────────
console.log('\n=== Phase 4: Apify IG Profile ===');

// Get leads that now have an IG handle but no followers/profile data
const { data: allEnriched } = await supabase
  .from('kontakti')
  .select('id, company_name, instagram_handle, intake_data')
  .eq('client_id', CLIENT_ID)
  .eq('status', 'enriched')
  .not('instagram_handle', 'is', null);

// Leads without instagram_profile in enrichment (unverified handles)
const noProfile = (allEnriched || []).filter(l =>
  l.instagram_handle &&
  !l.intake_data?.enrichment?.instagram_profile?.username &&
  !l.intake_data?.enrichment?.instagram_profile?.followers
);

// Add FB slug guesses from Phase 2
const fbSlugs = noIGWithWebsite
  .filter(l => l._fb_slug_guess && !l.instagram_handle)
  .map(l => ({ lead: l, handle: l._fb_slug_guess }));

const handlesToFetch = [
  ...noProfile.map(l => ({ lead: l, handle: l.instagram_handle })),
  ...fbSlugs,
];

console.log(`  ${noProfile.length} handles need profile data | ${fbSlugs.length} FB slug guesses to verify`);

if (handlesToFetch.length > 0) {
  const uniqueHandles = [...new Set(handlesToFetch.map(x => x.handle))];
  let profiles = [];
  try {
    profiles = await runApifyIgProfile(uniqueHandles);
  } catch (e) {
    console.warn('  Apify skipped:', e.message);
  }

  // Map handle → profile
  const profileMap = {};
  for (const p of profiles) {
    const username = p.username || p.handle;
    if (username) profileMap[username.toLowerCase()] = p;
  }

  for (const { lead, handle } of handlesToFetch) {
    const profile = profileMap[handle.toLowerCase()];
    if (!profile) {
      console.log(`  ${lead.company_name} (@${handle}): not found on IG`);
      // If this was a FB slug guess and Apify didn't find it, clear
      if (lead._fb_slug_guess && !lead.instagram_handle) {
        console.log(`    → FB slug ${handle} not valid IG handle, skipping`);
      }
      continue;
    }

    const followers = profile.followersCount || profile.followers || 0;
    const bio = profile.biography || profile.bio || '';
    const businessEmail = profile.businessEmail || null;
    const externalUrl = profile.externalUrl || profile.external_url || null;

    const igProfileData = {
      username: profile.username,
      url: `https://www.instagram.com/${profile.username}/`,
      bio,
      followers,
      following: profile.followingCount || 0,
      posts_count: profile.postsCount || 0,
      is_verified: profile.verified || false,
      external_url: externalUrl,
      business_email: businessEmail,
      business_category: profile.businessCategoryName || null,
    };

    const updates = {
      intake_data: {
        ...(lead.intake_data || {}),
        enrichment: {
          ...(lead.intake_data?.enrichment || {}),
          instagram_profile: igProfileData,
        }
      }
    };

    // If this was a FB slug guess, confirm the IG handle
    if (lead._fb_slug_guess && !lead.instagram_handle) {
      updates.instagram_handle = profile.username;
    }

    // If IG profile has a business email, use it
    if (businessEmail && !lead.email) {
      updates.email = businessEmail.toLowerCase();
    }

    // If IG profile has external URL and lead has no real website
    if (externalUrl && (!lead.website || lead.website.includes('instagram.com'))) {
      updates.website = externalUrl;
    }

    await supabase.from('kontakti').update(updates).eq('id', lead.id);
    console.log(`  ✓ @${profile.username} | ${followers} followers${businessEmail ? ` | email: ${businessEmail}` : ''}`);
  }
}

// ─── Final summary ────────────────────────────────────────────────────────────
console.log('\n=== Final State ===');
const { data: final } = await supabase
  .from('kontakti')
  .select('id, company_name, email, instagram_handle')
  .eq('client_id', CLIENT_ID)
  .eq('status', 'enriched');

const withEmail = final.filter(l => l.email).length;
const withIG = final.filter(l => l.instagram_handle).length;
console.log(`Total enriched: ${final.length}`);
console.log(`With email: ${withEmail} / ${final.length}`);
console.log(`With IG handle: ${withIG} / ${final.length}`);
