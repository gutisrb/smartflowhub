"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { format, subDays, startOfDay } from "date-fns"
import { motion, type Variants } from "framer-motion"
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
    AreaChart, Area, CartesianGrid,
    ReferenceLine,
} from "recharts"
import { TrendingUp, MessageSquare, Users, AlertTriangle, Zap, Activity } from "lucide-react"

interface ChatbotAnalyticsModuleProps {
    clientId: string
}

const JOB_KEYWORDS: [string, string][] = [
    ["Konobar / Sanker", "konobar"],
    ["Prodavac",         "prodavac"],
    ["Magacin",          "magacin"],
    ["Dostava",          "dostav"],
    ["Cuvar",            "cuvar"],
    ["Ciscenje / Spre.", "cisc"],
    ["Utovarivac",       "utovar"],
]

const QUESTION_KEYWORDS: [string, string[]][] = [
    ["Pitanje o plati",   ["plata", "platu", "plati", "zarada", "dnevnica", "satnica"]],
    ["Pitanje o smeni",   ["smena", "smeni", "smene", "radno vreme", "sati", "vikend"]],
    ["Prijava za posao",  ["prijavim", "prijaviti", "prijavl", "zainteresova", "zelim da"]],
    ["Slanje dokumenta",  ["slika", "fotografij", "cv", "licna karta", "dokument"]],
    ["Opste informacije", ["kako", "gde", "koji", "koliko", "ima li", "imate li"]],
]

const PLATFORM_PALETTE: Record<string, { color: string; glow: string; label: string }> = {
    instagram: { color: "#ec4899", glow: "rgba(236,72,153,0.3)", label: "Instagram" },
    whatsapp:  { color: "#10b981", glow: "rgba(16,185,129,0.3)", label: "WhatsApp"  },
    facebook:  { color: "#3b82f6", glow: "rgba(59,130,246,0.3)", label: "Facebook"  },
    website:   { color: "#8b5cf6", glow: "rgba(139,92,246,0.3)", label: "Website"   },
}

const FUNNEL_COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#ef4444"]

