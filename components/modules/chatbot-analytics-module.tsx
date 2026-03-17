"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format, subDays, startOfDay } from "date-fns"
import { cn } from "@/lib/utils"
import { GlassCard } from "@/components/ui/glass-card"
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
    AreaChart, Area,
} from "recharts"

interface ChatbotAnalyticsModuleProps {
    clientId: string
}

const JOB_KEYWORDS: [string, string][] = [
    ["Konobar / Sanker", "konobar"],
    ["Prodavac", "prodavac"],
    ["Magacin", "magacin"],
    ["Dostava", "dostav"],
    ["Cuvar", "cuvar"],
    ["Ciscenje / Spreman", "cisc"],
    ["Utovarivac", "utovar"],
]

const QUESTION_KEYWORDS: [string, string[]][] = [
    ["Pitanje o plati",   ["plata", "platu", "plati", "zarada", "dnevnica", "satnica"]],
    ["Pitanje o smeni",   ["smena", "smeni", "smene", "radno vreme", "sati", "vikend"]],
    ["Prijava za posao",  ["prijavim", "prijaviti", "prijavl", "zainteresova", "zelim da"]],
    ["Slanje dokumenta",  ["slika", "fotografij", "cv", "licna karta", "dokument"]],
    ["Opste informacije", ["kako", "gde", "koji", "koliko", "ima li", "imate li"]],
]

const PLATFORM_COLORS: Record<string, string> = {
    instagram: "#ec4899",
    whatsapp:  "#10b981",
    facebook:  "#3b82f6",
    website:   "#8b5cf6",
}

function getPlatformLabel(p: string) {
    if (p === "instagram") return "Instagram"
    if (p === "facebook")  return "Facebook"
    if (p === "whatsapp")  return "WhatsApp"
    if (p === "website")   return "Website"
    return p
}

