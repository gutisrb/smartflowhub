import { describe, it, expect } from "vitest"
import { expandTourSlots, tourHeroFor, isServiceNiche } from "./tour-slots"

describe("expandTourSlots", () => {
  it("expands a full module set to 6 beats in order, sub-beats reusing the parent moduleKey", () => {
    const out = expandTourSlots(["social-chatbot", "agent-leads", "calendar", "chatbot-analytics"])
    expect(out.map(o => o.slot)).toEqual([
      "inbox", "inbox-intervencija", "crm", "termini", "analitika", "offer",
    ])
    expect(out[0].moduleKey).toBe("social-chatbot")
    expect(out[1].moduleKey).toBe("social-chatbot") // sub-beat stays on the inbox module
    expect(out[2].moduleKey).toBe("agent-leads")
    expect(out[5].moduleKey).toBe("ponuda")          // offer fallback always appended
  })
  it("omits sub-beats when the parent slot has no module", () => {
    const out = expandTourSlots(["calendar"])
    expect(out.map(o => o.slot)).toEqual(["termini", "offer"])
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
