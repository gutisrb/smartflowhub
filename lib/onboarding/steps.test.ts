import { describe, it, expect } from "vitest"
import { buildSteps } from "./steps"

const modules = [
  { key: "social-chatbot", displayName: "AI Agent" },
  { key: "agent-leads", displayName: "CRM" },
]

describe("buildSteps", () => {
  it("returns welcome + one step per module + finish, in order", () => {
    const steps = buildSteps(modules, null, "Crowndental")
    expect(steps.map((s) => s.kind)).toEqual(["welcome", "module", "module", "finish"])
  })
  it("uses the module displayName as the step title and a content-area target", () => {
    const steps = buildSteps(modules, null, "Crowndental")
    expect(steps[1].title).toBe("AI Agent")
    expect(steps[1].moduleKey).toBe("social-chatbot")
    expect(steps[1].targetSelector).toBe('[data-tour="module-content"]')
  })
  it("uses stored welcome/finish copy when present, else a default welcome with the client name", () => {
    const stored = { welcome: "Zdravo!", finish: "Kraj.", modules: {} }
    expect(buildSteps(modules, stored, "X")[0].title).toBe("Zdravo!")
    expect(buildSteps(modules, null, "Crowndental")[0].title).toContain("Crowndental")
  })
  it("handles an empty module list (welcome + finish only)", () => {
    expect(buildSteps([], null, "X").map((s) => s.kind)).toEqual(["welcome", "finish"])
  })
})
