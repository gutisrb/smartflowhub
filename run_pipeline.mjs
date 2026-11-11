/**
 * run_pipeline.mjs — the machine, not another one-off script.
 *
 * Nikola's ask (2026-09-11): stop touching up individual demos by hand. Build one thing
 * that runs the whole funnel — source → qualify → build demo → draft → ready-to-send —
 * end to end, unattended, and reports stats. Every piece already existed as a separate
 * script; this is what was missing: something that chains them without a human running
 * each stage by hand.
 *
 * What it does, in order:
 *   1. Top up the queue if it's thin (source_leads.mjs, only if Apify budget allows)
 *   2. qualify_queue.mjs --apply (sourcing's own funnel: novi -> ready/sourced/disqualified)
 *   3. Auto-promote 'novi' leads that qualified as 'ready' straight to 'demo_building' —
 *      this is the one deliberate change from the old flow: a lead that already cleared
 *      the follower-floor/audience/handle-sanity bar doesn't need a second human click
 *      before a demo gets built for it. (Leads that need enrichment or review still land
 *      at 'sourced' for a human look, same as before — this only removes the redundant
 *      click for leads that were already going to pass.)
 *   4. build_demo_tenant.mjs --approved (builds every demo_building row, respects every
 *      guard: AOV gate, no-catalog-invention, directory/aggregator detection)
 *   5. fill_website_summaries.mjs — the missing link discovered running this the first
 *      time: without it, most leads hit generate_drafts.mjs's "no ad/reel/website context"
 *      guard and silently stall forever at 'enriched_no_context' with no way back.
 *   6. generate_drafts.mjs --mode initial (drafts for every newly-built demo)
 *   7. promote_email_ready.mjs (demo_building -> email_ready once demo + draft both exist)
 *   8. Print + log a funnel snapshot (counts at every stage, not per-lead detail)
 *
 * What it deliberately never does: call send_outreach.mjs. Sending stays gated on
 * Nikola's explicit per-batch go-ahead — that line doesn't move just because the rest of
 * the funnel is automated now. This script's last stage is "ready for you to review",
 * same place --mode approved review already happened; it just gets there without anyone
 * running five scripts by hand.
 *
 * Usage:
 *   node run_pipeline.mjs             — full run
 *   node run_pipeline.mjs --dry-run   — report what WOULD happen at each stage, no writes/spend
 *   node run_pipeline.mjs --skip-source — skip the sourcing top-up (queue already has enough)
 */

import { createClient } from '@supabase/supabase-js'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readFileSync, appendFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { leadFit } from './lib/lead-fit.mjs'
import { qualifyForQueue } from './lib/lead-queue.mjs'

const execFileAsync = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    }
  } catch {}
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const APIFY_TOKEN  = process.env.APIFY_TOKEN
const CLIENT_ID    = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const sb = createClient(SUPABASE_URL, SERVICE_KEY)

const isDryRun    = process.argv.includes('--dry-run')
const skipSource  = process.argv.includes('--skip-source')

const STATS_LOG = resolve(__dirname, 'pipeline_stats.jsonl')

function runScript(name, args = [], timeout = 280000, envOverride = {}) {
  console.log(`\n▶ ${name} ${args.join(' ')}`)
  if (isDryRun) { console.log('  [DRY RUN] — not executed'); return Promise.resolve({ stdout: '', skipped: true }) }
  return execFileAsync('node', [name, ...args], { cwd: __dirname, timeout, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, ...envOverride } })
    .then(({ stdout, stderr }) => { if (stdout) console.log(stdout.trim()); if (stderr) console.error(stderr.trim()); return { stdout, stderr } })
    .catch(err => {
      // A killed-by-timeout process can still have made real progress (partial writes
      // already committed) — surface whatever it printed before dying, not just the error.
      if (err.stdout) console.log(err.stdout.trim())
      // Without this the only trace of a child crash was "Command failed" — the actual
      // stack trace went to /dev/null, which cost a whole debugging round on 2026-09-15.
      if (err.stderr) console.error(err.stderr.trim())
      console.error(`  ✗ ${name} failed: ${err.message}`)
      return { error: err.message }
    })
}

