import { describe, it, expect } from 'vitest'
import { checkDemo, openerIsReal, numbersIn, numberSet } from './demo-gate.mjs'

// Every fixture is a line that really shipped and was caught by the 2026-11-10 fact-check against the business's own site.
const SITE = 'Prodaja nameštaja. Garancija 2 godine. Standardni rok isporuke je 10 do 14 radnih dana. Cena 44.400,00 RSD. Platite tek kada proizvod stigne na vašu adresu. '.repeat(6)
const base = (over: any = {}) => ({
  threads: [{ id: 'demo_x_hero1', role: 'user', message: 'Cena?' }],
  crm: [], flows: { quote: false, calendar: false }, niche: 'furniture', model: 'order',
  corpus: SITE, captions: [], otherSources: [], questions: [{ text: 'Cena?' }], statusLabels: {}, heroOwn: true, ...over,
})
const agent = (message: string, id = 'demo_x_hero1') => ({ id, role: 'assistant', message })
const rules = (r: any) => r.failures.map((f: any) => f.rule)

describe('checkDemo: what the agent says', () => {
  it('catches a concession to the price objection (Dallas, Cvejanović, Luxor)', () => {
    for (const line of ['Nije mala cifra, slažem se. Uz to dobijate 25 meseci garancije.', 'Jasno. Uz to dobijate 2 godine garancije.', 'Razumem Vas. Ostalo je isto.'])
      expect(rules(checkDemo(base({ threads: [agent(line)] })))).toContain('concedes-price')
  })
  it('catches "porudžbina je primljena" on a business that takes no order in chat (Demart, Dallas)', () => {
    expect(rules(checkDemo(base({ flows: { quote: true, calendar: false }, threads: [agent('Hvala, porudžbina je primljena ✅')] })))).toContain('order-confirmed')
  })
  it('catches tracking, cash on delivery and reminders the site never mentions (Demart, DENTALUX)', () => {
    const r = checkDemo(base({ threads: [agent('Porudžbina je potvrđena ✅ Broj za praćenje pošiljke dobićete SMS-om'), agent('Kako želite da platite, pouzećem ili karticom?'), agent('Upisani ste danas u 15h. Stiže Vam i podsetnik.')] }))
    expect(rules(r)).toEqual(expect.arrayContaining(['tracking-sms', 'cash-on-delivery', 'reminder', 'hard-slots']))
  })
  it('allows a reminder or cash on delivery when the business states it', () => {
    const r = checkDemo(base({ corpus: SITE + ' Šaljemo podsetnik. Plaćanje pouzećem.', threads: [agent('Stiže Vam podsetnik.'), agent('Pouzećem ili karticom?')] }))
    expect(rules(r)).not.toContain('reminder'); expect(rules(r)).not.toContain('cash-on-delivery')
  })
  it('catches promises the site never makes (Varmus, Cvejanović, Tandem, LOGERA)', () => {
    const r = checkDemo(base({ threads: [agent('Pošaljite mi ime i broj telefona, pa ponudu dobijate na ovaj broj.'), agent('Hvala, Dragana. Pitanje je prosleđeno, lekar Vam se javlja lično 🙏'), agent('Izmene prosleđujem kolegama iz montaže.'), agent('kolege koje prave ponude će Vam se javiti')] }))
    expect(rules(r)).toEqual(expect.arrayContaining(['channel-promise', 'personal-callback', 'invented-team']))
  })
  it('catches hard slots for a business with no calendar, allows them with one (DENTALUX vs a booking clinic)', () => {
    expect(rules(checkDemo(base({ threads: [agent('Danas u 15h ili u 16h.')] })))).toContain('hard-slots')
    expect(rules(checkDemo(base({ flows: { calendar: true }, threads: [agent('Danas u 15h ili u 16h.')] })))).not.toContain('hard-slots')
  })
  it('catches an emoji in a clinic chat, not in a shop (Cvejanović, DENTALUX)', () => {
    expect(rules(checkDemo(base({ niche: 'dental', threads: [agent('Zdravo, Marija 😊 Cena je 5.600 EUR.')] })))).toContain('emoji-in-clinic')
    expect(rules(checkDemo(base({ niche: 'furniture', threads: [agent('Zdravo, Marija 😊')] })))).not.toContain('emoji-in-clinic')
  })
})

