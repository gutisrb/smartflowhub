import {
  Database,
  Mail,
  LayoutDashboard,
  Briefcase,
  Users,
  MessageCircle,
  BarChart2,
  Kanban,
  CalendarDays,
  Settings,
  Sparkles,
  Sunrise,
} from "lucide-react"
import { DashboardModule, ModuleKey } from "./types"

export const MODULE_REGISTRY: Record<ModuleKey, DashboardModule> = {
  'command-center': {
    key: 'command-center',
    label: 'Danas',
    icon: Sunrise,
    category: 'acquisition',
    description: 'Operativna kontrolna tabla — dnevni pregled i odobravanje slanja',
  },
  'pipeline': {
    key: 'pipeline',
    label: 'Pipeline',
    icon: Kanban,
    category: 'acquisition',
    description: 'Deal flow kanban — stage-by-stage progression',
  },
  'growth-engine': {
    key: 'growth-engine',
    label: 'Kontrolna Tabla',
    icon: LayoutDashboard,
    category: 'acquisition',
    description: 'Objedinjen prikaz sistema za akviziciju i upravljanje kandidatima',
  },
  'business-crm': {
    key: 'business-crm',
    label: 'Kandidati CRM',
    icon: Database,
    category: 'acquisition',
    description: 'Upravljanje kandidatima, praćenje statusa i analiza procesa selekcije',
  },
  'email-outreach': {
    key: 'email-outreach',
    label: 'Email Outreach',
    icon: Mail,
    category: 'acquisition',
    description: 'Automatizovane email kampanje i praćenje kontakata',
  },
  'agent-database': {
    key: 'agent-database',
    label: 'Baza Podataka',
    icon: Briefcase,
    category: 'fulfillment',
    description: 'Baza znanja specifična za klijenta: poslovi, ponude ili proizvodi',
  },
  'agent-leads': {
    key: 'agent-leads',
    label: 'Prijave Agenata',
    icon: Users,
    category: 'fulfillment',
    description: 'Praćenje prijava sa kanala vođenih agentima (društvene mreže, četbot)',
  },
  'website-chatbot': {
    key: 'website-chatbot',
    label: 'Vebsajt Četbot',
    icon: MessageCircle,
    category: 'fulfillment',
    description: 'Upravljanje konverzacijama i prijavama sa vebsajt četbota',
  },
  'social-chatbot': {
    key: 'social-chatbot',
    label: 'AI Agent',
    icon: MessageCircle,
    category: 'fulfillment',
    description: 'Upravljanje Instagram i Facebook DM konverzacijama',
  },
  'chatbot-analytics': {
    key: 'chatbot-analytics',
    label: 'Analitika',
    icon: BarChart2,
    category: 'analytics',
    description: 'Statistike četbota: popularni poslovi, pitanja, kanali, zastoji',
  },
  'calendar': {
    key: 'calendar',
    label: 'Termini',
    icon: CalendarDays,
    category: 'fulfillment',
    description: 'Pregled zakazanih termina i rezervacija',
  },
  'ponuda': {
    key: 'ponuda',
    label: 'Ponuda',
    icon: Sparkles,
    category: 'settings',
    description: 'Vaša ponuda — kako da pustimo sistem uživo',
  },
  'settings': {
    key: 'settings',
    label: 'Podešavanja',
    icon: Settings,
    category: 'settings',
    description: 'Podešavanja naloga, brendova i obaveštenja',
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
