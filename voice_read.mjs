/**
 * voice_read.mjs — would a person type this? Scores every AGENT line of a demo's hero chats the way Nikola read SLW's ("what kinda person
 * would unironically say BELEŽIM?"). The claims gate checks WHAT is said; this checks HOW (docs/dm-voice.md). Not a phrase list.
 *
 * v1 (open "flag what sounds off", one read) was not a measurement: 2-4 different lines per run, rewrites identical to the line, and it
 * flagged the standard's own good example (2026-11-12, three writers chased it for an hour). v2 measures:
 *   - every agent line gets a score 1-5 (1 = a bot/form/ticket wrote it, 5 = this business's best salesperson typed it)
 *   - 3 independent reads, line order shuffled each time; a line's score is the median
 *   - CONTROL lines with known answers are mixed in as ordinary conversations: lines Nikola rejected must score <=2, lines a person
 *     would type must score >=4. A read that gets the controls wrong is discarded; no valid read = "inconclusive", never "ok".
 *   - flagged = median <= 2 (blocks, readiness "tone" ✗). median 3 = advisory ("could be warmer"), shown, does not block.
 *
 *   node voice_read.mjs --email <tenant>[,<tenant>] [--save]
 *   node voice_read.mjs --stage email_ready [--save]
 * At least 2 of the 3 reads must be valid, else inconclusive (rerun).
 * --save stores clients.onboarding_copy.voice_read = { ok, at, model, reads, flags[], advisory[], hash }.
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
process.env.GEMINI_RPM ||= '14'
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const READS = 3
const MIN_VALID = 2
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null }
const SAVE = process.argv.includes('--save')
const STANDARD = readFileSync(resolve(__dirname, 'docs/dm-voice.md'), 'utf8')

/** Known answers. bad = lines Nikola rejected or their exact kind; good = lines a person types. Not in the standard's examples on purpose. */
export const CONTROLS = [
  { id: 'c1', want: 'bad', customer: 'Treba mi kontejner 20 stopa, nov, sa dostavom u Zemun.', agent: 'Beležim: 20 stopa, nov, isporuka u Zemun. Za ponudu mi pošaljite ime i broj telefona.' },
  { id: 'c2', want: 'bad', customer: 'Ana Petrović, 064 111 2233', agent: 'Hvala, Ana. Zahtev za ponudu je upisan i prosleđen.' },
  { id: 'c3', want: 'bad', customer: 'Stigla mi je oštećena stolica.', agent: 'Razumem Vaše nezadovoljstvo. Vaša reklamacija je evidentirana i biće obrađena u skladu sa zakonom o zaštiti potrošača.' },
  { id: 'c4', want: 'good', customer: 'Imate li ovu jaknu u crnoj, M?', agent: 'Imamo, da, i crna M je tu.\nNa koju adresu šaljemo?' },
  { id: 'c5', want: 'good', customer: 'Ana Petrović, 064 111 2233', agent: 'Hvala Vam, Ana!\nJavljamo Vam se sa cenom za Zemun.' },
  { id: 'c6', want: 'good', customer: 'Koliko traje ugradnja?', agent: 'Ugradnja je obično jedan dan.\nKoji model Vas zanima?' },
]

const PROMPT = (name, captions, items) => `You are a senior sales trainer in Serbia. Below are Instagram DM replies written by businesses to customers.
Score ONLY the voice of each AGENT reply (the business side): would the best salesperson of that business, typing on a phone, write exactly
this? You do not judge facts (checked separately). You do not reward length or politeness formulas.

THE STANDARD:
${STANDARD}

HOW "${name}" WRITES TO CUSTOMERS (its own post captions, for register):
${captions || '(no captions available)'}

THE REPLIES (id | what the customer had just written | the AGENT reply; "\\n" is a line break):
${items.map((x) => `${x.id} | ${x.customer.replace(/\n/g, '\\n')} | ${x.agent.replace(/\n/g, '\\n')}`).join('\n')}

Score every id:
5 = exactly what a good salesperson types
4 = a person wrote it, fine
3 = acceptable but stiff
2 = a customer would suspect a bot, form or ticket system
1 = obviously a bot, form, ticket system or legal text
Return JSON: {"scores":[{"id":"<id>","score":<1-5>,"why":"<short reason, English>","rewrite":"<only when score <= 2: the same content as a person types it, Serbian, \\n allowed, no new facts, no new time promises>"}]}`

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }

