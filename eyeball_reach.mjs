#!/usr/bin/env node
/**
 * eyeball_reach.mjs — record Nikola's own median-view reading per lead when the scrapers are out of budget or wrong.
 *
 * Why: the Apify instagram-reel-scraper and ScrapeCreators undercount accounts that cross-post reels to the feed
 * (Cvejanović read 22K via scraper, reality is ~240K median). Firecrawl renders the real grid but needs credits
 * (the current key resets 2026-11-20). Until the scraper or Firecrawl is reliable, Nikola's eyes are the ground truth.
 *
 * Usage:
 *   node eyeball_reach.mjs                                  print one URL per archived / pipeline lead and wait on stdin
 *   node eyeball_reach.mjs --handles topdek_,luxor.furniture   only those handles
 *   node eyeball_reach.mjs --restore-pass                   after writing, un-archive any lead whose eyeball median passes
 *   node eyeball_reach.mjs --batch batch.csv                read medians from a CSV (handle,med) instead of prompting
 *
 * CSV format (one line per handle):
 *   topdek_,8000
 *   cvejanovic_dentalclinic,240000
 * A "-" or blank means "skip, keep whatever's on file."
 *
 * The eyeball writes into intake_data.dm_demand.eyeball = { medViews, at }, which takes precedence over every
 * scraper in measure_reach.mjs. The gate (lib/lead-fit.mjs) is run against the fresh number; a lead whose eyeball
 * passes and whose stage is 'archived' can be un-archived with --restore-pass.
 */
import fs from 'fs'
import readline from 'readline'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { leadFit } from './lib/lead-fit.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
for (const l of fs.readFileSync(path.resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}
const SMARTFLOW = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const HANDLES = arg('--handles', null)?.split(',').map(s => s.trim()).filter(Boolean)
const BATCH = arg('--batch', null)
const RESTORE = process.argv.includes('--restore-pass')

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let q = sb.from('contacts').select('id, name, company_name, email, instagram_handle, instagram_followers, pipeline_stage, intake_data').eq('client_id', SMARTFLOW)
if (HANDLES) q = q.in('instagram_handle', HANDLES)
else q = q.in('pipeline_stage', ['demo_building', 'demo_ready', 'email_ready', 'archived'])
const { data: leads, error } = await q
if (error) { console.error(error.message); process.exit(1) }

// Build the medians map: either from the CSV or interactively
let medians = new Map()
if (BATCH) {
  const csv = fs.readFileSync(BATCH, 'utf8')
  for (const line of csv.split('\n')) {
    const [h, v] = line.split(',').map(s => s?.trim())
    if (!h) continue
    const n = Number((v || '').replace(/[^\d.]/g, ''))
    if (Number.isFinite(n) && n > 0) medians.set(h, n)
  }
  console.log(`loaded ${medians.size} medians from ${BATCH}\n`)
} else {
  console.log('\nFor each lead, open the URL and type the MEDIAN (middle number) of the view counts you see on the grid.')
  console.log('Press ENTER alone to skip (keep the scraper number). Type "q" to stop.\n')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const ask = (prompt) => new Promise(res => rl.question(prompt, res))
  for (const lead of leads) {
    const h = lead.instagram_handle
    if (!h) continue
    const existing = lead.intake_data?.dm_demand?.median_views
    const eye = lead.intake_data?.dm_demand?.eyeball?.medViews
    console.log(`\n@${h.padEnd(28)} ${lead.pipeline_stage.padEnd(14)} f=${lead.instagram_followers}  scraper=${existing}${eye ? `  eyeball=${eye}` : ''}`)
    console.log(`   https://www.instagram.com/${h}/reels/`)
    const answer = (await ask('   median plays (e.g. 240000 or 240k or ENTER to skip, q to stop): ')).trim()
    if (answer === 'q') break
    if (!answer) continue
    const n = Number(answer.toLowerCase().replace(/,/g, '').replace(/k$/, '000').replace(/m$/, '000000').replace(/[^\d]/g, ''))
    if (!Number.isFinite(n) || n <= 0) { console.log('   bad number, skipping'); continue }
    medians.set(h, n)
  }
  rl.close()
  console.log()
}

// Apply the medians: write to intake_data.dm_demand.eyeball, re-run the gate, optionally restore
let wrote = 0, restored = 0, stillFail = 0
for (const lead of leads) {
  const med = medians.get(lead.instagram_handle)
  if (!(Number.isFinite(med) && med > 0)) continue
  const vpf = lead.instagram_followers ? +(med / lead.instagram_followers).toFixed(3) : null
  const existing = lead.intake_data?.dm_demand || {}
  const freshDM = {
    ...existing,
    source: 'manual_eyeball',
    median_views: med, // promote the eyeball to the primary median so lead_fit.mjs picks it
    views_per_follower: vpf,
    eyeball: { medViews: med, at: new Date().toISOString() },
    checked_at: new Date().toISOString().slice(0, 10),
  }
  const fit = leadFit({
    name: lead.company_name, followers: lead.instagram_followers, email: lead.email,
    medViews: med, viewsPerFollower: vpf, reels12: existing.reels12,
    p75Views: existing.p75_views, daysSincePost: existing.days_since_post,
    paidAds: existing.paid_ads ?? false, dmPrompt: existing.dm_prompt ?? false,
    activeAds: lead.intake_data?.active_ads_count ? Number(lead.intake_data.active_ads_count) : null,
  })
  const update = { intake_data: { ...lead.intake_data, dm_demand: freshDM, fit: { pass: fit.pass, fails: fit.fails, notes: fit.notes, checked_at: freshDM.checked_at } } }
  if (RESTORE && fit.pass && lead.pipeline_stage === 'archived') {
    // best guess for the stage to restore to: demo_building if no demo tenant yet, email_ready if one exists
    update.pipeline_stage = lead.intake_data?.demo_tenant_email || lead.demo_tenant_url ? 'email_ready' : 'demo_building'
    restored += 1
  }
  if (!fit.pass && lead.pipeline_stage === 'archived') stillFail += 1
  const { error: uErr } = await sb.from('contacts').update(update).eq('id', lead.id)
  if (uErr) { console.log(`  ⚠ ${lead.instagram_handle}: ${uErr.message}`); continue }
  wrote += 1
  console.log(`  ${fit.pass ? '✓ PASS' : '✗ FAIL'}  @${lead.instagram_handle.padEnd(28)} eyeball med=${med.toLocaleString('en')}${RESTORE && fit.pass && lead.pipeline_stage === 'archived' ? '  → restored to ' + update.pipeline_stage : ''}`)
}
console.log(`\nwrote eyeballs for ${wrote} leads; ${restored} restored from archive; ${stillFail} still fail and stay archived`)
