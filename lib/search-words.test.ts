import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// Nikola 2026-11-11 and 2026-11-15: "do NOT search by business type, a niche does not prove a lead is right for our offer". The searches found mostly dentists and furniture
// because the word lists held business-type words and the ads search only saw VIDEO ads. These tests fail if either comes back, for any script that finds leads.
const BUSINESS_WORDS = /stomat|dental|zubar|implant|ortodon|nameštaj|namestaj|kuhinj|plakar|garnitur|pergol|kontejner|montažn|montazn|pvc|stolarij|patike|odeća|odeca|nakit|kozmetik|parfem|igračk|igracke|posteljin|suplement|auto delovi|sportska|cveće|cvece|torte|računar|racunar|salon|frizer|restoran|hotel|klinik|ordinacij|enterijer|bebi oprema|satovi|obuća|obuca|dimenz|procen|konsultac|rezerv/i

const wordsIn = (file: string, marker: RegExp): string[] => {
  const src = readFileSync(file, 'utf8')
  const m = marker.exec(src)
  if (!m) throw new Error(`${file}: word list not found (${marker})`)
  const rest = src.slice(m.index + m[0].length)
  const end = /'\s*,?\s*\]/.exec(rest)
  if (!end) throw new Error(`${file}: end of word list not found`)
  const words = (rest.slice(0, end.index + 1).match(/'[^'\n]*'/g) || []).map((w) => w.slice(1, -1)) // only the quoted words, not the comments around them
  if (words.length < 5) throw new Error(`${file}: only ${words.length} words read: the test would check nothing`)
  return words
}

describe('searches that find leads never use business-type words', () => {
  it('ads search words (source_leads.mjs)', () => expect(wordsIn('source_leads.mjs', /const ADS_QUERIES\s*=\s*\[/).filter((w) => BUSINESS_WORDS.test(w))).toEqual([]))
  it('instagram bio search words (source_ig_bio_search.mjs)', () => expect(wordsIn('source_ig_bio_search.mjs', /const TERMS\s*=\s*\[/).filter((w) => BUSINESS_WORDS.test(w))).toEqual([]))
  it('google search phrases (source_ig_google.mjs)', () => expect(wordsIn('source_ig_google.mjs', /const PHRASES\s*=\s*\[/).filter((w) => BUSINESS_WORDS.test(w))).toEqual([]))
  it('firecrawl search phrases (source_fc_search.mjs)', () => expect(wordsIn('source_fc_search.mjs', /const PHRASES\s*=\s*\[/).filter((w) => BUSINESS_WORDS.test(w))).toEqual([]))
  it('no niche x city generator in the bio search', () => expect(readFileSync('source_ig_bio_search.mjs', 'utf8')).not.toMatch(/GEO_NICHES/))
})

describe('the ads search looks at VIDEO ads by default (their views can be measured); photo ads only on request', () => {
  const src = readFileSync('source_leads.mjs', 'utf8')
  it('default media type is video, all formats only with --all-formats', () => expect(src).toMatch(/const ADS_MEDIA = process\.argv\.includes\('--all-formats'\) \? 'all' : 'video'/))
  it('the ads url takes its media type from that setting', () => expect(src).toMatch(/media_type=\$\{ADS_MEDIA\}/))
})
