import { ModuleKey } from '@/lib/modules/types'

export type NicheKey =
  | 'dental'
  | 'medical'
  | 'fitness'
  | 'beauty'
  | 'services'
  | 'ecommerce'
  | 'furniture'
  | 'fashion'
  | 'food'
  | 'real-estate'
  | 'travel'
  | 'auto'
  | 'generic'

export interface NicheTerminology {
  singular: string       // "Pacijent", "Kupac", "Klijent"
  plural: string         // "Pacijenti", "Kupci", "Klijenti"
  statusLabel: string    // "Status termina", "Status narudžbine", "Status"
  statuses: string[]
}

export interface NicheConfig {
  key: NicheKey
  label: string
  crmLabel: string
  catalogLabel: string
  calendarLabel: string
  modules: ModuleKey[]
  useCalendar: boolean
  useCatalog: boolean
  isVisualNiche: boolean
  channels: string[]
  brandColor: string
  terminology: NicheTerminology
}

export const NICHE_CONFIGS: Record<NicheKey, NicheConfig> = {
  dental: {
    key: 'dental',
    label: 'Stomatologija',
    crmLabel: 'Pacijenti',
    catalogLabel: 'Tretmani',
    calendarLabel: 'Termini',
    modules: ['business-crm', 'social-chatbot', 'agent-database', 'calendar', 'chatbot-analytics'],
    useCalendar: true,
    useCatalog: true,
    isVisualNiche: false,
    channels: ['WhatsApp', 'Instagram', 'Web', 'Facebook'],
    brandColor: '#0ea5e9',
    terminology: {
      singular: 'Pacijent',
      plural: 'Pacijenti',
      statusLabel: 'Status termina',
      statuses: ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija'],
    },
  },
  medical: {
    key: 'medical',
    label: 'Medicina / Klinike',
    crmLabel: 'Pacijenti',
    catalogLabel: 'Usluge',
    calendarLabel: 'Termini',
    modules: ['business-crm', 'social-chatbot', 'agent-database', 'calendar', 'chatbot-analytics'],
    useCalendar: true,
    useCatalog: true,
    isVisualNiche: false,
    channels: ['WhatsApp', 'Web', 'Instagram', 'Facebook'],
    brandColor: '#10b981',
    terminology: {
      singular: 'Pacijent',
      plural: 'Pacijenti',
      statusLabel: 'Status termina',
      statuses: ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija'],
    },
  },
  fitness: {
    key: 'fitness',
    label: 'Fitnes / Wellness',
    crmLabel: 'Klijenti',
    catalogLabel: 'Programi',
    calendarLabel: 'Termini',
    modules: ['business-crm', 'social-chatbot', 'agent-database', 'calendar', 'chatbot-analytics'],
    useCalendar: true,
    useCatalog: true,
    isVisualNiche: false,
    channels: ['Instagram', 'WhatsApp', 'Facebook', 'Web'],
    brandColor: '#f97316',
    terminology: {
      singular: 'Klijent',
      plural: 'Klijenti',
      statusLabel: 'Status',
      statuses: ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija'],
    },
  },
  beauty: {
    key: 'beauty',
    label: 'Estetika / Lepota',
    crmLabel: 'Klijenti',
    catalogLabel: 'Tretmani',
    calendarLabel: 'Termini',
    modules: ['business-crm', 'social-chatbot', 'agent-database', 'calendar', 'chatbot-analytics'],
    useCalendar: true,
    useCatalog: true,
    isVisualNiche: true,
    channels: ['Instagram', 'WhatsApp', 'Facebook', 'Web'],
    brandColor: '#ec4899',
    terminology: {
      singular: 'Klijent',
      plural: 'Klijenti',
      statusLabel: 'Status termina',
      statuses: ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija'],
    },
  },
  services: {
    key: 'services',
    label: 'Usluge / Konsalting',
    crmLabel: 'Klijenti',
    catalogLabel: 'Usluge',
    calendarLabel: 'Termini',
    modules: ['business-crm', 'social-chatbot', 'agent-database', 'calendar', 'chatbot-analytics'],
    useCalendar: true,
    useCatalog: true,
    isVisualNiche: false,
    channels: ['WhatsApp', 'Web', 'Instagram', 'Facebook'],
    brandColor: '#8b5cf6',
    terminology: {
      singular: 'Klijent',
      plural: 'Klijenti',
      statusLabel: 'Status',
      statuses: ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija'],
    },
  },
  ecommerce: {
    key: 'ecommerce',
    label: 'E-commerce',
    crmLabel: 'Kupci',
    catalogLabel: 'Proizvodi',
    calendarLabel: 'Termini',
    modules: ['business-crm', 'social-chatbot', 'agent-database', 'chatbot-analytics'],
    useCalendar: false,
    useCatalog: true,
    isVisualNiche: true,
    channels: ['Instagram', 'Facebook', 'WhatsApp', 'Web'],
    brandColor: '#f59e0b',
    terminology: {
      singular: 'Kupac',
      plural: 'Kupci',
      statusLabel: 'Status narudžbine',
      statuses: ['Novi', 'Zainteresovan', 'Naručio', 'Isporučeno', 'Reklamacija', 'Intervencija'],
    },
  },
  furniture: {
    key: 'furniture',
    label: 'Nameštaj / Enterijer',
    crmLabel: 'Kupci',
    catalogLabel: 'Kolekcija',
    calendarLabel: 'Termini',
    modules: ['business-crm', 'social-chatbot', 'agent-database', 'chatbot-analytics'],
    useCalendar: false,
    useCatalog: true,
    isVisualNiche: true,
    channels: ['Instagram', 'Facebook', 'WhatsApp', 'Web'],
    brandColor: '#d97706',
    terminology: {
      singular: 'Kupac',
      plural: 'Kupci',
      statusLabel: 'Status',
      statuses: ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija'],
    },
  },
  fashion: {
    key: 'fashion',
    label: 'Moda / Odjeća',
    crmLabel: 'Kupci',
    catalogLabel: 'Kolekcija',
    calendarLabel: 'Termini',
    modules: ['business-crm', 'social-chatbot', 'agent-database', 'chatbot-analytics'],
    useCalendar: false,
    useCatalog: true,
    isVisualNiche: true,
    channels: ['Instagram', 'Facebook', 'WhatsApp', 'Web'],
    brandColor: '#db2777',
    terminology: {
      singular: 'Kupac',
      plural: 'Kupci',
      statusLabel: 'Status narudžbine',
      statuses: ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija'],
    },
  },
  food: {
    key: 'food',
    label: 'Ugostiteljstvo / Hrana',
    crmLabel: 'Gosti',
    catalogLabel: 'Meni',
    calendarLabel: 'Rezervacije',
    modules: ['business-crm', 'social-chatbot', 'agent-database', 'calendar', 'chatbot-analytics'],
    useCalendar: true,
    useCatalog: true,
    isVisualNiche: true,
    channels: ['Instagram', 'Facebook', 'WhatsApp', 'Web'],
    brandColor: '#ef4444',
    terminology: {
      singular: 'Gost',
      plural: 'Gosti',
      statusLabel: 'Status rezervacije',
      statuses: ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija'],
    },
  },
  'real-estate': {
    key: 'real-estate',
    label: 'Nekretnine',
    crmLabel: 'Klijenti',
    catalogLabel: 'Nekretnine',
    calendarLabel: 'Termini',
    modules: ['business-crm', 'social-chatbot', 'agent-database', 'chatbot-analytics'],
    useCalendar: false,
    useCatalog: true,
    isVisualNiche: true,
    channels: ['WhatsApp', 'Instagram', 'Facebook', 'Web'],
    brandColor: '#0891b2',
    terminology: {
      singular: 'Klijent',
      plural: 'Klijenti',
      statusLabel: 'Status',
      statuses: ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija'],
    },
  },
  travel: {
    key: 'travel',
    label: 'Turizam / Putovanja',
    crmLabel: 'Klijenti',
    catalogLabel: 'Paketi',
    calendarLabel: 'Termini',
    modules: ['business-crm', 'social-chatbot', 'agent-database', 'chatbot-analytics'],
    useCalendar: false,
    useCatalog: true,
    isVisualNiche: true,
    channels: ['Instagram', 'Facebook', 'WhatsApp', 'Web'],
    brandColor: '#0284c7',
    terminology: {
      singular: 'Klijent',
      plural: 'Klijenti',
      statusLabel: 'Status',
      statuses: ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija'],
    },
  },
  auto: {
    key: 'auto',
    label: 'Automobili / Auto-moto',
    crmLabel: 'Kupci',
    catalogLabel: 'Vozila',
    calendarLabel: 'Termini',
    modules: ['business-crm', 'social-chatbot', 'agent-database', 'chatbot-analytics'],
    useCalendar: false,
    useCatalog: true,
    isVisualNiche: true,
    channels: ['WhatsApp', 'Facebook', 'Instagram', 'Web'],
    brandColor: '#1e40af',
    terminology: {
      singular: 'Kupac',
      plural: 'Kupci',
      statusLabel: 'Status',
      statuses: ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija'],
    },
  },
  generic: {
    key: 'generic',
    label: 'Opšte',
    crmLabel: 'Klijenti',
    catalogLabel: 'Usluge',
    calendarLabel: 'Termini',
    modules: ['business-crm', 'social-chatbot', 'chatbot-analytics'],
    useCalendar: false,
    useCatalog: false,
    isVisualNiche: false,
    channels: ['WhatsApp', 'Instagram', 'Facebook', 'Web'],
    brandColor: '#6366f1',
    terminology: {
      singular: 'Klijent',
      plural: 'Klijenti',
      statusLabel: 'Status',
      statuses: ['Novi', 'Zainteresovan', 'Zakazano', 'Završeno', 'Reklamacija', 'Intervencija'],
    },
  },
}

