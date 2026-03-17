import { LucideIcon } from "lucide-react"

export type ModuleKey =
  | 'pipeline'
  | 'leads'
  | 'business-crm'
  | 'email-outreach'
  | 'linkedin-agent'
  | 'agent-database'
  | 'agent-leads'
  | 'social-chatbot'
  | 'website-chatbot'
  | 'chatbot-analytics'
  | 'growth-engine'

export type ModuleCategory = 'social' | 'outreach' | 'analytics' | 'settings' | 'crm'

export interface DashboardModule {
  key: ModuleKey
  label: string
  icon: LucideIcon
  category: ModuleCategory
  description: string
}

export type UserRole = 'admin' | 'client_admin' | 'client_user'

export interface ClientModuleConfig {
  clientId: string
  enabledModules: ModuleKey[]
  settings?: Record<string, any>
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

export interface EnabledModule extends DashboardModule {
  clientModuleId: string
  displayName: string
  settings: Record<string, any> | null
  sortOrder: number
}
