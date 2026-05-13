/**
 * SmartFlow Niche Classifier v2
 *
 * Reclassifies contacts into a fine-grained niche taxonomy using website_summary +
 * Instagram bio. Replaces the coarse `niche` field (where 41% of leads land in 'other')
 * with a specific category that enables niche-aware targeting and analysis.
 *
 * Usage:
 *   node classify_niches.mjs                  — classify all unclassified (niche_v2 IS NULL)
 *   node classify_niches.mjs --all            — reclassify everything
 *   node classify_niches.mjs --limit 50       — cap the run
 *   node classify_niches.mjs --dry-run        — show classifications, don't write
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch {}
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

if (!GEMINI_KEY) { console.error('✗ GEMINI_API_KEY required'); process.exit(1); }

const isAll     = process.argv.includes('--all');
const isDryRun  = process.argv.includes('--dry-run');
const limitIdx  = process.argv.indexOf('--limit');
const LIMIT     = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : null;

// 15 fine-grained categories. Anything that doesn't fit lands in 'b2b_services' or 'other_consumer'.
const TAXONOMY = [
  'dental', 'aesthetic_medical', 'physiotherapy', 'pharmacy_supplements',
  'fitness_studio', 'beauty_salon', 'wellness_spa',
  'online_supplements', 'online_cosmetics', 'online_other_retail',
  'real_estate_agency', 'travel_agency', 'language_school', 'photography_studio',
  'restaurant_higher_end', 'home_decor_furniture', 'b2b_services',
  'other_consumer', 'unclear'
];

const PROMPT_BASE = `You are classifying a Serbian B2B lead into ONE category for outreach targeting.

Output ONLY the category name from this list:
${TAXONOMY.map(t => `- ${t}`).join('\n')}

Definitions:
- dental                      : dental clinics, ortodonti, oralna hirurgija
- aesthetic_medical           : estetska medicina, dermatologija, antiaging clinics, laser
- physiotherapy               : fizioterapija, kineziologija, rehabilitation
- pharmacy_supplements        : pharmacies (BENU, etc.) and brick-and-mortar supplement retailers
- fitness_studio              : gyms, pilates, yoga studios, body contouring
- beauty_salon                : nails, lashes, makeup, kozmetički saloni
- wellness_spa                : spa centers, wellness clinics (non-medical)
- online_supplements          : ecommerce selling supplements, vitamins, health products
- online_cosmetics            : ecommerce selling skincare, makeup, cosmetics
- online_other_retail         : other ecommerce (electronics, home, gifts)
- real_estate_agency          : real estate, property management
- travel_agency               : travel agencies, tour operators, vacation
- language_school             : language schools, online courses, edukacija
- photography_studio          : photographers, video production
- restaurant_higher_end       : restaurants, cafes, catering, hotels
- home_decor_furniture        : furniture, home decor, interior design (selling products)
- b2b_services                : services sold to other businesses (agencies, consultants, software)
- other_consumer              : consumer brand that doesn't fit any specific bucket above
- unclear                     : insufficient information to classify

Output ONLY the label. No explanation.`;

async function classify(lead) {
  const ctx = [
    `COMPANY: ${lead.company_name || ''}`,
    lead.niche ? `OLD_NICHE: ${lead.niche}` : '',
    lead.website ? `WEBSITE: ${lead.website}` : '',
    lead.website_summary ? `WEBSITE_SUMMARY: ${(lead.website_summary || '').slice(0, 600)}` : '',
    lead.intake_data?.enrichment?.instagram_profile?.biography ? `IG_BIO: ${lead.intake_data.enrichment.instagram_profile.biography.slice(0, 300)}` : '',
    lead.intake_data?.enrichment?.ad_copies?.length ? `AD_COPY_SAMPLE: ${(lead.intake_data.enrichment.ad_copies[0] || '').slice(0, 300)}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `${PROMPT_BASE}\n\n${ctx}\n\nLABEL:`;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.0, maxOutputTokens: 16 }
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  const label = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toLowerCase().replace(/[^a-z_]/g, '');
  return TAXONOMY.includes(label) ? label : 'unclear';
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  let q = sb.from('contacts')
    .select('id, company_name, niche, niche_v2, website, website_summary, intake_data')
    .eq('client_id', SMARTFLOW_ID);
  if (!isAll) q = q.is('niche_v2', null);
  if (LIMIT) q = q.limit(LIMIT);

  const { data, error } = await q;
  if (error) { console.error(error.message); process.exit(1); }

  console.log(`Classifying ${data.length} contacts (taxonomy v2, ${TAXONOMY.length} categories)…\n`);

  const counts = {};
  let done = 0, failed = 0;
  for (const lead of data) {
    try {
      const label = await classify(lead);
      counts[label] = (counts[label] || 0) + 1;
      const arrow = lead.niche_v2 && lead.niche_v2 !== label ? `  [was: ${lead.niche_v2}]` : '';
      console.log(`  ${(lead.company_name || '').slice(0, 50).padEnd(50)} ${(lead.niche || 'none').padEnd(20)} → ${label}${arrow}`);
      if (!isDryRun) {
        await sb.from('contacts').update({ niche_v2: label }).eq('id', lead.id);
      }
      done++;
      // Light pacing — Gemini free tier is ~15 req/min
      await new Promise(r => setTimeout(r, 4500));
    } catch (e) {
      console.error(`  ✗ ${lead.company_name}: ${e.message}`);
      failed++;
    }
  }

  console.log('\n═══ Distribution ═══');
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(25)} ${v}`);
  }
  console.log(`\nDone: ${done}  |  Failed: ${failed}${isDryRun ? '  [DRY RUN — no writes]' : ''}`);
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
