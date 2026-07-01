/**
 * SmartFlow Cold Outreach Sender
 *
 * Sends pre-generated email_draft emails via nodemailer + Gmail App Password.
 * Reads from contacts table, marks sent leads, respects daily cap.
 *
 * Usage (from ai-growth-dashboard/):
 *   node send_outreach.mjs                                  — send up to DAILY_CAP enriched leads
 *   node send_outreach.mjs --mode followup                  — send follow-up emails (Kontaktiran leads)
 *   node send_outreach.mjs --mode approved                  — send only leads with approved_to_send=true
 *                                                              (operator-approved via the dashboard cockpit;
 *                                                              clears the flag after a successful send)
 *   node send_outreach.mjs --dry-run                        — preview queue, no sends
 *   node send_outreach.mjs --test johhnylaa@gmail.com       — send first lead to test address
 *   node send_outreach.mjs --company "TRI O"                — target single company by name
 *   node send_outreach.mjs --limit 20                       — override daily cap
 */

import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as dns } from 'dns';

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
const GMAIL_USER    = process.env.GMAIL_USER    || 'nikola@smartflow.rs';
const GMAIL_PASS    = process.env.GMAIL_APP_PASSWORD;
const SENDER_NAME   = 'Nikola iz SmartFlow';

if (!GMAIL_PASS) {
  console.error('✗ GMAIL_APP_PASSWORD not set in .env.local');
  process.exit(1);
}

// ── CLI args ───────────────────────────────────────────────────────────────────
const isDryRun     = process.argv.includes('--dry-run');
const testIdx      = process.argv.indexOf('--test');
const TEST_EMAIL   = testIdx !== -1 ? process.argv[testIdx + 1] : null;
const limitIdx     = process.argv.indexOf('--limit');
const DAILY_CAP    = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : Infinity;
const modeIdx      = process.argv.indexOf('--mode');
const MODE         = modeIdx !== -1 ? process.argv[modeIdx + 1] : 'initial'; // 'initial' | 'followup' | 'e2' | 'e3' | 'approved'
const companyIdx   = process.argv.indexOf('--company');
const COMPANY      = companyIdx !== -1 ? process.argv[companyIdx + 1] : null;
const ALLOW_NO_DEMO = process.argv.includes('--allow-no-demo'); // skip demo requirement

// Loom thumbnail (optional — injected only when env vars are set)
const LOOM_URL       = process.env.LOOM_DEMO_URL       || null;
const LOOM_THUMB_URL = process.env.LOOM_THUMBNAIL_URL  || null;
const DELAY_MIN_MS = 180_000; // 3min fixed between sends
const DELAY_MAX_MS = 180_000;
function randomDelay() { return DELAY_MIN_MS; }