const NICHE_KEYWORDS: Array<{ pattern: RegExp; key: NicheKey }> = [
  { pattern: /dental|stomato|zub|ortodon|implant|orthodon/i, key: 'dental' },
  { pattern: /klinik|medic|hospital|ordinacij|doktor|lekari|klinika|bolnic/i, key: 'medical' },
  { pattern: /fitnes|teretana|gym|wellness|sport|trening|pilates|yoga/i, key: 'fitness' },
  { pattern: /estetik|lepot|kozmetik|beauty|spa|nokat|trepavic|frizeri|hair/i, key: 'beauty' },
  { pattern: /nekretnin|real.?estat|apartman|stan|kuća|kuca|agencija za nekret/i, key: 'real-estate' },
  { pattern: /restoran|kafana|pica|burger|catering|ugostiteljst|food|meni|ketering/i, key: 'food' },
  { pattern: /turizm|putovanj|travel|hotel|smestaj|odmor|letovanj|destinacij/i, key: 'travel' },
  { pattern: /namestaj|nameštaj|enterijer|interior|sofa|garnitur|krevet|furniture/i, key: 'furniture' },
  { pattern: /moda|fashion|odjeć|odeca|majic|pantalo|haljin|odeća|cloth/i, key: 'fashion' },
  { pattern: /auto|vozil|automobil|motocikl|car|vehicle|polovn/i, key: 'auto' },
  { pattern: /prodavnic|webshop|shop|e.?commerc|online prodaj|kupovina|proizvod/i, key: 'ecommerce' },
  { pattern: /konsalting|konsultant|agencij|b2b|uslug|servis|biznis/i, key: 'services' },
]

export function inferNicheKey(rawNiche: string | null | undefined): NicheKey {
  if (!rawNiche) return 'generic'
  const text = rawNiche.toLowerCase()

  for (const { pattern, key } of NICHE_KEYWORDS) {
    if (pattern.test(text)) return key
  }

  return 'generic'
}
