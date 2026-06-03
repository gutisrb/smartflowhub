import { describe, it, expect } from "vitest"
import { resolveModuleCopy, DEFAULT_MODULE_COPY } from "./copy"

describe("resolveModuleCopy", () => {
  it("prefers stored per-brand copy when present", () => {
    const stored = { welcome: "w", finish: "f", modules: { "agent-leads": "CUSTOM" } }
    expect(resolveModuleCopy(stored, "agent-leads")).toBe("CUSTOM")
  })
  it("falls back to the per-module default when stored is missing the key", () => {
    const stored = { welcome: "w", finish: "f", modules: {} }
    expect(resolveModuleCopy(stored, "agent-leads")).toBe(DEFAULT_MODULE_COPY["agent-leads"])
  })
  it("falls back to default when stored is null", () => {
    expect(resolveModuleCopy(null, "calendar")).toBe(DEFAULT_MODULE_COPY["calendar"])
  })
  it("falls back to a generic string for an unknown module key", () => {
    expect(resolveModuleCopy(null, "totally-unknown")).toBe("Ovde upravljate ovim delom Vašeg sistema.")
  })
})
