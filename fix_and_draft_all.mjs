/**
 * Draft generator for SmartFlow instagram_manual leads.
 * Run from ai-growth-dashboard/:
 *   node fix_and_draft_all.mjs [--dry-run]  — regenerate ALL drafts (always full regen)
 *
 * SYSTEMATIC RULES (permanent, applied to every draft):
 *  1. Company name in CTA: brand only, strip " — PersonName", ® ™ symbols
 *  2. Location-aware CTA: "uživo ili online" only for Belgrade; "online" for other cities
 *  3. Serbian grammar: proper adjective-noun gender agreement, no mixed-gender phrases
 *  4. **Bold** formatting via markdown markers (converted to HTML at send time)
 *  5. Social-media-only businesses: emphasize high leverage, no-website context
 *  6. No fake/placeholder emails stored
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ndazbdkytcksmhoabtgs.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NzQ4MSwiZXhwIjoyMDg2MDczNDgxfQ.6PsYNOzdZeqpWXW3Pej_oLK5fV2MLDi34-SGkHHje2k';
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const GEMINI_KEY   = 'AIzaSyBjxHoGYmRwTd_ZOSMR2odQ2QKvZynQPO4';
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;

const isDryRun = process.argv.includes('--dry-run');
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Strip personal name suffixes and trademark symbols from company name for CTA */
function cleanCompanyName(name) {
  return name
    .replace(/\s*[—–]\s*.+$/, '')             // "Aviva Ageless — Dr Mila" → "Aviva Ageless"
    .replace(/\s+-\s+[A-ZĐŠĆŽČА-Я].+$/, '') // "SpeltaVita - NEMET ..." → "SpeltaVita"
    .replace(/-[A-ZĐŠĆŽČА-Я]\S+$/, '')      // "Zeleni Sokovi Nemet-Palić" → "Zeleni Sokovi Nemet"
    .replace(/[®™©]/g, '')
    .replace(/^www\./i, '').replace(/\.rs$/i, '')
    .replace(/\s+/g, ' ').trim();
}

/** Detect if location is outside Belgrade → use "online" only for CTA */
const BELGRADE_TERMS = ['beograd', 'belgra', 'bgd', 'novi beograd', 'zemun', 'palilula', 'voždovac'];
function getCityInfo(lead) {
  const loc = (lead.intake_data?.location || '').toLowerCase();
  if (!loc) return { outsideBelgrade: false, city: null };
  if (BELGRADE_TERMS.some(t => loc.includes(t))) return { outsideBelgrade: false, city: 'Belgrade' };
  const city = lead.intake_data.location.split(',')[0].trim();
  return { outsideBelgrade: true, city };
}

/** True if lead has no website AND no IG external_url — pure social media business */
function isSocialOnly(lead) {
  const ig = lead.intake_data?.enrichment?.instagram_profile || {};
  return !lead.website && !ig.external_url;
}

// ─── Fake email detection ───────────────────────────────────────────────────────
const FAKE_EMAIL_DOMAINS = ['domain.com', 'example.com', 'test.com'];
const GENERIC_EMAIL_PREFIXES = new Set([
  'info', 'contact', 'kontakt', 'office', 'hello', 'prodaja', 'sales',
  'marketing', 'podrska', 'support', 'admin', 'posta', 'mail', 'inbox',
  'team', 'tim', 'recepcija', 'biro', 'sekretarijat', 'firma', 'uprava',
  'kancelarija', 'prodavnica', 'servis', 'nabavka', 'logistika',
]);
function isFakeEmail(email) {
  if (!email) return false;
  const domain = email.toLowerCase().split('@')[1] || '';
  return FAKE_EMAIL_DOMAINS.some(d => domain === d);
}
function isGatekeeperEmail(email) {
  if (!email) return false;
  const prefix = email.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
  return GENERIC_EMAIL_PREFIXES.has(prefix);
}

// ─── Niche word mappings ────────────────────────────────────────────────────────
function getNicheWords(allContext) {
  if (/beauty|kozmetika|frizersk|salon|spa|lash|nail|kozmet/.test(allContext))
    return { clients: 'klijenti', clientsInstr: 'klijentima', outcome: 'zakazanih tretmana', booking: 'zakazivanja' };
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
  if (/klinika|ordinacij|estetsk|dermatolog|stomatolog|medicin/.test(allContext))
    return { clients: 'pacijenti', clientsInstr: 'pacijentima', outcome: 'zakazanih pregleda', booking: 'zakazivanja' };
  return { clients: 'klijenti', clientsInstr: 'klijentima', outcome: 'zakazanih razgovora', booking: 'dogovora' };
}

