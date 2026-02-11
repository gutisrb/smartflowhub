import {
  Database,
  Mail,
  LayoutDashboard,
  Settings,
  Briefcase,
  Users,
  Linkedin,
  MessageCircle,
} from "lucide-react"
import { ModuleDefinition, ModuleKey } from "./types"

export const MODULE_REGISTRY: Record<ModuleKey, ModuleDefinition> = {
  'business-crm': {
    key: 'business-crm',
    defaultLabel: 'Business CRM',
    icon: Database,
    category: 'crm',
    isCore: true,
    description: 'Manage B2B leads, track conversions, and analyze your sales pipeline',
    componentPath: 'components/modules/business-crm-module'
  },
  'email-outreach': {
    key: 'email-outreach',
    defaultLabel: 'Email Outreach',
    icon: Mail,
    category: 'outreach',
    isCore: true,
    description: 'Automated email campaigns and outreach tracking',
    componentPath: 'components/modules/email-outreach-module'
  },
  'analytics': {
    key: 'analytics',
    defaultLabel: 'Analytics',
    icon: LayoutDashboard,
    category: 'analytics',
    isCore: true,
    description: 'Performance metrics and insights across all modules',
    componentPath: 'components/modules/analytics-module'
  },
  'settings': {
    key: 'settings',
    defaultLabel: 'Settings',
    icon: Settings,
    category: 'settings',
    isCore: true,
    description: 'Configure your account and module preferences',
    componentPath: 'components/modules/settings-module'
  },
  'social-jobs': {
    key: 'social-jobs',
    defaultLabel: 'Job Postings',
    icon: Briefcase,
    category: 'social',
    isCore: false,
    description: 'Create and manage job postings for social media',
    componentPath: 'components/modules/social-jobs-module'
  },
  'social-candidates': {
    key: 'social-candidates',
    defaultLabel: 'Candidates',
    icon: Users,
    category: 'social',
    isCore: false,
    description: 'Track job candidates from social media channels',
    componentPath: 'components/modules/social-candidates-module'
  },
  'linkedin-agent': {
    key: 'linkedin-agent',
    defaultLabel: 'LinkedIn Agent',
    icon: Linkedin,
    category: 'outreach',
    isCore: false,
    description: 'Automated LinkedIn outreach and lead generation',
    componentPath: 'components/modules/linkedin-agent-module'
  },
  'website-chatbot': {
    key: 'website-chatbot',
    defaultLabel: 'Website Chatbot',
    icon: MessageCircle,
    category: 'social',
    isCore: false,
    description: 'Manage website chatbot conversations and leads',
    componentPath: 'components/modules/website-chatbot-module'
  },
}

export function getModuleDefinition(key: ModuleKey): ModuleDefinition | undefined {
  return MODULE_REGISTRY[key]
}

export function getAllModules(): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY)
}

export function getCoreModules(): ModuleDefinition[] {
  return getAllModules().filter(m => m.isCore)
}

export function getOptionalModules(): ModuleDefinition[] {
  return getAllModules().filter(m => !m.isCore)
}

export function getModulesByCategory(category: string): ModuleDefinition[] {
  return getAllModules().filter(m => m.category === category)
}
