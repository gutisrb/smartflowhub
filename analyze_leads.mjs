/**
 * analyze_leads.mjs — decide HOW EACH LEAD SELLS and what stops its buyers, for demos that
 * already exist (no full rebuild, no Firecrawl): reads the tenant's stored catalogue and terms,
 * fetches the business's own pages over plain HTTP for evidence, runs the objection engine
 * (lib/objection-engine.mjs) and stores the result.
 *
 * Writes:
 *   clients.onboarding_copy.sales_strategy  the grounded worries + call prep
 *   Internal/call-prep/<tenant>.md          private sheet for Nikola (outside the repo's public paths)
 * Never the niche, the tabs or the sales model: build_sheets.mjs decides those from the site.
 *
 * Usage:
 *   node analyze_leads.mjs --email varmus.info@gmail.com [--dry]
 *   node analyze_leads.mjs --all-pipeline [--dry]
 */
import { createClient } from '@supabase/supabase-js'
import { makeLlm } from './lib/llm.mjs'
import { readFileSync, mkdirSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { analyzeBusiness, callPrepMarkdown } from './lib/objection-engine.mjs'
import { normalizeOfferTerms } from './lib/sales-playbook.mjs'
import { pipelineTenants } from './lib/pipeline-tenants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const openai = makeLlm() // Gemini (lib/llm.mjs)

const args = process.argv.slice(2)
const DRY = args.includes('--dry')

const text = (html) => html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

/** Homepage + up to three internal pages that talk about prices, services or how they work. */
async function fetchEvidence(domain) {
  if (!domain) return ''
  const base = /^https?:/.test(domain) ? domain : `https://${domain}`
  const get = async (u) => { try { const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'Mozilla/5.0' } }); return r.ok ? await r.text() : '' } catch { return '' } }
  const home = await get(base)
  if (!home) return ''
  const links = [...home.matchAll(/href=["']([^"'#?]+)["']/gi)].map((m) => m[1])
    .map((h) => { try { return new URL(h, base).href } catch { return null } })
    .filter((h) => h && new URL(h).host === new URL(base).host && /cen|usluge|proizvod|kako|o-nama|about|faq|placanje|isporuk|dostav|garancij|kontakt|ponuda|rate|kredit/i.test(h))
  const pages = [...new Set(links)].slice(0, 3)
  const parts = [text(home).slice(0, 3500)]
  for (const p of pages) { const h = await get(p); if (h) parts.push(`[${p}] ${text(h).slice(0, 2200)}`) }
  return parts.join('\n\n').slice(0, 10000)
}

async function analyzeTenant(client) {
  const oc = client.onboarding_copy || {}
  const terms = normalizeOfferTerms(oc.offer_terms)
  const { data: cat } = await sb.from('services_catalog').select('name,category,price_min').eq('client_id', client.id).eq('is_active', true).order('sort_order')
  const catalogue = (cat || []).map((c) => `${c.name} — ${c.price_min ? `${Math.round(c.price_min).toLocaleString('de-DE')} RSD` : 'cena nije navedena'} — ${c.category || ''}`).join('\n')
  // the tenant does not always carry its site address; the lead row does
  let site = oc.catalog_source
  if (!site) { const { data: ct } = await sb.from('contacts').select('website').or(`email.eq.${client.email},demo_tenant_email.eq.${client.email}`).limit(1); site = ct?.[0]?.website || null }
  const evidence = await fetchEvidence(site)
  const top = Math.max(0, ...(cat || []).map((c) => c.price_min || 0))
  const strategy = await analyzeBusiness(openai, { name: client.name, evidence, catalogue, terms, fallbackModel: null, highTicket: top >= 100000 })
  return { strategy, terms, evidenceChars: evidence.length, catalogue }
}

// It used to also set sales_model, demo_niche and the calendar module from the model's one-word
// guess. That is how JetSet (a walk-in phone store) got a calendar. Those are decided by
// build_sheets.mjs from the site's own sentences now; this script only stores the strategy.
async function saveStrategy(client, strategy) {
  const oc = { ...(client.onboarding_copy || {}), sales_strategy: strategy }
  await sb.from('clients').update({ onboarding_copy: oc }).eq('id', client.id)
}

async function main() {
  const emails = args.includes('--all-pipeline') ? await pipelineTenants() : [args[args.indexOf('--email') + 1]].filter(Boolean)
  const { data: clients } = await sb.from('clients').select('id,name,email,demo_niche,onboarding_copy').in('email', emails)
  const out = resolve(__dirname, '..', '..', '..', '..', '..', 'Documents', 'antigravity', 'vibrant-franklin', 'Internal', 'call-prep')
  for (const c of clients || []) {
    const { strategy, terms, evidenceChars } = await analyzeTenant(c)
    console.log(`\n${c.name} (${c.demo_niche}) → ${strategy.sales_model} | evidence ${evidenceChars} chars | ${strategy.worries.length} grounded worries`)
    console.log(`  ${strategy.model_reason}`)
    for (const w of strategy.worries) console.log(`  [${w.id}/${w.approach}] „${w.customer_says}“ → ${w.agent_reply}`)
    for (const p of strategy.call_prep) console.log(`  call-prep: ${p.lever}`)
    if (strategy.failed) { console.log(`  ⛔ analysis failed (${strategy.error}): nothing saved`); continue }
    if (DRY) continue
    if (evidenceChars === 0) { console.log('  ⛔ no website evidence: model and niche left unchanged (rebuild this lead from its site first)'); continue }
    await saveStrategy(c, strategy)
    console.log('  saved: objection strategy (model/niche/tabs are build_sheets.mjs territory)')
    try { mkdirSync(out, { recursive: true }); writeFileSync(resolve(out, `${c.email.replace(/[^a-z0-9]+/gi, '-')}.md`), callPrepMarkdown({ name: c.name, strategy, terms })) } catch (e) { console.log('  (call-prep file not written:', e.message + ')') }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