describe('checkDemo: what the customer says', () => {
  it('catches the generic complaint and the filler "Hvala." on every demo (Luxor, Dallas, JetSet, Demart)', () => {
    const t = [{ id: 'demo_x_hero2', role: 'user', message: 'Stigao mi je oštećen proizvod 😞' }, { id: 'demo_x_hero2', role: 'user', message: 'Hvala.' }]
    expect(rules(checkDemo(base({ threads: t, heroOwn: false })))).toEqual(expect.arrayContaining(['generic-complaint', 'filler-thanks']))
  })
  it('accepts a complaint a hand sheet wrote from the business’s own policy', () => {
    const t = [{ id: 'demo_x_hero2', role: 'user', message: 'Stigao mi je oštećen proizvod 😞' }]
    expect(rules(checkDemo(base({ threads: t, heroOwn: true })))).not.toContain('generic-complaint')
  })
  it('requires the sale opener to come from real comments (Luxor "još u ponudi", DENTALUX "ispun kod dece")', () => {
    const q = [{ text: 'Cena?' }, { text: 'Molim vas koliko cena' }, { text: 'Zdravo cena?' }]
    expect(rules(checkDemo(base({ questions: q, threads: [{ id: 'demo_x_hero1', role: 'user', message: 'Zanima me Sto za šminkanje LUX 14 MN.BB. Da li je još u ponudi?' }] })))).toContain('template-opener')
    expect(openerIsReal('Zdravo, koliko košta ispun kod dece?', q)).toBe(false)
    expect(openerIsReal('Zdravo cena?', q)).toBe(true)
    expect(openerIsReal('Molim vas koliko je cena', q)).toBe(true)
  })
  it('fails when no real comment is stored at all (DENTALUX: only political spam was stored)', () => {
    expect(rules(checkDemo(base({ questions: [] })))).toContain('no-real-comments')
  })
})

describe('checkDemo: numbers', () => {
  it('normalises amounts the way sites write them', () => {
    expect(numbersIn('Cena je 44.400 RSD, garancija 2 godine, 5 600 EUR').map((x) => x.n)).toEqual(['44400', '2', '5600'])
    expect(numberSet('Cena 44.400,00 RSD').has('44400')).toBe(true)
  })
  it('fails an amount that is on none of the business’s pages (webshop template "2.490 RSD", struck-through 390)', () => {
    const r = checkDemo(base({ threads: [agent('Cena je 2.490 RSD.'), agent('Paket Gold je 390 EUR.')] }))
    expect(r.failures.filter((f: any) => f.rule === 'number-not-on-site').length).toBe(2)
  })
  it('passes an amount the site states and warns on one only the stored catalogue has', () => {
    expect(rules(checkDemo(base({ threads: [agent('Cena je 44.400 RSD, garancija 2 godine, isporuka 10 do 14 radnih dana.')] }))).filter((x: string) => x === 'number-not-on-site')).toEqual([])
    const w = checkDemo(base({ otherSources: ['Sto 57300'], threads: [agent('Cena je 57.300 RSD.')] }))
    expect(rules(w)).not.toContain('number-not-on-site'); expect(w.warnings.map((x: any) => x.rule)).toContain('number-not-on-site')
  })
  it('reads Instagram captions as the business’s own words (Varmus "42 m²")', () => {
    expect(rules(checkDemo(base({ captions: ['42 kvadrata. Kupatilo, klima. Gotovo za 15 radnih dana.'], threads: [agent('Objekat od 42 m² je gotov za 15 radnih dana.')] }))))
      .not.toContain('number-not-on-site')
  })
})

describe('checkDemo: CRM, cards, site text', () => {
  it('fails "Zakazano" for a business with no booking unless it is relabelled (Varmus, Cvejanović)', () => {
    const crm = [{ id_razgovora: 'demo_x_hero1', status: 'Zakazano', razlog: '' }]
    expect(rules(checkDemo(base({ crm })))).toContain('crm-booking-status')
    expect(rules(checkDemo(base({ crm, statusLabels: { Zakazano: 'Ponuda' } })))).not.toContain('crm-booking-status')
    expect(rules(checkDemo(base({ crm, flows: { calendar: true } })))).not.toContain('crm-booking-status')
  })
  it('fails when the site text is unreadable (Belodore exposes no readable catalogue)', () => {
    expect(rules(checkDemo(base({ corpus: '' })))).toContain('no-site-text')
  })
  it('gives a stable hash that changes with the content', () => {
    const a = checkDemo(base({ threads: [agent('Cena je 44.400 RSD.')] })), b = checkDemo(base({ threads: [agent('Cena je 44.400 RSD.')] })), c = checkDemo(base({ threads: [agent('Cena je 57.300 RSD.')] }))
    expect(a.hash).toBe(b.hash); expect(a.hash).not.toBe(c.hash)
  })
})

describe('numberSet', () => {
  it('never glues two separate numbers together (a catalogue row "name 187833 187833")', () => {
    const s = numberSet('Ugaona garnitura Bianca 187833 187833\nSto 57300 57300')
    expect(s.has('187833')).toBe(true); expect(s.has('57300')).toBe(true)
  })
  it('still reads grouped numbers and decimals', () => {
    const s = numberSet('Cena 44.400,00 RSD, 5 600 EUR, 2,5 m2')
    expect(s.has('44400')).toBe(true); expect(s.has('5600')).toBe(true); expect(s.has('2.5')).toBe(true)
  })
})
