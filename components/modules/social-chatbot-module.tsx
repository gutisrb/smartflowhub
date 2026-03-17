"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format, subDays } from "date-fns"
import { MessageCircle, Instagram, Facebook, Bot, AlertTriangle, CheckCircle2, Inbox, TrendingUp, UserCheck } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { GlassCard } from "@/components/ui/glass-card"

interface SocialChatbotModuleProps {
    clientId: string
}

function getPlatformMeta(platform: string) {
    const p = platform?.toLowerCase()
    if (p === "instagram") return { label: "Instagram", color: "text-pink-400",  dot: "bg-pink-400",  Icon: Instagram }
    if (p === "facebook")  return { label: "Facebook",  color: "text-blue-400",  dot: "bg-blue-400",  Icon: Facebook }
    if (p === "whatsapp")  return { label: "WhatsApp",  color: "text-emerald",   dot: "bg-emerald",   Icon: MessageCircle }
    if (p === "website")   return { label: "Website",   color: "text-violet-400",dot: "bg-violet-400",Icon: MessageCircle }
    return                        { label: platform || "Chat", color: "text-zinc-400", dot: "bg-zinc-500", Icon: MessageCircle }
}

// ── Main Component ────────────────────────────────────────────────────────────

type Period = "danas" | "sedmica" | "mesec"

