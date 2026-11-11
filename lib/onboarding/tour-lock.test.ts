import { describe, it, expect } from "vitest"
import { canChangeView, shouldSwallowKey } from "./tour-lock"

describe("canChangeView", () => {
  it("lets only the tour change the page while it runs", () => {
    expect(canChangeView(true, "user")).toBe(false)
    expect(canChangeView(true, "tour")).toBe(true)
  })
  it("leaves navigation alone when there is no tour", () => {
    expect(canChangeView(false, "user")).toBe(true)
  })
})

describe("shouldSwallowKey", () => {
  it("never lets Escape through", () => {
    expect(shouldSwallowKey("Escape", false)).toBe(true)
    expect(shouldSwallowKey("Escape", true)).toBe(true)
  })
  it("keeps Tab, Enter and Space away from the dimmed product", () => {
    for (const k of ["Tab", "Enter", " "]) expect(shouldSwallowKey(k, false)).toBe(true)
  })
  it("leaves the tour card its own keys and scrolling alone", () => {
    for (const k of ["Enter", " ", "ArrowLeft", "Tab"]) expect(shouldSwallowKey(k, true)).toBe(false)
    expect(shouldSwallowKey("ArrowLeft", false)).toBe(false)
    for (const k of ["ArrowDown", "PageDown", "Home"]) expect(shouldSwallowKey(k, false)).toBe(false)
  })
})
