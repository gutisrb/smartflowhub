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
import { Instagram, Facebook, MessageCircle, Info, MessageSquare, Target, Zap, Bot } from "lucide-react"

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
}

export function LeadIntelligenceViewer({ lead, isOpen, onClose }: LeadIntelligenceViewerProps) {
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
            case "instagram": return <Instagram className="h-4 w-4" />
            case "facebook": return <Facebook className="h-4 w-4" />
            case "whatsapp": return <MessageCircle className="h-4 w-4" />
            default: return <MessageCircle className="h-4 w-4" />
        }
    }

    if (!lead) return null

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-lg shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                                <Zap className="h-6 w-6 text-yellow-300 fill-yellow-300" />
                                Lead Intelligence
                            </DialogTitle>
                            <p className="text-blue-100 text-sm mt-1 opacity-90">
                                {lead.ime} • {lead.kompanija || "Samostalni lead"}
                            </p>
                        </div>
                        <Badge className={`${lead.prioritet_skor && lead.prioritet_skor >= 70 ? 'bg-red-500' : 'bg-blue-400'} text-white border-white/20 px-3 py-1`}>
                            {lead.prioritet_skor || 0}% Match
                        </Badge>
                    </div>
                </DialogHeader>

                <Tabs defaultValue="context" className="flex-1 flex flex-col min-h-0">
                    <div className="px-6 border-b bg-gray-50/50">
                        <TabsList className="bg-transparent gap-6 h-12 p-0">
                            <TabsTrigger
                                value="context"
                                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 h-full font-semibold transition-all"
                            >
                                <Info className="h-4 w-4 mr-2" />
                                Strategic Context
                            </TabsTrigger>
                            <TabsTrigger
                                value="chat"
                                className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none px-0 h-full font-semibold transition-all text-gray-500"
                            >
                                <Bot className="h-4 w-4 mr-2" />
                                AI Conversation
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="context" className="flex-1 p-0 m-0 min-h-0">
                        <ScrollArea className="h-full p-6">
                            <div className="space-y-6">
                                {/* AI Qualification Summary */}
                                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100/50">
                                    <h4 className="flex items-center text-blue-900 font-bold text-sm mb-3 uppercase tracking-wider">
                                        <Zap className="h-4 w-4 mr-2 text-blue-600" />
                                        AI Analiza & Obrazloženje
                                    </h4>
                                    <p className="text-blue-800 text-sm leading-relaxed italic">
                                        "{lead.obrazlozenje || "AI trenutno analizira podatke..."}"
                                    </p>
                                    <div className="mt-4 flex gap-4">
                                        <div className="flex-1">
                                            <span className="text-[10px] text-blue-400 uppercase font-bold">Kategorija</span>
                                            <p className="text-sm font-bold text-blue-700">{lead.kategorija || "Nepoznato"}</p>
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[10px] text-blue-400 uppercase font-bold">Sledeća Akcija</span>
                                            <p className="text-sm font-bold text-blue-700">{lead.sledeca_akcija || "Ručna provera"}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Intake Data */}
                                <div className="space-y-4">
                                    <h4 className="flex items-center text-gray-900 font-bold text-sm uppercase tracking-wider">
                                        <Target className="h-4 w-4 mr-2 text-indigo-600" />
                                        Intake Form Answers
                                    </h4>

                                    {!lead.intake_data || Object.keys(lead.intake_data).length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-8 text-gray-400 border-2 border-dashed rounded-xl">
                                            <Info className="h-8 w-8 mb-2 opacity-20" />
                                            <p className="text-[11px] font-medium italic">Nema dostupnih podataka iz upitnika.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {Object.entries(lead.intake_data).map(([key, value]: [string, any]) => (
                                                <div key={key} className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 hover:bg-white transition-all shadow-sm group">
                                                    <span className="text-[10px] text-gray-400 uppercase font-bold block mb-1.5 group-hover:text-indigo-500 transition-colors">
                                                        {key.replace(/_/g, ' ')}
                                                    </span>
                                                    <p className="text-sm text-gray-700 font-medium leading-normal">
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

                    <TabsContent value="chat" className="flex-1 p-0 m-0 min-h-0 bg-slate-50/30">
                        <ScrollArea className="h-full p-6">
                            <div className="space-y-4 pb-4">
                                {messages.length === 0 && !loading && (
                                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
                                        <Bot className="h-12 w-12 mb-4" />
                                        <p className="text-sm italic uppercase tracking-widest text-[10px]">Nema AI razgovora za ovaj lead.</p>
                                    </div>
                                )}
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex flex-col ${msg.role === "assistant" ? "items-start" : "items-end"
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1.5">
                                            {msg.role === "assistant" && <Bot className="h-3 w-3 text-blue-600" />}
                                            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter opacity-70">
                                                {msg.role === "assistant" ? "SmartFlow AI" : "Lead"} • {new Date(msg.created_at).toLocaleTimeString()}
                                            </span>
                                            {getPlatformIcon(msg.platform)}
                                        </div>
                                        <div
                                            className={`rounded-2xl px-4 py-2.5 text-sm max-w-[85%] shadow-sm ${msg.role === "assistant"
                                                ? "bg-white border text-gray-700"
                                                : "bg-blue-600 text-white font-medium"
                                                }`}
                                        >
                                            {msg.message}
                                        </div>
                                    </div>
                                ))}
                                {loading && (
                                    <div className="flex justify-center py-4">
                                        <Badge variant="secondary" className="animate-pulse">Loading Logs...</Badge>
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
