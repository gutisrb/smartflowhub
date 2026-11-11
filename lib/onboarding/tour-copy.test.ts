import { describe, it, expect } from 'vitest'
// @ts-ignore — plain .mjs shared with the pipeline scripts
import { tourCopy, FIRST_CARD } from './tour-copy.mjs'
// @ts-ignore
import { offerCopy } from './offer-copy.mjs'
// @ts-ignore
import { AI_TELLS } from '../sales-playbook.mjs'

const MODELS = ['booking', 'quote', 'order'] as const
const FLOWS = [null, { inStore: true }, { orderTracking: true }, { stays: true }]
const NICHES = [null, 'dental', 'fitness']
const all = () => MODELS.flatMap((model) => FLOWS.flatMap((flows) => NICHES.map((niche) => ({ model, flows, niche, c: tourCopy({ model, niche, flows }) }))))

describe('tour card copy', () => {
  it('step 1 is the same card on every demo', () => {
    // Nikola 2026-10-27: general copy, the best outcome in the viewer's head; the chat beside it is the proof
    for (const { c } of all()) expect(c.inbox).toEqual(FIRST_CARD)
  })

  it('step 1 makes four beliefs land, in a calm register, with no situation from a demo', () => {
    const text = `${FIRST_CARD.title} ${FIRST_CARD.body} ${FIRST_CARD.punch}`
    expect(FIRST_CARD.title).toBe('Agent vodi Vaš prodajni proces.')
    // it sells / a process written for me / I stay in control / it is how selling is done now
    expect(text).toMatch(/prodaj/)
    expect(FIRST_CARD.body).toContain('Proces pišemo zajedno')
    expect(FIRST_CARD.body).toContain('prosleđuje Vama')
    expect(FIRST_CARD.eyebrow).toMatch(/^AI agent/)
    // off limits (Nikola, 2026-10-28): superlatives, money, claims about their inbox
    expect(text).not.toMatch(/vrhunsk|najbolj|savršen|izuzetn|novac|novc|već dobijate|koje dobijate/i)
    // no customer, no objection, no package, no number: those are the chat's job
    expect(text).not.toMatch(/\b(Marija|Stefan|Nikola|Jelena|Dragana)\b/)
    expect(text).not.toMatch(/skupo|rate|daleko|loše vreme|Hollywood|\d/)
  })

  it('the cards for people who left do not retell a customer', () => {
    // it used to say "Nikola je pitao za cenu…" for every service demo, whoever was in the file
    for (const { c } of all()) expect(c['crm-izgubljen'].body).not.toMatch(/Nikola|Jelena|je pitao/)
  })

  it('has no AI tells, no price and no cost-saving framing anywhere', () => {
    for (const { model, flows, c } of all()) {
      const o = offerCopy({ model, niche: null, flows })
      const text = JSON.stringify([c, o])
      expect(text).not.toMatch(AI_TELLS)
      expect(text).not.toMatch(/\d+\s?(€|eur|rsd|din)/i)
      expect(text).not.toMatch(/sati rada|ušted|uštedite|jeftin|besplatno i bez obaveza|automatizacij|čet?bot/i)
    }
  })

  it('names the person the business actually talks to on the Ponuda', () => {
    const faq = (p: any) => offerCopy(p).faq.find((f: any) => /pogreši/.test(f.q))?.q
    expect(faq({ model: 'quote', niche: null, flows: null })).toBe('Šta ako pogreši pred kupcem?')
    expect(faq({ model: 'booking', niche: 'dental', flows: null })).toBe('Šta ako pogreši pred pacijentom?')
    expect(faq({ model: 'booking', niche: 'fitness', flows: null })).toBe('Šta ako pogreši pred klijentom?')
    expect(offerCopy({ model: 'quote', niche: null, flows: null }).steps[2].body).toContain('prilazi kupcu')
  })

  it('leads with the free setup and first month, keeps the satisfaction guarantee (Nikola, 2026-11-11, reverses 11-01)', () => {
    for (const model of ['booking', 'quote', 'order']) {
      const o = offerCopy({ model, niche: null, flows: null })
      const all = JSON.stringify(o)
      expect(o.headline).toMatch(/besplatno/)
      expect(o.free).toMatch(/Uvođenje i prvi mesec ne naplaćujem/)
      expect(o.free).toMatch(/smem da ih pokažem/) // the one plain reason (his exception to the 11-05 rule)
      expect(o.catchTitle).toBe('Ostajete samo ako ste potpuno zadovoljni.')
      expect(o.catchBody).toMatch(/rastajemo se kao prijatelji/)
      // nothing is paid in month one, so there is nothing to refund; and after month one it is paid, so never "ne plaćate ništa"
      expect(all).not.toMatch(/svaki dinar|ne plaćate ništa(?! uvođenje)|besplatno i bez obaveza|povraćaj novca|garancija povraćaja/i)
    }
  })
  it('answers the objections only with settled terms: no price, no invented process', () => {
    const o = offerCopy({ model: 'quote', niche: null, flows: null })
    expect(o.faq.length).toBeGreaterThanOrEqual(8)
    const text = o.faq.map((f: any) => f.a).join(' ')
    expect(text).not.toMatch(/\d+\s?(€|eur|rsd|din)/i) // the amount is agreed on the call, never written down
    expect(text).toMatch(/dogovaramo na razgovoru od 20 minuta/)
    expect(o.faq.map((f: any) => f.q)).toEqual(expect.arrayContaining(['Zašto besplatno?', 'Čiji su razgovori i podaci?']))
  })

  it('keeps a case-correct noun in each sentence', () => {
    expect(tourCopy({ model: 'quote', niche: null, flows: null }).crm.body).toContain('upisuje razgovor, ponudu i razlog')
    expect(tourCopy({ model: 'booking', niche: 'dental', flows: null }).crm.body).toContain('upisuje razgovor, termin i razlog')
    expect(tourCopy({ model: 'booking', niche: 'dental', flows: { stays: true } }).crm.body).toContain('upisuje razgovor, rezervaciju i razlog')
    expect(tourCopy({ model: 'booking', niche: 'dental', flows: { stays: true } }).termini.body).toMatch(/^Rezervacija koju agent/)
    expect(tourCopy({ model: 'booking', niche: 'dental', flows: null }).termini.body).toMatch(/^Termin koji agent/)
  })
})
