import { describe, it, expect } from 'vitest'
import { investmentFit } from './investment-fit.mjs'

describe('investmentFit (2026-11-12 audit of Email spreman)', () => {
  it('passes a business paying for ads or publishing high-reach reels every week', () => {
    expect(investmentFit({ ads: { active: 16 }, last30: 5, medViews: 22070 }).pass).toBe(true) // Bee Bike
    expect(investmentFit({ ads: { active: 0 }, last30: 4, medViews: 58902 }).pass).toBe(true) // SLW Container
  })
  it('parks one that posts rarely and runs no ads', () => {
    expect(investmentFit({ ads: { active: 0 }, last30: 1, medViews: 6866 }).pass).toBe(false) // OKTAVUS
    expect(investmentFit({ ads: { active: 0 }, last30: 5, medViews: 14495 }).pass).toBe(false) // VACASA
    expect(investmentFit(null).pass).toBe(false)
  })
})
