"use client"

import { useState, useEffect, useCallback } from "react"
import {
    TableCell,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    MessageSquare,
    UserCheck,
    Search,
    RefreshCw,
    ArrowUpRight,
    User,
    Sparkles,
    AlertTriangle,
    Package,
} from "lucide-react"
import { getKandidatiByClientId, updateKandidat, getCrmHarmonijaByClientId, getCrmPublikByClientId, getCrmStelaByClientId, getCrmAleksandarMNByClientId, getCrmMagunaByClientId, getDemoCrmByClientId, updateDemoCrmStatus } from "@/lib/supabase/queries"
import { NicheKey, NICHE_CONFIGS } from "@/lib/niche-config"
import { getBookStoreConfig, BOOK_STORE_CLIENTS } from "@/lib/brand-configs"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { GlassCard } from "@/components/ui/glass-card"
import { toast } from "sonner"
import { LeadIntelligenceViewer } from "@/components/dashboard/lead-intelligence-viewer"

interface AgentLeadsModuleProps {
    clientId: string | null;
    selectedBrandIds?: string[];   // When set, show combined data from all listed brands
    terminology?: {
        title?: string;
        highlight?: string;
        entity?: string;
        entities?: string;
        group?: string;
        groups?: string;
        searchPlaceholder?: string;
        tableHeaders?: string[];
    };
    demoMode?: boolean;
    nicheKey?: NicheKey;
}

// ── Delivery status options ────────────────────────────────────────────────────
const ORDER_STATUS_OPTIONS = ["Obrađuje se", "Poslato", "Dostavljeno", "Reklamacija"]

// ── Razlog — why a Zainteresovan lead didn't order ────────────────────────────
// Set manually by Marko or (later) inferred by n8n agent
const RAZLOG_OPTIONS = [
    "Pitao za cenu",       // Price question — may be price-sensitive
    "Nema na stanju",      // Book not available — reorder signal
    "Čeka isporuku",       // Delivery time/cost concern
    "Premislio se",        // Changed mind
    "Nije odgovorio",      // Went silent after inquiry
    "Nema kontakta",       // No email/phone captured, can't follow up
]

// ── Helper ────────────────────────────────────────────────────────────────────
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString()

