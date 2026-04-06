/**
 * SmartFlow Follow-up Generator
 *
 * Reads all leads with email_1_poslat=true and no email_2_draft,
 * generates personalized follow-up emails using the data/intelligence angle,
 * then writes them to email_2_draft in contacts.
 *
 * Template angle: "the invisible intelligence you're not collecting"
 * — Every DM is market research that's currently going to waste.
 *
 * Run: node generate_followups.cjs [--dry-run]
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NzQ4MSwiZXhwIjoyMDg2MDczNDgxfQ.6PsYNOzdZeqpWXW3Pej_oLK5fV2MLDi34-SGkHHje2k';
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const isDryRun = process.argv.includes('--dry-run');

// ─── Extract original subject from email_draft ─────────────────────────────
function extractSubject(draft) {
  if (!draft) return null;
  const firstLine = draft.split('\n')[0];
  return firstLine.replace(/^Subject:\s*/i, '').trim();
}

// ─── Extract the personalization "hook" paragraph from the original email ──
// Looks for the first substantive paragraph that is:
//   - Not a greeting ("Poštovani")
//   - Not the system description ("Naš sistem", "Razvili smo", etc.)
//   - Not the CTA / signature block
function extractHook(draft) {
  if (!draft) return '';
  const paragraphs = draft.split('\n\n').map(p => p.trim()).filter(Boolean);
  const systemPhrases = [
    'naš sistem', 'razvili smo', 'kreirali smo', 'izgradio sam', 'osmislio sam',
    'sistem koji sam', 'sistem koji radim', 'sistem koji bi radio',
    'imamo spreman', 'imam spreman', 'kada god', 'cal.com',
    'nikola guteša', 'smartflow', 'pozdrav'
  ];
  for (const para of paragraphs) {
    if (/^subject:/i.test(para)) continue;
    const lower = para.toLowerCase();
    if (lower.startsWith('poštovani') && para.length < 30) continue; // bare greeting only
    if (systemPhrases.some(p => lower.includes(p))) continue;
    // Got a substantive paragraph — strip markdown bold markers
    return para.replace(/\*\*(.+?)\*\*/g, '$1').replace(/_(.+?)_/g, '$1');
  }
  return '';
}

// ─── Format follower count into natural Serbian text ──────────────────────
function followersText(n) {
  if (!n) return 'Vaša publika';
  if (n >= 200000) return `${Math.round(n / 1000)} hiljada pratilaca`;
  if (n >= 100000) return `${Math.round(n / 1000)} hiljada pratilaca`;
  if (n >= 10000)  return `${Math.round(n / 1000)} hiljada pratilaca`;
  if (n >= 1000)   return `${(n / 1000).toFixed(1).replace('.0', '')} hiljada pratilaca`;
  return `${n} pratilaca`;
}

// ─── Estimate conversation volume from follower count ────────────────────
function conversationEstimate(n) {
  if (!n)          return 'koje';
  if (n >= 100000) return 'konzervativno, nekoliko stotina do hiljadu razgovora nedeljno koji';
  if (n >= 50000)  return 'konzervativno, nekoliko stotina razgovora nedeljno koji';
  if (n >= 20000)  return 'konzervativno, stotinak razgovora nedeljno koji';
  if (n >= 5000)   return 'konzervativno, desetine razgovora nedeljno koji';
  return 'svakodnevne razgovore koji';
}

// ─── Generate the follow-up email ─────────────────────────────────────────
function generateFollowUp(lead) {
  const { company_name, instagram_followers, email_draft } = lead;
  const origSubject  = extractSubject(email_draft);
  const hook         = extractHook(email_draft);
  const fwrs         = followersText(instagram_followers);
  const convEstimate = conversationEstimate(instagram_followers);
  const subject      = origSubject ? `Re: ${origSubject}` : `Re: ${company_name} — dopuna`;

  const followersLine = instagram_followers
    ? `${company_name} ima ${fwrs} — ${convEstimate} trenutno prolaze nesnimljeno.`
    : `Svi ti razgovori koji svakodnevno stižu u inbox — niko ih trenutno ne beleži u sistem.`;

  const body = `${hook ? hook + '\n\n' : ''}Šaljem dopunu prošlom mejlu — mislim da nisam stavio dovoljno naglaska na pravu vrednost.

Svaka poruka koju Vaša publika šalje u DM je tržišno istraživanje koje niko ne sakuplja: koji proizvodi ili usluge pokreću najviše razgovora, gde kupci stanu pre odluke, šta ih koči, koja pitanja se ponavljaju svake nedelje. To su podaci koji postoje — sada, u Vašim DM-ovima — ali prolaze bez traga jer nema sistema koji ih hvata i organizuje.

${followersLine}

AI sistem koji radim za Vas to rešava u celini: svaki razgovor u CRM-u, svaki trend vidljiv u realnom vremenu — podaci koji direktno govore šta Vaša publika zaista traži i gde su prodajne prilike koje trenutno propuštate. Imam spreman demo: https://cal.com/smartflow.rs/20min

Veliki pozdrav,

Nikola Guteša
SmartFlow
smartflow.rs
+381 64 118 2200`;

  return `Subject: ${subject}\n\n${body}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: leads, error } = await sb
    .from('contacts')
    .select('id, company_name, instagram_followers, email_draft, kategorija, email_2_draft')
    .eq('client_id', SMARTFLOW_ID)
    .eq('email_1_poslat', true)
    .eq('email_2_poslat', false);

  if (error) { console.error('DB error:', error.message); process.exit(1); }

  const isForce = process.argv.includes('--force');
  const needsDraft = leads.filter(l => !l.email_2_draft || isForce);
  console.log(`\nSmartFlow Follow-up Generator`);
  console.log(`Total sent: ${leads.length} | Need draft: ${needsDraft.length}${isDryRun ? ' [DRY RUN]' : ''}\n`);

  let written = 0;
  for (const lead of needsDraft) {
    const draft = generateFollowUp(lead);
    const subjectLine = draft.split('\n')[0];
    console.log(`[${lead.kategorija}] ${lead.company_name}`);
    console.log(`  ${subjectLine}\n`);

    if (!isDryRun) {
      const { error: updateError } = await sb
        .from('contacts')
        .update({ email_2_draft: draft })
        .eq('id', lead.id);
      if (updateError) {
        console.error(`  ✗ Failed: ${updateError.message}`);
      } else {
        written++;
      }
    }
  }

  if (!isDryRun) console.log(`\n✓ Written ${written}/${needsDraft.length} follow-up drafts`);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
