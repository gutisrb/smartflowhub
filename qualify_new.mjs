/**
 * qualify_new.mjs — the repeatable funnel for NEW leads, cheapest check first, no ScrapeCreators needed.
 *
 *   free   profile gate (lib/lead-profile.mjs: high-consideration vertical, owner-run) → own website → email
 *   free   followers from Instagram's public page (15k–200k)
 *   ~$0.011 per profile   reel reach: last 12 reels via Apify (lib/reach-apify.mjs) → reach gate (lib/lead-fit.mjs) incl. recency
 *   then   pass → "Demo se pravi" (demo_building), fail → archived with the reason. The approval queue never holds an unjudged lead.
 *
 * Usage: node qualify_new.mjs [--hours 24] [--handles a,b] [--apply] [--max-usd 1]
 *   candidates = DB leads created in the last N hours still at novi/sourced, plus any --handles (looked up in the DB first)
 *   without --apply nothing is written.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { profileFit } from './lib/lead-profile.mjs'
import { leadFit } from './lib/lead-fit.mjs'
import { measureReach, followersFree, measureDmPrompt } from './lib/reach-apify.mjs'
import { INVITE } from './lib/dm-demand.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '') }
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const STAGES = arg('--stages', 'novi,sourced').split(','), HOURS = Number(arg('--hours', 24)), APPLY = process.argv.includes('--apply'), MAX_USD = Number(arg('--max-usd', 1))
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const since = new Date(Date.now() - HOURS * 36e5).toISOString()
const { data: rows } = await sb.from('contacts').select('id,company_name,instagram_handle,instagram_followers,email,website,niche,comment,intake_data,pipeline_stage,status').eq('client_id', SF).in('pipeline_stage', STAGES).gte('created_at', since)
const cands = (rows || []).filter((r) => r.instagram_handle)
console.log(`${cands.length} new leads with a handle (last ${HOURS} h)\n`)

// 1. free: profile gate (name + whatever bio/niche is stored)
const stage1 = []
for (const r of cands) {
  const bio = r.intake_data?.enrichment?.instagram_profile?.bio || r.intake_data?.ad_title || ''
  const p = profileFit({ name: r.company_name, niche: r.niche, bio, followers: r.instagram_followers })
  r._profile = p
  if (!p.pass) { r._verdict = `profile: ${p.fails[0].slice(0, 70)}`; continue }
  stage1.push(r)
}
// every lead of the original batch has its own website, and a demo is built from it: no site, no demo
for (let i = stage1.length - 1; i >= 0; i--) if (!stage1[i].website) { stage1[i]._verdict = 'no own website (a demo is built from the site)'; stage1.splice(i, 1) }
// 2. free: real follower count from the public page, 15k–200k
const stage2 = []
for (const r of stage1) {
  const f = await followersFree(r.instagram_handle)
  r._followers = f ?? r.instagram_followers
  if (r._followers == null || r._followers < 15000 || r._followers > 200000) { r._verdict = `followers ${r._followers} outside 15k-200k`; continue }
  stage2.push(r)
}
const isPaid = (r) => !!(r.intake_data?.ad_start_date && (r.intake_data?.publisher_platforms || []).includes('INSTAGRAM'))
// reels are measured for every candidate: reach is reel views ≥ 30% of followers, paid or not (Nikola, 2026-11-11)
let reach = []
const toMeasure = stage2
if (toMeasure.length) { const m = await measureReach(toMeasure.map((r) => r.instagram_handle), { maxUsd: MAX_USD }); if (m.error) console.log('reach error:', m.error); reach = m.rows }
// the DM prompt: in the bio, in an ad (CTA "Send message" or ad copy), or in the captions of its reels
let dmMap = new Map()
if (stage2.length) dmMap = await measureDmPrompt(stage2.map((r) => r.instagram_handle), { maxUsd: 0.5 })
const dmPromptOf = (r, m) => !!dmMap.get(r.instagram_handle)?.dm || INVITE.test(r.intake_data?.enrichment?.instagram_profile?.bio || '') || /message|poruk/i.test(r.intake_data?.ad_cta || '') || INVITE.test(JSON.stringify(r.intake_data?.ad_copies || '')) || (m?.dmCaptions ?? 0) >= 1
const passed = []
for (const r of stage2) {
  const m = reach.find((x) => x.handle === r.instagram_handle) || {}
  const fit = leadFit({ followers: r._followers, medViews: m.medViews ?? null, viewsPerFollower: r._followers && m.medViews != null ? +(m.medViews / r._followers).toFixed(3) : null, reels12: m.reels12 ?? null, daysSincePost: m.daysSincePost ?? null, email: r.email, paidAds: isPaid(r), dmPrompt: dmPromptOf(r, m), activeAds: r.intake_data?.active_ads_count ? Number(r.intake_data.active_ads_count) : null })
  r._reach = m; r._fit = fit; r._dm = dmPromptOf(r, m)
  const emailOnly = fit.fails.length === 1 && /email/.test(fit.fails[0])
  if (fit.pass || emailOnly) { r._verdict = fit.pass ? 'PASS' : 'PASS (needs an email)'; passed.push(r) } else r._verdict = `reach: ${fit.fails.join(' | ').slice(0, 90)}`
}
const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n)
for (const r of cands.sort((a, b) => (b._verdict?.startsWith('PASS') ? 1 : 0) - (a._verdict?.startsWith('PASS') ? 1 : 0))) {
  const m = r._reach
  console.log(`${r._verdict?.startsWith('PASS') ? 'OK ' : 'NO '} ${pad(r.company_name, 34)} ${pad(r._followers ?? r.instagram_followers, 7)} ${m ? `reels ${pad(m.reels12, 3)} med ${pad(m.medViews, 7)} last ${m.daysSincePost}d` : ' '.repeat(28)} ${r.email ? 'email' : 'NO email'} ${r.website ? 'site' : 'no site'}  ${r._verdict}`)
}
console.log(`\n${passed.length} pass / ${cands.length} checked`)
if (APPLY) {
  for (const r of cands) {
    const ok = r._verdict?.startsWith('PASS')
    const note = ok ? `2026-11-11 qualified (reels ${r._reach?.medViews} median over ${r._reach?.reels12} reels, ${r._followers} followers)` : `2026-11-11 archived by qualify_new: ${r._verdict}`
    await sb.from('contacts').update({ pipeline_stage: ok ? 'demo_building' : 'archived', instagram_followers: r._followers ?? r.instagram_followers, comment: ((r.comment ? r.comment + ' | ' : '') + note).slice(0, 900),
      intake_data: { ...(r.intake_data || {}), dm_demand: r._reach ? { dm_prompt: !!r._dm, paid_ads: isPaid(r), checked_at: new Date().toISOString().slice(0, 10), median_views: r._reach.medViews, views_per_follower: r._followers ? +(r._reach.medViews / r._followers).toFixed(3) : null, days_since_post: r._reach.daysSincePost, reels12: r._reach.reels12, source: 'apify-reel-scraper-12' } : r.intake_data?.dm_demand } }).eq('id', r.id)
  }
  console.log('applied: passed → demo_building, the rest → archived')
}
