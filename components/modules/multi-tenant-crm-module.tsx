"use client"

import { useState, useEffect, useCallback } from "react"
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
import { Users, Briefcase, CheckCircle2, MoreHorizontal, MessageSquare, LayoutGrid, List, TrendingUp, Sparkles, Filter } from "lucide-react"
import { toast } from "sonner"
import { LeadIntelligenceViewer } from "@/components/dashboard/lead-intelligence-viewer"
import { CRMKanbanBoard } from "@/components/modules/crm-kanban-board"

interface MultiTenantCRMModuleProps {
    clientId: string
    tableName: string
    statuses: string[]
    showAgencyMetrics: boolean
}

export function MultiTenantCRMModule({ clientId, tableName, statuses, showAgencyMetrics }: MultiTenantCRMModuleProps) {
    const [leads, setLeads] = useState<any[]>([])
    const [selectedLead, setSelectedLead] = useState<any | null>(null)
    const [isIntelligenceOpen, setIsIntelligenceOpen] = useState(false)
    const [viewMode, setViewMode] = useState<"table" | "board">("board")
    const [stats, setStats] = useState({
        totalCandidates: 0,
        interviewsScheduled: 0,
        hired: 0,
    })

    const supabase = createClient()

    const calculateStats = useCallback((data: any[]) => {
        const total = data.length
        if (total === 0) {
            setStats({ totalCandidates: 0, interviewsScheduled: 0, hired: 0 })
            return
        }

        const interviews = data.filter(l =>
            l.status?.toLowerCase().includes('intervju') ||
            l.status?.toLowerCase().includes('zakazan') ||
            l.status?.toLowerCase().includes('demo') ||
            l.status?.toLowerCase().includes('scheduled') ||
            l.status?.toLowerCase().includes('booking') ||
            l.status === 'Meeting Booked'
        ).length

        const hired = data.filter(l =>
            l.status?.toLowerCase().includes('zaposlen') ||
            l.status?.toLowerCase().includes('closed') ||
            l.status?.toLowerCase().includes('won')
        ).length

        setStats({
            totalCandidates: total,
            interviewsScheduled: interviews,
            hired,
        })
    }, [])

    const fetchLeads = useCallback(async () => {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching leads:', error)
            return
        }

        setLeads(data || [])
        calculateStats(data || [])
    }, [clientId, tableName, calculateStats, supabase])

    useEffect(() => {
        if (clientId) {
            fetchLeads()

            const channel = supabase
                .channel(`crm-${clientId}`)
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

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l))

        try {
            const { error } = await supabase
                .from(tableName)
                .update({ status: newStatus })
                .eq('id', id)

            if (error) throw error
            toast.success("Status Synchronized")
            fetchLeads()
        } catch (e) {
            toast.error("Handshake Failed")
            console.error(e)
        }
    }

    const handleOpenDetails = (lead: any) => {
        setSelectedLead(lead)
        setIsIntelligenceOpen(true)
    }

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Stats Grid - Generalized */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <StatCard
                    label="Active Pipeline"
                    value={stats.totalCandidates}
                    icon={Users}
                    trend="+12% from last node"
                    color="emerald"
                />
                <StatCard
                    label="High Intent Nodes"
                    value={stats.interviewsScheduled}
                    icon={Sparkles}
                    trend="Velocity: 2.4/day"
                    color="emerald"
                />
                <StatCard
                    label="Capital Realized"
                    value={stats.hired}
                    icon={CheckCircle2}
                    trend="Conversion: 18.5%"
                    color="emerald"
                />
            </div>

            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-emerald" />
                            <span className="text-[10px] font-bold text-emerald uppercase tracking-[0.2em]">Operational View</span>
                        </div>
                        <h3 className="text-2xl font-outfit font-light text-silver tracking-tight">Lead Trajectories</h3>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/5">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "h-9 px-4 rounded-xl font-outfit tracking-wide transition-all duration-500",
                                    viewMode === "board" ? "bg-emerald text-obsidian shadow-lg" : "text-zinc-500 hover:text-white"
                                )}
                                onClick={() => setViewMode("board")}
                            >
                                <LayoutGrid className="w-4 h-4 mr-2" />
                                Kanban
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "h-9 px-4 rounded-xl font-outfit tracking-wide transition-all duration-500",
                                    viewMode === "table" ? "bg-emerald text-obsidian shadow-lg" : "text-zinc-500 hover:text-white"
                                )}
                                onClick={() => setViewMode("table")}
                            >
                                <List className="w-4 h-4 mr-2" />
                                Spectrum
                            </Button>
                        </div>
                        <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 text-zinc-400 hover:text-emerald">
                            <Filter className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {viewMode === "table" ? (
                    <div className="glass-card rounded-[2rem] overflow-hidden border-white/5">
                        <Table>
                            <TableHeader className="bg-white/[0.02] border-b border-white/5">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest pl-8 py-6">Entity Profile</TableHead>
                                    <TableHead className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest py-6">Comms Node</TableHead>
                                    <TableHead className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest py-6">Current Vector</TableHead>
                                    {showAgencyMetrics && (
                                        <>
                                            <TableHead className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest py-6">Intensity</TableHead>
                                            <TableHead className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest py-6">Valuation</TableHead>
                                        </>
                                    )}
                                    <TableHead className="text-right pr-8 py-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leads.length === 0 ? (
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableCell colSpan={showAgencyMetrics ? 6 : 4} className="h-40 text-center">
                                            <div className="flex flex-col items-center justify-center gap-2 opacity-30">
                                                <Users className="w-8 h-8 mb-2" />
                                                <p className="text-sm font-light tracking-widest uppercase">No data nodes initialized</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    leads.map((lead) => (
                                        <TableRow key={lead.id} className="group hover:bg-white/[0.02] border-white/5 transition-all duration-300">
                                            <TableCell className="pl-8 py-5">
                                                <div className="font-outfit text-silver group-hover:text-white transition-colors">{lead.ime}</div>
                                                <div className="text-xs text-zinc-500 font-light mt-0.5">{lead.kompanija}</div>
                                            </TableCell>
                                            <TableCell className="py-5">
                                                <div className="flex flex-col text-sm text-zinc-400 font-light">
                                                    <span>{lead.email}</span>
                                                    <span className="text-[10px] opacity-50">{lead.telefon}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-5">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className={cn(
                                                                "h-8 rounded-full justify-between items-center font-bold text-[9px] uppercase tracking-[0.15em] px-4 bg-white/5 border border-white/5 hover:border-emerald/30 group/btn transition-all duration-500"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2 truncate text-zinc-400 group-hover/btn:text-emerald transition-colors">
                                                                <div className={cn(
                                                                    "w-1.5 h-1.5 rounded-full shadow-[0_0_10px_currentcolor]",
                                                                    lead.status?.includes('Zaposlen') || lead.status?.includes('Closed') ? "bg-emerald text-emerald" :
                                                                        lead.status?.includes('Odbijen') || lead.status?.includes('Lost') ? "bg-rose-500 text-rose-500" :
                                                                            lead.status?.includes('Novi') ? "bg-blue-400 text-blue-400" : "bg-emerald/40 text-emerald/40"
                                                                )} />
                                                                {lead.status || 'Initial'}
                                                            </div>
                                                            <MoreHorizontal className="w-3 h-3 opacity-30 ml-2 group-hover/btn:opacity-100" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="glass-panel border-white/10 rounded-2xl w-[220px] p-2">
                                                        {statuses.map((s) => (
                                                            <DropdownMenuItem
                                                                key={s}
                                                                onClick={() => handleStatusUpdate(lead.id, s)}
                                                                className="rounded-xl text-zinc-400 hover:text-emerald hover:bg-white/5 cursor-pointer text-xs font-bold uppercase tracking-widest py-3 px-4"
                                                            >
                                                                {s}
                                                            </DropdownMenuItem>
                                                        ))}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>

                                            {showAgencyMetrics && (
                                                <>
                                                    <TableCell className="py-5">
                                                        <Badge variant="ghost" className="bg-emerald/10 text-emerald text-[10px] rounded-lg tracking-wider border-emerald/20 px-2 py-0.5">{lead.prioritet_skor || '-'}</Badge>
                                                    </TableCell>
                                                    <TableCell className="py-5">
                                                        <span className="font-mono text-[11px] text-zinc-500 tracking-wider">€{lead.estimated_value?.toLocaleString() || '-'}</span>
                                                    </TableCell>
                                                </>
                                            )}

                                            <TableCell className="text-right pr-8 py-5">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenDetails(lead)}
                                                    className="w-10 h-10 rounded-xl bg-white/5 border border-transparent hover:border-emerald/30 text-zinc-500 hover:text-emerald transition-all duration-300"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <CRMKanbanBoard
                        leads={leads}
                        stages={statuses}
                        onStatusUpdate={handleStatusUpdate}
                        onOpenDetails={handleOpenDetails}
                    />
                )}
            </div>

            <LeadIntelligenceViewer
                lead={selectedLead}
                isOpen={isIntelligenceOpen}
                onClose={() => setIsIntelligenceOpen(false)}
                isClientView={!showAgencyMetrics}
            />
        </div>
    )
}

function StatCard({ label, value, icon: Icon, trend, color }: { label: string, value: number, icon: any, trend: string, color: string }) {
    return (
        <div className="glass-card rounded-[2.5rem] p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8">
                <Icon className="w-12 h-12 text-white/5 group-hover:text-emerald/10 transition-colors duration-700 -rotate-12 group-hover:rotate-0" />
            </div>

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em] mb-3">{label}</p>
                    <div className="flex items-baseline gap-4">
                        <span className="text-5xl font-outfit font-light text-silver group-hover:text-white transition-colors duration-500 tracking-tighter">
                            {value}
                        </span>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-emerald tracking-wide">{trend}</span>
                            <div className="w-full h-0.5 bg-emerald/20 mt-1 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald w-2/3 animate-shimmer" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Animated Glow Component */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald/5 rounded-full blur-3xl group-hover:bg-emerald/15 transition-all duration-1000" />
        </div>
    )
}
