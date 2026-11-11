import { describe, it, expect } from "vitest"
import { bucketFor, bucketForRow, bucketLabel, wonLabel, displayStatus, setStatusLabels } from "./lead-status"

const now = Date.parse("2026-10-25T12:00:00Z")
const ago = (h: number) => new Date(now - h * 3_600_000).toISOString()

describe("bucketFor", () => {
  it("puts anything flagged or complained about first", () => {
    expect(bucketFor({ humanNeeded: true, crmStatus: "Zakazano", now })).toBe("needs_human")
    expect(bucketFor({ crmStatus: "Reklamacija", now })).toBe("needs_human")
    expect(bucketFor({ crmStatus: "Intervencija", now })).toBe("needs_human")
  })
  it("maps every won status", () => {
    for (const s of ["Zakazano", "Završeno", "Naručio", "Poručio", "Isporučeno", "Zaposlen", "Ponuda"]) expect(bucketFor({ crmStatus: s, now })).toBe("won")
  })
  it("marks silence after the last message, whoever wrote it", () => {
    expect(bucketFor({ crmStatus: "Zainteresovan", lastAt: ago(2), now })).toBe("active")
    expect(bucketFor({ crmStatus: "Zainteresovan", lastAt: ago(26), now })).toBe("no_reply")
    expect(bucketFor({ crmStatus: "Zainteresovan", lastAt: ago(24 * 8), now })).toBe("lost")
    expect(bucketFor({ crmStatus: "Novi", lastAt: ago(30), now })).toBe("no_reply")
  })
  it("keeps a thread waiting on a person in Intervencija however old", () => {
    expect(bucketFor({ humanNeeded: true, lastAt: ago(24 * 9), now })).toBe("needs_human")
  })
  it("never lets silence override a won or flagged lead", () => {
    expect(bucketFor({ crmStatus: "Zakazano", lastAt: ago(24 * 30), now })).toBe("won")
  })
  it("works for tenants without a CRM row", () => {
    expect(bucketFor({ lastAt: ago(1), messageCount: 2, now })).toBe("new")
    expect(bucketFor({ lastAt: ago(1), messageCount: 6, now })).toBe("active")
    expect(bucketFor({ humanNeeded: true, now })).toBe("needs_human")
  })
  it("reads CRM rows by their last activity", () => {
    expect(bucketForRow({ status: "Zainteresovan", created_at: ago(30) }, now)).toBe("no_reply")
    expect(bucketForRow({ status: "Zakazano", created_at: ago(300) }, now)).toBe("won")
  })
})

describe("labels", () => {
  it("names the win after the business", () => {
    expect(wonLabel("dental")).toBe("Zakazano")
    expect(wonLabel("furniture")).toBe("Naručeno")
    expect(wonLabel(null, "Zaposlen")).toBe("Zaposlen")
    expect(wonLabel("quote")).toBe("Ponuda")
    expect(wonLabel("quote", "Naručio")).toBe("Naručeno")
    expect(bucketLabel("no_reply")).toBe("Bez odgovora")
    // quote businesses store the conversion as Zakazano (DB constraint) and show it as Ponuda
    expect(displayStatus("Zakazano", "quote")).toBe("Ponuda")
    expect(displayStatus("Zakazano", "dental")).toBe("Zakazano")
    expect(displayStatus("Naručio", "quote")).toBe("Naručio")
  })
})

describe("per-business wording", () => {
  it("uses the business's own words for the stored status, and resets cleanly", () => {
    setStatusLabels({ Naručio: "Najavio dolazak", Isporučeno: "Kupio u radnji" }, "Najavili dolazak")
    expect(displayStatus("Naručio", "ecommerce")).toBe("Najavio dolazak")
    expect(wonLabel("ecommerce", "Isporučeno")).toBe("Kupio u radnji")
    expect(bucketLabel("won", "ecommerce")).toBe("Najavili dolazak")
    setStatusLabels(null)
    expect(displayStatus("Naručio", "ecommerce")).toBe("Naručio")
    expect(wonLabel("ecommerce")).toBe("Naručeno")
  })
})
