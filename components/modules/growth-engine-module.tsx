"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { createKandidat, updateKandidat, deleteKandidat } from "@/lib/supabase/queries"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import {
    Users,
    Briefcase,
    CheckCircle2,
    MoreHorizontal,
    MessageSquare,
    LayoutGrid,
    List,
    TrendingUp,
    Sparkles,
    Filter,
    Mail,
    Send,
    UserCheck,
    RefreshCw,
    Search,
    ChevronRight,
    ExternalLink,
    Trash2,
    Star,
    Globe,
    Zap
} from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { GlassCard } from "@/components/ui/glass-card"
import { LeadIntelligenceViewer } from "@/components/dashboard/lead-intelligence-viewer"
import { CRMKanbanBoard } from "@/components/modules/crm-kanban-board"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface GrowthEngineModuleProps {
    clientId: string
    tableName?: string
    statuses: string[]
}

export function GrowthEngineModule({ clientId, tableName = "kontakti", statuses }: GrowthEngineModuleProps) {
    const [leads, setLeads] = useState<any[]>([])
    const [selectedLead, setSelectedLead] = useState<any | null>(null)
    const [isIntelligenceOpen, setIsIntelligenceOpen] = useState(false)
    const [viewMode, setViewMode] = useState<"table" | "board">("board")
    const [searchQuery, setSearchQuery] = useState("")
    const [filterChip, setFilterChip] = useState<"sve" | "vreo" | "topao" | "nema_email" | "starred">("sve")
    const [sortMode, setSortMode] = useState<"datum" | "prioritet">("prioritet")
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Form state for new lead
    const [newLead, setNewLead] = useState<any>({
        ime: "",
        email: "",
        kompanija: "",
        status: "",
        niche: ""
    })

    const supabase = createClient()

    // Niche-aware terminology
    const terminology = useMemo(() => {
        const isRecruitment =
            clientId === '7ac02189-d0ec-4532-baa6-d7d4dc84b87c' || // mjob (formerly Avala)
            clientId === 'OZ Avala' ||
            clientId?.toLowerCase().includes('mjob')

        if (isRecruitment) {
            return {
                title: "Regrutacija",
                highlight: "Engine",
                entity: "Kandidat",
                entities: "Kandidati",
                group: "Pozicija",
                groups: "Pozicije",
                searchPlaceholder: "Pretraži kandidate, pozicije...",
                tableHeaders: ["Profil Kandidata", "Prijavljena Pozicija", "Faza Procesa", "Aktivnost"],
                isRecruitment: true
            }
        }

        return {
            title: "Growth",
            highlight: "Sistem",
            entity: "Lead",
            entities: "Leads",
            group: "Kompanija",
            groups: "Kompanije",
            searchPlaceholder: "Pretraži klijente, imena...",
            tableHeaders: ["Profil / Ime", "Kontakt", "Oferta", "Status Procesa", "Aktivnost"],
            isRecruitment: false
        }
    }, [clientId])

    const fetchLeads = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching leads:', error)
            toast.error("Greška u sinhronizaciji podataka")
        } else {
            setLeads(data || [])
        }
        setLoading(false)
    }, [clientId, tableName, supabase])

    useEffect(() => {
        if (clientId) {
            fetchLeads()

            const channel = supabase
                .channel(`growth-engine-${clientId}`)
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: tableName, filter: `client_id=eq.${clientId}` },
                    () => fetchLeads()
                )
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [clientId, tableName, fetchLeads, supabase])

    const handleRefresh = async () => {
        setRefreshing(true)
        await fetchLeads()
        setTimeout(() => setRefreshing(false), 800)
    }

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))

        try {
            const { error } = await supabase
                .from(tableName)
                .update({ status: newStatus })
                .eq('id', id)

            if (error) throw error
            toast.success("Status sinhronizovan")
        } catch (e) {
            toast.error("Greška u sinhronizaciji")
            console.error(e)
            fetchLeads()
        }
    }

    const handleServiceChange = async (id: string, newService: string) => {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, service: newService } : l))
        try {
            const { error } = await supabase
                .from(tableName)
                .update({ service: newService })
                .eq('id', id)
            if (error) throw error
            toast.success("Oferta ažurirana")
        } catch (e) {
            toast.error("Greška u ažuriranju")
            console.error(e)
            fetchLeads()
        }
    }

    const handleStarToggle = async (id: string, currentStarred: boolean) => {
        const next = !currentStarred
        setLeads(prev => prev.map(l => l.id === id ? { ...l, starred: next } : l))
        try {
            const { error } = await supabase
                .from(tableName)
                .update({ starred: next })
                .eq('id', id)
            if (error) throw error
        } catch (e) {
            setLeads(prev => prev.map(l => l.id === id ? { ...l, starred: currentStarred } : l))
            toast.error("Greška u ažuriranju")
            console.error(e)
        }
    }

    const handleOpenDetails = (lead: any) => {
        setSelectedLead(lead)
        setIsIntelligenceOpen(true)
    }

    const handleDeleteLead = async (id: string) => {
        if (!confirm(`Da li ste sigurni da želite da obrišete ovaj ${terminology.entity.toLowerCase()}?`)) return

        try {
            await deleteKandidat(id)
            setLeads(prev => prev.filter(l => l.id !== id))
            toast.success(`${terminology.entity} obrisan`)
        } catch (e) {
            toast.error("Brisanje nije uspelo")
            console.error(e)
        }
    }

    const handleEditLead = (lead: any) => {
        setSelectedLead(lead)
        setNewLead({
            ime: lead.ime || "",
            email: lead.email || "",
            kompanija: lead.kompanija || lead.company_name || "",
            status: lead.status || "",
            niche: lead.niche || ""
        })
        setIsEditDialogOpen(true)
    }

    const handleUpdateLead = async () => {
        if (!selectedLead) return
        setIsSaving(true)
        try {
            const updated = await updateKandidat(selectedLead.id, newLead)
            if (updated) {
                setLeads(prev => prev.map(l => l.id === selectedLead.id ? updated : l))
                setIsEditDialogOpen(false)
                setSelectedLead(null)
                setNewLead({ ime: "", email: "", kompanija: "", status: "", niche: "" })
                toast.success("Podaci ažurirani")
            }
        } catch (e) {
            toast.error("Ažuriranje nije uspelo")
            console.error(e)
        } finally {
            setIsSaving(false)
        }
    }

    const handleAddLead = async () => {
        if (!newLead.ime) {
            toast.error("Identitet je obavezan")
            return
        }

        setIsSaving(true)
        try {
            const leadData = {
                ...newLead,
                client_id: clientId,
                status: newLead.status || statuses[0]
            }

            const result = await createKandidat(leadData)

            if (result) {
                setLeads(prev => [result, ...prev])
                setIsAddDialogOpen(false)
                setNewLead({ ime: "", email: "", kompanija: "", status: "", niche: "" })
                toast.success("Novi čvor aktiviran")
            }
        } catch (e) {
            toast.error("Aktivacija nije uspela")
            console.error(e)
        } finally {
            setIsSaving(false)
        }
    }

    const filteredLeads = useMemo(() => {
        let result = leads.filter(lead =>
            !searchQuery ||
            lead.ime?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.kompanija?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
        )

        // Filter chips
        if (filterChip === 'vreo') result = result.filter(l => l.kategorija === 'Vreo')
        else if (filterChip === 'topao') result = result.filter(l => l.kategorija === 'Topao')
        else if (filterChip === 'nema_email') result = result.filter(l => !l.email)
        else if (filterChip === 'starred') result = result.filter(l => l.starred)

        // Sort: starred always float to top, then by chosen sort mode
        result = [...result].sort((a, b) => {
            if (a.starred && !b.starred) return -1
            if (!a.starred && b.starred) return 1
            if (sortMode === 'prioritet') {
                return (b.prioritet_skor || 0) - (a.prioritet_skor || 0)
            }
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        })

        return result
    }, [leads, searchQuery, filterChip, sortMode])

    const stats = useMemo(() => {
        const total = leads.length
        const totalSent = leads.filter(l => l.last_sent_at || ['Sent', 'Aktivno'].includes(l.status)).length
        const highIntent = leads.filter(l =>
            l.status?.toLowerCase().includes('intervju') ||
            l.status?.toLowerCase().includes('zakazan') ||
            l.status?.toLowerCase().includes('demo') ||
            l.status === 'Qualified'
        ).length
        const booked = leads.filter(l => l.status === 'Zakazan Sastanak' || l.meeting_time).length

        const criticalLeads = leads.filter(l =>
            (l.meeting_time && l.status !== 'Zakazan Sastanak') ||
            (l.status === 'Qualified' && !l.last_sent_at)
        )

        return {
            total,
            totalSent,
            highIntent,
            booked,
            criticalLeads,
            conversion: total > 0 ? ((booked / total) * 100).toFixed(1) : "0"
        }
    }, [leads])

    return (
        <div className="space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald/10 border border-emerald/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                            <TrendingUp className="w-6 h-6 text-emerald" />
                        </div>
                        <h2 className="text-4xl font-outfit font-bold text-silver tracking-tight italic">
                            {terminology.title} <span className="text-emerald not-italic font-black uppercase tracking-tighter">{terminology.highlight}</span>
                        </h2>
                        <Badge className="bg-white/5 text-emerald border-white/10 font-outfit font-normal tracking-widest px-3 py-1">
                            {terminology.entities.toUpperCase()}: {stats.total}
                        </Badge>
                    </div>
                    <p className="text-silver/40 font-outfit text-lg max-w-xl font-light">
                        Objedinjena inteligencija i upravljanje {(terminology.entities || 'Kandidatima').toLowerCase()} u procesu.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <AnimatePresence>
                        {stats.criticalLeads.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                            >
                                <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 py-2.5 px-5 rounded-2xl font-bold animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.1)]">
                                    {stats.criticalLeads.length} Obaveštenja
                                </Badge>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <Button
                        onClick={() => {
                            setNewLead({ ime: "", email: "", kompanija: "", status: statuses[0], niche: "" })
                            setIsAddDialogOpen(true)
                        }}
                        className="h-12 px-6 rounded-2xl bg-emerald text-obsidian font-outfit font-bold hover:bg-emerald/90 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] group"
                    >
                        <Sparkles className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                        Dodaj {terminology.entity}
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={handleRefresh}
                        className={cn(
                            "h-12 px-6 rounded-2xl bg-white/5 border border-white/10 text-silver font-outfit transition-all hover:bg-white/10 hover:border-emerald/40 hover:text-white group",
                            refreshing && "opacity-50"
                        )}
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2 text-emerald group-hover:rotate-180 transition-transform duration-700", refreshing && "animate-spin")} />
                        Osveži Podatke
                    </Button>
                </div>
            </div>

            {/* Stats Prism — board mode only */}
            {viewMode === "board" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard
                        label={`Ukupno ${terminology.entities}`}
                        value={stats.total}
                        sub="Aktivna Baza"
                        icon={Users}
                        trend={`+${Math.floor((stats.total / 10) + 1)} ove nedelje`}
                    />
                    <StatCard
                        label="Ciklusi Komunikacije"
                        value={stats.totalSent}
                        sub="Personalizovane Poruke"
                        icon={Send}
                        trend={`${((stats.totalSent / stats.total || 0) * 100).toFixed(0)}% pokrivenost`}
                    />
                    <StatCard
                        label="Visok Interes"
                        value={stats.highIntent}
                        sub="Kvalifikovani Kandidati"
                        icon={Sparkles}
                        trend="Brzina: Optimalna"
                    />
                    <StatCard
                        label="Zakazano"
                        value={stats.booked}
                        sub={`${stats.conversion}% konverzija`}
                        icon={CheckCircle2}
                        trend="ROI Stabilizovan"
                        highlight
                    />
                </div>
            )}

            {/* Operational Layout */}
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        <div className="relative w-full sm:w-80 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald transition-colors" />
                            <Input
                                placeholder={terminology.searchPlaceholder}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-11 h-12 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all placeholder:text-zinc-600"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/10">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "h-10 px-5 rounded-xl font-outfit tracking-widest text-[10px] uppercase font-bold transition-all duration-500",
                                    viewMode === "board" ? "bg-emerald text-obsidian shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "text-zinc-500 hover:text-white"
                                )}
                                onClick={() => setViewMode("board")}
                            >
                                <LayoutGrid className="w-4 h-4 mr-2" />
                                Proces
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "h-10 px-5 rounded-xl font-outfit tracking-widest text-[10px] uppercase font-bold transition-all duration-500",
                                    viewMode === "table" ? "bg-emerald text-obsidian shadow-[0_0_20px_rgba(16,185,129,0.3)]" : "text-zinc-500 hover:text-white"
                                )}
                                onClick={() => setViewMode("table")}
                            >
                                <List className="w-4 h-4 mr-2" />
                                Lista
                            </Button>
                        </div>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="h-80 flex items-center justify-center"
                        >
                            <RefreshCw className="w-12 h-12 text-emerald animate-spin opacity-20" />
                        </motion.div>
                    ) : viewMode === "table" ? (
                        <motion.div
                            key="table"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.4 }}
                            className="space-y-4"
                        >
                            {/* Filter chips + sort — Lista / SmartFlow only */}
                            {!terminology.isRecruitment && (
                                <div className="flex items-center justify-between gap-4 flex-wrap px-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {([
                                            { key: 'sve', label: 'Sve' },
                                            { key: 'vreo', label: '🔴 Vreo' },
                                            { key: 'topao', label: '🟡 Topao' },
                                            { key: 'nema_email', label: 'Nema Email' },
                                            { key: 'starred', label: '★ Starred' },
                                        ] as const).map(chip => (
                                            <button
                                                key={chip.key}
                                                onClick={() => setFilterChip(chip.key)}
                                                className={cn(
                                                    "text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all",
                                                    filterChip === chip.key
                                                        ? 'bg-emerald/15 border-emerald/40 text-emerald'
                                                        : 'bg-white/5 border-white/10 text-zinc-500 hover:text-silver hover:border-white/20'
                                                )}
                                            >
                                                {chip.label}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => setSortMode(m => m === 'prioritet' ? 'datum' : 'prioritet')}
                                        className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border bg-white/5 border-white/10 text-zinc-500 hover:text-silver hover:border-white/20 transition-all"
                                    >
                                        Sort: {sortMode === 'prioritet' ? 'Prioritet' : 'Datum'}
                                    </button>
                                </div>
                            )}
                            {/* Compact stats bar — Lista mode only */}
                            {!terminology.isRecruitment && (
                                <div className="flex items-center gap-5 px-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Ukupno</span>
                                        <span className="text-sm font-black text-silver">{stats.total}</span>
                                    </div>
                                    <div className="w-px h-3 bg-white/10" />
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                        <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Vreo</span>
                                        <span className="text-sm font-black text-rose-400">{leads.filter(l => l.kategorija === 'Vreo').length}</span>
                                    </div>
                                    <div className="w-px h-3 bg-white/10" />
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                        <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Topao</span>
                                        <span className="text-sm font-black text-amber-400">{leads.filter(l => l.kategorija === 'Topao').length}</span>
                                    </div>
                                    <div className="w-px h-3 bg-white/10" />
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald" />
                                        <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Email</span>
                                        <span className="text-sm font-black text-emerald">{leads.filter(l => l.email).length}<span className="text-zinc-600 font-normal">/{stats.total}</span></span>
                                    </div>
                                    <div className="w-px h-3 bg-white/10" />
                                    <div className="flex items-center gap-1.5">
                                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                                        <span className="text-sm font-black text-amber-400">{leads.filter(l => l.starred).length}</span>
                                        <span className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">starred</span>
                                    </div>
                                </div>
                            )}
                            <GlassCard className="rounded-[2.5rem] overflow-hidden p-0 border-white/10 shadow-2xl">
                                <Table>
                                    <TableHeader className="bg-white/[0.03] border-b border-white/5">
                                        <TableRow className="hover:bg-transparent border-none">
                                            {terminology.tableHeaders.map((header, i) => (
                                                <TableHead key={i} className={cn(
                                                    "text-zinc-500 font-black text-[9px] uppercase tracking-[0.2em] py-6",
                                                    i === 0 ? "pl-10" : ""
                                                )}>
                                                    {header}
                                                </TableHead>
                                            ))}
                                            <TableHead className="text-right pr-10 py-6 text-zinc-500 font-black text-[9px] uppercase tracking-[0.2em]">Akcije</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLeads.length === 0 ? (
                                            <TableRow className="hover:bg-transparent border-none">
                                                <TableCell colSpan={terminology.isRecruitment ? 5 : 6} className="h-60 text-center">
                                                    <p className="text-sm font-light tracking-[0.3em] uppercase text-zinc-700">Nema rezultata pretrage</p>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredLeads.map((lead) => (
                                                <TableRow key={lead.id} className="group hover:bg-white/[0.03] border-white/5 transition-all duration-300">
                                                    {/* Col 1: Name + quality signals */}
                                                    <TableCell className="pl-10 py-4">
                                                        <div className="flex items-start gap-2">
                                                            <button
                                                                onClick={e => { e.stopPropagation(); handleStarToggle(lead.id, !!lead.starred) }}
                                                                className="mt-0.5 shrink-0 transition-all hover:scale-125"
                                                                title={lead.starred ? "Ukloni star" : "Dodaj star"}
                                                            >
                                                                <Star className={cn(
                                                                    "w-3.5 h-3.5 transition-colors",
                                                                    lead.starred ? "text-amber-400 fill-amber-400" : "text-zinc-700 hover:text-amber-400"
                                                                )} />
                                                            </button>
                                                            <div>
                                                                <div className="font-outfit text-silver group-hover:text-white transition-colors font-medium leading-snug">
                                                                    {lead.ime || lead.name || lead.company_name}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                                    {lead.kategorija && (
                                                                        <span className={cn(
                                                                            "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                                                                            lead.kategorija === 'Vreo' ? 'bg-rose-500/15 text-rose-400' :
                                                                            lead.kategorija === 'Topao' ? 'bg-amber-500/15 text-amber-400' :
                                                                            'bg-blue-500/15 text-blue-400'
                                                                        )}>
                                                                            {lead.kategorija}
                                                                        </span>
                                                                    )}
                                                                    {lead.intake_data?.page_followers > 0 && (
                                                                        <span className="text-[10px] text-zinc-600">
                                                                            {lead.intake_data.page_followers >= 1000
                                                                                ? `${(lead.intake_data.page_followers / 1000).toFixed(0)}k`
                                                                                : lead.intake_data.page_followers} pratilaca
                                                                        </span>
                                                                    )}
                                                                    {lead.intake_data?.active_ads_count > 0 && (
                                                                        <span className="text-[10px] text-zinc-600">
                                                                            · <Zap className="w-2.5 h-2.5 inline text-amber-500/70" /> {lead.intake_data.active_ads_count} oglasa
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    {/* Col 2: Contact + enrichment status */}
                                                    <TableCell className="py-4">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <div className={cn(
                                                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                                                    lead.email ? 'bg-emerald shadow-[0_0_4px_rgba(16,185,129,0.6)]' : 'bg-zinc-700'
                                                                )} />
                                                                <span className={cn(
                                                                    "text-sm font-outfit",
                                                                    lead.email ? 'text-zinc-300 group-hover:text-emerald transition-colors' : 'text-zinc-600 italic text-[11px]'
                                                                )}>
                                                                    {lead.email || 'nema emaila'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 pl-3">
                                                                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{lead.niche || 'Nema Sektora'}</span>
                                                                {lead.website && (
                                                                    <a href={lead.website} target="_blank" rel="noreferrer"
                                                                        onClick={e => e.stopPropagation()}
                                                                        className="text-zinc-700 hover:text-emerald transition-colors">
                                                                        <Globe className="w-2.5 h-2.5" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    {/* Col 3: Service/Offer selector */}
                                                    {!terminology.isRecruitment && (
                                                        <TableCell className="py-4">
                                                            <select
                                                                value={lead.service || 'social_media_system'}
                                                                onChange={(e) => handleServiceChange(lead.id, e.target.value)}
                                                                className={cn(
                                                                    "border rounded-lg text-[10px] font-outfit font-bold px-2 py-1.5 cursor-pointer transition-all focus:outline-none uppercase tracking-wide max-w-[140px]",
                                                                    (lead.service || 'social_media_system') === 'social_media_system'
                                                                        ? 'border-blue-500/30 text-blue-400 hover:border-blue-500/60'
                                                                        : (lead.service) === 'ai_organic_content'
                                                                        ? 'border-emerald/30 text-emerald hover:border-emerald/60'
                                                                        : 'border-orange-500/30 text-orange-400 hover:border-orange-500/60'
                                                                )}
                                                                style={{
                                                                    background: (lead.service || 'social_media_system') === 'social_media_system'
                                                                        ? 'rgba(59,130,246,0.07)'
                                                                        : lead.service === 'ai_organic_content'
                                                                        ? 'rgba(16,185,129,0.07)'
                                                                        : 'rgba(249,115,22,0.07)'
                                                                }}
                                                            >
                                                                <option value="social_media_system">Social Media</option>
                                                                <option value="ai_organic_content">AI Content</option>
                                                                <option value="ai_sales_systems">AI Sales</option>
                                                            </select>
                                                        </TableCell>
                                                    )}
                                                    {/* Col 4: Status */}
                                                    <TableCell className="py-4">
                                                        <StatusBadge
                                                            status={lead.status || "Inicijalni"}
                                                            statuses={statuses}
                                                            onUpdate={(s: string) => handleStatusUpdate(lead.id, s)}
                                                        />
                                                    </TableCell>
                                                    {/* Col 5: Activity */}
                                                    <TableCell className="py-4">
                                                        <div className="flex flex-col gap-1">
                                                            {lead.last_sent_at ? (
                                                                <div className="text-[11px] text-zinc-400 font-outfit">
                                                                    Poslato {new Date(lead.last_sent_at).toLocaleDateString("sr-RS")}
                                                                </div>
                                                            ) : lead.intake_data?.scraped_at ? (
                                                                <div className="text-[11px] text-zinc-600 font-outfit">
                                                                    Scraped {new Date(lead.intake_data.scraped_at).toLocaleDateString("sr-RS")}
                                                                </div>
                                                            ) : (
                                                                <div className="text-[11px] text-zinc-700 italic font-outfit">Bez aktivnosti</div>
                                                            )}
                                                            <div className="flex gap-1 flex-wrap">
                                                                {lead.meeting_time && <Badge className="bg-emerald/10 text-emerald text-[8px] py-0 px-1.5 border-emerald/20">SASTANAK</Badge>}
                                                                {lead.last_sent_at && <Badge className="bg-blue-500/10 text-blue-400 text-[8px] py-0 px-1.5 border-blue-500/20">POSLATO</Badge>}
                                                                {lead.email_draft && !lead.last_sent_at && <Badge className="bg-amber-500/10 text-amber-400 text-[8px] py-0 px-1.5 border-amber-500/20">DRAFT</Badge>}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    {/* Actions */}
                                                    <TableCell className="text-right pr-10 py-4">
                                                        <div className="flex gap-2 justify-end">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleOpenDetails(lead)}
                                                                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:border-emerald/40 text-zinc-500 hover:text-emerald transition-all duration-300 group/btn"
                                                            >
                                                                <MessageSquare className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                                                            </Button>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-zinc-500 hover:text-white transition-all duration-300"
                                                                    >
                                                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="glass-panel border-white/10 rounded-2xl w-[180px] p-2 bg-obsidian/95 backdrop-blur-3xl">
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleEditLead(lead)}
                                                                        className="rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer text-xs font-bold py-3 transition-all"
                                                                    >
                                                                        <Sparkles className="w-4 h-4 mr-2 text-emerald" />
                                                                        Izmeni
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem
                                                                        onClick={() => handleDeleteLead(lead.id)}
                                                                        className="rounded-xl text-rose-400 hover:text-white hover:bg-rose-500/20 cursor-pointer text-xs font-bold py-3 transition-all"
                                                                    >
                                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                                        Obriši
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </GlassCard>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="board"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.4 }}
                        >
                            <CRMKanbanBoard
                                leads={filteredLeads}
                                stages={statuses}
                                onStatusUpdate={handleStatusUpdate}
                                onOpenDetails={handleOpenDetails}
                                onEditLead={handleEditLead}
                                onDeleteLead={handleDeleteLead}
                                terminology={terminology}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <LeadIntelligenceViewer
                lead={selectedLead}
                isOpen={isIntelligenceOpen}
                onClose={() => setIsIntelligenceOpen(false)}
            />

            {/* Add Lead Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogContent className="glass-panel border-white/10 rounded-[2rem] bg-obsidian/95 backdrop-blur-3xl text-silver max-w-lg shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-3xl font-outfit font-bold italic">
                            Dodaj <span className="text-emerald not-italic font-black text-4xl">KANDIDATA</span>
                        </DialogTitle>
                        <p className="text-silver/40 text-sm font-light mt-2 tracking-wide">
                            Unesite parametre za novi unos u bazu.
                        </p>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Profil / Ime</Label>
                            <Input
                                value={newLead.ime}
                                onChange={(e) => setNewLead({ ...newLead, ime: e.target.value })}
                                placeholder="Puno Ime"
                                className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all text-lg"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Email / Kontakt</Label>
                                <Input
                                    value={newLead.email}
                                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                                    placeholder="email@primer.com"
                                    className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">{terminology.group}</Label>
                                <Input
                                    value={newLead.kompanija}
                                    onChange={(e) => setNewLead({ ...newLead, kompanija: e.target.value })}
                                    placeholder="Organizacija / Pozicija"
                                    className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Status</Label>
                                <Select
                                    value={newLead.status}
                                    onValueChange={(v) => setNewLead({ ...newLead, status: v })}
                                >
                                    <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all">
                                        <SelectValue placeholder="Odaberi status" />
                                    </SelectTrigger>
                                    <SelectContent className="glass-panel border-white/10 bg-obsidian text-silver rounded-2xl">
                                        {statuses.map(s => (
                                            <SelectItem key={s} value={s} className="rounded-xl hover:bg-emerald/10 focus:bg-emerald/10 transition-colors">
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Sektor (Niche)</Label>
                                <Input
                                    value={newLead.niche}
                                    onChange={(e) => setNewLead({ ...newLead, niche: e.target.value })}
                                    placeholder="Specijalizacija"
                                    className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-8 flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => setIsAddDialogOpen(false)}
                            className="h-14 px-8 rounded-2xl font-outfit text-zinc-500 hover:text-white transition-all uppercase tracking-widest text-xs"
                        >
                            Odustani
                        </Button>
                        <Button
                            onClick={handleAddLead}
                            disabled={isSaving}
                            className="h-14 px-10 rounded-2xl bg-emerald text-obsidian font-outfit font-black hover:bg-emerald/90 transition-all shadow-[0_10px_30px_rgba(16,185,129,0.3)] min-w-[160px] uppercase tracking-widest text-xs"
                        >
                            {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Dodaj"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Lead Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="glass-panel border-white/10 rounded-[2rem] bg-obsidian/95 backdrop-blur-3xl text-silver max-w-lg shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-3xl font-outfit font-bold italic">
                            Modifikuj <span className="text-emerald not-italic font-black text-4xl">PODATKE</span>
                        </DialogTitle>
                        <p className="text-silver/40 text-sm font-light mt-2 tracking-wide">
                            Rekonfiguracija parametara kandidata.
                        </p>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Profil / Ime</Label>
                            <Input
                                value={newLead.ime}
                                onChange={(e) => setNewLead({ ...newLead, ime: e.target.value })}
                                placeholder="Puno Ime"
                                className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all text-lg"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Kontakt Kanal</Label>
                                <Input
                                    value={newLead.email}
                                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                                    placeholder="email@primer.com"
                                    className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">{terminology.group}</Label>
                                <Input
                                    value={newLead.kompanija}
                                    onChange={(e) => setNewLead({ ...newLead, kompanija: e.target.value })}
                                    placeholder="Organizacija / Pozicija"
                                    className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Status Procesa</Label>
                                <Select
                                    value={newLead.status}
                                    onValueChange={(v) => setNewLead({ ...newLead, status: v })}
                                >
                                    <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all">
                                        <SelectValue placeholder="Odaberi status" />
                                    </SelectTrigger>
                                    <SelectContent className="glass-panel border-white/10 bg-obsidian text-silver rounded-2xl">
                                        {statuses.map(s => (
                                            <SelectItem key={s} value={s} className="rounded-xl hover:bg-emerald/10 focus:bg-emerald/10 transition-colors">
                                                {s}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase tracking-[0.2em] font-black text-zinc-500 pl-1">Sektor (Niche)</Label>
                                <Input
                                    value={newLead.niche}
                                    onChange={(e) => setNewLead({ ...newLead, niche: e.target.value })}
                                    placeholder="Specijalizacija"
                                    className="h-14 bg-white/5 border-white/10 rounded-2xl font-outfit focus:border-emerald/40 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-8 flex gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => setIsEditDialogOpen(false)}
                            className="h-14 px-8 rounded-2xl font-outfit text-zinc-500 hover:text-white transition-all uppercase tracking-widest text-xs"
                        >
                            Odustani
                        </Button>
                        <Button
                            onClick={handleUpdateLead}
                            disabled={isSaving}
                            className="h-14 px-10 rounded-2xl bg-emerald text-obsidian font-outfit font-black hover:bg-emerald/90 transition-all shadow-[0_10px_30px_rgba(16,185,129,0.3)] min-w-[160px] uppercase tracking-widest text-xs"
                        >
                            {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : "Sačuvaj izmene"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function StatCard({ label, value, icon: Icon, sub, trend, highlight = false }: any) {
    return (
        <GlassCard className={cn(
            "p-8 rounded-[2.5rem] group h-full transition-all duration-700 bg-white/[0.02] border-white/10",
            highlight && "border-emerald/30 bg-emerald/[0.03]"
        )}>
            <div className="absolute top-8 right-8 p-3.5 rounded-2xl bg-white/5 border border-white/10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 group-hover:border-emerald/30 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                <Icon className={cn("w-5 h-5 transition-colors", highlight ? "text-emerald" : "text-zinc-600 group-hover:text-emerald")} />
            </div>

            <div className="space-y-5">
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] mb-2">{label}</p>
                <div className="space-y-1.5">
                    <h3 className="text-5xl font-outfit font-light text-silver group-hover:text-white transition-all tracking-tighter">
                        {value}
                    </h3>
                    <p className="text-xs font-outfit text-zinc-600 group-hover:text-emerald/60 transition-colors uppercase tracking-[0.2em] font-medium">{sub}</p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                    <span className="text-[9px] font-black text-emerald tracking-[0.1em] bg-emerald/10 border border-emerald/20 px-3 py-1 rounded-lg uppercase">
                        {trend}
                    </span>
                </div>
            </div>

            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-emerald/5 rounded-full blur-[60px] group-hover:bg-emerald/20 transition-all duration-1000 pointer-events-none" />
        </GlassCard>
    )
}

function StatusBadge({ status, statuses, onUpdate }: any) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "h-10 rounded-2xl justify-between items-center font-black text-[9px] uppercase tracking-[0.2em] px-5 bg-white/5 border border-white/10 hover:border-emerald/40 group/btn transition-all duration-500 shadow-md"
                    )}
                >
                    <div className="flex items-center gap-3 truncate text-zinc-500 group-hover/btn:text-emerald transition-colors">
                        <div className={cn(
                            "w-2 h-2 rounded-full shadow-[0_0_12px_currentcolor]",
                            status.includes('Zakazan') || status.includes('Qualified') || status.includes('Zaposlen') ? "bg-emerald text-emerald" :
                                status.includes('Odbijen') || status.includes('Lost') ? "bg-rose-500 text-rose-500" :
                                    status.includes('Novi') ? "bg-blue-400 text-blue-400" : "bg-zinc-600 text-zinc-600"
                        )} />
                        {status}
                    </div>
                    <MoreHorizontal className="w-3.5 h-3.5 opacity-30 ml-3 group-hover/btn:opacity-100 group-hover/btn:scale-125 transition-all" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-panel border-white/10 rounded-2xl w-[220px] p-2 bg-obsidian/95 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                {statuses.map((s: string) => (
                    <DropdownMenuItem
                        key={s}
                        onClick={() => onUpdate(s)}
                        className="rounded-xl text-zinc-500 hover:text-emerald hover:bg-white/5 cursor-pointer text-[10px] font-black uppercase tracking-[0.2em] py-4 px-5 transition-all"
                    >
                        {s}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
