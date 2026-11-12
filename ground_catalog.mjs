/**
 * ground_catalog.mjs — a catalogue price is shown only if the business's own site states it (Nikola's rule: unknown stays unknown).
 * Keeps a price when the corpus holds the number in RSD, or holds it in EUR and RSD = EUR × 117 (the catalogue convention); nulls the rest.
 * (2026-11-12: TopDek's Katalog tab showed 6.143 / 8.190 / 5.850 RSD that appear nowhere on topdek.rs.)
 *
 *   node ground_catalog.mjs [--apply]        every demo in Demo se pravi / Email spreman
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '') }
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const APPLY = process.argv.includes('--apply')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

/** All the ways a number is written on a Serbian page: 8190, 8.190, 8,190, 8 190, 8.190,00 */
export function numberForms(n) {
  const i = Math.round(n)
  const g = String(i).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return [String(i), g, g.replace(/\./g, ','), g.replace(/\./g, ' '), g.replace(/\./g, ' ')]
}
export function priceOnSite(price, corpus) {
  const text = String(corpus || '')
  const found = (n) => numberForms(n).some((f) => new RegExp(`(?<![\\d.,])${f.replace(/[.,]/g, '\\$&')}(?![\\d])`).test(text))
  if (found(price)) return 'rsd'
  for (const d of [-1, 0, 1]) { const eur = Math.round(price / 117) + d; if (eur > 9 && Math.abs(eur * 117 - price) <= 117 && found(eur) && /€|eur|evra|evro/i.test(text)) return 'eur' }
  return null
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { data: leads } = await sb.from('contacts').select('demo_tenant_email').eq('client_id', SF).in('pipeline_stage', ['demo_building', 'email_ready']).not('demo_tenant_email', 'is', null)
  const only = process.argv.includes('--tenants') ? process.argv[process.argv.indexOf('--tenants') + 1].split(',') : null
  for (const l of (leads || []).filter((x) => !only || only.includes(x.demo_tenant_email))) {
    const f = resolve(__dirname, 'corpus', `${l.demo_tenant_email}.json`)
    if (!existsSync(f)) { console.log(`${l.demo_tenant_email}: no corpus yet (run verify_demo.mjs first)`); continue }
    const corpus = JSON.parse(readFileSync(f, 'utf8')).text
    const { data: c } = await sb.from('clients').select('id,name').eq('email', l.demo_tenant_email).single()
    const { data: cat } = await sb.from('services_catalog').select('id,name,price_min,price_max').eq('client_id', c.id).eq('is_active', true)
    const bad = (cat || []).filter((x) => x.price_min && !priceOnSite(x.price_min, corpus))
    if (!bad.length) continue
    console.log(`${c.name}: ${bad.length} price(s) not on the site → null: ${bad.map((x) => `${x.name.slice(0, 22)}=${x.price_min}`).join(' | ')}`)
    if (APPLY) for (const x of bad) await sb.from('services_catalog').update({ price_min: null, price_max: null }).eq('id', x.id)
  }
}
