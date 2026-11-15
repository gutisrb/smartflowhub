// The lead gate: three lanes instead of one cliff. pass = demo worth building, review = a human reads it, fail = factually out
// (+ remeasure when reach is unknown). Rewritten 2026-11-13 after three threshold swaps in one day.
//
// Nikola's own labels are the spec. Every account he rejected by name (TopDek 25k, industrija 18k, Emmeti 20k) has < 30k followers; every
// account of the OG batch he praised has >= 36k. His documented rule 2 is 30k+ (vault lead-quality, 2026-09-16) and the code never enforced
// it (qualify_new's band was 15k-200k). So the floor is his number, not one picked to cut a lead.
// Scrapers disagree on reel reach by 2-10x (JetSet 25k vs 706k, Cvejanovic 22k vs 37k vs ~240k by eye), so near-threshold readings go to
// REVIEW, never FAIL on one reading. Nothing is judged by niche: a flag only asks "what is sold through DMs, and for how much?".
// Ads, ratio, p75, DM prompt, buyer comments and cadence are notes, never a pass. Nikola can override a lead by name (row.override).

export const LEAD_FIT = {
  FOLLOWERS_MIN: 30000,        // his rule 2
  SERIOUS_SMALL_PLAYS: 20000,  // under the follower floor but real reach: a human decides (2026-11-14, Nikola: a lead only makes no sense if it has no traffic; SLW 16k followers / 75k plays, Bee Bike 23k / 26k)
  PLAYS_HOLLOW: 8000,          // clearly hollow; his own example was 15k followers / 5k views
  PLAYS_OK: 20000,             // 8k-20k is the grey band where scraper noise lives
  STALE_REVIEW_DAYS: 60,
  STALE_FAIL_DAYS: 90,
  MSG_AD_MIN_ADS: 2,           // a message ad is PROOF of paid conversations only as a real campaign: 2+ live ads ...
  MSG_AD_STRONG_DAYS: 180,     // ... or one running 6+ months. One ad under that is a test (2026-11-14: Radovanovic 4k plays + a 75-day message ad is not a lead)
  SUSTAINED_AD_DAYS: 60,       // 2026-11-14, Nikola: "a long-running ad means it generates sales to keep running": that is traffic whatever the reels do
}

const EMAIL_RX = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/
const NOT_A_PERSON = /^(noreply|no-reply|donotreply|mailer-daemon)@|@(email|example|domain|website|yourdomain)\.[a-z]+$/i
import { hubAccount } from './lead-sanity.mjs'
const fold = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const PERSONAL_BRAND = /psihoterap|psiholog|terapeut|\bpisac\b|knjig|\broman\b|webinar|retreat|\bkurs\b|coach|trener|influenc|kreator|digital creator/
export const PERSONAL_CATEGORY = /^(doctor|psychotherapist|psychologist|personal blog|digital creator|author|writer|artist|public figure|blogger|coach|athlete|musician)/
/** An ad CTA that STARTS a conversation (the thing this product automates), as opposed to Shop now / Learn more, which send people to a web page. */
export const isMessageCta = (cta) => /send (whats ?app )?message|message us|whatsapp/i.test(String(cta || ''))

/** A long-running ad that starts conversations, at campaign scale: the one kind of ad that passes a lead whatever its reels do. */
export function isStrongMessageAd({ ads, days, cta }) {
  return (ads || 0) > 0 && days != null && days >= LEAD_FIT.SUSTAINED_AD_DAYS && isMessageCta(cta) && ((ads || 0) >= LEAD_FIT.MSG_AD_MIN_ADS || days >= LEAD_FIT.MSG_AD_STRONG_DAYS)
}

export const LOW_TICKET_SERVICE = /frizer|\bhair\b|nokti|\bnails?\b|trepavic|\blash|laser|depilac|kozmeticar|salon lepote|\bbrows?\b/

/**
 * @param {{ name?: string, bio?: string, category?: string, niche?: string, followers?: number|null, medViews?: number|null, viewsPerFollower?: number|null,
 *           p75Views?: number|null, daysSincePost?: number|null, email?: string|null, paidAds?: boolean, dmPrompt?: boolean|null, activeAds?: number|null,
 *           buyerQs?: number|null, postsLast30?: number|null, reelsLast30?: number|null, adsSinceDays?: number|null, adCta?: string|null, override?: { by?: string, note?: string }|null }} row
 * @returns {{ lane: 'pass'|'review'|'fail'|'remeasure', pass: boolean, fails: string[], reviews: string[], notes: string[], needsRemeasure: boolean }}
 */
