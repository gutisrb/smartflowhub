import { describe, it, expect } from 'vitest'
import { profileFit } from './lead-profile.mjs'

// The original batch Nikola likes must pass; the loose-tier leads and his "Plemenita ulja" scenario must not.
const pass = (name: string, bio = '') => profileFit({ name, bio, followers: 50000 }).pass
describe('profileFit (who is worth a demo)', () => {
  it('passes the original batch’s kinds of business', () => {
    expect(pass('Varmus', 'Montažni objekti i kontejnerske kuće')).toBe(true)
    expect(pass('LOGERA TINY HOME', 'Tiny house proizvodnja')).toBe(true)
    expect(pass('Tandem Skok Beograd', 'Tandem skokovi padobranom, Beograd')).toBe(true)
    expect(pass('Stomatoloska ordinacija Cvejanovic', 'implantologija, estetska stomatologija')).toBe(true)
    expect(pass('JetSet', 'Novi i polovni mobilni telefoni, otkup telefona')).toBe(true)
    expect(pass('Luxor Furniture', 'Stolovi za šminkanje, nameštaj')).toBe(true)
    expect(pass('Demart Serbia', 'Pergole, tende, klizni krov')).toBe(true)
  })
  it('passes quote-based furniture shops from the new batch (Vitax, SitForm, Linea, Furni)', () => {
    for (const n of ['Nameštaj Vitax', 'Salon nameštaja SitForm', 'Linea Milanovic - luxury furniture & interiors', 'Nameštaj po meri | Furni Enterijeri']) expect(pass(n)).toBe(true)
  })
  it('rejects the low-ticket and appointment-commodity accounts that got in through loose tiers', () => {
    expect(pass('Venčanice Sirena Beograd')).toBe(false)
    expect(pass('Venčanice BRIDAL BOUTIQUE')).toBe(false)
    expect(pass('mb_laser_estetic_centar', 'laser epilacija')).toBe(false)
    expect(pass('LuxeHair Srbija', 'hair extensions')).toBe(false)
  })
  it('rejects the Plemenita ulja scenario (size and price passed, no pain)', () => {
    const r = profileFit({ name: 'Plemenita ulja', bio: 'Prirodna kozmetička ulja', followers: 40000 })
    expect(r.pass).toBe(false); expect(r.fails.join(' ')).toMatch(/low-ticket/)
  })
  it('has no niche whitelist: an unlisted business passes as "other" (the ICP is behaviour, lib/lead-fit.mjs)', () => {
    const r = profileFit({ name: 'Nešto d.o.o.', bio: 'Kreativna agencija', followers: 50000 })
    expect(r.pass).toBe(true); expect(r.vertical).toBe('other')
  })
  it('rejects chains, wholesale groups and anything over 200k followers (not owner-run SMBs)', () => {
    expect(profileFit({ name: 'Nameštaj Grupa', bio: 'veleprodaja nameštaja, grupa', followers: 60000 }).pass).toBe(false)
    expect(profileFit({ name: 'Nameštaj Gigant', bio: 'nameštaj', followers: 300000 }).pass).toBe(false)
    expect(profileFit({ name: 'Salon nameštaja', bio: 'preko 12 prodavnica širom Srbije', followers: 80000 }).pass).toBe(false)
    expect(profileFit({ name: 'Luxor Furniture', bio: 'Dostava širom Srbije', followers: 44000 }).pass).toBe(true) // delivery area, not a chain
  })
  it('lets a clinic through the low-ticket filter when it is dental or aesthetic surgery', () => {
    expect(pass('Dental centar', 'stomatološka ordinacija, tretmani i wellness')).toBe(true)
  })
  it('does not let a bio keyword turn a beauty studio into a surgery clinic (Studio Namaste: "plastična hirurgija" in its bio)', () => {
    const r = profileFit({ name: 'Studio Namaste za negu i lepotu tela', niche: 'klinika_wellness', bio: 'Generalni distributer za JETPEEL, nega posle plastične hirurgije', followers: 25000 })
    expect(r.pass).toBe(false); expect(r.fails.join(' ')).toMatch(/low-ticket/)
    expect(profileFit({ name: 'Mia Body Space', niche: 'klinika_wellness', followers: 65000 }).pass).toBe(false)
  })
  it('keeps a dental clinic the classifier labelled klinika_wellness (Up Dent Belgrade)', () => {
    expect(profileFit({ name: 'Up Dent Belgrade', niche: 'klinika_wellness', followers: 28000 }).pass).toBe(true)
  })
  it('rejects small boutiques: fashion, jewelry, underwear, bags (the "small fish" Nikola does not want)', () => {
    for (const n of ['sfashionshop.bn', 'Hirurški čelik Royal nakit', 'mare.underwear', 'Night wish underwear', 'Lux boutique']) expect(profileFit({ name: n, followers: 40000 }).pass).toBe(false)
    expect(profileFit({ name: 'Aluroll doo', bio: 'rolo zavese, roletne', followers: 35000 }).pass).toBe(true)
  })
})
