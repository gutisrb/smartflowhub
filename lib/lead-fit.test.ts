import { describe, it, expect } from 'vitest'
import { leadFit } from './lead-fit.mjs'

// Nikola's labels are the spec (2026-11-13): rejected by name = TopDek, industrija, Emmeti; praised = the OG batch + current picks.
// Real numbers: Apify 24-reel medians, followers from the DB, 2026-11-13.
const ok = { email: 'info@firma.rs' }
const lane = (r: object, o = {}) => leadFit({ ...ok, ...r }, o).lane

describe('lanes: his rejected-by-name leads all FAIL', () => {
  it('TopDek 25k / 7,022 plays / 3 paid ads', () => {
    const r = leadFit({ ...ok, followers: 25000, medViews: 7022, paidAds: true, activeAds: 3, daysSincePost: 1 })
    expect(r.lane).toBe('fail'); expect(r.fails.join(' ')).toMatch(/hollow|audience/); expect(r.notes.join(' ')).toMatch(/note only/)
  })
  // small audience + real reach is a REVIEW since 2026-11-14; industrija and Emmeti were removed by name, which lives in the data (stage 'discarded'), not in the lane
  it('industrija_bg 18k / 31k plays is a review, not a hard fail', () => expect(lane({ followers: 18000, medViews: 31490, daysSincePost: 24 })).toBe('review'))
  it('Emmeti 20k / 38k plays is a review, not a hard fail', () => expect(lane({ followers: 20000, medViews: 37836, daysSincePost: 7 })).toBe('review'))
  it('a small audience WITHOUT real reach still fails (23k followers, 12k plays)', () => expect(lane({ followers: 23000, medViews: 12000, daysSincePost: 3 })).toBe('fail'))
  it('his 15k followers / 5k views example', () => expect(lane({ followers: 15000, medViews: 5000 })).toBe('fail'))
  it('hollow accounts with ads: Up Dent 28k/2.9k, Radovanovic 46k/4.2k, Tapos 37k/0', () => {
    expect(lane({ followers: 28000, medViews: 2935, activeAds: 1 })).toBe('fail')
    expect(lane({ followers: 46000, medViews: 4202, activeAds: 1 })).toBe('fail')
    expect(lane({ followers: 37000, medViews: 0, activeAds: 1 })).toBe('fail')
  })
})

describe('lanes: the OG batch and current picks are never FAIL', () => {
  it('PASS: Cvejanovic 182k/22k, Tandem 36k/268k, JetSet 42.6k/25k, Marco 174k/41k, Vacasa 193k/43k, Aluroll 35k/216k', () => {
    for (const [followers, medViews] of [[182236, 21984], [36137, 267745], [42597, 24957], [174000, 41342], [193000, 43455], [35000, 216012]]) {
      expect(lane({ followers, medViews, daysSincePost: 5 })).toBe('pass')
    }
  })
  it('REVIEW, not fail: Luxor 41k/11k, Elan Domis 75k/17k, LOGERA 49k/16k (grey band)', () => {
    for (const [followers, medViews] of [[40803, 11054], [75000, 16912], [48981, 16141]]) expect(lane({ followers, medViews, daysSincePost: 20 })).toBe('review')
  })
  it('OPEN CONFLICT, not hidden: Varmus 98k followers / 6,004 plays (Firecrawl 2026-11-13) and DENTALUX 59k / 4,496 are OG-batch leads that read hollow today', () => {
    expect(lane({ followers: 97704, medViews: 6004, daysSincePost: 2 })).toBe('fail')
    expect(leadFit({ ...ok, followers: 97704, medViews: 6004, override: { by: 'Nikola', note: 'OG batch' } }).pass).toBe(true)
  })
  it('REVIEW: SLW 16k followers / 75k plays is a serious small operator, a human decides', () => {
    const r = leadFit({ ...ok, followers: 16000, medViews: 75182, daysSincePost: 10 })
    expect(r.lane).toBe('review'); expect(r.reviews.join(' ')).toMatch(/serious small operator/)
  })
})