export function ChatbotAnalyticsModule({ clientId }: ChatbotAnalyticsModuleProps) {
    const [conversations, setConversations] = useState<any[]>([])
    const [allMessages, setAllMessages] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    const fetchData = useCallback(async () => {
        const { data, error } = await supabase
            .from("razgovori")
            .select("*")
            .eq("client_id", clientId)
            .order("created_at", { ascending: false })
            .limit(2000)

        if (error || !data) { setLoading(false); return }

        setAllMessages(data)

        const grouped: Record<string, any> = {}
        for (const msg of data) {
            const id = msg.id_razgovora
            if (!grouped[id]) {
                grouped[id] = { id, messages: [], platform: msg.platform || "instagram", humanNeeded: false, lastMsg: msg }
            }
            grouped[id].messages.push(msg)
            if (msg.role === "system" && msg.metadata?.human_needed) grouped[id].humanNeeded = true
            if (new Date(msg.created_at) > new Date(grouped[id].lastMsg.created_at)) grouped[id].lastMsg = msg
        }

        for (const id of Object.keys(grouped)) {
            const ns = grouped[id].messages.filter((m: any) => m.role !== "system")
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            grouped[id].lastVisibleMessage = ns[0] || grouped[id].lastMsg
        }

        setConversations(Object.values(grouped))
        setLoading(false)
    }, [clientId, supabase])

    useEffect(() => { fetchData() }, [fetchData])

    const userMsgs = allMessages.filter(m => m.role === "user")

    // avg inquiries/day
    const today = startOfDay(new Date())
    const dailyData = Array.from({ length: 14 }, (_, i) => {
        const day = subDays(today, 13 - i)
        const count = conversations.filter(c =>
            startOfDay(new Date(c.lastVisibleMessage?.created_at || c.lastMsg.created_at)).getTime() === day.getTime()
        ).length
        return { day: format(day, "d.M"), count }
    })
    const activeDays = dailyData.filter(d => d.count > 0).length || 1
    const avgPerDay = Math.round(conversations.length / activeDays)

    // most sought jobs
    const jobData = JOB_KEYWORDS
        .map(([name, kw]) => ({ name, value: userMsgs.filter(m => m.message?.toLowerCase().includes(kw)).length }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value)

    // most common questions
    const qData = QUESTION_KEYWORDS
        .map(([name, kws]) => ({ name, value: userMsgs.filter(m => kws.some(kw => m.message?.toLowerCase().includes(kw))).length }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value)

    // funnel
    const stopData = [
        { label: "Pokrenuli razgovor",  count: conversations.length,          color: "#10b981", sub: "ukupno otvorenih DM" },
        { label: "Pitali o poslu",      count: userMsgs.filter(m => JOB_KEYWORDS.some(([, kw]) => m.message?.toLowerCase().includes(kw))).length, color: "#06b6d4", sub: "upitali za konkretnu poziciju" },
        { label: "Prijavili se",        count: userMsgs.filter(m => ["prijavim","prijaviti","prijavl","zainteresova"].some(kw => m.message?.toLowerCase().includes(kw))).length, color: "#f59e0b", sub: "izrazili interes za prijavu" },
        { label: "Bez odgovora",        count: conversations.filter(c => { const ns = c.messages.filter((m: any) => m.role !== "system"); return ns.length > 0 && ns[ns.length - 1].role === "user" }).length, color: "#ef4444", sub: "prekinuli pre zavrsene prijave" },
    ]
    const maxCount = stopData[0]?.count || 1

    // platform
    const platformCounts: Record<string, number> = {}
    for (const conv of conversations) {
        const p = conv.platform || "instagram"
        platformCounts[p] = (platformCounts[p] || 0) + 1
    }
    const pieData = Object.entries(platformCounts).map(([name, value]) => ({
        name: getPlatformLabel(name),
        value,
        color: PLATFORM_COLORS[name] || "#8b5cf6",
    }))

    const topStats = [
        { label: "Prosecno Upita/Dan",  value: avgPerDay,                                          color: "text-emerald" },
        { label: "Razgovora Ukupno",    value: conversations.length,                               color: "text-silver" },
        { label: "Trazili Poziciju",    value: stopData[1].count,                                  color: "text-cyan-400" },
        { label: "Intervenisano",       value: conversations.filter((c: any) => c.humanNeeded).length, color: "text-amber-400" },
    ]

    const barHeight = Math.max(160, jobData.length * 44)

    return (
        <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="px-1">
                <h2 className="text-4xl font-outfit font-bold text-silver tracking-tight">
                    Agent <span className="text-emerald">Analitika</span>
                </h2>
                <p className="text-silver/50 font-outfit mt-1">Statistike i uvidi iz razgovora AI agenta</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-6 h-6 border-2 border-emerald border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <ScrollArea className="h-[calc(100vh-200px)]">
                    <div className="space-y-5 pb-16">

                        {/* Top stats */}
                        <div className="grid grid-cols-4 gap-4">
                            {topStats.map((s, i) => (
                                <GlassCard key={i} className="p-4">
                                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold font-outfit mb-1">{s.label}</p>
                                    <p className={cn("text-3xl font-outfit font-bold", s.color)}>{s.value}</p>
                                </GlassCard>
                            ))}
                        </div>

                        <div className="grid grid-cols-12 gap-4">
                            {/* Most sought jobs */}
                            <GlassCard className="col-span-7 p-5">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-5">Najtrazeniji Poslovi</p>
                                {jobData.length === 0 ? (
                                    <p className="text-xs text-zinc-600 italic py-4">Nema dovoljno podataka</p>
                                ) : (
                                    <ResponsiveContainer width="100%" height={barHeight}>
                                        <BarChart data={jobData} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
                                            <XAxis
                                                type="number"
                                                allowDecimals={false}
                                                tickFormatter={v => String(Math.round(v as number))}
                                                tick={{ fill: "#52525b", fontSize: 10 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                interval={0}
                                                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                                                axisLine={false}
                                                tickLine={false}
                                                width={140}
                                            />
                                            <Tooltip
                                                contentStyle={{ background: "#0a0a0a", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
                                                cursor={{ fill: "rgba(16,185,129,0.05)" }}
                                                formatter={(v: number | undefined) => [v ?? 0, "upita"]}
                                            />
                                            <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#10b981" minPointSize={4} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </GlassCard>

                            {/* Channel breakdown */}
                            <GlassCard className="col-span-5 p-5">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-5">Kanali</p>
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-center">
                                        <ResponsiveContainer width={130} height={130}>
                                            <PieChart>
                                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={56} dataKey="value" strokeWidth={0}>
                                                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="space-y-2">
                                        {pieData.map((d, i) => (
                                            <div key={i} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                                                    <span className="text-xs text-zinc-400">{d.name}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full" style={{ background: d.color, width: `${Math.round((d.value / (conversations.length || 1)) * 100)}%` }} />
                                                    </div>
                                                    <span className="text-xs font-bold text-silver w-4 text-right">{d.value}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </GlassCard>
                        </div>

                        {/* Funnel */}
                        <GlassCard className="p-5">
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-5">Gde Staje Razgovor</p>
                            <div className="grid grid-cols-4 gap-4">
                                {stopData.map((s, i) => (
                                    <div key={i} className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                                            <span className="text-xs font-bold" style={{ color: s.color }}>
                                                {maxCount > 0 ? Math.round((s.count / maxCount) * 100) : 0}%
                                            </span>
                                        </div>
                                        <p className="text-2xl font-outfit font-bold text-silver mb-1">{s.count}</p>
                                        <p className="text-xs font-semibold text-silver/70 mb-0.5">{s.label}</p>
                                        <p className="text-[10px] text-zinc-600">{s.sub}</p>
                                    </div>
                                ))}
                            </div>
                        </GlassCard>

                        <div className="grid grid-cols-12 gap-4">
                            {/* Daily activity */}
                            <GlassCard className="col-span-8 p-5">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Aktivnost (poslednjih 14 dana)</p>
                                <ResponsiveContainer width="100%" height={130}>
                                    <AreaChart data={dailyData} margin={{ left: -20, right: 8 }}>
                                        <defs>
                                            <linearGradient id="aGradCA" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="day" tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: "#52525b", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip
                                            contentStyle={{ background: "#0a0a0a", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }}
                                            cursor={{ stroke: "rgba(16,185,129,0.2)" }}
                                            formatter={(v: number | undefined) => [v ?? 0, "razgovora"]}
                                        />
                                        <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fill="url(#aGradCA)" dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </GlassCard>

                            {/* Most common questions */}
                            <GlassCard className="col-span-4 p-5">
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Najcesca Pitanja</p>
                                {qData.length === 0 ? (
                                    <p className="text-xs text-zinc-600 italic">Nema dovoljno podataka</p>
                                ) : (
                                    <div className="space-y-1">
                                        {qData.map((d, i) => (
                                            <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="text-[10px] font-bold text-zinc-600 shrink-0 w-4">{i + 1}</span>
                                                    <span className="text-xs text-silver/70 truncate">{d.name}</span>
                                                </div>
                                                <span className="text-xs font-bold text-zinc-400 ml-2 shrink-0">{d.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </GlassCard>
                        </div>

                    </div>
                </ScrollArea>
            )}
        </div>
    )
}