export function leadFit(row, { requireEmail = true } = {}) {
  const L = LEAD_FIT
  const fails = []
  const reviews = []
  const notes = []
  const fmt = (n) => n.toLocaleString('en')
  const mv = row.medViews ?? null
  const fol = row.followers ?? null
  const days = row.daysSincePost ?? null
  const vpf = row.viewsPerFollower ?? (fol && mv != null ? +(mv / fol).toFixed(3) : null)

  // 2026-11-14 (Nikola: "why would I need weak leads?"): a long ad proves conversations only when its CTA STARTS one (Send message): that passes whatever the reels do.
  // Any other long ad (Shop now, Learn more) sends people to a web page: it lifts a lead out of the grey band (8-20k plays) but NEVER rescues a hollow account
  // (TopDek 7k; Mesmerie 6k with 16 ads). My first version let any long ad pass anything, which is how one forgotten ad outvoted 6k views.
  const longAd = (row.paidAds || (row.activeAds || 0) > 0) && row.adsSinceDays != null && row.adsSinceDays >= L.SUSTAINED_AD_DAYS
  const msgAd = isStrongMessageAd({ ads: row.activeAds || (row.paidAds ? 1 : 0), days: row.adsSinceDays, cta: row.adCta })

  if (fol == null) fails.push('followers unknown')
  if (msgAd) notes.push(`paid ads that start conversations: a message ad running ${row.adsSinceDays} days`)
  else {
    if (mv == null) fails.push('reach not measured')
    else if (mv < L.PLAYS_HOLLOW) fails.push(`hollow: ${fmt(mv)} median reel plays (under ${fmt(L.PLAYS_HOLLOW)})`)
    else if (mv < L.PLAYS_OK) {
      if (longAd) notes.push(`grey-band reach ${fmt(mv)} plays lifted by a paid ad running ${row.adsSinceDays} days`)
      else reviews.push(`grey-band reach: ${fmt(mv)} median plays (${fmt(L.PLAYS_HOLLOW)}-${fmt(L.PLAYS_OK)}); scrapers undercount, so a human reads the reels grid`)
    }

    if (fol != null && mv != null && fol < L.FOLLOWERS_MIN) {
      if (mv >= L.SERIOUS_SMALL_PLAYS) reviews.push(`small audience (${fmt(fol)}) but ${fmt(mv)} median plays: serious small operator?`)
      else fails.push(`audience ${fmt(fol)} < ${fmt(L.FOLLOWERS_MIN)} followers and reach ${fmt(mv)} < ${fmt(L.SERIOUS_SMALL_PLAYS)}`)
    }

    if (days != null) {
      if (days > L.STALE_FAIL_DAYS) fails.push(`last reel ${days} days ago`)
      else if (days > L.STALE_REVIEW_DAYS) reviews.push(`last reel ${days} days ago`)
    }
  }

  const emailBad = requireEmail && (!row.email || !EMAIL_RX.test(row.email) || NOT_A_PERSON.test(row.email))
  if (emailBad) fails.push('no sendable email')

  const text = fold(`${row.name || ''} ${row.bio || ''} ${row.niche || ''}`)
  const personal = text.match(PERSONAL_BRAND)?.[0] || (PERSONAL_CATEGORY.test(fold(row.category)) ? row.category : null)
  const hub = hubAccount(row.bio)
  // 2026-11-14, Nikola: personal brands are a HARD block ("they could be using the account personally, for a variety of things")
  if (personal) fails.push(`personal brand / practitioner ("${personal}"): the person is the product, or the account is personal`)
  if (hub.hub) fails.push(hub.reason)
  const lowTicket = text.match(LOW_TICKET_SERVICE)?.[0]
  if (lowTicket) reviews.push(`low-ticket appointment service ("${lowTicket}"): confirm a DM conversation sells something worth a EUR 400/month system`)

  const onlyUnmeasured = fails.length > 0 && fails.every((f) => f === 'reach not measured' || f === 'followers unknown')
  let lane = fails.length ? (onlyUnmeasured ? 'remeasure' : 'fail') : reviews.length ? 'review' : 'pass'

  if (fol != null && mv != null) notes.push(`${fmt(fol)} followers, ${fmt(mv)} median plays${vpf != null ? ` (${vpf}/follower)` : ''}`)
  if (row.paidAds || row.activeAds) notes.push(`active paid ad${row.activeAds > 1 ? `s (${row.activeAds})` : ''} (note only)`)
  if (row.dmPrompt) notes.push('DM prompt (note only)')
  if (row.buyerQs != null) notes.push(`${row.buyerQs} buyer comments (note only)`)
  if (row.p75Views != null) notes.push(`p75 ${fmt(row.p75Views)} plays (note only)`)
  if (row.postsLast30 != null) notes.push(`cadence: ${row.postsLast30} uploads/30d${row.reelsLast30 != null ? ` (${row.reelsLast30} reels)` : ''} (note only)`)

  if (row.override && !emailBad && (lane === 'review' || lane === 'fail')) {
    notes.push(`override by ${row.override.by || 'Nikola'}${row.override.note ? `: ${row.override.note}` : ''}`)
    lane = 'pass'
  }
  return { lane, pass: lane === 'pass', fails, reviews, notes, needsRemeasure: lane === 'remeasure' }
}