describe('lanes: followers alone never decide what is sold (the two doctors)', () => {
  it('Dr Masic 175k/47k: Doctor category, webinar + retreat bio -> FAIL (personal brand, hard block)', () => {
    const r = leadFit({ ...ok, name: 'Dr Jovana Masic', category: 'Doctor', bio: 'Founder @riseandhealth Founder @reviveretreat Prijavi se na webinar', followers: 175000, medViews: 47154 })
    expect(r.lane).toBe('fail'); expect(r.fails.join(' ')).toMatch(/personal brand/)
  })
  it('Dr Marko Jovasevic 169k/77k: psychotherapist and novelist, bold-font bio -> FAIL (personal brand)', () => {
    const r = leadFit({ ...ok, name: '𝐃𝐫 𝐌𝐚𝐫𝐤𝐨 𝐉𝐨𝐯𝐚𝐬𝐞𝐯𝐢𝐜 | Psihoterapeut', category: 'Psychotherapist', bio: 'Doktor medicine, psihoterapeut i pisac. ROMAN', followers: 169000, medViews: 76696 })
    expect(r.lane).toBe('fail')
  })
  it('a coach whose handle hides the word ("stefan.thecoach", 186k/48k) is a hard block too', () => {
    expect(lane({ name: 'stefan.thecoach', followers: 186369, medViews: 47733, daysSincePost: 1 })).toBe('fail')
  })
  it('a hair salon at 32k/32k -> REVIEW (low-ticket appointment service), not auto-pass', () => {
    expect(lane({ name: 'Selvaggio hair', followers: 32000, medViews: 31864 })).toBe('review')
  })
  it('a dental clinic, furniture maker or clothing brand is NOT flagged: niche is not a filter', () => {
    expect(lane({ name: 'Cvejanovic', category: 'Dentist & Dental Office', followers: 182236, medViews: 21984 })).toBe('pass')
    expect(lane({ name: 'VACASA Namestaj', category: 'Furniture', followers: 193000, medViews: 43455 })).toBe('pass')
    expect(lane({ name: 'PLUS EXCLUSIVE', category: 'Clothing (Brand)', followers: 135000, medViews: 31081 })).toBe('pass')
  })
})

describe('lanes: staleness is a band, not a cliff', () => {
  it('Linea 35k/30k, last reel 63 days -> REVIEW', () => expect(lane({ followers: 35000, medViews: 30188, daysSincePost: 63 })).toBe('review'))
  it('Montazne hale 34k/15.7k, last reel 101 days -> FAIL', () => expect(lane({ followers: 34000, medViews: 15707, daysSincePost: 101 })).toBe('fail'))
})

describe('plumbing', () => {
  it('unmeasured reach is remeasure, never pass', () => {
    const r = leadFit({ ...ok, followers: 100000 }); expect(r.lane).toBe('remeasure'); expect(r.needsRemeasure).toBe(true); expect(r.pass).toBe(false)
  })
  it('no sendable email fails, unless sourcing says otherwise', () => {
    expect(leadFit({ followers: 100000, medViews: 50000 }).fails).toContain('no sendable email')
    expect(leadFit({ followers: 100000, medViews: 50000 }, { requireEmail: false }).pass).toBe(true)
  })
  it('a placeholder address (Dnevnik za trudnice: email@email.com, VACASA: info@website.com) is not a sendable email', () => {
    expect(leadFit({ email: 'email@email.com', followers: 70318, medViews: 28586 }).fails).toContain('no sendable email')
    expect(leadFit({ email: 'info@website.com', followers: 193000, medViews: 43455 }).fails).toContain('no sendable email')
    expect(leadFit({ email: 'comfortino.online@gmail.com', followers: 83582, medViews: 22468 }).pass).toBe(true)
  })
  it('an override by name turns review or fail into pass, but never rescues a missing email', () => {
    const o = { by: 'Nikola', note: 'keep' }
    expect(leadFit({ ...ok, followers: 40803, medViews: 11054, override: o }).pass).toBe(true)
    expect(leadFit({ ...ok, followers: 20000, medViews: 37836, override: o }).pass).toBe(true)
    expect(leadFit({ email: null, followers: 40803, medViews: 11054, override: o }).pass).toBe(false)
  })
  it('only lane=pass counts as pass; review and fail both skip auto-promotion', () => {
    expect(leadFit({ ...ok, followers: 40803, medViews: 11054 }).pass).toBe(false)
    expect(leadFit({ ...ok, followers: 20000, medViews: 37836 }).pass).toBe(false)
  })
})