// ── Ordering ───────────────────────────────────────────────────────────────────
const KAT_ORDER  = { 'Vreo': 0, 'Topao': 1, 'Hladan': 2 };
// Generic mailbox prefixes — these get 2.5x lower reply rate and 2.7x higher bounce rate
// in our historical data, so they are ranked below decision-maker emails at send time.
const GENERIC_PREFIX_RX = /^(info|kontakt|contact|office|admin|support|hello|mail|sales|prodaja|podrska|reklamacije|customer|service|webshop|shop|store|narudzbe|pretplata|prodavnica|hr|posao|career|jobs)@/i;
function isDecisionMakerEmail(email) {
  return email ? !GENERIC_PREFIX_RX.test(email) : false;
}
const SKIP_NAMES = new Set(['Temu Asia', 'Orion Telekom', 'CGSHOPPP', 'PATIKE HUB', 'Zen House Sarajevo']);
// Banned words that should never appear in the subject — drafts containing these need regeneration
const BANNED_SUBJECT_RX = /automatizovati|automatizuje|automatizovano|automatizacija/i;
// Domains that are clearly not real business emails
const BOGUS_DOMAINS = new Set(['instagram.com', 'airbnb.com', 'facebook.com', 'tiktok.com', 'pubgmobile.com']);
// TLD whitelist — common business TLDs we accept. Catches garbage scrapes like "dont.chase.your"
// where every part of the domain looks plausible to a regex but the TLD isn't real.
const VALID_TLDS = new Set([
  'rs','com','net','org','co','io','ai','me','info','biz','eu','ba','hr','si','mk',
  'us','uk','de','fr','it','es','nl','pl','at','ch','se','no','dk','fi','cz','sk','hu','ro','bg','gr','tr',
  'digital','store','tech','app','dev','online','shop','pro','health','clinic','life','studio',
  'agency','marketing','services','solutions','company','group','team','world','global','site','space','today','center',
  'ltd','llc','gmbh','academy','consulting','design','events','expert','fashion','finance','fitness','media','salon','travel',
]);
function isBogusEmail(email) {
  if (!email) return true;
  if (/\.(webp|png|jpg|jpeg|gif|svg)(@|$)/i.test(email)) return true;
  if (/@.*\.(webp|png|jpg|jpeg|gif|svg)$/i.test(email)) return true;
  // Domain must have a valid TLD (2-10 lowercase letters, nothing else after)
  const domain = email.split('@')[1] || '';
  if (!/^[a-z0-9][a-z0-9.\-]+\.[a-z]{2,10}$/i.test(domain)) return true;
  // TLD whitelist (catches garbage like "dont.chase.your")
  const tld = domain.split('.').pop().toLowerCase();
  if (!VALID_TLDS.has(tld)) return true;
  return false;
}

// MX cache — avoid duplicate DNS lookups for the same domain in one run
const mxCache = new Map();
async function hasMxRecord(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  try {
    const records = await dns.resolveMx(domain);
    const ok = Array.isArray(records) && records.length > 0;
    mxCache.set(domain, ok);
    return ok;
  } catch {
    mxCache.set(domain, false);
    return false;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** Convert **bold** and _italic_ markdown to HTML.
 *  \n\n = paragraph break, \n = line break within paragraph */
function markdownToHtml(text) {
  const applyInline = (s) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>');

  return text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(para => {
      const lines = para.split('\n').map(applyInline).join('<br>');
      return `<p style="margin:0 0 20px;line-height:1.75">${lines}</p>`;
    })
    .join('\n');
}

/** Strip markdown markers for plain-text fallback */
function stripMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/_(.+?)_/g, '$1');
}

function parseDraft(draft) {
  if (!draft) return null;
  const lines   = draft.split('\n');
  const subject = lines[0].replace(/^Subject:\s*/i, '').trim();
  const blankAt = lines.findIndex((l, i) => i > 0 && l.trim() === '');
  const body    = lines.slice(blankAt + 1).join('\n').trim();
  return { subject, body };
}

