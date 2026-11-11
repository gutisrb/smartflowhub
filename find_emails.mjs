/**
 * find_emails.mjs — fills the missing e-mail of leads, layered and cheapest first (lib/email-finder.mjs).
 *
 *   node find_emails.mjs [--stages demo_building,novi,sourced] [--ids a,b] [--apply] [--no-hunter] [--max-hunter 5]
 *
 * Dry run by default: prints the address, which layer found it and the evidence. --apply writes
 * contacts.email and intake_data.email_source = { source, evidence, at }. Hunter is the last layer and is capped.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { findEmail } from './lib/email-finder.mjs'
import { pickApifyToken } from './lib/apify-key.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '') }
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null }
const APPLY = process.argv.includes('--apply')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const stages = (arg('--stages') || 'demo_building,novi,sourced').split(',')
const ids = arg('--ids')?.split(',')
let hunterLeft = Number(arg('--max-hunter') ?? 5)

let q = sb.from('contacts').select('id,company_name,website,email,instagram_handle,intake_data').eq('client_id', SF)
q = ids ? q.in('id', ids) : q.in('pipeline_stage', stages)
const { data } = await q
const todo = (data || []).filter((r) => !r.email || !/@/.test(r.email))
console.log(`${todo.length} lead(s) without an e-mail${APPLY ? '' : ' (dry run)'}`)
const key = await pickApifyToken(0.05, { quiet: true })
let found = 0
for (const r of todo) {
  console.log(`\n${r.company_name} · @${r.instagram_handle} · ${r.website || 'no website'}`)
  const res = await findEmail(r, { apifyToken: key?.token || null, hunter: !process.argv.includes('--no-hunter') && hunterLeft > 0, log: (s) => console.log(s) })
  if (res.source?.startsWith('hunter')) hunterLeft--
  if (!res.email) { console.log(`  ✗ none (tried ${res.tried.join(', ')})`); continue }
  found++
  console.log(`  → ${res.email}  [${res.source}] ${res.evidence}`)
  if (APPLY) await sb.from('contacts').update({ email: res.email, intake_data: { ...(r.intake_data || {}), email_source: { source: res.source, evidence: res.evidence, at: new Date().toISOString() } } }).eq('id', r.id)
}
console.log(`\n${found}/${todo.length} found${APPLY ? ' and saved' : ' (run with --apply to save)'}`)
