/**
 * build_sheets.mjs — build each lead's Business Reality Sheet (lib/business-sheet.mjs) from its own
 * site, verify every claim, and make the demo follow it.
 *
 * Source of the sheet, in order:
 *   1. sheets/<tenant email>.json   hand-written; every quote still verified against the live site
 *   2. the model (extractSheet)     when OpenAI works
 *   3. facts only (factsOnlySheet)  stated booking / cart / delivery sentences, nothing inferred
 * A failed step never becomes data: it is reported and the next source is used, and the source
 * is stored in the sheet so nobody mistakes a facts-only sheet for a full one.
 *
 * Writes clients.onboarding_copy.{business_sheet, sales_model, sales_strategy}, clients.demo_niche,
 * the calendar module's is_enabled, module labels, and (with --import-listings) the products the
 * site lists. Then prints the OWNER VIEW: read it as the owner before calling a demo done.
 *
 * Usage: node build_sheets.mjs --email bilasgoran@gmail.com [--import-listings] [--dry]
 *        node build_sheets.mjs --all-pipeline [--dry]
 */
import { createClient } from '@supabase/supabase-js'
import { makeLlm } from './lib/llm.mjs'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { fetchSite } from './lib/site-evidence.mjs'
import { verifySheet, extractSheet, factsOnlySheet, deriveFlows, statusLabelsFor } from './lib/business-sheet.mjs'
import { quoteInText } from './lib/business-facts.mjs'
import { extractListings } from './lib/catalog-extract.mjs'
import { groundWorries } from './lib/objection-engine.mjs'
import { nicheForModel, salesModelOf, normalizeSalesModel } from './lib/sales-model.mjs'
import { pipelineTenants } from './lib/pipeline-tenants.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)/); if (m) process.env[m[1].trim()] = m[2].trim()
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const openai = makeLlm() // Gemini (lib/llm.mjs); the variable keeps its old name so every call site below is unchanged

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const IMPORT = args.includes('--import-listings')
// --no-llm: never call a model. A hand sheet without offers keeps the Business Sheet already stored for the tenant (and only adds its
// hero, booking, labels and expert noun) instead of re-extracting it, so an LLM outage can never thin out a good sheet.
const NO_LLM = args.includes('--no-llm')

async function siteOf(client) {
  if (client.onboarding_copy?.catalog_source) return client.onboarding_copy.catalog_source
  const { data } = await sb.from('contacts').select('website').or(`email.eq.${client.email},demo_tenant_email.eq.${client.email}`).limit(1)
  return data?.[0]?.website || null
}

async function sheetFor(client, site) {
  const manualPath = resolve(__dirname, 'sheets', `${client.email}.json`)
  const manual = existsSync(manualPath) ? JSON.parse(readFileSync(manualPath, 'utf8')) : null
  // a hand-written sheet with offers replaces the automatic one; a file with only a hero choice
  // (which customer question opens the demo) keeps the automatic sheet
  if (manual?.offers?.length) {
    return { manual, sheet: verifySheet({ ...manual, source: 'manual' }, { evidenceText: site.corpus, html: site.home?.html }) }
  }
  if (NO_LLM) {
    const stored = client.onboarding_copy?.business_sheet
    if (!stored?.version) throw new Error(`--no-llm: ${client.email} has no stored Business Sheet to reuse and no hand-written offers`)
    console.log('  --no-llm: reusing the stored Business Sheet (source ' + (stored.source || '?') + ')')
    return { manual, sheet: withManualBooking({ ...stored }, manual, site) }
  }
  const llm = await extractSheet(openai, { name: client.name, evidenceText: site.evidenceText, corpus: site.corpus, html: site.home?.html })
  if (!llm.failed) return { manual, sheet: withManualBooking(llm, manual, site) }
  console.log(`  model unavailable (${llm.error.slice(0, 60)}…) → facts-only sheet`)
  return { manual, sheet: withManualBooking(factsOnlySheet({ evidenceText: site.corpus, html: site.home?.html, niche: client.demo_niche }), manual, site) }
}

