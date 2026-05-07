/**
 * SmartFlow Cold Outreach Sender
 *
 * Sends pre-generated email_draft emails via nodemailer + Gmail App Password.
 * Reads from contacts table, marks sent leads, respects daily cap.
 *
 * Usage (from ai-growth-dashboard/):
 *   node send_outreach.mjs                                  — send up to DAILY_CAP enriched leads
 *   node send_outreach.mjs --mode followup                  — send follow-up emails (Kontaktiran leads)
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
const isDryRun    = process.argv.includes('--dry-run');
const testIdx     = process.argv.indexOf('--test');
const TEST_EMAIL  = testIdx !== -1 ? process.argv[testIdx + 1] : null;
const limitIdx    = process.argv.indexOf('--limit');
const DAILY_CAP   = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : Infinity;
const modeIdx     = process.argv.indexOf('--mode');
const MODE        = modeIdx !== -1 ? process.argv[modeIdx + 1] : 'initial'; // 'initial' | 'followup'
const companyIdx  = process.argv.indexOf('--company');
const COMPANY     = companyIdx !== -1 ? process.argv[companyIdx + 1] : null;
const DELAY_MIN_MS = 180_000; // 3min fixed between sends
const DELAY_MAX_MS = 180_000;
function randomDelay() { return DELAY_MIN_MS; }

// ── Ordering ───────────────────────────────────────────────────────────────────
const KAT_ORDER  = { 'Vreo': 0, 'Topao': 1, 'Hladan': 2 };
const SKIP_NAMES = new Set(['Temu Asia', 'Orion Telekom', 'CGSHOPPP', 'PATIKE HUB', 'Zen House Sarajevo']);
// Banned words that should never appear in the subject — drafts containing these need regeneration
const BANNED_SUBJECT_RX = /automatizovati|automatizuje|automatizovano|automatizacija/i;
// Domains that are clearly not real business emails
const BOGUS_DOMAINS = new Set(['instagram.com', 'airbnb.com', 'facebook.com', 'tiktok.com', 'pubgmobile.com']);
// Emails that are clearly image filenames scraped by mistake, or have invalid domains
function isBogusEmail(email) {
  if (!email) return true;
  if (/\.(webp|png|jpg|jpeg|gif|svg)(@|$)/i.test(email)) return true;
  if (/@.*\.(webp|png|jpg|jpeg|gif|svg)$/i.test(email)) return true;
  // Domain must have a valid TLD (2-10 lowercase letters, nothing else after)
  const domain = email.split('@')[1] || '';
  if (!/^[a-z0-9][a-z0-9.\-]+\.[a-z]{2,10}$/i.test(domain)) return true;
  return false;
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
  const isFollowUp = MODE === 'followup';

  let query = sb
    .from('contacts')
    .select('id, company_name, email, kategorija, email_draft, email_2_draft, instagram_followers')
    .eq('client_id', SMARTFLOW_ID)
    .not('email', 'is', null);

  // .neq alone drops NULL rows — must explicitly include NULLs
  query = query.or('kategorija.neq.Disqualified,kategorija.is.null');

  if (isFollowUp) {
    query = query
      .eq('status', 'Kontaktiran')
      .eq('email_2_poslat', false)
      .not('email_2_draft', 'is', null);
  } else {
    query = query
      .in('status', ['enriched', 'No Draft'])
      .eq('email_1_poslat', false);
  }

  if (COMPANY) {
    query = query.ilike('company_name', `%${COMPANY}%`);
  }

  const { data: leads, error } = await query;

  if (error) { console.error('Supabase error:', error.message); process.exit(1); }

  const draftField = isFollowUp ? 'email_2_draft' : 'email_draft';

  const seenEmails = new Set();
  const sendable = leads
    .filter(l => {
      if (SKIP_NAMES.has(l.company_name)) return false;
      if (!l[draftField]) return false;
      if (isBogusEmail(l.email)) return false;
      const subject = l[draftField].split('\n')[0];
      if (BANNED_SUBJECT_RX.test(subject)) { console.warn(`⚠  ${l.company_name} — banned word in subject, skipping (needs regen)`); return false; }
      const domain = l.email?.split('@')[1]?.toLowerCase();
      if (domain && BOGUS_DOMAINS.has(domain)) return false;
      // Deduplicate: skip if we already have this recipient address
      const addr = l.email?.toLowerCase();
      if (addr && seenEmails.has(addr)) return false;
      if (addr) seenEmails.add(addr);
      return true;
    })
    .sort((a, b) => {
      const k = (KAT_ORDER[a.kategorija] ?? 9) - (KAT_ORDER[b.kategorija] ?? 9);
      return k !== 0 ? k : (b.instagram_followers || 0) - (a.instagram_followers || 0);
    });

  const queue = TEST_EMAIL ? [sendable[0]] : sendable.slice(0, DAILY_CAP);

  const date = new Date().toLocaleDateString('sr-RS', { day:'2-digit', month:'2-digit', year:'numeric' });
  console.log(`\nSmartFlow Outreach — ${date}  [mode: ${isFollowUp ? 'follow-up' : 'initial'}]`);
  console.log(`Sendable leads: ${sendable.length}  |  Queue today: ${queue.length}${isDryRun ? ' [DRY RUN]' : ''}${TEST_EMAIL ? ` [TEST → ${TEST_EMAIL}]` : ''}${COMPANY ? ` [company: ${COMPANY}]` : ''}`);
  console.log(`From: ${SENDER_NAME} <${GMAIL_USER}>\n`);

  if (queue.length === 0) {
    console.log('Nothing to send — all enriched leads already emailed.');
    return;
  }

  let sent = 0, failed = 0;

  for (let i = 0; i < queue.length; i++) {
    const lead   = queue[i];
    const parsed = parseDraft(lead[draftField]);
    if (!parsed) { console.warn(`⚠  ${lead.company_name} — unparseable draft (${draftField}), skipping`); failed++; continue; }

    const to = TEST_EMAIL || lead.email;
    console.log(`[${i + 1}/${queue.length}] ${lead.company_name}`);
    console.log(`  To:      ${to}${TEST_EMAIL ? `  (real: ${lead.email})` : ''}`);
    console.log(`  Subject: ${parsed.subject}`);

    if (isDryRun) { console.log(`  ✓ [DRY RUN]\n`); continue; }

    // Atomically claim this lead before sending — prevents double-send if two
    // script instances run concurrently (TOCTOU race on the initial bulk fetch).
    if (!TEST_EMAIL) {
      const claimField = isFollowUp ? 'email_2_poslat' : 'email_1_poslat';
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
      const htmlBody = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;color:#1a1a1a;line-height:1.75">${markdownToHtml(parsed.body)}</div>`;

      const info = await transporter.sendMail({
        from:    `"${SENDER_NAME}" <${GMAIL_USER}>`,
        to,
        subject: parsed.subject,
        text:    textBody,
        html:    htmlBody,
        replyTo: GMAIL_USER,
        headers: {
          'List-Unsubscribe': `<mailto:${GMAIL_USER}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      // Update metadata after successful send (flag already set in claim step)
      if (!TEST_EMAIL) {
        const metaPayload = isFollowUp
          ? { last_sent_at: new Date().toISOString(), status: 'Follow Up' }
          : { last_sent_at: new Date().toISOString(), status: 'Kontaktiran' };
        await sb.from('contacts').update(metaPayload).eq('id', lead.id);
      }

      console.log(`  ✓ Sent  [${info.messageId}]\n`);
      sent++;
    } catch (err) {
      // Roll back the claim so the lead can be retried in the next run
      if (!TEST_EMAIL) {
        const claimField = isFollowUp ? 'email_2_poslat' : 'email_1_poslat';
        await sb.from('contacts').update({ [claimField]: false }).eq('id', lead.id);
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
