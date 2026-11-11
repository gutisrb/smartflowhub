import { describe, it, expect } from "vitest"
import { expandTourSlots, tourHeroFor, tourFileFor, cardAnchorFor, isServiceNiche } from "./tour-slots"

describe("expandTourSlots", () => {
  it("expands a full module set to 8 beats in order, sub-beats reusing the parent moduleKey", () => {
    const out = expandTourSlots(["social-chatbot", "agent-leads", "calendar", "chatbot-analytics"])
    expect(out.map(o => o.slot)).toEqual([
      "inbox", "inbox-intervencija", "inbox-odgovor", "crm", "crm-izgubljen", "termini", "analitika", "offer",
    ])
    expect(out[0].moduleKey).toBe("social-chatbot")
    expect(out[1].moduleKey).toBe("social-chatbot") // sub-beat stays on the inbox module
    expect(out[2].moduleKey).toBe("social-chatbot") // reply beat also stays on the inbox
    expect(out[3].moduleKey).toBe("agent-leads")
    expect(out[4].moduleKey).toBe("agent-leads")     // the lost-customer beat stays in the CRM
    expect(out[7].moduleKey).toBe("ponuda")          // offer fallback always appended
  })
  it("omits sub-beats when the parent slot has no module", () => {
    const out = expandTourSlots(["calendar"])
    expect(out.map(o => o.slot)).toEqual(["termini", "offer"])
  })
  it("includes the catalogue stop only when the tenant has that module", () => {
    const without = expandTourSlots(["social-chatbot", "agent-leads"])
    expect(without.map(o => o.slot)).not.toContain("katalog")
    const withCat = expandTourSlots(["social-chatbot", "agent-leads", "agent-database"])
    expect(withCat.map(o => o.slot)).toEqual([
      "inbox", "inbox-intervencija", "inbox-odgovor", "crm", "crm-izgubljen", "katalog", "offer",
    ])
  })
  it("first matching module wins a slot", () => {
    const out = expandTourSlots(["business-crm", "agent-leads"])
    expect(out.find(o => o.slot === "crm")!.moduleKey).toBe("business-crm")
  })
})

describe("tourHeroFor", () => {
  it("maps main-hero slots by niche type", () => {
    expect(tourHeroFor("inbox", true)).toBe("Marija Jović")
    expect(tourHeroFor("crm", false)).toBe("Stefan Ilić")
    expect(tourHeroFor("termini", false)).toBe("Stefan Ilić")
  })
  it("maps the intervention beat to the intervention hero", () => {
    expect(tourHeroFor("inbox-intervencija", true)).toBe("Dragana Simić")
    expect(tourHeroFor("inbox-intervencija", false)).toBe("Jelena Marić")
    // the reply beat continues that same escalated thread
    expect(tourHeroFor("inbox-odgovor", true)).toBe("Dragana Simić")
  })
  it("returns null for slots without a hero and for null slot", () => {
    expect(tourHeroFor("analitika", true)).toBeNull()
    expect(tourHeroFor("offer", false)).toBeNull()
    expect(tourHeroFor(null, true)).toBeNull()
  })
})

describe("isServiceNiche", () => {
  it("recognizes service niches case-insensitively; product/unknown/null are false", () => {
    expect(isServiceNiche("dental")).toBe(true)
    expect(isServiceNiche("Dental")).toBe(true)
    expect(isServiceNiche("ecommerce")).toBe(false)
    expect(isServiceNiche(null)).toBe(false)
  })
})

describe("crm beats", () => {
  it("opens the booked customer first, then the one who left", () => {
    expect(tourFileFor("crm", true)).toBe("Marija Jović")
    expect(tourFileFor("crm-izgubljen", true)).toBe("Nikola Perić")
    expect(tourFileFor("crm-izgubljen", false)).toBe("Jelena Marić")
    expect(tourFileFor("termini", true)).toBeNull()
  })
  it("keeps the card beside a steady target where the ring moves around", () => {
    expect(cardAnchorFor("inbox-intervencija")).toBe('[data-tour-focus="chat-thread"]')
    expect(cardAnchorFor("crm-izgubljen")).toBe('[data-tour-focus="lead-file"]')
    expect(cardAnchorFor("analitika")).toBeNull()
  })
})
