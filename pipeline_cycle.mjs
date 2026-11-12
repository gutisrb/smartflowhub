/**
 * pipeline_cycle.mjs — ONE command for the whole lead cycle, with a budget guard at every paid step (Nikola, 2026-11-11: "make it all automatic").
 *
 *   node pipeline_cycle.mjs [--discover] [--queries 30] [--build] [--max-build 6] [--dry]
 *
 *   1 discover   source_ig_google.mjs        (only with --discover; Apify)
 *   2 qualify    qualify_new.mjs --apply     profile gate → own live website (found if missing) → reels reach → email (find_emails layers)
 *   3 emails     find_emails.mjs --apply     any lead still without an address
 *   4 build      build_demo_tenant.mjs       (only with --build; Gemini flash-lite, --max-build leads)
 *   5 comments   collect_comments_apify.mjs  real customer questions per demo
 *   6 gate       finish_batch.sh             reseed + claims gate on every demo
 *   7 report     readiness.mjs               what is missing per demo (hand sheet, E1, wallpaper, login…)
 * What is left after this is the part that needs judgement: the hand sheet + E1 block per demo (agents/Nikola), and the send approval.
 * Never sends mail. Skips a paid step when no Apify key has headroom.
 */
import { spawnSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { apifyKeyCandidates, apifyHeadroom } from './lib/apify-key.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '') }
const args = process.argv.slice(2)
const arg = (k, d) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : d }
const DRY = args.includes('--dry')
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const run = (title, cmd, a, env = {}) => {
  console.log(`\n━━ ${title}\n   $ ${cmd} ${a.join(' ')}`)
  if (DRY) return 0
  const r = spawnSync(cmd, a, { cwd: __dirname, stdio: 'inherit', env: { ...process.env, ...env } })
  return r.status
}

// budget: total Apify headroom across keys, Hunter credits, Firecrawl credits
let apify = 0
for (const [, t] of apifyKeyCandidates()) { const h = await apifyHeadroom(t); if (h) apify += Math.max(0, h.left) }
const hunter = await fetch(`https://api.hunter.io/v2/account?api_key=${process.env.HUNTER_API_KEY}`).then((r) => r.json()).catch(() => null)
const fc = await fetch('https://api.firecrawl.dev/v2/team/credit-usage', { headers: { authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}` } }).then((r) => r.json()).catch(() => null)
console.log(`budget  Apify $${apify.toFixed(2)} · Hunter ${hunter?.data?.requests?.credits?.remaining ?? hunter?.data?.credits?.remaining ?? '?'} credits · Firecrawl ${fc?.data?.remaining_credits ?? '?'} credits`)
if (apify < 0.3) console.log('⚠ Apify headroom < $0.30: discovery and reach measurement are skipped')

if (args.includes('--discover') && apify >= 0.5) run('1 discover', 'node', ['source_ig_google.mjs', '--queries', arg('--queries', '30'), '--pages', '3'])
if (apify >= 0.3) run('2 qualify new leads', 'node', ['qualify_new.mjs', '--hours', '6', '--apply', '--max-usd', Math.min(1.5, apify - 0.1).toFixed(2)])
run('3 emails for leads without one', 'node', ['find_emails.mjs', '--stages', 'demo_building,novi,sourced', '--apply'])

if (args.includes('--build')) {
  const { data } = await sb.from('contacts').select('id,company_name').eq('client_id', SF).eq('pipeline_stage', 'demo_building').is('demo_tenant_email', null).not('email', 'is', null).limit(Number(arg('--max-build', 6)))
  for (const l of data || []) run(`4 build ${l.company_name}`, 'node', ['build_demo_tenant.mjs', '--lead-id', l.id, '--force', '--ignore-aov'], { GEMINI_MODEL: 'gemini-3.1-flash-lite', GEMINI_RPM: '14' })
}
if (apify >= 0.15) run('5+6 comments → reseed → claims gate', './finish_batch.sh', [])
run('7 readiness', 'node', ['readiness.mjs'])
