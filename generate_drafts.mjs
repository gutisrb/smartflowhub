/**
 * SmartFlow Draft Generator
 *
 * For every SmartFlow lead with an email address, calls Gemini 3.0 Flash to
 * generate a fully personalized draft and saves it to the DB.
 *
 * Usage (from ai-growth-dashboard/):
 *   node generate_drafts.mjs                              — all eligible leads (skips existing drafts)
 *   node generate_drafts.mjs --mode initial               — enriched leads only
 *   node generate_drafts.mjs --mode followup              — Kontaktiran leads only
 *   node generate_drafts.mjs --force                      — overwrite existing drafts
 *   node generate_drafts.mjs --dry-run                    — preview, no DB writes
 *   node generate_drafts.mjs --company "TRI O"            — single lead by name (always force)
 *   node generate_drafts.mjs --limit 10                   — cap batch size
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ────────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch { /* no .env.local */ }
}
loadEnv();

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SMARTFLOW_ID  = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const OPENAI_KEY   = process.env.OPENAI_API_KEY;
// gpt-4o-mini kept producing Serbian grammar slips that survived explicit
// instructions — repeated nouns ("upiše termin ... i zakaže termin"), wrong cases.
// Draft volume is tiny (tens of leads, not thousands), so the quality difference
// is worth cents. Override with OPENAI_MODEL=gpt-4o-mini for bulk runs.
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

