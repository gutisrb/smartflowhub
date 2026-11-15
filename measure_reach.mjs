#!/usr/bin/env node
/**
 * measure_reach.mjs — the authoritative reel-reach measurement for every lead.
 *
 * ORDER OF TRUTH (highest first):
 *   1. an eyeball median Nikola typed into intake_data.dm_demand.eyeball       — manual_eyeball
 *   2. Firecrawl rendering the /reels/ grid (real badge numbers)               — firecrawl-reels-grid
 *   3. Apify instagram-reel-scraper (reel-endpoint plays, undercounts on cross-posting accounts) — apify-reel-scraper-24
 * The first source that returns a measurement wins and is recorded in intake_data.dm_demand.source. Falling back
 * is explicit (never silent); each lead's row prints which source was used.
 *
 * Usage:
 *   node measure_reach.mjs                      every lead in demo_building, demo_ready, email_ready, archived
 *   node measure_reach.mjs --stage email_ready  one stage
 *   node measure_reach.mjs --handles a,b,c      specific handles, measured even if archived
 *   node measure_reach.mjs --source firecrawl   force one source (firecrawl | apify | eyeball)
 *   node measure_reach.mjs --dry                print verdicts, don't write to DB
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { measureReelsViaFirecrawl } from './lib/reach-firecrawl.mjs'
import { measureReach as measureReachApify } from './lib/reach-apify.mjs'
import { leadFit } from './lib/lead-fit.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
for (const l of fs.readFileSync(path.resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}

const SMARTFLOW = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const STAGE = arg('--stage', null)
const HANDLES = arg('--handles', null)?.split(',').map(s => s.trim()).filter(Boolean)
const FORCE_SOURCE = arg('--source', null) // 'firecrawl' | 'apify' | 'eyeball'
const DRY = process.argv.includes('--dry')

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let q = sb.from('contacts').select('id, name, company_name, email, instagram_handle, instagram_followers, pipeline_stage, intake_data').eq('client_id', SMARTFLOW).not('instagram_handle', 'is', null)
if (HANDLES) q = q.in('instagram_handle', HANDLES)
else if (STAGE) q = q.eq('pipeline_stage', STAGE)
else q = q.in('pipeline_stage', ['demo_building', 'demo_ready', 'email_ready', 'archived'])
const { data: leads, error } = await q
if (error) { console.error(error.message); process.exit(1) }
console.log(`measuring ${leads.length} leads${FORCE_SOURCE ? ` (forced source: ${FORCE_SOURCE})` : ''}${DRY ? ' [DRY]' : ''}\n`)

async function measureOne(lead) {
  const h = lead.instagram_handle
  if (!h) return { source: 'none', error: 'no instagram_handle' }

  // 1. eyeball (highest trust)
  const eye = lead.intake_data?.dm_demand?.eyeball
  if ((FORCE_SOURCE === 'eyeball' || !FORCE_SOURCE) && eye && typeof eye.medViews === 'number') {
    return { source: 'manual_eyeball', medViews: eye.medViews, p75Views: eye.p75Views ?? null, maxViews: eye.maxViews ?? null, reels12: eye.reels12 ?? null, at: eye.at }
  }
  if (FORCE_SOURCE === 'eyeball') return { source: 'none', error: 'no eyeball value recorded' }

  // 2. Firecrawl — render the /reels/ grid and read the badges
  if (!FORCE_SOURCE || FORCE_SOURCE === 'firecrawl') {
    const r = await measureReelsViaFirecrawl(h, { apiKey: process.env.FIRECRAWL_API_KEY })
    if (r.ok) return { source: r.source, medViews: r.medViews, p75Views: r.p75Views, maxViews: r.maxViews, reels12: r.reels12, badges: r.raw?.badges }
    if (FORCE_SOURCE === 'firecrawl') return { source: 'none', error: r.error }
  }

  // 3. Apify — the known-undercounting fallback (but still useful for small accounts that don't cross-post)
  if (!FORCE_SOURCE || FORCE_SOURCE === 'apify') {
    const { rows, error: aErr } = await measureReachApify([h], { maxUsd: 0.5 })
    if (aErr || !rows.length) return { source: 'none', error: aErr || 'apify returned no rows' }
    const row = rows[0]
    return { source: 'apify-reel-scraper-24', medViews: row.medViews, p75Views: row.p75Views, maxViews: row.maxViews, reels12: row.reels12, daysSincePost: row.daysSincePost }
  }

  return { source: 'none', error: 'no source produced a measurement' }
}

const results = []
for (const lead of leads) {
  const m = await measureOne(lead)
  const existing = lead.intake_data?.dm_demand || {}
  const vpf = lead.instagram_followers && m.medViews != null ? +(m.medViews / lead.instagram_followers).toFixed(3) : null
  const fresh = {
    ...existing,
    source: m.source,
    reels12: m.reels12 ?? existing.reels12,
    median_views: m.medViews ?? existing.median_views,
    p75_views: m.p75Views ?? existing.p75_views,
    max_views: m.maxViews ?? existing.max_views,
    views_per_follower: vpf ?? existing.views_per_follower,
    days_since_post: m.daysSincePost ?? existing.days_since_post,
    checked_at: new Date().toISOString().slice(0, 10),
  }
  const fit = leadFit({
    name: lead.company_name, followers: lead.instagram_followers, email: lead.email,
    medViews: fresh.median_views, viewsPerFollower: fresh.views_per_follower, reels12: fresh.reels12,
    p75Views: fresh.p75_views, daysSincePost: fresh.days_since_post,
    paidAds: existing.paid_ads ?? false, dmPrompt: existing.dm_prompt ?? false,
    activeAds: lead.intake_data?.active_ads_count ? Number(lead.intake_data.active_ads_count) : null,
  })
  results.push({ handle: lead.instagram_handle, stage: lead.pipeline_stage, followers: lead.instagram_followers, source: m.source, medViews: fresh.median_views, p75Views: fresh.p75_views, maxViews: fresh.max_views, pass: fit.pass, fails: fit.fails })

  const tag = fit.pass ? '✓ PASS' : '✗ FAIL'
  const err = m.error ? ` ERROR: ${m.error}` : ''
  console.log(`  ${tag}  [${(m.source || 'none').padEnd(23)}] ${(lead.instagram_handle || '').padEnd(28)} med=${String(fresh.median_views ?? '?').padStart(7)}  p75=${String(fresh.p75_views ?? '?').padStart(7)}  max=${String(fresh.max_views ?? '?').padStart(8)}${err}`)

  if (!DRY && m.source !== 'none') {
    const update = { intake_data: { ...lead.intake_data, dm_demand: fresh, fit: { pass: fit.pass, fails: fit.fails, notes: fit.notes, checked_at: fresh.checked_at } } }
    const { error: uErr } = await sb.from('contacts').update(update).eq('id', lead.id)
    if (uErr) console.log(`    ⚠ write failed: ${uErr.message}`)
  }
}

const bySource = results.reduce((a, r) => { a[r.source] = (a[r.source] || 0) + 1; return a }, {})
console.log(`\nsource breakdown:`, bySource)
console.log(`gate: ${results.filter(r => r.pass).length} PASS, ${results.filter(r => !r.pass).length} FAIL`)
