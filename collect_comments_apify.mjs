/**
 * collect_comments_apify.mjs — the real customer comments of a demo's business, from Apify (Nikola, 2026-11-11: "forget ScrapeCreators, use Apify").
 * apify/instagram-reel-scraper returns each reel with its latest comments, so the posts AND the questions come from one call (~$0.015 per business).
 * Writes clients.onboarding_copy.customer_voice = { posts, questions, handle, fetched_at }, the shape seed_onboarding_story.mjs and lib/demo-gate.mjs read.
 *
 *   node collect_comments_apify.mjs --all-pipeline      every tenant in Demo se pravi / Email spreman that has NO stored questions
 *   node collect_comments_apify.mjs --email <tenant>
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pickApifyToken } from './lib/apify-key.mjs'
import { cut } from './lib/text-safe.mjs'
import { BUYER_Q } from './lib/dm-demand.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '') }
const POINTS_AT_ITEM = /(?<!\p{L})(ov(aj|a|o|og|oj|e|u|og)|ovakv\w*|ovih|taj|ta|to|ovom)(?!\p{L})/iu // same test as collect_customer_voice.mjs
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

let tenants = []
if (process.argv.includes('--all-pipeline')) {
  const { data } = await sb.from('contacts').select('demo_tenant_email').eq('client_id', SF).in('pipeline_stage', ['demo_building', 'email_ready']).not('demo_tenant_email', 'is', null)
  tenants = (data || []).map((r) => r.demo_tenant_email)
} else if (arg('--email')) tenants = [arg('--email')]

for (const t of tenants) {
  const { data: client } = await sb.from('clients').select('id,name,onboarding_copy').eq('email', t).single()
  const { data: contact } = await sb.from('contacts').select('instagram_handle').eq('demo_tenant_email', t).limit(1).maybeSingle()
  if (!client || !contact?.instagram_handle) { console.log(`skip ${t}: no client or handle`); continue }
  const have = client.onboarding_copy?.customer_voice?.questions?.length || 0
  if (have >= 3 && process.argv.includes('--all-pipeline') && !arg('--reels')) { console.log(`skip ${client.name}: ${have} real questions already stored`); continue }
  const handle = contact.instagram_handle
  const key = await pickApifyToken(0.15, { quiet: true }) // per business: a key can run dry mid-batch
  if (!key) { console.log('no Apify key with budget left'); break }
  const r = await fetch(`https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?token=${key.token}&maxTotalChargeUsd=0.25&timeout=200`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: [handle], resultsLimit: Number(arg('--reels') || 12) }), signal: AbortSignal.timeout(220000) })
  if (!r.ok) { console.log(`${client.name}: apify ${r.status}`); continue }
  const items = (await r.json()).filter((x) => x.ownerUsername?.toLowerCase() === handle.toLowerCase())
  const posts = items.map((x) => ({ shortcode: x.shortCode, caption: cut(x.caption || '', 300), image: x.displayUrl || null })).slice(0, 12)
  const questions = []
  for (const x of items) for (const c of x.latestComments || []) {
    const text = String(c.text || '').replace(/\s+/g, ' ').trim()
    if (!text || text.length < 3 || text.length > 160 || c.ownerUsername?.toLowerCase() === handle.toLowerCase() || !BUYER_Q.test(text)) continue
    questions.push({ text, shortcode: x.shortCode, points_at_item: POINTS_AT_ITEM.test(text) })
  }
  const uniq = [...new Map(questions.map((q) => [q.text.toLowerCase(), q])).values()].slice(0, 40)
  const voice = { ...(client.onboarding_copy?.customer_voice || {}), handle, posts, questions: uniq, fetched_at: new Date().toISOString(), source: 'apify-reel-scraper' }
  await sb.from('clients').update({ onboarding_copy: { ...(client.onboarding_copy || {}), customer_voice: voice } }).eq('id', client.id)
  console.log(`${client.name}: ${items.length} reels, ${uniq.length} real buyer questions  ${uniq.slice(0, 3).map((q) => '"' + q.text.slice(0, 40) + '"').join(' ')}`)
}
