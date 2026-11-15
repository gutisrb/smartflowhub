import { describe, it, expect } from 'vitest'
import { profileFit } from './lead-profile.mjs'

// Nikola 2026-11-13: "niche is irrelevant… if they get queries, they need my offer? GOOD." The ICP is behaviour, measured by
// lib/investment-fit.mjs (active Meta ads or ≥4 reels/30d at ≥20k views). profileFit only rejects what has no DM-sellable product
// at all: state, content, personal brands, commodity hospitality, chains.
const pass = (name: string, bio = '', niche = '') => profileFit({ name, bio, niche, followers: 50000 }).pass
describe('profileFit (who is worth a demo)', () => {
  it('rejects a pharmacy: it does not sell online (Apoteka Jankovic, 2026-11-15)', () => {
    expect(profileFit({ name: 'Apoteka Janković', bio: '', followers: 49000 }).pass).toBe(false)
    expect(profileFit({ name: 'Benu Pharmacy', bio: '', followers: 80000 }).pass).toBe(false)
  })
  it('rejects a political movement and a travel organizer that reached the 2026-11-14 shortlist (Zeleno-levi front, Balkan Fun)', () => {
    expect(profileFit({ name: 'Zeleno-levi front / Ne davimo Beograd', bio: 'Želimo zemlju dobru, zdravu i bezbednu za sve', followers: 45624 }).pass).toBe(false)
    expect(profileFit({ name: 'Balkan Fun Official', bio: 'Licencirani organizator, atraktivne destinacije', followers: 37585 }).pass).toBe(false)
  })
  it('rejects a shopping-mall operator: BIG Fashion Novi Sad (category "Shopping Mall", big-cee.com) is not an owner-run shop', () => {
    expect(profileFit({ name: 'BIG Fashion Novi Sad', bio: 'Dani planete Zemlje', category: 'Shopping Mall', followers: 48399 }).pass).toBe(false)
    expect(profileFit({ name: 'Comfortino', bio: 'Kvalitetna obuća | Kvalitetna garderoba', category: 'Shopping & retail', followers: 83582 }).pass).toBe(true)
  })
  it("passes the original batch's kinds of business", () => {
    expect(pass('Varmus', 'Montažni objekti i kontejnerske kuće')).toBe(true)
    expect(pass('LOGERA TINY HOME', 'Tiny house proizvodnja')).toBe(true)
    expect(pass('Tandem Skok Beograd', 'Tandem skokovi padobranom, Beograd')).toBe(true)
    expect(pass('Stomatoloska ordinacija Cvejanovic', 'implantologija')).toBe(true)
    expect(pass('JetSet', 'Novi i polovni mobilni telefoni')).toBe(true)
    expect(pass('Luxor Furniture', 'Stolovi za šminkanje, nameštaj')).toBe(true)
    expect(pass('Demart Serbia', 'Pergole, tende, klizni krov')).toBe(true)
  })
  it('passes quote-based furniture shops from the new batch', () => {
    for (const n of ['Nameštaj Vitax', 'Salon nameštaja SitForm', 'Linea Milanovic - luxury furniture & interiors', 'Nameštaj po meri | Furni Enterijeri']) expect(pass(n)).toBe(true)
  })
  it('2026-11-13: ecommerce niches pass — fashion, jewelry, underwear, bags, shoes, cosmetics, salons, cakes, textiles, decor, agriculture, wine, catering, toys, baby', () => {
    for (const n of ['sfashionshop.bn', 'Hirurški čelik Royal nakit', 'mare.underwear', 'Lux boutique', 'LuxeHair Srbija', 'Venčanice Sirena Beograd', 'Plemenita ulja', 'TORTA', 'Casa Jana Kućni Dekor', 'paletatextil', 'Stefan Farmer', 'Domestico ketering', 'Vinarija Grabak', 'Teddy Bears Belgrade', 'Na Klik Store', 'mb_laser_estetic_centar', 'Madam Estetik'])
      expect(pass(n), n).toBe(true)
  })
  it('has no niche whitelist: an unlisted business passes as "other"', () => {
    const r = profileFit({ name: 'Nešto d.o.o.', bio: 'Kreativna agencija', followers: 50000 })
    expect(r.pass).toBe(true); expect(r.vertical).toBe('other')
  })
  it('rejects chains, wholesale groups and anything over 200k followers (not owner-run SMBs)', () => {
    expect(profileFit({ name: 'Nameštaj Grupa', bio: 'veleprodaja nameštaja, grupa', followers: 60000 }).pass).toBe(false)
    expect(profileFit({ name: 'Nameštaj Gigant', bio: 'nameštaj', followers: 300000 }).pass).toBe(false)
    expect(profileFit({ name: 'Salon nameštaja', bio: 'preko 12 prodavnica širom Srbije', followers: 80000 }).pass).toBe(false)
    expect(profileFit({ name: 'Luxor Furniture', bio: 'Dostava širom Srbije', followers: 44000 }).pass).toBe(true)
    expect(pass('Mts', 'Telekom Srbija')).toBe(false)
  })
  it('rejects state, media, personal brands, commodity hospitality and party acts (no DM-sellable product)', () => {
    for (const n of ['МУП Републике Србије', 'Fondacija Mozzart', 'Великаши', 'standuprs', 'Balkan Party Band', 'Puls Generacije News & media', 'Hotel Jugoslavija', 'Restoran Dva Jelena', 'Narodno pozoriste', 'DJ Marko', 'Pevac Petrović', 'Travel Agency Srbija'])
      expect(pass(n), n).toBe(false)
  })
  it('keeps Marco Dental, Bee Bike, TopDek, Elan Domis, Aluroll', () => {
    for (const [name, bio] of [['Bee Bike', 'KUPOVINA NA 24 RATE E-MOBILITY'], ['TopDek', 'Premium WPC sistemi, fasade, podovi, ograde'], ['Elan Domis', 'Salon 1: TUTIN'], ['Marco Dental Tourism', 'Besplatan ONLINE PREGLED pre dolaska u ordinaciju'], ['Aluroll doo', 'Roletne, komarnici, garažna vrata']])
      expect(pass(name, bio), name).toBe(true)
  })
  it('a dental clinic classified as klinika_wellness still passes', () => {
    expect(profileFit({ name: 'Up Dent Belgrade', niche: 'klinika_wellness', followers: 28000 }).pass).toBe(true)
  })
})
