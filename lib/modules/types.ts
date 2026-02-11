import { LucideIcon } from "lucide-react"

export type ModuleKey =
  | 'business-crm'
  | 'email-outreach'
  | 'analytics'
  | 'settings'
  | 'social-jobs'
  | 'social-candidates'
  | 'linkedin-agent'
  | 'website-chatbot'

export type ModuleCategory = 'social' | 'outreach' | 'analytics' | 'settings' | 'crm'

export interface ModuleDefinition {
  key: ModuleKey
  defaultLabel: string
  icon: LucideIcon
  category: ModuleCategory
  isCore: boolean
  description?: string
  componentPath: string
}

export interface ClientModule {
  id: string
  client_id: string
  module_key: ModuleKey
  is_enabled: boolean
  display_name: string | null
  settings: Record<string, any> | null
  sort_order: number | null
  created_at: string
}

export interface EnabledModule extends ModuleDefinition {
  clientModuleId: string
  displayName: string
  settings: Record<string, any> | null
  sortOrder: number
}
