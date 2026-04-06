/**
 * Fix enriched SmartFlow leads:
 * 1. Populate instagram_handle from intake_data
 * 2. Fix null full_name from IG username / page name
 * 3. Fix website when it's an instagram.com or fb.me URL
 * 4. Clean placeholder emails (contact@domain.com)
 * 5. Extract real email from ad copy for meta_ads leads
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.trim() && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()]; })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const CLIENT_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

function extractIgHandle(intake) {
  if (!intake) return null;
  // Direct fields
  if (intake.instagram_handle) return intake.instagram_handle;
  if (intake.manual_ig_handle) return intake.manual_ig_handle;
  // From enrichment
  const profile = intake.enrichment?.instagram_profile;
  if (profile?.username) return profile.username;
  // From URL field in intake
  if (intake.instagram_url) {
    const m = intake.instagram_url.match(/instagram\.com\/([^/?#]+)/);
    if (m) return m[1];
  }
  return null;
}

function extractNameFromIntake(intake) {
  if (!intake) return null;
  // From IG profile
  const profile = intake.enrichment?.instagram_profile;
  if (profile?.username) return profile.username;
  if (intake.manual_ig_handle) return intake.manual_ig_handle;
  if (intake.instagram_handle) return intake.instagram_handle;
  return null;
}

function extractEmailFromAdCopy(intake) {
  if (!intake) return null;
  const copies = intake.ad_copies || [];
  for (const copy of copies) {
    const match = copy.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    if (match && !match[0].includes('domain.com') && !match[0].includes('example.com')) {
      return match[0].toLowerCase();
    }
  }
  return null;
}

function isBadWebsite(url) {
  if (!url) return false;
  return (
    url.includes('instagram.com') ||
    url.includes('fb.me') ||
    url.includes('tinyurl.com') ||
    url.includes('temu.com') ||
    url === 'https://instagram.com'
  );
}

function extractWebsiteFromIntake(intake) {
  if (!intake) return null;
  const profile = intake.enrichment?.instagram_profile;
  const externalUrl = profile?.external_url;
  if (externalUrl && !isBadWebsite(externalUrl)) return externalUrl;
  // Check bio_links
  const bioLinks = profile?.bio_links || [];
  for (const link of bioLinks) {
    const url = typeof link === 'string' ? link : link?.url;
    if (url && !isBadWebsite(url) && !url.includes('facebook.com') && !url.includes('tiktok.com')) {
      return url;
    }
  }
  return null;
}

const { data: leads, error } = await supabase
  .from('kontakti')
  .select('id, full_name, email, instagram_handle, website, izvor, status, intake_data')
  .eq('client_id', CLIENT_ID)
  .eq('status', 'enriched');

if (error) { console.error('Fetch error:', error.message); process.exit(1); }

console.log(`Processing ${leads.length} enriched leads...\n`);

let updated = 0;
let skipped = 0;

for (const lead of leads) {
  const intake = lead.intake_data;
  const updates = {};

  // 1. Fix instagram_handle
  const ig = extractIgHandle(intake);
  if (ig && !lead.instagram_handle) {
    updates.instagram_handle = ig;
  }

  // 2. Fix null full_name
  if (!lead.full_name) {
    const name = extractNameFromIntake(intake);
    if (name) updates.full_name = name;
  }

  // 3. Fix bad website
  if (isBadWebsite(lead.website)) {
    const realSite = extractWebsiteFromIntake(intake);
    if (realSite) {
      updates.website = realSite;
    } else {
      // If the IG handle is known, at least clear the bad URL
      const igHandle = ig || lead.instagram_handle;
      if (igHandle) updates.website = `https://www.instagram.com/${igHandle}`;
    }
  }

  // 4. Clean placeholder emails
  if (lead.email && (lead.email.includes('contact@domain.com') || lead.email.includes('@example.com'))) {
    // Try to find real email from ad copy
    const adEmail = extractEmailFromAdCopy(intake);
    if (adEmail) {
      updates.email = adEmail;
    } else {
      updates.email = null;
    }
  }

  // 5. Extract email from ad copy for meta_ads leads with no email
  if (!lead.email && lead.izvor === 'meta_ads_scrape') {
    const adEmail = extractEmailFromAdCopy(intake);
    if (adEmail) updates.email = adEmail;
  }

  if (Object.keys(updates).length === 0) {
    skipped++;
    continue;
  }

  const { error: updateErr } = await supabase
    .from('kontakti')
    .update(updates)
    .eq('id', lead.id);

  if (updateErr) {
    console.error(`  ERROR updating ${lead.full_name || lead.id}:`, updateErr.message);
  } else {
    console.log(`  ✓ ${lead.full_name || '(no name)'}`, Object.entries(updates).map(([k,v]) => `${k}=${JSON.stringify(v)?.slice(0,60)}`).join(', '));
    updated++;
  }
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped (no changes needed)`);
