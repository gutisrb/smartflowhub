/**
 * owner_read.mjs — the demo as its owner will read it, in one place. No browser.
 *
 * `audit_demo_reality.mjs` says whether a demo contradicts its business. This prints what the
 * business owner actually reads and sees, so a human (or Claude, as the owner) can judge it:
 *
 *   1. every tour card, in tour order, exactly as shown (lib/onboarding/tour-copy.mjs; step 1 is
 *      the same card on every demo)
 *   2. the three hero chats (sale, left, handoff)
 *   3. the CRM lines the tour points at (status as displayed, reason, comment)
 *   4. every line of the Ponuda tab (lib/onboarding/offer-copy.mjs)
 *
 * Then mechanical checks, flagged ⚠, for the defects that a read tends to miss:
 *   - a CRM reason that claims an objection the chat never staged
 *   - machine-sounding lines (AI_TELLS) anywhere the owner reads
 * Flags are warnings to look at, not verdicts; the read itself is the test.
 *
 * Run by build_demo_tenant.mjs after the audit. Output also saved to owner_reads/<email>.txt.
 *
 * Usage: node owner_read.mjs --all-pipeline | --email <tenant email> [--quiet] [--strict]
 *   --quiet   write the file and print only the one-line summary (the pipeline uses this)
 *   --strict  exit 1 when anything is flagged
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { salesModelOf, normalizeSalesModel } from './lib/sales-model.mjs'
import { AI_TELLS } from './lib/sales-playbook.mjs'
import { tourCopy } from './lib/onboarding/tour-copy.mjs'
import { offerCopy } from './lib/onboarding/offer-copy.mjs'
import { expandTourSlots } from './lib/onboarding/tour-slots.ts'
import { pipelineTenants } from './lib/pipeline-tenants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const args = process.argv.slice(2)
const quiet = args.includes('--quiet')
const strict = args.includes('--strict')
const emails = args.includes('--all-pipeline') ? await pipelineTenants() : [args[args.indexOf('--email') + 1]].filter(Boolean)
if (!emails.length) { console.error('usage: node owner_read.mjs --all-pipeline | --email <tenant email> [--quiet] [--strict]'); process.exit(2) }

// a customer line that really is hesitation or an objection (what a card may call "prigovor")
const OBJECTION_SAID = /skup|dosta za mene|preko budžeta|ne mogu|na rate|u rata|razmisl|garanci|loše vreme|lose vreme|predrago/i

const tag = (id) => String(id).replace(/^demo_\w{8}_/, '')
const msgLine = (m) => `${m.role === 'user' ? '  👤' : m.role === 'assistant' ? '  🤖' : '  ⚙'} ${m.metadata?.type === 'post_reply' ? '[↩ objava] ' : m.metadata?.type === 'image' ? '[slika] ' : ''}${m.message}`

async function read(email) {
  const { data: c } = await sb.from('clients').select('id,name,email,demo_niche,onboarding_copy').eq('email', email).maybeSingle()
  if (!c) return { text: `✗ ${email}: no such tenant\n`, flags: 1 }
  const oc = c.onboarding_copy || {}
  const sheet = oc.business_sheet || {}
  const flows = sheet.flows || {}
  const model = normalizeSalesModel(oc.sales_model) || salesModelOf(c.demo_niche)
  const labels = sheet.status_labels || {}
  const shown = (s) => labels[s] || s
  const out = []
  const flags = []
  const P = (s = '') => out.push(s)

  const { data: mods } = await sb.from('client_modules').select('module_key,is_enabled').eq('client_id', c.id)
  const enabled = (mods || []).filter((m) => m.is_enabled !== false).map((m) => m.module_key)
  const { data: convs } = await sb.from('razgovori').select('id_razgovora,role,message,metadata,created_at').eq('client_id', c.id).like('id_razgovora', '%_hero%').order('created_at')
  const byId = new Map()
  for (const m of convs || []) byId.set(m.id_razgovora, [...(byId.get(m.id_razgovora) || []), m])
  const heroIds = ['hero1', 'hero2', 'hero3'].map((k) => [...byId.keys()].find((id) => id.endsWith(`_${k}`))).filter(Boolean)
  const { data: crm } = await sb.from('demo_crm').select('id_razgovora,full_name,status,status_porudzbine,razlog,komentar').eq('client_id', c.id).like('id_razgovora', '%_hero%')
  const { data: statusRows } = await sb.from('demo_crm').select('status').eq('client_id', c.id)
  const { data: heroAppt } = await sb.from('appointments').select('start_time').eq('client_id', c.id).eq('urgency_reason', 'demo:hero')

  P(`━━━━ ${c.name}  <${email}>`)
  P(`     niche ${c.demo_niche} · model ${model} · flows ${Object.entries(flows).filter(([k, v]) => v === true && !['quote'].includes(k)).map(([k]) => k).join(', ') || '—'} · booking ${sheet.booking?.state || '—'}`)
  P(`     modules: ${enabled.join(', ')}`)
  P()

  // 1 ── the tour, in order, as shown
  const copy = tourCopy({ model, niche: c.demo_niche, flows })
  const slots = expandTourSlots(enabled)
  P(`── TOUR (${slots.length} cards)`)
  slots.forEach(({ slot }, i) => {
    const k = copy[slot]
    P(`  ${i + 1}/${slots.length} ${k.eyebrow.toUpperCase()}  [${slot}]`)
    P(`      ${k.title}`)
    P(`      ${k.body}`)
    P(`      → ${k.punch}`)
  })
  P()

  // 2 ── the hero chats
  P('── HERO CHATS')
  const chatText = {}
  for (const id of heroIds) {
    P(`  [${tag(id)}]  ${byId.get(id)[0]?.metadata?.name || ''}`)
    for (const m of byId.get(id)) P(msgLine(m))
    chatText[tag(id)] = byId.get(id).map((m) => m.message).join('\n')
    P()
  }

  // 3 ── the CRM lines the tour points at
  P('── CRM')
  const mix = {}
  for (const r of statusRows || []) mix[shown(r.status)] = (mix[shown(r.status)] || 0) + 1
  P(`  statuses shown: ${Object.entries(mix).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  for (const r of crm || []) {
    P(`  [${tag(r.id_razgovora)}] ${r.full_name} — ${shown(r.status)}${r.status_porudzbine ? ` / ${r.status_porudzbine}` : ''}`)
    P(`      razlog: ${r.razlog || '—'}`)
    if (r.komentar) P(`      komentar: ${r.komentar}`)
  }
  P(`  hero appointment: ${heroAppt?.length ? heroAppt.map((a) => a.start_time).join(', ') : 'none'}`)
  P()

  // 4 ── the Ponuda tab
  const o = offerCopy({ model, niche: c.demo_niche, flows })
  P('── PONUDA')
  P(`  ${o.headline}`)
  P(`  ${o.lead}`)
  for (const s of o.steps) P(`   ${o.steps.indexOf(s) + 1}. ${s.title}: ${s.body}`)
  P(`  ${o.effort}`)
  P(`  ${o.catchTitle} ${o.catchBody}`)
  for (const f of o.faq) P(`   ? ${f.q} — ${f.a}`)
  P(`  ${o.closeTitle} ${o.closeLine} — ${o.closeSign}`)
  P()

  // 5 ── mechanical checks
  const hero1User = (byId.get(heroIds.find((id) => id.endsWith('_hero1'))) || []).filter((m) => m.role === 'user').map((m) => m.message).join('\n')
  const heroCrm = (crm || []).find((r) => r.id_razgovora.endsWith('_hero1'))
  if (/skupo/i.test(heroCrm?.razlog || '') && !OBJECTION_SAID.test(hero1User)) flags.push(`CRM reason says "skupo", nobody said it in the sale chat: "${heroCrm.razlog}"`)
  const readable = [...Object.values(copy).map((k) => `${k.title} ${k.body} ${k.punch}`), ...(crm || []).map((r) => `${r.razlog} ${r.komentar}`), ...Object.values(chatText)].join('\n')
  for (const line of readable.split('\n')) if (AI_TELLS.test(line)) flags.push(`machine-sounding line: "${line.slice(0, 80)}"`)
  if (flags.length) { P('── ⚠ FLAGS'); for (const f of flags) P(`  ⚠ ${f}`); P() } else P('── no mechanical flags (the read above is still the test)\n')

  return { text: out.join('\n') + '\n', flags: flags.length, name: c.name }
}

mkdirSync(resolve(__dirname, 'owner_reads'), { recursive: true })
let total = 0
for (const email of emails) {
  const r = await read(email)
  total += r.flags
  writeFileSync(resolve(__dirname, 'owner_reads', `${email.replace(/[^\w@.+-]/g, '_')}.txt`), r.text)
  if (quiet) console.log(`${r.flags ? '⚠' : '✓'} owner read ${r.name || email}: ${r.flags} flag(s) → owner_reads/${email}.txt`)
  else console.log(r.text)
}
if (!quiet) console.log(total ? `⚠ ${total} flag(s) across ${emails.length} demo(s)` : `✓ no mechanical flags across ${emails.length} demo(s)`)
if (strict && total) process.exit(1)