if (!OPENAI_KEY) {
  console.error('✗ OPENAI_API_KEY not set in .env.local');
  process.exit(1);
}
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// ── CLI args ───────────────────────────────────────────────────────────────────
const isDryRun    = process.argv.includes('--dry-run');
const isForce     = process.argv.includes('--force'); // overwrite existing drafts
const companyIdx  = process.argv.indexOf('--company');
const COMPANY     = companyIdx !== -1 ? process.argv[companyIdx + 1] : null;
const limitIdx    = process.argv.indexOf('--limit');
const LIMIT       = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : 0;
const modeIdx     = process.argv.indexOf('--mode');
const MODE        = modeIdx !== -1 ? process.argv[modeIdx + 1] : 'all'; // 'all' | 'initial' | 'followup' | 'e2' | 'e3'
const DELAY_MS    = 500; // 0.5s between calls — OpenAI has generous rate limits

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Deterministic subject variant: 0, 1, or 2 based on company name */
function subjectVariant(companyName) {
  let h = 0;
  for (const c of (companyName || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 3;
}

/** Classify email as decision_maker or general.
 *  decision_maker = personal name pattern (firstname@, firstname.lastname@)
 *  general        = everything else (department, brand, catch-all, location)
 */
function classifyEmail(email) {
  if (!email) return 'general';
  const prefix = email.split('@')[0].toLowerCase();

  // Explicit catch-all keywords (exact match or prefix)
  const catchAll = [
    'info', 'kontakt', 'contact', 'office', 'prodaja', 'hello', 'hi',
    'podrska', 'support', 'mail', 'email', 'admin', 'team', 'marketing', 'hr',
    'uprava', 'firma', 'company', 'post', 'posta', 'servis', 'service',
    'zakazi', 'booking', 'rezervacije', 'recepcija', 'reception', 'oglasi',
    'jobs', 'store', 'online', 'korisnicki', 'porudzbine', 'potrosaci',
    'nabavka', 'sales', 'shop', 'web', 'dm', 'pr', 'media', 'press',
    'hello', 'hey', 'clinic', 'apoteka', 'ordinacija', 'beograd', 'novi',
    'zagreb', 'sarajevo', 'notice', 'noreply', 'no-reply', 'newsletter',
  ];
  if (catchAll.some(c => prefix === c || prefix.startsWith(c + '.') || prefix.startsWith(c + '_'))) return 'general';

  // Digits (3+) indicate a catch-all or auto-generated address
  if (/\d{3,}/.test(prefix)) return 'general';

  // Brand-pattern: contains the @ domain brand name fragment, or is all lowercase with no separators → brand alias
  // e.g. naturamedy@, medameggy@, prettyeverydayofficial@, onlinemototrening@
  // Heuristic: if prefix is long (>14 chars) with no dot/underscore/dash → brand name, not a person
  if (prefix.length > 14 && !/[._-]/.test(prefix)) return 'general';

  // Location codes: single word that is a place name fragment (e.g. banovobrdo, usce, zemun)
  // Heuristic: no separator AND looks like a compound word (camelCase-adjacent) AND no known first-name pattern
  // Skip — hard to detect reliably; handle via name pattern detection below instead

  // Personal name patterns — must positively match to be DM:
  // 1. firstname.lastname@ (e.g. vukasin.plavsic, marijana.ivanovic)
  //    Both parts must be name-like: 2-12 chars, no brand/catch-all terms
  const brandTerms = new Set(['store','shop','online','mistore','usce','beograd','team','web','dm','media']);
  const dotMatch = prefix.match(/^([a-zčćšžđ]{2,12})[._]([a-zčćšžđ]{2,15})$/);
  if (dotMatch && !brandTerms.has(dotMatch[1]) && !brandTerms.has(dotMatch[2])) return 'decision_maker';

  // 2. Common Serbian/regional first names standing alone
  const firstNames = new Set([
    'nikola','marko','stefan','milan','aleksandar','ivan','petar','jovan','filip','luka',
    'nemanja','vladimir','bogdan','milan','dejan','milos','miloš','igor','dragan','nenad',
    'ana','marija','milica','jovana','nina','ivana','jelena','katarina','aleksandra','maja',
    'tijana','danijela','dragana','vesna','snezana','sanja','marina','tatjana','natasa','bojana',
    'anita','gordana','radmila','slavica','sonja','andrea','jasmina','jasna','svetlana',
    'vukasin','vukašin','bojan','srdjan','srđan','goran','zoran','dalibor','miroslav',
    'slobodan','predrag','darko','saša','sasa','dušan','dusan','aleksandar','branko',
  ]);
  if (firstNames.has(prefix)) return 'decision_maker';

  // Everything else: treat as general to avoid false personalization
  return 'general';
}


/** Strip generic prefixes like "Kompanija", "Firma", "Preduzeće" from display name */
function cleanCompanyName(name) {
  return (name || '').replace(/^(Kompanija|Firma|Preduzeće|Preduzeće|DOO|D\.O\.O\.)\s+/i, '').trim();
}

/** Infer business_type from niche OR bio/company name as fallback */
function inferBusinessTypeFromContext(niche, bio, companyName) {
  const productNiches = [
    'fashion', 'food', 'beauty', 'ecommerce', 'tech', 'electronics',
    'online_prodaja', 'prodaja', 'maloprodaja', 'retail', 'clothing',
    'home', 'sport', 'toys', 'furniture', 'auto',
  ];
  if (productNiches.includes((niche || '').toLowerCase())) return 'product';

  // Fall back to bio + company name keyword detection
  const text = `${bio || ''} ${companyName || ''}`.toLowerCase();
  const productKeywords = [
    'shop', 'prodavnica', 'prodaja', 'dostava', 'porudžb', 'porudzb',
    'webshop', 'web shop', 'online', 'kupovina', 'narudžb', 'narudzb',
    'veleprodaja', 'maloprodaja', 'proizvod', 'brend', 'kolekcij',
    'šaljemo', 'saljemo', 'šalje', 'dostavlja', 'porudžba', 'porudzba',
    'kupi', 'kupite', 'cena', 'cijena', 'popust', 'akcija', 'naruči',
    'naruci', 'web', 'sajt', 'store', 'fashion', 'odjeća', 'odjeca',
    'odeća', 'odeca', 'kolekcija', 'suplementi', 'kozmetika', 'prirodni',
    'organski', 'biljna', 'ulje', 'serum', 'krem', 'parfem', 'nakit',
    'satovi', 'nameštaj', 'namestaj', 'oprema', 'uređaj', 'uredaj',
  ];
  if (productKeywords.some(k => text.includes(k))) return 'product';

  // Explicit service signals override fallthrough
  const serviceKeywords = [
    'zakazivanje', 'termin', 'konsultacij', 'trening', 'kurs', 'edukacij',
    'seminar', 'coaching', 'savetovanj', 'terapij', 'klinik', 'ordinacij',
    'agencij', 'nekretnin', 'iznajmlj', 'renovacij', 'gradjevina',
  ];
  if (serviceKeywords.some(k => text.includes(k))) return 'service';

  return 'service';
}

/** Fetch seeded demo stats for a lead's demo client (for E1 P4 specificity) */
async function fetchDemoStats(sb, demoClientId) {
  if (!demoClientId) return null;
  try {
    const [appt, crm, svc, razg, priced] = await Promise.all([
      sb.from('appointments').select('id', { count: 'exact', head: true }).eq('client_id', demoClientId),
      sb.from('demo_crm').select('id', { count: 'exact', head: true }).eq('client_id', demoClientId),
      sb.from('services_catalog').select('id', { count: 'exact', head: true }).eq('client_id', demoClientId),
      sb.from('razgovori').select('platform, id_razgovora').eq('client_id', demoClientId),
      // Their own scraped catalogue. Naming a real service at its real price is the
      // most verifiable thing the email can say — it proves the demo is actually theirs.
      sb.from('services_catalog').select('name, price_min').eq('client_id', demoClientId)
        .eq('is_active', true).not('price_min', 'is', null).order('price_min', { ascending: false }),
    ]);
    const distinctConvs = new Set((razg.data || []).map(r => r.id_razgovora)).size;
    const platformSet = new Set((razg.data || []).map(r => r.platform).filter(Boolean));
    const PLATFORM_LABELS = { instagram: 'Instagram', whatsapp: 'WhatsApp', facebook: 'Facebook', web: 'Web' };
    const channels = [...platformSet].map(p => PLATFORM_LABELS[p.toLowerCase()] ?? p);
    return {
      conversations_count: distinctConvs,
      conversations_channels: channels,
      crm_count: crm.count ?? 0,
      services_count: svc.count ?? 0,
      appointments_count: appt.count ?? 0,
      has_calendar: (appt.count ?? 0) > 0,
      has_catalog: (svc.count ?? 0) > 0,
      top_service:   priced.data?.[0]?.name ?? null,
      top_price:     priced.data?.[0]?.price_min ?? null,
      entry_service: priced.data?.[priced.data.length - 1]?.name ?? null,
      entry_price:   priced.data?.[priced.data.length - 1]?.price_min ?? null,
    };
  } catch {
    return null;
  }
}

/** Build the lead intel object for Gemini */
function buildLeadIntel(lead, emailType, demoStats = null) {
  const enrichment = lead.intake_data?.enrichment || {};
  const igProfile  = enrichment.instagram_profile || {};
  const igReels    = enrichment.instagram_reels || [];
  const contact    = enrichment.contact || {};
  const email      = contact.email || lead.email || '';
  const classification = classifyEmail(email);
  const bio = igProfile.bio || igProfile.biography || null;
  const companyName = cleanCompanyName(lead.company_name || lead.ime || '');

  // Extract reel captions/transcripts (top 3 for brevity)
  const reelSamples = igReels
    .slice(0, 3)
    .map(r => r.caption || r.transcript || '')
    .filter(Boolean);

  // Ad copies — stored at top-level intake_data.ad_copies (from source_leads pipeline)
  const adCopies = (lead.intake_data?.ad_copies || enrichment.ad_copies || []).slice(0, 3).filter(Boolean);

  const businessType = inferBusinessTypeFromContext(lead.niche, bio, companyName);

  return {
    email_classification: classification,
    email_type: emailType,
    demo_tenant_url: lead.demo_tenant_url || null,
    company_name: companyName,
    contact_name: (() => {
      if (classification !== 'decision_maker') return null;
      if (contact.name) return contact.name;
      // Extract first name from email prefix (e.g. anita@, vukasin.plavsic@ → "Vukasin")
      const pfx = email.split('@')[0].toLowerCase();
      const part = pfx.split(/[._-]/)[0];
      if (part && part.length >= 2) return part.charAt(0).toUpperCase() + part.slice(1);
      return null;
    })(),
    contact_role: contact.title || null,
    niche: lead.niche || 'other',
    business_type: businessType,
    // Primary context — use this to understand what the business actually does
    instagram_bio: bio || null,
    website: lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, '') : null,
    instagram_followers: igProfile.followers || igProfile.follower_count || lead.instagram_followers || 0,
    active_ads_count: lead.intake_data?.active_ads_count || 0,
    instagram_reels: reelSamples,
    ad_copies: adCopies,
    website_summary: enrichment.website_summary || null,
    subject_variant: demoStats ? 3 : subjectVariant(lead.company_name || lead.ime || ''),
    demo_stats: demoStats,
  };
}

// ── System Prompts (A/B framework test + follow-up sequence) ──────────────────
// Arm A: long form (4-paragraph "system overview") — current default
// Arm B: short form (3-line specific observation + question) — challenger
// E2: second touch ("did you log in?")
// E3: third touch ("closing your demo")
const FRAMEWORKS = {
  'operator':          { file: 'ai-agent-email-prompt-operator.md', label: 'Operator' },
  '4-para-overview':   { file: 'ai-agent-email-prompt.md',       label: 'A (long, retired)'  },
  '3-line-question':   { file: 'ai-agent-email-prompt-short.md', label: 'B (short)' },
  'e2-did-you-log-in': { file: 'ai-agent-email-prompt-e2.md',    label: 'E2'        },
  'e3-closing-demo':   { file: 'ai-agent-email-prompt-e3.md',    label: 'E3'        },
};

function getSystemPrompt(framework) {
  const fw = FRAMEWORKS[framework];
  if (!fw) throw new Error(`Unknown framework: ${framework}`);
  try {
    return readFileSync(resolve(__dirname, fw.file), 'utf8');
  } catch {
    throw new Error(`${fw.file} not found`);
  }
}

// 50/50 deterministic assignment from lead.id (UUID) so reruns are stable per lead.
// Uses the first hex char of the UUID — even = A, odd = B.
function assignFramework(leadId) {
  const force = process.env.FORCE_FRAMEWORK;
  if (force && FRAMEWORKS[force]) return force;
  // The A/B between the two chatbot-era arms is over — both sold "an AI that answers
  // messages, cheaper than staff", and between them produced 332 sends and 0 closes.
  // Everything now generates on the operator framing. Set FORCE_FRAMEWORK to run an
  // old arm deliberately.
  return 'operator';
}

// ── OpenAI API Call ───────────────────────────────────────────────────────────
async function generateDraft(leadIntel, systemPrompt) {
  const completion = await openai.chat.completions.create({
    model:           OPENAI_MODEL,
    temperature:     0.85,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: JSON.stringify(leadIntel, null, 2) },
    ],
  });

  const text = completion.choices[0].message.content || '';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI returned non-JSON: ${text.slice(0, 300)}`);
  }

  if (!parsed.subject || !parsed.body) {
    throw new Error(`OpenAI response missing subject or body: ${JSON.stringify(parsed).slice(0, 200)}`);
  }

  return `Subject: ${parsed.subject}\n\n${parsed.body}`;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  // Cache prompts so we don't re-read for every lead
  // Load every framework, so adding one to FRAMEWORKS can't silently yield an
  // empty system prompt (which is what an undefined cache entry produced).
  const promptCache = Object.fromEntries(
    Object.keys(FRAMEWORKS).map(k => [k, getSystemPrompt(k)])
  );

  // .neq alone silently drops NULL rows in Postgres — must explicitly include NULLs
  const notDisqualified = 'kategorija.neq.Disqualified,kategorija.is.null';

  // Fetch enriched leads (initial outreach)
  // Gate on demo_built_at for initial outreach — skip leads without a demo unless --force
  const ALLOW_NO_DEMO = process.argv.includes('--allow-no-demo') || isForce;
  const APPROVED_ONLY = process.argv.includes('--approved'); // only cockpit-approved leads (pipeline_stage='demo_building')

  let enrichedQuery = sb
    .from('contacts')
    .select('*')
    .eq('client_id', SMARTFLOW_ID)
    .in('status', ['enriched', 'No Draft', 'Demo Izgrađen'])
    .or(notDisqualified)
    .not('email', 'is', null);

  // Only generate for leads whose demo tenant is already built (unless bypassed)
  if (!ALLOW_NO_DEMO) {
    enrichedQuery = enrichedQuery.not('demo_built_at', 'is', null);
  }

  // In the cockpit's build-approved chain, only draft for freshly-approved leads —
  // never re-touch the archived cold pile (which shares status enriched/No Draft).
  if (APPROVED_ONLY) {
    enrichedQuery = enrichedQuery.eq('pipeline_stage', 'demo_building');
  }

  // Fetch Kontaktiran leads (E2 second touch)
  let e2Query = sb
    .from('contacts')
    .select('*')
    .eq('client_id', SMARTFLOW_ID)
    .eq('status', 'Kontaktiran')
    .or(notDisqualified)
    .not('email', 'is', null);

  // Fetch Kontaktiran leads (E3 third touch — same status, different draft field)
  let e3Query = sb
    .from('contacts')
    .select('*')
    .eq('client_id', SMARTFLOW_ID)
    .eq('status', 'Kontaktiran')
    .or(notDisqualified)
    .not('email', 'is', null);

  // Skip leads that already have drafts unless --force or --company is set
  if (!COMPANY && !isForce) {
    enrichedQuery = enrichedQuery.is('email_draft', null);
    e2Query       = e2Query.is('email_2_draft', null);
    e3Query       = e3Query.is('email_3_draft', null);
  }

  if (COMPANY) {
    enrichedQuery = enrichedQuery.ilike('company_name', `%${COMPANY}%`);
    e2Query       = e2Query.ilike('company_name', `%${COMPANY}%`);
    e3Query       = e3Query.ilike('company_name', `%${COMPANY}%`);
  }

  const isE2Mode = MODE === 'e2' || MODE === 'followup';
  const isE3Mode = MODE === 'e3';

  const [{ data: enrichedLeads, error: e1Err }, { data: e2Leads, error: e2Err }, { data: e3Leads, error: e3Err }] = await Promise.all([
    enrichedQuery,
    e2Query,
    e3Query,
  ]);

  if (e1Err) { console.error('Supabase error (enriched):', e1Err.message); process.exit(1); }
  if (e2Err) { console.error('Supabase error (e2):', e2Err.message); process.exit(1); }
  if (e3Err) { console.error('Supabase error (e3):', e3Err.message); process.exit(1); }

  const enriched    = (!isE2Mode && !isE3Mode) ? (enrichedLeads || []).map(l => ({ lead: l, emailType: 'enriched' })) : [];
  const followupsE2 = (isE2Mode || MODE === 'all')  ? (e2Leads || []).map(l => ({ lead: l, emailType: 'e2' })) : [];
  const followupsE3 = isE3Mode ? (e3Leads || []).map(l => ({ lead: l, emailType: 'e3' })) : [];
  let queue = [...enriched, ...followupsE2, ...followupsE3];

  if (LIMIT > 0) queue = queue.slice(0, LIMIT);

  const date = new Date().toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
  console.log(`\nSmartFlow Draft Generator — ${date}`);
  console.log(`Enriched (initial): ${enriched.length}  |  E2 (follow-up): ${followupsE2.length}  |  E3 (closing): ${followupsE3.length}  |  Queue: ${queue.length}${isDryRun ? ' [DRY RUN]' : ''}`);
  console.log(`Model: ${OPENAI_MODEL}\n`);

  if (queue.length === 0) {
    console.log('Nothing to generate — all eligible leads already have drafts.');
    return;
  }

  let done = 0, failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const { lead, emailType } = queue[i];
    const name = lead.company_name || lead.ime || '(no name)';
    const isFollowUp = emailType === 'e2' || emailType === 'e3';
    const emailTypeLabel = emailType === 'e3' ? 'E3' : emailType === 'e2' ? 'E2' : 'initial';

    console.log(`[${i + 1}/${queue.length}] ${name}  [${emailTypeLabel}]`);
    console.log(`  Email: ${lead.email}`);

    // Per-lead framework assignment (A/B test) — only for initial outreach.
    // E2/E3 follow-ups use their own dedicated prompts.
    const framework = emailType === 'e3' ? 'e3-closing-demo'
                    : emailType === 'e2' ? 'e2-did-you-log-in'
                    : assignFramework(lead.id);
    const systemPrompt = promptCache[framework];
    if (!systemPrompt) throw new Error(`No system prompt loaded for framework '${framework}'`);

    const demoStats = (!isFollowUp && lead.demo_client_id)
      ? await fetchDemoStats(sb, lead.demo_client_id)
      : null;
    const intel = buildLeadIntel(lead, emailType, demoStats);

    // Personalization-context guard (T4.2): if we have NO ad copy AND NO reel content
    // AND no website summary, the LLM has nothing concrete to anchor a hook to and
    // produces generic templated drafts that historically don't convert. Skip.
    const hasContext = (intel.ad_copies?.length || 0) > 0
      || (intel.instagram_reels?.length || 0) > 0
      || !!intel.website_summary;
    if (!isFollowUp && !hasContext && !isForce) {
      console.log(`  ↷ No ad/reel/website context — marking enriched_no_context, skipping\n`);
      if (!isDryRun) {
        await sb.from('contacts').update({ status: 'enriched_no_context' }).eq('id', lead.id);
      }
      continue;
    }

    const draftFieldName = emailType === 'e3' ? 'email_3_draft' : emailType === 'e2' ? 'email_2_draft' : 'email_draft';

    if (isDryRun) {
      console.log(`  Classification: ${intel.email_classification}  |  Followers: ${intel.instagram_followers}  |  Ads: ${intel.active_ads_count}  |  Variant: ${intel.subject_variant}  |  Framework: ${framework}`);
      console.log(`  ✓ [DRY RUN — would generate ${draftFieldName}]\n`);
      continue;
    }

    try {
      const draft = await generateDraft(intel, systemPrompt);

      const subjectLine = draft.match(/^Subject:\s*(.*)$/m)?.[1] || '(no subject)';
      console.log(`  Subject: ${subjectLine}`);

      const updateField = emailType === 'e3'
        ? { email_3_draft: draft }
        : emailType === 'e2'
          ? { email_2_draft: draft }
          : { email_draft: draft, email_framework: framework, subject_variant: intel.subject_variant };
      const { error: updateErr } = await sb.from('contacts').update(updateField).eq('id', lead.id);

      if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

      console.log(`  ✓ Saved to ${draftFieldName}\n`);
      done++;
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}\n`);
      failed++;
    }

    if (i < queue.length - 1 && !isDryRun) {
      await sleep(DELAY_MS);
    }
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Generated: ${done}  |  Failed: ${failed}`);
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
