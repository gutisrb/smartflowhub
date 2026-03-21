import {
  Database,
  Mail,
  LayoutDashboard,
  Briefcase,
  Users,
  Linkedin,
  MessageCircle,
  BarChart2,
  Kanban,
} from "lucide-react"
import { DashboardModule, ModuleKey } from "./types"

export const MODULE_REGISTRY: Record<ModuleKey, DashboardModule> = {
  'pipeline': {
    key: 'pipeline',
    label: 'Pipeline',
    icon: Kanban,
    category: 'crm',
    description: 'Deal flow kanban — stage-by-stage progression',
  },
  'growth-engine': {
    key: 'growth-engine',
    label: 'Kontrolna Tabla',
    icon: LayoutDashboard,
    category: 'crm',
    description: 'Objedinjen prikaz sistema za akviziciju i upravljanje kandidatima',
  },
  'business-crm': {
    key: 'business-crm',
    label: 'Kandidati CRM',
    icon: Database,
    category: 'crm',
    description: 'Upravljanje kandidatima, praćenje statusa i analiza procesa selekcije',
  },
  'email-outreach': {
    key: 'email-outreach',
    label: 'Email Outreach',
    icon: Mail,
    category: 'crm',
    description: 'Automatizovane email kampanje i praćenje kontakata',
  },
  'agent-database': {
    key: 'agent-database',
    label: 'Baza Podataka',
    icon: Briefcase,
    category: 'social',
    description: 'Baza znanja specifična za klijenta: poslovi, ponude ili proizvodi',
  },
  'agent-leads': {
    key: 'agent-leads',
    label: 'Prijave Agenata',
    icon: Users,
    category: 'social',
    description: 'Praćenje prijava sa kanala vođenih agentima (društvene mreže, četbot)',
  },
  'linkedin-agent': {
    key: 'linkedin-agent',
    label: 'LinkedIn Agent',
    icon: Linkedin,
    category: 'crm',
    description: 'Automatizovana LinkedIn selekcija i generisanje kontakata',
  },
  'website-chatbot': {
    key: 'website-chatbot',
    label: 'Vebsajt Četbot',
    icon: MessageCircle,
    category: 'social',
    description: 'Upravljanje konverzacijama i prijavama sa vebsajt četbota',
  },
  'social-chatbot': {
    key: 'social-chatbot',
    label: 'AI Agent',
    icon: MessageCircle,
    category: 'social',
    description: 'Upravljanje Instagram i Facebook DM konverzacijama',
  },
  'chatbot-analytics': {
    key: 'chatbot-analytics',
    label: 'Analitika',
    icon: BarChart2,
    category: 'analytics',
    description: 'Statistike četbota: popularni poslovi, pitanja, kanali, zastoji',
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
