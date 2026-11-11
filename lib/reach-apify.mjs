// Reel reach from Apify's Instagram profile actor (the same one source_leads.mjs uses), shaped like lib/dm-demand.mjs rows so lib/lead-fit.mjs
// can judge it. Why: ScrapeCreators needs a $50 minimum top-up (Nikola, 2026-11-11); Apify's free plan gives ~$5/month per key and the actor costs
// about $0.0023 per profile. Returns { handle, followers, reels12, medViews, viewsPerFollower, daysSincePost, fullName, bio, category, website, email }.
import { pickApifyToken } from './apify-key.mjs'

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
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: handles, resultsLimit: 12 }), signal: AbortSignal.timeout(300000) })
  if (!r.ok) return { rows: [], error: `apify ${r.status}: ${(await r.text()).slice(0, 160)}` }
  const by = new Map()
  for (const x of await r.json()) { const h = x.ownerUsername; if (h) { if (!by.has(h)) by.set(h, []); by.get(h).push(x) } }
  const rows = []
  for (const h of handles) {
    const items = by.get(h) || []
    const views = items.map((x) => x.videoPlayCount ?? x.videoViewCount ?? 0)
    const ts = items.map((x) => Date.parse(x.timestamp || '')).filter(Number.isFinite).sort((a, b) => b - a)
    rows.push({ handle: h, reels12: items.length, medViews: med(views), daysSincePost: ts.length ? Math.round((Date.now() - ts[0]) / 864e5) : null })
  }
  return { rows }
}
