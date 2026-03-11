"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
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
    ExternalLink
} from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"
import { GlassCard } from "@/components/ui/glass-card"
import { LeadIntelligenceViewer } from "@/components/dashboard/lead-intelligence-viewer"
import { CRMKanbanBoard } from "@/components/modules/crm-kanban-board"
import { Input } from "@/components/ui/input"

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
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const supabase = createClient()

    // Niche-aware terminology
    const terminology = useMemo(() => {
        const isAvala = clientId === '7ac02189-d0ec-4532-baa6-d7d4dc84b87c' || clientId === 'OZ Avala'

        if (isAvala) {
            return {
                title: "Recruitment",
                highlight: "Engine",
                entity: "Candidate",
                entities: "Candidates",
                group: "Position",
                groups: "Positions",
                searchPlaceholder: "Search candidates, roles...",
                tableHeaders: ["Candidate Profile", "Applied Position", "Lifecycle Phase", "Activity"]
            }
        }

        return {
            title: "Growth",
            highlight: "Engine",
            entity: "Lead",
            entities: "Leads",
            group: "Company",
            groups: "Companies",
            searchPlaceholder: "Search trajectories, names...",
            tableHeaders: ["Identity Profile", "Comms Node", "Vector Status", "Activity"]
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
            toast.error("Data Sync Failure")
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
            toast.success("Status Synchronized")
        } catch (e) {
            toast.error("Handshake Failed")
            console.error(e)
            fetchLeads()
        }
    }

    const handleOpenDetails = (lead: any) => {
        setSelectedLead(lead)
        setIsIntelligenceOpen(true)
    }

    const filteredLeads = useMemo(() => {
        return leads.filter(lead =>
            lead.ime?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.kompanija?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            lead.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [leads, searchQuery])

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
                        Unified {terminology.entity.toLowerCase()} intelligence and pipeline operation.
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
                                    {stats.criticalLeads.length} Node Alerts
                                </Badge>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <Button
                        variant="ghost"
                        onClick={handleRefresh}
                        className={cn(
                            "h-12 px-6 rounded-2xl bg-white/5 border border-white/10 text-silver font-outfit transition-all hover:bg-white/10 hover:border-emerald/40 hover:text-white group",
                            refreshing && "opacity-50"
                        )}
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2 text-emerald group-hover:rotate-180 transition-transform duration-700", refreshing && "animate-spin")} />
                        Refresh Nodes
                    </Button>
                </div>
            </div>

            {/* Stats Prism */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label={`Total ${terminology.entities}`}
                    value={stats.total}
                    sub="Active Database"
                    icon={Users}
                    trend={`+${Math.floor(Math.random() * 5)} flow`}
                />
                <StatCard
                    label="Outreach Cycles"
                    value={stats.totalSent}
                    sub="Personalized Sent"
                    icon={Send}
                    trend={`${((stats.totalSent / stats.total || 0) * 100).toFixed(0)}% coverage`}
                />
                <StatCard
                    label="High Intent"
                    value={stats.highIntent}
                    sub="Qualified Nodes"
                    icon={Sparkles}
                    trend="Velocity: 1.2x"
                />
                <StatCard
                    label="Booked Ops"
                    value={stats.booked}
                    sub={`${stats.conversion}% conversion`}
                    icon={CheckCircle2}
                    trend="ROI Stabilized"
                    highlight
                />
            </div>

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
                                Pipeline
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
                                Spectrum
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
                        >
                            <GlassCard className="rounded-[2.5rem] overflow-hidden p-0 border-white/10 shadow-2xl">
                                <Table>
                                    <TableHeader className="bg-white/[0.03] border-b border-white/5">
                                        <TableRow className="hover:bg-transparent border-none">
                                            {terminology.tableHeaders.map((header, i) => (
                                                <TableHead key={i} className={cn(
                                                    "text-zinc-500 font-black text-[9px] uppercase tracking-[0.2em] py-8",
                                                    i === 0 ? "pl-10" : ""
                                                )}>
                                                    {header}
                                                </TableHead>
                                            ))}
                                            <TableHead className="text-right pr-10 py-8 text-zinc-500 font-black text-[9px] uppercase tracking-[0.2em]">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredLeads.length === 0 ? (
                                            <TableRow className="hover:bg-transparent border-none">
                                                <TableCell colSpan={5} className="h-60 text-center">
                                                    <p className="text-sm font-light tracking-[0.3em] uppercase text-zinc-700">No matching trajectories</p>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredLeads.map((lead) => (
                                                <TableRow key={lead.id} className="group hover:bg-white/[0.03] border-white/5 transition-all duration-300">
                                                    <TableCell className="pl-10 py-6">
                                                        <div className="font-outfit text-silver group-hover:text-white transition-colors text-lg font-medium">{lead.ime}</div>
                                                        <div className="text-xs text-zinc-500 font-light mt-1 tracking-wide">{lead.kompanija || lead.company_name}</div>
                                                    </TableCell>
                                                    <TableCell className="py-6">
                                                        <div className="flex flex-col text-sm text-zinc-400 font-light font-outfit tracking-wide">
                                                            <span className="group-hover:text-emerald transition-colors">{lead.email}</span>
                                                            <span className="text-[10px] text-zinc-600 mt-1 uppercase tracking-widest">{lead.niche || 'No Sector'}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-6">
                                                        <StatusBadge
                                                            status={lead.status || "Initial"}
                                                            statuses={statuses}
                                                            onUpdate={(s: string) => handleStatusUpdate(lead.id, s)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="py-6">
                                                        <div className="flex flex-col gap-1.5">
                                                            <div className="text-[11px] text-zinc-500 font-outfit uppercase tracking-wider font-bold">
                                                                {lead.last_sent_at ? `Broadcast ${new Date(lead.last_sent_at).toLocaleDateString()}` : 'Dormant Node'}
                                                            </div>
                                                            <div className="flex gap-1">
                                                                {lead.meeting_time && <Badge className="bg-emerald/10 text-emerald text-[8px] py-0 px-1 border-emerald/20">MEETING</Badge>}
                                                                {lead.last_sent_at && <Badge className="bg-blue-500/10 text-blue-400 text-[8px] py-0 px-1 border-blue-500/20">SENT</Badge>}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-10 py-6">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleOpenDetails(lead)}
                                                            className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald/40 text-zinc-500 hover:text-emerald transition-all duration-500 shadow-lg group/btn"
                                                        >
                                                            <MessageSquare className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                                                        </Button>
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
