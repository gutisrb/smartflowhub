/**
 * SmartFlow Inbox Sync
 *
 * Scans nikola@smartflow.rs inbox for:
 *   - Replies from known leads   → sets replied_at, reply_snippet, reply_intent, status = 'Odgovorio'
 *   - Bounce notifications       → sets status = 'Bounced', comment prefix
 *
 * Usage:
 *   node sync_inbox.mjs            — last 60 days
 *   node sync_inbox.mjs --days 7   — last N days
 *   node sync_inbox.mjs --all      — all time (slow)
 */

import { ImapFlow }   from 'imapflow';
import { simpleParser } from 'mailparser';
import { createClient }  from '@supabase/supabase-js';
import { readFileSync }  from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath }   from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch { /* no .env.local */ }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GMAIL_USER   = process.env.GMAIL_USER   || 'nikola@smartflow.rs';
const GMAIL_PASS   = process.env.GMAIL_APP_PASSWORD;
const SMARTFLOW_ID = '69acf7e9-557e-4ca3-85bd-a785ef39e351';

if (!GMAIL_PASS) { console.error('✗ GMAIL_APP_PASSWORD not set'); process.exit(1); }

const daysIdx = process.argv.indexOf('--days');
const DAYS_BACK = process.argv.includes('--all') ? 3650
  : daysIdx !== -1 ? parseInt(process.argv[daysIdx + 1])
  : 60;

// ── Bounce detection ──────────────────────────────────────────────────────────
const BOUNCE_FROM_RX    = /mailer-daemon|postmaster|Mail Delivery Subsystem/i;
const BOUNCE_SUBJECT_RX = /delivery.status|undeliverable|mail delivery failed|returned mail|delivery failure|bounce|non.?delivery/i;

function isBounce(parsed) {
  const from = parsed.from?.text || '';
  const subject = parsed.subject || '';
  if (BOUNCE_FROM_RX.test(from)) return true;
  if (BOUNCE_SUBJECT_RX.test(subject)) return true;
  // DSN content type — mailparser returns header as object { value, params }
  const ct = parsed.contentType?.value || '';
  if (ct.includes('delivery-status') || ct.includes('multipart/report')) return true;
  return false;
}

// Extract the failed recipient from a bounce body
function extractBounceRecipient(parsed, emailIndex) {
  const body = parsed.text || parsed.html || '';
  // Look for email addresses in the bounce body that match our contacts
  const emails = [...body.matchAll(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,10}/g)]
    .map(m => m[0].toLowerCase());
  for (const addr of emails) {
    if (emailIndex.has(addr) && addr !== GMAIL_USER.toLowerCase()) {
      return emailIndex.get(addr);
    }
  }
  // Also check the Final-Recipient DSN header
  const dsn = parsed.headers?.get('final-recipient') || '';
  const m = dsn.match(/rfc822;\s*(.+)/);
  if (m) {
    const addr = m[1].trim().toLowerCase();
    if (emailIndex.has(addr)) return emailIndex.get(addr);
  }
  return null;
}

// ── Reply intent classification ───────────────────────────────────────────────
// LLM-based — classifies intent AND distinguishes auto-replies from real human responses.
// Falls back to keyword heuristic if LLM call fails.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const VALID_INTENTS = new Set([
  'interested', 'meeting_requested', 'not_interested', 'wrong_contact',
  'out_of_office', 'auto_reply', 'price_question', 'question', 'unclear'
]);

