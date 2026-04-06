"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { format, subDays } from "date-fns"
import {
    MessageCircle, Instagram, Facebook, Bot, AlertTriangle, CheckCircle2,
    Inbox, TrendingUp, UserCheck, Globe, Phone, Hash, ExternalLink,
    Shield, Wifi, Clock, ChevronRight
} from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

// Handles both proper JSONB objects and legacy string-encoded metadata
function parseMeta(m: any): Record<string, any> {
    if (!m) return {}
    if (typeof m === 'string') {
        try { return JSON.parse(m) } catch { return {} }
    }
    return m
}

interface SocialChatbotModuleProps {
    clientId: string
}

function getPlatformMeta(platform: string) {
    const p = platform?.toLowerCase()
    if (p === "instagram") return { label: "Instagram", color: "text-pink-400",    dot: "bg-pink-400",    gradFrom: "#f472b6", gradTo: "#a855f7", Icon: Instagram }
    if (p === "facebook")  return { label: "Facebook",  color: "text-blue-400",    dot: "bg-blue-400",    gradFrom: "#60a5fa", gradTo: "#3b82f6", Icon: Facebook }
    if (p === "whatsapp")  return { label: "WhatsApp",  color: "text-emerald-400", dot: "bg-emerald-400", gradFrom: "#34d399", gradTo: "#059669", Icon: MessageCircle }
    if (p === "website")   return { label: "Website",   color: "text-violet-400",  dot: "bg-violet-400",  gradFrom: "#a78bfa", gradTo: "#7c3aed", Icon: Globe }
    return                        { label: platform || "Chat", color: "text-zinc-400", dot: "bg-zinc-500", gradFrom: "#71717a", gradTo: "#52525b", Icon: MessageCircle }
}

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
                grouped[id] = {
                    id, leadId: msg.lead_id, lastMessage: msg,
                    messages: [], platform: msg.platform || "instagram",
                    candidateName: null, humanNeeded: false, phone: null
                }
            }
            grouped[id].messages.push(msg)
            const meta = parseMeta(msg.metadata)
            if (msg.role === "system" && meta.human_needed) grouped[id].humanNeeded = true
            if (new Date(msg.created_at) > new Date(grouped[id].lastMessage.created_at)) grouped[id].lastMessage = msg
            if (meta.name && !grouped[id].candidateName) grouped[id].candidateName = meta.name
            if ((meta.phone || meta.number) && !grouped[id].phone)
                grouped[id].phone = meta.phone || meta.number
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
            const parts = name.trim().split(" ")
            return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0]
        }
        return `Kandidat ${conv.id.substring(0, 6)}`
    }

    const getFullName = (conv: any) => nameMap[conv.id] || conv.candidateName || null

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
        { key: "danas", label: "Danas" },
        { key: "sedmica", label: "7 dana" },
        { key: "mesec", label: "30 dana" },
    ]

    return (
        <div className="h-[calc(100vh-140px)] flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-3xl font-outfit font-bold tracking-tight text-white">
                        Social{" "}
                        <span style={{ background: "linear-gradient(120deg, #f472b6, #c084fc, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                            Inbox
                        </span>
                    </h2>
                    <p className="text-[11px] font-mono text-zinc-500 mt-0.5 tracking-wider">
                        Mjob Recruitment Agent · fh2UjbwqxCaCNh9I
                    </p>
                </div>
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07]">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <Wifi className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Live</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-500/20 bg-pink-500/[0.07]">
                        <Instagram className="w-3 h-3 text-pink-400" />
                        <span className="text-[10px] font-mono font-bold text-pink-400 tracking-wide">@ozavala.rs</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.07] bg-white/[0.03]">
                        <Globe className="w-3 h-3 text-zinc-400" />
                        <span className="text-[10px] font-mono text-zinc-400 tracking-wide">ozavala.co.rs</span>
                    </div>
                </div>
            </div>

            {/* ── Stats ──────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-3 shrink-0">
                <StatCard icon={<MessageCircle className="w-4 h-4" />} label="Upiti Danas" value={upitiDanas} variant="pink" />
                <StatCard icon={<UserCheck className="w-4 h-4" />} label="Prijave Danas" value={prijaveDanas} variant="emerald" />
                <StatCard
                    icon={<AlertTriangle className="w-4 h-4" />}
                    label="Intervencije"
                    value={intervencije}
                    variant={intervencije > 0 ? "amber" : "zinc"}
                    glow={intervencije > 0}
                />
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 flex items-center justify-between backdrop-blur-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl border border-cyan-500/20 bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                            <TrendingUp className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Poruke</p>
                            <p className="text-2xl font-bold text-white font-outfit">{msgCount}</p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        {PERIODS.map(p => (
                            <button
                                key={p.key}
                                onClick={() => setMsgPeriod(p.key)}
                                className={cn(
                                    "text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-md transition-all",
                                    msgPeriod === p.key ? "bg-cyan-500/20 text-cyan-400" : "text-zinc-600 hover:text-zinc-400"
                                )}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Main Panel ─────────────────────────────────────────────────── */}
            <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">

                {/* Conversation list */}
                <div className="col-span-4 flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden backdrop-blur-xl">
                    <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Inbox className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">Razgovori</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-600 bg-white/5 rounded-full px-2 py-0.5">{conversations.length}</span>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-none divide-y divide-white/[0.03]">
                        {conversations.map((conv, idx) => {
                            const isSelected = selectedId === conv.id
                            const pm = getPlatformMeta(conv.platform)
                            const name = getDisplayName(conv)
                            return (
                                <motion.button
                                    key={conv.id}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                                    onClick={() => setSelectedId(conv.id)}
                                    className={cn(
                                        "w-full text-left px-4 py-3.5 transition-all duration-200 relative border-l-2",
                                        isSelected
                                            ? "bg-pink-500/[0.08] border-l-pink-500"
                                            : "border-l-transparent hover:bg-white/[0.03]"
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            <div
                                                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ring-2 ring-black/40"
                                                style={{ background: `linear-gradient(135deg, ${pm.gradFrom}, ${pm.gradTo})` }}
                                            >
                                                {name[0]?.toUpperCase()}
                                            </div>
                                            {conv.humanNeeded && (
                                                <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 border-2 border-[#0d0d14] flex items-center justify-center">
                                                    <span className="text-[7px] font-black text-black leading-none">!</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline justify-between gap-1 mb-0.5">
                                                <span className="text-sm font-semibold text-white truncate font-outfit">{name}</span>
                                                <span className="text-[9px] font-mono text-zinc-600 shrink-0">
                                                    {format(new Date(conv.lastVisibleMessage.created_at), "d.M HH:mm")}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <pm.Icon className={cn("w-2.5 h-2.5", pm.color)} />
                                                <span className={cn("text-[9px] font-mono font-bold uppercase tracking-wider", pm.color)}>{pm.label}</span>
                                            </div>
                                            <p className="text-xs text-zinc-500 truncate leading-relaxed">
                                                {conv.lastVisibleMessage?.role === "assistant" ? "🤖 " : ""}
                                                {conv.lastVisibleMessage?.message?.substring(0, 50)}
                                            </p>
                                        </div>
                                    </div>
                                </motion.button>
                            )
                        })}
                        {conversations.length === 0 && (
                            <div className="p-10 text-center">
                                <MessageCircle className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
                                <p className="text-zinc-600 text-sm font-mono">Nema razgovora</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Chat view */}
                <div className="col-span-5 flex flex-col rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden backdrop-blur-xl">
                    {selected ? (
                        <>
                            {/* Chat header */}
                            <div className={cn(
                                "px-5 py-3.5 border-b flex items-center gap-3 shrink-0 transition-colors",
                                selected.humanNeeded ? "border-amber-500/25 bg-amber-500/[0.04]" : "border-white/[0.05]"
                            )}>
                                {(() => {
                                    const pm = getPlatformMeta(selected.platform)
                                    return (
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-black/30 shrink-0"
                                            style={{ background: `linear-gradient(135deg, ${pm.gradFrom}, ${pm.gradTo})` }}
                                        >
                                            {getDisplayName(selected)[0]}
                                        </div>
                                    )
                                })()}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white font-outfit leading-none mb-0.5 truncate">
                                        {getFullName(selected) || getDisplayName(selected)}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        {(() => {
                                            const pm = getPlatformMeta(selected.platform)
                                            return <>
                                                <pm.Icon className={cn("w-3 h-3", pm.color)} />
                                                <span className="text-[10px] font-mono text-zinc-500">{pm.label} DM</span>
                                            </>
                                        })()}
                                        <span className="text-zinc-700">·</span>
                                        <Clock className="w-2.5 h-2.5 text-zinc-600" />
                                        <span className="text-[10px] font-mono text-zinc-500">{currentMessages.length} poruka</span>
                                    </div>
                                </div>
                                {selected.humanNeeded && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30">
                                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                                        <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">Intervencija</span>
                                    </div>
                                )}
                            </div>

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3 scrollbar-none bg-black/10">
                                {currentMessages.map((msg: any, i: number) => {
                                    const isUser = msg.role === "user"
                                    const meta = parseMeta(msg.metadata)
                                    const imageUrl = meta.image_url || meta.imageUrl
                                    const isStory = meta.type === "story_reply"
                                    const msgText = msg.message && msg.message !== "[slika]" ? msg.message : null
                                    return (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: Math.min(i * 0.02, 0.3) }}
                                            className={cn("flex gap-2.5", isUser ? "justify-start" : "justify-end")}
                                        >
                                            {isUser && (
                                                <div
                                                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-1 ring-1 ring-black/30"
                                                    style={{ background: `linear-gradient(135deg, ${getPlatformMeta(selected.platform).gradFrom}, ${getPlatformMeta(selected.platform).gradTo})` }}
                                                >
                                                    {getDisplayName(selected)[0]}
                                                </div>
                                            )}
                                            <div
                                                className={cn(
                                                    "max-w-[74%] rounded-2xl px-3.5 py-2.5 text-sm font-outfit",
                                                    isUser
                                                        ? "bg-[#1a1a28] text-zinc-200 rounded-tl-none border border-white/[0.07]"
                                                        : "text-white rounded-tr-none shadow-lg"
                                                )}
                                                style={!isUser ? { background: "linear-gradient(135deg, #7c3aed, #db2777)" } : undefined}
                                            >
                                                {isStory && (
                                                    <p className="text-[9px] font-mono text-white/40 uppercase tracking-widest mb-1.5">↩ Story odgovor</p>
                                                )}
                                                {imageUrl && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={imageUrl}
                                                        alt="slika"
                                                        className="rounded-xl max-w-full max-h-56 object-cover mb-2 border border-white/10"
                                                        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                                                    />
                                                )}
                                                {!imageUrl && !msgText && (
                                                    <span className="text-[10px] font-mono uppercase tracking-widest opacity-40">📷 Slika</span>
                                                )}
                                                {msgText && <p className="leading-relaxed text-[13px]">{msgText}</p>}
                                                <span className={cn("text-[10px] mt-1.5 block font-mono", isUser ? "opacity-35 text-zinc-400" : "opacity-40 text-white")}>
                                                    {format(new Date(msg.created_at), "HH:mm")}
                                                </span>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Chat footer status */}
                            <div className={cn(
                                "px-5 py-3 border-t flex items-center gap-3 shrink-0 transition-colors",
                                selected.humanNeeded ? "border-amber-500/20 bg-amber-500/[0.04]" : "border-white/[0.05] bg-black/15"
                            )}>
                                {selected.humanNeeded ? (
                                    <>
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <p className="text-xs text-amber-400/80 font-mono">Čeka manuelnu intervenciju — sekretar treba da odgovori direktno.</p>
                                    </>
                                ) : (
                                    <>
                                        <Bot className="w-3.5 h-3.5 text-emerald-400 opacity-50 shrink-0" />
                                        <p className="text-xs text-zinc-600 font-mono italic">AI agent automatski obradjuje sve dolazne poruke.</p>
                                    </>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                            <div className="w-14 h-14 rounded-2xl border border-pink-500/20 bg-pink-500/[0.06] flex items-center justify-center">
                                <Inbox className="w-6 h-6 text-pink-500/40" />
                            </div>
                            <p className="text-zinc-600 text-sm font-mono">Izaberite razgovor</p>
                        </div>
                    )}
                </div>

                {/* Profile sidebar */}
                <div className="col-span-3 flex flex-col gap-3 overflow-y-auto scrollbar-none">
                    {selected ? (
                        <>
                            {/* Profile card */}
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden backdrop-blur-xl shrink-0">
                                {/* Cover */}
                                <div
                                    className="h-14 relative overflow-hidden"
                                    style={{ background: `linear-gradient(135deg, ${getPlatformMeta(selected.platform).gradFrom}33, ${getPlatformMeta(selected.platform).gradTo}55)` }}
                                >
                                    {(() => {
                                        const pm = getPlatformMeta(selected.platform)
                                        return <pm.Icon className={cn("absolute right-3 bottom-2 w-5 h-5 opacity-25", pm.color)} />
                                    })()}
                                </div>
                                <div className="px-4 pb-4">
                                    {/* Avatar overlapping cover */}
                                    <div className="-mt-5 mb-2.5">
                                        <div
                                            className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold text-white border-2 border-[#111118] ring-2 ring-black/30"
                                            style={{ background: `linear-gradient(135deg, ${getPlatformMeta(selected.platform).gradFrom}, ${getPlatformMeta(selected.platform).gradTo})` }}
                                        >
                                            {getDisplayName(selected)[0]}
                                        </div>
                                    </div>
                                    <p className="font-semibold text-white text-sm font-outfit leading-tight">
                                        {getFullName(selected) || getDisplayName(selected)}
                                    </p>
                                    <p className="text-[10px] font-mono text-zinc-600 mt-0.5 truncate" title={selected.id}>
                                        ID: {selected.id.substring(0, 14)}…
                                    </p>
                                    {/* Badges */}
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {(() => {
                                            const pm = getPlatformMeta(selected.platform)
                                            return (
                                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border border-current/20 bg-current/5", pm.color)}>
                                                    <pm.Icon className="w-2 h-2" />
                                                    {pm.label}
                                                </span>
                                            )
                                        })()}
                                        {selected.humanNeeded && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider border border-amber-500/30 text-amber-400 bg-amber-500/10">
                                                <AlertTriangle className="w-2 h-2" />
                                                Intervencija
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Contact info */}
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-xl shrink-0">
                                <p className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest mb-3">Kontakt Info</p>
                                <div className="space-y-3">
                                    <InfoRow icon={<Hash />} label="Meta Sender ID" value={selected.id.substring(0, 12) + "…"} mono />
                                    <InfoRow icon={<Instagram />} label="Platforma" value={getPlatformMeta(selected.platform).label + " DM"} />
                                    <InfoRow icon={<Phone />} label="Telefon" value={selected.phone || "—"} />
                                    <InfoRow
                                        icon={<Globe />}
                                        label="Website"
                                        value="ozavala.co.rs"
                                        link="https://ozavala.co.rs"
                                    />
                                </div>
                            </div>

                            {/* Conversation stats */}
                            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 backdrop-blur-xl shrink-0">
                                <p className="text-[9px] font-mono font-bold text-zinc-600 uppercase tracking-widest mb-3">Statistike</p>
                                <div className="space-y-2">
                                    <MiniStat label="Ukupno poruka" value={currentMessages.length} />
                                    <MiniStat label="Korisnički" value={currentMessages.filter((m: any) => m.role === "user").length} />
                                    <MiniStat label="AI odgovori" value={currentMessages.filter((m: any) => m.role === "assistant").length} />
                                    <MiniStat label="Sa slikom" value={currentMessages.filter((m: any) => m.metadata?.image_url || m.metadata?.imageUrl).length} />
                                </div>
                            </div>

                            {/* Human intervention toggle */}
                            <button
                                onClick={toggleHumanNeeded}
                                disabled={togglingFlag}
                                className={cn(
                                    "w-full rounded-2xl py-3 px-4 text-sm font-mono font-bold uppercase tracking-wider transition-all duration-300 border flex items-center justify-center gap-2 shrink-0",
                                    selected.humanNeeded
                                        ? "bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
                                        : "bg-white/[0.03] border-white/[0.08] text-zinc-500 hover:border-amber-500/30 hover:text-amber-400 hover:bg-amber-500/[0.05]"
                                )}
                            >
                                {togglingFlag ? (
                                    <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                ) : selected.humanNeeded ? (
                                    <><CheckCircle2 className="w-4 h-4" /> Vrati na AI</>
                                ) : (
                                    <><AlertTriangle className="w-4 h-4" /> Zahtevaj Intervenciju</>
                                )}
                            </button>

                            {/* AI Agent info */}
                            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4 backdrop-blur-xl shrink-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <Bot className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">AI Agent Aktivan</span>
                                </div>
                                <p className="text-[11px] font-mono text-zinc-500 leading-relaxed">
                                    Mjob Agent obradjuje poruke 24/7 i automatski odgovara kandidatima na Instagram DM.
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] flex items-center justify-center min-h-[200px]">
                            <p className="text-zinc-700 text-xs font-mono">Nema odabranog</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, variant, glow }: {
    icon: ReactNode
    label: string
    value: number
    variant: "pink" | "emerald" | "amber" | "zinc" | "cyan"
    glow?: boolean
}) {
    const styles = {
        pink:    { bg: "bg-pink-500/10",    border: "border-pink-500/20",    iconClass: "text-pink-400 border-pink-500/20 bg-pink-500/10",    num: "text-white" },
        emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", iconClass: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10", num: "text-white" },
        amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/20",   iconClass: "text-amber-400 border-amber-500/30 bg-amber-500/15",  num: "text-amber-400" },
        zinc:    { bg: "bg-white/[0.03]",   border: "border-white/[0.07]",   iconClass: "text-zinc-500 border-white/10 bg-white/5",           num: "text-white" },
        cyan:    { bg: "bg-cyan-500/10",    border: "border-cyan-500/20",    iconClass: "text-cyan-400 border-cyan-500/20 bg-cyan-500/10",     num: "text-white" },
    }
    const s = styles[variant]
    return (
        <div className={cn("rounded-2xl border p-4 flex items-center gap-3 backdrop-blur-xl", s.bg, s.border, glow && "ring-1 ring-amber-500/20")}>
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border shrink-0", s.iconClass)}>
                {icon}
            </div>
            <div>
                <p className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest">{label}</p>
                <p className={cn("text-2xl font-bold font-outfit leading-none mt-0.5", s.num)}>{value}</p>
            </div>
        </div>
    )
}

function InfoRow({ icon, label, value, mono, link }: {
    icon: ReactNode
    label: string
    value: string
    mono?: boolean
    link?: string
}) {
    return (
        <div className="flex items-start gap-2.5">
            <span className="text-zinc-600 shrink-0 mt-0.5 [&>svg]:w-3 [&>svg]:h-3">{icon}</span>
            <div className="flex-1 min-w-0">
                <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest mb-0.5">{label}</p>
                {link ? (
                    <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-pink-400 hover:text-pink-300 transition-colors flex items-center gap-1 font-mono"
                    >
                        {value} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                ) : (
                    <p className={cn("text-xs text-zinc-300 truncate", mono && "font-mono")}>{value}</p>
                )}
            </div>
        </div>
    )
}

function MiniStat({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center justify-between py-0.5">
            <span className="text-[10px] font-mono text-zinc-500">{label}</span>
            <span className="text-xs font-mono font-bold text-zinc-300">{value}</span>
        </div>
    )
}