// ── Brand-specific mock data ───────────────────────────────────────────────────
// Status logic:
//   Novi         = first contact, nothing specific captured yet
//   Zainteresovan = specific book/category captured, warm lead — no order yet
//   Poručio      = order placed; status_porudzbine tracks delivery
//   Intervencija  = needs human today (complaint, stuck order, complex question)
//
// razlog: why a Zainteresovan lead didn't convert — actionable signal per brand
const MOCK_BOOKSTORE_CRM_BY_CLIENT: Record<string, any[]> = {
    // Harmonija Knjige — psychology, wellness, self-help, nutrition, parenting
    "255db627-c62b-44ce-a9dc-3a7e90dd1b67": [
        { id: 'h1', full_name: 'Ana Kovačević',   tema: 'Psihologija',   knjiga: 'Mit o normalnom',            status: 'Zainteresovan', razlog: 'Nema na stanju', status_porudzbine: null,          izvor: 'Instagram', email: 'ana.k@gmail.com',    telefon: null,            created_at: hoursAgo(2)  },
        { id: 'h2', full_name: 'Milena Đorđević', tema: 'Self-help',     knjiga: 'Atomske navike',             status: 'Poručio',       razlog: null,             status_porudzbine: 'Dostavljeno',  izvor: 'Instagram', email: 'milena.dj@gmail.com', telefon: null,            created_at: hoursAgo(4)  },
        { id: 'h3', full_name: 'Stefan Marković', tema: 'Wellness',      knjiga: null,                         status: 'Novi',          razlog: null,             status_porudzbine: null,          izvor: 'Facebook',  email: null,                  telefon: null,            created_at: hoursAgo(5)  },
        { id: 'h4', full_name: 'Jelena Petrović', tema: 'Roditeljstvo',  knjiga: 'Budite oslonac svojoj deci', status: 'Poručio',       razlog: null,             status_porudzbine: 'Obrađuje se', izvor: 'Instagram', email: 'jelena.p@gmail.com',  telefon: '+381641234567', created_at: hoursAgo(26) },
        { id: 'h5', full_name: 'Nikola Jovanović',tema: 'Nauka o mozgu', knjiga: 'You, Happier',               status: 'Intervencija',  razlog: null,             status_porudzbine: 'Reklamacija', izvor: 'Instagram', email: null,                  telefon: '+381641234568', created_at: hoursAgo(28) },
        { id: 'h6', full_name: 'Maja Simić',      tema: 'Ishrana',       knjiga: 'Homemade by Mila',           status: 'Zainteresovan', razlog: 'Pitao za cenu',  status_porudzbine: null,          izvor: 'Instagram', email: null,                  telefon: null,            created_at: hoursAgo(30) },
    ],
    // Publik Praktikum — children's books, educational, interactive — customers are parents
    "bd12eb98-e62a-4a87-b620-a9881081449b": [
        { id: 'p1', full_name: 'Ivana Nikolić',   tema: 'Slikovnice',     knjiga: 'Mali svet slika: Farma',    status: 'Poručio',       razlog: null,             status_porudzbine: 'Dostavljeno', izvor: 'Instagram', email: 'ivana.n@gmail.com',   telefon: null,            created_at: hoursAgo(1)  },
        { id: 'p2', full_name: 'Marija Lazić',    tema: 'Bojanka',        knjiga: 'Piši-briši: Dinozauri',     status: 'Zainteresovan', razlog: 'Nema na stanju', status_porudzbine: null,          izvor: 'Instagram', email: 'marija.l@gmail.com',  telefon: null,            created_at: hoursAgo(3)  },
        { id: 'p3', full_name: 'Dragan Stanković',tema: 'Za uzrast 5-8',  knjiga: null,                        status: 'Novi',          razlog: null,             status_porudzbine: null,          izvor: 'Facebook',  email: null,                  telefon: null,            created_at: hoursAgo(6)  },
        { id: 'p4', full_name: 'Sanja Filipović', tema: 'Interaktivne',   knjiga: 'Priča sa iskakalicama',     status: 'Poručio',       razlog: null,             status_porudzbine: 'Poslato',     izvor: 'Instagram', email: 'sanja.f@gmail.com',   telefon: '+381641111111', created_at: hoursAgo(24) },
        { id: 'p5', full_name: 'Tatjana Vasić',   tema: 'Enciklopedija',  knjiga: 'Dinozauri: Velika knjiga',  status: 'Zainteresovan', razlog: 'Pitao za cenu',  status_porudzbine: null,          izvor: 'Instagram', email: null,                  telefon: null,            created_at: hoursAgo(27) },
        { id: 'p6', full_name: 'Luka Popović',    tema: 'Priča',          knjiga: 'Čarobna slagalica',         status: 'Intervencija',  razlog: null,             status_porudzbine: 'Reklamacija', izvor: 'Instagram', email: null,                  telefon: '+381642222222', created_at: hoursAgo(29) },
    ],
    // Stela Knjige — adult fiction, romance, thriller, crime — translated international titles
    "d7337d00-db70-46c3-828b-e9ac82e21717": [
        { id: 's1', full_name: 'Jovana Milić',       tema: 'Romantika',           knjiga: 'Twisted Love',      status: 'Poručio',       razlog: null,             status_porudzbine: 'Dostavljeno', izvor: 'Instagram', email: 'jovana.m@gmail.com',     telefon: null,            created_at: hoursAgo(1)  },
        { id: 's2', full_name: 'Sara Đurić',         tema: 'Kriminalistički',     knjiga: 'Tihe vode',         status: 'Zainteresovan', razlog: 'Nema na stanju', status_porudzbine: null,          izvor: 'Instagram', email: 'sara.d@gmail.com',        telefon: null,            created_at: hoursAgo(2)  },
        { id: 's3', full_name: 'Maja Kostić',        tema: 'Savremena proza',     knjiga: null,                status: 'Novi',          razlog: null,             status_porudzbine: null,          izvor: 'Facebook',  email: null,                      telefon: null,            created_at: hoursAgo(5)  },
        { id: 's4', full_name: 'Nina Vuković',       tema: 'Romantika',           knjiga: 'November 9',        status: 'Poručio',       razlog: null,             status_porudzbine: 'Poslato',     izvor: 'Instagram', email: 'nina.v@gmail.com',        telefon: '+381643333333', created_at: hoursAgo(20) },
        { id: 's5', full_name: 'Aleksandra Todorović', tema: 'Triler',            knjiga: 'Opake igre',        status: 'Zainteresovan', razlog: 'Pitao za cenu',  status_porudzbine: null,          izvor: 'Instagram', email: null,                      telefon: null,            created_at: hoursAgo(25) },
        { id: 's6', full_name: 'Tijana Rašić',       tema: 'Saga',                knjiga: 'Ptičica na trnju',  status: 'Intervencija',  razlog: null,             status_porudzbine: 'Reklamacija', izvor: 'Instagram', email: null,                      telefon: '+381644444444', created_at: hoursAgo(31) },
    ],
    // Maguna Dizajn — folding tables, children's furniture, vanity tables — B2C e-commerce Serbia
    "0c25e7c2-360c-418a-816a-34444d304698": [
        { id: 'm1', full_name: 'Jovana Filipović',  zdravstveni_cilj: 'Sklopivi stolovi',     proizvod: 'Sklopivi sto kutija BELI',              status: 'Poručio',       razlog: null,                  status_porudzbine: 'Poslato',     izvor: 'Instagram', email: 'jovana.filipovic@gmail.com', telefon: null,           created_at: hoursAgo(26) },
        { id: 'm2', full_name: 'Marko Petrović',    zdravstveni_cilj: 'Dečiji nameštaj',      proizvod: 'Sklopivi radni sto BELI',               status: 'Poručio',       razlog: null,                  status_porudzbine: 'Dostavljeno', izvor: 'Instagram', email: 'marko.petrovic2@gmail.com', telefon: null,           created_at: hoursAgo(120) },
        { id: 'm3', full_name: 'Milica Jovanović',  zdravstveni_cilj: 'Sklopivi klub stolovi', proizvod: 'Sklopivi klub sto 2u1',                status: 'Zainteresovan', razlog: 'Nema u crnoj boji',   status_porudzbine: null,          izvor: 'Facebook',  email: 'milica.j@outlook.com',      telefon: null,           created_at: hoursAgo(48) },
        { id: 'm4', full_name: 'Dragan Tomić',      zdravstveni_cilj: 'Sklopivi stolovi',     proizvod: 'Sklopivi sto zaobljeni ćoškovi A427',  status: 'Zainteresovan', razlog: 'Pita za popust',       status_porudzbine: null,          izvor: 'Facebook',  email: 'dragan.tomic@firma.rs',     telefon: null,           created_at: hoursAgo(22) },
        { id: 'm5', full_name: 'Nina Vasić',        zdravstveni_cilj: 'Šminkanje / dekor',   proizvod: 'Stočić za šminkanje STILSKI',           status: 'Poručio',       razlog: null,                  status_porudzbine: 'Obrađuje se', izvor: 'Instagram', email: null,                        telefon: null,           created_at: hoursAgo(48) },
        { id: 'm6', full_name: 'Aleksandar Lukić',  zdravstveni_cilj: 'Sklopivi stolovi',     proizvod: 'Sklopivi četvrtasti sto BELI',          status: 'Intervencija',  razlog: null,                  status_porudzbine: 'Reklamacija', izvor: 'Website',   email: 'aleksandar.l@gmail.com',    telefon: null,           created_at: hoursAgo(8) },
    ],
    // Aleksandar MN — health supplements, vitamins, fitness — B2C retail (Prevencija i Terapija)
    // ⚠ UUID placeholder — update when real client UUID is known
    "3255f279-801c-474b-9c16-a75edc336296": [
        { id: 'a1', full_name: 'Ana Petrović',      zdravstveni_cilj: 'Imunitet',        proizvod: 'iMMUNITA + D3 vitamin 2000',       status: 'Zainteresovan', razlog: 'Pitao za cenu',  status_porudzbine: null,          izvor: 'Instagram', email: 'ana.p@gmail.com',     telefon: null,            created_at: hoursAgo(1)  },
        { id: 'a2', full_name: 'Milan Savić',       zdravstveni_cilj: 'Zglobovi',        proizvod: 'Joint MD Revolution, 30 tableta',  status: 'Poručio',       razlog: null,             status_porudzbine: 'Dostavljeno', izvor: 'Instagram', email: 'milan.s@gmail.com',   telefon: null,            created_at: hoursAgo(3)  },
        { id: 'a3', full_name: 'Jelena Kovač',      zdravstveni_cilj: 'Kolagen / koža',  proizvod: null,                               status: 'Novi',          razlog: null,             status_porudzbine: null,          izvor: 'Facebook',  email: null,                  telefon: null,            created_at: hoursAgo(6)  },
        { id: 'a4', full_name: 'Stefan Jović',      zdravstveni_cilj: 'Zglobovi',        proizvod: 'Joint MD Extra Strength',          status: 'Zainteresovan', razlog: 'Nema na stanju', status_porudzbine: null,          izvor: 'Instagram', email: 'stefan.j@gmail.com',  telefon: null,            created_at: hoursAgo(8)  },
        { id: 'a5', full_name: 'Tamara Đurić',      zdravstveni_cilj: 'Spavanje / stres',proizvod: 'Liposomalni Melatonin + Cognitiva', status: 'Poručio',      razlog: null,             status_porudzbine: 'Obrađuje se', izvor: 'Instagram', email: 'tamara.d@gmail.com',  telefon: '+381641234567', created_at: hoursAgo(22) },
        { id: 'a6', full_name: 'Nikola Bogdanović', zdravstveni_cilj: 'Koncentracija',   proizvod: 'Cognitiva Super nutrijent',        status: 'Intervencija',  razlog: null,             status_porudzbine: 'Reklamacija', izvor: 'Instagram', email: null,                  telefon: '+381642345678', created_at: hoursAgo(30) },
    ],
}

