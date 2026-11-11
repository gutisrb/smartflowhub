import { describe, it, expect } from 'vitest'
import { leadFit } from './lead-fit.mjs'

// Reach = ratio OR absolute OR paid. A DM prompt is a signal, never a test (Nikola, 2026-11-11).
const ok = { email: 'info@example.rs', reels12: 12 }
describe('leadFit', () => {
  it('passes Cvejanović: 183k followers, 23k median, best reels 100-290k (failing it on the ratio was a mistake)', () => {
    expect(leadFit({ ...ok, followers: 183000, medViews: 23356 }).pass).toBe(true)
  })
  it('passes on the 30% ratio (Tandem, JetSet) and treats 0.298 as 0.30 (Luxor)', () => {
    expect(leadFit({ ...ok, followers: 40000, medViews: 242604 }).pass).toBe(true)
    expect(leadFit({ ...ok, followers: 42000, medViews: 27516 }).pass).toBe(true)
    expect(leadFit({ ...ok, followers: 44000, medViews: 13109 }).pass).toBe(true)
  })
  it('passes on paid reach alone: views are views', () => {
    const r = leadFit({ ...ok, followers: 28000, medViews: 2873, paidAds: true }); expect(r.pass).toBe(true); expect(r.notes.join(' ')).toMatch(/paid reach/)
    expect(leadFit({ email: 'a@b.rs', followers: 37000, paidAds: true }).pass).toBe(true)
  })
  it('does not require a DM prompt: it is only a good sign', () => {
    expect(leadFit({ ...ok, followers: 44000, medViews: 13109, dmPrompt: false }).pass).toBe(true)
    expect(leadFit({ ...ok, followers: 40000, medViews: 242604, dmPrompt: true }).notes.join(' ')).toMatch(/DM prompt/)
  })
  it('fails only when there is no reach by any of the three (hollow, unpaid)', () => {
    const r = leadFit({ ...ok, followers: 90291, medViews: 11965 }); expect(r.pass).toBe(false); expect(r.fails.join(' ')).toMatch(/reach/)
    expect(leadFit({ ...ok, followers: 28000, medViews: 2873 }).pass).toBe(false)
  })
  it('never guesses: unmeasured reach is a re-measure, not a pass', () => {
    const r = leadFit({ ...ok, followers: 40000 }); expect(r.pass).toBe(false); expect(r.needsRemeasure).toBe(true)
  })
  it('needs a sendable email unless sourcing says otherwise', () => {
    expect(leadFit({ ...ok, email: null, followers: 40000, medViews: 242604 }).fails).toContain('no sendable email')
    expect(leadFit({ ...ok, email: null, followers: 40000, medViews: 242604 }, { requireEmail: false }).pass).toBe(true)
  })
  it('wants recent reels unless the account is paying for ads (ENTERijer-tim: last reel 117 days ago)', () => {
    const r = leadFit({ ...ok, followers: 69000, medViews: 23038, daysSincePost: 117 }); expect(r.pass).toBe(false); expect(r.fails.join(' ')).toMatch(/last reel 117/)
    expect(leadFit({ ...ok, followers: 69000, medViews: 23038, daysSincePost: 117, paidAds: true }).pass).toBe(true)
    expect(leadFit({ ...ok, followers: 40000, medViews: 242604, daysSincePost: 20 }).pass).toBe(true)
  })
})
