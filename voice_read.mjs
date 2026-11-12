/**
 * voice_read.mjs — reads every hero chat of a demo the way Nikola read SLW's ("what kinda person would unironically say BELEŽIM?") and names
 * each agent line that sounds like a machine, with why and a human rewrite that keeps the same facts. The claims gate checks WHAT is said;
 * this checks HOW (docs/dm-voice.md). Not a phrase list: a reader with the standard and the chat in front of it.
 *
 *   node voice_read.mjs --email <tenant> [--save]       one demo
 *   node voice_read.mjs --stage email_ready [--save]     every demo in that stage
 * --save stores clients.onboarding_copy.voice_read = { ok, at, flags[], hash } (readiness.mjs shows it).
 * Gemini only (lib/llm.mjs). A model read is advice for the writer, never proof of facts.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'crypto'
import { makeLlm } from './lib/llm.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '') }
process.env.GEMINI_MODEL ||= 'gemini-3.1-flash-lite'
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null }
const SAVE = process.argv.includes('--save')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const llm = makeLlm()
const STANDARD = readFileSync(resolve(__dirname, 'docs/dm-voice.md'), 'utf8')

const PROMPT = (name, captions, chats) => `You are a senior sales trainer in Serbia. You read Instagram DM conversations of the business "${name}" and judge ONLY the
voice of the AGENT lines (the business side): would the best salesperson of this business, typing on a phone, write exactly this? You do not
judge facts (they were checked separately) and you never add facts in a rewrite.

THE STANDARD (follow it exactly):
${STANDARD}

HOW THIS BUSINESS WRITES TO CUSTOMERS (its own post captions, for register: emoji or not, formal or relaxed):
${captions || '(no captions available)'}

THE CONVERSATIONS (each line: id | role | text; "\\n" inside a text is a line break):
${chats}

Return JSON: {"flags":[{"id":"<line id>","text":"<the agent line>","why":"<one short reason, in English>","rewrite":"<the same content as a person would type it, Serbian, may use \\n line breaks, no new facts>"}]}
Flag a line only when a Serbian customer would notice it sounds like a bot, a form, a ticket system or a legal text. A line that is fine is not
listed. Empty list when every agent line reads like a person.`

let tenants = []
if (arg('--email')) tenants = arg('--email').split(',')
else {
  const { data } = await sb.from('contacts').select('demo_tenant_email').eq('client_id', SF).eq('pipeline_stage', arg('--stage') || 'email_ready').not('demo_tenant_email', 'is', null)
  tenants = (data || []).map((r) => r.demo_tenant_email)
}
let total = 0
for (const t of tenants) {
  const { data: c } = await sb.from('clients').select('id,name,onboarding_copy').eq('email', t).single()
  const { data: rows } = await sb.from('razgovori').select('id_razgovora,role,message,created_at').eq('client_id', c.id).like('id_razgovora', '%_hero%').order('created_at')
  const lines = (rows || []).filter((r) => ['user', 'assistant'].includes(r.role) && r.message)
  const chats = lines.map((r, i) => `${r.id_razgovora}#${i} | ${r.role === 'assistant' ? 'AGENT' : 'CUSTOMER'} | ${r.message.replace(/\n/g, '\\n')}`).join('\n')
  const captions = (c.onboarding_copy?.customer_voice?.posts || []).slice(0, 4).map((p) => `- ${String(p.caption || '').replace(/\s+/g, ' ').slice(0, 220)}`).join('\n')
  let flags = []
  try {
    const resp = await llm.chat.completions.create({ model: process.env.GEMINI_MODEL, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: PROMPT(c.name, captions, chats) }] })
    flags = JSON.parse(resp.choices[0].message.content || '{}').flags || []
  } catch (e) { console.log(`${c.name}: voice read failed (${String(e.message || e).slice(0, 120)}) — not saved`); continue }
  total += flags.length
  console.log(`\n${flags.length ? '✗' : '✓'} ${c.name}: ${flags.length} line(s) read like a machine`)
  for (const f of flags) console.log(`   ${f.id}\n     ✗ ${String(f.text).replace(/\n/g, ' / ')}\n       why: ${f.why}\n     → ${String(f.rewrite).replace(/\n/g, ' / ')}`)
  if (SAVE) {
    const hash = createHash('sha1').update(JSON.stringify(lines.map((r) => r.message))).digest('hex').slice(0, 16)
    await sb.from('clients').update({ onboarding_copy: { ...(c.onboarding_copy || {}), voice_read: { ok: flags.length === 0, at: new Date().toISOString(), flags, hash } } }).eq('id', c.id)
  }
}
console.log(`\n${total} flagged line(s) across ${tenants.length} demo(s)`)