// A hero-only file may also say how the business books, with the site's own sentence: Tandem's
// "Tandem skokovi su isključivo subotom i nedeljom" puts jumps on weekends only. The sentence is
// checked against the site like every other claim; without it the automatic booking stays.
function withManualBooking(sheet, manual, site) {
  const b = manual?.booking
  if (!b) return sheet
  if (!quoteInText(b.quote, site.corpus)) { console.log(`  ⚠ manual booking dropped: „${String(b.quote).slice(0, 60)}“ is not on the site`); return sheet }
  return { ...sheet, booking: { ...sheet.booking, ...b } }
}

/** booking / quote / order for the screens that still read the niche, decided by the sheet. */
function modelFor(sheet, flows, current) {
  if (flows.quote) return 'quote'
  if (flows.calendar || flows.stays) return 'booking'
  if (sheet.offers.length) return 'order'
  // the sheet says nothing about offers: keep what we had, but never a calendar it does not support
  return current === 'booking' ? 'order' : current
}

async function importListings(client, pages) {
  const { data: have } = await sb.from('services_catalog').select('name,sort_order').eq('client_id', client.id)
  const known = new Set((have || []).map((r) => r.name.toLowerCase()))
  let sort = Math.max(0, ...(have || []).map((r) => r.sort_order || 0))
  const rows = []
  // listing pages first, the homepage last: the homepage repeats a few items under a slogan heading
  const ordered = [...pages].sort((a, b) => (new URL(a.url).pathname === '/') - (new URL(b.url).pathname === '/'))
  for (const p of ordered) {
    const items = extractListings(p.html, p.url)
    if (!items.length) continue
    // the page's own address names the category ("/prodaja-polovnih-mobilnih-telefona/"); headings are slogans
    const slug = decodeURIComponent(new URL(p.url).pathname).split('/').filter(Boolean).pop() || ''
    const category = slug ? (slug.charAt(0).toUpperCase() + slug.slice(1)).replace(/-/g, ' ') : 'Proizvodi'

    for (const it of items) {
      const name = [it.name, ...it.specs].join(' ').replace(/\s+/g, ' ').trim()
      if (known.has(name.toLowerCase())) continue
      known.add(name.toLowerCase())
      rows.push({ client_id: client.id, name, category, description: it.condition, price_min: it.price.rsd, price_max: it.price.rsd, image_url: it.image, color_hex: '#10b981', is_featured: false, is_active: true, sort_order: ++sort })
    }
  }
  return rows
}

async function owner(client) {
  const { data: c } = await sb.from('clients').select('name,demo_niche,onboarding_copy').eq('id', client.id).single()
  const s = c.onboarding_copy?.business_sheet
  const { data: mods } = await sb.from('client_modules').select('module_key,display_name,is_enabled').eq('client_id', client.id).order('sort_order')
  const { count: cat } = await sb.from('services_catalog').select('*', { count: 'exact', head: true }).eq('client_id', client.id).eq('is_active', true)
  console.log(`  OWNER VIEW — ${c.name}`)
  console.log(`    sells:   ${(s?.offers || []).map((o) => `${o.name} (${o.how_bought}, ${o.fulfilment})`).join(' · ') || '— (no offer stated on the site)'}`)
  console.log(`    booking: ${s?.booking?.state}${s?.booking?.quote ? ` — „${s.booking.quote.slice(0, 90)}“` : ''}`)
  console.log(`    tabs:    ${(mods || []).filter((m) => m.is_enabled !== false).map((m) => m.display_name).join(' · ')}`)
  console.log(`    model:   ${c.onboarding_copy?.sales_model} (niche ${c.demo_niche}) · source ${s?.source} · catalogue ${cat} rows`)
  if (s?.status_labels && Object.keys(s.status_labels).length) console.log(`    words:   ${Object.entries(s.status_labels).map(([k, v]) => `${k}→${v}`).join(', ')}`)
}

