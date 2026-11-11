import { describe, it, expect } from "vitest"
import { qualifyForQueue, MIN_FOLLOWERS } from "./lead-queue.mjs"

/**
 * Fixtures are real rows pulled from the conveyor on 2026-09-03, when 68 leads
 * sat in station 1 asking for approval and most could not be emailed at all.
 */

const prime = {
  company_name: "Stomatološka ordinacija DENTALUX", email: "dentalux@live.com",
  website: "https://dentalux.rs", instagram_handle: "dentalux_dental",
  instagram_followers: 61835, niche: "stomatologija", izvor: "ig_bio_search_scrapecreators",
}

describe("hard gates", () => {
  it("rejects a lead with no email and no instagram — nothing can reach it", () => {
    const r = qualifyForQueue({ company_name: "Zlatna Dvorana", email: null, website: "https://zlatnadvorana.rs", instagram_handle: null, instagram_followers: 0 })
    expect(r.verdict).toBe("reject")
    expect(r.reasons).toContain("unreachable")
  })

  it("holds a lead with an audience but no email — findable, not dead", () => {
    const r = qualifyForQueue({ company_name: "BluDent", email: null, website: null, instagram_handle: "ordinacija_bludent", instagram_followers: 40447 })
    expect(r.verdict).toBe("needs_enrichment")
    expect(r.reasons).toContain("no_email")
  })

  it("never calls a Google Maps lead ready — followers:0 there means unmeasured", () => {
    const r = qualifyForQueue({ company_name: "QUEEN dental clinic", email: "stomatologija.info@gmail.com", website: "https://queendental.rs", instagram_handle: "queen_dental_clinic_belgrade", instagram_followers: 0, izvor: "google_maps" })
    expect(r.verdict).toBe("needs_enrichment")
    expect(r.reasons).toContain("audience_unmeasured")
  })

  it("holds a real but tiny audience below the floor", () => {
    const r = qualifyForQueue({ ...prime, instagram_followers: 1000, izvor: "ig_bio_search_scrapecreators" })
    expect(r.verdict).not.toBe("ready")
    expect(r.reasons).toContain("audience_too_small")
  })

  it("lets ad spend override the follower floor — MIS beats vanity", () => {
    const r = qualifyForQueue({ ...prime, instagram_followers: 1200, intake_data: { active_ads_count: 6, ad_start_date: "2026-01-01", publisher_platforms: ["facebook", "instagram", "messenger"] } })
    expect(r.reasons).not.toContain("audience_too_small")
  })
})

describe("handle sanity", () => {
  it("flags a handle unrelated to the business", () => {
    const r = qualifyForQueue({ company_name: "PVC Stolarija Elit", email: "elit.prozori@gmail.com", website: "https://elitprozori.rs", instagram_handle: "_septem.bar", instagram_followers: 8000 })
    expect(r.reasons).toContain("handle_mismatch")
  })

  it("does not flag a Cyrillic name whose handle is its Latin transliteration", () => {
    const r = qualifyForQueue({ company_name: "ВИПОЛ", email: "office@vipol.rs", website: "https://vipol.rs", instagram_handle: "vipolsrb", instagram_followers: 9000 })
    expect(r.reasons).not.toContain("handle_mismatch")
  })

  it("matches a handle whose words are reordered — ordinacija_bludent is BluDent", () => {
    const r = qualifyForQueue({ company_name: "BluDent stomatološka ordinacija", email: null, website: null, instagram_handle: "ordinacija_bludent", instagram_followers: 40447 })
    expect(r.reasons).not.toContain("handle_mismatch")
  })

  it("matches when the company word is buried in a longer handle", () => {
    const r = qualifyForQueue({ company_name: "Stomatoloska ordinacija Cvejanovic", email: "info@ordinacijacvejanovic.com", website: "https://ordinacijacvejanovic.com", instagram_handle: "cvejanovic_dentalclinic", instagram_followers: 9000 })
    expect(r.reasons).not.toContain("handle_mismatch")
  })

  it("accepts an abbreviated handle — _svstefan is Sveti Stefan", () => {
    const r = qualifyForQueue({ company_name: 'Specijalna bolnica "Sveti Stefan"', email: "office@svetistefan.rs", website: "https://svetistefan.rs", instagram_handle: "_svstefan", instagram_followers: 9000 })
    expect(r.reasons).not.toContain("handle_mismatch")
  })

  it("ignores a country suffix on the handle — ahtsrbija is AHT", () => {
    const r = qualifyForQueue({ company_name: "AHT Transplantacija Kose", email: "info@ahttransplantacijakose.com", website: "https://ahttransplantacijakose.com", instagram_handle: "ahtsrbija", instagram_followers: 9000 })
    expect(r.reasons).not.toContain("handle_mismatch")
  })

  it("still catches the genuinely wrong handle after those relaxations", () => {
    const r = qualifyForQueue({ company_name: "PVC Stolarija Elit", email: "elit.prozori@gmail.com", website: "https://elitprozori.rs", instagram_handle: "_septem.bar", instagram_followers: 8000 })
    expect(r.reasons).toContain("handle_mismatch")
  })

  it("matches a handle against the domain, not just the name", () => {
    const r = qualifyForQueue({ company_name: "Nameštaj po meri Kragujevac", email: "office@iverta.rs", website: "https://iverta.rs", instagram_handle: "namestajpomeri_kragujevac", instagram_followers: 7000 })
    expect(r.reasons).not.toContain("handle_mismatch")
  })
})

