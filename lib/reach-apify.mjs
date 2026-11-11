// Reel reach from Apify's Instagram profile actor (the same one source_leads.mjs uses), shaped like lib/dm-demand.mjs rows so lib/lead-fit.mjs
// can judge it. Why: ScrapeCreators needs a $50 minimum top-up (Nikola, 2026-11-11); Apify's free plan gives ~$5/month per key and the actor costs
// about $0.0023 per profile. Returns { handle, followers, reels12, medViews, viewsPerFollower, daysSincePost, fullName, bio, category, website, email }.
import { pickApifyToken } from './apify-key.mjs'
import { INVITE } from './dm-demand.mjs'

const ACTOR = 'dSCLg0C3YEZ83HzYX' // apify/instagram-profile-scraper
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0 }

export function reachFromProfile(p) {
  const posts = Array.isArray(p.latestPosts) ? p.latestPosts : []
  const isReel = (x) => x.type === 'Video' || x.productType === 'clips' || x.videoViewCount != null || x.videoPlayCount != null
  const reels = posts.filter(isReel)
  const views = reels.map((x) => x.videoPlayCount ?? x.videoViewCount ?? 0)
  const ts = posts.map((x) => Date.parse(x.timestamp || x.takenAt || '')).filter(Number.isFinite).sort((a, b) => b - a)
  const followers = p.followersCount ?? null
  const medViews = med(views)
  return {
    handle: p.username, followers, fullName: p.fullName || null, bio: p.biography || '', category: p.businessCategoryName || null,
    website: p.externalUrl || null, email: p.businessEmail || null, isBusiness: !!p.isBusinessAccount,
    reels12: reels.length, medViews, viewsPerFollower: followers ? +(medViews / followers).toFixed(3) : null,
    daysSincePost: ts.length ? Math.round((Date.now() - ts[0]) / 864e5) : null, postsSeen: posts.length,
  }
}

/** Followers, free: Instagram's public page carries them in og:description ("40K Followers, 581 Following…"). null when the page does not show them. */
export async function followersFree(handle) {
  try {
    const r = await fetch(`https://www.instagram.com/${handle}/`, { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15' }, signal: AbortSignal.timeout(15000) })
    const m = /og:description" content="([\d.,]+)\s*([KMkm]?)\s*Followers/.exec(await r.text())
    if (!m) return null
    const n = Number(m[1].replace(/,/g, ''))
    return Math.round(n * ({ K: 1e3, M: 1e6 }[m[2].toUpperCase()] || 1))
  } catch { return null }
}

/**
 * Reel reach for many handles in ONE Apify run (apify/instagram-reel-scraper, ~$0.011 per profile, measured 2026-11-11): the median views of
 * each account's last 12 REELS. A sturdier sample than the ScrapeCreators profile call, which averaged only the reels among the last 12 posts:
 * Vitax read 154k there (2 reels) and 12k here (12 reels); the gate must judge the second.
 * @param {string[]} handles
 * @returns {Promise<{rows: any[], error?: string}>}
 */
export async function measureReach(handles, { maxUsd = 1 } = {}) {
  const key = await pickApifyToken(Math.min(maxUsd, 0.25), { quiet: true })
  if (!key) return { rows: [], error: 'no Apify key has budget' }
  const url = `https://api.apify.com/v2/acts/apify~instagram-reel-scraper/run-sync-get-dataset-items?token=${key.token}&maxTotalChargeUsd=${maxUsd}&timeout=280`
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: handles, resultsLimit: 24 }), signal: AbortSignal.timeout(300000) })
  if (!r.ok) return { rows: [], error: `apify ${r.status}: ${(await r.text()).slice(0, 160)}` }
  const by = new Map()
  for (const x of await r.json()) { const h = x.ownerUsername; if (h) { if (!by.has(h)) by.set(h, []); by.get(h).push(x) } }
  const rows = []
  for (const h of handles) {
    const items = by.get(h) || []
    const views = items.map((x) => x.videoPlayCount ?? x.videoViewCount ?? 0)
    const ts = items.map((x) => Date.parse(x.timestamp || '')).filter(Number.isFinite).sort((a, b) => b - a)
    // the DM prompt, from the captions of the same reels (no extra call)
    const dmCaptions = items.filter((x) => INVITE.test(x.caption || '')).length
    const sorted = [...views].sort((a, b) => a - b)
    const p75Views = sorted.length ? sorted[Math.floor(sorted.length * 0.75)] : 0
    rows.push({ handle: h, reels12: items.length, medViews: med(views), p75Views, maxViews: sorted.at(-1) ?? 0, dmCaptions, daysSincePost: ts.length ? Math.round((Date.now() - ts[0]) / 864e5) : null })
  }
  return { rows }
}

/**
 * Does the account tell people to order / ask / book in the DM? From its bio and the captions of its last 12 posts (apify/instagram-profile-scraper,
 * ~$0.0023 per profile). Reel captions alone missed Tandem, whose invitations sit in its bio and photo posts.
 * @returns {Promise<Map<string, { dm: boolean, bioInvite: boolean, captionInvites: number, bio: string }>>}
 */
export async function measureDmPrompt(handles, { maxUsd = 0.5 } = {}) {
  const out = new Map()
  const key = await pickApifyToken(Math.min(maxUsd, 0.2), { quiet: true })
  if (!key || !handles.length) return out
  const r = await fetch(`https://api.apify.com/v2/acts/dSCLg0C3YEZ83HzYX/run-sync-get-dataset-items?token=${key.token}&maxTotalChargeUsd=${maxUsd}&timeout=200`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usernames: handles, resultsLimit: 12 }), signal: AbortSignal.timeout(240000) })
  if (!r.ok) return out
  for (const p of await r.json()) {
    if (!p?.username) continue
    const bioInvite = INVITE.test(p.biography || '')
    const captionInvites = (p.latestPosts || []).filter((x) => INVITE.test(x.caption || '')).length
    out.set(p.username, { dm: bioInvite || captionInvites >= 1, bioInvite, captionInvites, bio: p.biography || '' })
  }
  return out
}

/**
 * Exact profile facts in one Apify call (~$0.0023 per profile): followers, website, business e-mail, bio, category.
 * @returns {Promise<Map<string, { followers: number|null, fullName: string, bio: string, website: string|null, email: string|null, category: string|null, isBusiness: boolean }>>}
 */
export async function fetchProfiles(handles, { maxUsd = 0.6 } = {}) {
  const out = new Map()
  const key = await pickApifyToken(Math.min(maxUsd, 0.2), { quiet: true })
  if (!key || !handles.length) return out
  for (let i = 0; i < handles.length; i += 60) {
    const batch = handles.slice(i, i + 60)
    const r = await fetch(`https://api.apify.com/v2/acts/dSCLg0C3YEZ83HzYX/run-sync-get-dataset-items?token=${key.token}&maxTotalChargeUsd=${maxUsd}&timeout=250`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usernames: batch, resultsLimit: 1 }), signal: AbortSignal.timeout(280000) })
    if (!r.ok) continue
    for (const p of await r.json()) if (p?.username) out.set(p.username.toLowerCase(), { followers: p.followersCount ?? null, fullName: p.fullName || '', bio: p.biography || '', website: p.externalUrl || null, email: p.businessEmail || null, category: p.businessCategoryName || null, isBusiness: !!p.isBusinessAccount })
  }
  return out
}
