import { describe, it, expect } from 'vitest'
import { extractEmails, decodeCfEmail, pickBest, ownDomain, fromStored } from './email-finder.mjs'

describe('email finder', () => {
  it('finds an address written in the lead’s own Instagram bio (SLW Container, 2026-11-11: it was parked as "no email")', () => {
    const lead = { email: null, intake_data: { enrichment: { instagram_profile: { bio: '🏷 Prodaja i renta brodskih kontejnera\n📞 +381 62 79 0009\n📬 slw@s-logistic.rs\n🚚 Transport @slogisticworld' } } } }
    expect(fromStored(lead).emails).toEqual(['slw@s-logistic.rs'])
  })
  it('decodes Cloudflare-protected, [at]-style and %40 addresses', () => {
    const enc = (s: string, key = 0x42) => key.toString(16).padStart(2, '0') + [...s].map((c) => (c.charCodeAt(0) ^ key).toString(16).padStart(2, '0')).join('')
    expect(decodeCfEmail(enc('info@firma.rs'))).toBe('info@firma.rs')
    expect(extractEmails(`<a class="__cf_email__" data-cfemail="${enc('prodaja@firma.rs')}">[email protected]</a>`)).toEqual(['prodaja@firma.rs'])
    expect(extractEmails('pišite na kontakt [at] firma [dot] rs')).toEqual(['kontakt@firma.rs'])
    expect(extractEmails('mailto:office%40firma.rs?subject=x')).toEqual(['office@firma.rs'])
  })
  it('drops assets, trackers and no-reply addresses', () => {
    expect(extractEmails('logo@2x.png sentry@abc.ingest.sentry.io noreply@firma.rs info@firma.rs user@wixpress.com')).toEqual(['info@firma.rs'])
  })
  it('prefers the business’s own domain, then a mailbox it publishes', () => {
    expect(pickBest(['a@gmail.com', 'prodaja@firma.rs', 'info@firma.rs'], 'firma.rs')).toBe('info@firma.rs')
    expect(pickBest(['x@other.rs', 'firma.rs@gmail.com'], 'firma.rs')).toBe('firma.rs@gmail.com')
  })
  it('does not treat a social page or marketplace as the business’s own site', () => {
    expect(ownDomain('https://www.facebook.com/share/1D62yjz1Sq/')).toBeNull()
    expect(ownDomain('https://www.kupujemprodajem.com/x/oglas/1')).toBeNull()
    expect(ownDomain('http://www.montazne-hale.com/')).toBe('montazne-hale.com')
  })
})

import { pageIsAbout } from './email-finder.mjs'
describe('pageIsAbout', () => {
  const lead = { company_name: 'Montažne hale', website: 'https://montazne-hale.com', instagram_handle: 'montaznehale', intake_data: { enrichment: { instagram_profile: { bio: '-Informacije : +381656604424\n-Proizvodnja i montaža objekata' } } } }
  it('rejects another business that shares the generic words (Stamil, 2026-11-11)', () => {
    expect(pageIsAbout(lead, 'https://stamil.rs/montazne-hale/', 'Montažne hale po meri. Kontakt: metalinzelic@gmail.com, tel 064 111 2233')).toBe(false)
  })
  it('accepts a page with the lead’s own phone, domain or handle', () => {
    expect(pageIsAbout(lead, 'https://x.rs/a', 'pozovite 065 660 4424')).toBe(true)
    expect(pageIsAbout(lead, 'https://x.rs/a', 'sajt montazne-hale.com')).toBe(true)
  })
  it('accepts a company-registry entry named after the business', () => {
    expect(pageIsAbout({ company_name: 'Dentist Mladenovic Clinic', website: 'https://dentistmladenovic.rs' }, 'https://www.companywall.rs/firma/dentist-mladenovic/MMxAahBHD', 'Email: x@gmail.com')).toBe(true)
  })
})

import { findWebsite } from './email-finder.mjs'
describe('findWebsite', () => {
  it('needs a key and a name, never guesses', async () => {
    expect(await findWebsite({ company_name: '', instagram_handle: 'x' }, 'k')).toBeNull()
    expect(await findWebsite({ company_name: 'Firma', instagram_handle: 'x' }, '')).toBeNull()
  })
})

describe('placeholder addresses', () => {
  it('drops template placeholders found on sites (VACASA shipped "info@website.com", 2026-11-11)', () => {
    expect(extractEmails('Kontakt: info@website.com, name@domain.com, youremail@gmail.com, prodaja@vacasa.rs')).toEqual(['prodaja@vacasa.rs'])
  })
})
