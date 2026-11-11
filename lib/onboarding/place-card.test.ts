import { describe, it, expect } from "vitest"
import { placeCard, CARD_MAX, CARD_MIN } from "./place-card"

const vp = { width: 1728, height: 1000, top: 64 }

describe("placeCard", () => {
  it("puts the card to the right of a centred chat thread", () => {
    const p = placeCard({ left: 632, top: 280, width: 660, height: 690 }, 340, vp)
    expect(p.side).toBe("right")
    expect(p.left).toBe(632 + 660 + 20)
    expect(p.width).toBeLessThanOrEqual(CARD_MAX)
  })
  it("uses the narrow lane beside a wide customer file", () => {
    const p = placeCard({ left: 324, top: 60, width: 1080, height: 880 }, 340, vp)
    expect(p.side).toBe("right")
    expect(p.width).toBeGreaterThanOrEqual(CARD_MIN)
  })
  it("goes below a full-width table row", () => {
    const p = placeCard({ left: 106, top: 313, width: 1582, height: 74 }, 340, vp)
    expect(p.side).toBe("below")
    expect(p.top).toBe(313 + 74 + 20)
    expect(p.left + p.width).toBeLessThanOrEqual(1728 - 16)
  })
  it("never leaves the viewport vertically", () => {
    const p = placeCard({ left: 100, top: 900, width: 300, height: 60 }, 340, vp)
    expect(p.top + 340).toBeLessThanOrEqual(1000 - 16)
  })
  it("tucks into the corner when the highlight fills the screen", () => {
    const p = placeCard({ left: 80, top: 70, width: 1630, height: 920 }, 340, vp)
    expect(p.side).toBe("inside")
    expect(p.left + p.width).toBeLessThanOrEqual(1728 - 16)
    expect(p.top + 340).toBeLessThanOrEqual(1000 - 16)
  })
})