export function AgentLeadsModule({ clientId, selectedBrandIds, terminology: propTerminology, demoMode, nicheKey }: AgentLeadsModuleProps) {
    const [leads, setLeads] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filter, setFilter] = useState('all')
    const [selectedLead, setSelectedLead] = useState<any | null>(null)
    const [editingStatusId, setEditingStatusId] = useState<string | null>(null)
    const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null)
    const [editingRazlogId, setEditingRazlogId] = useState<string | null>(null)

    const terminology = propTerminology || {
        title: "Growth",
        highlight: "Engine",
        entity: "Lead",
        entities: "Leads",
        group: "Company",
        groups: "Companies",
        searchPlaceholder: "Search trajectories, names...",
    }

    const isRecruitment = terminology.title === "Regrutacija"
    const bookStoreConfig = getBookStoreConfig(clientId)
    const isHarmonija = bookStoreConfig !== null
    const isCatalogProducts = bookStoreConfig?.tableType === 'proizvodi'
    const bsColor = bookStoreConfig?.color || '#10b981'

    const isDemoMode = !!demoMode && !!nicheKey
    const nicheConfig = isDemoMode && nicheKey ? NICHE_CONFIGS[nicheKey] : null

    const loadCandidates = useCallback(async () => {
        if (!clientId) return
        setLoading(true)
        try {
            // Demo mode: load from demo_crm table
            if (isDemoMode) {
                const data = await getDemoCrmByClientId(clientId)
                setLeads(data || [])
                setLoading(false)
                return
            }

            let data
            if (bookStoreConfig) {
                if (bookStoreConfig.crmTable === 'crm_harmonija') data = await getCrmHarmonijaByClientId(clientId)
                else if (bookStoreConfig.crmTable === 'crm_publik') data = await getCrmPublikByClientId(clientId)
                else if (bookStoreConfig.crmTable === 'crm_stela') data = await getCrmStelaByClientId(clientId)
                else if (bookStoreConfig.crmTable === 'crm_aleksandarmn') data = await getCrmAleksandarMNByClientId(clientId)
                else if (bookStoreConfig.crmTable === 'crm_maguna') data = await getCrmMagunaByClientId(clientId)
                else data = await getKandidatiByClientId(clientId)
            } else {
                data = await getKandidatiByClientId(clientId)
            }
            // Multi-brand: merge mock data from all selected brands, tag each with brandId
            const activeBrandIds = selectedBrandIds && selectedBrandIds.length > 1
                ? selectedBrandIds
                : clientId ? [clientId] : []
            const brandMock = activeBrandIds.flatMap(bid =>
                (MOCK_BOOKSTORE_CRM_BY_CLIENT[bid] ?? []).map((item: any) => ({ ...item, brandId: bid }))
            )
            const fallback = brandMock.length > 0
                ? brandMock
                : (MOCK_BOOKSTORE_CRM_BY_CLIENT[clientId!] ?? [])
            setLeads(bookStoreConfig && (!data || data.length === 0) ? fallback : (data || []))
        } catch (error) {
            console.error("Failed to load candidates", error)
            toast.error("Greška pri učitavanju")
        }
        setLoading(false)
    }, [clientId, isDemoMode, bookStoreConfig, selectedBrandIds])

    useEffect(() => {
        loadCandidates()
        const supabase = createClient()
        const tableName = isDemoMode ? 'demo_crm' : (bookStoreConfig ? bookStoreConfig.crmTable : "kandidati")
        const channel = supabase
            .channel(`${tableName}-rt-${clientId}`)
            .on("postgres_changes", { event: "*", schema: "public", table: tableName, filter: `client_id=eq.${clientId}` },
                () => loadCandidates())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [loadCandidates, clientId, isDemoMode, bookStoreConfig])

    const filteredLeads = leads.filter(c => {
        const matchesSearch = c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (isCatalogProducts
                ? c.zdravstveni_cilj?.toLowerCase().includes(searchTerm.toLowerCase()) || c.proizvod?.toLowerCase().includes(searchTerm.toLowerCase())
                : isHarmonija
                    ? c.tema?.toLowerCase().includes(searchTerm.toLowerCase()) || c.knjiga?.toLowerCase().includes(searchTerm.toLowerCase())
                    : c.posao?.toLowerCase().includes(searchTerm.toLowerCase()) || c.lokacija?.toLowerCase().includes(searchTerm.toLowerCase())
            )
        const candidateStatus = c.status || 'Novi';
        const matchesFilter = filter === 'all' || candidateStatus.toLowerCase() === filter.toLowerCase();
        return matchesSearch && matchesFilter;
    })

    const totalLeads = leads.length;

    // Bookstore stats
    const bsZainteresovano = leads.filter(l => l.status?.toLowerCase() === 'zainteresovan').length;
    const bsPoručilo = leads.filter(l => l.status?.toLowerCase() === 'poručio').length;
    const bsIntervencije = leads.filter(l => l.status?.toLowerCase() === 'intervencija').length;

    // Recruitment stats
    const qualifiedLeads = leads.filter(l => ['kvalifikovan', 'intervju', 'zaposlen'].includes(l.status?.toLowerCase() || '')).length;
    const activeInterviews = leads.filter(l => l.status?.toLowerCase() === 'intervju').length;
    const hired = leads.filter(l => l.status?.toLowerCase() === 'zaposlen').length;

    // Bookstore: Novi | Zainteresovan | Poručio | Intervencija
    const STATUS_OPTIONS = isHarmonija
        ? ['Novi', 'Zainteresovan', 'Poručio', 'Intervencija']
        : ['Novi', 'Prijavljen', 'Kvalifikovan', 'Intervju', 'Zaposlen', 'Intervencija', 'Odbijen']

    const handleStatusChange = async (leadId: string, newStatus: string) => {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
        setEditingStatusId(null)
        try {
            if (isDemoMode) {
                await updateDemoCrmStatus(leadId, newStatus)
            } else {
                await updateKandidat(leadId, { status: newStatus })
            }
        } catch {
            toast.error("Greška pri ažuriranju statusa")
            loadCandidates()
        }
    }

    const handleDeliveryStatusChange = async (leadId: string, newStatus: string) => {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status_porudzbine: newStatus } : l))
        setEditingDeliveryId(null)
        try {
            await updateKandidat(leadId, { status_porudzbine: newStatus })
        } catch {
            toast.error("Greška pri ažuriranju porudžbine")
            loadCandidates()
        }
    }

    const handleRazlogChange = async (leadId: string, newRazlog: string) => {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, razlog: newRazlog || null } : l))
        setEditingRazlogId(null)
        try {
            await updateKandidat(leadId, { razlog: newRazlog || null })
        } catch {
            toast.error("Greška pri ažuriranju razloga")
            loadCandidates()
        }
    }

    const getStatusColor = (status: string) => {
        const s = status?.toLowerCase()
        if (s === 'poručio')       return 'bg-emerald/15 text-emerald border-emerald/20'
        if (s === 'zakazano')      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
        if (s === 'završeno')      return 'bg-emerald/15 text-emerald border-emerald/20'
        if (s === 'reklamacija')   return 'bg-orange-500/15 text-orange-400 border-orange-500/25'
        if (s === 'zainteresovan') return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        if (s === 'zaposlen')      return 'bg-emerald/15 text-emerald border-emerald/20'
        if (s === 'intervju')      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
        if (s === 'kvalifikovan')  return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        if (s === 'prijavljen')    return 'bg-violet-500/10 text-violet-400 border-violet-500/20'
        if (s === 'intervencija')  return 'bg-orange-500/15 text-orange-400 border-orange-500/25'
        return 'bg-white/5 text-zinc-400 border-white/5'
    }

    const getDeliveryColor = (s: string) => {
        const v = s?.toLowerCase()
        if (v === 'dostavljeno')  return 'bg-emerald/10 text-emerald border-emerald/15'
        if (v === 'poslato')      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/15'
        if (v === 'obrađuje se')  return 'bg-amber-500/10 text-amber-400 border-amber-500/15'
        if (v === 'reklamacija')  return 'bg-orange-500/10 text-orange-400 border-orange-500/15'
        return 'bg-white/5 text-zinc-500 border-white/5'
    }

    const getKanal = (lead: any) => {
        const iz = (lead.izvor || '').toLowerCase()
        if (iz.includes('instagram')) return { label: 'Instagram', color: '#e1306c', icon: 'instagram' as const }
        if (iz.includes('whatsapp'))  return { label: 'WhatsApp',  color: '#25d366', icon: 'whatsapp' as const }
        if (iz.includes('facebook'))  return { label: 'Facebook',  color: '#1877f2', icon: 'facebook' as const }
        if (iz.includes('landing') || iz.includes('website')) return { label: 'Website', color: '#8b5cf6', icon: 'globe' as const }
        return { label: lead.izvor || 'Chatbot', color: '#71717a', icon: 'globe' as const }
    }

    const KanalIcon = ({ type, color }: { type: 'instagram' | 'facebook' | 'whatsapp' | 'globe'; color: string }) => {
        if (type === 'instagram') return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color }}>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" strokeWidth="2" fill="none"/>
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
                <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/>
            </svg>
        )
        if (type === 'facebook') return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color }}>
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
        )
        if (type === 'whatsapp') return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color }}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
        )
        return (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color }}>
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
        )
    }

    const formatRelativeTime = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime()
        const h = Math.floor(diff / 3600000)
        if (h < 1) return 'malopre'
        if (h < 24) return `pre ${h}h`
        const d = Math.floor(h / 24)
        return `pre ${d}d`
    }

    if (!clientId) return null

    // ── Demo CRM rendering (auto-generated demos) ──────────────────────────────
    if (isDemoMode && nicheConfig) {
        const nc = nicheConfig
        const dmColor = nc.brandColor
        const dmFiltered = leads.filter(l => {
            const matchSearch = !searchTerm ||
                l.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                l.kategorija?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                l.proizvod?.toLowerCase().includes(searchTerm.toLowerCase())
            const matchFilter = filter === 'all' || l.status?.toLowerCase() === filter.toLowerCase()
            return matchSearch && matchFilter
        })
        const dmTotal = leads.length
        const dmZakazano = leads.filter(l => ['zakazano', 'završeno'].includes(l.status?.toLowerCase() || '')).length
        const dmReklamacije = leads.filter(l => l.status?.toLowerCase() === 'reklamacija').length
        const dmIntervencije = leads.filter(l => l.status?.toLowerCase() === 'intervencija').length

        return (
            <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                                {nc.crmLabel}
                            </span>
                            <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                                Live Feed
                            </div>
                        </h1>
                        <p className="text-slate-400 mt-2">
                            {`${nc.terminology.plural} koji su kontaktirali agenta — praćenje u realnom vremenu`}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={loadCandidates}
                        className={cn("h-12 px-6 rounded-2xl bg-white/5 border border-white/5 text-silver font-outfit transition-all hover:border-emerald/30", loading && "opacity-50")}
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2 text-emerald", loading && "animate-spin")} />
                        Osveži
                    </Button>
                </div>

                <div className="flex items-center gap-4">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-emerald-500/50" />
                        <Input
                            placeholder={`Pretraži ${nc.terminology.plural.toLowerCase()}, usluge...`}
                            className="pl-10 bg-black/40 border-white/10 text-white placeholder:text-white/20 focus:border-emerald-500/50 rounded-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="bg-black/40 border border-white/10 text-white rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50 transition-colors"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    >
                        <option value="all">Svi statusi</option>
                        {nc.terminology.statuses.map(s => (
                            <option key={s} value={s.toLowerCase()}>{s}</option>
                        ))}
                    </select>
                </div>

                <GlassCard className="overflow-hidden border-white/5">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/5 border-b border-white/10">
                                    <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: dmColor }}>{nc.terminology.singular}</th>
                                    <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: dmColor }}>Kategorija</th>
                                    <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: dmColor }}>Usluga / Interes</th>
                                    <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: dmColor }}>Status</th>
                                    <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: dmColor }}>Kontakt</th>
                                    <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: dmColor }}>Kanal</th>
                                    <th className="p-4" />
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence mode="popLayout">
                                    {loading ? (
                                        <TableRow className="border-none">
                                            <TableCell colSpan={7} className="h-80 text-center">
                                                <div className="flex flex-col items-center gap-4">
                                                    <RefreshCw className="w-10 h-10 text-emerald animate-spin opacity-20" />
                                                    <span className="text-sm text-zinc-500 font-outfit font-light uppercase tracking-widest">Učitavanje...</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : dmFiltered.length === 0 ? (
                                        <TableRow className="border-none">
                                            <TableCell colSpan={7} className="h-80 text-center">
                                                <p className="text-sm font-outfit text-zinc-500 italic">Nema {nc.terminology.plural.toLowerCase()}</p>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        dmFiltered.map((lead, idx) => {
                                            const kanal = getKanal(lead)
                                            const isIntervencija = lead.status?.toLowerCase() === 'intervencija'
                                            const isZakazano = lead.status?.toLowerCase() === 'zakazano'
                                            return (
                                                <motion.tr
                                                    key={lead.id}
                                                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    transition={{ delay: idx * 0.03, duration: 0.4 }}
                                                    className="group border-b border-white/[0.03] transition-all duration-300 relative"
                                                    style={{
                                                        borderLeft: isIntervencija ? '3px solid rgba(239,68,68,0.53)' : '3px solid transparent',
                                                        backgroundColor: isIntervencija ? 'rgba(239,68,68,0.04)' : isZakazano ? 'rgba(16,185,129,0.02)' : undefined,
                                                    }}
                                                >
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-xl border flex items-center justify-center font-bold text-sm shrink-0"
                                                                style={{
                                                                    background: `linear-gradient(135deg, ${dmColor}25, ${dmColor}10)`,
                                                                    borderColor: `${dmColor}30`,
                                                                    color: dmColor,
                                                                }}>
                                                                {lead.full_name?.[0] || 'K'}
                                                            </div>
                                                            <div>
                                                                <div className="font-semibold text-white">{lead.full_name}</div>
                                                                <div className="text-[10px] text-white/30 mt-0.5 font-mono">{formatRelativeTime(lead.created_at)}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        {lead.kategorija ? (
                                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                                                                style={{ background: `${dmColor}15`, border: `1px solid ${dmColor}30`, color: `${dmColor}cc` }}>
                                                                {lead.kategorija}
                                                            </span>
                                                        ) : <span className="text-zinc-700">—</span>}
                                                    </td>
                                                    <td className="p-4 max-w-[200px]">
                                                        {lead.proizvod ? (
                                                            <span className="text-white/85 text-sm font-medium leading-snug line-clamp-2">{lead.proizvod}</span>
                                                        ) : (
                                                            <span className="text-zinc-600 text-xs italic">nije specifikovano</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        {editingStatusId === lead.id ? (
                                                            <select
                                                                autoFocus
                                                                defaultValue={lead.status || 'Novi'}
                                                                onBlur={() => setEditingStatusId(null)}
                                                                onChange={e => handleStatusChange(lead.id, e.target.value)}
                                                                className="bg-black/60 border border-emerald/30 text-white text-xs rounded-lg px-2 py-1.5 outline-none"
                                                            >
                                                                {nc.terminology.statuses.map(s => (
                                                                    <option key={s} value={s}>{s}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <Badge
                                                                onClick={() => setEditingStatusId(lead.id)}
                                                                title="Klikni za izmenu"
                                                                className={cn(
                                                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border cursor-pointer hover:brightness-125 transition-all w-fit",
                                                                    getStatusColor(lead.status || 'Novi')
                                                                )}
                                                            >
                                                                {isIntervencija && <AlertTriangle className="w-2.5 h-2.5 mr-1 inline" />}
                                                                {lead.status || 'Novi'}
                                                            </Badge>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col gap-0.5 text-xs text-zinc-400">
                                                            {lead.email && <span>{lead.email}</span>}
                                                            {lead.telefon && <span>{lead.telefon}</span>}
                                                            {!lead.email && !lead.telefon && <span className="text-zinc-600">—</span>}
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-2">
                                                            <KanalIcon type={kanal.icon} color={kanal.color} />
                                                            <span className="text-[10px] uppercase tracking-widest font-bold font-outfit" style={{ color: kanal.color }}>{kanal.label}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right pr-6">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                title={isIntervencija ? 'Ukloni intervenciju' : 'Označi za intervenciju'}
                                                                onClick={() => handleStatusChange(lead.id, isIntervencija ? 'Novi' : 'Intervencija')}
                                                                className={cn(
                                                                    "w-8 h-8 rounded-xl transition-all",
                                                                    isIntervencija
                                                                        ? "bg-orange-500/20 text-orange-400 opacity-100"
                                                                        : "opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-orange-500/10 hover:text-orange-400 text-zinc-600"
                                                                )}
                                                            >
                                                                <AlertTriangle className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => setSelectedLead(lead)}
                                                                className="w-8 h-8 rounded-xl bg-white/5 transition-all opacity-0 group-hover:opacity-100 hover:bg-emerald/10 hover:text-emerald"
                                                            >
                                                                <User className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </motion.tr>
                                            )
                                        })
                                    )}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </GlassCard>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-1">
                    {[
                        { label: `Ukupno ${nc.terminology.plural}`, value: dmTotal, icon: Sparkles },
                        { label: 'Zakazano / Završeno', value: dmZakazano, icon: UserCheck },
                        { label: 'Reklamacije', value: dmReklamacije, icon: MessageSquare },
                        { label: 'Intervencije', value: dmIntervencije, icon: AlertTriangle },
                    ].map((stat, i) => (
                        <GlassCard key={i} className="p-5 flex items-center gap-4 hover:border-emerald/20 transition-all duration-500 group">
                            <div className="w-10 h-10 rounded-xl bg-emerald/5 border border-emerald/10 flex items-center justify-center group-hover:bg-emerald/10 transition-colors shrink-0">
                                <stat.icon className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5 font-outfit">{stat.label}</p>
                                <p className="text-2xl font-outfit font-bold text-silver">{stat.value}</p>
                            </div>
                        </GlassCard>
                    ))}
                </div>

                <AnimatePresence>
                    {selectedLead && (
                        <LeadIntelligenceViewer
                            lead={selectedLead}
                            isOpen={!!selectedLead}
                            onClose={() => setSelectedLead(null)}
                            isRecruitment={false}
                        />
                    )}
                </AnimatePresence>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
                        {isHarmonija ? (
                            <>
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">CRM</span>
                                <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                                    Live Feed
                                </div>
                            </>
                        ) : (
                            <>
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                                    {terminology.title}
                                </span>
                                <span className="text-white/90">{terminology.highlight}</span>
                                <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                                    Live Feed
                                </div>
                            </>
                        )}
                    </h1>
                    <p className="text-slate-400 mt-2">
                        {isCatalogProducts
                            ? "Kupci koji su kontaktirali agenta — od prvog DM-a do isporučenog proizvoda"
                            : isHarmonija
                                ? "Kupci koji su kontaktirali agenta — od prvog DM-a do dostavljene knjige"
                                : `Praćenje dolaznih ${(terminology.entities || 'Kandidata').toLowerCase()} i automatizovanih interakcija`
                        }
                    </p>
                    {isHarmonija && bookStoreConfig && (
                        <div className="flex items-center gap-2 mt-3">
                            <div className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                                style={{ background: `${bookStoreConfig.color}18`, border: `1px solid ${bookStoreConfig.color}30`, color: bookStoreConfig.color }}>
                                {bookStoreConfig.brandName}
                            </div>
                            <span className="text-zinc-600 text-[10px] font-mono">{bookStoreConfig.instagramHandle}</span>
                            <span className="text-zinc-700 text-[10px]">·</span>
                            <span className="text-zinc-600 text-[10px] font-mono">{bookStoreConfig.websiteUrl}</span>
                        </div>
                    )}
                </div>
                <Button
                    variant="ghost"
                    onClick={loadCandidates}
                    className={cn(
                        "h-12 px-6 rounded-2xl bg-white/5 border border-white/5 text-silver font-outfit transition-all hover:border-emerald/30",
                        loading && "opacity-50"
                    )}
                >
                    <RefreshCw className={cn("w-4 h-4 mr-2 text-emerald", loading && "animate-spin")} />
                    Osveži Feed
                </Button>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-emerald-500/50" />
                    <Input
                        placeholder={isCatalogProducts ? "Pretraži kupce, proizvode..." : isHarmonija ? "Pretraži kupce, naslove..." : (terminology.searchPlaceholder || "Pretraži kandidate...")}
                        className="pl-10 bg-black/40 border-white/10 text-white placeholder:text-white/20 focus:border-emerald-500/50 rounded-xl"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="bg-black/40 border border-white/10 text-white rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50 transition-colors"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                >
                    {isHarmonija ? (
                        <>
                            <option value="all">Svi kupci</option>
                            <option value="novi">Novi razgovor</option>
                            <option value="zainteresovan">Zainteresovani</option>
                            <option value="poručio">Poručili</option>
                            <option value="intervencija">Intervencija</option>
                        </>
                    ) : isRecruitment ? (
                        <>
                            <option value="all">Svi Statusi</option>
                            <option value="novi">Novi</option>
                            <option value="kvalifikovan">Kvalifikovan</option>
                            <option value="intervju">Intervju</option>
                            <option value="zaposlen">Zaposlen</option>
                            <option value="intervencija">Intervencija</option>
                            <option value="odbijen">Odbijen</option>
                        </>
                    ) : null}
                </select>
            </div>

            <GlassCard className="overflow-hidden border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                                <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: bsColor }}>{isHarmonija ? "Kupac" : "Kandidat"}</th>
                                {isHarmonija ? (
                                    <>
                                        <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: bsColor }}>{bookStoreConfig?.crmTemaLabel || "Kategorija"}</th>
                                        <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: bsColor }}>{bookStoreConfig?.crmProizvodLabel || "Knjiga"}</th>
                                    </>
                                ) : (
                                    <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: bsColor }}>Pozicija</th>
                                )}
                                <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: bsColor }}>Status</th>
                                <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: bsColor }}>{isHarmonija ? "Kontakt" : "Prijavljen"}</th>
                                <th className="p-4 text-xs font-mono uppercase tracking-widest" style={{ color: bsColor }}>Kanal</th>
                                <th className="p-4" />
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {loading ? (
                                    <TableRow className="border-none">
                                        <TableCell colSpan={isHarmonija ? 7 : 6} className="h-80 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <RefreshCw className="w-10 h-10 text-emerald animate-spin opacity-20" />
                                                <span className="text-sm text-zinc-500 font-outfit font-light uppercase tracking-widest">Učitavanje...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLeads.length === 0 ? (
                                    <TableRow className="border-none">
                                        <TableCell colSpan={isHarmonija ? 7 : 6} className="h-80 text-center">
                                            <p className="text-sm font-outfit text-zinc-500 italic">{isHarmonija ? "Nema kupaca" : "Nema kandidata"}</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLeads.map((lead, idx) => {
                                        const kanal = getKanal(lead)
                                        const prijavljen = lead.status?.toLowerCase() !== 'novi'
                                        const isIntervencija = lead.status?.toLowerCase() === 'intervencija'
                                        const isPorucio = lead.status?.toLowerCase() === 'poručio'
                                        const isZainteresovan = lead.status?.toLowerCase() === 'zainteresovan'
                                        const temaValue = isCatalogProducts ? lead.zdravstveni_cilj : lead.tema
                                        const proizvodValue = isCatalogProducts ? lead.proizvod : lead.knjiga

                                        const rowBorderColor = isIntervencija ? 'rgba(239,68,68,0.55)'
                                            : isPorucio ? 'rgba(16,185,129,0.45)'
                                            : isZainteresovan ? 'rgba(245,158,11,0.40)'
                                            : 'transparent'
                                        const rowBgColor = isIntervencija ? 'rgba(239,68,68,0.035)'
                                            : isPorucio ? 'rgba(16,185,129,0.025)'
                                            : undefined

                                        return (
                                            <motion.tr
                                                key={lead.id}
                                                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                transition={{ delay: idx * 0.03, duration: 0.4 }}
                                                className="group border-b border-white/[0.03] transition-all duration-300 relative"
                                                style={{
                                                    borderLeft: `3px solid ${rowBorderColor}`,
                                                    backgroundColor: rowBgColor,
                                                }}
                                                onMouseEnter={e => { if (!isIntervencija && !isPorucio) e.currentTarget.style.backgroundColor = `${bsColor}06` }}
                                                onMouseLeave={e => { if (!isIntervencija && !isPorucio) e.currentTarget.style.backgroundColor = rowBgColor ?? '' }}
                                            >
                                                {/* Kupac */}
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative shrink-0">
                                                            <div className="h-10 w-10 rounded-xl border flex items-center justify-center font-bold text-sm"
                                                                style={{
                                                                    background: `linear-gradient(135deg, ${bsColor}25, ${bsColor}10)`,
                                                                    borderColor: `${bsColor}30`,
                                                                    color: bsColor,
                                                                }}>
                                                                {lead.full_name?.[0] || 'K'}
                                                            </div>
                                                            {/* Brand color dot — shown in multi-brand mode */}
                                                            {lead.brandId && BOOK_STORE_CLIENTS[lead.brandId] && (
                                                                <span
                                                                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-black"
                                                                    style={{ backgroundColor: BOOK_STORE_CLIENTS[lead.brandId].color }}
                                                                    title={BOOK_STORE_CLIENTS[lead.brandId].brandName}
                                                                />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-white">{lead.full_name}</div>
                                                            <div className="text-[10px] text-white/30 mt-0.5 font-mono">
                                                                {formatRelativeTime(lead.created_at)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Bookstore: Kategorija | Knjiga/Proizvod (separate columns) */}
                                                {isHarmonija ? (
                                                    <>
                                                        <td className="p-4">
                                                            {temaValue ? (
                                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                                                                    style={{ background: `${bsColor}15`, border: `1px solid ${bsColor}30`, color: `${bsColor}cc` }}>
                                                                    {temaValue}
                                                                </span>
                                                            ) : (
                                                                <span className="text-zinc-700">—</span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 max-w-[200px]">
                                                            {proizvodValue ? (
                                                                <span className="text-white/85 text-sm font-medium leading-snug line-clamp-2">{proizvodValue}</span>
                                                            ) : (
                                                                <span className="text-zinc-600 text-xs italic">nije specificiran/a</span>
                                                            )}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <td className="p-4">
                                                        <span className="text-white/80 font-medium">{lead.posao || '—'}</span>
                                                    </td>
                                                )}

                                                {/* Status + delivery sub-badge */}
                                                <td className="p-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        {/* Main status */}
                                                        {editingStatusId === lead.id ? (
                                                            <select
                                                                autoFocus
                                                                defaultValue={lead.status || 'Novi'}
                                                                onBlur={() => setEditingStatusId(null)}
                                                                onChange={e => handleStatusChange(lead.id, e.target.value)}
                                                                className="bg-black/60 border border-emerald/30 text-white text-xs rounded-lg px-2 py-1.5 outline-none"
                                                            >
                                                                {STATUS_OPTIONS.map(s => (
                                                                    <option key={s} value={s}>{s}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <Badge
                                                                onClick={() => setEditingStatusId(lead.id)}
                                                                title="Klikni za izmenu"
                                                                className={cn(
                                                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border cursor-pointer hover:brightness-125 transition-all w-fit",
                                                                    getStatusColor(lead.status || 'Novi')
                                                                )}
                                                            >
                                                                {lead.status?.toLowerCase() === 'intervencija' && (
                                                                    <AlertTriangle className="w-2.5 h-2.5 mr-1 inline" />
                                                                )}
                                                                {lead.status || 'Novi'}
                                                            </Badge>
                                                        )}

                                                        {/* Razlog sub-badge — why a Zainteresovan lead didn't convert */}
                                                        {isHarmonija && lead.status?.toLowerCase() === 'zainteresovan' && (
                                                            editingRazlogId === lead.id ? (
                                                                <select
                                                                    autoFocus
                                                                    defaultValue={(lead.razlog ?? lead.komentar) || ''}
                                                                    onBlur={() => setEditingRazlogId(null)}
                                                                    onChange={e => handleRazlogChange(lead.id, e.target.value)}
                                                                    className="bg-black/60 border border-amber-500/30 text-white text-[10px] rounded-lg px-2 py-1 outline-none w-fit"
                                                                >
                                                                    <option value="">— razlog —</option>
                                                                    {RAZLOG_OPTIONS.map(r => (
                                                                        <option key={r} value={r}>{r}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                <span
                                                                    onClick={() => setEditingRazlogId(lead.id)}
                                                                    title="Zašto nije naručio? Klikni za izmenu"
                                                                    className={cn(
                                                                        "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border cursor-pointer hover:brightness-125 transition-all w-fit block",
                                                                        (lead.razlog ?? lead.komentar)
                                                                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                                            : "text-zinc-600 border-white/5 bg-white/[0.02] border-dashed"
                                                                    )}
                                                                >
                                                                    {(lead.razlog ?? lead.komentar) || '+ razlog'}
                                                                </span>
                                                            )
                                                        )}

                                                        {/* Delivery sub-badge — only for bookstore, only when relevant */}
                                                        {isHarmonija && (lead.status_porudzbine || lead.status?.toLowerCase() === 'poručio') && (
                                                            editingDeliveryId === lead.id ? (
                                                                <select
                                                                    autoFocus
                                                                    defaultValue={lead.status_porudzbine || ''}
                                                                    onBlur={() => setEditingDeliveryId(null)}
                                                                    onChange={e => handleDeliveryStatusChange(lead.id, e.target.value)}
                                                                    className="bg-black/60 border border-white/20 text-white text-[10px] rounded-lg px-2 py-1 outline-none w-fit"
                                                                >
                                                                    <option value="">— porudžbina</option>
                                                                    {ORDER_STATUS_OPTIONS.map(s => (
                                                                        <option key={s} value={s}>{s}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                <span
                                                                    onClick={() => setEditingDeliveryId(lead.id)}
                                                                    title="Klikni za izmenu statusa porudžbine"
                                                                    className={cn(
                                                                        "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border cursor-pointer hover:brightness-125 transition-all w-fit flex items-center gap-1",
                                                                        lead.status_porudzbine
                                                                            ? getDeliveryColor(lead.status_porudzbine)
                                                                            : "text-zinc-600 border-white/5 bg-white/[0.02]"
                                                                    )}
                                                                >
                                                                    <Package className="w-2 h-2 inline" />
                                                                    {lead.status_porudzbine || 'porudžbina —'}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Kontakt */}
                                                <td className="p-4">
                                                    {isHarmonija ? (
                                                        <div className="flex flex-col gap-0.5 text-xs text-zinc-400">
                                                            {lead.email && <span>{lead.email}</span>}
                                                            {lead.telefon && <span>{lead.telefon}</span>}
                                                            {!lead.email && !lead.telefon && <span className="text-zinc-600">—</span>}
                                                        </div>
                                                    ) : (
                                                        <span className={cn(
                                                            "text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border",
                                                            prijavljen
                                                                ? "text-emerald border-emerald/20 bg-emerald/5"
                                                                : "text-zinc-600 border-white/5 bg-white/[0.02]"
                                                        )}>
                                                            {prijavljen ? 'Da' : 'Ne'}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Kanal */}
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <KanalIcon type={kanal.icon} color={kanal.color} />
                                                        <span className="text-[10px] uppercase tracking-widest font-bold font-outfit" style={{ color: kanal.color }}>
                                                            {kanal.label}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="p-4 text-right pr-6">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            title={lead.status?.toLowerCase() === 'intervencija' ? 'Ukloni intervenciju' : 'Označi za intervenciju'}
                                                            onClick={() => handleStatusChange(lead.id, lead.status?.toLowerCase() === 'intervencija' ? 'Novi' : 'Intervencija')}
                                                            className={cn(
                                                                "w-8 h-8 rounded-xl transition-all",
                                                                lead.status?.toLowerCase() === 'intervencija'
                                                                    ? "bg-orange-500/20 text-orange-400 opacity-100"
                                                                    : "opacity-0 group-hover:opacity-100 bg-white/5 hover:bg-orange-500/10 hover:text-orange-400 text-zinc-600"
                                                            )}
                                                        >
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => setSelectedLead(lead)}
                                                            className="w-8 h-8 rounded-xl bg-white/5 transition-all opacity-0 group-hover:opacity-100"
                                                            style={{ ['--hover-bg' as string]: `${bsColor}18` } as React.CSSProperties}
                                                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${bsColor}18`; e.currentTarget.style.color = bsColor }}
                                                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '' }}
                                                        >
                                                            <User className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        )
                                    })
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            {/* Footer Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-1">
                {(isHarmonija ? [
                    { label: "Ukupno Kupaca",    value: totalLeads,         icon: Sparkles },
                    { label: "Zainteresovani",   value: bsZainteresovano,   icon: ArrowUpRight },
                    { label: "Poručili",          value: bsPoručilo,         icon: UserCheck },
                    { label: "Intervencije",      value: bsIntervencije,     icon: MessageSquare },
                ] : [
                    { label: "Ukupno Kandidata", value: totalLeads,       icon: Sparkles },
                    { label: "Kvalifikovano",    value: qualifiedLeads,   icon: ArrowUpRight },
                    { label: "Aktivni Intervjui",value: activeInterviews, icon: MessageSquare },
                    { label: "Zaposleno",        value: hired,            icon: UserCheck },
                ]).map((stat, i) => (
                    <GlassCard key={i} className="p-5 flex items-center gap-4 hover:border-emerald/20 transition-all duration-500 group">
                        <div className="w-10 h-10 rounded-xl bg-emerald/5 border border-emerald/10 flex items-center justify-center group-hover:bg-emerald/10 transition-colors shrink-0">
                            <stat.icon className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-0.5 font-outfit">{stat.label}</p>
                            <p className="text-2xl font-outfit font-bold text-silver">{stat.value}</p>
                        </div>
                    </GlassCard>
                ))}
            </div>

            <AnimatePresence>
                {selectedLead && (
                    <LeadIntelligenceViewer
                        lead={selectedLead}
                        isOpen={!!selectedLead}
                        onClose={() => setSelectedLead(null)}
                        isRecruitment={isRecruitment}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
