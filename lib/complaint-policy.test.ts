import { describe, it, expect } from 'vitest'
import { derivePolicyComplaint } from './complaint-policy.mjs'

const SITE = 'Opšti uslovi korišćenja. Ukoliko uočite da uređaj ne vrši namenjenu funkciju i sumnjate na nesaobraznost proizvoda reklamaciju možete uložiti slanjem popunjenog OBRASCA ZA REKLAMACIJU na mail adresu online@metal-flex.com. Dostava 2 do 3 dana. Reklamacija. Obrazac za reklamaciju.'
describe('derivePolicyComplaint', () => {
  it('builds the complaint from the shop’s own rule (Metal-Flex)', () => {
    const c = derivePolicyComplaint(SITE, { name: 'Bosch aku ugaona brusilica GWS 18V' })!
    expect(c.ask).toContain('„Bosch aku ugaona brusilica GWS 18V“')
    expect(c.answer).toContain('reklamaciju možete uložiti slanjem popunjenog OBRASCA ZA REKLAMACIJU na mail adresu online@metal-flex.com')
    expect(SITE).toContain(c.source)
  })
  it('is null when the site states no complaint rule', () => {
    expect(derivePolicyComplaint('Prodajemo alat. Dostava 2 do 3 dana. 10 godina garancije na motor.', { name: 'x' })).toBeNull()
  })
})
