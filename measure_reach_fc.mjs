#!/usr/bin/env node
/**
 * measure_reach_fc.mjs — reel reach for UNMEASURED leads, from Firecrawl's read of the Instagram profile page (1 credit per lead,
 * 10 requests/min). The profile lists its last ~12 posts with "N views" on the reels, so this gives a rough median, newest post date and
 * cadence without Apify. Caveats: the sample is the reels among the last 12 posts (fewer than 3 reels = remeasure, never a verdict), and it
 * reads the same play field as the other scrapers, so near-threshold results are REVIEW by design (lib/lead-fit.mjs).
 *
 *   node measure_reach_fc.mjs                 OG-batch leads without a measurement, then the pool (30k-200k, email, website, never sent), biggest first
 *   node measure_reach_fc.mjs --limit 60      cap the pool
 *   node measure_reach_fc.mjs --handles a,b   specific handles
 * Writes intake_data.reach_fc (additive, never touches stage or dm_demand) and reach_fc_<date>.json.
 */
import fs from 'fs'
import { fcCharge, fcSpent, fcCap } from './lib/fc-budget.mjs'
import { createClient } from '@supabase/supabase-js'
import { leadFit } from './lib/lead-fit.mjs'
import { parseProfile } from './lib/fc-profile.mjs'
import { profileFit } from './lib/lead-profile.mjs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const LIMIT = Number(arg('--limit', 140))
const HANDLES = arg('--handles', null)?.split(',').map((s) => s.trim()).filter(Boolean)
const TODAY = new Date().toISOString().slice(0, 10)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const num = (s) => Number(String(s).replace(/,/g, ''))
const OG_UNSENT = ['varmus_kontejneri', 'dentalux_dental', 'drmarijaboskovic', 'logerahome', 'dallasnamestaj']

async function scrape(handle) {
  if (!fcCharge('instagram')) { console.log('Stopping: Firecrawl budget for this run is used up.'); process.exit(1) }
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST', headers: { authorization: `Bearer ${env.FIRECRAWL_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ url: `https://www.instagram.com/${handle}/`, formats: ['markdown'], waitFor: 2000 }), signal: AbortSignal.timeout(90000),
    })
    if (r.status === 429) { await sleep(20000); continue }
    if (r.status === 402) { console.log('Firecrawl is OUT OF CREDITS: stopping.'); process.exit(1) }
    const j = await r.json().catch(() => ({}))
    if (!j.success) return { error: (j.error || `HTTP ${r.status}`).slice(0, 90) }
    return { md: j.data?.markdown || '' }
  }
  return { error: 'rate limited' }
}

let all = [], from = 0
while (true) {
  const { data, error } = await sb.from('contacts').select('id,company_name,instagram_handle,instagram_followers,niche,pipeline_stage,email,website,demo_tenant_url,email_1_poslat,intake_data').eq('client_id', SF).range(from, from + 999)
  if (error || !data.length) break
  all = all.concat(data); if (data.length < 1000) break; from += 1000
}
const measured = (r) => r.intake_data?.dm_demand?.median_views != null || r.intake_data?.audit?.medViews != null
let targets
if (HANDLES) targets = all.filter((r) => HANDLES.includes(r.instagram_handle))
else {
  const og = all.filter((r) => OG_UNSENT.includes(r.instagram_handle))
  const seen = new Set(og.map((r) => r.instagram_handle))
  const pool = all.filter((r) => r.instagram_handle && !seen.has(r.instagram_handle) && !r.demo_tenant_url && !r.email_1_poslat && r.email && r.website
    && ['archived', 'sourced'].includes(r.pipeline_stage) && (r.instagram_followers || 0) >= 30000 && (r.instagram_followers || 0) <= 200000 && !measured(r)
    && profileFit({ name: r.company_name, niche: r.niche, bio: r.intake_data?.enrichment?.instagram_profile?.bio, followers: r.instagram_followers }).pass)
    .sort((a, b) => b.instagram_followers - a.instagram_followers)
  const uniq = []; for (const r of pool) if (!seen.has(r.instagram_handle.toLowerCase())) { seen.add(r.instagram_handle.toLowerCase()); uniq.push(r) }
  targets = [...og, ...uniq.slice(0, LIMIT)]
}
console.log(`measuring ${targets.length} leads via Firecrawl profile read (~${Math.ceil(targets.length * 7 / 60)} min)\n`)

const rows = []
for (const t of targets) {
  const res = await scrape(t.instagram_handle)
  if (res.error) { console.log(`  ✗ @${t.instagram_handle}: ${res.error}`); rows.push({ handle: t.instagram_handle, error: res.error }); await sleep(6500); continue }
  const p = parseProfile(res.md)
  const thin = p.reelsSeen < 3
  const fit = leadFit({ name: t.company_name, bio: p.bioText, niche: t.niche, followers: p.followers ?? t.instagram_followers, email: t.email,
    medViews: thin ? null : p.medViews, daysSincePost: p.daysSincePost, postsLast30: p.postsLast30, reelsLast30: p.reelsLast30, override: t.intake_data?.fit_override ?? null })
  const row = { handle: t.instagram_handle, name: t.company_name, stage: t.pipeline_stage, followers: p.followers ?? t.instagram_followers, reelsSeen: p.reelsSeen, postsSeen: p.postsSeen, medViews: p.medViews, maxViews: p.maxViews, daysSincePost: p.daysSincePost, postsLast30: p.postsLast30, lane: fit.lane, why: [...fit.fails, ...fit.reviews].join(' | ') }
  rows.push(row)
  console.log(`  ${fit.lane.toUpperCase().padEnd(9)} @${t.instagram_handle.padEnd(26)} f=${String(row.followers).padStart(7)} reels=${String(p.reelsSeen).padStart(2)} med=${String(p.medViews ?? '-').padStart(7)} max=${String(p.maxViews ?? '-').padStart(8)} last=${p.daysSincePost}d  ${t.company_name?.slice(0, 28)}`)
  await sb.from('contacts').update({ intake_data: { ...t.intake_data, reach_fc: { at: TODAY, source: 'firecrawl-profile-12', followers: p.followers, reelsSeen: p.reelsSeen, postsSeen: p.postsSeen, medViews: p.medViews, maxViews: p.maxViews, daysSincePost: p.daysSincePost, postsLast30: p.postsLast30, reelsLast30: p.reelsLast30 } } }).eq('id', t.id)
  await sleep(6500)
}
fs.writeFileSync(`reach_fc_${TODAY}.json`, JSON.stringify(rows, null, 2))
const n = (l) => rows.filter((r) => r.lane === l).length
console.log(`\n${n('pass')} pass, ${n('review')} review, ${n('remeasure')} thin sample (needs Apify), ${n('fail')} fail, ${rows.filter((r) => r.error).length} errors → reach_fc_${TODAY}.json`)
