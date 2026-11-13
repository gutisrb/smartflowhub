import { describe, it, expect } from "vitest"
// voice_read.mjs runs its CLI only when executed directly; importing it gives the pure judge() and the controls.
import { judge, CONTROLS } from "../voice_read.mjs"

const controlsRight = CONTROLS.map((c) => ({ id: c.id, score: c.want === "bad" ? 1 : 5 }))
const controlsWrong = CONTROLS.map((c) => ({ id: c.id, score: 4 })) // a reader that calls "Beležim: …" fine is not a reader

describe("voice read judge (2026-11-12: v1 flagged different lines every run and the standard's own good example)", () => {
  it("a read that scores the known-bad lines as fine is discarded; no valid read is inconclusive, never ok", () => {
    const v = judge([[...controlsWrong, { id: "hero1#3", score: 5 }]], ["hero1#3"])
    expect(v.inconclusive).toBe(true)
    expect(v.flags).toEqual([])
  })
  it("flags a line only when the median of valid reads is <= 2 (one noisy read does not flag)", () => {
    const reads = [
      [...controlsRight, { id: "hero3#7", score: 2, why: "ticket", rewrite: "x" }, { id: "hero1#5", score: 1, why: "recap" }],
      [...controlsRight, { id: "hero3#7", score: 4 }, { id: "hero1#5", score: 2, why: "recap" }],
      [...controlsRight, { id: "hero3#7", score: 5 }, { id: "hero1#5", score: 1, why: "recap" }],
    ]
    const v = judge(reads, ["hero3#7", "hero1#5"])
    expect(v.valid).toBe(3)
    expect(v.flags.map((f) => f.id)).toEqual(["hero1#5"])
  })
  it("median 3 is advisory, not a block", () => {
    const r = [...controlsRight, { id: "qa#1", score: 3, why: "stiff" }]
    const v = judge([r, r], ["qa#1"])
    expect(v.flags).toEqual([])
    expect(v.advisory.map((a) => a.id)).toEqual(["qa#1"])
  })
  it("one valid read is not enough: inconclusive", () => {
    const v = judge([[...controlsRight, { id: "hero1#3", score: 5 }], [...controlsWrong]], ["hero1#3"])
    expect(v.inconclusive).toBe(true)
  })

  it("tolerates one misjudged control (reader is slightly over-strict on c5's neutral close pattern)", () => {
    const almostRight = CONTROLS.map((c) => ({ id: c.id, score: c.want === "bad" ? 1 : (c.id === "c5" ? 2 : 5) }))
    const reads = [[...almostRight, { id: "hero1#1", score: 5 }], [...almostRight, { id: "hero1#1", score: 5 }]]
    const v = judge(reads, ["hero1#1"])
    expect(v.inconclusive).toBe(false)
    expect(v.valid).toBe(2)
  })
  it("the controls include the line Nikola rejected and a good line of the same kind", () => {
    expect(CONTROLS.some((c) => c.want === "bad" && /^Beležim/.test(c.agent))).toBe(true)
    expect(CONTROLS.some((c) => c.want === "good")).toBe(true)
  })
})
