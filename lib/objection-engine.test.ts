import { describe, it, expect } from "vitest"
import { groundWorries, groundedRatio, normalizeStrategy } from "./objection-engine.mjs"

const evidence = "Stambeni kontejneri. Cena uključuje beli panel debljine 4cm, kupatilo i kompletnu električnu instalaciju. Prevoz i montaža do mesta koje ste izabrali. Pratimo ISO standarde proizvodnje."
const w = (agent_reply: string, id = "price") => ({ id, customer_says: "Hmm, skupo.", why: "x", approach: "restate_value", agent_reply })
const keep = (reply: string, terms = {}) => groundWorries([w(reply)], { evidenceText: evidence, terms }).length === 1

describe("groundWorries", () => {
  it("keeps a reply made of facts the business states", () => {
    expect(keep("Cena uključuje prevoz i montažu do mesta koje ste izabrali.")).toBe(true)
  })
  it("drops instalments the business never offered", () => {
    expect(keep("Možemo da dogovorimo plaćanje na rate do 24 meseca.")).toBe(false)
  })
  it("allows instalments only when the terms list financing", () => {
    const terms = { financing: "plaćanje na rate do 12 meseci" }
    // in the pipeline the terms are part of the evidence the reply is checked against
    const ok = groundWorries([w("Plaćanje na rate do 12 meseci.")], { evidenceText: `${evidence} ${JSON.stringify(terms)}`, terms })
    expect(ok.length).toBe(1)
  })
  it("drops discounts, praise, unknown numbers and unknown standards", () => {
    expect(keep("Dobijate popust ako odlučite danas.")).toBe(false)
    expect(keep("Naši kontejneri su vrhunskog kvaliteta i idealni za svaku namenu.")).toBe(false)
    expect(keep("Isporuka je za 14 dana.")).toBe(false)
    expect(keep("Pratimo CE oznake proizvodnje.")).toBe(false)
  })
  it("drops a reply that asks a question (a separate line asks for the next step)", () => {
    expect(keep("Cena uključuje kupatilo, da li Vam to odgovara?")).toBe(false)
  })
})

describe("groundedRatio", () => {
  it("is 1 for the business's own words and low for invented praise", () => {
    const folded = evidence.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    expect(groundedRatio("Cena uključuje kupatilo i električnu instalaciju", folded)).toBeGreaterThan(0.9)
    expect(groundedRatio("Besprekoran dizajn i luksuzna završnica", folded)).toBeLessThan(0.5)
  })
})

describe("normalizeStrategy", () => {
  it("falls back to the supplied model when the answer is unusable", () => {
    const s = normalizeStrategy(null, { evidenceText: evidence, terms: {}, fallbackModel: "quote" as never })
    expect(s.sales_model).toBe("quote")
    expect(s.worries).toEqual([])
  })
  it("drops call-prep that is advice instead of a lever", () => {
    const s = normalizeStrategy({ sales_model: "quote", call_prep: [
      { lever: "Highlight the ISO standards in all marketing materials", why: "x" },
      { lever: "Let buyers pay a deposit and the balance on delivery", why: "x" },
    ] }, { evidenceText: evidence, terms: {} })
    expect(s.call_prep.map((c: { lever: string }) => c.lever)).toEqual(["Let buyers pay a deposit and the balance on delivery"])
  })
})
