import { describe, it, expect } from 'vitest'
import { leadFit } from './lead-fit.mjs'

// The ICP gate by behaviour (Nikola, 2026-11-11): a DM prompt AND reel views ≥ 30% of followers (12-reel median, ≥ 3 reels), plus an email.
const ok = { email: 'info@example.rs', dmPrompt: true, reels12: 12 }
describe('leadFit (ICP by behaviour)', () => {
  it('passes a DM-selling account whose reels reach 30% of followers (Tandem, JetSet, Linea)', () => {
    expect(leadFit({ ...ok, followers: 40000, medViews: 242604 }).pass).toBe(true)
    expect(leadFit({ ...ok, followers: 42000, medViews: 27512 }).pass).toBe(true)
  })
  it('treats 0.298 as 0.30: Instagram rounds follower counts (Luxor)', () => {
    expect(leadFit({ ...ok, followers: 44000, medViews: 13105 }).pass).toBe(true)
  })
  it('fails a hollow audience whatever else it has (Cvejanović 0.128, Up Dent 0.103, Varmus 0.133)', () => {
    for (const [f, v] of [[183000, 23343], [28000, 2873], [90291, 11965]]) {
      const r = leadFit({ ...ok, followers: f, medViews: v }); expect(r.pass).toBe(false); expect(r.fails.join(' ')).toMatch(/reach/)
    }
  })
  it('fails an account that does not prompt the DM, however big its reels (it does not sell in the inbox)', () => {
    const r = leadFit({ ...ok, dmPrompt: false, followers: 40000, medViews: 242604 })
    expect(r.pass).toBe(false); expect(r.fails.join(' ')).toMatch(/no DM prompt/)
  })
  it('does not guess: an unchecked DM prompt or unmeasured reach is a re-measure, never a pass', () => {
    expect(leadFit({ ...ok, dmPrompt: null, followers: 40000, medViews: 242604 }).needsRemeasure).toBe(true)
    expect(leadFit({ ...ok, followers: 40000 }).needsRemeasure).toBe(true)
  })
  it('does not trust a median of one or two reels (a viral fluke is not a pipeline)', () => {
    const r = leadFit({ ...ok, reels12: 2, followers: 40000, medViews: 242604 }); expect(r.pass).toBe(false); expect(r.fails.join(' ')).toMatch(/only 2 reel/)
  })
  it('paying for ads does not pass by itself any more (his confirmed strict bar)', () => {
    const r = leadFit({ ...ok, followers: 28000, medViews: 2873, activeAds: 3 }); expect(r.pass).toBe(false); expect(r.notes.join(' ')).toMatch(/active ad/)
  })
  it('needs a sendable email unless sourcing says otherwise', () => {
    expect(leadFit({ ...ok, email: null, followers: 40000, medViews: 242604 }).fails).toContain('no sendable email')
    expect(leadFit({ ...ok, email: null, followers: 40000, medViews: 242604 }, { requireEmail: false }).pass).toBe(true)
  })
})
