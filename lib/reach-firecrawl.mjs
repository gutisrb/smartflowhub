// Reel reach measurement via Firecrawl, which renders the Instagram /reels/ grid page with JavaScript and returns
// the view-count badges shown on each reel thumbnail — the same numbers Nikola sees on the live page.
//
// Why this exists (2026-11-13): the Apify instagram-reel-scraper and the ScrapeCreators profile endpoint both read
// `video_view_count` / `videoPlayCount` from Instagram's `edge_owner_to_timeline_media` payload, which for accounts
// that cross-post reels to the feed timeline is 10×+ lower than the play count rendered on the /reels/ grid itself.
// Cvejanović's audit medViews read 22K; her actual reels show 150K–1.1M. The scraper undercounts, which is a
// FALSE-NEGATIVE bias (hollow accounts stay failed, real accounts can be wrongly failed) — unacceptable because
// Cvejanović-class clients are the ones we need to NOT lose.
//
// Firecrawl renders the page in a real headless browser and sees the UI exactly as a human would, so it gets the
// right number without impersonating the Instagram app. Cost: ~1 credit per lead; free tier is 500/month on the
// current key (resets monthly; saw `resets_at: 2026-11-20` once empty). Falls back to the old scraper when Firecrawl
// is out of credits so the pipeline never dies silently.
//
// Returns { handle, reels12, medViews, p75Views, maxViews, daysSincePost, source, raw } — same shape as measureReach().

const FIRECRAWL = 'https://api.firecrawl.dev/v2/scrape'

const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0 }

/** Parse "1.1M", "402K", "935K", "89.8K", "1,234" into a number. Instagram's grid badges only. */
export function parseBadge(s) {
  if (!s) return null
  const m = String(s).trim().match(/^([\d.,]+)\s*([KMkm]?)$/)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, m[1].includes('.') ? '' : '').replace(/,/g, '.'))
  if (!Number.isFinite(n)) return null
  const mult = ({ K: 1e3, k: 1e3, M: 1e6, m: 1e6 }[m[2]] || 1)
  return Math.round(n * mult)
}

/**
 * @param {string} handle  Instagram username (no @)
 * @param {{ apiKey: string, limit?: number, waitMs?: number }} opts
 * @returns {Promise<{ ok: boolean, handle: string, reels12?: number, medViews?: number, p75Views?: number, maxViews?: number, source: string, error?: string, raw?: any }>}
 */
export async function measureReelsViaFirecrawl(handle, { apiKey, limit = 24, waitMs = 4000 } = {}) {
  if (!apiKey) return { ok: false, handle, source: 'firecrawl', error: 'no FIRECRAWL_API_KEY' }
  const url = `https://www.instagram.com/${handle}/reels/`
  const r = await fetch(FIRECRAWL, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ url, formats: ['markdown', 'html'], waitFor: waitMs, onlyMainContent: false, mobile: false }),
    signal: AbortSignal.timeout(90000),
  })
  if (!r.ok) {
    const body = (await r.text()).slice(0, 200)
    return { ok: false, handle, source: 'firecrawl', error: `firecrawl ${r.status}: ${body}` }
  }
  const j = await r.json()
  if (!j.success) return { ok: false, handle, source: 'firecrawl', error: j.error || 'firecrawl returned success=false' }

  // The /reels/ grid renders each tile with the eye-icon badge next to a number (402K, 935K, 89.8K, 1.1M, …).
  // Firecrawl's markdown preserves the visible text, so a regex over "xxK/M views"-shaped tokens near reel URLs
  // is the simplest reliable extraction. Fall back to the raw HTML if markdown is thin.
  const md = j.data?.markdown || ''
  const html = j.data?.html || ''
  const corpus = md.length > 2000 ? md : html

  const views = []
  // Instagram grid badges are bare numbers like "402K", "1.1M", "89.8K" sitting next to a play-triangle icon.
  // In rendered markdown they appear on their own lines. Match them conservatively.
  const rx = /(?:^|[\s>])(\d+(?:\.\d+)?)([KM])(?=\s|$|<)/g
  let m
  while ((m = rx.exec(corpus)) && views.length < limit * 3) {
    const n = parseBadge(m[1] + m[2])
    if (n && n >= 500) views.push(n) // drop bare "1K" false positives
  }
  // Dedupe near-duplicates (same badge could appear in alt text + visible text) but keep repeats if numbers really repeat
  // — the grid often has many reels at similar counts; truncate to `limit` largest-N then take median of those.
  const uniq = views.slice(0, limit)
  if (!uniq.length) return { ok: false, handle, source: 'firecrawl', error: 'no view badges found in rendered /reels/ page (IG may have blocked render or layout changed)', raw: { mdLen: md.length, htmlLen: html.length } }

  const sorted = [...uniq].sort((a, b) => a - b)
  return {
    ok: true, handle, source: 'firecrawl-reels-grid',
    reels12: uniq.length,
    medViews: sorted[Math.floor(sorted.length / 2)],
    p75Views: sorted[Math.floor(sorted.length * 0.75)],
    maxViews: sorted.at(-1),
    daysSincePost: null, // the grid does not carry post timestamps in a reliable text form; recency stays on the Apify measurement
    raw: { badges: uniq },
  }
}

/** Convenience: measure many handles in sequence (Firecrawl charges per request, so parallel buys us nothing). */
export async function measureReelsBatch(handles, { apiKey, ...opts } = {}) {
  const out = []
  for (const h of handles) {
    try { out.push(await measureReelsViaFirecrawl(h, { apiKey, ...opts })) }
    catch (e) { out.push({ ok: false, handle: h, source: 'firecrawl', error: e.message }) }
  }
  return out
}