export function SocialChatbotModule({ clientId }: SocialChatbotModuleProps) {
    const [conversations, setConversations] = useState<any[]>([])
    const [allMessages, setAllMessages] = useState<any[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [nameMap, setNameMap] = useState<Record<string, string>>({})
    const [togglingFlag, setTogglingFlag] = useState(false)
    const [msgPeriod, setMsgPeriod] = useState<Period>("danas")
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const supabase = createClient()

    const fetchConversations = useCallback(async () => {
        const { data, error } = await supabase
            .from("razgovori")
            .select("*")
            .eq("client_id", clientId)
            .order("created_at", { ascending: false })
            .limit(1000)

        if (error || !data) return

        setAllMessages(data)

        const grouped: Record<string, any> = {}
        for (const msg of data) {
            const id = msg.id_razgovora
            if (!grouped[id]) {
                grouped[id] = { id, leadId: msg.lead_id, lastMessage: msg, messages: [], platform: msg.platform || "instagram", candidateName: null, humanNeeded: false }
            }
            grouped[id].messages.push(msg)
            if (msg.role === "system" && msg.metadata?.human_needed) grouped[id].humanNeeded = true
            if (new Date(msg.created_at) > new Date(grouped[id].lastMessage.created_at)) grouped[id].lastMessage = msg
            if (msg.metadata?.name && !grouped[id].candidateName) grouped[id].candidateName = msg.metadata.name
        }

        for (const id of Object.keys(grouped)) {
            const ns = grouped[id].messages
                .filter((m: any) => m.role !== "system")
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            grouped[id].lastVisibleMessage = ns[0] || grouped[id].lastMessage
        }

        const list = Object.values(grouped).sort((a: any, b: any) =>
            new Date(b.lastVisibleMessage.created_at).getTime() - new Date(a.lastVisibleMessage.created_at).getTime()
        )

        setConversations(list)

        // Look up names from kandidati by id_razgovora (OZ Avala B2C candidates)
        const razgovorIds = list.map((c: any) => c.id).filter(Boolean)
        if (razgovorIds.length > 0) {
            const { data: kandRows } = await supabase
                .from("kandidati")
                .select("id_razgovora, full_name")
                .in("id_razgovora", razgovorIds)
                .not("full_name", "is", null)
            if (kandRows) {
                const map: Record<string, string> = {}
                for (const k of kandRows) if (k.id_razgovora && k.full_name) map[k.id_razgovora] = k.full_name
                setNameMap(map)
            }
        }
    }, [clientId, supabase])

    useEffect(() => {
        fetchConversations()
        const channel = supabase
            .channel(`razgovori-rt-${clientId}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "razgovori", filter: `client_id=eq.${clientId}` },
                () => fetchConversations())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [fetchConversations, clientId, supabase])

    useEffect(() => {
        if (conversations.length > 0 && !selectedId) setSelectedId(conversations[0].id)
    }, [conversations, selectedId])

    const selected = conversations.find(c => c.id === selectedId)
    const currentMessages = selected?.messages
        .filter((m: any) => m.role !== "system")
        .slice()
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) ?? []

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [selectedId, currentMessages.length])

    const getDisplayName = (conv: any) => {
        const name = nameMap[conv.id] || conv.candidateName
        if (name) {
            const parts = name.split(" ")
            return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0]
        }
        return `Kandidat ${conv.id.substring(0, 6)}`
    }

    // Computed inbox stats
    const todayStr = new Date().toDateString()
    const weekAgo = subDays(new Date(), 7)
    const monthAgo = subDays(new Date(), 30)

    const inDateRange = (dateStr: string) => {
        const d = new Date(dateStr)
        if (msgPeriod === "danas") return d.toDateString() === todayStr
        if (msgPeriod === "sedmica") return d >= weekAgo
        return d >= monthAgo
    }

    const upitiDanas = conversations.filter(c => new Date(c.lastVisibleMessage.created_at).toDateString() === todayStr).length
    const prijaveDanas = allMessages.filter(m =>
        m.role === "user" && new Date(m.created_at).toDateString() === todayStr &&
        ["prijavim", "prijaviti", "prijavl", "zainteresova"].some(kw => m.message?.toLowerCase().includes(kw))
    ).length
    const intervencije = conversations.filter((c: any) => c.humanNeeded).length
    const msgCount = allMessages.filter(m => m.role !== "system" && inDateRange(m.created_at)).length

    const toggleHumanNeeded = async () => {
        if (!selected || togglingFlag) return
        setTogglingFlag(true)
        if (!selected.humanNeeded) {
            await supabase.from("razgovori").insert({
                client_id: clientId,
                id_razgovora: selected.id,
                role: "system",
                message: "[HUMAN_NEEDED]",
                platform: selected.platform,
                metadata: { type: "flag", human_needed: true },
            })
        } else {
            await supabase.from("razgovori").delete()
                .eq("client_id", clientId)
                .eq("id_razgovora", selected.id)
                .eq("role", "system")
                .eq("message", "[HUMAN_NEEDED]")
        }
        await fetchConversations()
        setTogglingFlag(false)
    }

    const PERIODS: { key: Period; label: string }[] = [
        { key: "danas",   label: "Danas" },
        { key: "sedmica", label: "7 dana" },
        { key: "mesec",   label: "30 dana" },
    ]

    return (
        <div className="space-y-6 h-[calc(100vh-140px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Header */}
            <div className="flex items-end justify-between px-1 shrink-0">
                <div>
                    <h2 className="text-4xl font-outfit font-bold text-silver tracking-tight">
                        AI <span className="text-pink-400">Agent</span>
                    </h2>
                    <p className="text-silver/50 font-outfit mt-1">Automatizovana obrada poruka 24/7 — svaki razgovor snimljen</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-pink-500/10 border border-pink-500/20">
                    <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
                    <span className="text-xs font-bold text-pink-400 uppercase tracking-widest font-outfit">AI Aktivan</span>
                </div>
            </div>

            {/* Inbox stats — always visible */}
            <div className="grid grid-cols-4 gap-4 shrink-0">
                {/* Upiti Danas */}
                <GlassCard className="p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-pink-500/10 border-pink-500/20 shrink-0">
                        <MessageCircle className="w-4 h-4 text-pink-400" />
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-outfit">Upiti Danas</p>
                        <p className="text-2xl font-outfit font-bold text-silver">{upitiDanas}</p>
                    </div>
                </GlassCard>

                {/* Prijave Danas */}
                <GlassCard className="p-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-emerald/10 border-emerald/20 shrink-0">
                        <UserCheck className="w-4 h-4 text-emerald" />
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-outfit">Prijave Danas</p>
                        <p className="text-2xl font-outfit font-bold text-silver">{prijaveDanas}</p>
                    </div>
                </GlassCard>

                {/* Intervencije */}
                <GlassCard className={cn("p-5 flex items-center gap-4", intervencije > 0 && "border-amber-500/20")}>
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border shrink-0", intervencije > 0 ? "bg-amber-500/15 border-amber-500/30" : "bg-white/5 border-white/10")}>
                        <AlertTriangle className={cn("w-4 h-4", intervencije > 0 ? "text-amber-400" : "text-zinc-500")} />
                    </div>
                    <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-outfit">Intervencije</p>
                        <p className={cn("text-2xl font-outfit font-bold", intervencije > 0 ? "text-amber-400" : "text-silver")}>{intervencije}</p>
                    </div>
                </GlassCard>

                {/* Poruka with period toggle */}
                <GlassCard className="p-5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-cyan-500/10 border-cyan-500/20 shrink-0">
                            <TrendingUp className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-outfit">Poruka</p>
                            <p className="text-2xl font-outfit font-bold text-silver">{msgCount}</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                        {PERIODS.map(p => (
                            <button
                                key={p.key}
                                onClick={() => setMsgPeriod(p.key)}
                                className={cn(
                                    "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md transition-all font-outfit",
                                    msgPeriod === p.key ? "bg-cyan-500/20 text-cyan-400" : "text-zinc-600 hover:text-zinc-400"
                                )}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </GlassCard>
            </div>

            {/* Main panel */}
            <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">

                    {/* Conversation List */}
                    <div className="col-span-4 flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl">
                        <div className="px-5 py-4 border-b border-white/5 shrink-0">
                            <div className="flex items-center gap-2">
                                <Inbox className="w-4 h-4 text-zinc-400" />
                                <span className="text-xs font-bold text-silver/60 uppercase tracking-widest font-outfit">Dolazni Razgovori</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <div className="divide-y divide-white/[0.03]">
                                {conversations.map((conv) => {
                                    const isSelected = selectedId === conv.id
                                    const isUser = conv.lastVisibleMessage?.role === "user"
                                    const pm = getPlatformMeta(conv.platform)
                                    return (
                                        <motion.div
                                            key={conv.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            onClick={() => setSelectedId(conv.id)}
                                            className={cn(
                                                "px-5 py-4 cursor-pointer transition-all duration-200 relative",
                                                isSelected ? "bg-pink-500/10 border-l-2 border-l-pink-500" : "hover:bg-white/[0.02] border-l-2 border-l-transparent"
                                            )}
                                        >
                                            {conv.humanNeeded && (
                                                <div className="absolute top-3 right-3">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                                </div>
                                            )}
                                            <div className="flex items-start gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center text-pink-300 font-bold text-sm shrink-0">
                                                    {getDisplayName(conv)[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <span className="font-semibold text-sm text-silver truncate">{getDisplayName(conv)}</span>
                                                        <span className="text-[10px] text-zinc-500 whitespace-nowrap ml-2 font-outfit">
                                                            {format(new Date(conv.lastVisibleMessage.created_at), "d.M, HH:mm")}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", pm.dot)} />
                                                        <span className={cn("text-[10px] font-bold uppercase tracking-widest", pm.color)}>{pm.label}</span>
                                                    </div>
                                                    <p className="text-xs text-zinc-500 truncate leading-relaxed">
                                                        {isUser ? "" : "🤖 "}{conv.lastVisibleMessage.message?.substring(0, 52)}...
                                                    </p>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                                {conversations.length === 0 && (
                                    <div className="p-8 text-center">
                                        <MessageCircle className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                                        <p className="text-zinc-500 text-sm font-outfit">Nema razgovora</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Chat View */}
                    <div className="col-span-8 flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-white/5 backdrop-blur-xl">
                        {selected ? (
                            <>
                                <div className="px-6 py-4 border-b border-white/5 shrink-0 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center text-pink-300 font-bold text-sm">
                                            {getDisplayName(selected)[0]}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-silver text-sm font-outfit">{getDisplayName(selected)}</h3>
                                            <div className="flex items-center gap-1.5">
                                                {(() => { const pm = getPlatformMeta(selected.platform); return <pm.Icon className={cn("w-3 h-3", pm.color)} /> })()}
                                                <span className="text-[10px] text-zinc-500">{getPlatformMeta(selected.platform).label} DM</span>
                                                <span className="text-zinc-700">·</span>
                                                <span className="text-[10px] text-zinc-500">{currentMessages.length} poruka</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={toggleHumanNeeded}
                                            disabled={togglingFlag}
                                            className={cn(
                                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wider font-outfit transition-all duration-200",
                                                selected.humanNeeded
                                                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400 hover:bg-amber-500/25"
                                                    : "bg-white/5 border-white/10 text-zinc-500 hover:border-amber-500/30 hover:text-amber-400"
                                            )}
                                        >
                                            {selected.humanNeeded
                                                ? <><AlertTriangle className="w-3 h-3" /> Intervencija</>
                                                : <><CheckCircle2 className="w-3 h-3" /> AI Obradjuje</>
                                            }
                                        </button>
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald/10 border border-emerald/20">
                                            <Bot className="w-3 h-3 text-emerald" />
                                            <span className="text-[10px] font-bold text-emerald uppercase tracking-wider font-outfit">AI Agent</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-6 py-4 bg-black/10">
                                    <div className="space-y-3">
                                        {currentMessages.map((msg: any, i: number) => {
                                            const isUser = msg.role === "user"
                                            const imageUrl = msg.metadata?.image_url || msg.metadata?.imageUrl
                                            const isStory = msg.metadata?.type === "story_reply"
                                            const msgText = msg.message && msg.message !== "[slika]" ? msg.message : null
                                            return (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, y: 6 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                                                    className={cn("flex", isUser ? "justify-start" : "justify-end")}
                                                >
                                                    <div className={cn(
                                                        "max-w-[72%] rounded-2xl px-4 py-2.5 text-sm font-outfit",
                                                        isUser
                                                            ? "bg-white/[0.07] text-silver/90 rounded-tl-none border border-white/[0.06]"
                                                            : "bg-gradient-to-br from-pink-500/80 to-purple-500/80 text-white rounded-tr-none shadow-lg"
                                                    )}>
                                                        {isStory && (
                                                            <div className="flex items-center gap-1.5 mb-1.5 opacity-60">
                                                                <span className="text-[10px] uppercase tracking-widest">↩ Story odgovor</span>
                                                            </div>
                                                        )}
                                                        {imageUrl && (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={imageUrl}
                                                                alt="slika"
                                                                className="rounded-xl max-w-full max-h-64 object-cover mb-1.5"
                                                                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                                                            />
                                                        )}
                                                        {!imageUrl && !msgText && (
                                                            <span className="text-[10px] uppercase tracking-widest opacity-50">📷 Slika</span>
                                                        )}
                                                        {msgText && <p className="leading-relaxed">{msgText}</p>}
                                                        <span className={cn("text-[10px] mt-1 block opacity-50", isUser ? "text-zinc-400" : "text-white")}>
                                                            {format(new Date(msg.created_at), "HH:mm")}
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            )
                                        })}
                                        <div ref={messagesEndRef} />
                                    </div>
                                </div>

                                <div className={cn(
                                    "px-6 py-3 border-t flex items-center gap-3",
                                    selected.humanNeeded ? "border-amber-500/20 bg-amber-500/5" : "border-white/5 bg-black/10"
                                )}>
                                    {selected.humanNeeded ? (
                                        <>
                                            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                                            <p className="text-xs text-amber-400/80 font-outfit">Ovaj razgovor zahteva manuelnu intervenciju. Sekretar treba da kontaktira kandidata direktno.</p>
                                        </>
                                    ) : (
                                        <>
                                            <Bot className="w-4 h-4 text-emerald opacity-60 shrink-0" />
                                            <p className="text-xs text-zinc-500 font-outfit italic">AI agent automatski obradjuje sve dolazne poruke — intervencija sekretara dostupna kada je potrebno.</p>
                                        </>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
                                    <Inbox className="w-8 h-8 text-pink-400 opacity-50" />
                                </div>
                                <p className="text-zinc-500 text-sm font-outfit">Izaberite razgovor da vidite poruke</p>
                            </div>
                        )}
                    </div>
                </div>
        </div>
    )
}