// A full source_leads.mjs run costs ~$2.50 (measured 2026-09-10). Anything less than this
// in headroom means the run gets killed by Apify's hard cap partway through — which already
// happened once and wasted the spend without producing leads. Not a guess.
const APIFY_RUN_COST = 2.75

async function apifyHeadroom(token) {
  if (!token) return null
  try {
    const res = await fetch(`https://api.apify.com/v2/users/me/limits?token=${token}`)
    const { data } = await res.json()
    const used = data?.current?.monthlyUsageUsd
    const cap  = data?.limits?.maxMonthlyUsageUsd ?? 5
    if (typeof used !== 'number') return null
    return { used, cap, left: cap - used }
  } catch {
    return null
  }
}

// Nikola supplies Apify keys one at a time as each runs dry, so the machine rotates them
// itself rather than needing a manual .env edit mid-session: first key that can actually
// fund a full run wins, in order. Returns the usable token, or null if none can.
async function pickApifyToken() {
  const candidates = [
    ['APIFY_TOKEN', APIFY_TOKEN],
    ['APIFY_TOKEN_2', process.env.APIFY_TOKEN_2],
  ].filter(([, t]) => t)

  for (const [label, token] of candidates) {
    const h = await apifyHeadroom(token)
    if (!h) { console.log(`  ${label}: unreadable (bad key?) — skipping`); continue }
    const verdict = h.left >= APIFY_RUN_COST ? 'usable' : `too low for a ~$${APIFY_RUN_COST} run`
    console.log(`  ${label}: $${h.used.toFixed(2)}/$${h.cap} used · $${h.left.toFixed(2)} left — ${verdict}`)
    if (h.left >= APIFY_RUN_COST) return { label, token }
  }
  return null
}

