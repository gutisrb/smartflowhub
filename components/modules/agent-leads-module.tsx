"use client"

import { useState, useEffect, useCallback } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    MessageSquare,
    MoreHorizontal,
    UserCheck,
    Search,
    RefreshCw,
    Filter,
    ArrowUpRight,
    User,
    MapPin,
    Calendar,
    Sparkles,
    Clock,
    Mail
} from "lucide-react"
import { getCandidatesByClientId } from "@/lib/supabase/queries"
import { motion, AnimatePresence, Variants } from "framer-motion"
import { cn } from "@/lib/utils"
import { GlassCard } from "@/components/ui/glass-card"
import { toast } from "sonner"
import { LeadIntelligenceViewer } from "@/components/dashboard/lead-intelligence-viewer"

interface AgentLeadsModuleProps {
    clientId: string | null;
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
}

const tableVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] }
    }
}

export function AgentLeadsModule({ clientId, terminology: propTerminology }: AgentLeadsModuleProps) {
    const [leads, setLeads] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [filter, setFilter] = useState('all')
    const [selectedLead, setSelectedLead] = useState<any | null>(null)

    const terminology = propTerminology || {
        title: "Growth",
        highlight: "Engine",
        entity: "Lead",
        entities: "Leads",
        group: "Company",
        groups: "Companies",
        searchPlaceholder: "Search trajectories, names...",
        tableHeaders: ["Identity Profile", "Comms Node", "Vector Status", "Activity"]
    }

    const loadCandidates = useCallback(async () => {
        if (!clientId) return
        setLoading(true)
        try {
            const data = await getCandidatesByClientId(clientId)
            setLeads(data || [])
        } catch (error) {
            console.error("Failed to load candidates", error)
            toast.error("Transmission Error 404")
        }
        setLoading(false)
    }, [clientId])

    useEffect(() => {
        loadCandidates()
    }, [loadCandidates])

    const filteredLeads = leads.filter(c => {
        const matchesSearch = c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.job_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.location?.toLowerCase().includes(searchTerm.toLowerCase())

        const candidateStatus = c.status || 'Novi';
        const matchesFilter = filter === 'all' || candidateStatus.toLowerCase() === filter.toLowerCase();

        return matchesSearch && matchesFilter;
    })

    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter(l => ['kvalifikovan', 'intervju', 'zaposlen'].includes(l.status?.toLowerCase() || '')).length;
    const qualifiedRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;
    const activeInterviews = leads.filter(l => l.status?.toLowerCase() === 'intervju').length;
    const hired = leads.filter(l => l.status?.toLowerCase() === 'zaposlen').length;

    if (!clientId) return null

    return (
        <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                            {terminology.title}
                        </span>
                        <span className="text-white/90">{terminology.highlight}</span>
                        <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 uppercase tracking-widest">
                            Live Feed
                        </div>
                    </h1>
                    <p className="text-slate-400 mt-2 flex items-center gap-2">
                        Monitoring inbound {(terminology.entities || 'Leads').toLowerCase()} and automated interactions
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={loadCandidates}
                        className={cn(
                            "h-12 px-6 rounded-2xl bg-white/5 border border-white/5 text-silver font-outfit transition-all hover:border-emerald/30",
                            loading && "opacity-50"
                        )}
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2 text-emerald", loading && "animate-spin")} />
                        Sync Stream
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center py-2">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="relative w-full sm:w-80">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-emerald-500/50" />
                        <Input
                            placeholder={terminology.searchPlaceholder}
                            className="pl-10 bg-black/40 border-white/10 text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="bg-black/40 border border-white/10 text-white rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50 transition-colors"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                    >
                        <option value="all">Any Status</option>
                        <option value="novi">Novi</option>
                        <option value="kvalifikovan">Kvalifikovan</option>
                        <option value="intervju">Intervju</option>
                        <option value="zaposlen">Zaposlen</option>
                        <option value="odbijen">Odbijen</option>
                    </select>
                </div>
            </div>

            <GlassCard className="overflow-hidden border-white/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/10">
                                {terminology.tableHeaders?.map((header, idx) => (
                                    <th key={idx} className="p-4 text-xs font-mono uppercase tracking-widest text-emerald-400">
                                        {header}
                                    </th>
                                ))}
                                <th className="p-4 text-xs font-mono uppercase tracking-widest text-emerald-400">Phase</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {loading ? (
                                    <TableRow className="border-none">
                                        <TableCell colSpan={6} className="h-80 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <RefreshCw className="w-10 h-10 text-emerald animate-spin opacity-20" />
                                                <span className="text-sm text-zinc-500 font-outfit font-light uppercase tracking-widest">Intercepting Data Packets...</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLeads.length === 0 ? (
                                    <TableRow className="border-none">
                                        <TableCell colSpan={6} className="h-80 text-center">
                                            <p className="text-sm font-outfit text-zinc-500 italic opacity-30 tracking-widest uppercase">No active transmissions detected</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLeads.map((lead, idx) => (
                                        <motion.tr
                                            key={lead.id}
                                            initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            transition={{ delay: idx * 0.03, duration: 0.4 }}
                                            className="group border-white/[0.03] hover:bg-emerald/[0.02] transition-all duration-300"
                                        >
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-emerald-400 font-bold">
                                                        {lead.full_name?.[0] || 'A'}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-white">{lead.full_name}</div>
                                                        <div className="text-xs text-white/40 flex items-center gap-2">
                                                            {lead.starost && (
                                                                <span className="flex items-center gap-1 border-r border-white/10 pr-2">
                                                                    <User className="h-3 w-3" />
                                                                    {lead.starost}
                                                                </span>
                                                            )}
                                                            <span className="flex items-center gap-1">
                                                                <Clock className="h-3 w-3" />
                                                                Captured {new Date(lead.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-medium">{lead.job_title || lead.company || 'Unknown Entity'}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {lead.lokacija && (
                                                            <span className="text-[10px] text-emerald-400/70 flex items-center gap-1 bg-emerald-400/5 px-1.5 py-0.5 rounded border border-emerald-400/10">
                                                                <MapPin className="h-2.5 w-2.5" />
                                                                {lead.lokacija}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-white/40 italic">Intent: {lead.intent || 'Observation'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="text-sm text-cyan-400/80 flex items-center gap-1.5">
                                                        <Mail className="h-3 w-3" />
                                                        {lead.email}
                                                    </div>
                                                    {lead.whatsapp && (
                                                        <div className="text-xs text-emerald-400/60 flex items-center gap-1.5">
                                                            <MessageSquare className="h-3 w-3" />
                                                            {lead.whatsapp}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <Badge
                                                    className={cn(
                                                        "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border-none transition-all duration-500",
                                                        lead.status === "Qualified" || lead.status === "Intervju"
                                                            ? "bg-emerald/10 text-emerald shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                                            : "bg-white/5 text-zinc-500"
                                                    )}
                                                >
                                                    {lead.status || "Novi"}
                                                </Badge>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-outfit">{lead.izvor || "Chatbot"}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right pr-8">
                                                <div className="flex items-center justify-end gap-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setSelectedLead(lead)}
                                                        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-emerald/10 hover:text-emerald transition-all"
                                                    >
                                                        <User className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 hover:text-white transition-all">
                                                        <ArrowUpRight className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))
                                )}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            {/* Footer Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 px-2">
                {[
                    { label: "Total Captured", value: totalLeads, icon: Sparkles, color: "text-emerald-400" },
                    { label: "Qualification Rate", value: `${qualifiedRate}%`, icon: ArrowUpRight, color: "text-emerald-400" },
                    { label: "Active Interviews", value: activeInterviews, icon: MessageSquare, color: "text-emerald-400" },
                    { label: "Successfully Hired", value: hired, icon: UserCheck, color: "text-emerald-400" }
                ].map((stat, i) => (
                    <GlassCard key={i} className="p-6 flex items-center gap-5 hover:border-emerald/30 transition-all duration-500 group">
                        <div className="w-12 h-12 rounded-2xl bg-emerald/5 border border-emerald/10 flex items-center justify-center group-hover:bg-emerald/10 transition-colors">
                            <stat.icon className={cn("w-5 h-5", stat.color)} />
                        </div>
                        <div>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1 opacity-60 font-outfit">{stat.label}</p>
                            <p className="text-2xl font-outfit font-bold text-silver tracking-tight">{stat.value}</p>
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
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