async function classifyIntentLLM(text, fromAddr) {
  if (!GEMINI_API_KEY || !text) return classifyIntentKeyword(text);
  const prompt = `You classify cold-outreach replies for a Serbian B2B SaaS sender.
Read the reply below and output ONLY one label from this list:

- interested            : human reply showing genuine interest, even cautious
- meeting_requested     : explicitly asks to schedule a call/meeting/demo, or provides a contact for one
- price_question        : asks about price, quote, or cost
- question              : asks any other clarifying question
- not_interested        : polite or hard rejection
- wrong_contact         : "I am no longer at this company" / "send to X" / contact moved on
- out_of_office         : human OOO/vacation/maternity reply (NOT a customer-service auto-reply)
- auto_reply            : automated customer-service / "your inquiry is registered" / "we will get back to you" / signed by a "tim"/"servis"/"služba" with no human personalization
- unclear               : cannot determine

Important:
- Treat boilerplate like "primili smo Vašu poruku, biće odgovoreno u najkraćem roku" or "Vaš zahtev je registrovan pod brojem" as auto_reply, not interested.
- Treat "Vašu ponudu možete proslediti na X@Y" as meeting_requested ONLY if it sounds like a forwarding ask for a real conversation; if it's a generic "send to compliance" reply, it's wrong_contact.
- Output ONLY the label. No explanation.

FROM: ${fromAddr || 'unknown'}
REPLY:
${text.slice(0, 1500)}

LABEL:`;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.0, maxOutputTokens: 16 }
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const label = (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim().toLowerCase().replace(/[^a-z_]/g, '');
    if (VALID_INTENTS.has(label)) return label;
    return classifyIntentKeyword(text);
  } catch {
    return classifyIntentKeyword(text);
  }
}

