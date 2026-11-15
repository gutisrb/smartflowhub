import { describe, it, expect } from 'vitest'
import { marketCheck, chainCheck, countAddresses } from './lead-sanity.mjs'

// Real leads that reached Nikola's shortlist on 2026-11-14 and should never have: an Albanian-language clinic, a Bosnian shop,
// a Bosnian importer, a toy chain with dozens of stores ("people do not DM Walmart to buy stuff").
describe('marketCheck', () => {
  it('fails Trandevue Clinic: Albanian bio, no Serbian signal', () => {
    const r = marketCheck({ name: 'Trandevue Clinic', bio: 'Klinikë elitare e specializuar në mbjellje flokësh & trajtim', website: 'https://trandevue.com' })
    expect(r.verdict).toBe('fail'); expect(r.reason).toMatch(/Albanian/)
  })
  it('fails Polovna Bijela Tehnika Laktaši: a Bosnian town in the name', () => {
    expect(marketCheck({ name: 'Polovna Bijela Tehnika Laktaši', bio: 'Polovna tehnika', website: 'https://polovna-tehnika.com' }).verdict).toBe('fail')
  })
  it('fails USA Auto Import: .ba domain and Kotor Varoš', () => {
    const r = marketCheck({ name: 'USA Auto Import', bio: 'IMPORT CARS USA d.o.o. Kotor Varoš / Uvoz i prevoz vozila', website: 'https://usauto.ba' })
    expect(r.verdict).toBe('fail'); expect(r.reason).toMatch(/usauto\.ba/)
  })
  it('passes a Serbian clinic (Belgrade, +381)', () => {
    expect(marketCheck({ name: 'Stomatoloska ordinacija Cvejanovic', bio: 'Zubar Beograd +381 60 3910483', website: 'https://ordinacijacvejanovic.com' }).verdict).toBe('ok')
  })
  it('sends a lead with no Serbian signal to review, never ok (TopDek: .com, no city, no phone)', () => {
    expect(marketCheck({ name: 'TopDek', bio: 'Premium WPC sistemi Fasade Podovi Ograde', website: 'https://topdek.com' }).verdict).toBe('review')
  })
  it('sends mixed signals to review (.ba domain but a +381 phone)', () => {
    expect(marketCheck({ name: 'Firma', bio: 'Tel +381 64 123 4567', website: 'https://firma.ba' }).verdict).toBe('review')
  })
  it('does not read "+40%" as a foreign phone prefix', () => {
    expect(marketCheck({ name: 'Shop', bio: 'Popust do +40% Beograd', website: 'https://shop.rs' }).verdict).toBe('ok')
  })
})

describe('chainCheck', () => {
  it('fails a bio that states 38 stores (Kompanija TRI O)', () => {
    const r = chainCheck({ name: 'Kompanija TRI O', bio: 'Jedno mesto za sve pametne kupovine! 🛒 38 prodavnica', siteText: 'x' })
    expect(r.verdict).toBe('fail'); expect(r.locations).toBe(38)
  })
  it('fails a site that lists many store addresses (Dexy Co: 74 on its own site)', () => {
    const streets = ['Knez Mihailova', 'Kralja Milana', 'Nikole Pasica', 'Bulevar Oslobodjenja', 'Zmaj Jovina', 'Cara Dusana', 'Vojvode Misica', 'Takovska']
    const text = streets.map((s, i) => `Prodavnica ${i + 1}: ${s} ${i + 3}, Beograd`).join(' ')
    expect(countAddresses(text)).toBe(8); expect(chainCheck({ name: 'Shop', bio: '', siteText: text }).verdict).toBe('fail')
  })
  it('fails a bio that lists store towns (Hedera Vita: radnje u Loznici, Beogradu, Novom Sadu, Subotici)', () => {
    expect(chainCheck({ name: 'Hedera Vita', bio: 'Hedera Vita radnje: Loznica, Beograd, Novi Sad, Subotica', siteText: 'x' }).verdict).toBe('fail')
    expect(chainCheck({ name: 'Cvejanovic', bio: 'Ordinacija u Beogradu', siteText: 'Loznicka 13, Beograd' }).verdict).toBe('ok')
  })
  it('counts the same address once', () => {
    expect(countAddresses('Knez Mihailova 5, Beograd. Dolazite na Knez Mihailova 5, Beograd.')).toBe(1)
  })
  it('puts 4-7 locations in review (Plus Exclusive: 5 stores)', () => {
    expect(chainCheck({ name: 'PLUS EXCLUSIVE', bio: '5 lokacija', siteText: 'Knez Mihailova 5, Beograd' }).verdict).toBe('review')
  })
  it('fails a national-scale advertiser (Aksa: 184k followers, 11 live ads)', () => {
    const r = chainCheck({ name: 'Aksa', bio: 'Iskusno od prvog dana', siteText: 'Sve za bebe', followers: 183504, ads: 11 })
    expect(r.verdict).toBe('fail'); expect(r.reason).toMatch(/national-scale/)
  })
  it('does not flag a big account that runs no ads (Cvejanovic: 182k followers, 0 ads)', () => {
    expect(chainCheck({ name: 'Cvejanovic', bio: '', siteText: 'Loznicka 13, Beograd', followers: 182236, ads: 0 }).verdict).toBe('ok')
  })
  it('fails franchise wording', () => {
    expect(chainCheck({ name: 'Mia Body Space', bio: 'Centar za negu tela / Franšiza', siteText: 'x' }).verdict).toBe('fail')
  })
  it('never says ok when the own site could not be read', () => {
    expect(chainCheck({ name: 'SLW', bio: 'Prodaja i renta brodskih kontejnera', siteText: '' }).verdict).toBe('review')
  })
})

import { hubAccount, remoteSalesCheck } from './lead-sanity.mjs'
describe('hubAccount', () => {
  it('flags a bio that lists several other accounts (Mr Everything)', () => {
    expect(hubAccount('CONCIERGE: @everything_belgrade\nREAL ESTATE: @kis.realestate \nEVENT: @illusions_ofc').hub).toBe(true)
  })
  it('does not flag a normal business bio, or one sister account', () => {
    expect(hubAccount('Zubar Beograd +381 60 3910483').hub).toBe(false)
    expect(hubAccount('Bee Bike e-mobility. Servis: @beebike.servis').hub).toBe(false)
  })
})

describe('remoteSalesCheck', () => {
  it('Plus Exclusive: delivery in 3-7 days, cart and card payment on its own site -> ok', () => expect(remoteSalesCheck('Online plaćanje Mogućnost plaćanja svim karticama Brza dostava Rok isporuke 3-7 radnih dana Dodaj u korpu').ok).toBe(true))
  it('a clinic that takes bookings and quotes -> ok', () => expect(remoteSalesCheck('Zakažite konsultacije. Pošaljite upit za ponudu.').ok).toBe(true))
  it('a walk-in shop page with only opening hours and an address -> warning', () => expect(remoteSalesCheck('Posetite nas. Radno vreme 9-17. Knez Mihailova 5, Beograd. Dobrodošli.').ok).toBe(false))
})