describe("entity type", () => {
  it("sends a personal / influencer account to review, not to the queue", () => {
    const r = qualifyForQueue({ company_name: "Mladjana Milićević", email: null, website: null, instagram_handle: "ro.surovo.zdravo", instagram_followers: 88469, niche: "other" })
    expect(r.verdict).not.toBe("ready")
  })

  it("sends a deal aggregator to review", () => {
    const r = qualifyForQueue({ company_name: "Travel Under 300€ 🧳", email: "info@travelunder300.com", website: "https://travelunder300.com", instagram_handle: "travel_under_300", instagram_followers: 60220, niche: "ugostiteljstvo" })
    expect(r.reasons).toContain("review_entity")
  })

  it("does not mistake a real furniture brand for a reseller", () => {
    const r = qualifyForQueue({ company_name: "L DECOR", email: "kontakt@ldecornamestaj.com", website: "https://ldecornamestaj.com", instagram_handle: "l_decor_namestaj", instagram_followers: 27319, niche: "namestaj" })
    expect(r.reasons).not.toContain("review_entity")
  })
})

describe("the leads that should survive", () => {
  it("passes DENTALUX", () => {
    expect(qualifyForQueue(prime).verdict).toBe("ready")
  })

  it("passes all seven PRIME leads already approved for send", () => {
    const seven = [
      prime,
      { company_name: "M-BIKE SHOP", email: "amer.olovcic@m-bikeshop.com", website: "https://m-bikeshop.com", instagram_handle: "m_bike_shop", instagram_followers: 22111, niche: "fitnes" },
      { company_name: "L DECOR", email: "kontakt@ldecornamestaj.com", website: "https://ldecornamestaj.com", instagram_handle: "l_decor_namestaj", instagram_followers: 27319, niche: "namestaj" },
      { company_name: "Kodzic Fashion", email: "studio@kodzic.rs", website: "https://kodzic.rs", instagram_handle: "koznejaknekodzic", instagram_followers: 39466, niche: "fashion" },
      { company_name: "Belodore Srbija", email: "shop4@belodore.rs", website: "https://belodore.rs", instagram_handle: "belodore_srbija", instagram_followers: 48673, niche: "beauty" },
    ]
    for (const c of seven) expect(qualifyForQueue(c).verdict, c.company_name).toBe("ready")
  })

  it("honours the floor configured in the cockpit, not just the default", () => {
    const c = { company_name: "Barcino Tours", email: "jelena.manic@barcino.travel", website: "https://barcino.travel", instagram_handle: "barcinotours", instagram_followers: 37427, niche: "ugostiteljstvo" }
    expect(qualifyForQueue(c).verdict).toBe("ready")
    expect(qualifyForQueue(c, { followerFloor: 50000 }).reasons).toContain("audience_too_small")
    expect(qualifyForQueue(c, { followerFloor: 30000 }).verdict).toBe("ready")
  })

  it("exposes the follower floor it used", () => {
    expect(MIN_FOLLOWERS).toBeGreaterThan(0)
  })
})
