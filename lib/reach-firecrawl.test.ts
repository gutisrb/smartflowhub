import { describe, it, expect } from 'vitest'
import { parseBadge } from './reach-firecrawl.mjs'

// parseBadge handles the exact strings Instagram renders on reel grid tiles. Real strings from Cvejanović's grid.
describe('parseBadge', () => {
  it('parses K and M suffixes as thousands and millions', () => {
    expect(parseBadge('402K')).toBe(402000)
    expect(parseBadge('485K')).toBe(485000)
    expect(parseBadge('1.1M')).toBe(1100000)
    expect(parseBadge('935K')).toBe(935000)
    expect(parseBadge('89.8K')).toBe(89800)
    expect(parseBadge('52.2K')).toBe(52200)
  })
  it('parses bare integers (sometimes IG shows the raw number under 1000)', () => {
    expect(parseBadge('523')).toBe(523)
    expect(parseBadge('1,234')).toBe(1234)
  })
  it('returns null for garbage', () => {
    expect(parseBadge('')).toBe(null)
    expect(parseBadge(null)).toBe(null)
    expect(parseBadge('abc')).toBe(null)
    expect(parseBadge('K')).toBe(null)
  })
  it('tolerates whitespace', () => {
    expect(parseBadge('  402K  ')).toBe(402000)
  })
})
