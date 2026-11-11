/**
 * qualify_queue.mjs — the missing step between sourcing and the cockpit.
 *
 * Sourcing scripts insert at pipeline_stage 'novi', which is exactly the stage
 * station 1 of the cockpit lists for approval. So every scraped row arrived as a
 * decision for Nikola, including the ones with no email, no measured audience, or
 * a handle belonging to somebody else. This runs lib/lead-queue.mjs over the
 * conveyor and puts each lead where it belongs:
 *
 *   ready            → stays 'novi'      (station 1, awaiting your approval)
 *   needs_enrichment → 'sourced'         (out of sight until enrichment fills it in)
 *   review           → 'sourced'         (needs a human look, not a decision)
 *   reject           → 'sourced' + status Disqualified
 *
 * Nothing is deleted; every move is a column write and reversible.
 *
 * Usage:
 *   node qualify_queue.mjs            — dry run, prints the verdict table
 *   node qualify_queue.mjs --apply    — writes
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { qualifyForQueue } from './lib/lead-queue.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const line of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m) process.env[m[1].trim()] = m[2].trim()
}

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CLIENT = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const APPLY = process.argv.includes('--apply')
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const DEAD = new Set(['Disqualified', 'Lost', 'Bounced'])

const rows = await (await fetch(
  `${URL_}/rest/v1/contacts?select=id,company_name,email,website,instagram_handle,instagram_followers,niche,status,pipeline_stage,izvor,intake_data,approved_to_send,email_draft&client_id=eq.${CLIENT}&pipeline_stage=in.(novi,demo_building,email_ready)`,
  { headers: H },
)).json()

// The floor Nikola set in the cockpit, not a number invented here.
const cfg = await (await fetch(`${URL_}/rest/v1/machine_config?select=source_follower_floor&client_id=eq.${CLIENT}`, { headers: H })).json()
const followerFloor = cfg?.[0]?.source_follower_floor ?? undefined
console.log(`Follower floor: ${followerFloor ?? 'default'} (machine_config.source_follower_floor)`)

const live = rows.filter(r => !DEAD.has(r.status || ''))
console.log(`\nConveyor: ${live.length} live leads (${rows.length - live.length} already dead)\n`)

const buckets = { ready: [], needs_enrichment: [], review: [], reject: [] }
for (const r of live) { const q = qualifyForQueue(r, { followerFloor }); buckets[q.verdict].push({ r, q }) }

const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n)
for (const [verdict, list] of Object.entries(buckets)) {
  console.log(`\n═══ ${verdict.toUpperCase()} — ${list.length} ═══`)
  for (const { r, q } of list.sort((a, b) => b.q.score - a.q.score)) {
    console.log(`  ${pad(r.company_name, 34)} ${pad(r.instagram_followers ?? '—', 7)} skor ${pad(q.score, 4)} ${pad(r.pipeline_stage, 13)} ${q.reasons.join(',') || '—'}`)
  }
}

// A lead already through the funnel is not re-litigated by a scraper heuristic:
// email_ready rows carry a written draft Nikola has read, and demo_building rows
// are mid-build. This gate governs the entrance, not the whole conveyor.
const movable = v => buckets[v].filter(({ r }) => r.pipeline_stage === 'novi')
const toPark = [...movable('needs_enrichment'), ...movable('review')]
const toReject = movable('reject')
const staying = buckets.ready.filter(({ r }) => r.pipeline_stage === 'novi')

console.log(`\n───────────────────────────────────────────`)
console.log(`  Station 1 now:   ${live.filter(r => r.pipeline_stage === 'novi').length}`)
console.log(`  Station 1 after: ${staying.length}`)
console.log(`  → parked to 'sourced': ${toPark.length}`)
console.log(`  → disqualified:        ${toReject.length}`)
console.log(`  untouched (past station 1): ${live.filter(r => r.pipeline_stage !== 'novi').length}`)
console.log(`───────────────────────────────────────────`)

if (!APPLY) { console.log('\nDry run. Re-run with --apply to write.\n'); process.exit(0) }

let n = 0
for (const { r, q } of [...toPark, ...toReject, ...staying]) {
  const patch = { prioritet_skor: q.score, sledeca_akcija: q.action }
  if (toReject.includes(toReject.find(x => x.r.id === r.id))) { patch.status = 'Disqualified'; patch.pipeline_stage = 'sourced' }
  else if (q.verdict !== 'ready') patch.pipeline_stage = 'sourced'
  const res = await fetch(`${URL_}/rest/v1/contacts?id=eq.${r.id}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
  if (res.ok) n++
  else console.error(`  ✗ ${r.company_name}: ${(await res.text()).slice(0, 120)}`)
}
console.log(`\n✓ Updated ${n} leads.\n`)
