/**
 * One-shot post-processor for existing email_draft fields:
 *  1. Adds **bold** markers to key phrases in all drafts
 *  2. Fixes specific known issues: Aviva (grammar+location+name), FLOERTY ® (symbol in CTA)
 *  3. Fixes Medana CTA name, Wonderful Wonder false-positive location flag
 *
 * Run once from ai-growth-dashboard/. Safe to re-run (idempotent where possible).
 */

import { createClient } from '@supabase/supabase-js';

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
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

/** Strip trademark symbols and personal name suffixes for display in CTA */
function cleanCompanyName(name) {
  return name
    .replace(/\s*[—–]\s*.+$/, '')
    .replace(/\s+-\s+[A-ZĐŠĆŽČА-Я].+$/, '')
    .replace(/-[A-ZĐŠĆŽČА-Я]\S+$/, '')
    .replace(/[®™©]/g, '')
    .replace(/^www\./i, '').replace(/\.rs$/i, '')
    .replace(/\s+/g, ' ').trim();
}

/** Add **bold** markers to standard key phrases in existing plain-text draft body */
function addBold(body, companyName) {
  if (body.includes('**')) return body; // already has formatting, skip
  const clean = cleanCompanyName(companyName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return body
    // Stats
    .replace(/\b(15[–-]20 sati nedeljno)\b/g, '**$1**')
    .replace(/\b(168 sati nedeljno)\b/g, '**$1**')
    .replace(/\b(24\/7)\b/g, '**$1**')
    // Key claims
    .replace(/(jedini agent na tržištu koji ima )([^,\n]+)/g, '$1**$2**')
    .replace(/(analizu slika i videa)/g, '**$1**')
    .replace(/(Svaka poruka odgovorena\. Svaki upit ispraćen\.)/g, '_$1_')
    // Company name in CTA line (before the em-dash separator that precedes "besplatno")
    .replace(
      new RegExp(`(konkretno za )(${clean})( —| ,)`, 'g'),
      '$1**$2**$3'
    );
}

// ─── Specific draft rewrites ───────────────────────────────────────────────────

const SPECIFIC_FIXES = {
  // Aviva: grammar + location (Niš = not Belgrade) + full name in CTA
  'Aviva Ageless — Dr Mila Djordjevic': (draft) => {
    return `Subject: Aviva Ageless — sistem koji rasterećuje tim od upita za tretmane i termine

Poštovani,

Dr Đorđević i **Aviva Ageless** u Nišu izgradili su _snažno digitalno prisustvo_ u sferi estetske medicine — profil sa **9.000 pratilaca** privlači zainteresovane pacijente koji pre zakazivanja šalju poruke sa pitanjima o tretmanima, cenama i dostupnim terminima. A da pritom nemate nikakav uvid u to šta Vam pacijenti zapravo traže, šta ih zanima, i gde odustaju od zakazivanja.

Mislim da biste imali manje haosa, a bolju prodaju, reputaciju i odnos sa pacijentima — uz AI sistem koji vodi sve razgovore na društvenim mrežama **24/7** i beleži svaki upit.

Vaš tim štedi **15–20 sati nedeljno**. Svaka poruka odgovorena. Svaki upit ispraćen.

Svaki razgovor, svaki detalj je na jednom mestu: ko je pisao, za šta pita, šta ga zanima, gde je stao.
Dobijate konkretne podatke pomoću kojih možete da prilagodite ponudu, procese, marketing — sve na osnovu onoga što Vam pacijenti zapravo govore.
Informacije koje trenutno jednostavno nemate.

Ali ovo nije šablonski čatbot.
Ovo je jedini agent na tržištu koji ima **analizu slika i videa**, i razume odgovore na stori — napravljen od nule.

Rezultat? Više zakazivanja, bez dodatnog posla.

Kada god biste imali dvadesetak minuta slobodno, voleo bih da Vam pokažem kako bi ovaj sistem izgledao konkretno za **Aviva Ageless** — besplatno i bez ikakvih obaveza, online: https://cal.com/smartflow.rs/20min

Veliki pozdrav,

Nikola Guteša
Smartflow
Smartflow.rs
+381 64 118 2200`;
  },

  // FLOERTY: remove ® from CTA
  'FLOERTY ®': (draft) => {
    return draft
      .replace(/konkretno za \*?\*?FLOERTY ®\*?\*?/g, 'konkretno za **FLOERTY**')
      .replace(/konkretno za FLOERTY ®/g, 'konkretno za **FLOERTY**');
  },

  // Medana: strip "— Gorana Dabić" from CTA
  'Medana — Gorana Dabić': (draft) => {
    return draft
      .replace(/konkretno za \*?\*?Medana — Gorana Dabić\*?\*?/g, 'konkretno za **Medana**')
      .replace(/konkretno za Medana — Gorana Dabić/g, 'konkretno za **Medana**');
  },
};

// ─── Main ──────────────────────────────────────────────────────────────────────
const { data: leads, error } = await sb.from('contacts')
  .select('id, company_name, email_draft')
  .eq('client_id', SMARTFLOW_ID)
  .eq('status', 'enriched')
  .neq('kategorija', 'Disqualified')
  .not('email_draft', 'is', null);

if (error) { console.error(error.message); process.exit(1); }

console.log(`Patching ${leads.length} drafts…\n`);
let updated = 0;

for (const lead of leads) {
  const lines     = lead.email_draft.split('\n');
  const subject   = lines[0];
  const bodyStart = lines.findIndex((l, i) => i > 0 && l.trim() === '') + 1;
  let body        = lines.slice(bodyStart).join('\n').trim();

  // Apply specific fix if one exists
  const specificFix = SPECIFIC_FIXES[lead.company_name];
  let newDraft;

  if (specificFix) {
    newDraft = specificFix(lead.email_draft);
    console.log(`  ✎ ${lead.company_name} — specific fix applied`);
  } else {
    const boldBody = addBold(body, lead.company_name);
    const changed = boldBody !== body;
    newDraft = `${subject}\n\n${boldBody}`;
    if (!changed) { console.log(`  ○ ${lead.company_name} — already formatted`); continue; }
    console.log(`  ✓ ${lead.company_name} — bold added`);
  }

  const { error: err } = await sb.from('contacts')
    .update({ email_draft: newDraft })
    .eq('id', lead.id);

  if (err) console.error(`  ✗ ${lead.company_name}: ${err.message}`);
  else updated++;
}

console.log(`\nDone. Updated ${updated}/${leads.length} drafts.`);
