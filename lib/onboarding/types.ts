import type { ModuleKey } from "@/lib/modules/types"

export type TourStepKind = "welcome" | "module" | "finish"

export interface TourStep {
  kind: TourStepKind
  moduleKey?: ModuleKey
  targetSelector?: string
  title: string
  body: string
}

export interface OnboardingCopy {
  welcome: string
  modules: Record<string, string>
  finish: string
}