async function countByStage() {
  const { data } = await sb
    .from('contacts')
    .select('pipeline_stage, status, demo_built_at, email_1_poslat')
    .eq('client_id', CLIENT_ID)
  const dead = new Set(['Disqualified', 'Lost', 'Bounced'])
  const live = (data || []).filter(r => !dead.has(r.status || ''))
  return {
    total: data?.length ?? 0,
    dead: (data?.length ?? 0) - live.length,
    novi: live.filter(r => r.pipeline_stage === 'novi').length,
    sourced: live.filter(r => r.pipeline_stage === 'sourced').length,
    demo_building: live.filter(r => r.pipeline_stage === 'demo_building' && !r.demo_built_at).length,
    email_ready_not_sent: live.filter(r => r.pipeline_stage === 'email_ready' && !r.email_1_poslat).length,
    sent: live.filter(r => r.email_1_poslat).length,
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  SmartFlow Pipeline Machine — ${new Date().toISOString()}`)
  console.log(`  Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log('═══════════════════════════════════════════════════════')

  const before = await countByStage()
  console.log(`\nFunnel before: novi=${before.novi} sourced=${before.sourced} building=${before.demo_building} ready-to-send=${before.email_ready_not_sent} sent=${before.sent}`)

  // ── Stage 1: top up sourcing whenever there's no fresh inventory ───────────
  // `sourced` used to count toward "queue health" alongside `novi`, which was wrong:
  // qualify_queue.mjs drains `novi` to 0 on every single run by design (that's its whole
  // job), while `sourced` is a graveyard of already-parked needs_enrichment/review/reject
  // leads that will never become anything without manual work. Once `sourced` crossed 15
  // (almost immediately), this gate silently never fired again — a whole day's worth of
  // /loop iterations ran on zero fresh sourcing without that being visible anywhere. The
  // only signal that actually means "nothing new arrived" is `novi` being empty.
  if (!skipSource && before.novi === 0) {
    console.log(`\n─── Stage 1: No fresh leads waiting (novi=0) — topping up ───`)

    // Both channels run every top-up now — co-primary, not fallback.
    //
    // The two channels were first measured head to head on 2026-09-15 and FB Ads lost badly:
    // 278 raw ads → 48 qualified → 28 handles → 2 accounts over 30k followers, both national
    // telecoms. Its queries were generic offer phrases ("na rate", "bez kamate"), which are
    // bought by national brands and by 500-follower contractors — the 30k SMB band this offer
    // needs was barely represented. Per Nikola's explicit direction (2026-09-16): keep the 30k
    // floor, don't drop the channel, fix its targeting instead. Fixed by rewriting ADS_QUERIES
    // to niche-anchored phrases (dental/furniture/home-improvement/hospitality) plus a
    // telecom/bank/utility category exclusion, and adding an explore/exploit query-rotation
    // system (ads_query_yield.json) that learns which queries actually produce 30k+ ICP-fit
    // leads over time. Re-tested 2026-09-16 on a $1/3-query run: 1 qualified 30k+ dental lead
    // (Bludent, 41.8k) — genuinely on-ICP, not a telecom. Bounded to --queries 9 (default
    // budget) so cost per run stays predictable (~$2, same order as before).
    // IG bio search: searches bios directly, so the follower band is a *precondition* of
    // the search rather than something discovered after paying. Costs search credits, not
    // dollars — runs first since it's cheaper.
    await runScript('source_ig_bio_search.mjs', ['--yes', '--pages', '3', '--limit', '25'], 2400000)

    const apify = await pickApifyToken()
    if (apify) {
      console.log(`  → sourcing with ${apify.label} (FB Ads Library, niche-anchored queries)`)
      // 2400s, not the 280s default: a real run does up to 9 FB-ads batches, handle extraction
      // across ~130 pages, then IG verification. On the free plan each batch also *queues*
      // 2-3 min before it starts, so wall clock is ~25 min. At 900s it was SIGTERM'd at
      // batch 4 — money spent, zero leads landed (observed 2026-09-15).
      await runScript('source_leads.mjs', ['--yes', '--limit', '20'], 2400000, { APIFY_TOKEN: apify.token })
    } else {
      console.log('  No Apify key has enough budget for a full run — skipping the FB Ads channel this run.')
    }
  } else {
    console.log(`\n─── Stage 1: ${before.novi} fresh lead(s) still waiting — skipping sourcing ───`)
  }

  // ── Stage 1b: measure IG followers for any sourced/novi lead that has a handle but no ──
  // count yet. Google Maps-sourced leads never carry a follower count, and qualify_queue.mjs
  // reads that as `audience_unmeasured` and parks them forever — this is what actually
  // unblocks them.
  //
  // This used to run unconditionally on the raw APIFY_TOKEN, bypassing both the budget
  // check and the key rotation, on the assumption it was "pennies" (~$0.003/profile). It
  // is not: one run on 2026-09-15 cost $1.34, over half a key's remaining balance. It now
  // goes through the same rotation as sourcing and is skipped when no key can afford it.
  console.log('\n─── Stage 1b: Measure IG followers for unmeasured sourced leads ───')
  const apifyMeasure = await pickApifyToken()
  if (apifyMeasure) {
    console.log(`  → measuring with ${apifyMeasure.label}`)
    await runScript('measure_sourced_followers.mjs', [], 200000, { APIFY_TOKEN: apifyMeasure.token })
  } else {
    console.log('  No Apify key has enough budget — skipping follower measurement this run.')
  }

  // ── Stage 1c: find missing emails for the sourced/novi backlog ─────────────
  // A 6th disconnected script (2026-09-11) — its query targeted a status value
  // ('Novi Lead') the current pipeline hasn't written since before pipeline_stage
  // existed, so it silently matched 0 rows for months. Retargeted to the real gap
  // (no email, not already dead) and added the dry-run/dead-status safety it was
  // missing. Hunter/Firecrawl-based, no Apify cost.
  console.log('\n─── Stage 1c: Enrich missing emails for sourced/novi backlog ───')
  await runScript('enrich_top50.mjs', [], 300000)

  // ── Stage 1d: re-discover IG handles and verify their followers ────────────
  // A 7th disconnected script — complementary to Stage 1b, which can only measure a
  // lead that already has a handle. This finds handles for leads that don't, via the
  // business's own website/FB-about page, then verifies followers on anything new and
  // auto-disqualifies (<20k) rather than leaving it to clutter the queue. No Apify cost.
  console.log('\n─── Stage 1d: Re-discover IG handles for handle-less leads ───')
  await runScript('fix_ig_handles.mjs', [], 400000)

  // ── Stage 2: qualify the conveyor ──────────────────────────────────────────
  console.log('\n─── Stage 2: Qualify queue ───')
  await runScript('qualify_queue.mjs', ['--apply'])

  // ── Stage 3: auto-promote 'ready' leads past the redundant approval click ──
  //
  // Used to look at pipeline_stage='novi' only — which is also all qualify_queue.mjs ever
  // re-evaluates. That made 'sourced' a black hole: once a lead was parked there (for a
  // missing email, an unmeasured audience, a bad handle), nothing could ever get it out,
  // no matter how much of that gap later got filled in. Stages 1b/1c/1d spend real money
  // finding exactly those missing emails/handles/follower counts, and every one of those
  // writes was landing on leads this step couldn't see. Confirmed 2026-09-12: 5 parked
  // leads qualified 'ready' and were unreachable, two of them (Posteljine Fratelli 73k,
  // Dallas Nameštaj 44k) newly qualified *because* of the night's enrichment.
  //
  // Now it re-qualifies both stages. Guard against re-creating the retry-waste bug: a
  // lead that already carries a skip marker in `comment` was conclusively attempted and
  // failed on its own content (no catalogue, no prices, aggregator…), so it stays parked
  // until a human decides otherwise. Only never-attempted leads get promoted.
  console.log('\n─── Stage 3: Re-qualify novi + sourced, promote ready to demo_building ───')
  if (!isDryRun) {
    const { data: cfgRow } = await sb
      .from('machine_config').select('source_follower_floor').eq('client_id', CLIENT_ID).maybeSingle()
    const followerFloor = cfgRow?.source_follower_floor ?? undefined

    const { data: candidates } = await sb
      .from('contacts')
      .select('id,company_name,email,website,instagram_handle,instagram_followers,niche,status,pipeline_stage,izvor,intake_data,approved_to_send,email_draft,demo_built_at,comment')
      .eq('client_id', CLIENT_ID)
      .in('pipeline_stage', ['novi', 'sourced'])
      .not('status', 'in', '("Disqualified","Lost","Bounced")')

    const ATTEMPTED = /Demo preskočen|AOV gate|AOV nepoznat/i
    const promote = []
    for (const r of candidates || []) {
      if (r.demo_built_at) continue                       // already has a demo
      if (ATTEMPTED.test(r.comment || '')) continue        // conclusively failed before
      if (qualifyForQueue(r, { followerFloor }).verdict !== 'ready') continue
      // Reels-led lead gate (2026-11-10, lib/lead-fit.mjs): this step used to promote on audience size alone, with no check that
      // the business runs a serious social sales pipeline. An unmeasured lead waits for `node find_leads.mjs --place`.
      const d = r.intake_data?.dm_demand
      const fit = leadFit({ name: r.company_name, followers: r.instagram_followers, email: r.email,
        medViews: d?.median_views ?? null, viewsPerFollower: d?.views_per_follower ?? null, reels12: d?.reels12 ?? null, paidAds: !!d?.paid_ads })
      if (!fit.pass) { console.log(`  ↷ ${r.company_name}: lead gate — ${fit.fails.join(' | ')}`); continue }
      promote.push(r)
    }

    if (promote.length) {
      const { error } = await sb
        .from('contacts')
        .update({ pipeline_stage: 'demo_building' })
        .in('id', promote.map(r => r.id))
      if (error) console.error('  ✗ promote failed:', error.message)
      else console.log(`  ✓ Promoted ${promote.length} lead(s): ${promote.map(r => r.company_name).join(', ')}`)
    } else {
      console.log(`  Nothing ready to promote (${candidates?.length ?? 0} candidates checked).`)
    }
  } else {
    console.log('  [DRY RUN] — not executed')
  }

  // ── Stage 4: build demos ────────────────────────────────────────────────────
  console.log('\n─── Stage 4: Build demos ───')
  await runScript('build_demo_tenant.mjs', ['--approved'])

  // ── Stage 4a: real product photos for the catalogue ─────────────────────────
  // A 3rd script found disconnected the same way generate_intro_art.mjs was — 0 of 112
  // catalog rows had ever gotten a real photo. Runs before the art stage on purpose: its
  // own docstring notes the hero art has to invent generic merchandise without this,
  // when Nano Banana could be drawing the tenant's actual products instead.
  console.log('\n─── Stage 4a: Scrape real product photos for catalogues ───')
  await runScript('scrape_catalog_images.mjs', ['--all', '--yes', '--limit', '20'], 400000)

  // ── Stage 4b: hero art for the onboarding intro ─────────────────────────────
  // Existed as a completely separate script, never called from anywhere — every demo
  // this machine has ever built was missing its onboarding image until Nikola caught it
  // by eye on 2026-09-11 ("no picture, WTF"). Idempotent: skips any tenant that already
  // has art, so this is cheap on every run after the first backfill.
  console.log('\n─── Stage 4b: Generate onboarding hero art for new tenants ───')
  await runScript('generate_intro_art.mjs', ['--all', '--yes', '--limit', '20'], 400000)

  // ── Stage 5: fill website context (the missing link — without this most leads ──
  // hit generate_drafts.mjs's "no ad/reel/website context" dead-end and stall forever)
  console.log('\n─── Stage 5: Fill website context for drafting ───')
  // Bounded to 20/run (~9 min worst case at ~25s/lead) so one run can't blow past its own
  // timeout mid-batch the way an unbounded 46-lead run did on 2026-09-11 — the remainder
  // just gets picked up on the next /loop iteration.
  await runScript('fill_website_summaries.mjs', ['--limit', '20'], 600000)

  // ── Stage 6: generate drafts ────────────────────────────────────────────────
  console.log('\n─── Stage 6: Generate drafts ───')
  await runScript('generate_drafts.mjs', ['--mode', 'initial'])

  // ── Stage 7: promote to email_ready ─────────────────────────────────────────
  console.log('\n─── Stage 7: Promote to email_ready ───')
  await runScript('promote_email_ready.mjs')

  // ── Stage 8: stats ──────────────────────────────────────────────────────────
  const after = await countByStage()
  console.log('\n═══════════════════════════════════════════════════════')
  console.log('  FUNNEL SNAPSHOT')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  novi (station 1):        ${after.novi}`)
  console.log(`  sourced (parked):        ${after.sourced}`)
  console.log(`  demo_building (queued):  ${after.demo_building}`)
  console.log(`  ready to send:           ${after.email_ready_not_sent}`)
  console.log(`  already sent:            ${after.sent}`)
  console.log(`  dead (disq/lost/bounced): ${after.dead}`)
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Nothing sent. Sending stays gated on your explicit go-ahead.')

  if (!isDryRun) {
    const record = { ts: new Date().toISOString(), before, after }
    appendFileSync(STATS_LOG, JSON.stringify(record) + '\n')
  }
}

main().catch(err => { console.error('✗ Fatal:', err.message); process.exit(1) })