async function run(client) {
  const siteUrl = await siteOf(client)
  const site = await fetchSite(siteUrl)
  console.log(`\n${client.name} — ${siteUrl || 'no site'} · ${site.pages.length} pages · ${site.evidenceText.length} chars`)
  if (!site.evidenceText) { console.log('  ⛔ no evidence: nothing changed (rebuild this lead from its site)'); return }

  const { sheet, manual } = await sheetFor(client, site)
  const current = normalizeSalesModel(client.onboarding_copy?.sales_model) || salesModelOf(client.demo_niche)
  const flows = deriveFlows(sheet, client.demo_niche)
  const model = modelFor(sheet, flows, current)
  const niche = nicheForModel(model, client.demo_niche)
  const words = statusLabelsFor({ ...flows, calendar: flows.calendar && model === 'booking' })
  const strategy = manual?.strategy
    ? { ...client.onboarding_copy?.sales_strategy, worries: groundWorries(manual.strategy.worries, { evidenceText: site.corpus, terms: client.onboarding_copy?.offer_terms }), call_prep: manual.strategy.call_prep || [], source: 'manual' }
    : client.onboarding_copy?.sales_strategy || null
  const dropped = (manual?.offers?.length || 0) - (manual ? sheet.offers.length : 0)
  console.log(`  sheet: ${sheet.source} · ${sheet.offers.length} offers${dropped ? ` (${dropped} dropped: quote not on the site)` : ''} · booking ${sheet.booking.state} · couriers ${sheet.shipping.couriers.join(', ') || '—'}`)
  console.log(`  calendar: ${flows.calendar && model === 'booking'} (${flows.reason.calendar}) · orders tracked: ${flows.orderTracking} · in-store: ${flows.inStore} · quote: ${flows.quote}`)
  console.log(`  model ${current} → ${model} · niche ${client.demo_niche} → ${niche}`)
  if (strategy?.worries) console.log(`  objections kept: ${strategy.worries.map((w) => w.id).join(', ') || 'none'}`)
  if (DRY) return

  const oc = {
    ...(client.onboarding_copy || {}),
    sales_model: model,
    sales_strategy: strategy,
    business_sheet: { ...sheet, ...(manual?.hero ? { hero: manual.hero } : {}), flows: { ...flows, calendar: flows.calendar && model === 'booking', ...(manual?.expert ? { expert: manual.expert } : {}) }, status_labels: { ...words.labels, ...(manual?.status_labels || {}) }, won_tile: manual?.won_tile || words.won_tile, pages: site.pages.map((p) => p.url), built_at: new Date().toISOString() },
  }
  await sb.from('clients').update({ demo_niche: niche, onboarding_copy: oc }).eq('id', client.id)
  const { data: mods } = await sb.from('client_modules').select('id,module_key,display_name').eq('client_id', client.id)
  for (const m of mods || []) {
    if (m.module_key === 'calendar') await sb.from('client_modules').update({ is_enabled: oc.business_sheet.flows.calendar }).eq('id', m.id)
  }
  const kinds = new Set(sheet.offers.map((o) => o.kind))
  const crmLabel = model === 'order' ? 'Kupci' : null
  // the business's own word for what it sells wins (Tandem: "Tandem skok Paketi", not fitness "Programi")
  const catLabel = manual?.labels?.catalog || (kinds.has('product') && kinds.size > 1 ? 'Katalog' : kinds.has('product') && model === 'order' ? 'Proizvodi' : null)
  for (const m of mods || []) {
    if (m.module_key === 'business-crm' && crmLabel && m.display_name !== crmLabel) await sb.from('client_modules').update({ display_name: crmLabel }).eq('id', m.id)
    if (m.module_key === 'agent-database' && catLabel && m.display_name !== catLabel) await sb.from('client_modules').update({ display_name: catLabel }).eq('id', m.id)
  }
  if (IMPORT) {
    const rows = await importListings(client, site.pages)
    if (rows.length) {
      const { error } = await sb.from('services_catalog').insert(rows)
      console.log(`  listings: ${error ? `ERR ${error.message}` : `${rows.length} products added from the site`}`)
    } else console.log('  listings: none found on the fetched pages')
  }
  await owner(client)
}

const emails = args.includes('--all-pipeline') ? await pipelineTenants() : [args[args.indexOf('--email') + 1]].filter(Boolean)
const { data: clients } = await sb.from('clients').select('id,name,email,demo_niche,onboarding_copy').in('email', emails)
for (const c of clients || []) await run(c)
