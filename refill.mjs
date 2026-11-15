#!/usr/bin/env node
/**
 * refill.mjs — ONE command that turns the backlog into vetted, MEASURED leads in Station 1 (2026-11-15, Nikola: "adding leads is super hard, there is something
 * wrong with your process, just fix it"). The backlog was the bottleneck, not sourcing: a third of the complete leads (site + email) were ever reach-measured.
 * Order is cheapest first, so credits are only spent on leads that survived everything free:
 *   free: profile check (what it sells, hubs, words) → market + chain on its OWN site text → judge pair (cents, cached) → measure reach (paid, interleaved across
 *   business types so no type dominates) → queue_for_review --apply (evidence tiers, 2-per-type cap, Station 1).
 * Reach comes from the Apify reel scraper when a key has budget, otherwise from the Firecrawl profile read (about 2 credits a lead, capped; unreadable ones wait).
 *
 *   node refill.mjs [--max 60] [--dry]
 */
import fs from 'fs'
import { spawnSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { profileFit } from './lib/lead-profile.mjs'
import { ownDomain } from './lib/email-finder.mjs'
import { judgeAccounts } from './lib/lead-judge.mjs'
import { marketCheck, chainCheck, fetchSiteText } from './lib/lead-sanity.mjs'
import { pickApifyToken } from './lib/apify-key.mjs'
import { measureReach } from './lib/reach-apify.mjs'
import { familyOf, interleave } from './lib/lead-family.mjs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const MAX = Number(arg('--max', 60)), DRY = process.argv.includes('--dry')
const TODAY = new Date().toISOString().slice(0, 10)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const okMail = (e) => !!e && !/@(email|website|example)\./.test(e)
const med = (r) => { const i = r.intake_data || {}, d = i.dm_demand || {}, a = i.audit || {}, fc = i.reach_fc || {}; return d.median_views ?? a.medViews ?? ((fc.reelsSeen ?? 0) >= 3 ? fc.medViews : null) }
const tried = (r) => !!r.intake_data?.reach_fc // a Firecrawl read that came back thin is not repeated (Apify handles those)

let all = [], from = 0
while (true) { const { data, error } = await sb.from('contacts').select('id,company_name,instagram_handle,instagram_followers,niche,pipeline_stage,status,email,website,email_1_poslat,intake_data').eq('client_id', '69acf7e9-557e-4ca3-85bd-a785ef39e351').range(from, from + 999); if (error || !data.length) break; all = all.concat(data); if (data.length < 1000) break; from += 1000 }

const apify = await pickApifyToken(0.3, { quiet: true })
let cands = all.filter((r) => r.instagram_handle && !r.email_1_poslat && !['discarded', 'sent', 'replied', 'booked', 'email_ready', 'demo_building'].includes(r.pipeline_stage) && !r.intake_data?.removed && !r.intake_data?.review?.decision
  && !['Lost', 'Bounced'].includes(r.status || '') && (r.instagram_followers || 0) >= 15000 && (r.instagram_followers || 0) <= 200000 && okMail(r.email) && ownDomain(r.website) && med(r) == null && (apify || !tried(r)))
console.log(`backlog: ${cands.length} complete leads (own site + real email, 15-200k) with reach never measured${apify ? '' : ' and not yet tried by the free reader'}`)

// free filters
const why = {}; const count = (k) => (why[k] = (why[k] || 0) + 1)
cands = cands.filter((r) => { const ig = r.intake_data?.enrichment?.instagram_profile || {}; const p = profileFit({ name: r.company_name, niche: r.niche, bio: ig.bio, category: ig.business_category, followers: r.instagram_followers, website: r.website }); if (!p.pass) { count('profile check: ' + p.fails[0].replace(/[("].*$/, '').slice(0, 40)); return false } return true })
const kept = []
for (let i = 0; i < cands.length; i += 6) await Promise.all(cands.slice(i, i + 6).map(async (r) => {
  const ig = r.intake_data?.enrichment?.instagram_profile || {}, site = await fetchSiteText(r.website)
  const m = marketCheck({ name: r.company_name, bio: ig.bio, website: r.website, siteText: site }), c = chainCheck({ name: r.company_name, bio: ig.bio, siteText: site, followers: r.instagram_followers })
  if (m.verdict === 'fail') return void count('market: ' + m.reason.slice(0, 30))
  if (c.verdict === 'fail') return void count('chain: ' + c.reason.slice(0, 30))
  kept.push(r)
}))
cands = kept
// judge pair (cached)
const need = cands.filter((r) => !r.intake_data?.judge)
const fresh = need.length && !DRY ? await judgeAccounts(need.map((r) => ({ handle: r.instagram_handle, name: r.company_name, category: r.intake_data?.enrichment?.instagram_profile?.business_category || r.niche, bio: r.intake_data?.enrichment?.instagram_profile?.bio }))) : new Map()
for (const r of need) { const j = fresh.get(r.instagram_handle.toLowerCase()); if (j && !DRY) await sb.from('contacts').update({ intake_data: { ...(r.intake_data || {}), judge: { ...j, at: TODAY } } }).eq('id', r.id).then(() => { r.intake_data = { ...(r.intake_data || {}), judge: j } }) }
cands = cands.filter((r) => { const j = r.intake_data?.judge; if (!j) return !DRY; if (j.kind !== 'business' && !j.doubt) { count('judge: ' + j.kind); return false } return true })
console.log('cut before spending any credit:', JSON.stringify(why))

// interleave by business type, then measure the first MAX
const batch = interleave(cands, (r) => familyOf(r)).slice(0, MAX)
const mix = {}; for (const r of batch) { const k = familyOf(r); mix[k] = (mix[k] || 0) + 1 }
console.log(`to measure now: ${batch.length} of ${cands.length} survivors | by type: ${JSON.stringify(mix)} | engine: ${apify ? 'Apify reel scraper' : 'Firecrawl profile read (capped)'}`)
if (DRY) { console.log('[dry run] nothing measured or written.'); process.exit(0) }
if (!batch.length) console.log('nothing to measure')
else if (apify) {
  const { rows, error } = await measureReach(batch.map((r) => r.instagram_handle), { maxUsd: Math.min(apify.left - 0.05, 0.02 * batch.length + 0.2) })
  if (error) console.log('apify error:', error)
  for (const x of rows || []) { const r = batch.find((b) => b.instagram_handle === x.handle); if (!r || !x.reels12) continue
    await sb.from('contacts').update({ intake_data: { ...(r.intake_data || {}), dm_demand: { ...(r.intake_data?.dm_demand || {}), source: 'apify-reel-scraper-24', reels12: x.reels12, median_views: x.medViews, p75_views: x.p75Views, max_views: x.maxViews, days_since_post: x.daysSincePost, views_per_follower: r.instagram_followers ? +(x.medViews / r.instagram_followers).toFixed(3) : null, checked_at: TODAY } } }).eq('id', r.id) }
  console.log(`measured with Apify: ${(rows || []).filter((x) => x.reels12).length} of ${batch.length}`)
} else {
  const res = spawnSync('node', ['measure_reach_fc.mjs', '--handles', batch.map((r) => r.instagram_handle).join(',')], { stdio: 'inherit', env: { ...process.env, FIRECRAWL_MAX_CREDITS: String(batch.length * 3 + 10) } })
  if (res.status) console.log('measure step stopped early (budget or credits): the rest waits')
}
console.log('\nputting the survivors in Station 1…')
spawnSync('node', ['queue_for_review.mjs', '--apply'], { stdio: 'inherit' })