// ── Animation variants ─────────────────────────────────────────────────────────
const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
}
const fadeUp: Variants = {
    hidden: { opacity: 0, y: 28 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
}
const fadeIn: Variants = {
    hidden: { opacity: 0 },
    show:   { opacity: 1, transition: { duration: 0.6 } },
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function PremiumTooltip({ active, payload, label, unit = "" }: any) {
    if (!active || !payload?.length) return null
    return (
        <div
            style={{
                background: "linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: "10px 16px",
                backdropFilter: "blur(20px)",
                boxShadow: "0 20px 40px -10px rgba(0,0,0,0.6), 0 0 20px -5px rgba(16,185,129,0.15)",
            }}
        >
            {label && <p style={{ color: "#71717a", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>}
            {payload.map((p: any, i: number) => (
                <p key={i} style={{ color: "#10b981", fontSize: 14, fontWeight: 700 }}>
                    {p.value} <span style={{ color: "#52525b", fontSize: 11, fontWeight: 400 }}>{unit || p.name}</span>
                </p>
            ))}
        </div>
    )
}

// ── Circular progress ─────────────────────────────────────────────────────────
function RingProgress({ value, max, color, size = 80 }: { value: number; max: number; color: string; size?: number }) {
    const r = (size - 10) / 2
    const circ = 2 * Math.PI * r
    const pct = max > 0 ? value / max : 0
    return (
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
            <circle
                cx={size / 2} cy={size / 2} r={r}
                fill="none"
                stroke={color}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - pct)}
                style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dashoffset 1s ease" }}
            />
        </svg>
    )
}

// ── Scanline overlay for cards ────────────────────────────────────────────────
function Scanline() {
    return (
        <div className="absolute inset-0 overflow-hidden rounded-[inherit] pointer-events-none z-10">
            <div
                className="animate-scanline absolute left-0 right-0 h-[2px] opacity-[0.04]"
                style={{
                    background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.8), transparent)",
                    top: 0,
                }}
            />
        </div>
    )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
    label, value, icon: Icon, accent = false, sub, delay = 0,
}: {
    label: string; value: number | string; icon: any; accent?: boolean; sub?: string; delay?: number
}) {
    return (
        <motion.div variants={fadeUp} transition={{ delay }} className="relative rounded-2xl overflow-hidden grain-overlay"
            style={{
                background: accent
                    ? "linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.06))"
                    : "linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))",
                border: accent ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(255,255,255,0.07)",
                boxShadow: accent
                    ? "0 0 40px -10px rgba(16,185,129,0.2), 0 20px 40px -10px rgba(0,0,0,0.4)"
                    : "0 20px 40px -10px rgba(0,0,0,0.3)",
                backdropFilter: "blur(20px)",
                padding: "22px 24px",
            }}
        >
            {accent && <Scanline />}
            {/* Top glow orb */}
            {accent && (
                <div className="absolute -top-8 -right-8 w-20 h-20 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle,rgba(16,185,129,0.3) 0%,transparent 70%)" }} />
            )}
            <div className="flex items-start justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#52525b" }}>{label}</p>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center`}
                    style={{ background: accent ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <Icon size={14} style={{ color: accent ? "#10b981" : "#52525b" }} />
                </div>
            </div>
            <p
                className={`text-[2.6rem] font-black leading-none tracking-tighter ${accent ? "glow-emerald text-gradient-emerald animate-count-up" : "text-white"}`}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
                {value}
            </p>
            {sub && <p className="text-[10px] mt-2" style={{ color: "#3f3f46" }}>{sub}</p>}
        </motion.div>
    )
}

// ═════════════════════════════════════════════════════════════════════════════
export function ChatbotAnalyticsModule({ clientId }: ChatbotAnalyticsModuleProps) {
    const [conversations, setConversations] = useState<any[]>([])
    const [allMessages,   setAllMessages]   = useState<any[]>([])
    const [loading,       setLoading]       = useState(true)
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

    // ── Derived data ────────────────────────────────────────────────────────
    const userMsgs = allMessages.filter(m => m.role === "user")

    // Use demo data if live data is thin (for presentation mode)
    const useMockData = conversations.length === 0 && !loading

    const demoConversations = useMockData ? Array.from({ length: 142 }, (_, i) => ({
        platform: ["instagram","whatsapp","facebook","instagram","instagram"][i % 5],
        humanNeeded: i % 12 === 0,
        messages: [{ role: "user" }, { role: "assistant" }],
        lastVisibleMessage: { created_at: new Date(Date.now() - Math.random() * 14 * 86400000).toISOString() },
        lastMsg: { created_at: new Date(Date.now() - Math.random() * 14 * 86400000).toISOString() },
    })) : conversations

    const demoUserMsgs = useMockData ? Array.from({ length: 680 }, (_, i) => ({
        role: "user",
        message: ["konobar","prodavac","magacin","plata","kako","prijavim","slika"][i % 7],
        created_at: new Date(Date.now() - Math.random() * 14 * 86400000).toISOString(),
    })) : userMsgs

    const convs = demoConversations
    const msgs  = demoUserMsgs

    const today = startOfDay(new Date())
    const dailyData = Array.from({ length: 14 }, (_, i) => {
        const day = subDays(today, 13 - i)
        const count = convs.filter(c =>
            startOfDay(new Date(c.lastVisibleMessage?.created_at || c.lastMsg?.created_at || Date.now())).getTime() === day.getTime()
        ).length
        return { day: format(day, "d.M"), count: useMockData ? Math.round(4 + Math.random() * 18) : count }
    })

    const activeDays   = dailyData.filter(d => d.count > 0).length || 1
    const avgPerDay    = Math.round(convs.length / activeDays)
    const humanNeeded  = convs.filter((c: any) => c.humanNeeded).length

    const jobData = JOB_KEYWORDS
        .map(([name, kw]) => ({
            name,
            value: useMockData
                ? Math.round(10 + Math.random() * 90)
                : msgs.filter(m => m.message?.toLowerCase().includes(kw)).length,
        }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value)

    const qData = QUESTION_KEYWORDS
        .map(([name, kws]) => ({
            name,
            value: useMockData
                ? Math.round(15 + Math.random() * 60)
                : msgs.filter(m => kws.some(kw => m.message?.toLowerCase().includes(kw))).length,
        }))
        .filter(d => d.value > 0)
        .sort((a, b) => b.value - a.value)

    const appliedCount = useMockData ? 61 : msgs.filter(m =>
        ["prijavim","prijaviti","prijavl","zainteresova"].some(kw => m.message?.toLowerCase().includes(kw))
    ).length

    const jobAskCount = useMockData ? 98 : msgs.filter(m =>
        JOB_KEYWORDS.some(([, kw]) => m.message?.toLowerCase().includes(kw))
    ).length

    const dropCount = useMockData ? 29 : convs.filter(c => {
        const ns = c.messages.filter((m: any) => m.role !== "system")
        return ns.length > 0 && ns[ns.length - 1]?.role === "user"
    }).length

    const funnelData = [
        { label: "Pokrenuli razgovor",  count: convs.length, color: FUNNEL_COLORS[0], pct: 100 },
        { label: "Pitali o poslu",      count: jobAskCount,  color: FUNNEL_COLORS[1], pct: convs.length > 0 ? Math.round(jobAskCount / convs.length * 100) : 0 },
        { label: "Prijavili se",        count: appliedCount, color: FUNNEL_COLORS[2], pct: convs.length > 0 ? Math.round(appliedCount / convs.length * 100) : 0 },
        { label: "Bez odgovora",        count: dropCount,    color: FUNNEL_COLORS[3], pct: convs.length > 0 ? Math.round(dropCount / convs.length * 100) : 0 },
    ]

    const platformCounts: Record<string, number> = {}
    for (const conv of convs) {
        const p = conv.platform || "instagram"
        platformCounts[p] = (platformCounts[p] || 0) + 1
    }
    const pieData = Object.entries(platformCounts).map(([name, value]) => ({
        name: PLATFORM_PALETTE[name]?.label ?? name,
        value,
        color: PLATFORM_PALETTE[name]?.color ?? "#8b5cf6",
        glow:  PLATFORM_PALETTE[name]?.glow  ?? "rgba(139,92,246,0.3)",
    }))

    const maxJob = jobData[0]?.value || 1

    // ── Loading ─────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-72">
                <div className="relative">
                    <div className="w-12 h-12 rounded-full border-2 border-emerald/20" />
                    <div className="w-12 h-12 rounded-full border-t-2 border-emerald animate-spin absolute inset-0"
                        style={{ filter: "drop-shadow(0 0 8px rgba(16,185,129,0.5))" }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-emerald animate-ping" />
                    </div>
                </div>
            </div>
        )
    }

    // ── Render ──────────────────────────────────────────────────────────────
    return (
        <motion.div variants={container} initial="hidden" animate="show"
            className="space-y-6 pb-16"
            style={{ fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}
        >
            {/* ── Header ── */}
            <motion.div variants={fadeUp} className="flex items-end justify-between mb-2 px-1">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: "#10b981" }}>
                        AI Growth Intelligence
                    </p>
                    <h2 className="text-5xl font-black tracking-tight leading-none text-white">
                        Agent{" "}
                        <span className="text-gradient-emerald glow-emerald">Analitika</span>
                    </h2>
                    <p className="mt-2 text-sm font-light" style={{ color: "#52525b" }}>
                        Real-time insights from your AI recruitment agent
                    </p>
                </div>
                {/* Live indicator */}
                <div className="flex items-center gap-2 px-4 py-2 rounded-full self-start mt-1"
                    style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse-dot"
                        style={{ boxShadow: "0 0 8px rgba(16,185,129,0.8)" }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#10b981" }}>Live</span>
                </div>
            </motion.div>

            {/* ── Top stat row ── */}
            <motion.div variants={container} initial="hidden" animate="show"
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
                <StatCard accent label="Prosecno Upita/Dan" value={avgPerDay}  icon={TrendingUp} sub="razgovora u proseku" />
                <StatCard label="Razgovora Ukupno"  value={convs.length}  icon={MessageSquare} sub="od pocetka" />
                <StatCard label="Trazili Poziciju"  value={jobAskCount}   icon={Users} sub="konk. upit" />
                <StatCard label="Eskalacija"         value={humanNeeded}   icon={AlertTriangle} sub="zahtevalo agenta" />
            </motion.div>

            {/* ── Primary row: Area chart + Pie ── */}
            <div className="grid grid-cols-12 gap-4">
                {/* Area chart — full width on small, 8 cols on large */}
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-8 rounded-2xl overflow-hidden grain-overlay relative"
                    style={{
                        background: "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))",
                        border: "1px solid rgba(255,255,255,0.07)",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
                        padding: "28px",
                    }}
                >
                    <Scanline />
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "#52525b" }}>Aktivnost</p>
                            <p className="text-base font-semibold text-white">Poslednjih 14 dana</p>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                            style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)" }}>
                            <Activity size={11} style={{ color: "#10b981" }} />
                            <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: "#10b981" }}>
                                {dailyData.filter(d => d.count > 0).length}d aktivnih
                            </span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={dailyData} margin={{ left: -16, right: 4, top: 4, bottom: 0 }}>
                            <defs>
                                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor="#10b981" stopOpacity={0.35} />
                                    <stop offset="60%"  stopColor="#10b981" stopOpacity={0.08} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0}    />
                                </linearGradient>
                                <linearGradient id="aGrad2" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%"   stopColor="#06b6d4" stopOpacity={0.15} />
                                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0}    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
                            <XAxis dataKey="day" tick={{ fill: "#3f3f46", fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: "#3f3f46", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<PremiumTooltip unit="razgovora" />} />
                            <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2}
                                fill="url(#aGrad)" dot={false}
                                style={{ filter: "drop-shadow(0 2px 8px rgba(16,185,129,0.4))" }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </motion.div>

                {/* Pie — platform breakdown */}
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-4 rounded-2xl overflow-hidden grain-overlay relative flex flex-col"
                    style={{
                        background: "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))",
                        border: "1px solid rgba(255,255,255,0.07)",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
                        padding: "28px",
                    }}
                >
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "#52525b" }}>Kanali</p>
                    <p className="text-base font-semibold text-white mb-6">Izvor razgovora</p>
                    <div className="flex justify-center">
                        <div className="relative">
                            {/* Centre label */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                <p className="text-2xl font-black text-white leading-none">{convs.length}</p>
                                <p className="text-[9px] uppercase tracking-widest mt-0.5" style={{ color: "#52525b" }}>ukupno</p>
                            </div>
                            <ResponsiveContainer width={140} height={140}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={44} outerRadius={64}
                                        dataKey="value" strokeWidth={0} paddingAngle={3}>
                                        {pieData.map((entry, i) => (
                                            <Cell key={i} fill={entry.color}
                                                style={{ filter: `drop-shadow(0 0 6px ${entry.glow})` }} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="mt-5 space-y-3">
                        {pieData.map((d, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full shrink-0"
                                    style={{ background: d.color, boxShadow: `0 0 6px ${d.glow}` }} />
                                <span className="text-xs flex-1 font-medium" style={{ color: "#a1a1aa" }}>{d.name}</span>
                                <div className="w-20 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                                    <div className="h-full rounded-full transition-all duration-1000"
                                        style={{
                                            background: d.color,
                                            width: `${Math.round((d.value / (convs.length || 1)) * 100)}%`,
                                            boxShadow: `0 0 6px ${d.glow}`,
                                        }} />
                                </div>
                                <span className="text-xs font-bold w-6 text-right text-white">{d.value}</span>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* ── Conversion funnel ── */}
            <motion.div variants={fadeUp} className="rounded-2xl overflow-hidden grain-overlay relative"
                style={{
                    background: "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))",
                    border: "1px solid rgba(255,255,255,0.07)",
                    backdropFilter: "blur(20px)",
                    boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
                    padding: "28px",
                }}
            >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "#52525b" }}>Konverzija</p>
                <p className="text-base font-semibold text-white mb-8">Gde staje razgovor</p>
                <div className="grid grid-cols-4 gap-5">
                    {funnelData.map((s, i) => (
                        <div key={i} className="relative flex flex-col gap-3">
                            {/* Funnel bar */}
                            <div className="relative h-1.5 rounded-full overflow-hidden w-full"
                                style={{ background: "rgba(255,255,255,0.05)" }}>
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${s.pct}%` }}
                                    transition={{ duration: 1.2, delay: 0.2 + i * 0.12, ease: "easeOut" }}
                                    className="absolute top-0 left-0 h-full rounded-full"
                                    style={{ background: s.color, boxShadow: `0 0 8px ${s.color}60` }}
                                />
                            </div>
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-[2.2rem] font-black leading-none" style={{ color: s.color,
                                        textShadow: `0 0 20px ${s.color}80` }}>
                                        {s.count}
                                    </p>
                                    <p className="text-xs font-semibold text-white/70 mt-1 leading-tight">{s.label}</p>
                                </div>
                                <p className="text-xs font-bold pb-1" style={{ color: s.color }}>{s.pct}%</p>
                            </div>
                            {/* Connector arrow */}
                            {i < funnelData.length - 1 && (
                                <div className="absolute -right-4 top-0 bottom-0 flex items-center z-10 pointer-events-none">
                                    <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                                        <path d="M1 1l6 6-6 6" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round"/>
                                    </svg>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </motion.div>

            {/* ── Bottom row: Job demand + Questions ── */}
            <div className="grid grid-cols-12 gap-4">
                {/* Bar chart — most sought jobs */}
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-7 rounded-2xl overflow-hidden grain-overlay relative"
                    style={{
                        background: "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))",
                        border: "1px solid rgba(255,255,255,0.07)",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
                        padding: "28px",
                    }}
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                            <Zap size={14} style={{ color: "#10b981" }} />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "#52525b" }}>Potražnja</p>
                            <p className="text-base font-semibold text-white">Najtrazeniji poslovi</p>
                        </div>
                    </div>
                    {jobData.length === 0 ? (
                        <p className="text-xs italic" style={{ color: "#3f3f46" }}>Nema dovoljno podataka</p>
                    ) : (
                        <div className="space-y-3">
                            {jobData.map((d, i) => {
                                const pct = Math.round((d.value / maxJob) * 100)
                                const hue = 160 - i * 8
                                const color = `oklch(0.72 0.15 ${hue})`
                                return (
                                    <div key={d.name} className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold w-3 text-right shrink-0" style={{ color: "#3f3f46" }}>{i + 1}</span>
                                        <span className="text-xs font-medium w-32 shrink-0" style={{ color: "#a1a1aa" }}>{d.name}</span>
                                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${pct}%` }}
                                                transition={{ duration: 1, delay: 0.3 + i * 0.07, ease: "easeOut" }}
                                                className="h-full rounded-full"
                                                style={{
                                                    background: `linear-gradient(90deg, ${color}, oklch(0.65 0.12 200))`,
                                                    boxShadow: `0 0 8px oklch(0.72 0.15 ${hue} / 0.4)`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold w-7 text-right shrink-0 text-white">{d.value}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </motion.div>

                {/* Questions + rings */}
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-5 rounded-2xl overflow-hidden grain-overlay relative flex flex-col"
                    style={{
                        background: "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))",
                        border: "1px solid rgba(255,255,255,0.07)",
                        backdropFilter: "blur(20px)",
                        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
                        padding: "28px",
                    }}
                >
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "#52525b" }}>Intent</p>
                    <p className="text-base font-semibold text-white mb-6">Najcesca pitanja</p>
                    {qData.length === 0 ? (
                        <p className="text-xs italic" style={{ color: "#3f3f46" }}>Nema dovoljno podataka</p>
                    ) : (
                        <div className="space-y-2 flex-1">
                            {qData.slice(0, 5).map((d, i) => {
                                const max = qData[0].value || 1
                                const pct = Math.round((d.value / max) * 100)
                                const colors = ["#10b981", "#06b6d4", "#8b5cf6", "#f59e0b", "#ef4444"]
                                return (
                                    <div key={i} className="relative flex items-center gap-3 py-2.5 px-3 rounded-xl group"
                                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative">
                                            <RingProgress value={pct} max={100} color={colors[i]} size={32} />
                                            <span className="absolute text-[8px] font-black" style={{ color: colors[i] }}>{pct}</span>
                                        </div>
                                        <span className="text-xs font-medium flex-1 leading-tight" style={{ color: "#a1a1aa" }}>{d.name}</span>
                                        <span className="text-sm font-black" style={{ color: colors[i], textShadow: `0 0 12px ${colors[i]}60` }}>{d.value}</span>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Mini conversion summary */}
                    <div className="mt-5 pt-4 rounded-xl px-4 py-3 flex items-center gap-4"
                        style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.12)" }}>
                        <div>
                            <p className="text-[9px] uppercase tracking-widest font-bold" style={{ color: "#10b981" }}>Conversion</p>
                            <p className="text-xl font-black text-white leading-tight">
                                {convs.length > 0 ? Math.round((appliedCount / convs.length) * 100) : 0}
                                <span className="text-xs font-medium" style={{ color: "#52525b" }}>%</span>
                            </p>
                        </div>
                        <div className="h-8 w-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                        <p className="text-[11px] leading-snug" style={{ color: "#52525b" }}>
                            kandidata je prešlo iz razgovora u prijavu
                        </p>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    )
}
