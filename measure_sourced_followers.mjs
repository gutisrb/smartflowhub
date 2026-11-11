/**
 * Measure Instagram reach for the sourced cohort before any demo spend.
 *
 * Google Maps never looks at Instagram, so every lead it inserts carries a null
 * follower count — not a small audience, an unmeasured one. The queue gate reads
 * that as `audience_unmeasured` and parks the lead forever, which is why 46
 * high-ticket leads have sat unbuilt. This measures them once so selection can
 * happen on real numbers instead of a placeholder.
 *
 * Data only: writes instagram_followers and nothing else. No demo is built,
 * no tenant provisioned, no email touched.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Every other script in this repo loads .env.local itself — this one never did, so it
// only ever ran when someone happened to have the vars already exported in their shell
// (which is also why it was never picked up by run_pipeline.mjs or any cron job).
const __dirname = dirname(fileURLToPath(import.meta.url))
try {
  const raw = readFileSync(resolve(__dirname, '.env.local'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    // Caller-injected vars win over the file — run_pipeline.mjs rotates Apify keys by
    // setting APIFY_TOKEN in the child env, and clobbering it here defeats the rotation.
    if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim()
  }
} catch {}

import { pickApifyToken } from './lib/apify-key.mjs'
// Same rotation as run_pipeline.mjs / source_leads.mjs — a drained key otherwise kills the
// run with "Monthly usage hard limit exceeded" after the free work is done.
const picked = await pickApifyToken(0.25, { quiet: true })
const APIFY_TOKEN = picked?.token || process.env.APIFY_TOKEN
const IG_ACTOR    = 'dSCLg0C3YEZ83HzYX'
const SMARTFLOW   = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const DRY         = process.argv.includes('--dry-run')
const sleep = ms => new Promise(r => setTimeout(r, ms))

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: leads, error } = await sb.from('contacts')
  .select('id,name,email,website,instagram_handle,instagram_followers,niche')
  .eq('client_id', SMARTFLOW)
  .in('pipeline_stage', ['sourced', 'novi'])
  // Deliberately NOT filtered to leads that already have an email. Measuring a profile costs
  // ~$0.003; finding an email costs far more (Hunter + Firecrawl + a raw scrape). The follower
  // count is the cheap discriminator that decides whether the expensive step is worth running
  // at all, so it has to come first. Requiring an email here left 25 leads permanently stuck
  // on `audience_unmeasured` — the single biggest blocker in the queue on 2026-09-15.
if (error) { console.error(error); process.exit(1) }

const clean = h => (h || '').trim().replace(/^@/, '').replace(/\/$/, '').split('/').pop()
const targets = leads.filter(l => l.instagram_handle && !(l.instagram_followers > 0))
const handles = [...new Set(targets.map(l => clean(l.instagram_handle)).filter(Boolean))]

console.log(`Cohort: ${leads.length} sourced/novi leads`)
console.log(`  already measured : ${leads.filter(l => l.instagram_followers > 0).length}`)
console.log(`  no handle at all : ${leads.filter(l => !l.instagram_handle).length}`)
console.log(`  to measure now   : ${handles.length}\n`)
if (DRY || !handles.length) { console.log('(dry run — nothing sent)'); process.exit(0) }

const bal = await (await fetch(`https://api.apify.com/v2/users/me?token=${APIFY_TOKEN}`)).json()
console.log(`Apify plan ${bal.data?.plan?.id}, used $${(bal.data?.monthlyUsage?.totalCostUsd ?? 0).toFixed(3)}`)

const run = await (await fetch(
  `https://api.apify.com/v2/acts/${IG_ACTOR}/runs?token=${APIFY_TOKEN}&maxItems=${handles.length}`,
  { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: handles, maxTotalChargeUsd: 1.0 }) })).json()
if (run.error) { console.error('actor start failed:', run.error.message); process.exit(1) }
const { id: runId, defaultDatasetId: dsId } = run.data
console.log(`run ${runId}`)

let status = 'RUNNING'
for (let i = 0; i < 90; i++) {
  await sleep(10000)
  status = (await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`)).json()).data?.status
  process.stdout.write(`\r  ${status} (${(i + 1) * 10}s)   `)
  if (!['RUNNING', 'READY'].includes(status)) break
}
console.log()
if (!['SUCCEEDED', 'FINISHED'].includes(status)) { console.error(`ended ${status}`); process.exit(1) }

let items = [], offset = 0
while (true) {
  const b = await (await fetch(`https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}&limit=200&offset=${offset}`)).json()
  const arr = Array.isArray(b) ? b : (b.items || [])
  items = items.concat(arr)
  if (arr.length < 200) break
  offset += arr.length
}
console.log(`${items.length} profiles returned\n`)

const byHandle = new Map()
for (const p of items) {
  const u = (p.username || p.inputUrl || '').toLowerCase().replace(/^@/, '').split('/').filter(Boolean).pop()
  if (u) byHandle.set(u, p)
}

let written = 0, missing = 0
for (const l of targets) {
  const p = byHandle.get(clean(l.instagram_handle).toLowerCase())
  // -1 marks "we looked and the profile does not resolve" — distinct from null (never looked)
  const followers = p ? (p.followersCount ?? p.followers ?? null) : null
  if (followers == null) { missing++; continue }
  await sb.from('contacts').update({ instagram_followers: followers }).eq('id', l.id)
  written++
}
console.log(`written: ${written} | handle did not resolve: ${missing}`)
