import { describe, it, expect } from "vitest"
import { stageFor, pickHeroItem, whereLine, storeStory, productQAFor, trackingQA } from "./shop-story.mjs"

const catalog = [
  { name: "Servis ekrana", category: "Servis", price_min: null },
  ...[120, 300, 450, 600, 900].map((p, i) => ({ name: `iPhone ${11 + i}`, category: "Polovni telefoni", price_min: p * 117, image_url: `https://x/${i}.jpg`, description: "Polovan · baterija 90%" })),
]
const sheet = {
  booking: { state: "none", quote: "Dođi bez zakazivanja" },
  location: { address: "Jurija Gagarina 151a, Novi Beograd", hours: ["Monday,Tuesday,Wednesday,Thursday,Friday 10:00-20:00"] },
  offers: [{ name: "Otkup telefona", kind: "buyback", reply: "Isplata je odmah, u gotovini." }],
}

describe("stageFor", () => {
  it("moves an order through its delivery stages with age", () => {
    expect(stageFor("Naručio", 60, "courier")).toBe("Obrađuje se")
    expect(stageFor("Naručio", 3 * 24 * 60, "courier")).toBe("Poslato")
    expect(stageFor("Isporučeno", 60, "delivery")).toBe("Isporučeno")
  })
  it("gives a store visit no delivery stage", () => {
    expect(stageFor("Naručio", 60, "in_store")).toBeNull()
  })
})

describe("store story", () => {
  it("picks a mid-priced photographed item, never a service row without a price", () => {
    expect(pickHeroItem(catalog)?.name).toBe("iPhone 13")
  })
  it("states the address and hours from the site, and no booking", () => {
    expect(whereLine(sheet)).toBe("Radnja je u Jurija Gagarina 151a, Novi Beograd, radno vreme pon–pet 10–20h.")
    const s = storeStory({ catalog, sheet, strategy: { worries: [{ id: "price", agent_reply: "Stari telefon možete dati u zamenu." }] } })
    const text = s!.sale.msgs.map((m: unknown[]) => m[1]).join(" ")
    expect(text).toContain("Zakazivanje nije potrebno")
    expect(text).toContain("Stari telefon možete dati u zamenu")
    expect(text).not.toMatch(/dostav|kurir|pouzeć|termin/i)
    expect(s!.sale.crm.status).toBe("Naručio")
  })
})

describe("productQAFor", () => {
  const qs = (fulfilment: string, niche = "ecommerce") => productQAFor({ terms: {}, niche, catalog, sheet, fulfilment }).map((x: string[]) => x[0]).join(" | ")
  it("never asks a store about delivery, nor a phone shop about size M", () => {
    expect(qs("in_store")).not.toMatch(/dostav|veličini/i)
    expect(qs("in_store")).toMatch(/Gde se nalazite|Kako ide otkup/)
  })
  it("asks a shop that ships about delivery, and only clothes about sizes", () => {
    expect(qs("courier")).toMatch(/dostava/)
    expect(qs("courier", "fashion")).toMatch(/veličini M/)
    expect(qs("delivery", "furniture")).not.toMatch(/veličini M/)
  })
})

describe("trackingQA", () => {
  it("answers from the stage and names only a courier the site names", () => {
    expect(trackingQA({ fulfilment: "courier", couriers: ["D Express"] })?.[1]).toContain("D Express")
    expect(trackingQA({ fulfilment: "courier" })?.[1]).not.toMatch(/\(/)
    expect(trackingQA({ fulfilment: "in_store" })).toBeNull()
  })
})
