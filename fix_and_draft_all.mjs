/**
 * One-shot cleanup + draft generation for all instagram_manual leads.
 *
 * Does:
 *   1. Moves manual_ig_handle for FLOERTY/Satovi As/Medana to top-level intake_data
 *      (so enrichment runs don't wipe it from the enrichment sub-object)
 *   2. Clears fake placeholder emails (contact@domain.com)
 *   3. Stars leads that have no website AND no IG external_url (social-media-only signal)
 *   4. Generates Gemini email drafts for ALL 16 leads (including no-email ones)
 *   5. Sets all leads to status = "enriched"
 *
 * Run from ai-growth-dashboard/:
 *   node fix_and_draft_all.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

const SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NzQ4MSwiZXhwIjoyMDg2MDczNDgxfQ.6PsYNOzdZeqpWXW3Pej_oLK5fV2MLDi34-SGkHHje2k';
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const GEMINI_KEY   = 'AIzaSyBjxHoGYmRwTd_ZOSMR2odQ2QKvZynQPO4';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

const isDryRun = process.argv.includes('--dry-run');
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Fake email detection ──────────────────────────────────────────────────────
const FAKE_EMAIL_DOMAINS = ['domain.com', 'example.com', 'test.com'];
const GENERIC_EMAIL_PREFIXES = new Set([
  'info', 'contact', 'kontakt', 'office', 'hello', 'prodaja', 'sales',
  'marketing', 'podrska', 'support', 'admin', 'posta', 'mail', 'inbox',
  'team', 'tim', 'recepcija', 'biro', 'sekretarijat', 'firma', 'uprava',
  'kancelarija', 'prodavnica', 'servis', 'nabavka', 'logistika',
]);
function isFakeEmail(email) {
  if (!email) return false;
  const [prefix, domain] = email.toLowerCase().split('@');
  return FAKE_EMAIL_DOMAINS.some(d => domain === d);
}
function isGatekeeperEmail(email) {
  if (!email) return false;
  const prefix = email.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
  return GENERIC_EMAIL_PREFIXES.has(prefix);
}

// ─── Niche word mappings ───────────────────────────────────────────────────────
function getNicheWords(allContext) {
  if (/beauty|kozmetika|frizersk|salon|spa|lash|nail|kozmet/.test(allContext))
    return { clients: 'klijentkinje', clientsInstr: 'klijentkinjama', outcome: 'zakazanih tretmana', booking: 'zakazivanja' };
  if (/fitnes|gym|sport|trening|wellness|yoga|pilates/.test(allContext))
    return { clients: 'klijenti', clientsInstr: 'klijentima', outcome: 'zakazanih termina', booking: 'zakazivanja' };
  if (/restoran|catering|hrana|dostava|kafe/.test(allContext))
    return { clients: 'gosti', clientsInstr: 'gostima', outcome: 'rezervacija i porudžbina', booking: 'rezervacija' };
  if (/online|prodaja|ecommerce|shop|store|tehnik|aparat|kategorij|artikal/.test(allContext))
    return { clients: 'kupci', clientsInstr: 'kupcima', outcome: 'zaključenih porudžbina', booking: 'kupovine' };
  if (/moda|fashion|odevanje|odeća|garderoba|clothing/.test(allContext))
    return { clients: 'kupci', clientsInstr: 'kupcima', outcome: 'zaključenih porudžbina', booking: 'kupovine' };
  if (/nekretnin|real.estat|stan|kuca|agencij/.test(allContext))
    return { clients: 'klijenti', clientsInstr: 'klijentima', outcome: 'zakazanih prezentacija', booking: 'zakazivanja' };
  if (/obrazovan|škol|kurs|edukacij|training/.test(allContext))
    return { clients: 'polaznici', clientsInstr: 'polaznicima', outcome: 'zakazanih konsultacija', booking: 'upisa' };
  if (/dizajn|enterijer|nameštaj|parket|pod|stolarij|mattress|madrac/.test(allContext))
    return { clients: 'kupci', clientsInstr: 'kupcima', outcome: 'zakazanih prezentacija i prodaja', booking: 'upita' };
  if (/auto|vozil|diler|servis|delovi|satovi|watch/.test(allContext))
    return { clients: 'kupci', clientsInstr: 'kupcima', outcome: 'dogovorenih testova i prodaja', booking: 'upita' };
  return { clients: 'klijenti', clientsInstr: 'klijentima', outcome: 'zakazanih razgovora', booking: 'dogovora' };
}

function assembleDMEmail(p1, subject, companyName, nicheWords, dmFirstName) {
  const salutation = dmFirstName ? `Poštovani ${dmFirstName},` : 'Poštovani,';
  const body = `${salutation}

${p1}

Mislim da biste imali manje haosa, a bolju prodaju, reputaciju i odnos sa ${nicheWords.clientsInstr} — uz AI sistem koji vodi sve razgovore na društvenim mrežama 24/7 i beleži svaki upit.

Vaš tim štedi 15–20 sati nedeljno. Svaka poruka odgovorena. Svaki upit ispraćen.

Svaki razgovor, svaki detalj je na jednom mestu: ko je pisao, za šta pita, šta ga zanima, gde je stao.
Dobijate konkretne podatke pomoću kojih možete da prilagodite ponudu, procese, marketing — sve na osnovu onoga što Vam ${nicheWords.clients} zapravo govore.
Informacije koje trenutno jednostavno nemate.

Ali ovo nije šablonski chatbot.
Ovo je jedini agent na tržištu koji ima analizu slika i videa, i razume odgovore na stori — napravljen od nule.

Rezultat? Više prodaje, bez dodatnog posla.

Kada god biste imali dvadesetak minuta slobodno, voleo bih da Vam pokažem kako bi ovaj sistem izgledao konkretno za ${companyName} — besplatno i bez ikakvih obaveza, uživo ili online: https://cal.com/smartflow.rs/20min

Veliki pozdrav,

Nikola Guteša
Smartflow
Smartflow.rs
+381 64 118 2200`;
  return { subject, body };
}

async function buildDraft(lead) {
  const intake   = lead.intake_data || {};
  const enrich   = intake.enrichment || {};
  const ig       = enrich.instagram_profile || {};
  const igReels  = enrich.instagram_reels || [];
  const dm       = enrich.decision_maker || enrich.contact || {};
  const webIntel = enrich.website_intel || {};
  const adCopies = (intake.ad_copies || []).slice(0, 3);
  const adCount  = intake.active_ads_count || 0;
  const followers = ig.followers || ig.follower_count || 0;
  const avgViews  = igReels.length > 0
    ? Math.round(igReels.reduce((s, r) => s + (r.views || 0), 0) / igReels.length)
    : 0;

  const reelLines = igReels.map(r => {
    let line = `  • "${(r.caption || '').substring(0, 120)}" — ${(r.views || 0).toLocaleString()} views`;
    if (r.transcript) line += `\n    Transcript: "${String(r.transcript).substring(0, 200)}"`;
    return line;
  }).join('\n');

  const dataBlock = [
    `Company: ${lead.company_name}`,
    `Website: ${lead.website || (ig.external_url ? `IG external: ${ig.external_url}` : 'N/A')}`,
    `Niche (DB): ${lead.niche || 'N/A'}`,
    dm.name ? `Decision Maker: ${dm.name}${dm.title ? `, ${dm.title}` : ''}` : null,
    webIntel.description ? `Business (from site): ${webIntel.description}` : null,
    webIntel.products?.length ? `Key Products/Services: ${webIntel.products.join(', ')}` : null,
    ig.bio ? `IG Bio: "${ig.bio.substring(0, 120)}"` : null,
    followers ? `Instagram: ${followers.toLocaleString()} followers` : null,
    avgViews ? `Avg reel views: ${avgViews.toLocaleString()}` : null,
    igReels.length ? `Recent reels:\n${reelLines}` : null,
    adCount ? `Active Meta ads: ${adCount}${intake.ad_cta ? `, CTA: "${intake.ad_cta}"` : ''}` : null,
    adCopies.length ? `Ad copy samples:\n${adCopies.map(c => `  • "${c.substring(0, 100)}"`).join('\n')}` : null,
  ].filter(Boolean).join('\n');

  const niche = (lead.niche || '').toLowerCase();
  const webDesc = (webIntel.description || '').substring(0, 200).toLowerCase();
  const products = (webIntel.products || []).join(', ').toLowerCase();
  const bio = (ig.bio || '').toLowerCase();
  const allContext = `${niche} ${webDesc} ${products} ${bio}`;
  const nicheWords = getNicheWords(allContext);

  // Determine email type
  const resolvedEmail = lead.email || '';
  const gatekeeper = isGatekeeperEmail(resolvedEmail);
  const dmFirstName = dm.name ? dm.name.split(' ')[0] : null;

  // Niche pain signal
  let hookSignal = '';
  if (/beauty|kozmetika|frizersk|salon|spa|lash|nail/.test(allContext))
    hookSignal = `PAIN SIGNAL: Beauty/salon. Pain: booking and appointment questions come via DM non-stop. Staff has to be present with the client AND on the phone simultaneously.`;
  else if (/moda|fashion|odevanje|odeća|clothing/.test(allContext))
    hookSignal = `PAIN SIGNAL: Fashion/clothing. Pain: sizing, availability, delivery, styling questions flood DMs daily — each unanswered one is a potential lost sale.`;
  else if (/fitnes|gym|sport|trening|wellness|yoga/.test(allContext))
    hookSignal = `PAIN SIGNAL: Fitness/wellness. Pain: every new member starts with a DM about pricing, schedule, or trial.`;
  else if (/online|prodaja|ecommerce|shop|store/.test(allContext))
    hookSignal = `PAIN SIGNAL: E-commerce. Pain: hundreds of product questions daily — prices, availability, delivery. Each unanswered one is a potential lost order.`;
  else if (/dizajn|enterijer|nameštaj|madrac|mattress/.test(allContext))
    hookSignal = `PAIN SIGNAL: Interior/furniture. Pain: every sale starts with a message about measurements, pricing, availability.`;
  else if (/satovi|watch/.test(allContext))
    hookSignal = `PAIN SIGNAL: Watches/accessories. Pain: buyers DM to verify authenticity, check availability, negotiate — each slow reply loses the sale.`;
  else if (/obrazovan|kurs|edukacij/.test(allContext))
    hookSignal = `PAIN SIGNAL: Education. Pain: enrollment starts with a DM about pricing, curriculum, schedule.`;
  else if (/herbal|tea|bilj|prirodn/.test(allContext))
    hookSignal = `PAIN SIGNAL: Natural products/herbal. Pain: customers ask about ingredients, health benefits, shipping — high volume, high trust stakes.`;
  else if (followers > 5000)
    hookSignal = `PAIN SIGNAL: Active social presence with ${(followers/1000).toFixed(0)}k followers. Pain: large audience generating daily DMs with no system to handle them.`;
  else
    hookSignal = `PAIN SIGNAL: Use business context. Identify the core pain when it comes to customer inquiries for this type of business.`;

  const transcriptLine = igReels.some(r => r.transcript)
    ? `\nReel transcript content: ${igReels.filter(r => r.transcript).map(r => `"${String(r.transcript).substring(0, 120)}"`).join(' / ')}`
    : '';

  let prompt;

  if (!gatekeeper) {
    prompt = `You are writing on behalf of Nikola Guteša (SmartFlow). Generate a personalized email opener for a cold outreach to a Serbian business decision maker.

Return JSON: {"subject":"...","p1":"...","analysis":"..."}

## LEAD DATA
${dataBlock}

## ${hookSignal}
${transcriptLine}

## RULES FOR p1 (2 sentences ONLY):
Sentence 1: A specific observation about their business — from reel content, products they sell, IG bio, or how their social media operates. Make them feel "he actually looked." Reference something specific.
Sentence 2: Natural bridge ending with: "a da pritom nemate nikakav uvid u to šta Vam ${nicheWords.clients} zapravo traže, šta ih zanima, i gde odustaju od ${nicheWords.booking}."

## RULES FOR subject:
- Format: "[Brand] — sistem koji rasterećuje tim od [specific thing they deal with]"
- The "specific thing" must be concrete to their business
- NEVER start with "Ko u" — explicitly banned
- Under 65 characters

Output JSON only: {"subject":"...","p1":"...","analysis":"..."}`;
  } else {
    prompt = `You are Nikola Guteša (SmartFlow). Write a cold outreach email to a generic company inbox (info@, office@, etc.) — the reader is likely a team member, not the final decision maker.

## LEAD DATA
${dataBlock}

## ${hookSignal}
${transcriptLine}

## WHAT YOU'RE OFFERING:
A complete AI system for social media communication: handles ALL DMs, comments, story replies 24/7, natural Serbian, everything logged in a unified inbox, analytics about what customers actually want, and that same data feeds content. Only AI in Serbia that reads images/video in messages.

## EMAIL STRUCTURE (max 170 words total):
P1 — 1 sentence: specific observation about their business (from IG bio, products, or presence). Short, sharp.
P2 — 2-3 sentences: what the system does for THEIR TEAM. Takes over [specific thing], 168h/week, everything in one place.
P3 — 2 sentences: the data + analytics angle.
P4 — 1 sentence: hint at content ("Ti isti podaci direktno hrane sadržaj koji privlači nove ${nicheWords.clients}").
P5 — CTA: "Kada god biste imali dvadesetak minuta slobodno, voleo bih da Vam pokažem kako bi ovaj sistem izgledao konkretno za ${lead.company_name} — besplatno i bez ikakvih obaveza, uživo ili online: https://cal.com/smartflow.rs/20min"

## HARD RULES
- Formal "Vi" throughout
- Subject: "[Brand] — sistem koji rasterećuje tim za [their core work]" — specific to their business
- NEVER: bot, chatbot, automatizacija, leadovi, alat, Viber, "postoji sistem koji", "konkurencija", "brže od"
- Never imply the system replaces a person
- No bullet points in body
- Signature:
Veliki pozdrav,

Nikola Guteša
Smartflow
Smartflow.rs
+381 64 118 2200

Output JSON only: {"subject":"...","body":"...","analysis":"..."}`;
  }

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) await sleep(attempt * 3000);
    try {
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(40000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, responseMimeType: 'application/json' },
        }),
      });
      if (res.status === 429) { lastErr = new Error('rate limited'); continue; }
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) { lastErr = new Error('empty response'); continue; }
      const parsed = JSON.parse(text);

      if (!gatekeeper) {
        if (!parsed.subject || !parsed.p1) { lastErr = new Error('missing subject/p1'); continue; }
        const assembled = assembleDMEmail(parsed.p1, parsed.subject, lead.company_name, nicheWords, dmFirstName);
        return { subject: assembled.subject, body: assembled.body, templateId: 'dm-fixed' };
      } else {
        if (!parsed.subject || !parsed.body) { lastErr = new Error('missing subject/body'); continue; }
        return { subject: parsed.subject, body: parsed.body, templateId: 'gatekeeper' };
      }
    } catch (err) { lastErr = err; }
  }
  throw new Error(`Gemini failed (3 attempts): ${lastErr?.message}`);
}

async function main() {
  // Fetch all instagram_manual leads
  const { data: leads, error } = await sb
    .from('contacts')
    .select('*')
    .eq('client_id', SMARTFLOW_ID)
    .eq('izvor', 'instagram_manual')
    .neq('kategorija', 'Disqualified');

  if (error) { console.error('Fetch failed:', error); process.exit(1); }
  console.log(`Loaded ${leads.length} instagram_manual leads\n`);

  // ── STEP 1: Fix manual IG handles + clear fake emails ──────────────────────
  console.log('─── Step 1: Fix handles + clear fake emails ────────────');
  const handleFixes = {
    'FLOERTY ®':            'floerty.us',
    'Satovi As':             'satovi.as_',
    'Medana — Gorana Dabić': 'medanaaaa',
  };
  for (const lead of leads) {
    const patches = {};

    // Move handle from enrichment sub-object to top-level (safe from overwrite)
    if (handleFixes[lead.company_name]) {
      const currentHandle = lead.intake_data?.manual_ig_handle;
      if (currentHandle !== handleFixes[lead.company_name]) {
        patches.intake_data = {
          ...lead.intake_data,
          manual_ig_handle: handleFixes[lead.company_name],
        };
        // Strip it from enrichment sub-object to avoid confusion
        if (patches.intake_data.enrichment?.manual_ig_handle) {
          delete patches.intake_data.enrichment.manual_ig_handle;
        }
        console.log(`  ✓ ${lead.company_name} — handle moved to top-level: @${handleFixes[lead.company_name]}`);
      }
    }

    // Clear fake emails
    if (lead.email && isFakeEmail(lead.email)) {
      patches.email = null;
      console.log(`  ✓ ${lead.company_name} — cleared fake email: ${lead.email}`);
    }

    if (Object.keys(patches).length && !isDryRun) {
      const { error: err } = await sb.from('contacts').update(patches).eq('id', lead.id);
      if (err) console.error(`  ✗ ${lead.company_name}: ${err.message}`);
    }
  }

  // ── STEP 2: Star leads with no website and no IG external_url ─────────────
  console.log('\n─── Step 2: Star social-media-only leads ───────────────');
  for (const lead of leads) {
    const ig = lead.intake_data?.enrichment?.instagram_profile || {};
    const hasWebsite = !!lead.website;
    const hasIgExternal = !!(ig.external_url);
    if (!hasWebsite && !hasIgExternal && !lead.starred) {
      console.log(`  ⭐ ${lead.company_name} — no website, no IG external URL → starring`);
      if (!isDryRun) {
        await sb.from('contacts').update({ starred: true }).eq('id', lead.id);
      }
    } else if (!hasWebsite && !hasIgExternal) {
      console.log(`  ⭐ ${lead.company_name} — already starred`);
    } else {
      console.log(`  ○ ${lead.company_name} — has website/external URL`);
    }
  }

  // Reload leads after patches (we need fresh intake_data for draft gen)
  const { data: freshLeads } = await sb
    .from('contacts')
    .select('*')
    .eq('client_id', SMARTFLOW_ID)
    .eq('izvor', 'instagram_manual')
    .neq('kategorija', 'Disqualified');

  // ── STEP 3: Generate drafts for ALL leads ──────────────────────────────────
  console.log('\n─── Step 3: Generate drafts for all leads ──────────────');
  for (const lead of freshLeads) {
    console.log(`\n  ${lead.company_name} [${lead.kategorija}]`);
    const ig = lead.intake_data?.enrichment?.instagram_profile || {};
    const email = lead.email || null;
    console.log(`    email: ${email || '—'}  |  ig: @${ig.username || '—'}  |  followers: ${ig.followers || 0}`);

    if (isDryRun) { console.log(`    [DRY RUN] Would generate draft`); continue; }

    try {
      const draft = await buildDraft(lead);
      const fullDraft = `Subject: ${draft.subject}\n\n${draft.body}`;
      console.log(`    📝 [${draft.templateId}] ${draft.subject}`);

      const { error: err } = await sb.from('contacts').update({
        email_draft: fullDraft,
        status: 'enriched',
        service: 'social_media_system',
      }).eq('id', lead.id);

      if (err) console.error(`    ✗ DB error: ${err.message}`);
      else      console.log(`    ✓ Draft saved + status → enriched`);
    } catch (err) {
      console.error(`    ✗ Draft failed: ${err.message}`);
    }

    await sleep(1200); // pace Gemini
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  DONE. All leads drafted + enriched.');
  console.log('  Reload dashboard: http://localhost:3000');
}

main().catch(err => { console.error('\n✗ Fatal:', err.message); process.exit(1); });
