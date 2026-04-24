/**
 * Upgrade enriched lead emails to decision-maker contacts via Hunter.io.
 * For each enriched lead: search domain for decision-maker emails (founder/owner/director/CEO).
 * If found and different from current email → update DB + flag email_classification = decision_maker.
 *
 * Usage:
 *   node upgrade_to_decision_makers.mjs --dry-run
 *   node upgrade_to_decision_makers.mjs
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
const HUNTER_KEY   = process.env.HUNTER_API_KEY;
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const isDryRun     = process.argv.includes('--dry-run');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function cleanDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const h = u.hostname.replace(/^www\./, '');
    if (['facebook.com','instagram.com','maps.app','whatsapp.com','gmail.com'].some(s => h.includes(s))) return null;
    return h;
  } catch { return null; }
}

// Roles that clearly indicate a decision-maker (not just any employee)
const DM_ROLES = /founder|owner|ceo|cmo|coo|director|vlasnik|direktor|sales.manager|marketing.manager/i;

// A genuine personal email: firstname.lastname@ or f.lastname@ or firstname@ with a known first name
// Must NOT be a department/function word
const DEPT_WORDS = /^(info|office|kontakt|prodaja|hello|support|admin|mail|contact|rezervacije|hoteli|marketing|sales|posao|jobs|privatnost|recepcija|reception|reservations|reception|booking|events|reception|no.?reply|noreply|team|hello|press|media|hr|legal|finance)/i;

function isPersonalEmail(email) {
  if (!email) return false;
  const local = email.split('@')[0].toLowerCase();
  if (DEPT_WORDS.test(local)) return false;
  // firstname.lastname pattern or initial.lastname: must contain a dot or be clearly a name
  const hasDot = /^[a-z]{1,3}\.[a-z]{3,}$/.test(local) ||   // f.lastname or fi.lastname
                 /^[a-z]{3,}\.[a-z]{3,}$/.test(local);        // firstname.lastname
  return hasDot;
}

async function hunterDomainSearch(domain) {
  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&api_key=${HUNTER_KEY}`
    );
    const d = await res.json();
    if (!d?.data?.emails?.length) return null;

    const emails = d.data.emails;

    // Priority 1: clear DM role with ANY email format
    const dm = emails.find(e => DM_ROLES.test(e.position || ''));
    if (dm?.value) return { email: dm.value, name: dm.first_name || null, title: dm.position || null };

    // Priority 2: firstname.lastname@ pattern (genuinely personal)
    const personal = emails.find(e => isPersonalEmail(e.value));
    if (personal?.value) return { email: personal.value, name: personal.first_name || null, title: personal.position || null };

    return null;
  } catch { return null; }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Hunter.io Decision-Maker Upgrader');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${SMARTFLOW_ID}&status=eq.enriched&select=id,company_name,email,website,intake_data&limit=100`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const leads = await res.json();
  if (!Array.isArray(leads)) { console.error('DB error:', leads); process.exit(1); }

  console.log(`Loaded ${leads.length} enriched leads\n`);

  let upgraded = 0, skipped = 0, notFound = 0;

  for (const lead of leads) {
    const domain = cleanDomain(lead.website);
    const currentEmail = lead.email || '';
    const name = (lead.company_name || '').slice(0, 35);

    if (!domain) {
      console.log(`⊘ ${name} — no domain, skipping`);
      skipped++;
      continue;
    }

    // Skip if already has a personal email
    if (isPersonalEmail(currentEmail)) {
      console.log(`✓ ${name} — already personal (${currentEmail}), skipping`);
      skipped++;
      continue;
    }

    const dm = await hunterDomainSearch(domain);

    if (!dm || dm.email === currentEmail) {
      console.log(`✗ ${name} — no DM found on ${domain}`);
      notFound++;
    } else {
      const label = dm.name ? `${dm.name}` : '';
      const role  = dm.title ? ` (${dm.title})` : '';
      console.log(`↑ ${name}`);
      console.log(`  ${currentEmail} → ${dm.email}${label ? ' — ' + label : ''}${role}`);

      if (!isDryRun) {
        const currentIntake = lead.intake_data || {};
        const enrichment = currentIntake.enrichment || {};
        const patch = {
          email: dm.email,
          intake_data: {
            ...currentIntake,
            enrichment: {
              ...enrichment,
              contact: {
                ...(enrichment.contact || {}),
                email: dm.email,
                name: dm.name || enrichment.contact?.name || null,
                title: dm.title || enrichment.contact?.title || null,
                source: 'hunter_dm',
              },
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
        upgraded++;
      }
    }

    await sleep(600);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`  Upgraded : ${upgraded}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Not found: ${notFound}`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
