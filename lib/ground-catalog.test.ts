import { describe, it, expect } from 'vitest'
// @ts-ignore plain .mjs
import { priceOnSite } from '../ground_catalog.mjs'

describe('priceOnSite', () => {
  it('accepts RSD as written and EUR×117 (Emmeti "Od 802 EUR" = 93.834)', () => {
    expect(priceOnSite(44400, 'Cena 44.400,00 RSD')).toBe('rsd')
    expect(priceOnSite(93834, 'Mikado sto Od 802 EUR')).toBe('eur')
  })
  it('rejects a price that is on no page (TopDek 8.190)', () => {
    expect(priceOnSite(8190, 'WPC deking. Kontakt 065/24-17-043. Katalog proizvoda.')).toBeNull()
  })
})