async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Create SMTP transporter ──────────────────────────────────────────────────
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // STARTTLS
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  });

  // Verify credentials before touching any leads
  if (!isDryRun) {
    try {
      await transporter.verify();
    } catch (err) {
      console.error(`✗ SMTP auth failed: ${err.message}`);
      process.exit(1);
    }
  }

  // ── Fetch sendable leads ─────────────────────────────────────────────────────
  const isE3       = MODE === 'e3';
  const isApproved = MODE === 'approved';
  const isFollowUp = MODE === 'followup' || MODE === 'e2' || isE3;

  let query = sb
    .from('contacts')
    .select('id, company_name, email, kategorija, email_draft, email_2_draft, email_3_draft, instagram_followers, comment, demo_tenant_email, demo_tenant_password, demo_tenant_url, demo_built_at, status, email_1_poslat, email_2_poslat, approved_to_send')
    .eq('client_id', SMARTFLOW_ID)
    .not('email', 'is', null);

  // Gate: initial sends require a built demo tenant, unless --allow-no-demo.
  // Approved mode resolves its own per-lead stage below and re-applies this
  // gate there (some approved leads are follow-ups, which don't need it).
  if (!isFollowUp && !isApproved && !ALLOW_NO_DEMO) {
    query = query.not('demo_built_at', 'is', null);
  }

  // .neq alone drops NULL rows — must explicitly include NULLs
  query = query.or('kategorija.neq.Disqualified,kategorija.is.null');

  if (isE3) {
    query = query
      .eq('status', 'Kontaktiran')
      .eq('email_3_poslat', false)
      .not('email_3_draft', 'is', null);
  } else if (isFollowUp) {
    query = query
      .eq('status', 'Kontaktiran')
      .eq('email_2_poslat', false)
      .not('email_2_draft', 'is', null);
  } else if (isApproved) {
    query = query.eq('approved_to_send', true);
  } else {
    query = query
      .in('status', ['enriched', 'No Draft'])
      .eq('email_1_poslat', false);
  }

  if (COMPANY) {
    query = query.ilike('company_name', `%${COMPANY}%`);
  }

  const { data: fetchedLeads, error } = await query;

  if (error) { console.error('Supabase error:', error.message); process.exit(1); }

  const draftField = isE3 ? 'email_3_draft' : isFollowUp ? 'email_2_draft' : 'email_draft';
  const claimFieldGlobal = isE3 ? 'email_3_poslat' : isFollowUp ? 'email_2_poslat' : 'email_1_poslat';

  // Approved mode: each approved lead may be due for its initial send or its
  // follow-up, depending on where it already is in the sequence — resolve
  // that per lead instead of assuming one global stage for the whole run.
  function resolveApprovedStage(lead) {
    // Check follow-up first: status === 'Kontaktiran' means they were already
    // contacted in practice, even for older rows where email_1_poslat was
    // never backfilled to true (that flag postdates some existing leads).
    if (lead.status === 'Kontaktiran' && !lead.email_2_poslat && lead.email_2_draft) {
      return { draftField: 'email_2_draft', claimField: 'email_2_poslat', isFollowUp: true };
    }
    if (lead.status !== 'Kontaktiran' && !lead.email_1_poslat && lead.email_draft) {
      if (!ALLOW_NO_DEMO && !lead.demo_built_at) return null; // preserve the initial-send demo gate
      return { draftField: 'email_draft', claimField: 'email_1_poslat', isFollowUp: false };
    }
    return null;
  }

  let leads = fetchedLeads;
  if (isApproved) {
    leads = [];
    for (const lead of fetchedLeads) {
      const stage = resolveApprovedStage(lead);
      if (!stage) { console.warn(`⚠  ${lead.company_name} — approved but no pending draft for its current stage, skipping`); continue; }
      leads.push({ ...lead, _stage: stage });
    }
  }

  const getDraftField = (l) => isApproved ? l._stage.draftField : draftField;
  const getClaimField = (l) => isApproved ? l._stage.claimField : claimFieldGlobal;
  const getIsFollowUp = (l) => isApproved ? l._stage.isFollowUp : isFollowUp;

  // Pass 1 — synchronous filters (cheap)
  const seenEmails = new Set();
  let stats = { skipNoEmailComment: 0, skipBogus: 0, skipBogusDomain: 0, skipBanned: 0, skipDup: 0, skipNoMx: 0 };
  const passSync = leads.filter(l => {
    if (SKIP_NAMES.has(l.company_name)) return false;
    const df = getDraftField(l);
    if (!l[df]) return false;
    // Skip leads where enrichment flagged the email as unverified
    if (l.comment && /no email found/i.test(l.comment)) { stats.skipNoEmailComment++; return false; }
    if (isBogusEmail(l.email)) { stats.skipBogus++; return false; }
    const subject = l[df].split('\n')[0];
    if (BANNED_SUBJECT_RX.test(subject)) { console.warn(`⚠  ${l.company_name} — banned word in subject, skipping (needs regen)`); stats.skipBanned++; return false; }
    const domain = l.email?.split('@')[1]?.toLowerCase();
    if (domain && BOGUS_DOMAINS.has(domain)) { stats.skipBogusDomain++; return false; }
    // Deduplicate: skip if we already have this recipient address
    const addr = l.email?.toLowerCase();
    if (addr && seenEmails.has(addr)) { stats.skipDup++; return false; }
    if (addr) seenEmails.add(addr);
    return true;
  });

  // Pass 2 — async MX record verification (parallelized with cache)
  const mxResults = await Promise.all(passSync.map(async l => {
    const domain = l.email.split('@')[1]?.toLowerCase();
    return { lead: l, hasMx: await hasMxRecord(domain) };
  }));
  const sendable = mxResults
    .filter(({ lead, hasMx }) => {
      if (!hasMx) { console.warn(`⚠  ${lead.company_name} <${lead.email}> — no MX record, skipping`); stats.skipNoMx++; return false; }
      return true;
    })
    .map(({ lead }) => lead)
    .sort((a, b) => {
      const k = (KAT_ORDER[a.kategorija] ?? 9) - (KAT_ORDER[b.kategorija] ?? 9);
      if (k !== 0) return k;
      // Decision-maker emails first within same kategorija (2.5x higher reply rate)
      const dmA = isDecisionMakerEmail(a.email) ? 0 : 1;
      const dmB = isDecisionMakerEmail(b.email) ? 0 : 1;
      if (dmA !== dmB) return dmA - dmB;
      return (b.instagram_followers || 0) - (a.instagram_followers || 0);
    });

  if (stats.skipNoEmailComment || stats.skipNoMx || stats.skipBogus) {
    console.log(`Pre-send filters: ${stats.skipNoEmailComment} no-email-found, ${stats.skipNoMx} no-MX, ${stats.skipBogus} bogus, ${stats.skipDup} duplicates`);
  }

  const queue = TEST_EMAIL ? sendable.slice(0, 1) : sendable.slice(0, DAILY_CAP);

  const date = new Date().toLocaleDateString('sr-RS', { day:'2-digit', month:'2-digit', year:'numeric' });
  console.log(`\nSmartFlow Outreach — ${date}  [mode: ${isApproved ? 'APPROVED' : isE3 ? 'E3' : isFollowUp ? 'E2' : 'initial'}]`);
  console.log(`Sendable leads: ${sendable.length}  |  Queue today: ${queue.length}${isDryRun ? ' [DRY RUN]' : ''}${TEST_EMAIL ? ` [TEST → ${TEST_EMAIL}]` : ''}${COMPANY ? ` [company: ${COMPANY}]` : ''}`);
  console.log(`From: ${SENDER_NAME} <${GMAIL_USER}>\n`);

  if (queue.length === 0) {
    console.log('Nothing to send — all enriched leads already emailed.');
    return;
  }

  let sent = 0, failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const lead   = queue[i];
    const parsed = parseDraft(lead[getDraftField(lead)]);
    if (!parsed) { console.warn(`⚠  ${lead.company_name} — unparseable draft (${getDraftField(lead)}), skipping`); failed++; continue; }

    const to = TEST_EMAIL || lead.email;
    console.log(`[${i + 1}/${queue.length}] ${lead.company_name}`);
    console.log(`  To:      ${to}${TEST_EMAIL ? `  (real: ${lead.email})` : ''}`);
    console.log(`  Subject: ${parsed.subject}`);

    if (isDryRun) { console.log(`  ✓ [DRY RUN]\n`); continue; }

    // Atomically claim this lead before sending — prevents double-send if two
    // script instances run concurrently (TOCTOU race on the initial bulk fetch).
    if (!TEST_EMAIL) {
      const claimField = getClaimField(lead);
      const { data: claimed } = await sb
        .from('contacts')
        .update({ [claimField]: true })
        .eq('id', lead.id)
        .eq(claimField, false)
        .select('id');
      if (!claimed || claimed.length === 0) {
        console.log(`  ↷ Already claimed by another process, skipping\n`);
        continue;
      }
    }

    try {
      const textBody = stripMarkdown(parsed.body);

      // ── Login block (injected when demo is available) ──────────────────────
      let loginBlockHtml = '';
      let loginBlockText = '';
      if (!getIsFollowUp(lead) && lead.demo_tenant_email && lead.demo_tenant_password) {
        const loginUrl   = lead.demo_tenant_url || 'https://app.smartflow.rs';
        const loginEmail = lead.demo_tenant_email;
        const loginPass  = lead.demo_tenant_password;

        // Loom thumbnail (optional)
        const loomHtml = LOOM_URL && LOOM_THUMB_URL
          ? `<p style="margin:12px 0">
               <a href="${LOOM_URL}" style="text-decoration:none">
                 <img src="${LOOM_THUMB_URL}" alt="Pogledajte 30-sek pregled" width="480" style="max-width:100%;border-radius:6px;border:1px solid #e5e7eb" />
               </a>
             </p>`
          : '';

        loginBlockHtml = `
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
<p style="margin:0 0 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Vaš sistem je live →</p>
<p style="margin:0 0 12px;font-family:'Courier New',Courier,monospace;font-size:14px;line-height:1.8;color:#111">
  🔗 <a href="${loginUrl}" style="color:#0ea5e9;font-weight:600">${loginUrl.replace('https://', '')}</a><br>
  Email: <strong>${loginEmail}</strong><br>
  Lozinka: <strong>${loginPass}</strong>
</p>
${loomHtml}`;

        loginBlockText = `\n\n─────────────────────────\nVaš sistem je live:\n${loginUrl}\nEmail: ${loginEmail}\nLozinka: ${loginPass}\n─────────────────────────`;
      }

      // Open-tracking pixel — served by Supabase edge function
      const trackingPixel = `<img src="${SUPABASE_URL}/functions/v1/track-open?id=${lead.id}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px" />`;
      const htmlBody = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.75">${markdownToHtml(parsed.body)}${loginBlockHtml}${trackingPixel}</div>`;

      const info = await transporter.sendMail({
        from:    `"${SENDER_NAME}" <${GMAIL_USER}>`,
        to,
        subject: parsed.subject,
        text:    textBody + loginBlockText,
        html:    htmlBody,
        replyTo: GMAIL_USER,
        headers: {
          'List-Unsubscribe': `<mailto:${GMAIL_USER}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      // Update metadata after successful send (flag already set in claim step)
      if (!TEST_EMAIL) {
        let metaPayload;
        if (isApproved) {
          metaPayload = {
            last_sent_at: new Date().toISOString(),
            status: lead._stage.isFollowUp ? 'Follow Up' : 'Kontaktiran',
            approved_to_send: false,
          };
        } else {
          metaPayload = isE3
            ? { last_sent_at: new Date().toISOString() }
            : isFollowUp
              ? { last_sent_at: new Date().toISOString(), status: 'Follow Up' }
              : { last_sent_at: new Date().toISOString(), status: 'Kontaktiran' };
        }
        await sb.from('contacts').update(metaPayload).eq('id', lead.id);
      }

      console.log(`  ✓ Sent  [${info.messageId}]\n`);
      sent++;
    } catch (err) {
      // Roll back the claim so the lead can be retried in the next run
      if (!TEST_EMAIL) {
        await sb.from('contacts').update({ [getClaimField(lead)]: false }).eq('id', lead.id);
      }
      console.error(`  ✗ Failed: ${err.message} (claim rolled back)\n`);
      failed++;
    }

    if (i < queue.length - 1 && !isDryRun) {
      const delay = randomDelay();
      console.log(`  ⏳ ${Math.round(delay / 1000)}s before next send…\n`);
      await sleep(delay);
    }
  }

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Sent: ${sent}  |  Failed: ${failed}`);
  if (sendable.length > queue.length && !TEST_EMAIL)
    console.log(`  Remaining for next run: ${sendable.length - queue.length}`);
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
