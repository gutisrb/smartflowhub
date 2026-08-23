/**
 * Two numbers decide whether a lead is worth a demo build.
 *
 *   AOV  — can the arithmetic work at all?
 *   MIS  — do they already believe social is a sales channel, and pay for it?
 *
 * AOV alone was the fix for the chocolate-shop problem: below ~15.000 RSD a
 * ~400 EUR/mo retainer needs an implausible number of extra sales. But a high
 * ticket on its own still describes plenty of businesses that get three DMs a
 * week and would feel no pain at all.
 *
 * MIS closes that gap, and it reframes the whole pitch. A business running Meta
 * ads is ALREADY PAYING to generate Instagram DMs — and then answering them by
 * hand, at human speed, during working hours. They bought the top of the funnel
 * and left the bottom of it manual. We are not asking them to believe in a new
 * channel; we are selling the missing half of one they already fund.
 *
 * That is why the two scores multiply rather than add. High AOV + zero marketing
 * spend is a business we would have to educate. High spend + low AOV cannot pay
 * us. We want both.
 */

// ── AOV ──────────────────────────────────────────────────────────────────────
export const MIN_AOV_RSD = 15000

export function assessAov(services = []) {
  const prices = services
    .map(s => (typeof s.price_min === 'number' ? s.price_min : null))
    .filter(p => p && p > 0)
    .sort((a, b) => a - b)
  if (prices.length < 2) return { aov: null, verdict: 'unknown', prices }
  const median = prices[Math.floor(prices.length / 2)]
  return { aov: median, verdict: median >= MIN_AOV_RSD ? 'pass' : 'fail', prices }
}

// ── Marketing investment ─────────────────────────────────────────────────────
const band = (v, table, dflt = 0) => {
  for (const [min, pts] of table) if (v >= min) return pts
  return dflt
}

/**
 * Scores 0–100 from data we already scrape. Every input is optional; a lead we
 * know nothing about scores low rather than throwing, and `confidence` reports
 * how much of the score rests on real data.
 */
export function assessMarketingInvestment(intake = {}, igProfile = {}) {
  const parts = {}
  let known = 0

  // 1. Paid ads live right now (0–30). The strongest single signal: money is
  //    moving through this channel today, not in principle.
  const ads = Number(intake.active_ads_count) || 0
  if (intake.active_ads_count != null) known++
  parts.activeAds = band(ads, [[8, 30], [4, 23], [2, 15], [1, 8]])

  // 2. How long they have sustained it (0–20). A campaign running six months is
  //    a budget line; one running four days is an experiment.
  let days = null
  if (intake.ad_start_date) {
    const start = new Date(intake.ad_start_date)
    if (!Number.isNaN(start.getTime())) {
      days = Math.max(0, Math.round((Date.now() - start.getTime()) / 86_400_000))
      known++
    }
  }
  parts.longevity = days == null ? 0 : band(days, [[180, 20], [60, 17], [14, 12], [0, 5]])

  // 3. Platform breadth (0–15). Running across Instagram AND Facebook AND
  //    Messenger means someone is actually managing placements.
  const platforms = Array.isArray(intake.publisher_platforms) ? intake.publisher_platforms.length : 0
  if (platforms) known++
  parts.platforms = band(platforms, [[3, 15], [2, 10], [1, 5]])

  // 4. Video creative (0–10). Video costs real money or real time to produce.
  if (intake.has_video_creative != null) known++
  parts.videoCreative = intake.has_video_creative ? 10 : 0

  // 5. Organic cadence (0–15). A thousand posts is a business that has treated
  //    the account as a channel for years.
  const posts = Number(igProfile.posts_count) || 0
  if (igProfile.posts_count != null) known++
  parts.cadence = band(posts, [[1000, 15], [400, 12], [100, 8], [20, 3]])

  // 6. Funnel completeness (0–10). A link out and a verified profile mean the
  //    account is wired to somewhere a purchase can happen.
  if (igProfile.external_url != null || igProfile.is_verified != null) known++
  parts.funnel = (igProfile.external_url ? 5 : 0) + (igProfile.is_verified ? 5 : 0)

  const score = Object.values(parts).reduce((a, b) => a + b, 0)
  const confidence = known >= 5 ? 'high' : known >= 3 ? 'medium' : 'low'

  return {
    score,
    parts,
    confidence,
    adDays: days,
    activeAds: ads,
    // A zero score with nothing to go on is NOT evidence of a dormant business —
    // it means we never scraped their ads. Demart scores 0 purely because its row
    // was created by hand. Saying "dormant" there would be inventing a finding.
    tier: confidence === 'low' && score < 15
      ? 'unknown'
      : score >= 60 ? 'invested' : score >= 35 ? 'active' : score >= 15 ? 'light' : 'dormant',
    /** the sentence this score licenses in outreach — null when we can't back it up */
    hook: ads >= 2 && confidence !== 'low'
      ? `Trenutno vrti ${ads} aktivnih oglasa${days != null && days >= 60 ? `, već ${Math.round(days / 30)} meseci` : ''} — plaćaju da im poruke stignu.`
      : null,
  }
}

/**
 * The combined verdict. Both gates must clear: one says they can pay us, the
 * other says they already believe in the channel we plug into.
 */
export function qualifyLead({ services = [], intake = {}, igProfile = {} } = {}) {
  const aov = assessAov(services)
  const mis = assessMarketingInvestment(intake, igProfile)

  const aovOk = aov.verdict === 'pass'
  const misOk = mis.score >= 35

  let verdict
  if (aov.verdict === 'fail') verdict = 'reject_low_aov'
  else if (aovOk && misOk) verdict = 'prime'
  else if (aovOk && mis.tier === 'unknown') verdict = 'affordable_needs_ad_check'
  else if (aovOk && !misOk) verdict = 'affordable_but_dormant'
  else if (!aovOk && misOk) verdict = 'spending_but_cheap'
  else verdict = 'weak'

  return { aov, mis, verdict, isPrime: verdict === 'prime' }
}