/** Pure: given the reads (arrays of {id,score,why,rewrite}), which are valid and what each line's verdict is. */
export function judge(reads, lineIds) {
  const want = Object.fromEntries(CONTROLS.map((c) => [c.id, c.want]))
  const valid = reads.filter((r) => CONTROLS.every((c) => {
    const s = r.find((x) => x.id === c.id)?.score
    return typeof s === 'number' && (want[c.id] === 'bad' ? s <= 2 : s >= 4)
  }))
  // one read that got the controls right is still one opinion (Bee Bike passed on 1/3 when Gemini timed out, 2026-11-12)
  if (valid.length < MIN_VALID) return { inconclusive: true, valid: valid.length, flags: [], advisory: [] }
  const flags = [], advisory = []
  for (const id of lineIds) {
    const got = valid.map((r) => r.find((x) => x.id === id)).filter((x) => typeof x?.score === 'number')
    if (!got.length) continue
    const m = median(got.map((x) => x.score))
    const worst = got.sort((a, b) => a.score - b.score)[0]
    if (m <= 2) flags.push({ id, score: m, why: worst.why, rewrite: worst.rewrite })
    else if (m === 3) advisory.push({ id, score: m, why: worst.why })
  }
  return { inconclusive: false, valid: valid.length, flags, advisory }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  const llm = makeLlm()
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
    const items = [], text = {}
    lines.forEach((r, i) => {
      if (r.role !== 'assistant') return
      const prev = lines.slice(0, i).reverse().find((p) => p.role === 'user' && p.id_razgovora === r.id_razgovora)
      const id = `${r.id_razgovora.replace(/^demo_[0-9a-f]+_/, '')}#${i}`
      items.push({ id, customer: prev?.message || '(opens the conversation)', agent: r.message }); text[id] = r.message
    })
    const captions = (c.onboarding_copy?.customer_voice?.posts || []).slice(0, 4).map((p) => `- ${String(p.caption || '').replace(/\s+/g, ' ').slice(0, 220)}`).join('\n')
    const reads = []
    for (let k = 0; k < READS; k++) {
      try {
        const resp = await llm.chat.completions.create({ temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: PROMPT(c.name, captions, shuffle([...items, ...CONTROLS])) }] })
        reads.push(JSON.parse(resp.choices[0].message.content || '{}').scores || [])
      } catch (e) { console.log(`  ${c.name}: read ${k + 1} failed (${String(e.message || e).slice(0, 100)})`) }
    }
    const v = judge(reads, items.map((x) => x.id))
    if (v.inconclusive) { console.log(`\n? ${c.name}: inconclusive (${reads.length} read(s), fewer than ${MIN_VALID} scored the control lines right) — not ok`); if (SAVE) await sb.from('clients').update({ onboarding_copy: { ...(c.onboarding_copy || {}), voice_read: { ok: false, inconclusive: true, at: new Date().toISOString(), model: process.env.GEMINI_MODEL, reads: 0, flags: [], advisory: [] } } }).eq('id', c.id); continue }
    total += v.flags.length
    console.log(`\n${v.flags.length ? '✗' : '✓'} ${c.name}: ${v.flags.length} line(s) read like a machine · ${v.advisory.length} stiff · ${v.valid}/${READS} valid reads`)
    for (const f of v.flags) console.log(`   ✗ [${f.score}] ${f.id}: ${text[f.id].replace(/\n/g, ' / ')}\n       why: ${f.why}\n       → ${String(f.rewrite || '').replace(/\n/g, ' / ')}`)
    for (const a of v.advisory) console.log(`   ~ [3] ${a.id}: ${text[a.id].replace(/\n/g, ' / ')}  (${a.why})`)
    if (SAVE) {
      const hash = createHash('sha1').update(JSON.stringify(lines.map((r) => r.message))).digest('hex').slice(0, 16)
      await sb.from('clients').update({ onboarding_copy: { ...(c.onboarding_copy || {}), voice_read: { ok: v.flags.length === 0, at: new Date().toISOString(), model: process.env.GEMINI_MODEL, reads: v.valid, flags: v.flags.map((f) => ({ ...f, text: text[f.id] })), advisory: v.advisory.map((a) => ({ ...a, text: text[a.id] })), hash } } }).eq('id', c.id)
    }
  }
  console.log(`\n${total} flagged line(s) across ${tenants.length} demo(s)`)
}
