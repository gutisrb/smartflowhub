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

const SUPABASE_URL  = 'https://ndazbdkytcksmhoabtgs.supabase.co';
const SERVICE_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kYXpiZGt5dGNrc21ob2FidGdzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDQ5NzQ4MSwiZXhwIjoyMDg2MDczNDgxfQ.6PsYNOzdZeqpWXW3Pej_oLK5fV2MLDi34-SGkHHje2k';
const SMARTFLOW_ID  = '69acf7e9-557e-4ca3-85bd-a785ef39e351';
const GEMINI_KEY    = process.env.GEMINI_API_KEY;
const GEMINI_MODEL          = 'gemini-3.1-flash-lite-preview';
const GEMINI_MODEL_FALLBACK = 'gemini-2.5-flash';
const GEMINI_URL = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;

if (!GEMINI_KEY) {
  console.error('✗ GEMINI_API_KEY not set in .env.local');
  process.exit(1);
}

// ── CLI args ───────────────────────────────────────────────────────────────────
const isDryRun    = process.argv.includes('--dry-run');
const isForce     = process.argv.includes('--force'); // overwrite existing drafts
const companyIdx  = process.argv.indexOf('--company');
const COMPANY     = companyIdx !== -1 ? process.argv[companyIdx + 1] : null;
const limitIdx    = process.argv.indexOf('--limit');
const LIMIT       = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : 0;
const modeIdx     = process.argv.indexOf('--mode');
const MODE        = modeIdx !== -1 ? process.argv[modeIdx + 1] : 'all'; // 'all' | 'initial' | 'followup'
const DELAY_MS    = 2000; // 2s between Gemini calls

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

/** Build the lead intel object for Gemini */
function buildLeadIntel(lead, emailType) {
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

  // Ad copies
  const adCopies = (enrichment.ad_copies || []).slice(0, 2).filter(Boolean);

  const businessType = inferBusinessTypeFromContext(lead.niche, bio, companyName);

  return {
    email_classification: classification,
    email_type: emailType,
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
    subject_variant: subjectVariant(lead.company_name || lead.ime || ''),
  };
}

// ── System Prompt ──────────────────────────────────────────────────────────────
function getSystemPrompt() {
  try {
    return readFileSync(resolve(__dirname, 'ai-agent-email-prompt.md'), 'utf8');
  } catch {
    throw new Error('ai-agent-email-prompt.md not found');
  }
}

// ── Gemini API Call ────────────────────────────────────────────────────────────
async function callGemini(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res;
}

