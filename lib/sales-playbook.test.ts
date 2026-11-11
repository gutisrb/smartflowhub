import { describe, it, expect } from 'vitest'
// @ts-ignore — plain .mjs shared with the pipeline scripts
import { buildSaleMessages, buildHesitationMessages, normalizeOfferTerms, groundOfferTerms, priceQuestion, isHighTicket, salesRulesFor, playbookPromptBlock, hesitation } from './sales-playbook.mjs'

const clinicTerms = normalizeOfferTerms({
  included: ['pregled', 'plan terapije', 'privremene krunice'],
  guarantee: '5 godina na krunice, doživotna na implante',
  payment_schedule: '500 € rezervacija, pa dve jednake uplate kroz posete',
  financing: null,
  free_consultation: { label: 'besplatan online pregled', how: 'pošaljete fotografije zuba', outcome: 'informativnu ponudu' },
})
const dear = { sale: 'hollywood smile', price: '655.200 RSD', priceRsd: 655200 }
const cheap = { sale: 'izbeljivanje zuba', price: '18.000 RSD', priceRsd: 18000 }
const text = (msgs: any[]) => msgs.map((m) => m[1]).join(' \n ')

describe('sales playbook', () => {
  it('uses price + inclusions, never the bare "Da Vas zakažem?"', () => {
    const { msgs } = buildSaleMessages({ svc: dear, terms: clinicTerms })
    expect(msgs[1][1]).toContain('655.200 RSD')
    expect(msgs[1][1]).toContain('U cenu ulaze')
    expect(msgs[1][1]).not.toMatch(/Da Vas zakažem\?/)
  })
  it('never downsells', () => {
    for (const svc of [dear, cheap]) {
      const t = text(buildSaleMessages({ svc, terms: clinicTerms }).msgs)
      expect(t).not.toMatch(/povoljnij|jeftinij|imamo i /i)
    }
  })
  it('never mentions rates when the site lists no financing', () => {
    const t = text(buildSaleMessages({ svc: dear, terms: clinicTerms }).msgs) + text(buildHesitationMessages({ svc: dear, terms: clinicTerms }).msgs)
    expect(t).not.toMatch(/\brate\b|\brata\b|kredit|12 i 24/i)
  })
  it('quotes financing only when the tenant has it', () => {
    const t = text(buildSaleMessages({ svc: dear, terms: { ...clinicTerms, financing: 'Plaćanje na 12 rata bez kamate.' } }).msgs)
    expect(t).toContain('12 rata')
  })
  it('high-ticket books the clinic\'s own first step, not the treatment', () => {
    const r = buildSaleMessages({ svc: dear, terms: clinicTerms })
    expect(r.highTicket).toBe(true)
    expect(r.stepName).toBe('Besplatan online pregled')
    expect(text(r.msgs)).toContain('pošaljete fotografije zuba')
  })
  it('low-ticket stays on the treatment itself', () => {
    expect(buildSaleMessages({ svc: cheap, terms: clinicTerms }).highTicket).toBe(false)
  })
  it('makes one objection attempt after "Hvala"', () => {
    const { msgs, razlog, leftOn } = buildHesitationMessages({ svc: dear, terms: clinicTerms })
    expect(msgs[2][1]).toMatch(/Hvala/)
    expect(msgs[3][0]).toBe('assistant')
    expect(leftOn).toBe('Hvala, javiću se.')
    expect(razlog).toContain('Hvala, javiću se.')
  })
  it('uses a payment schedule only for the package it belongs to', () => {
    const scoped = normalizeOfferTerms({ payment_schedule: 'rezervacija 500 €, drugi dolazak 2.550 €', payment_schedule_applies_to: 'Hollywood smile' })
    expect(text(buildSaleMessages({ svc: dear, terms: scoped }).msgs)).toContain('rezervacija 500 €')
    expect(text(buildSaleMessages({ svc: { sale: 'zubni implant', price: '300.000 RSD', priceRsd: 300000 }, terms: scoped }).msgs)).not.toContain('rezervacija 500 €')
  })
  it('states nothing when no terms were extracted', () => {
    const t = text(buildSaleMessages({ svc: dear, terms: normalizeOfferTerms(null) }).msgs)
    expect(t).not.toMatch(/garancij|u fazama|rata/i)
  })
  it('keeps messages short (chat, not paragraphs)', () => {
    for (const m of buildSaleMessages({ svc: dear, terms: clinicTerms }).msgs) expect(m[1].length).toBeLessThan(330)
  })
  it('normalizes junk', () => {
    expect(normalizeOfferTerms({ financing: 'null', guarantee: '  ', free_consultation: { how: 'x' } }).financing).toBeNull()
    expect(normalizeOfferTerms({ free_consultation: { how: 'x' } }).free_consultation).toBeNull()
  })
  it('layers rules', () => {
    expect(isHighTicket(100000)).toBe(true)
    expect(salesRulesFor({ isService: true, highTicket: true })).toContain('low-commitment first step')
    expect(salesRulesFor({ isService: false, highTicket: false })).not.toContain('low-commitment first step')
    expect(playbookPromptBlock({ isService: true, highTicket: true, offerTerms: clinicTerms })).toContain('Financing: NONE')
  })
  it('drops terms the site does not state', () => {
    const page = 'Garancija+ Krunice 5 godina Zubni implanti Doživotna. Plaćanje je gotovinsko ili kartično. Besplatan online pregled.'
    const g = groundOfferTerms({
      guarantee: 'krunice 5 godina, zubni implanti doživotna',
      financing: 'plaćanje na rate u našem maloprodajnom objektu',
      payment_methods: 'gotovinsko ili kartično',
      free_consultation: { label: 'besplatan online pregled' },
      included: ['pregled', 'izbeljivanje zuba'],
    }, page)
    expect(g.guarantee).toBe('krunice 5 godina, zubni implanti doživotna')
    expect(g.financing).toBeNull()
    expect(g.payment_methods).toBe('gotovinsko ili kartično')
    expect(g.free_consultation?.label).toBe('besplatan online pregled')
    expect(g.included).toEqual(['pregled'])
  })
  it('keeps financing the site really offers, without shouting', () => {
    expect(groundOfferTerms({ financing: 'Mogućnost plaćanja na rate' }, '2 godine garancije Mogućnost plaćanja na rate').financing).toBe('Mogućnost plaćanja na rate')
    expect(groundOfferTerms({ financing: 'ODLOŽENO PLAĆANJE' }, 'ODLOŽENO PLAĆANJE').financing).toBe('odloženo plaćanje')
  })
  it('asks the price in correct Serbian', () => {
    expect(priceQuestion('Hollywood smile')).toBe('Zdravo, koliko košta Hollywood smile?')
    expect(priceQuestion('Zubni implanti - jedan zub na implantu')).toBe('Zdravo, koliko koštaju zubni implanti - jedan zub na implantu?')
    expect(priceQuestion('Izbeljivanje zuba')).toBe('Zdravo, koliko košta izbeljivanje zuba?')
    expect(priceQuestion('Bioklimatske pergole')).toBe('Zdravo, koliko koštaju bioklimatske pergole?')
    expect(priceQuestion('Personalni trening')).toBe('Zdravo, koliko košta personalni trening?')
    expect(priceQuestion('Ispun kod dece')).toBe('Zdravo, koliko košta ispun kod dece?')
  })
  it('stages an objection only when the business has a real answer to it', () => {
    // no guarantee, no payment terms, no worked-out reply: "skupo" would be answered with nothing
    const bare = text(buildSaleMessages({ svc: dear, terms: normalizeOfferTerms({}) }).msgs)
    expect(bare).not.toMatch(/skupo|Nije mala cifra/)
    expect(bare).toContain('Kada imate slobodno?')
    // a cheap service never gets a "skupo" beat, whatever the terms
    expect(text(buildSaleMessages({ svc: cheap, terms: clinicTerms }).msgs)).not.toMatch(/skupo/)
    // "skupo" is answered with the business's own payment plan, as the site writes it
    const rates = buildSaleMessages({ svc: dear, terms: clinicTerms })
    expect(text(rates.msgs)).toContain('Plaćanje ide u delovima: 500 € rezervacija')
    // a first step done from home books no slot: she sends the photos
    expect(rates.books).toBe(false)
    expect(text(rates.msgs)).not.toMatch(/15h/)
    expect(rates.razlog).toMatch(/^Rekla da je skupo/)
    // ...and dropped when the site says nothing about paying in parts, and no other stated term answers it
    const none = buildSaleMessages({ svc: dear, terms: normalizeOfferTerms({}) })
    expect(text(none.msgs)).not.toMatch(/na rate|Plaćanje ide u delovima/)
  })
  it('does not give every business the same hesitation line', () => {
    const lines = new Set(['Hollywood smile', 'Zubni implanti', 'Ispun', 'Izbeljivanje', 'Fasete', 'Krunica'].map((n) => hesitation(n)))
    expect(lines.size).toBeGreaterThan(1)
    expect(hesitation('Hollywood smile')).toBe(hesitation('Hollywood smile'))
  })
  it('reads naturally end to end', () => {
    const all = text(buildSaleMessages({ svc: dear, terms: clinicTerms }).msgs)
    expect(all).toContain('dovoljno je da pošaljete fotografije zuba')
    expect(all).not.toMatch(/Pre toga:|slanje fotograf/)
  })
})
