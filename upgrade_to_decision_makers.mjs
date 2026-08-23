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

async function hunterQuota() {
  try {
    const r = await fetch(`https://api.hunter.io/v2/account?api_key=${HUNTER_KEY}`);
    const j = await r.json();
    const s = j?.data?.requests?.searches;
    if (!s) return null;
    return { used: s.used, available: s.available, left: s.available - s.used };
  } catch { return null; }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Hunter.io Decision-Maker Upgrader');
  console.log(`  Mode: ${isDryRun ? 'DRY RUN (no API calls, no writes)' : 'LIVE'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  const quota = await hunterQuota();
  if (quota) console.log(`Hunter searches left this cycle: ${quota.left} of ${quota.available}\n`);
  if (!isDryRun && quota && quota.left <= 0) {
    console.error('✗ Hunter search quota exhausted — nothing to spend. Aborting.');
    process.exit(1);
  }

  // Every status a lead can hold while still being worth a better address.
  // This used to be `status=eq.enriched` alone, which silently excluded every lead
  // that had moved on — 16 of 17 demo-built leads were never once looked at, and
  // went out to info@ addresses instead.
  const ELIGIBLE = ['enriched', 'No Draft', 'Demo Izgrađen', 'Kontaktiran', 'Follow Up', 'Bounced'];
  const statusFilter = `status=in.(${ELIGIBLE.map(s => `"${s}"`).join(',')})`;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/contacts?client_id=eq.${SMARTFLOW_ID}&${statusFilter}&select=id,company_name,email,website,intake_data,status&limit=300`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const leads = await res.json();
  if (!Array.isArray(leads)) { console.error('DB error:', leads); process.exit(1); }

  console.log(`Loaded ${leads.length} enriched leads\n`);

  let upgraded = 0, skipped = 0, notFound = 0, wouldSearch = 0, spent = 0;
  // Never spend more than the quota, and let the caller cap it: --budget N
  const budgetArg = process.argv.indexOf('--budget');
  const budget = budgetArg !== -1
    ? Number(process.argv[budgetArg + 1])
    : (quota ? quota.left : 25);

  for (const lead of leads) {
    // The website column is sometimes empty even though the address itself names
    // the company domain — office@crowndental.rs is a perfectly good lead for a
    // domain search.
    const emailDomain = (currentEmailDomain) => {
      const d = (currentEmailDomain || '').split('@')[1];
      if (!d || /gmail|yahoo|hotmail|outlook|icloud|proton/i.test(d)) return null;
      return d;
    };
    const currentEmail = lead.email || '';
    const domain = cleanDomain(lead.website) || emailDomain(lead.email);
    const name = (lead.company_name || '').slice(0, 35);

    if (!domain) {
      console.log(`⊘ ${name} — no domain, skipping`);
      skipped++;
      continue;
    }

    // Skip if a previous run already upgraded this lead — searches are metered
    if (lead.intake_data?.enrichment?.decision_maker?.email) {
      console.log(`✓ ${name} — already upgraded, skipping`);
      skipped++;
      continue;
    }

    // Skip if already has a personal email
    if (isPersonalEmail(currentEmail)) {
      console.log(`✓ ${name} — already personal (${currentEmail}), skipping`);
      skipped++;
      continue;
    }

    // A dry run must cost nothing. This previously still called Hunter — only the
    // DB write was skipped — so "just checking what it would do" drained the
    // month's search quota. Dry run now reports the bill instead of paying it.
    if (isDryRun) {
      console.log(`· ${name} — would search ${domain} (1 search)`);
      wouldSearch++;
      continue;
    }

    if (spent >= budget) {
      console.log(`⏸ ${name} — budget of ${budget} searches reached, stopping`);
      break;
    }

    const dm = await hunterDomainSearch(domain);
    spent++;

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
  if (isDryRun) console.log(`  Would search : ${wouldSearch}  (costs ${wouldSearch} Hunter searches)`);
  console.log(`  Searched : ${spent}`);
  console.log(`  Upgraded : ${upgraded}`);
  console.log(`  Skipped  : ${skipped}`);
  console.log(`  Not found: ${notFound}`);
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
