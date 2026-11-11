import { describe, it, expect } from 'vitest'
import { leadFit } from './lead-fit.mjs'

// Real rows measured 2026-11-04/05 (dm_demand_*.json). Nikola, 2026-11-10: reels are the indicator, comments are not.
const base = { email: 'info@example.rs', reels12: 6, daysSincePost: 2 }

describe('leadFit (reels-led lead gate)', () => {
  it('passes a lead with strong absolute reach, even with a low ratio (Cvejanović: large audience)', () => {
    expect(leadFit({ ...base, followers: 182236, medViews: 23343, viewsPerFollower: 0.128 }).pass).toBe(true)
  })
  it('treats 0.298 as 0.30: Instagram rounds follower counts (Luxor, 12-reel median)', () => {
    expect(leadFit({ ...base, followers: 44000, medViews: 13105, viewsPerFollower: 0.298 }).pass).toBe(true)
  })
  it('passes a lead with modest views that are at least 30% of followers (Luxor)', () => {
    expect(leadFit({ ...base, followers: 40803, medViews: 13311, viewsPerFollower: 0.326 }).pass).toBe(true)
  })
  it('fails low reach whatever the comments say (Varmus: 18 buyer comments, 12k views on 90k followers)', () => {
    const r = leadFit({ ...base, followers: 90291, medViews: 11965, viewsPerFollower: 0.133, buyerQs: 18 })
    expect(r.pass).toBe(false)
    expect(r.fails.join(' ')).toMatch(/reach/)
  })
  it('fails hollow accounts (DENTALUX 0.09/follower, Dallas 0.11/follower)', () => {
    expect(leadFit({ ...base, followers: 61835, medViews: 5649, viewsPerFollower: 0.091 }).pass).toBe(false)
    expect(leadFit({ ...base, followers: 44060, medViews: 4910, viewsPerFollower: 0.111, reels12: 1 }).pass).toBe(false)
  })
  it('does not trust a median of one reel (MB Laser)', () => {
    const r = leadFit({ ...base, followers: 41534, medViews: 22976, viewsPerFollower: 0.553, reels12: 1 })
    expect(r.pass).toBe(false)
    expect(r.fails.join(' ')).toMatch(/only 1 reel/)
  })
  it('marks a stale measurement for re-measure instead of trusting it (Demart, LOGERA: 76 days)', () => {
    const r = leadFit({ ...base, followers: 30020, medViews: 36981, viewsPerFollower: 1.23, daysSincePost: 76 })
    expect(r.pass).toBe(false)
    expect(r.needsRemeasure).toBe(true)
  })
  it('never passes an unmeasured lead', () => {
    const r = leadFit({ email: 'a@b.rs', followers: 87002 })
    expect(r.pass).toBe(false)
    expect(r.needsRemeasure).toBe(true)
  })
  it('needs a sendable email', () => {
    expect(leadFit({ ...base, email: null, followers: 72900, medViews: 158950, viewsPerFollower: 2.18 }).fails).toContain('no sendable email')
    expect(leadFit({ ...base, email: 'noreply@x.rs', followers: 72900, medViews: 158950 }).pass).toBe(false)
  })
  it('treats comments and ads as notes only, never as a pass', () => {
    const r = leadFit({ ...base, followers: 90291, medViews: 11965, viewsPerFollower: 0.133, buyerQs: 30, activeAds: 5 })
    expect(r.pass).toBe(false)
    expect(r.notes.join(' ')).toMatch(/not decisive/)
  })
  it('fails a known low ticket and only notes an unknown one', () => {
    expect(leadFit({ ...base, followers: 40000, medViews: 50000, aov: 4000 }).pass).toBe(false)
    expect(leadFit({ ...base, followers: 40000, medViews: 50000 }).notes).toContain('ticket unverified')
  })
  it('counts an active Instagram video ad as reach: paid views are views (Nikola, 2026-11-11)', () => {
    const r = leadFit({ ...base, followers: 28000, medViews: 2873, viewsPerFollower: 0.103, reels12: 12, daysSincePost: 6, paidAds: true })
    expect(r.pass).toBe(true); expect(r.notes.join(' ')).toMatch(/paid reach/)
    // no reels, no recent post, still a pass: the ad proves the account is alive and buying reach
    expect(leadFit({ email: 'a@b.rs', followers: 37000, paidAds: true }).pass).toBe(true)
  })
  it('still needs a sendable email and the right business even when it pays for ads', () => {
    expect(leadFit({ email: null, followers: 37000, paidAds: true }).pass).toBe(false)
  })
})
