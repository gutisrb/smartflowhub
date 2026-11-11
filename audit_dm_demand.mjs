/**
 * Does this business actually sell through its Instagram inbox?
 *
 * Every qualifying gate so far measures size (followers) and ticket (AOV). Neither says
 * whether customers message the business to buy — which is the only thing the product
 * fixes. Plemenita Ulja, Wellness Spa and MJOB all passed size/ticket and took a meeting
 * with no pain to solve. This reads the public evidence of DM demand instead:
 *   - captions/bio that push buyers to the inbox ("pišite u DM", "cena u inbox")
 *   - posts admitting the inbox is overloaded (the strongest signal there is)
 *   - buyer questions in the comments (cena? termin? dostava?) and whether anyone answered
 *   - whether the account is even alive, and whether anyone watches it (reel views vs followers)
 *
 * The judging lives in lib/dm-demand.mjs (shared with find_leads.mjs).
 * Read-only: nothing is written to the DB. 1 credit per profile; comments (1 credit per sampled
 * post) only for accounts that pass the profile check (2026-11-05).
 *
 * Usage: node audit_dm_demand.mjs [--stage email_ready] [--posts 3]
 *        node audit_dm_demand.mjs --handles a,b,c      — any handles, in the DB or not (sourcing candidates)
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { checkDemand, formatRow, makeScrapeCreators } from './lib/dm-demand.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  const raw = readFileSync(resolve(__dirname, '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim()
  }
} catch {}

const SMARTFLOW = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const STAGE = arg('--stage', 'email_ready')
const POSTS = Number(arg('--posts', 3))
const HANDLES = arg('--handles', '') ? arg('--handles', '').split(',').map(h => h.trim().replace(/^@/, '')).filter(Boolean) : null
const sc = makeScrapeCreators(process.env.SC_API_KEY)

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
let leads
if (HANDLES) {
  const { data: known } = await supabase.from('contacts').select('id,company_name,instagram_handle,instagram_followers,niche')
    .eq('client_id', SMARTFLOW).in('instagram_handle', HANDLES)
  leads = HANDLES.map(h => ({ ...(known || []).find(k => k.instagram_handle?.toLowerCase() === h.toLowerCase()), instagram_handle: h }))
} else {
  ({ data: leads } = await supabase.from('contacts')
    .select('id,company_name,instagram_handle,instagram_followers,niche')
    .eq('client_id', SMARTFLOW).eq('pipeline_stage', STAGE))
}

console.log(HANDLES ? `auditing ${leads.length} handles` : `auditing ${leads.length} leads in '${STAGE}'`)
const report = []
for (const l of leads) {
  const row = await checkDemand(sc, { handle: l.instagram_handle, followers: l.instagram_followers, name: l.company_name }, { posts: POSTS })
  row.niche = l.niche
  report.push(row)
  console.log(formatRow(row))
}

const out = resolve(__dirname, HANDLES ? 'dm_demand_handles.json' : `dm_demand_${STAGE}.json`)
writeFileSync(out, JSON.stringify(report, null, 2))
console.log(`\nA ${report.filter(r => r.tier === 'A').length} · B ${report.filter(r => r.tier === 'B').length} · C ${report.filter(r => r.tier === 'C').length} · ? ${report.filter(r => r.tier === '?').length}  → ${out}${sc.credits() !== null ? `  · ScrapeCreators credits left: ${sc.credits()}` : ''}`)
