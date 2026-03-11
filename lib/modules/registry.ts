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
import { DashboardModule, ModuleKey } from "./types"

export const MODULE_REGISTRY: Record<ModuleKey, DashboardModule> = {
  'growth-engine': {
    key: 'growth-engine',
    label: 'Growth Engine',
    icon: LayoutDashboard,
    category: 'crm',
    description: 'Unified view of your lead acquisition and management system',
  },
  'business-crm': {
    key: 'business-crm',
    label: 'Business CRM',
    icon: Database,
    category: 'crm',
    description: 'Manage leads, track conversions, and analyze your sales pipeline',
  },
  'email-outreach': {
    key: 'email-outreach',
    label: 'Email Outreach',
    icon: Mail,
    category: 'crm',
    description: 'Automated email campaigns and outreach tracking',
  },
  'agent-database': {
    key: 'agent-database',
    label: 'Agent Database',
    icon: Briefcase,
    category: 'social',
    description: 'Client-specific knowledge base: jobs, tours, products, or offers',
  },
  'agent-leads': {
    key: 'agent-leads',
    label: 'Agent Leads',
    icon: Users,
    category: 'social',
    description: 'Track leads from agent-driven channels (social media, chatbot)',
  },
  'linkedin-agent': {
    key: 'linkedin-agent',
    label: 'LinkedIn Agent',
    icon: Linkedin,
    category: 'crm',
    description: 'Automated LinkedIn outreach and lead generation',
  },
  'website-chatbot': {
    key: 'website-chatbot',
    label: 'Website Chatbot',
    icon: MessageCircle,
    category: 'social',
    description: 'Manage website chatbot conversations and leads',
  },
  'social-chatbot': {
    key: 'social-chatbot',
    label: 'Social Chatbot',
    icon: MessageCircle,
    category: 'social',
    description: 'Manage Instagram and Facebook DM conversations',
  },
}

export function getModuleDefinition(key: ModuleKey): DashboardModule | undefined {
  return MODULE_REGISTRY[key]
}

export function getAllModules(): DashboardModule[] {
  return Object.values(MODULE_REGISTRY)
}

export function getModulesByCategory(category: string): DashboardModule[] {
  return getAllModules().filter(m => m.category === category)
}
