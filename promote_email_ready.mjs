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
  .select('id, company_name, demo_built_at, email_draft')
  .eq('client_id', SMARTFLOW_ID)
  .eq('pipeline_stage', 'demo_building')
  .not('demo_built_at', 'is', null)
  .not('email_draft', 'is', null);

if (error) { console.error('Fetch error:', error.message); process.exit(1); }

console.log(`Promote → email_ready: ${data.length} lead(s) ready${isDryRun ? ' [DRY RUN]' : ''}`);
for (const c of data) console.log(`  • ${c.company_name}`);

if (!isDryRun && data.length) {
  const ids = data.map(c => c.id);
  const { error: upErr } = await sb.from('contacts').update({ pipeline_stage: 'email_ready' }).in('id', ids);
  if (upErr) { console.error('Update error:', upErr.message); process.exit(1); }
  console.log(`Promoted ${ids.length}.`);
}
