"use client"

import { format, subDays, startOfDay } from "date-fns"
import { motion, type Variants } from "framer-motion"
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
    AreaChart, Area, CartesianGrid,
    ReferenceLine,
} from "recharts"
import { TrendingUp, MessageSquare, Users, Zap, Activity } from "lucide-react"

interface ChatbotAnalyticsModuleProps {
    clientId: string
}


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
                WebkitBackdropFilter: "blur(20px)",
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
                WebkitBackdropFilter: "blur(20px)",
                padding: "20px",
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
                className={`text-3xl md:text-[2.6rem] font-black leading-none tracking-tighter ${accent ? "glow-emerald text-gradient-emerald animate-count-up" : "text-white"}`}
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
    // Demo mode — no live data needed for presentation
    void clientId

    // ── Demo mode — fixed, presentation-ready numbers ───────────────────────
    const DEMO_MODE = true

    // Fixed daily curve: steady growth with a weekend dip, peaks mid-week
    const FIXED_DAILY = [8, 11, 14, 17, 19, 13, 10, 15, 18, 22, 24, 19, 16, 21]
    const totalConvs  = FIXED_DAILY.reduce((s, v) => s + v, 0) // 227
    const appliedCount = 91   // 40% conversion rate
    const jobAskCount  = 173  // 76% asked about a specific position
    const forwardedCount = 84 // 37% forwarded to employer (positive close)
    const avgPerDay    = 16
    const responseRate = "98.7%"

    const today = startOfDay(new Date())
    const dailyData = FIXED_DAILY.map((count, i) => ({
        day: format(subDays(today, 13 - i), "d.M"),
        count: DEMO_MODE ? count : count, // always fixed
    }))

    const jobData: { name: string; value: number }[] = [
        ["Konobar / Sanker", 118],
        ["Magacin",          97 ],
        ["Prodavac",         74 ],
        ["Dostava",          61 ],
        ["Cuvar",            48 ],
        ["Ciscenje / Spre.", 33 ],
        ["Utovarivac",       29 ],
    ].map(([name, value]) => ({ name: name as string, value: value as number }))

    const qData: { name: string; value: number }[] = [
        { name: "Prijava za posao",  value: 91 },
        { name: "Opste informacije", value: 74 },
        { name: "Pitanje o plati",   value: 63 },
        { name: "Pitanje o smeni",   value: 49 },
        { name: "Slanje dokumenta",  value: 28 },
    ]

    const funnelData = [
        { label: "Pokrenuli razgovor",    count: totalConvs,    color: "#10b981", pct: 100 },
        { label: "Pitali o poslu",        count: jobAskCount,   color: "#06b6d4", pct: 76  },
        { label: "Prijavili se",          count: appliedCount,  color: "#f59e0b", pct: 40  },
        { label: "Prosleđeni poslodavcu", count: forwardedCount,color: "#a78bfa", pct: 37  },
    ]

    const pieData = [
        { name: "Instagram", value: 91,  color: "#ec4899", glow: "rgba(236,72,153,0.3)"  },
        { name: "WhatsApp",  value: 68,  color: "#10b981", glow: "rgba(16,185,129,0.3)"  },
        { name: "Facebook",  value: 34,  color: "#3b82f6", glow: "rgba(59,130,246,0.3)"  },
        { name: "Website",   value: 34,  color: "#8b5cf6", glow: "rgba(139,92,246,0.3)"  },
    ]

    const maxJob = jobData[0]?.value || 1

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
                    <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-none text-white">
                        Agent{" "}
                        <span className="text-gradient-emerald glow-emerald">Analitika</span>
                    </h2>
                    <p className="mt-2 text-xs md:text-sm font-light" style={{ color: "#52525b" }}>
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
                <StatCard accent label="Prosecno Upita/Dan" value={avgPerDay}    icon={TrendingUp}   sub="razgovora u proseku" />
                <StatCard label="Razgovora Ukupno"   value={totalConvs}   icon={MessageSquare} sub="poslednjih 14 dana" />
                <StatCard label="Trazili Poziciju"   value={jobAskCount}   icon={Users}         sub="konkretan upit" />
                <StatCard label="Stopa Odgovora"     value={responseRate}  icon={Zap}           sub="AI pokrivenost" accent />
            </motion.div>

            {/* ── Primary row: Area chart + Pie ── */}
            <div className="grid grid-cols-12 gap-4">
                {/* Area chart — full width on small, 8 cols on large */}
                <motion.div variants={fadeUp} className="col-span-12 lg:col-span-8 rounded-2xl overflow-hidden grain-overlay relative"
                    style={{
                        background: "linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))",
                        border: "1px solid rgba(255,255,255,0.07)",
                        backdropFilter: "blur(20px)",
                        WebkitBackdropFilter: "blur(20px)",
                        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
                        padding: "20px",
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
                        WebkitBackdropFilter: "blur(20px)",
                        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
                        padding: "20px",
                    }}
                >
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "#52525b" }}>Kanali</p>
                    <p className="text-base font-semibold text-white mb-6">Izvor razgovora</p>
                    <div className="flex justify-center">
                        <div className="relative">
                            {/* Centre label */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                                <p className="text-2xl font-black text-white leading-none">{totalConvs}</p>
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
                                            width: `${Math.round((d.value / (totalConvs || 1)) * 100)}%`,
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
                    WebkitBackdropFilter: "blur(20px)",
                    boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
                    padding: "20px",
                }}
            >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "#52525b" }}>Konverzija</p>
                <p className="text-base font-semibold text-white mb-8">Gde staje razgovor</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
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
                        WebkitBackdropFilter: "blur(20px)",
                        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
                        padding: "20px",
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
                                const color = `hsl(${hue}, 80%, 45%)`
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
                                                    background: `linear-gradient(90deg, ${color}, hsl(200, 80%, 40%))`,
                                                    boxShadow: `0 0 8px hsla(${hue}, 80%, 45%, 0.4)`,
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
                        WebkitBackdropFilter: "blur(20px)",
                        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
                        padding: "20px",
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
                                {Math.round((appliedCount / totalConvs) * 100)}
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
