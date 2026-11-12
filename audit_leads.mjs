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
import { BUYER_Q } from './lib/dm-demand.mjs'

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

async function reels(handle, token) {
  const r = await fetch(`https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?token=${token}&maxTotalChargeUsd=0.2&timeout=240`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: [handle], resultsLimit: 20 }), signal: AbortSignal.timeout(260000),
  })
  if (!r.ok) return null
  const items = (await r.json()).filter((x) => x.ownerUsername?.toLowerCase() === handle.toLowerCase() && x.timestamp).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  if (!items.length) return { n: 0 }
  const now = Date.now(), day = 864e5
  const newest = items.slice(0, 12)
  const views = newest.map((x) => x.videoPlayCount || x.videoViewCount || 0)
  const comments = newest.map((x) => x.commentsCount || 0)
  const qs = newest.flatMap((x) => (x.latestComments || []).filter((c) => c.ownerUsername?.toLowerCase() !== handle.toLowerCase() && BUYER_Q.test(String(c.text || '')))).length
  return {
    n: items.length, last30: items.filter((x) => now - new Date(x.timestamp) <= 30 * day).length, daysSince: Math.round((now - new Date(items[0].timestamp)) / day),
    medViews: median(views), medComments: median(comments), avgComments: Math.round(comments.reduce((a, b) => a + b, 0) / (comments.length || 1)), buyerQs: qs,
  }
}

async function ads(lead, token) {
  const name = String(lead.company_name || '').replace(/[|·•(].*$/, '').replace(/\p{Extended_Pictographic}/gu, '').trim()
  const url = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=RS&q=${encodeURIComponent(name)}&search_type=keyword_unordered&media_type=all`
  const r = await fetch(`https://api.apify.com/v2/acts/XtaWFhbtfxyzqrFmd/run-sync-get-dataset-items?token=${token}&maxItems=25&maxTotalChargeUsd=0.1&timeout=200`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ urls: [{ url }], 'scrapePageAds.countryCode': 'RS', 'scrapePageAds.activeStatus': 'active' }), signal: AbortSignal.timeout(220000),
  }).catch(() => null)
  if (!r?.ok) return null
  const items = await r.json()
  const want = [fold(name), fold(lead.instagram_handle).replace(/ /g, '')].filter((x) => x.length > 3)
  const mine = items.filter((it) => { const p = fold(it.page_name || it.pageName || it.snapshot?.page_name || ''); const pc = p.replace(/ /g, ''); return want.some((w) => p.includes(w) || pc.includes(w.replace(/ /g, '')) || (p.length > 3 && w.includes(p))) })
  const starts = mine.map((it) => it.start_date || it.startDate || it.ad_delivery_start_time).filter(Boolean).map((d) => (typeof d === 'number' ? d * 1000 : Date.parse(d))).filter(Number.isFinite)
  return { active: mine.length, since: starts.length ? new Date(Math.min(...starts)).toISOString().slice(0, 10) : null, page: mine[0]?.page_name || mine[0]?.snapshot?.page_name || null }
}

const rows = []
for (const l of leads || []) {
  const key = await pickApifyToken(0.25, { quiet: true })
  if (!key) { console.log('no Apify key with budget left'); break }
  const r = await reels(l.instagram_handle, key.token)
  const a = process.argv.includes('--no-ads') ? null : await ads(l, key.token)
  const f = l.instagram_followers || l.intake_data?.enrichment?.instagram_profile?.followers || 0
  const audit = { at: new Date().toISOString(), followers: f, ...r, perFollower: r?.medViews && f ? +(r.medViews / f).toFixed(2) : null, ads: a }
  await sb.from('contacts').update({ intake_data: { ...(l.intake_data || {}), audit } }).eq('id', l.id)
  rows.push({ name: l.company_name, ...audit })
  console.log(`${String(l.company_name).slice(0, 28).padEnd(28)} ${String(f).padStart(7)} fol | reels/30d ${String(r?.last30 ?? '?').padStart(2)} | last ${String(r?.daysSince ?? '?').padStart(3)}d | med views ${String(r?.medViews ?? '?').padStart(7)} (${audit.perFollower ?? '?'}×) | comments/reel ${String(r?.avgComments ?? '?').padStart(4)} | buyer Qs ${String(r?.buyerQs ?? '?').padStart(3)} | ads ${a ? `${a.active}${a.since ? ' since ' + a.since : ''}` : '?'}`)
}
