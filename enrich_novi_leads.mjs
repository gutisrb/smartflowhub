/**
 * Enrich SmartFlow contacts that are missing IG handle or email.
 *   1. Find website (FB about scrape if missing)
 *   2. Find IG handle (website HTML → FB about → FB page slug)
 *   3. Batch IG Profile Scraper — followers, bio, business email (NO reels)
 *   4. Find decision-maker email (Hunter → website scrape → IG bio)
 *   5. PATCH contact record in DB
 *
 * Usage:
 *   node enrich_novi_leads.mjs                        — enriches "Novi Lead" status
 *   node enrich_novi_leads.mjs --status enriched      — enriches "enriched" status (skips complete leads)
 *   node enrich_novi_leads.mjs --status enriched --dry-run
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
const SUPABASE_URL     = 'https://ndazbdkytcksmhoabtgs.supabase.co';
const SERVICE_KEY      = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NzQ4MSwiZXhwIjoyMDg2MDczNDgxfQ.6PsYNOzdZeqpWXW3Pej_oLK5fV2MLDi34-SGkHHje2k';
const SMARTFLOW_ID     = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const HUNTER_KEY       = '2814e367457bf09b2e06e154352f8c822932bb6b';

const isDryRun   = process.argv.includes('--dry-run');
const statusIdx  = process.argv.indexOf('--status');
const TARGET_STATUS = statusIdx !== -1 ? process.argv[statusIdx + 1] : 'Novi Lead';

const TLDS    = new Set(['com','rs','eu','net','org','io','co','biz','info','hr','ba','si','me','de','fr','uk','it','png','jpg','svg','gif','webp','pdf']);
const IG_SKIP = new Set(['p','reel','explore','accounts','stories','tv','reels','direct','sharedData','share','privacy','legal','about','blog','help','press','api','static','cdn']);
const SOCIAL  = new Set(['instagram.com','facebook.com','fb.me','fb.com','m.facebook.com','bit.ly','linktr.ee','linktree.com','youtube.com','tiktok.com','wa.me']);

function isValidIgHandle(h) {
  if (!h || h.length < 2 || h.length > 30) return false;
  if (/^\d+$/.test(h)) return false;
  if (IG_SKIP.has(h.toLowerCase())) return false;
  const last = h.split('.').pop()?.toLowerCase() || '';
  if (TLDS.has(last)) return false;
  if (h.includes('@') || h.includes(' ')) return false;
  return true;
}

function extractDomain(url) {
  if (!url) return null;
  try {
    const h = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    if (h && !SOCIAL.has(h) && !h.includes('facebook') && !h.includes('instagram')
        && !h.includes('google') && !h.includes('whatsapp') && !h.includes('forms.gle')) return h;
  } catch {}
  return null;
}

// ── Raw HTML scrape for IG handle ─────────────────────────────────────────────
async function findIgOnWebsite(domain) {
  for (const url of [`https://${domain}`, `https://www.${domain}`, `https://${domain}/kontakt`, `https://${domain}/o-nama`]) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000), redirect: 'follow',
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

// ── Firecrawl FB about scrape → { website, ig, email } ───────────────────────
async function scrapeFacebookAbout(fbPageUrl) {
  if (!fbPageUrl || !fbPageUrl.includes('facebook.com')) return {};
  try {
    const aboutUrl = fbPageUrl.replace(/\/?$/, '/about');
    const { stdout } = await execFileAsync('firecrawl', ['scrape', '--url', aboutUrl, '--format', 'markdown'], { timeout: 15000 });
    if (!stdout) return {};
    const CDN = /^(scontent|static|lookaside|external|video|z-p|l\.facebook|www\.facebook|instagram\.com|fbcdn\.net)/;
    let website = null;
    const wsSection = stdout.match(/[Ww]ebsites? and social links?([\s\S]{0,600})/)?.[1] || stdout;
    for (const m of [...wsSection.matchAll(/\[?(https?:\/\/[^\s\)\]\"\'\\]+)/g)]) {
      try {
        const u = new URL(m[1]);
        const host = u.hostname.replace(/^www\./, '');
        if (!CDN.test(host) && !SOCIAL.has(host)) { website = host; break; }
      } catch {}
    }
    let ig = null;
    for (const m of [...stdout.matchAll(/instagram\.com\/([a-zA-Z0-9._]{2,30})\/?/g)]) {
      const h = m[1].replace(/\/$/, '');
      if (isValidIgHandle(h)) { ig = h; break; }
    }
    let email = null;
    const em = stdout.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    if (em && !em[1].includes('facebook') && !em[1].includes('sentry') && !em[1].includes('example')) email = em[1];
    return { website, ig, email };
  } catch { return {}; }
}

// ── Hunter.io ─────────────────────────────────────────────────────────────────
async function hunterDomain(domain) {
  try {
    const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${HUNTER_KEY}`);
    if (!res.ok) return null;
    const emails = (await res.json())?.data?.emails || [];
    if (!emails.length) return null;
    const SENIORITY = ['c_suite','vp','director','manager','senior','entry'];
    const DEPTS = ['management','executive','sales','marketing'];
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

async function findEmailOnWebsite(domain) {
  const SKIP = /noreply|no-reply|example|sentry|wix|schema|privacy|jquery|\.(png|jpg|svg|gif)$/i;
  for (const url of [`https://${domain}/kontakt`, `https://${domain}/contact`, `https://${domain}/o-nama`, `https://${domain}`]) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000), redirect: 'follow',
      });
      if (!res.ok) continue;
      const html = await res.text();
      const m = html.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
      if (m && !SKIP.test(m[1])) return m[1];
    } catch {}
  }
  return null;
}

// ── Apify IG Profile Scraper (batch) ─────────────────────────────────────────
async function runIgProfileScraper(handles) {
  if (!handles.length) return [];
  console.log(`\n▶ IG Profile Scraper — ${handles.length} handles (max $0.50)...`);

  const balRes = await fetch(`https://api.apify.com/v2/users/me?token=${APIFY_TOKEN}`);
  const balData = await balRes.json();
  const used = balData?.data?.monthlyUsage?.totalCostUsd ?? 0;
  const limit = balData?.data?.plan?.monthlyUsageCreditsUsd ?? 0;
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
    process.stdout.write(`\r  ${status} (${(i+1)*10}s)...`);
    if (!['RUNNING','READY'].includes(status)) break;
  }
  console.log();
  if (!['SUCCEEDED','FINISHED'].includes(status)) {
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
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  SmartFlow — Enrich "${TARGET_STATUS}" contacts`);
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('  Steps: website → IG handle → IG Profile → email');
  console.log('  Skipping leads that already have both email and IG handle');
  console.log('═══════════════════════════════════════════════════════\n');

  // Fetch contacts with target status, skip those already complete
  const statusEncoded = encodeURIComponent(TARGET_STATUS);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${SMARTFLOW_ID}&status=eq.${statusEncoded}&select=*&order=company_name.asc`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const allLeads = await res.json();

  // Only process leads missing email OR IG handle
  const leads = allLeads.filter(l => {
    const hasEmail = l.email && !/\.(png|jpg|svg)/i.test(l.email);
    const hasIg    = l.instagram_handle && l.instagram_handle !== 'None';
    return !hasEmail || !hasIg;
  });

  console.log(`📋 ${allLeads.length} total "${TARGET_STATUS}" contacts`);
  console.log(`   ${allLeads.length - leads.length} already complete (skipping)`);
  console.log(`   ${leads.length} need enrichment\n`);
  if (!leads.length) { console.log('Nothing to do.'); return; }

  // ── Step 1: Website + IG handle discovery ────────────────────────────────────
  console.log('─── Step 1: Website + IG handle ────────────────────────');
  for (const lead of leads) {
    let domain = extractDomain(lead.website);
    let igHandle = (lead.instagram_handle && lead.instagram_handle !== 'None') ? lead.instagram_handle : null;

    // Try to find IG from website if we have a domain
    if (!igHandle && domain) {
      igHandle = await findIgOnWebsite(domain);
      if (igHandle) console.log(`  ✓ ${lead.company_name} → @${igHandle} (website)`);
    }

    // If no domain or no IG: scrape FB about page
    if (!domain || !igHandle) {
      const fbUrl = lead.intake_data?.facebook_page_url;
      if (fbUrl) {
        process.stdout.write(`  FB about: ${lead.company_name}... `);
        const fb = await scrapeFacebookAbout(fbUrl);
        if (fb.website && !domain) { domain = fb.website; process.stdout.write(`website:${domain} `); }
        if (fb.ig && !igHandle) { igHandle = fb.ig; process.stdout.write(`ig:@${igHandle} `); }
        if (!fb.website && !fb.ig) process.stdout.write('—');
        console.log();
        // Update website in lead object for later steps
        if (fb.website) lead._domain = fb.website;
        if (fb.email && !lead.email) lead._fbEmail = fb.email;
      }
    }

    // Fallback: FB page slug as IG candidate
    if (!igHandle) {
      const fbUrl = lead.intake_data?.facebook_page_url;
      if (fbUrl) {
        const slug = fbUrl.replace(/\/?$/, '').split('/').filter(s =>
          s && s !== 'www.facebook.com' && s !== 'facebook.com' && s !== 'https:' && s !== 'http:'
        ).pop();
        if (slug && isValidIgHandle(slug)) {
          igHandle = slug;
          lead._igIsGuess = true;
        }
      }
    }

    lead._domain = lead._domain || domain;
    lead._igHandle = igHandle;
    await sleep(150);
  }

  const withHandle = leads.filter(l => l._igHandle);
  const withoutHandle = leads.filter(l => !l._igHandle);
  console.log(`\n  Found IG handle: ${withHandle.length}/${leads.length}`);
  if (withoutHandle.length) console.log(`  No handle found: ${withoutHandle.map(l => l.company_name).join(', ')}`);

  // ── Step 2: Batch IG Profile Scraper ─────────────────────────────────────────
  console.log('\n─── Step 2: IG Profile Scraper ─────────────────────────');
  const uniqueHandles = [...new Set(withHandle.map(l => l._igHandle))];
  let profiles = [];

  if (!isDryRun && uniqueHandles.length) {
    try {
      profiles = await runIgProfileScraper(uniqueHandles);
    } catch (err) {
      console.warn(`  ⚠ IG scraper failed: ${err.message} — continuing without profile data`);
    }
  } else if (isDryRun) {
    console.log(`  [DRY RUN] Would scrape ${uniqueHandles.length} handles`);
  }

  const profileByHandle = new Map(profiles.map(p => [p.username?.toLowerCase(), p]));

  for (const lead of withHandle) {
    const profile = profileByHandle.get(lead._igHandle?.toLowerCase());
    if (profile) {
      lead._igProfile = profile;
      lead._igFollowers = profile.followersCount || 0;
      if (profile.businessEmail && !lead.email && !lead._fbEmail) lead._igBizEmail = profile.businessEmail;
      console.log(`  ✓ @${lead._igHandle} → ${(lead._igFollowers/1000).toFixed(1)}k followers${lead._igBizEmail ? ` | biz email: ${lead._igBizEmail}` : ''}`);
    } else {
      console.log(`  ✗ @${lead._igHandle} — not found on Instagram`);
    }
  }

  // ── Step 3: Email enrichment ──────────────────────────────────────────────────
  console.log('\n─── Step 3: Email enrichment ───────────────────────────');
  for (const lead of leads) {
    if (lead.email && lead.email !== 'None' && !/\.(png|jpg|svg)$/i.test(lead.email)) {
      console.log(`  ✓ ${lead.company_name} — already has email: ${lead.email}`);
      continue;
    }
    // Clear junk email (image filenames etc)
    if (lead.email && /\.(png|jpg|svg)/i.test(lead.email)) lead.email = null;

    // Priority: IG bio email → FB about email → Hunter → website scrape
    const email = lead._igBizEmail || lead._fbEmail;
    if (email) {
      lead._finalEmail = email;
      console.log(`  ✓ ${lead.company_name} → ${email} [IG/FB]`);
      continue;
    }

    const domain = lead._domain;
    if (!domain) { console.log(`  ✗ ${lead.company_name} — no website/domain`); continue; }

    process.stdout.write(`  Hunter (${domain})... `);
    const contact = await hunterDomain(domain);
    if (contact) {
      lead._finalEmail = contact.email;
      lead._contactName = contact.name;
      lead._contactTitle = contact.title;
      console.log(`${contact.email}${contact.name ? ` (${contact.name})` : ''}`);
    } else {
      process.stdout.write('not found → website scrape... ');
      const scraped = await findEmailOnWebsite(domain);
      if (scraped) {
        lead._finalEmail = scraped;
        console.log(scraped);
      } else {
        console.log('not found');
      }
    }
    await sleep(300);
  }

  // ── Step 4: PATCH DB ──────────────────────────────────────────────────────────
  if (isDryRun) {
    console.log('\n[DRY RUN] Would update:');
    for (const lead of leads) {
      console.log(`  ${lead.company_name}: ig=@${lead._igHandle||'—'} followers=${lead._igFollowers||'—'} email=${lead._finalEmail||lead.email||'—'} website=${lead._domain||lead.website||'—'}`);
    }
    return;
  }

  console.log('\n─── Step 4: DB patch ───────────────────────────────────');
  let updated = 0, skipped = 0;

  for (const lead of leads) {
    const patch = {};

    // IG handle
    if (lead._igHandle && lead._igHandle !== lead.instagram_handle) {
      patch.instagram_handle = lead._igHandle;
    }

    // Followers
    if (lead._igFollowers != null && lead._igFollowers > 0) {
      patch.instagram_followers = lead._igFollowers;
    }

    // Website
    const newWebsite = lead._domain ? `https://${lead._domain}` : null;
    if (newWebsite && newWebsite !== lead.website && !lead.website?.includes('whatsapp') && !lead.website?.includes('forms.gle')) {
      patch.website = newWebsite;
    } else if (lead.website?.includes('whatsapp') || lead.website?.includes('forms.gle')) {
      patch.website = newWebsite; // replace bad website
    }

    // Email
    const finalEmail = lead._finalEmail || (lead.email && !/\.(png|jpg|svg)/i.test(lead.email) ? lead.email : null);
    if (lead._finalEmail && lead._finalEmail !== lead.email) {
      patch.email = lead._finalEmail;
    } else if (lead.email && /\.(png|jpg|svg)/i.test(lead.email)) {
      patch.email = null; // clear junk
    }

    // Status: promote Novi Lead → enriched if we found an email; never downgrade
    if (TARGET_STATUS === 'Novi Lead' && finalEmail) {
      patch.status = 'enriched';
    }

    // intake_data enrichment update
    const existingEnrichment = lead.intake_data?.enrichment || {};
    const newEnrichment = { ...existingEnrichment };
    if (lead._igProfile) {
      newEnrichment.instagram_profile = {
        username:          lead._igProfile.username,
        followers:         lead._igProfile.followersCount || 0,
        following:         lead._igProfile.followingCount || 0,
        posts_count:       lead._igProfile.postsCount || 0,
        bio:               lead._igProfile.biography || null,
        business_category: lead._igProfile.businessCategoryName || null,
        is_verified:       lead._igProfile.isVerified || false,
        external_url:      lead._igProfile.externalUrl || null,
        business_email:    lead._igProfile.businessEmail || null,
      };
    }
    if (lead._finalEmail || lead._contactName) {
      newEnrichment.contact = {
        email:  lead._finalEmail || lead.email || null,
        name:   lead._contactName || null,
        title:  lead._contactTitle || null,
        source: lead._contactTitle ? 'hunter' : 'website_scrape',
      };
    }

    if (Object.keys(patch).length === 0 && JSON.stringify(newEnrichment) === JSON.stringify(existingEnrichment)) {
      console.log(`  — ${lead.company_name} (nothing to update)`);
      skipped++;
      continue;
    }

    patch.intake_data = { ...(lead.intake_data || {}), enrichment: newEnrichment };

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/contacts?id=eq.${lead.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(patch),
    });

    if (patchRes.ok) {
      const parts = [
        lead._igHandle ? `@${lead._igHandle}` : null,
        lead._igFollowers ? `${(lead._igFollowers/1000).toFixed(1)}k` : null,
        patch.email || finalEmail || null,
        patch.status === 'enriched' ? '→ enriched' : null,
      ].filter(Boolean);
      console.log(`  ✓ ${lead.company_name} [${parts.join(' | ')}]`);
      updated++;
    } else {
      console.error(`  ✗ ${lead.company_name}: ${(await patchRes.text()).slice(0, 80)}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Updated : ${updated}`);
  console.log(`  Skipped : ${skipped}`);
  console.log('\n  Run generate_drafts.mjs to create email drafts for enriched leads.');
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
