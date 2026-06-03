import type { ModuleKey } from "@/lib/modules/types"
import type { TourStep, OnboardingCopy } from "./types"
import { resolveModuleCopy } from "./copy"

export interface ModuleLike {
  key: string
  displayName: string
}

const CONTENT_TARGET = '[data-tour="module-content"]'

export function buildSteps(
  modules: ModuleLike[],
  copy: OnboardingCopy | null,
  clientName: string,
): TourStep[] {
  const welcome: TourStep = {
    kind: "welcome",
    title: copy?.welcome ?? `Dobrodošli${clientName ? `, ${clientName}` : ""} 👋`,
    body: "Provešću Vas kroz Vaš sistem — za manje od minuta.",
  }
  const moduleSteps: TourStep[] = modules.map((m) => ({
    kind: "module",
    moduleKey: m.key as ModuleKey,
    targetSelector: CONTENT_TARGET,
    title: m.displayName,
    body: resolveModuleCopy(copy, m.key),
  }))
  const finish: TourStep = {
    kind: "finish",
    title: copy?.finish ?? "Spremni ste!",
    body: "Probajte da pošaljete poruku Vašem agentu i vidite kako radi uživo.",
  }
  return [welcome, ...moduleSteps, finish]
}
