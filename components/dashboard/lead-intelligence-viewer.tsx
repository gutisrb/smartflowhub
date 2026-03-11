"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Instagram,
    Facebook,
    MessageCircle,
    Info,
    MessageSquare,
    Target,
    Zap,
    Bot,
    User,
    Sparkles,
    Calendar,
    ChevronRight,
    Search,
    RefreshCw
} from "lucide-react"
import { GlassCard } from "@/components/ui/glass-card"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

interface Message {
    id: string
    role: "user" | "assistant" | "system"
    message: string
    created_at: string
    platform: string
}

interface LeadIntelligenceViewerProps {
    lead: any | null
    isOpen: boolean
    onClose: () => void
    isClientView?: boolean
    isRecruitment?: boolean
}

export function LeadIntelligenceViewer({ lead, isOpen, onClose, isClientView = false, isRecruitment = false }: LeadIntelligenceViewerProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        if (lead?.id_razgovora && isOpen) {
            fetchMessages()
        } else if (isOpen) {
            setMessages([])
        }
    }, [lead, isOpen])

    const fetchMessages = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("razgovori")
            .select("*")
            .eq("id_razgovora", lead.id_razgovora)
            .order("created_at", { ascending: true })

        if (error) {
            console.error("Error fetching messages:", error)
        } else {
            setMessages(data || [])
        }
        setLoading(false)
    }

    const getPlatformIcon = (platform: string) => {
        switch (platform?.toLowerCase()) {
            case "instagram": return <Instagram className="h-3 w-3" />
            case "facebook": return <Facebook className="h-3 w-3" />
            case "whatsapp": return <MessageCircle className="h-3 w-3" />
            default: return <MessageCircle className="h-3 w-3" />
        }
    }

    if (!lead) return null

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] h-[90vh] flex flex-col p-0 overflow-hidden border-white/5 bg-obsidian/95 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl overflow-y-auto">
                {/* Header: Elysian Obsidian Style */}
                <div className="relative p-8 pb-4 shrink-0 overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />

                    <div className="relative flex justify-between items-start">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Badge className="bg-emerald/10 text-emerald border-emerald/20 text-[10px] font-bold uppercase tracking-widest px-2">
                                    {isRecruitment ? "Candidate Profile" : "Intelligence Node"}
                                </Badge>
                                {lead.meeting_time && (
                                    <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] font-bold uppercase tracking-widest px-2">
                                        Meeting Scheduled
                                    </Badge>
                                )}
                            </div>
                            <DialogTitle className="text-3xl font-outfit font-bold text-silver tracking-tight">
                                {lead.ime}
                            </DialogTitle>
                            <p className="text-silver/40 font-outfit text-sm">
                                {lead.kompanija || lead.company_name || "Independent Lead"} • <span className="text-silver/60">{lead.niche || "General"} Vector</span>
                            </p>
                        </div>

                        {!isClientView && (
                            <GlassCard className="p-4 flex flex-col items-center justify-center min-w-[100px] border-emerald/20 bg-emerald/5 rounded-2xl">
                                <span className="text-[10px] font-bold text-emerald uppercase tracking-[0.2em] mb-1">Match Score</span>
                                <span className="text-2xl font-outfit font-bold text-silver">{lead.prioritet_skor || 0}%</span>
                            </GlassCard>
                        )}
                    </div>
                </div>

                <Tabs defaultValue="context" className="flex-1 flex flex-col min-h-0">
                    <div className="px-8 border-b border-white/5">
                        <TabsList className="bg-transparent gap-8 h-12 p-0">
                            <TabsTrigger
                                value="context"
                                className="data-[state=active]:bg-transparent data-[state=active]:text-emerald data-[state=active]:border-b-2 data-[state=active]:border-emerald rounded-none px-0 h-full font-outfit font-medium text-silver/40 transition-all text-sm"
                            >
                                {isRecruitment ? "Fit Analysis" : "Strategic Context"}
                            </TabsTrigger>
                            <TabsTrigger
                                value="chat"
                                className="data-[state=active]:bg-transparent data-[state=active]:text-emerald data-[state=active]:border-b-2 data-[state=active]:border-emerald rounded-none px-0 h-full font-outfit font-medium text-silver/40 transition-all text-sm"
                            >
                                {isRecruitment ? "Pre-Interview Chat" : "AI Conversation History"}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="context" className="flex-1 p-0 m-0 min-h-0 bg-noise">
                        <ScrollArea className="h-full">
                            <div className="p-8 space-y-8 pb-12">
                                {/* AI Strategic Briefing */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-emerald" />
                                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">
                                            {isRecruitment ? "Recruiter Summary" : "Strategic Briefing"}
                                        </h4>
                                    </div>
                                    <GlassCard className="p-6 border-white/5 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Zap className="w-12 h-12 text-emerald" />
                                        </div>
                                        <p className="text-silver/80 font-outfit text-base leading-relaxed italic">
                                            "{lead.obrazlozenje || "AI currently processing vector data..."}"
                                        </p>
                                        <div className="mt-8 grid grid-cols-2 gap-4">
                                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                                                <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                                                    {isRecruitment ? "Current Phase" : "Trajectory Category"}
                                                </span>
                                                <p className="text-sm font-bold text-emerald uppercase tracking-wider">{lead.kategorija || lead.status || "Undefined"}</p>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                                                <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
                                                    {isRecruitment ? "Suggested Action" : "Next Calculated Step"}
                                                </span>
                                                <p className="text-sm font-bold text-emerald uppercase tracking-wider">{lead.sledeca_akcija || (isRecruitment ? "Review Profile" : "Manual Intelligence")}</p>
                                            </div>
                                        </div>
                                    </GlassCard>
                                </div>

                                {/* Intake Nodes */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Target className="w-4 h-4 text-emerald" />
                                        <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">
                                            {isRecruitment ? "Application Details" : "Data Harvest Nodes"}
                                        </h4>
                                    </div>

                                    {!lead.intake_data || Object.keys(lead.intake_data).length === 0 ? (
                                        <GlassCard className="p-12 flex flex-col items-center justify-center border-dashed border-white/5">
                                            <Search className="w-10 h-10 text-zinc-500 mb-4 opacity-20" />
                                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">No harvest data localized</p>
                                        </GlassCard>
                                    ) : (
                                        <div className="grid gap-3">
                                            {Object.entries(lead.intake_data).map(([key, value]: [string, any]) => (
                                                <div
                                                    key={key}
                                                    className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-emerald/30 transition-all duration-300 group"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-widest group-hover:text-emerald transition-colors">
                                                            {key.replace(/_/g, ' ')}
                                                        </span>
                                                        <ChevronRight className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-all" />
                                                    </div>
                                                    <p className="text-silver/80 font-outfit text-sm leading-relaxed">
                                                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="chat" className="flex-1 p-0 m-0 min-h-0 bg-noise/30">
                        <ScrollArea className="h-full">
                            <div className="p-8 space-y-6 pb-12">
                                {messages.length === 0 && !loading && (
                                    <div className="flex flex-col items-center justify-center py-32 text-zinc-500">
                                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/5 flex items-center justify-center mb-6">
                                            <Bot className="w-8 h-8 opacity-20" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.3em]">No Signal Detected</p>
                                    </div>
                                )}

                                <AnimatePresence mode="popLayout">
                                    {messages.map((msg, idx) => (
                                        <motion.div
                                            key={msg.id}
                                            initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className={cn(
                                                "flex flex-col max-w-[85%]",
                                                msg.role === "assistant" ? "items-start" : "items-end ml-auto"
                                            )}
                                        >
                                            <div className="flex items-center gap-2 mb-2 px-1">
                                                {msg.role === "assistant" && <Bot className="w-3 h-3 text-emerald" />}
                                                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest opacity-70">
                                                    {msg.role === "assistant" ? "SmartFlow Intelligence" : "Subject"} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {getPlatformIcon(msg.platform)}
                                            </div>

                                            <div
                                                className={cn(
                                                    "px-5 py-3.5 rounded-2xl text-[13px] leading-relaxed font-outfit",
                                                    msg.role === "assistant"
                                                        ? "bg-white/5 border border-white/10 text-silver shadow-lg"
                                                        : "bg-emerald text-obsidian font-semibold shadow-[0_10px_30px_rgba(16,185,129,0.1)]"
                                                )}
                                            >
                                                {msg.message}
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {loading && (
                                    <div className="flex justify-center py-10">
                                        <RefreshCw className="w-6 h-6 text-emerald animate-spin opacity-40" />
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}

