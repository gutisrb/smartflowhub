import { describe, it, expect } from "vitest"
import { extractListings, parsePrice } from "./catalog-extract.mjs"

const card = (name: string, price: string, extra = "") => `<div class="jtc"><a href="#"><img src="/img/${name}.jpg"></a><div class="b"><p>Polovan</p><h3>${name}</h3><ul><li>128GB</li></ul><span class="p">${price}</span>${extra}</div></div>`
const page = (cards: string) => `<html><body><nav><h2>Meni</h2><a>Servis 25 €</a></nav><div class="grid">${cards}</div></body></html>`

describe("parsePrice", () => {
  it("reads Serbian, WooCommerce and euro formats", () => {
    expect(parsePrice("1.990,00 RSD")?.rsd).toBe(1990)
    expect(parsePrice("57,300.00 RSD")?.rsd).toBe(57300)
    expect(parsePrice("130 €")?.rsd).toBe(130 * 117)
    expect(parsePrice("od 25.000 din")?.from).toBe(true)
  })
  it("does not mistake a bare number for a price", () => {
    expect(parsePrice("2026")).toBeNull()
    expect(parsePrice("128GB")).toBeNull()
  })
})

describe("extractListings", () => {
  const html = page([["iPhone 11", "130 €"], ["Galaxy S24", "550 €"], ["Pixel 8", "300 €"], ["Honor 400", "180 €"], ["Redmi 13", "120 €"]].map(([n, p]) => card(n, p)).join(""))
  it("finds repeated product cards structurally, with price and image", () => {
    const items = extractListings(html, "https://shop.rs/")
    expect(items.map((i: { name: string }) => i.name)).toEqual(["iPhone 11", "Galaxy S24", "Pixel 8", "Honor 400", "Redmi 13"])
    expect(items[0].price.rsd).toBe(130 * 117)
    expect(items[0].image).toBe("https://shop.rs/img/iPhone 11.jpg".replace(" ", "%20"))
  })
  it("ignores a lone price in the navigation and pages with fewer than four cards", () => {
    expect(extractListings(page(card("iPhone 11", "130 €") + card("Pixel 8", "300 €")))).toEqual([])
  })
})
