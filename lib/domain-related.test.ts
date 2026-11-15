import { describe, it, expect } from 'vitest'
import { domainRelated } from './email-finder.mjs'

// Real results of find_websites.mjs on 2026-11-14: a marketing agency and an Instagram viewer were accepted as "its website"; viafizio.rs is the real one.
describe('domainRelated', () => {
  it('accepts the real site of Via Fizio', () => expect(domainRelated('viafizio.rs', 'Via Fizio', 'viafizio')).toBe(true))
  it('accepts a domain that contains the handle or name', () => {
    expect(domainRelated('www.aluroll.rs', 'Aluroll doo', 'aluroll_doo')).toBe(true)
    expect(domainRelated('dentistmladenovic.rs', 'Dentist Mladenovic Clinic', 'dentist_mladenovic')).toBe(true)
  })
  it('rejects the marketing agency that lists MB Laser as a client (brands-ignited.com)', () => expect(domainRelated('brands-ignited.com', 'MB Laser estetic centar', 'mb_laser_estetic_centar')).toBe(false))
  it('rejects an Instagram viewer mirror (imginn.com)', () => expect(domainRelated('imginn.com', 'Modni studio MS Sopot', 'modni_studio_ms_sopot_')).toBe(false))
  it('rejects a similar-sounding but different business', () => expect(domainRelated('tehnokrug.rs', 'Mobilni San', 'mobilni_san')).toBe(false))
  it('rejects very short labels', () => expect(domainRelated('rs.com', 'RS Shop', 'rs_shop')).toBe(false))
})
