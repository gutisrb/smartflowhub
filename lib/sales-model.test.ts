import { describe, it, expect } from "vitest"
import { salesModelOf, nicheForModel, normalizeSalesModel } from "./sales-model.mjs"

describe("salesModelOf", () => {
  it("separates booking, quote and order businesses", () => {
    expect(salesModelOf("dental")).toBe("booking")
    expect(salesModelOf("fitness")).toBe("booking")
    expect(salesModelOf("quote")).toBe("quote")
    expect(salesModelOf("furniture")).toBe("order")
    expect(salesModelOf("ecommerce")).toBe("order")
    expect(salesModelOf(null)).toBe("order")
  })
  it("keeps pergole on its own (they do site visits and keep a calendar)", () => {
    expect(salesModelOf("pergole")).toBe("order")
  })
})

describe("nicheForModel", () => {
  it("re-keys a niche only when the model needs it", () => {
    expect(nicheForModel("booking", "dental")).toBe("dental")
    expect(nicheForModel("booking", "auto")).toBe("services")
    expect(nicheForModel("quote", "services")).toBe("quote")
    expect(nicheForModel("order", "furniture")).toBe("furniture")
    expect(nicheForModel("order", "services")).toBe("ecommerce")
  })
  it("rejects an unknown model", () => {
    expect(normalizeSalesModel("Quote")).toBe("quote")
    expect(normalizeSalesModel("nonsense")).toBeNull()
  })
})
