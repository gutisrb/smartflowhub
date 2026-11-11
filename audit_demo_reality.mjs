/**
 * audit_demo_reality.mjs — does each demo still look like the business it is for?
 *
 * Runs after every seed. A demo with a failure is not ready to send. Every rule here is a defect
 * that actually shipped once:
 *   - a calendar and appointments for a store whose site says "bez zakazivanja" (JetSet, 2026-10-26)
 *   - schedule statuses (Zakazano/Završeno) on shops (every product niche, until 2026-10-26)
 *   - courier / cash-on-delivery talk for a store nobody ships from
 *   - "nije na stanju, ali imam…" downsells and invented delivery promises (2026-09-03, 2026-10-26)
 *   - "konsultacije" a business never offered (Varmus, 2026-10-26)
 *   - "veličina M" asked of sofas and phones
 *   - a phone store whose catalogue held no phones
 *
 * Usage: node audit_demo_reality.mjs --all-pipeline | --email <tenant email>
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { salesModelOf, normalizeSalesModel } from './lib/sales-model.mjs'
import { AI_TELLS } from './lib/sales-playbook.mjs'
import { pipelineTenants } from './lib/pipeline-tenants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const args = process.argv.slice(2)
const emails = args.includes('--all-pipeline') ? await pipelineTenants() : [args[args.indexOf('--email') + 1]].filter(Boolean)

const fold = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const SHOP_STATUSES = new Set(['Novi', 'Zainteresovan', 'Naručio', 'Isporučeno', 'Reklamacija', 'Intervencija'])

async function all(table, cid, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from(table).select(cols).eq('client_id', cid).range(from, from + 999)
    out.push(...(data || [])); if (!data || data.length < 1000) break
  }
  return out
}

async function audit(c) {
  const oc = c.onboarding_copy || {}
  const sheet = oc.business_sheet
  const flows = sheet?.flows || {}
  const model = normalizeSalesModel(oc.sales_model) || salesModelOf(c.demo_niche)
  const [msgs, crm, cat, mods] = await Promise.all([
    all('razgovori', c.id, 'id_razgovora,role,message'),
    all('demo_crm', c.id, 'id_razgovora,full_name,status,status_porudzbine'),
    all('services_catalog', c.id, 'name,price_min,is_active'),
    sb.from('client_modules').select('module_key,is_enabled').eq('client_id', c.id).then((r) => r.data || []),
  ])
  const { count: appts } = await sb.from('appointments').select('*', { count: 'exact', head: true }).eq('client_id', c.id)
  const agent = msgs.filter((m) => m.role === 'assistant').map((m) => m.message).join('\n')
  const agentF = fold(agent)
  const calOn = !!mods.find((m) => m.module_key === 'calendar' && m.is_enabled !== false)
  const fails = []
  const check = (ok, msg) => { if (!ok) fails.push(msg) }

  check(!!sheet, 'no Business Sheet — run build_sheets.mjs')
  if (sheet) {
    check(calOn === !!flows.calendar, `calendar tab ${calOn ? 'on' : 'off'} but the sheet says ${flows.calendar ? 'booking' : 'no booking'}`)
    check(flows.calendar || !appts, `${appts} appointments for a business with no booking`)
    if (sheet.booking?.state === 'none') {
      const talk = agentF.replace(/zakazivanje nije potrebno|bez zakazivanja|ne treba\.?/g, '')
      check(!/\btermin|zakaz/.test(talk), 'appointment language in a business whose site says no booking')
    }
    if (flows.inStore && !flows.orderTracking) check(!/dostav|kurir|pouzec|adresu za dostavu/.test(agentF), 'delivery / courier talk in a store nobody ships from')
    if (flows.orderTracking) check(crm.some((r) => r.status_porudzbine), 'ships orders but no order has a delivery stage')
    if (sheet.offers?.some((o) => o.kind === 'product')) check(cat.filter((r) => r.is_active && r.price_min > 0).length >= 3, 'sells products but the catalogue has fewer than 3 priced products')
  }
  if (model === 'order') check(crm.every((r) => SHOP_STATUSES.has(r.status)), `schedule statuses on a shop: ${[...new Set(crm.filter((r) => !SHOP_STATUSES.has(r.status)).map((r) => r.status))].join(', ')}`)
  check(!/nije na stanju, ali imam|subotu pre podne|dan ranije vam javljamo/.test(agentF), 'invented stock-out / downsell / delivery promise')
  const consult = /konsultacij/.test(agentF) && !/konsult/.test(fold(JSON.stringify(oc.offer_terms || {})) + fold(JSON.stringify(sheet?.offers || [])) + fold(sheet?.booking?.quote))
  check(!consult, 'offers a consultation the business never states')
  // the agent must sound like a person in a DM, not like ChatGPT (2026-10-27)
  const tells = msgs.filter((m) => m.role === 'assistant' && /_(hero|bg|fill)/.test(m.id_razgovora) && AI_TELLS.test(m.message)).map((m) => m.message.slice(0, 50))
  check(!tells.length, `machine-sounding agent lines (${tells.length}): „${tells[0] || ''}…“`)
  check(String(c.demo_niche) === 'fashion' || !/velicini m\b/.test(fold(msgs.map((m) => m.message).join(' '))), 'asks about size M outside fashion')
  const hero = msgs.filter((m) => /_hero1$/.test(m.id_razgovora) && m.role === 'assistant').pop()?.message || ''
  // a hand-written hero ends where its own CRM row says (Tandem: a gift ticket bought, "Naručio");
  // the hero's last line must still agree with that status
  const heroStatus = sheet?.hero?.crm?.status
  // a clinic hero that books nothing (Cvejanović: the first step is an online review from home)
  // must end with what happens next, not with "Upisani ste"
  const { count: heroAppts } = await sb.from('appointments').select('*', { count: 'exact', head: true }).eq('client_id', c.id).eq('urgency_reason', 'demo:hero')
  const expect = heroStatus === 'Naručio' ? /kupil|kupio|naruč|porudžbin|vidimo se/i
    : flows.stays ? /vidimo se|rezerv/i : model === 'booking' ? (heroAppts ? /upisani ste|zakazano|termin/i : /ponud|pregled|javljamo/i) : model === 'quote' ? /ponud/i : flows.inStore && !flows.orderTracking ? /vidimo se u radnji/i : /porudžbin|porudzbin|rezervisano/i
  const heroAll = msgs.filter((m) => /_hero1$/.test(m.id_razgovora)).map((m) => m.message).join(' ')
  check(heroStatus === 'Naručio' ? expect.test(heroAll) : expect.test(hero), `hero ends off-process: „${hero.slice(0, 60)}“`)
  // model-written threads nobody checked against the site (retired 2026-10-27)
  const { count: unverified } = await sb.from('razgovori').select('*', { count: 'exact', head: true }).eq('client_id', c.id).like('id_razgovora', '%_conv_%')
  check(!unverified, `${unverified} messages in unverified model-written threads (_conv_) — re-run the seed`)
  // a business open only on some days has appointments only on those days (Tandem: Sat/Sun)
  const days = sheet?.booking?.days
  if (days?.length) {
    const { data: rows } = await sb.from('appointments').select('starts_at,urgency_reason').eq('client_id', c.id)
    const off = (rows || []).filter((a) => a.urgency_reason !== 'demo:hero' && !days.includes(new Date(a.starts_at).getDay()))
    check(!off.length, `${off.length} appointments on days the business does not work (site: „${sheet.booking.quote}“)`)
  }
  return { fails, model, calOn, appts, source: sheet?.source }
}

let bad = 0
const { data: clients } = await sb.from('clients').select('id,name,email,demo_niche,onboarding_copy').in('email', emails)
for (const c of clients || []) {
  const r = await audit(c)
  const tag = r.fails.length ? 'FAIL' : 'PASS'
  if (r.fails.length) bad++
  console.log(`${tag}  ${c.name.slice(0, 40).padEnd(40)} ${r.model.padEnd(7)} cal:${r.calOn ? 'on ' : 'off'} appts:${String(r.appts).padStart(3)} sheet:${r.source || '—'}`)
  for (const f of r.fails) console.log(`      ✗ ${f}`)
}
console.log(`\n${bad ? `${bad} demo(s) not ready.` : 'All demos pass.'}`)
process.exit(bad ? 1 : 0)
