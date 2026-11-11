// The ICP gate for a lead (Nikola, 2026-11-11). Reach is ANY of three, because views are views:
//
//   ratio     median views of the last 12 REELS ≥ 30% of followers  (his 2026-10-23 rule against bought followers)
//   absolute  median ≥ 20,000 views: real reach whatever the audience size (a 183k-follower clinic whose typical reel does 23k and whose best do 100-290k
//             is not hollow: its top reels have 800-3,400 likes. Failing it on the ratio was my mistake, 2026-11-11)
//   paid      an active Meta video ad on Instagram: "if they're paying for ads I don't care how their reels perform, views are views and views are
//             queries for my clients"
//
// A DM prompt (bio, captions, ad "Send message") is a GOOD SIGN, not a must: "it doesn't need to have a DM prompt in its bio, it's not a must".
// Also needed: a real email, and (checked in qualify_new / find_leads) a website, 15k–200k followers, and a business that is not evidently small-ticket.

export const LEAD_FIT = {
  VIEWS_PER_FOLLOWER_MIN: 0.30,
  RATIO_TOLERANCE: 0.01, // Instagram's public page rounds followers (44K), so 0.298 is 0.30
  REACH_ABS: 20000,
  REACH_P75: 40000, // the top quarter of its reels: Cvejanović's median is 23k but its best reels are 100k-1.1M (the median hid that, 2026-11-11)
  MAX_DAYS_SINCE_REEL: 90, // an account whose last reel is older is not posting (rule 6, softened from 60); live ads prove it is alive
}

const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/
const NOT_A_PERSON = /^(noreply|no-reply|donotreply|mailer-daemon)@/i

/**
 * @param {{ followers?: number|null, medViews?: number|null, viewsPerFollower?: number|null, reels12?: number|null, p75Views?: number|null, daysSincePost?: number|null, email?: string|null,
 *           paidAds?: boolean, dmPrompt?: boolean|null, activeAds?: number|null, buyerQs?: number|null }} row
 * @returns {{ pass: boolean, fails: string[], notes: string[], needsRemeasure: boolean }}
 */
export function leadFit(row, { requireEmail = true } = {}) {
  const L = LEAD_FIT
  const fails = []
  const notes = []
  let needsRemeasure = false

  const mv = row.medViews ?? null
  const vpf = row.viewsPerFollower ?? (row.followers && mv != null ? +(mv / row.followers).toFixed(3) : null)
  const byRatio = vpf != null && vpf >= L.VIEWS_PER_FOLLOWER_MIN - L.RATIO_TOLERANCE
  const byAbs = mv != null && mv >= L.REACH_ABS
  const byP75 = row.p75Views != null && row.p75Views >= L.REACH_P75
  if (row.paidAds) notes.push('paid reach: active Instagram video ad')
  if (byAbs && !byRatio) notes.push(`reach: ${mv.toLocaleString('en')} median views (absolute)`)
  if (byP75 && !byAbs && !byRatio) notes.push(`reach: top-quartile reel ${row.p75Views.toLocaleString('en')} views`)
  if (!(row.paidAds || byRatio || byAbs || byP75)) {
    if (mv == null) { fails.push('reach not measured'); needsRemeasure = true }
    else fails.push(`reach: ${mv.toLocaleString('en')} median reel views = ${vpf}/follower (needs ${L.VIEWS_PER_FOLLOWER_MIN}/follower, or ${L.REACH_ABS.toLocaleString('en')} views, or a live ad)`)
  }

  // recency (his rule 6): the reels must be recent unless the account is paying for ads right now
  if (!row.paidAds && row.daysSincePost != null && row.daysSincePost > L.MAX_DAYS_SINCE_REEL) fails.push(`last reel ${row.daysSincePost} days ago`)

  if (requireEmail && (!row.email || !EMAIL_RX.test(row.email) || NOT_A_PERSON.test(row.email))) fails.push('no sendable email')

  // signals, never tests
  if (row.dmPrompt) notes.push('DM prompt (good sign)')
  if (row.activeAds) notes.push(`${row.activeAds} active ad(s)`)
  if (row.buyerQs != null) notes.push(`${row.buyerQs} buyer comments`)
  return { pass: fails.length === 0, fails, notes, needsRemeasure }
}
