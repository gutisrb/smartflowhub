/**
 * Cockpit build-approved chain — final step.
 * Promotes leads from pipeline_stage='demo_building' → 'email_ready' once they
 * actually have BOTH a built demo and a written email draft. Anything still
 * missing one stays at demo_building and gets picked up on the next run.
 *
 * Usage: node promote_email_ready.mjs [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { verifyTenant } from './lib/demo-gate-io.mjs';
import { leadFit } from './lib/lead-fit.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const raw = readFileSync(resolve(__dirname, '.env.local'), 'utf8');
  for (const line of raw.split('\n')) { const m = line.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
} catch {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const isDryRun = process.argv.includes('--dry-run');

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const { data, error } = await sb
  .from('contacts')
  .select('id, company_name, demo_built_at, email_draft, email, demo_tenant_email, instagram_followers, intake_data')
  .eq('client_id', SMARTFLOW_ID)
  .eq('pipeline_stage', 'demo_building')
  .not('demo_built_at', 'is', null)
  .not('email_draft', 'is', null)
  // No handle = no way to check DM demand (audit_dm_demand.mjs) or the lead's real audience.
  // Crowndental and Demart reached email_ready this way and had to be pulled back by hand.
  .not('instagram_handle', 'is', null);

if (error) { console.error('Fetch error:', error.message); process.exit(1); }

// Two hard gates (2026-11-10): the lead must run a serious social sales pipeline (lib/lead-fit.mjs, reels-led) and its demo must
// pass the claims gate (lib/demo-gate.mjs: every line checked against the business's own site). Nikola was the only gate before.
const passed = [];
for (const c of data) {
  const d = c.intake_data?.dm_demand;
  const fit = leadFit({ name: c.company_name, followers: c.instagram_followers, email: c.email,
    medViews: d?.median_views ?? null, viewsPerFollower: d?.views_per_follower ?? null, reels12: d?.reels12 ?? null, paidAds: !!d?.paid_ads, buyerQs: d?.buyer_qs ?? null });
  if (!fit.pass) { console.log(`  ✗ ${c.company_name} — lead gate: ${fit.fails.join(' | ')}`); continue; }
  if (!c.demo_tenant_email) { console.log(`  ✗ ${c.company_name} — no demo tenant to verify`); continue; }
  const g = await verifyTenant(sb, c.demo_tenant_email, { live: true });
  if (g.error || !g.ok) { console.log(`  ✗ ${c.company_name} — claims gate: ${g.error || `${g.failures.length} failure(s)`} (node verify_demo.mjs --email ${c.demo_tenant_email})`); continue; }
  passed.push(c);
}
data.length = 0; data.push(...passed);

console.log(`Promote → email_ready: ${data.length} lead(s) ready${isDryRun ? ' [DRY RUN]' : ''}`);
for (const c of data) console.log(`  • ${c.company_name}`);

if (!isDryRun && data.length) {
  const ids = data.map(c => c.id);
  const { error: upErr } = await sb.from('contacts').update({ pipeline_stage: 'email_ready' }).in('id', ids);
  if (upErr) { console.error('Update error:', upErr.message); process.exit(1); }
  console.log(`Promoted ${ids.length}.`);
}
