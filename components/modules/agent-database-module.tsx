"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    Plus,
    MoreHorizontal,
    Database,
    Search,
    RefreshCw,
    Layers,
    Sparkles,
    ArrowUpRight,
    Briefcase,
    MapPin,
    Coins,
    Pencil,
    Trash
} from "lucide-react"
import { getJobsByClientId, createJob, updateJob, deleteJob } from "@/lib/supabase/queries"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { GlassCard } from "@/components/ui/glass-card"
import { toast } from "sonner"

interface AgentDatabaseModuleProps {
    clientId: string
    terminology?: {
        title: string
        highlight: string
        entity: string
        entities: string
        group: string
        groups: string
        dbTitle?: string
        dbItem?: string
        [key: string]: any
    }
}

export function AgentDatabaseModule({
    clientId,
    terminology = {
        title: "Growth",
        highlight: "Engine",
        entity: "Lead",
        entities: "Leads",
        group: "Company",
        groups: "Companies",
        dbTitle: "Agent Database",
        dbItem: "Context Node"
    }
}: AgentDatabaseModuleProps) {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const [editId, setEditId] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        job_id: "",
        posao: "",
        firma: "",
        lokacija: "",
        plata: "",
        tip_plate: "Mesečno",
        radno_vreme: "",
        opis_posla: "",
        kriterijum: "",
        start_datum: "",
        status: "Aktivan",
        tip_posla: "Regularan",
        msg_template: ""
    })

    const loadData = useCallback(async () => {
        if (!clientId) return
        setLoading(true)
        try {
            const data = await getJobsByClientId(clientId)
            setItems(data || [])
        } catch (error) {
            console.error("Failed to load data", error)
            toast.error("Database Connection Error")
        }
        setLoading(false)
    }, [clientId])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleRefresh = async () => {
        setRefreshing(true)
        await loadData()
        setTimeout(() => setRefreshing(false), 800)
    }

    const handleSaveEntry = async () => {
        if (!clientId) return
        try {
            const entryData = { ...formData, client_id: clientId }
            if (editId) {
                const updated = await updateJob(editId, entryData)
                if (updated) {
                    setItems(items.map(i => i.id === editId ? updated : i))
                    toast.success("Node Re-calibrated Successfully")
                }
            } else {
                const created = await createJob(entryData)
                if (created) {
                    setItems([created, ...items])
                    toast.success("Node Initialized Successfully")
                }
            }
            setIsDialogOpen(false)
            resetForm()
        } catch (error) {
            console.error("Failed to save entry", error)
            toast.error("Handshake Refused")
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to completely erase this node from the database?")) {
            try {
                await deleteJob(id)
                setItems(items.filter(i => i.id !== id))
                toast.success("Node Erased Successfully")
            } catch (error) {
                console.error("Failed to delete entry", error)
                toast.error("Error erasing node")
            }
        }
    }

    const resetForm = () => {
        setEditId(null)
        setFormData({
            job_id: "",
            posao: "",
            firma: "",
            lokacija: "",
            plata: "",
            tip_plate: "Mesečno",
            radno_vreme: "",
            opis_posla: "",
            kriterijum: "",
            start_datum: "",
            status: "Aktivan",
            tip_posla: "Regularan",
            msg_template: ""
        })
    }

    const openEditDialog = (item: any) => {
        setEditId(item.id)
        setFormData({
            job_id: item.job_id || "",
            posao: item.posao || "",
            firma: item.firma || "",
            lokacija: item.lokacija || "",
            plata: item.plata || "",
            tip_plate: item.tip_plate || "Mesečno",
            radno_vreme: item.radno_vreme || "",
            opis_posla: item.opis_posla || "",
            kriterijum: item.kriterijum || "",
            start_datum: item.start_datum || "",
            status: item.status || "Aktivan",
            tip_posla: item.tip_posla || "Regularan",
            msg_template: item.msg_template || ""
        })
        setIsDialogOpen(true)
    }

    const filteredItems = useMemo(() => {
        return items.filter(item =>
            item.posao?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.firma?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.job_id?.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [items, searchQuery])

    const config = useMemo(() => {
        return {
            label: terminology.dbTitle || "Agent Database",
            item: terminology.dbItem || terminology.entity || "Node",
            color: "text-emerald",
            icon: terminology.entity === "Candidate" ? Briefcase : Database
        }
    }, [terminology])

    return (
        <div className="space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald/10 border border-emerald/20 flex items-center justify-center">
                            <config.icon className={cn("w-6 h-6", config.color)} />
                        </div>
                        <h2 className="text-4xl font-outfit font-bold text-silver tracking-tight">
                            {terminology.title === "Recruitment" ? "Recruitment" : "Databaza"} <span className={config.color}>{terminology.title === "Recruitment" ? "Database" : "Agenta"}</span>
                        </h2>
                        <Badge className="bg-white/5 text-silver/40 border-white/10 font-outfit text-[10px] uppercase tracking-widest">{config.label}</Badge>
                    </div>
                    <p className="text-silver/60 font-outfit text-lg max-w-xl">
                        Autonomous knowledge management for <span className={cn("font-medium", config.color)}>{config.item} nodes</span>.
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        onClick={handleRefresh}
                        className={cn(
                            "h-12 px-6 rounded-2xl bg-white/5 border border-white/5 text-silver font-outfit transition-all hover:border-emerald/30",
                            refreshing && "opacity-50"
                        )}
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2 text-emerald", refreshing && "animate-spin")} />
                        Sync Context
                    </Button>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={resetForm} className="h-12 px-8 bg-emerald hover:bg-emerald-600 text-obsidian font-bold rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.2)] border-none transition-all hover:scale-[1.02]">
                                <Plus className="mr-2 h-5 w-5" /> New {config.item}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl bg-obsidian/95 border-white/10 text-silver rounded-[2.5rem] p-8 shadow-2xl backdrop-blur-3xl">
                            <DialogHeader>
                                <DialogTitle className="text-3xl font-outfit font-bold tracking-tight">{editId ? `Re-calibrate ${config.item}` : `Initialize ${config.item} Node`}</DialogTitle>
                                <DialogDescription className="text-zinc-500 font-outfit text-base italic">
                                    {editId ? "Updating existing context parameters..." : "Injecting fresh context into the agentic reasoning engine..."}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-6 py-8">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">
                                            {terminology.title === "Recruitment" ? "Job ID" : "Node Identifier"}
                                        </Label>
                                        <Input
                                            placeholder={terminology.title === "Recruitment" ? "MJ-2024-001" : "NODE-404"}
                                            className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit"
                                            value={formData.job_id}
                                            onChange={e => setFormData({ ...formData, job_id: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">
                                            {terminology.title === "Recruitment" ? "Job Title" : "Node Description"}
                                        </Label>
                                        <Input
                                            placeholder={terminology.title === "Recruitment" ? "Promoter / Merchandiser" : "Agent Context Description"}
                                            className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit"
                                            value={formData.posao}
                                            onChange={e => setFormData({ ...formData, posao: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">
                                            {terminology.title === "Recruitment" ? "Employer" : "Origin Node"}
                                        </Label>
                                        <Input
                                            placeholder={terminology.title === "Recruitment" ? "Client Name" : "Origin Node"}
                                            className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit"
                                            value={formData.firma}
                                            onChange={e => setFormData({ ...formData, firma: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">Location</Label>
                                        <Input
                                            placeholder="Remote / HQ Node"
                                            className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit"
                                            value={formData.lokacija}
                                            onChange={e => setFormData({ ...formData, lokacija: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">
                                            {terminology.entity === "Candidate" ? "Salary / Compensation" : "Value Multiplier"}
                                        </Label>
                                        <Input
                                            placeholder="€5,000"
                                            className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit"
                                            value={formData.plata}
                                            onChange={e => setFormData({ ...formData, plata: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">
                                            {terminology.entity === "Candidate" ? "Payment Period" : "Interval"}
                                        </Label>
                                        <Select value={formData.tip_plate} onValueChange={v => setFormData({ ...formData, tip_plate: v })}>
                                            <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-obsidian border-white/10 text-silver rounded-xl backdrop-blur-3xl">
                                                <SelectItem value="Mesečno">Monthly</SelectItem>
                                                <SelectItem value="Po satu">Hourly</SelectItem>
                                                <SelectItem value="Godišnje">Yearly</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">
                                            {terminology.entity === "Candidate" ? "Job Status" : "Protocol Status"}
                                        </Label>
                                        <Select value={formData.status} onValueChange={v => setFormData({ ...formData, status: v })}>
                                            <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl focus:border-emerald/40 transition-all font-outfit">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-obsidian border-white/10 text-silver rounded-xl backdrop-blur-3xl">
                                                <SelectItem value="Aktivan">Active</SelectItem>
                                                <SelectItem value="Pauziran">Paused</SelectItem>
                                                <SelectItem value="Završen">Archived</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] pl-1 font-bold">
                                        {terminology.entity === "Candidate" ? "Job Requirements & Description" : "Intelligence Synthesis"}
                                    </Label>
                                    <textarea
                                        className="w-full h-32 bg-white/5 border-white/10 rounded-xl p-4 focus:border-emerald/40 transition-all font-outfit resize-none outline-none text-sm leading-relaxed"
                                        placeholder="Detailed background for autonomous agent reasoning..."
                                        value={formData.opis_posla}
                                        onChange={e => setFormData({ ...formData, opis_posla: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-12 px-6 text-zinc-500 font-outfit hover:text-white">Cancel</Button>
                                <Button onClick={handleSaveEntry} className="h-12 px-10 bg-emerald text-obsidian font-bold rounded-xl hover:bg-emerald-600 transition-all">{editId ? "Save Changes" : "Capture Node"}</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* View Controls */}
            <div className="flex flex-col sm:flex-row gap-6 justify-between items-center py-2 px-2">
                <div className="relative w-full sm:w-80 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald transition-colors" />
                    <Input
                        placeholder="Search intelligence index..."
                        className="pl-11 h-12 bg-white/5 border-white/5 rounded-2xl font-outfit focus:border-emerald/30 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 p-1.5 bg-white/5 border border-white/5 rounded-2xl">
                    <Button variant="ghost" size="sm" className="h-9 px-5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-emerald bg-emerald/10 shadow-lg shadow-emerald/5">All Nodes</Button>
                    <Button variant="ghost" size="sm" className="h-9 px-5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-silver">Inbound</Button>
                    <Button variant="ghost" size="sm" className="h-9 px-5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-silver">Archived</Button>
                </div>
            </div>

            {/* Main Data Table */}
            <GlassCard className="rounded-[2.5rem] overflow-hidden p-0 border-white/5 shadow-2xl">
                <Table>
                    <TableHeader className="bg-white/[0.02] border-b border-white/5">
                        <TableRow className="border-none hover:bg-transparent">
                            <TableHead className="w-[120px] text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 pl-8 font-outfit">
                                {terminology.title === "Recruitment" ? "Job ID" : "Node ID"}
                            </TableHead>
                            <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit">
                                {terminology.title === "Recruitment" ? "Position Details" : `${config.item} Context`}
                            </TableHead>
                            <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit">
                                {terminology.title === "Recruitment" ? "Employer / Client" : `${terminology.group} Entity`}
                            </TableHead>
                            <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit">
                                {terminology.title === "Recruitment" ? "Compensation" : "Valuation"}
                            </TableHead>
                            <TableHead className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] py-8 font-outfit text-center">Status</TableHead>
                            <TableHead className="text-right pr-8 py-8 font-outfit">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <AnimatePresence mode="popLayout">
                            {loading ? (
                                <TableRow className="border-none">
                                    <TableCell colSpan={6} className="h-80 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <RefreshCw className="w-10 h-10 text-emerald animate-spin opacity-20" />
                                            <span className="text-sm text-zinc-500 font-outfit font-light uppercase tracking-widest">Traversing Knowledge Graph...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredItems.length === 0 ? (
                                <TableRow className="border-none">
                                    <TableCell colSpan={6} className="h-80 text-center">
                                        <p className="text-sm font-outfit text-zinc-500 italic opacity-30 tracking-widest uppercase">No {config.item.toLowerCase()} nodes detected in current slice</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item, idx) => (
                                    <motion.tr
                                        key={item.id}
                                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{ delay: idx * 0.03, duration: 0.4 }}
                                        className="group border-white/[0.03] hover:bg-emerald/[0.02] transition-all duration-300"
                                    >
                                        <TableCell className="py-7 pl-8 font-mono text-[10px] text-zinc-500 font-bold">
                                            <div className="bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg w-fit group-hover:border-emerald/30 group-hover:text-emerald transition-all">
                                                {item.job_id || 'NULL'}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-silver font-bold font-outfit text-base group-hover:text-emerald transition-colors leading-tight">{item.posao}</span>
                                                <span className="text-[10px] text-zinc-500 mt-1.5 uppercase tracking-widest font-medium opacity-60">{item.tip_posla}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-2.5 text-zinc-300 text-sm font-outfit">
                                                    <Briefcase className="w-3.5 h-3.5 text-emerald/40" />
                                                    {item.firma}
                                                </div>
                                                <div className="flex items-center gap-2.5 text-zinc-500 text-xs font-light font-outfit">
                                                    <MapPin className="w-3.5 h-3.5 opacity-40" />
                                                    {item.lokacija}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 text-emerald font-bold font-outfit text-lg tracking-tight">
                                                    {item.plata}
                                                </div>
                                                <span className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest opacity-60 font-medium">{item.tip_plate}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge
                                                className={cn(
                                                    "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border-none",
                                                    item.status === "Aktivan"
                                                        ? "bg-emerald/10 text-emerald shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                                        : "bg-zinc-800 text-zinc-500"
                                                )}
                                            >
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-8">
                                            <div className="flex items-center justify-end gap-2.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-emerald/10 hover:text-emerald transition-all">
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-all">
                                                    <Trash className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </motion.tr>
                                ))
                            )}
                        </AnimatePresence>
                    </TableBody>
                </Table>
            </GlassCard>

            {/* System Intelligence Feed */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { title: "Graph Density", desc: "Autonomous reasoning nodes have reached threshold saturation for deployment.", icon: Layers, label: "Live Nodes" },
                    { title: "Context Ready", desc: "Intelligence points synchronized with external Obsidian reservoirs successfully.", icon: Sparkles, label: "Synapse" },
                    { title: "Vault Integrity", desc: "All knowledge shards encrypted and isolated within the primary client vault.", icon: Database, label: "Encrypted" }
                ].map((intel, idx) => (
                    <GlassCard key={idx} className="p-8 group hover:border-emerald/30 transition-all duration-700 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald/5 blur-[80px] rounded-full -mr-16 -mt-16 group-hover:bg-emerald/10 transition-colors" />
                        <div className="flex items-center justify-between mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-emerald/10 flex items-center justify-center border border-emerald/20">
                                <intel.icon className="w-6 h-6 text-emerald group-hover:scale-110 transition-transform duration-500" />
                            </div>
                            <Badge className="bg-white/5 text-zinc-500 text-[9px] uppercase tracking-widest border-none px-3 font-bold py-1">{intel.label}</Badge>
                        </div>
                        <h4 className="text-silver font-bold font-outfit text-2xl mb-3 tracking-tight">{intel.title}</h4>
                        <p className="text-base text-silver/50 font-outfit font-light leading-relaxed">
                            {intel.desc}
                        </p>
                    </GlassCard>
                ))}
            </div>
        </div>
    )
}
