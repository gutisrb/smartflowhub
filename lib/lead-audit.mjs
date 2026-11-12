// The audit of one lead's Instagram as a sales channel (audit_leads.mjs, qualify_new.mjs). Apify, ~$0.03 per lead.
import { BUYER_Q } from './dm-demand.mjs'
const fold = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'dj').replace(/[^a-z0-9]+/g, ' ').trim()
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }

export async function reels(handle, token) {
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

export async function ads(lead, token) {
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


/** Both, as stored in contacts.intake_data.audit. */
export async function auditLead(lead, token, { withAds = true } = {}) {
  const r = await reels(lead.instagram_handle, token)
  const a = withAds ? await ads(lead, token) : null
  const f = lead.instagram_followers || lead.intake_data?.enrichment?.instagram_profile?.followers || 0
  return { at: new Date().toISOString(), followers: f, ...r, perFollower: r?.medViews && f ? +(r.medViews / f).toFixed(2) : null, ads: a }
}
