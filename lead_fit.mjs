/**
 * lead_fit.mjs — the reels-led lead gate as a table. READ-ONLY (no writes, no paid calls).
 *
 *   node lead_fit.mjs                       all leads in demo_building, email_ready and novi, plus the earlier-emailed three
 *   node lead_fit.mjs --stage email_ready   one stage
 *   node lead_fit.mjs --json                machine-readable
 *
 * Reach numbers come from clients' intake_data.dm_demand when the DB has them, else from the dm_demand_*.json files written
 * by audit_dm_demand.mjs / find_leads.mjs (matched by Instagram handle). A lead with no measurement is reported as
 * "reach not measured", never passed. The rule itself lives in lib/lead-fit.mjs.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { leadFit } from './lib/lead-fit.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}
const SMARTFLOW = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const STAGE = arg('--stage', null)
const AS_JSON = process.argv.includes('--json')

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// measurements on disk, newest file wins per handle
const byHandle = new Map()
for (const f of ['dm_demand_email_ready.json', 'dm_demand_handles.json', 'dm_demand_demo_building.json']) {
  const p = resolve(__dirname, f)
  if (!existsSync(p)) continue
  for (const r of JSON.parse(readFileSync(p, 'utf8'))) if (r.handle) byHandle.set(String(r.handle).toLowerCase(), { ...r, _file: f })
}

const REENTRY = ['Belodore Srbija', 'Kodzic Fashion', 'Demart Serbia D.O.O']
let q = sb.from('contacts')
  .select('company_name,email,instagram_handle,instagram_followers,pipeline_stage,niche,intake_data')
  .eq('client_id', SMARTFLOW)
q = STAGE ? q.eq('pipeline_stage', STAGE) : q.in('pipeline_stage', ['demo_building', 'email_ready', 'novi', 'sent'])
const { data, error } = await q
if (error) { console.error(error.message); process.exit(1) }

const rows = []
for (const c of data) {
  if (!STAGE && c.pipeline_stage === 'sent' && !REENTRY.includes(c.company_name)) continue
  const h = (c.instagram_handle || '').toLowerCase()
  const d = c.intake_data?.dm_demand
  const j = byHandle.get(h)
  const fromDb = d && d.median_views != null ? { medViews: d.median_views, viewsPerFollower: d.views_per_follower, daysSincePost: d.days_since_post, reels12: j?.reels12 ?? null, buyerQs: d.buyer_qs, src: `db ${d.checked_at || ''}` } : null
  const fromFile = j ? { medViews: j.medViews, viewsPerFollower: j.viewsPerFollower, daysSincePost: j.daysSincePost, reels12: j.reels12, buyerQs: j.buyerQs, inviteCaps: j.inviteCaps, src: j._file } : null
  const m = fromFile && (!fromDb || fromFile.reels12 != null) ? { ...fromDb, ...fromFile } : fromDb
  const fit = leadFit({
    name: c.company_name, followers: c.instagram_followers, email: c.email,
    medViews: m?.medViews ?? null, viewsPerFollower: m?.viewsPerFollower ?? null, reels12: m?.reels12 ?? null,
    daysSincePost: m?.daysSincePost ?? null, buyerQs: m?.buyerQs ?? null, inviteCaps: m?.inviteCaps ?? null,
    activeAds: c.intake_data?.active_ads_count ? Number(c.intake_data.active_ads_count) : null,
  })
  rows.push({ company: c.company_name, stage: c.pipeline_stage, followers: c.instagram_followers, ...m, email: c.email, ...fit })
}
rows.sort((a, b) => (b.pass - a.pass) || ((b.medViews ?? -1) - (a.medViews ?? -1)))

if (AS_JSON) { console.log(JSON.stringify(rows, null, 2)); process.exit(0) }
const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n)
console.log(`${pad('', 4)}${pad('lead', 34)}${pad('stage', 14)}${pad('followers', 10)}${pad('medViews', 10)}${pad('/fol', 7)}${pad('reels', 6)}${pad('last post', 10)} verdict`)
for (const r of rows) {
  const v = r.pass ? 'PASS' + (r.notes.length ? `  (${r.notes.join('; ')})` : '') : 'FAIL: ' + r.fails.join(' | ')
  console.log(`${r.pass ? 'OK  ' : 'NO  '}${pad(r.company, 34)}${pad(r.stage, 14)}${pad(r.followers, 10)}${pad(r.medViews, 10)}${pad(r.viewsPerFollower, 7)}${pad(r.reels12, 6)}${pad(r.daysSincePost != null ? r.daysSincePost + 'd' : '', 10)} ${v}`)
}
const pass = rows.filter(r => r.pass).length
console.log(`\n${pass} pass, ${rows.length - pass} fail, ${rows.filter(r => r.needsRemeasure).length} need a re-measure (stale or unmeasured)`)
