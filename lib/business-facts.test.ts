import { describe, it, expect } from "vitest"
import { detectBooking, detectCouriers, quoteInText, sentencesOf } from "./business-facts.mjs"

// the sentences JetSet's homepage really contains
const JETSET = "JetSet radnja u Novom Beogradu Jurija Gagarina 151a. Dođi bez zakazivanja – telefon pregledamo pred tobom. Ako prihvatite ponudu, isplata je na licu mesta, bez zakazivanja i bez naknadnog obaranja cene. Zaki servis"

describe("detectBooking", () => {
  it("reads 'bez zakazivanja' as NO booking, with the sentence", () => {
    const r = detectBooking(JETSET)
    expect(r.booking).toBe("none")
    expect(r.quote).toContain("bez zakazivanja")
  })
  it("a negation outranks a booking link elsewhere on the page", () => {
    expect(detectBooking(`${JETSET} Zakaži servis online. Zakažite termin.`).booking).toBe("none")
  })
  it("finds a real booking instruction", () => {
    const r = detectBooking("Radimo sve dane. Zakažite termin online ili pozovite recepciju. Cenovnik je ispod.")
    expect(r.booking).toBe("required")
    expect(r.quote).toMatch(/Zakažite termin/)
  })
  it("reads the reversed form 'Zakazivanje nije potrebno'", () => {
    expect(detectBooking("Zakazivanje nije potrebno ni za kupovinu ni za otkup. Dolazite u toku radnog vremena.").booking).toBe("none")
  })
  it("reads a hotel's stay reservation as booking", () => {
    expect(detectBooking("Unesite datume i rezervišite svoj boravak iz snova u Prolom banji.").booking).toBe("required")
  })
  it("is unknown when the site is silent", () => {
    expect(detectBooking("Prodajemo sofe i garniture. Dostava u celoj Srbiji.").booking).toBe("unknown")
  })
})

describe("detectCouriers", () => {
  it("only names couriers the text names", () => {
    expect(detectCouriers("Isporuka putem D Express i AKS kurirskih službi")).toEqual(["D Express", "AKS"])
    expect(detectCouriers("Dostava u celoj Srbiji")).toEqual([])
  })
})

describe("quoteInText", () => {
  it("accepts a verbatim quote and rejects an invented one", () => {
    expect(quoteInText("Dođi bez zakazivanja – telefon pregledamo pred tobom", JETSET)).toBe(true)
    expect(quoteInText("Zakazivanje je obavezno za sve usluge", JETSET)).toBe(false)
  })
})

describe("sentencesOf", () => {
  it("splits on sentence ends", () => {
    expect(sentencesOf("Prva rečenica ide ovde. Druga rečenica je tu.").length).toBe(2)
  })
})
