/**
 * build_e1.mjs — the E1 cold email for one lead, from its hand sheet (sheets/<email>.json → "e1"), checked before
 * anyone reads it. Never sends.
 *
 * Refuses (exit 1, nothing written) when:
 *   - the lead has no hand sheet or no "e1" block (CLAUDE.md 2026-10-27: a demo that goes out has a hand sheet);
 *   - the lead has fewer than 3 real customer questions stored (onboarding_copy.customer_voice): line 1 says the
 *     demo is built from "pitanja koja kupci ostavljaju ispod Vaših objava", so that must be true;
 *   - the copy lint finds a red flag (lib/copy-red-flags.mjs).
 * Then prints the email and the lint output, and writes drafts/e1/<email>.txt.
 * --store also writes it to contacts.email_draft (what send_outreach.mjs sends; the old value is backed up first).
 * Storing is not sending: send_outreach.mjs still needs Nikola's go per batch.
 *
 * Usage: node build_e1.mjs --email varmus.info@gmail.com [--store]
 *        node build_e1.mjs --all [--store]        every "Email spreman" lead that has an e1 block
 *
 * The read is still the test (vault wiki/offer-voice.md §10): passing here means the facts hold, not that it is good.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { buildE1, missingSlots } from './lib/e1-template.mjs'
import { redFlags, bodyWords } from './lib/copy-red-flags.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)/); if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const SMARTFLOW = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const args = process.argv.slice(2)
const arg = (k) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : null }
const STORE = args.includes('--store')

async function targets() {
  if (arg('--email')) return [arg('--email')]
  const { data, error } = await sb.from('contacts').select('demo_tenant_email')
    .eq('client_id', SMARTFLOW).eq('pipeline_stage', 'email_ready').not('demo_tenant_email', 'is', null)
  if (error) throw new Error(error.message)
  return [...new Set(data.map((r) => r.demo_tenant_email))]
}

function realComments(voice) {
  const out = []
  for (const q of voice?.questions || []) out.push(q.text)
  for (const p of voice?.posts || []) {
    for (const q of p.questions || []) out.push(typeof q === 'string' ? q : q.text)
    for (const c of Array.isArray(p.comments) ? p.comments : []) out.push(typeof c === 'string' ? c : c.text)
  }
  return out.filter(Boolean)
}

async function one(email) {
  const problems = []
  const sheetFile = resolve(__dirname, 'sheets', `${email}.json`)
  if (!existsSync(sheetFile)) return { email, problems: ['no hand sheet: a demo that goes out needs one (2026-10-27)'] }
  const e = JSON.parse(readFileSync(sheetFile, 'utf8')).e1
  if (!e) return { email, problems: ['hand sheet has no "e1" block'] }
  const miss = missingSlots(e)
  if (miss.length) return { email, problems: [`e1 slots missing: ${miss.join(', ')}`] }

  const { data: client } = await sb.from('clients').select('id,name,onboarding_copy').eq('email', email).maybeSingle()
  if (!client) return { email, problems: ['no demo tenant with this email'] }

  // line 1 claims the demo is built from questions under its posts (DENTALUX's only stored "question" is political spam)
  const real = realComments(client.onboarding_copy?.customer_voice).filter((c) => c.length > 2 && c.length < 300)
  if (real.length < 3) problems.push(`only ${real.length} customer questions stored: line 1 would claim comments the demo was not built from`)

  const { subject, body, text } = buildE1(e)
  const lint = redFlags({ subject, body })
  problems.push(...lint.flags.map((f) => `lint: ${f}`))
  return { email, name: client.name, subject, body, text, warnings: lint.warnings, words: bodyWords(body), problems }
}

const results = []
for (const email of await targets()) results.push(await one(email))

mkdirSync(resolve(__dirname, 'drafts/e1'), { recursive: true })
const ok = []
for (const r of results) {
  console.log(`\n━━━━ ${r.name || r.email}  <${r.email}>`)
  if (r.problems.length) { for (const p of r.problems) console.log(`  ✗ ${p}`); continue }
  console.log(r.text)
  for (const w of r.warnings) console.log(`  ! ${w}`)
  console.log(`  ✓ hand sheet · real customer questions · no red flags · ${r.words} words`)
  writeFileSync(resolve(__dirname, 'drafts/e1', `${r.email}.txt`), r.text)
  ok.push(r)
}

if (STORE && ok.length) {
  const { data: rows } = await sb.from('contacts').select('id,company_name,demo_tenant_email,email_draft')
    .eq('client_id', SMARTFLOW).in('demo_tenant_email', ok.map((r) => r.email))
  mkdirSync(resolve(__dirname, 'backups'), { recursive: true })
  const bak = resolve(__dirname, 'backups', `e1_drafts_${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`)
  writeFileSync(bak, JSON.stringify(rows, null, 2))
  for (const r of ok) {
    const row = rows.find((x) => x.demo_tenant_email === r.email)
    if (!row) { console.log(`  ✗ ${r.email}: no contact row with this demo`); continue }
    // the blank line after the subject is required: send_outreach.mjs parseDraft() takes the body from after the first
    // blank line, so without it "Poštovani," is swallowed and the email opens on a lower-case "za Varmus…" (2026-11-05)
    const { error } = await sb.from('contacts').update({ email_draft: `Subject: ${r.subject}\n\n${r.body}` }).eq('id', row.id)
    console.log(error ? `  ✗ ${row.company_name}: ${error.message}` : `  → stored for ${row.company_name}`)
  }
  console.log(`  backup of previous drafts: ${bak}`)
}
console.log(`\n${ok.length}/${results.length} built${STORE ? ', stored (NOT sent)' : ''}`)
process.exit(ok.length === results.length ? 0 : 1)
