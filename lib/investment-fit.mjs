// Is this business ACTIVELY investing in social media right now? (Nikola, 2026-11-12: "unless you can tell me that they are actively investing in
// [Meta ads] and that precisely for that reason you deemed them worthy I don't see the point… why would I offer a month of my services for FREE".)
// The free month only proves something where inquiries already flow: a business paying for ads, or one publishing high-reach reels every week.
// Input: contacts.intake_data.audit from audit_leads.mjs.
export const INVEST = { REELS_30D: 4, MEDIAN_VIEWS: 20000 }

export function investmentFit(audit) {
  if (!audit) return { pass: false, reason: 'not audited (run node audit_leads.mjs)' }
  const ads = audit.ads?.active || 0
  if (ads > 0) return { pass: true, reason: `${ads} active Meta ad(s) on its own page${audit.ads.since ? ` since ${audit.ads.since}` : ''}` }
  if ((audit.last30 || 0) >= INVEST.REELS_30D && (audit.medViews || 0) >= INVEST.MEDIAN_VIEWS) return { pass: true, reason: `${audit.last30} reels in 30 days at ${audit.medViews} median views` }
  return { pass: false, reason: `no active ads; ${audit.last30 ?? 0} reels in 30 days at ${audit.medViews ?? 0} median views (needs ads, or ≥${INVEST.REELS_30D} reels/30d at ≥${INVEST.MEDIAN_VIEWS} views)` }
}