// ─── DM email assembler ─────────────────────────────────────────────────────────
// Uses **bold** markdown — converted to HTML at send time by send_outreach.mjs
function assembleDMEmail(p1, subject, lead, nicheWords, dmFirstName) {
  const cleanName    = cleanCompanyName(lead.company_name);
  const { outsideBelgrade } = getCityInfo(lead);
  const ctaModality  = outsideBelgrade ? 'online' : 'uživo ili online';
  const salutation   = dmFirstName ? `Poštovani ${dmFirstName},` : 'Poštovani,';
  const socialOnly   = isSocialOnly(lead);

  const socialBlock = socialOnly
    ? `\nZa biznis koji živi na društvenim mrežama — ovo je direktna zamena za celo odeljenje korisničke podrške, dostupno **24/7**, bez bolovanja i slobodnih dana.\n`
    : '';

  const body =
`${salutation}

${p1}
${socialBlock}
Mislim da biste imali manje haosa, a bolju prodaju, reputaciju i odnos sa ${nicheWords.clientsInstr} — uz AI sistem koji vodi sve razgovore na društvenim mrežama **24/7** i beleži svaki upit.

Vaš tim štedi **15–20 sati nedeljno**. Svaka poruka odgovorena. Svaki upit ispraćen.

Svaki razgovor, svaki detalj je na jednom mestu: ko je pisao, za šta pita, šta ga zanima, gde je stao.
Dobijate konkretne podatke pomoću kojih možete da prilagodite ponudu, procese, marketing — sve na osnovu onoga što Vam ${nicheWords.clients} zapravo govore.
Informacije koje trenutno jednostavno nemate.

Ali ovo nije šablonski čatbot.
Ovo je jedini agent na tržištu koji ima **analizu slika i videa**, i razume odgovore na stori — napravljen od nule.

Rezultat? Više prodaje, bez dodatnog posla.

Kada god biste imali dvadesetak minuta slobodno, voleo bih da Vam pokažem kako bi ovaj sistem izgledao konkretno za **${cleanName}** — besplatno i bez ikakvih obaveza, ${ctaModality}: https://cal.com/smartflow.rs/20min

Veliki pozdrav,

Nikola Guteša
Smartflow
Smartflow.rs
+381 64 118 2200`;

  return { subject, body };
}

