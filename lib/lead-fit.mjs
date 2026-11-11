// The ICP gate for a lead, by BEHAVIOUR (Nikola, 2026-11-11: "searching by niche is not good because a niche does not indicate an ICP").
//
//   dm        the account tells people to order / ask the price / book IN THE DM: in its bio, in the captions of its reels, or in an ad
//             ("Send message", "pišite nam"). That is a business selling in the inbox, whatever it sells.
//   reach     median views of its last 12 REELS ≥ 30% of followers (his 2026-10-23 rule: "anyone can buy 30k followers but have 3k views"),
//             on a sample of at least 3 reels. 2026-11-11 he confirmed the strict version for advertisers too (answer to "minimum to qualify").
//   audience  followers 15k–200k (checked by qualify_new / find_leads; the band is not in this file)
//   reachable a real email address; a demo is built from the business's own website (checked by qualify_new)
//
// Not tests of the ICP any more (they were mine): a niche whitelist, an absolute-views bar, "paid ads pass". Active ads and buyer comments are notes.

export const LEAD_FIT = {
  VIEWS_PER_FOLLOWER_MIN: 0.30,
  RATIO_TOLERANCE: 0.01, // Instagram's public page rounds followers (44K), so 0.298 is 0.30
  MIN_REELS: 3,
}

const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/
const NOT_A_PERSON = /^(noreply|no-reply|donotreply|mailer-daemon)@/i

/**
 * @param {{ followers?: number|null, medViews?: number|null, viewsPerFollower?: number|null, reels12?: number|null, email?: string|null,
 *           dmPrompt?: boolean|null, activeAds?: number|null, buyerQs?: number|null }} row
 * @returns {{ pass: boolean, fails: string[], notes: string[], needsRemeasure: boolean }}
 */
export function leadFit(row, { requireEmail = true } = {}) {
  const L = LEAD_FIT
  const fails = []
  const notes = []
  let needsRemeasure = false

  // dm: the one behaviour that defines the ICP
  if (row.dmPrompt == null) { fails.push('DM prompt not checked'); needsRemeasure = true }
  else if (!row.dmPrompt) fails.push('no DM prompt in bio, captions or ads (does not sell in the inbox)')

  // reach: 30% of followers, on at least 3 reels
  const mv = row.medViews ?? null
  const vpf = row.viewsPerFollower ?? (row.followers && mv != null ? +(mv / row.followers).toFixed(3) : null)
  if (mv == null) { fails.push('reach not measured'); needsRemeasure = true }
  else {
    if (row.reels12 != null && row.reels12 < L.MIN_REELS) fails.push(`only ${row.reels12} reel(s) measured (needs ${L.MIN_REELS})`)
    else if (vpf == null || vpf < L.VIEWS_PER_FOLLOWER_MIN - L.RATIO_TOLERANCE) fails.push(`reach: ${mv.toLocaleString('en')} median reel views = ${vpf}/follower (needs ${L.VIEWS_PER_FOLLOWER_MIN})`)
  }

  if (requireEmail && (!row.email || !EMAIL_RX.test(row.email) || NOT_A_PERSON.test(row.email))) fails.push('no sendable email')
  if (row.activeAds) notes.push(`${row.activeAds} active ad(s)`)
  if (row.buyerQs != null) notes.push(`${row.buyerQs} buyer comments (not decisive)`)
  return { pass: fails.length === 0, fails, notes, needsRemeasure }
}