async function generateDraft(leadIntel, systemPrompt) {
  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [{
      role: 'user',
      parts: [{ text: JSON.stringify(leadIntel, null, 2) }]
    }],
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 1500,
    }
  };

  let res = await callGemini(GEMINI_URL(GEMINI_MODEL), body);

  // Fallback to 2.5-flash on quota/rate errors
  if (!res.ok && (res.status === 429 || res.status === 503 || res.status === 500)) {
    console.warn(`  ⚠  ${GEMINI_MODEL} unavailable (${res.status}), retrying with ${GEMINI_MODEL_FALLBACK}...`);
    res = await callGemini(GEMINI_URL(GEMINI_MODEL_FALLBACK), body);
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Strip any accidental markdown code fences
  let cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');

  // Extract just the JSON object (first { to last })
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Fallback: repair literal newlines inside string values
    try {
      const repaired = cleaned.replace(/"(body|subject)":\s*"([\s\S]*?)(?<!\\)"/g, (_, k, v) => {
        const escaped = v.replace(/\n/g, '\\n').replace(/\r/g, '');
        return `"${k}": "${escaped}"`;
      });
      parsed = JSON.parse(repaired);
    } catch {
      throw new Error(`Gemini returned non-JSON: ${cleaned.slice(0, 300)}`);
    }
  }

  if (!parsed.subject || !parsed.body) {
    throw new Error(`Gemini response missing subject or body: ${JSON.stringify(parsed).slice(0, 200)}`);
  }

  // Convert to parseDraft() format: "Subject: ...\n\nbody"
  return `Subject: ${parsed.subject}\n\n${parsed.body}`;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const systemPrompt = getSystemPrompt();

  // .neq alone silently drops NULL rows in Postgres — must explicitly include NULLs
  const notDisqualified = 'kategorija.neq.Disqualified,kategorija.is.null';

  // Fetch enriched leads (initial outreach)
  let enrichedQuery = sb
    .from('contacts')
    .select('*')
    .eq('client_id', SMARTFLOW_ID)
    .in('status', ['enriched', 'No Draft'])
    .or(notDisqualified)
    .not('email', 'is', null);

  // Fetch Kontaktiran leads (follow-up)
  let kontaktiranQuery = sb
    .from('contacts')
    .select('*')
    .eq('client_id', SMARTFLOW_ID)
    .eq('status', 'Kontaktiran')
    .or(notDisqualified)
    .not('email', 'is', null);

  // Skip leads that already have drafts unless --force or --company is set
  if (!COMPANY && !isForce) {
    kontaktiranQuery = kontaktiranQuery.is('email_2_draft', null);
  }

  if (COMPANY) {
    enrichedQuery   = enrichedQuery.ilike('company_name', `%${COMPANY}%`);
    kontaktiranQuery = kontaktiranQuery.ilike('company_name', `%${COMPANY}%`);
  }

  const [{ data: enrichedLeads, error: e1 }, { data: kontaktiranLeads, error: e2 }] = await Promise.all([
    enrichedQuery,
    kontaktiranQuery,
  ]);

  if (e1) { console.error('Supabase error (enriched):', e1.message); process.exit(1); }
  if (e2) { console.error('Supabase error (kontaktiran):', e2.message); process.exit(1); }

  const enriched    = MODE !== 'followup' ? (enrichedLeads  || []).map(l => ({ lead: l, emailType: 'enriched'     })) : [];
  const kontaktiran = MODE !== 'initial'  ? (kontaktiranLeads || []).map(l => ({ lead: l, emailType: 'kontaktirani' })) : [];
  let queue = [...enriched, ...kontaktiran];

  if (LIMIT > 0) queue = queue.slice(0, LIMIT);

  const date = new Date().toLocaleDateString('sr-RS', { day: '2-digit', month: '2-digit', year: 'numeric' });
  console.log(`\nSmartFlow Draft Generator — ${date}`);
  console.log(`Enriched (initial): ${enriched.length}  |  Kontaktiran (follow-up): ${kontaktiran.length}  |  Queue: ${queue.length}${isDryRun ? ' [DRY RUN]' : ''}`);
  console.log(`Model: ${GEMINI_MODEL}  (fallback: ${GEMINI_MODEL_FALLBACK})\n`);

  if (queue.length === 0) {
    console.log('Nothing to generate — all eligible leads already have drafts.');
    return;
  }

  let done = 0, failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const { lead, emailType } = queue[i];
    const name = lead.company_name || lead.ime || '(no name)';
    const isFollowUp = emailType === 'kontaktirani';

    console.log(`[${i + 1}/${queue.length}] ${name}  [${isFollowUp ? 'follow-up' : 'initial'}]`);
    console.log(`  Email: ${lead.email}`);

    if (isDryRun) {
      const intel = buildLeadIntel(lead, emailType);
      console.log(`  Classification: ${intel.email_classification}  |  Followers: ${intel.instagram_followers}  |  Ads: ${intel.active_ads_count}  |  Variant: ${intel.subject_variant}`);
      console.log(`  ✓ [DRY RUN — would generate ${isFollowUp ? 'email_2_draft' : 'email_draft'}]\n`);
      continue;
    }

    try {
      const intel = buildLeadIntel(lead, emailType);
      const draft = await generateDraft(intel, systemPrompt);

      const subjectLine = draft.match(/^Subject:\s*(.*)$/m)?.[1] || '(no subject)';
      console.log(`  Subject: ${subjectLine}`);

      const updateField = isFollowUp ? { email_2_draft: draft } : { email_draft: draft, email_framework: '3-sentence' };
      const { error: updateErr } = await sb.from('contacts').update(updateField).eq('id', lead.id);

      if (updateErr) throw new Error(`DB update failed: ${updateErr.message}`);

      console.log(`  ✓ Saved to ${isFollowUp ? 'email_2_draft' : 'email_draft'}\n`);
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