// ─── Gemini draft builder ───────────────────────────────────────────────────────
async function buildDraft(lead) {
  const intake   = lead.intake_data || {};
  const enrich   = intake.enrichment || {};
  const ig       = enrich.instagram_profile || {};
  const igReels  = enrich.instagram_reels || [];
  const dm       = enrich.decision_maker || enrich.contact || {};
  const webIntel = enrich.website_intel || {};
  const adCopies = (intake.ad_copies || []).slice(0, 3);
  const adCount  = intake.active_ads_count || 0;

  // Use base instagram_followers if IG profile has 0 (wrong account scraped)
  const followers = (ig.followers && ig.followers > 100)
    ? ig.followers
    : (lead.instagram_followers || 0);

  const avgViews = igReels.length > 0
    ? Math.round(igReels.reduce((s, r) => s + (r.views || 0), 0) / igReels.length)
    : 0;

  const reelLines = igReels.map(r => {
    let line = `  • "${(r.caption || '').substring(0, 120)}" — ${(r.views || 0).toLocaleString()} views`;
    if (r.transcript) line += `\n    Transcript: "${String(r.transcript).substring(0, 200)}"`;
    return line;
  }).join('\n');

  const { outsideBelgrade, city } = getCityInfo(lead);
  const socialOnly = isSocialOnly(lead);
  const cleanName  = cleanCompanyName(lead.company_name);

  const dataBlock = [
    `Company (display name for CTA): ${cleanName}`,
    `Full company name: ${lead.company_name}`,
    `Website: ${lead.website || (ig.external_url ? `IG external: ${ig.external_url}` : 'NONE — operates only on social media')}`,
    `Niche (DB): ${lead.niche || 'N/A'}`,
    city ? `City: ${city}` : null,
    outsideBelgrade ? `IMPORTANT: Lead is NOT in Belgrade — use "online" not "uživo ili online" in CTA` : null,
    dm.name ? `Decision Maker: ${dm.name}${dm.title ? `, ${dm.title}` : ''}` : null,
    webIntel.description ? `Business (from site): ${webIntel.description}` : null,
    webIntel.products?.length ? `Key Products/Services: ${webIntel.products.join(', ')}` : null,
    ig.bio ? `IG Bio: "${ig.bio.substring(0, 120)}"` : null,
    followers ? `Instagram: ${followers.toLocaleString()} followers` : null,
    avgViews ? `Avg reel views: ${avgViews.toLocaleString()}` : null,
    igReels.length ? `Recent reels:\n${reelLines}` : null,
    adCount ? `Active Meta ads: ${adCount}${intake.ad_cta ? `, CTA: "${intake.ad_cta}"` : ''}` : null,
    adCopies.length ? `Ad copies:\n${adCopies.map(c => `  • "${c.substring(0, 100)}"`).join('\n')}` : null,
    socialOnly ? `IMPORTANT: No website. Pure social-media business. Emphasize 24/7 leverage.` : null,
  ].filter(Boolean).join('\n');

  const niche = (lead.niche || '').toLowerCase();
  const webDesc = (webIntel.description || '').substring(0, 200).toLowerCase();
  const products = (webIntel.products || []).join(', ').toLowerCase();
  const bio = (ig.bio || '').toLowerCase();
  const allContext = `${niche} ${webDesc} ${products} ${bio}`;
  const nicheWords = getNicheWords(allContext);

  const resolvedEmail = lead.email || '';
  const gatekeeper    = isGatekeeperEmail(resolvedEmail);
  const dmFirstName   = dm.name ? dm.name.split(' ')[0] : null;

  // ─── Hook signal ───────────────────────────────────────────────────────────
  let hookSignal = '';
  if (/beauty|kozmetika|frizersk|salon|spa|lash|nail/.test(allContext))
    hookSignal = `PAIN: Beauty/salon — appointment questions flood DM constantly. Staff has to be present with client AND on phone simultaneously.`;
  else if (/moda|fashion|odevanje|odeća|clothing/.test(allContext))
    hookSignal = `PAIN: Fashion — sizing, availability, delivery, styling questions flood DMs. Each unanswered one is a potential lost sale.`;
  else if (/fitnes|gym|sport|trening|wellness|yoga/.test(allContext))
    hookSignal = `PAIN: Fitness/wellness — every new member starts with a DM about pricing, schedule, or trial.`;
  else if (/online|prodaja|ecommerce|shop|store/.test(allContext))
    hookSignal = `PAIN: E-commerce — product questions, availability, delivery. Each unanswered one is a potential lost order.`;
  else if (/klinika|ordinacij|estetsk|dermatolog/.test(allContext))
    hookSignal = `PAIN: Clinic/medical — patients DM to ask about procedures, pricing, availability before booking.`;
  else if (/satovi|watch/.test(allContext))
    hookSignal = `PAIN: Watches — buyers DM to verify authenticity, check availability, negotiate. Slow reply = lost sale.`;
  else if (/obrazovan|kurs|edukacij/.test(allContext))
    hookSignal = `PAIN: Education — enrollment starts with DM about pricing, curriculum, schedule.`;
  else if (/herbal|tea|bilj|prirodn/.test(allContext))
    hookSignal = `PAIN: Natural products — customers ask about ingredients, health benefits, shipping before buying.`;
  else if (socialOnly)
    hookSignal = `PAIN: Pure social-media business with no website — ALL customer communication happens through DMs/comments/stories. This business is completely dependent on social inbox management.`;
  else if (followers > 5000)
    hookSignal = `PAIN: ${(followers/1000).toFixed(0)}k followers generating daily DMs with no system to handle them.`;
  else
    hookSignal = `PAIN: Use business context to identify core inquiry pain for this type of business.`;

  const transcriptNote = igReels.some(r => r.transcript)
    ? `\nReel transcripts: ${igReels.filter(r => r.transcript).map(r => `"${String(r.transcript).substring(0, 120)}"`).join(' / ')}`
    : '';

  // ─── GRAMMAR RULES (always included) ─────────────────────────────────────────
  const grammarRules = `
## Serbian GRAMMAR — MANDATORY RULES (violations are unacceptable):
- Adjective-noun gender agreement: "snažno digitalno prisustvo" (neuter), "jaku prisutnost" (fem), "jak identitet" (masc)
- Never write "jak digitalni prisustvo" — prisustvo is neuter → "snažno digitalno prisustvo"
- If two subjects → plural verb. Single brand → singular.
- Use "**bold**" markdown (double asterisks) for key phrases — converted to HTML bold in sent email
- Use "_italic_" sparingly for product/brand names if appropriate
- No bullet points in body`;

  const ctaRules = `
## CTA RULES (always apply):
- ALWAYS use the display name "${cleanName}" in CTA — never the full legal name with personal names
- Location: ${outsideBelgrade ? `Lead is in ${city} — CTA MUST say "online" NOT "uživo ili online"` : `Lead is in Belgrade — CTA may say "uživo ili online"`}
- CTA line (copy exactly, no changes):
  Kada god biste imali dvadesetak minuta slobodno, voleo bih da Vam pokažem kako bi ovaj sistem izgledao konkretno za **${cleanName}** — besplatno i bez ikakvih obaveza, ${outsideBelgrade ? 'online' : 'uživo ili online'}: https://cal.com/smartflow.rs/20min`;

  let prompt;

  if (!gatekeeper) {
    // DM template: Gemini only generates subject + p1
    prompt = `You are writing on behalf of Nikola Guteša (SmartFlow). Generate a personalized email opener.

Return JSON: {"subject":"...","p1":"...","analysis":"..."}

## LEAD DATA
${dataBlock}

## ${hookSignal}${transcriptNote}
${grammarRules}

## RULES FOR p1 (EXACTLY 2 sentences):
Sentence 1: Specific observation about their business — from reel content, products they sell, IG bio, or how their social media operates. Use **bold** for the most impactful phrase. Make them feel you actually looked.${socialOnly ? '\nIMPORTANT: They have no website — their entire business runs through social media. p1 should acknowledge this and frame it as a strength, but also the core challenge.' : ''}
Sentence 2: Natural bridge ending with exactly: "a da pritom nemate nikakav uvid u to šta Vam ${nicheWords.clients} zapravo traže, šta ih zanima, i gde odustaju od ${nicheWords.booking}."

## RULES FOR subject:
- Format: "[BrandName] — sistem koji rasterećuje tim od [specific thing they deal with]"
- The "specific thing" must be concrete to their business
- NEVER start with "Ko u" — explicitly banned
- Under 65 characters
- Use brand display name: "${cleanName}" — never full legal name

Output JSON only: {"subject":"...","p1":"...","analysis":"..."}`;

  } else {
    // Gatekeeper: Gemini generates full body
    prompt = `You are Nikola Guteša (SmartFlow). Write a cold outreach email to a generic company inbox (info@, office@).

## LEAD DATA
${dataBlock}

## ${hookSignal}${transcriptNote}

## WHAT YOU'RE SELLING:
A complete AI system for social media communication: handles ALL DMs, comments, story replies **24/7**, natural Serbian, everything logged in a unified inbox, analytics about what customers actually want, that data feeds content. Only AI in Serbia that reads images/video in messages.${socialOnly ? '\nIMPORTANT: This business has NO website — they operate 100% on social media. This means your system is extremely high-leverage for them. Emphasize this.' : ''}

## EMAIL STRUCTURE (max 170 words total):
P1 — 1 sentence: specific observation about their business. Short, sharp. Use **bold** for the most impactful word or phrase.
P2 — 2-3 sentences: what the system does for THEIR TEAM. Takes over [specific thing], **168 sati nedeljno**, everything in one place.
P3 — 2 sentences: the data + analytics angle.
P4 — 1 sentence: "Ti isti podaci direktno hrane sadržaj koji privlači nove ${nicheWords.clients}."
P5 — CTA (copy exactly):
Kada god biste imali dvadesetak minuta slobodno, voleo bih da Vam pokažem kako bi ovaj sistem izgledao konkretno za **${cleanName}** — besplatno i bez ikakvih obaveza, ${outsideBelgrade ? 'online' : 'uživo ili online'}: https://cal.com/smartflow.rs/20min
${grammarRules}
${ctaRules}

## HARD RULES
- Formal "Vi" throughout
- Subject: "[BrandDisplayName] — sistem koji rasterećuje tim za [their core work]" — use "${cleanName}"
- NEVER: bot, čatbot, automatizacija, leadovi, alat, Viber, "postoji sistem koji", "konkurencija", "brže od"
- Never imply the system replaces a person
- No bullet points in body
- Signature (copy exactly):
Veliki pozdrav,

Nikola Guteša
Smartflow
Smartflow.rs
+381 64 118 2200

Output JSON only: {"subject":"...","body":"...","analysis":"..."}`;
  }

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) await sleep(attempt * 30000);
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
        const assembled = assembleDMEmail(parsed.p1, parsed.subject, lead, nicheWords, dmFirstName);
        return { subject: assembled.subject, body: assembled.body, templateId: 'dm-fixed' };
      } else {
        if (!parsed.subject || !parsed.body) { lastErr = new Error('missing subject/body'); continue; }
        return { subject: parsed.subject, body: parsed.body, templateId: 'gatekeeper' };
      }
    } catch (err) { lastErr = err; }
  }
  throw new Error(`Gemini failed (3 attempts): ${lastErr?.message}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const { data: leads, error } = await sb
    .from('contacts')
    .select('*')
    .eq('client_id', SMARTFLOW_ID)
    .eq('izvor', 'instagram_manual')
    .neq('kategorija', 'Disqualified');

  if (error) { console.error('Fetch failed:', error); process.exit(1); }
  console.log(`Loaded ${leads.length} instagram_manual leads\n`);

  // ── STEP 1: Fix handles + clear fake emails ─────────────────────────────────
  console.log('─── Step 1: Fix handles + clear fake emails ────────────');
  const handleFixes = {
    'FLOERTY ®':            'floerty.us',
    'Satovi As':            'satovi.as_',
    'Medana — Gorana Dabić': 'medanaaaa',
  };
  for (const lead of leads) {
    const patches = {};
    if (handleFixes[lead.company_name]) {
      const currentHandle = lead.intake_data?.manual_ig_handle;
      if (currentHandle !== handleFixes[lead.company_name]) {
        patches.intake_data = {
          ...lead.intake_data,
          manual_ig_handle: handleFixes[lead.company_name],
        };
        if (patches.intake_data.enrichment?.manual_ig_handle)
          delete patches.intake_data.enrichment.manual_ig_handle;
        console.log(`  ✓ ${lead.company_name} — handle → @${handleFixes[lead.company_name]}`);
      }
    }
    if (lead.email && isFakeEmail(lead.email)) {
      patches.email = null;
      console.log(`  ✓ ${lead.company_name} — cleared fake email: ${lead.email}`);
    }
    if (Object.keys(patches).length && !isDryRun) {
      const { error: err } = await sb.from('contacts').update(patches).eq('id', lead.id);
      if (err) console.error(`  ✗ ${lead.company_name}: ${err.message}`);
    }
  }

  // ── STEP 2: Star social-media-only leads ────────────────────────────────────
  console.log('\n─── Step 2: Star social-media-only leads ───────────────');
  for (const lead of leads) {
    const onlyOnSocial = isSocialOnly(lead);
    if (onlyOnSocial && !lead.starred) {
      console.log(`  ⭐ ${lead.company_name} → starring`);
      if (!isDryRun) await sb.from('contacts').update({ starred: true }).eq('id', lead.id);
    } else if (onlyOnSocial) {
      console.log(`  ⭐ ${lead.company_name} — already starred`);
    } else {
      console.log(`  ○ ${lead.company_name}`);
    }
  }

  // Reload for fresh data
  const { data: freshLeads } = await sb
    .from('contacts').select('*')
    .eq('client_id', SMARTFLOW_ID)
    .eq('izvor', 'instagram_manual')
    .neq('kategorija', 'Disqualified');

  // ── STEP 3: Regenerate ALL drafts ────────────────────────────────────────────
  console.log('\n─── Step 3: Regenerate ALL drafts ──────────────────────');
  console.log(`\n  ⏳ Waiting 65s to clear Gemini RPM window…`);
  if (!isDryRun) await sleep(65000);

  for (const lead of freshLeads) {
    console.log(`\n  ${lead.company_name} [${lead.kategorija}]`);
    const ig      = lead.intake_data?.enrichment?.instagram_profile || {};
    const followers = (ig.followers && ig.followers > 100) ? ig.followers : (lead.instagram_followers || 0);
    const { outsideBelgrade, city } = getCityInfo(lead);
    const email   = lead.email || null;
    console.log(`    email: ${email || '—'}  |  ig: @${ig.username || '—'}  |  followers: ${followers.toLocaleString()}${outsideBelgrade ? `  |  📍 ${city}` : ''}`);
    if (isSocialOnly(lead)) console.log(`    ⭐ social-only — high leverage`);

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
      else      console.log(`    ✓ Draft saved`);
    } catch (err) {
      console.error(`    ✗ Draft failed: ${err.message}`);
    }

    await sleep(5000);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  DONE. Run node send_outreach.mjs --dry-run to preview.');
}

main().catch(err => { console.error('\n✗ Fatal:', err.message); process.exit(1); });
