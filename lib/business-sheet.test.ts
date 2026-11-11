import { describe, it, expect } from "vitest"
import { verifySheet, deriveFlows, statusLabelsFor, extractSheet, detectLocation, factsOnlySheet, formatHours } from "./business-sheet.mjs"

const SITE = "Otkup, prodaja i servis mobilnih telefona. Dođi bez zakazivanja – telefon pregledamo pred tobom. Na stanju u radnji: telefoni koje možete kupiti danas. Pitaj na Viber da li je još na stanju. Online otkup, kurirom, posle slanja i provere."
const raw = {
  offers: [
    { name: "Polovni telefoni", kind: "product", how_bought: "reserve_for_pickup", fulfilment: "in_store", quote: "Na stanju u radnji: telefoni koje možete kupiti danas." },
    { name: "Servis", kind: "service", how_bought: "reserve_slot", fulfilment: "in_store", quote: "Dođi bez zakazivanja – telefon pregledamo pred tobom." },
    { name: "Izmišljena dostava", kind: "product", how_bought: "order", fulfilment: "courier", quote: "Šaljemo brzom poštom širom Srbije." },
  ],
  primary: 0,
}

describe("verifySheet", () => {
  const sheet = verifySheet(raw, { evidenceText: SITE })
  it("drops an offer whose quote is not on the site", () => {
    expect(sheet.offers.map((o: { name: string }) => o.name)).toEqual(["Polovni telefoni", "Servis"])
  })
  it("a stated 'bez zakazivanja' wins over the model, and demotes reserve_slot", () => {
    expect(sheet.booking.state).toBe("none")
    expect(sheet.offers[1].how_bought).toBe("walk_in")
  })
  it("never invents a courier", () => {
    expect(sheet.shipping.couriers).toEqual([])
  })
})

describe("deriveFlows", () => {
  it("gives JetSet no calendar and no order tracking", () => {
    const f = deriveFlows(verifySheet(raw, { evidenceText: SITE }), "ecommerce")
    expect(f.calendar).toBe(false)
    expect(f.orderTracking).toBe(false)
    expect(f.inStore).toBe(true)
    expect(f.walkIn).toBe(true)
    expect(f.reason.calendar).toMatch(/no booking/)
  })
  it("keeps the appointment for a dental clinic whose site is silent about booking", () => {
    const f = deriveFlows(verifySheet({ offers: [] }, { evidenceText: "Implantati i krunice." }), "dental")
    expect(f.calendar).toBe(true)
  })
  it("but not for a furniture shop whose site is silent", () => {
    expect(deriveFlows(verifySheet({ offers: [] }, { evidenceText: "Sofe i garniture." }), "furniture").calendar).toBe(false)
  })
  it("turns on order tracking for a product that ships", () => {
    const s = verifySheet({ offers: [{ name: "Sto", kind: "product", how_bought: "order", fulfilment: "courier", quote: "Isporuka kurirskom službom širom Srbije." }] }, { evidenceText: "Isporuka kurirskom službom širom Srbije. Stolovi." })
    expect(deriveFlows(s, "furniture").orderTracking).toBe(true)
  })
})

describe("statusLabelsFor", () => {
  it("gives a walk-in store its own words and leaves clinics and shipping shops alone", () => {
    expect(statusLabelsFor({ calendar: false, quote: false, inStore: true, orderTracking: false }).labels.Naručio).toBe("Najavio dolazak")
    expect(statusLabelsFor({ calendar: true, quote: false, inStore: false, orderTracking: false }).labels).toEqual({})
    expect(statusLabelsFor({ calendar: false, quote: false, inStore: false, orderTracking: true }).labels).toEqual({})
  })
})

describe("extractSheet", () => {
  it("returns failed, not a decision, when the model call errors", async () => {
    const bad = { chat: { completions: { create: async () => { throw new Error("429 no credits") } } } }
    const r: any = await extractSheet(bad, { name: "X", evidenceText: SITE })
    expect(r.failed).toBe(true)
  })
  it("verifies what the model returns", async () => {
    const ok = { chat: { completions: { create: async () => ({ choices: [{ message: { content: JSON.stringify(raw) } }] }) } } }
    const r: any = await extractSheet(ok, { name: "X", evidenceText: SITE })
    expect(r.offers.length).toBe(2)
  })
})

describe("detectLocation", () => {
  it("reads address and hours from JSON-LD", () => {
    const html = `<script type="application/ld+json">{"@graph":[{"@type":"Place"},{"@type":"Store","address":{"streetAddress":"Jurija Gagarina 151a","addressLocality":"Novi Beograd"},"openingHours":["Monday,Tuesday 10:00-20:00"]}]}</script>`
    expect(detectLocation(html)).toEqual({ address: "Jurija Gagarina 151a, Novi Beograd", hours: ["Monday,Tuesday 10:00-20:00"] })
  })
})

describe("factsOnlySheet", () => {
  it("reads a cart and a delivery sentence, nothing more", () => {
    const s = factsOnlySheet({ evidenceText: "Stolovi za šminkanje. Dodaj u korpu i plati pouzećem. Ličnu dostavu vršimo u krugu od 150 km." })
    expect(s.offers.length).toBe(1)
    expect(s.offers[0].fulfilment).toBe("courier")
    expect(s.source).toBe("facts")
    expect(deriveFlows(s, "furniture").orderTracking).toBe(true)
  })
  it("states nothing for a site without a cart", () => {
    expect(factsOnlySheet({ evidenceText: "Implantati i krunice. Zakažite pregled." }).offers).toEqual([])
  })
})

describe("formatHours", () => {
  it("formats schema.org opening hours in Serbian", () => {
    expect(formatHours(["Monday,Tuesday,Wednesday,Thursday,Friday 10:00-20:00", "Saturday 10:00-15:00"])).toBe("pon–pet 10–20h, sub 10–15h")
    expect(formatHours(["Mo-Fr 10-20"])).toBeNull()
  })
})