// Keyword fallback (the old classifier)
function classifyIntentKeyword(text) {
  const t = (text || '').toLowerCase();
  if (/primili smo vašu|biće vam odgovoreno|registrovan pod brojem|hvala vam što ste nas kontaktirali|vaša poruka je uspešno primljena/i.test(t))
    return 'auto_reply';
  if (/ne zanima|nije nam|nema interesovanja|zahvaljujemo.*ali|hvala.*ne|ne trebamo|nismo zainteresovani|no thanks|not interested|unsubscribe|odjavi/i.test(t))
    return 'not_interested';
  if (/nije.*deo kompanije|no longer with|left the company|napustio|prosledite na|sve mailove šaljite na/i.test(t))
    return 'wrong_contact';
  if (/zakaž|zakažimo|sastanak|demo|kad ste slobodni|dogovorimo|when can|schedule|meeting/i.test(t))
    return 'meeting_requested';
  if (/koja je cena|koliko košta|cenu|price|cost|quote/i.test(t))
    return 'price_question';
  if (/out of office|van kancela|odsutan|nisam dostupan|automatski odgovor|auto.reply/i.test(t))
    return 'out_of_office';
  if (/\?|šta|koji|kako|koliko|možete li|recite mi|tell me|what is|how does|can you/i.test(t))
    return 'question';
  if (/interesuje|odlično|super|sounds good|interested|zainteresovan/i.test(t))
    return 'interested';
  return 'unclear';
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Build email → contact map (all contacts that had email_1 sent)
  const { data: contacts, error: cErr } = await sb
    .from('contacts')
    .select('id, email, company_name, status, replied_at, comment')
    .eq('client_id', SMARTFLOW_ID)
    .eq('email_1_poslat', true)
    .not('email', 'is', null);

  if (cErr) { console.error('Supabase error:', cErr.message); process.exit(1); }

  const emailIndex = new Map(contacts.map(c => [c.email.toLowerCase(), c]));
  const selfAddr   = GMAIL_USER.toLowerCase();

  console.log(`\nSmartFlow Inbox Sync — ${new Date().toLocaleDateString('sr-RS')}`);
  console.log(`Watching ${contacts.length} sent contacts | Scanning last ${DAYS_BACK} days\n`);

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    logger: false,
  });

  await client.connect();

  let replies = 0, bounces = 0, skipped = 0;

  const lock = await client.getMailboxLock('INBOX');
  try {
    const since = new Date();
    since.setDate(since.getDate() - DAYS_BACK);

    const uids = await client.search({ since });
    if (uids.length === 0) {
      console.log('No messages found in date range.');
    } else {
      console.log(`Found ${uids.length} messages in inbox, scanning…\n`);

      for await (const msg of client.fetch(uids, { source: true, uid: true })) {
        let parsed;
        try {
          parsed = await simpleParser(msg.source);
        } catch { continue; }

        const fromAddr = parsed.from?.value?.[0]?.address?.toLowerCase() || '';

        // ── Bounce ──
        if (isBounce(parsed)) {
          const contact = extractBounceRecipient(parsed, emailIndex);
          if (contact && contact.status !== 'Bounced') {
            await sb.from('contacts').update({
              status: 'Bounced',
              comment: `[BOUNCE] ${new Date(parsed.date || Date.now()).toISOString().slice(0,10)}` +
                       (contact.comment ? ` | ${contact.comment}` : ''),
            }).eq('id', contact.id);
            console.log(`✗ BOUNCE  ${contact.company_name} <${contact.email}>`);
            bounces++;
          }
          continue;
        }

        // Skip messages sent by us
        if (fromAddr === selfAddr) { skipped++; continue; }

        // ── Reply from a known lead ──
        if (emailIndex.has(fromAddr)) {
          const contact = emailIndex.get(fromAddr);

          // Only update if not already marked as replied
          if (contact.replied_at) { skipped++; continue; }

          const body   = parsed.text || '';
          const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 200);
          const intent = await classifyIntentLLM(body, fromAddr);

          // Status mapping by intent — auto_reply must NOT mark as replied/move status
          const STATUS_BY_INTENT = {
            meeting_requested: 'Zakazan Sastanak',
            interested:        'Odgovorio',
            price_question:    'Odgovorio',
            question:          'Odgovorio',
            not_interested:    'Lost',
            wrong_contact:     'Wrong Contact',
            out_of_office:     contact.status,   // don't change
            auto_reply:        contact.status,   // don't change
            unclear:           'Odgovorio',
          };
          const newStatus = STATUS_BY_INTENT[intent] ?? 'Odgovorio';

          const payload = {
            reply_snippet:   snippet,
            reply_intent:    intent,
            gmail_thread_id: msg.uid?.toString(),
          };
          // Only mark as a real reply if it's a human response (not an auto-reply / OOO)
          if (intent !== 'auto_reply' && intent !== 'out_of_office') {
            payload.replied_at = (parsed.date || new Date()).toISOString();
            payload.status = newStatus;
          }

          await sb.from('contacts').update(payload).eq('id', contact.id);

          console.log(`✓ REPLY   ${contact.company_name} <${fromAddr}>`);
          console.log(`  Intent: ${intent} → status: ${payload.status || '(unchanged)'}`);
          console.log(`  "${snippet.slice(0, 80)}…"\n`);
          replies++;

          // Update local map so duplicate messages from same lead are skipped
          contact.replied_at = payload.replied_at;
        }
      }
    }
  } finally {
    lock.release();
    await client.logout();
  }

  // ── Deliverability report ─────────────────────────────────────────────────
  const { data: stats } = await sb
    .from('contacts')
    .select('status, replied_at, email_1_poslat')
    .eq('client_id', SMARTFLOW_ID)
    .or('kategorija.neq.Disqualified,kategorija.is.null');

  const totalSent    = stats.filter(s => s.email_1_poslat).length;
  const totalReplied = stats.filter(s => s.replied_at).length;
  const totalBounced = stats.filter(s => s.status === 'Bounced').length;
  const totalMeetings = stats.filter(s => s.status === 'Zakazan Sastanak' || s.status === 'Meeting Booked').length;
  const delivered    = totalSent - totalBounced;
  const replyRate    = totalSent > 0 ? ((totalReplied / delivered) * 100).toFixed(1) : 0;
  const bounceRate   = totalSent > 0 ? ((totalBounced / totalSent) * 100).toFixed(1) : 0;

  console.log('═══════════════════════════════════════════════════════');
  console.log(`  New replies found:  ${replies}`);
  console.log(`  New bounces found:  ${bounces}`);
  console.log('');
  console.log(`  Total sent:         ${totalSent}`);
  console.log(`  Delivered (est.):   ${delivered}  (${(100 - parseFloat(bounceRate)).toFixed(1)}% deliverability)`);
  console.log(`  Bounced:            ${totalBounced}  (${bounceRate}% bounce rate)`);
  console.log(`  Replied:            ${totalReplied}  (${replyRate}% reply rate)`);
  console.log(`  Meetings booked:    ${totalMeetings}`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1); });
