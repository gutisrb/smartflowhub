import { describe, it, expect } from 'vitest'
import { vetNiche } from './niche-vet.mjs'

describe('vetNiche', () => {
  it('drops a vertical label the business’s own words do not support (Bee Bike, TopDek, Montažne hale 2026-11-11)', () => {
    expect(vetNiche('beauty', 'Gradske ulice i kafa na omiljenoj lokaciji. E-bicikli, 24 rate, zakaži test vožnju')).toBe('services')
    expect(vetNiche('beauty', 'Premium WPC sistemi, fasade, podovi, ograde')).toBe('services')
    expect(vetNiche('fitness', 'Proizvodnja i montaža čeličnih konstrukcija, hale po meri')).toBe('services')
  })
  it('keeps it when the business really is that vertical', () => {
    expect(vetNiche('beauty', 'Tretman lica i masaža, salon lepote')).toBe('beauty')
    expect(vetNiche('dental', 'Implantologija i estetska stomatologija, prvi pregled besplatan')).toBe('dental')
    expect(vetNiche('fitness', 'Personalni trening i teretana')).toBe('fitness')
  })
  it('leaves niches without a vertical template alone', () => {
    expect(vetNiche('quote', 'anything')).toBe('quote')
    expect(vetNiche('furniture', '')).toBe('furniture')
  })
})
