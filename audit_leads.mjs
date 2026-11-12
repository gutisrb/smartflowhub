/**
 * audit_leads.mjs — is this lead's Instagram a real sales channel? Fresh numbers per lead (Nikola, 2026-11-12: "they posting often? showing signs of
 * social media marketing investment (meta ads / high view reels)? do they get a lot of inquiries daily?").
 *
 *   node audit_leads.mjs [--stage email_ready] [--emails a,b] [--no-ads]
 *
 * Per lead (Apify, ~$0.03 each):
 *   reels      apify/instagram-reel-scraper, last 20 reels: reels in the last 30 days, median views of the newest 12, views per follower,
 *              comments per reel, buyer questions per reel (price/availability/delivery questions in the visible comments)
 *   ads        facebook-ads-library-scraper (active ads in RS whose page name matches the business): count + oldest running ad
 * Writes contacts.intake_data.audit and prints one table. DMs are invisible from outside: the comment questions and reach are the proxy.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { pickApifyToken } from './lib/apify-key.mjs'
import { auditLead } from './lib/lead-audit.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
for (const l of readFileSync(resolve(__dirname, '.env.local'), 'utf8').split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m && process.env[m[1].trim()] === undefined) process.env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '') }
const SF = '69acf7e9-557e-4ca3-85bd-a785ef39e351'
const arg = (k) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : null }
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'dj').replace(/[^a-z0-9]+/g, ' ').trim()
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }

let q = sb.from('contacts').select('id,company_name,instagram_handle,instagram_followers,website,intake_data').eq('client_id', SF)
q = arg('--emails') ? q.in('demo_tenant_email', arg('--emails').split(',')) : q.eq('pipeline_stage', arg('--stage') || 'email_ready')
const { data: leads } = await q

const rows = []
for (const l of leads || []) {
  const key = await pickApifyToken(0.25, { quiet: true })
  if (!key) { console.log('no Apify key with budget left'); break }
  const audit = await auditLead(l, key.token, { withAds: !process.argv.includes('--no-ads') })
  const r = audit, a = audit.ads, f = audit.followers
  await sb.from('contacts').update({ intake_data: { ...(l.intake_data || {}), audit } }).eq('id', l.id)
  rows.push({ name: l.company_name, ...audit })
  console.log(`${String(l.company_name).slice(0, 28).padEnd(28)} ${String(f).padStart(7)} fol | reels/30d ${String(r?.last30 ?? '?').padStart(2)} | last ${String(r?.daysSince ?? '?').padStart(3)}d | med views ${String(r?.medViews ?? '?').padStart(7)} (${audit.perFollower ?? '?'}×) | comments/reel ${String(r?.avgComments ?? '?').padStart(4)} | buyer Qs ${String(r?.buyerQs ?? '?').padStart(3)} | ads ${a ? `${a.active}${a.since ? ' since ' + a.since : ''}` : '?'}`)
}
