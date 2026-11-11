// The ONE hard test of whether a business is worth a demo and an email: does it run a serious social sales pipeline?
//
// Nikola, 2026-11-10: comments prove little (comment automations like ManyChat inflate them, and they do not show how many
// people watched a reel and messaged instead). "I think that reels themselves are the best indicator of them using social
// media as a legitimate and serious sales pipeline": high views = paid marketing or strong organic reach. His 2026-10-23 rule
// ("anyone can buy 30k followers but have 3k views") is the ratio half of it. So reach decides; comments and ads only support.
//
//   reach     median reel views ≥ 30.000, OR ≥ 10.000 AND ≥ 30% of followers
//   evidence  at least 2 reels measured (one viral reel is a fluke, not a pipeline)
//   alive     last post within 60 days (a stale measurement must be re-measured, never trusted)
//   reachable a real email address to send to
//   ticket    median ticket ≥ 15.000 RSD when it is known (lib/lead-score.mjs); unknown is a note, not a pass or a fail
//
// Supporting only, never decisive: active Meta ads, captions that invite DMs, buyer questions in comments.
// Used by lead_fit.mjs (the table), and meant to be called wherever a lead enters demo_building or email_ready.

export const LEAD_FIT = {
  REACH_ABS: 30000,
  REACH_FLOOR: 10000,
  VIEWS_PER_FOLLOWER_MIN: 0.30,
  MIN_REELS: 2,
  MAX_DAYS_SINCE_POST: 60,
  MIN_TICKET_RSD: 15000,
}

const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/
const NOT_A_PERSON = /^(noreply|no-reply|donotreply|mailer-daemon)@/i

/**
 * @param {{ name?: string, followers?: number|null, medViews?: number|null, viewsPerFollower?: number|null,
 *           reels12?: number|null, daysSincePost?: number|null, email?: string|null, aov?: number|null,
 *           activeAds?: number|null, buyerQs?: number|null, inviteCaps?: number|null }} row
 * @returns {{ pass: boolean, fails: string[], notes: string[], needsRemeasure: boolean }}
 */
export function leadFit(row, { requireEmail = true } = {}) {
  const L = LEAD_FIT
  const fails = []
  const notes = []
  let needsRemeasure = false

  const mv = row.medViews ?? null
  const vpf = row.viewsPerFollower ?? (row.followers && mv != null ? +(mv / row.followers).toFixed(3) : null)

  // reach
  if (mv == null) { fails.push('reach not measured'); needsRemeasure = true }
  else if (!(mv >= L.REACH_ABS || (mv >= L.REACH_FLOOR && vpf != null && vpf >= L.VIEWS_PER_FOLLOWER_MIN))) {
    fails.push(`reach: ${mv.toLocaleString('en')} median reel views` + (vpf != null ? ` = ${vpf}/follower` : '') +
      ` (needs ${L.REACH_ABS.toLocaleString('en')}, or ${L.REACH_FLOOR.toLocaleString('en')} and ${L.VIEWS_PER_FOLLOWER_MIN}/follower)`)
  }

  // evidence: a median of one reel is a coin flip
  if (row.reels12 != null && row.reels12 < L.MIN_REELS) fails.push(`only ${row.reels12} reel measured (needs ${L.MIN_REELS})`)

  // alive: stale data is re-measured, not trusted
  if (row.daysSincePost == null) { fails.push('last post unknown'); needsRemeasure = true }
  else if (row.daysSincePost > L.MAX_DAYS_SINCE_POST) { fails.push(`last post ${row.daysSincePost} days ago`); needsRemeasure = true }

  // reachable
  if (requireEmail && (!row.email || !EMAIL_RX.test(row.email) || NOT_A_PERSON.test(row.email))) fails.push('no sendable email')

  // ticket: known and too low fails; unknown is only a note
  if (row.aov != null) { if (row.aov < L.MIN_TICKET_RSD) fails.push(`median ticket ${row.aov} RSD (needs ${L.MIN_TICKET_RSD})`) }
  else notes.push('ticket unverified')

  // supporting evidence
  if (row.activeAds) notes.push(`${row.activeAds} active ads`)
  if (row.inviteCaps >= 2) notes.push(`${row.inviteCaps} captions invite DMs`)
  if (row.buyerQs != null) notes.push(`${row.buyerQs} buyer comments (not decisive)`)

  return { pass: fails.length === 0, fails, notes, needsRemeasure }
}