// Nikola, 2026-11-14: "if they pay for Meta ads and the ad has been running a long time, it naturally means it generates sales to keep it running".
describe('lanes: paid ads as evidence (Nikola 2026-11-14: a long ad means it sells; but "why would I need weak leads?")', () => {
  it('Luxor 41k / 11k plays with a 139-day ad: the ad lifts the grey band, passes', () => expect(lane({ name: 'Luxor Furniture', followers: 40803, medViews: 11054, activeAds: 1, adsSinceDays: 139, adCta: 'See details', daysSincePost: 2 })).toBe('pass'))
  it('a 9k-play account with a Send-message ad running 75 days passes', () => expect(lane({ name: 'Zumo', followers: 52984, medViews: 8799, activeAds: 1, adsSinceDays: 75, adCta: 'Send message', daysSincePost: 1 })).toBe('pass'))
  it('a MESSAGE ad running 200 days passes even with hollow, stale or unmeasured reach (it pays for conversations)', () => {
    expect(lane({ followers: 60000, medViews: 3000, activeAds: 2, adsSinceDays: 200, adCta: 'Send message', daysSincePost: 150 })).toBe('pass')
    expect(lane({ followers: 37000, activeAds: 2, adsSinceDays: 261, adCta: 'Send message' })).toBe('pass')
  })
  it('Radovanovic: 4k plays with ONE message ad running 75 days FAILS (a single young ad is a test, not a campaign)', () => expect(lane({ name: 'Namestaj Radovanovic', followers: 46000, medViews: 4202, activeAds: 1, adsSinceDays: 75, adCta: 'Send message', daysSincePost: 11 })).toBe('fail'))
  it('Eterna: unmeasured, ONE message ad running 196 days passes (6+ months = a working campaign)', () => expect(lane({ name: 'Eterna', followers: 20428, activeAds: 1, adsSinceDays: 196, adCta: 'Send message' })).toBe('pass'))
  it('a one-ad message ad of 78 days with nothing measured is not enough (Tomash Tours)', () => expect(lane({ followers: 85000, activeAds: 1, adsSinceDays: 78, adCta: 'Send message' })).toBe('remeasure'))
  it('Mesmerie: 133k followers, 6k plays, 16 ads for 315 days with a Learn-more CTA FAILS (hollow; a web-page ad never rescues it)', () => expect(lane({ name: 'Mesmerie', followers: 133000, medViews: 5881, activeAds: 16, adsSinceDays: 315, adCta: 'Learn more', daysSincePost: 12 })).toBe('fail'))
  it('Panteraunico 39k / 3k plays / 9 Shop-now ads and Leone 19k / 4k plays / 11 ads FAIL', () => {
    expect(lane({ followers: 38524, medViews: 3038, activeAds: 9, adsSinceDays: 290, adCta: 'Shop now' })).toBe('fail')
    expect(lane({ followers: 30000, medViews: 3996, activeAds: 11, adsSinceDays: 290, adCta: 'Shop now' })).toBe('fail')
  })
  it('a long web-page ad with NO reach measurement does not pass: measure first', () => expect(lane({ followers: 70000, activeAds: 1, adsSinceDays: 400, adCta: 'Learn more' })).toBe('remeasure'))
  it('TopDek: 3 ads that started 10 days ago and 7k plays still FAILS', () => expect(lane({ name: 'TopDek', followers: 25000, medViews: 7022, activeAds: 3, adsSinceDays: 10, adCta: 'Learn more', daysSincePost: 1 })).toBe('fail'))
  it('a long ad never rescues a personal brand', () => expect(lane({ name: 'Dr Marko', bio: 'Doktor medicine, psihoterapeut i pisac', followers: 169000, medViews: 5000, activeAds: 1, adsSinceDays: 300, adCta: 'Send message' })).toBe('fail'))
  it('a long ad never rescues a missing email', () => expect(leadFit({ email: null, followers: 50000, medViews: 3000, activeAds: 1, adsSinceDays: 200, adCta: 'Send message' }).fails).toContain('no sendable email'))
})

describe('lanes: personal and hub accounts are a hard block', () => {
  it('Mr Everything (a real estate agent among other things, bio lists his other accounts) fails', () => {
    const r = leadFit({ ...ok, name: 'Mr Everything', bio: 'CONCIERGE: @everything_belgrade\nREAL ESTATE: @kis.realestate \nEVENT: @illusions_ofc\nOnce a client, always a friend', followers: 17000, medViews: 20353, daysSincePost: 3 })
    expect(r.lane).toBe('fail'); expect(r.fails.join(' ')).toMatch(/other accounts/)
  })
})
