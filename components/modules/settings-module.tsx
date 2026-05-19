"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Bell, Shield, Store, ExternalLink, CheckCircle2, Activity } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { BRAND_CONFIGS, GROUP_CLIENTS } from "@/lib/brand-configs"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface SettingsModuleProps {
    clientId: string
    selectedBrandIds?: string[]
}

export function SettingsModule({ clientId, selectedBrandIds }: SettingsModuleProps) {
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const [interventionAlerts, setInterventionAlerts] = useState(true)
    const [newConvAlerts, setNewConvAlerts] = useState(true)

    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getSession().then(({ data }: { data: any }) => {
            setUserEmail(data.session?.user?.email ?? null)
        })
    }, [])

    // Determine which brand child IDs to display
    const groupChildIds: string[] = GROUP_CLIENTS[clientId] ?? []
    const displayBrandIds = groupChildIds.length > 0 ? groupChildIds
        : selectedBrandIds && selectedBrandIds.length > 0 ? selectedBrandIds
        : [clientId]

    const brandCards = displayBrandIds
        .map(id => ({ id, config: BRAND_CONFIGS[id] }))
        .filter(b => b.config)

    const isGroupClient = groupChildIds.length > 0

    return (
        <div className="space-y-8 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div>
                <h1 className="text-4xl font-bold tracking-tight text-white flex items-center gap-3">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                        Podešavanja
                    </span>
                </h1>
                <p className="text-slate-400 mt-2 text-sm">
                    {isGroupClient ? "Brendovi, obaveštenja i bezbednost naloga" : "Konfiguracija naloga i sistema"}
                </p>
            </div>

            <Tabs defaultValue={isGroupClient ? "brendovi" : "notifications"} className="space-y-6">
                <TabsList className="bg-white/[0.04] border border-white/[0.06] rounded-2xl p-1.5 gap-1 h-auto flex-wrap">
                    {isGroupClient && (
                        <TabsTrigger value="brendovi" className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-emerald/15 data-[state=active]:text-emerald data-[state=active]:border data-[state=active]:border-emerald/25 text-zinc-500 transition-all">
                            <Store className="w-3.5 h-3.5 mr-2" />
                            Brendovi
                        </TabsTrigger>
                    )}
                    <TabsTrigger value="notifications" className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-emerald/15 data-[state=active]:text-emerald data-[state=active]:border data-[state=active]:border-emerald/25 text-zinc-500 transition-all">
                        <Bell className="w-3.5 h-3.5 mr-2" />
                        Obaveštenja
                    </TabsTrigger>
                    <TabsTrigger value="security" className="rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest data-[state=active]:bg-emerald/15 data-[state=active]:text-emerald data-[state=active]:border data-[state=active]:border-emerald/25 text-zinc-500 transition-all">
                        <Shield className="w-3.5 h-3.5 mr-2" />
                        Bezbednost
                    </TabsTrigger>
                </TabsList>

                {/* ── Brendovi tab ────────────────────────────────────────── */}
                {isGroupClient && (
                    <TabsContent value="brendovi" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {brandCards.map(({ id, config }, i) => (
                                <motion.div
                                    key={id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.08, duration: 0.5, ease: 'easeOut' }}
                                    className="relative rounded-2xl border overflow-hidden"
                                    style={{
                                        background: `linear-gradient(145deg, ${config.color}08, ${config.color}03)`,
                                        borderColor: `${config.color}25`,
                                    }}
                                >
                                    {/* Color accent bar */}
                                    <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${config.color}, ${config.color}40)` }} />

                                    <div className="p-6 space-y-4">
                                        {/* Brand name + active badge */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-white font-bold text-base leading-tight">{config.brandName}</h3>
                                                <a
                                                    href={`https://${config.websiteUrl}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 mt-1 text-[11px] transition-colors"
                                                    style={{ color: `${config.color}99` }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = config.color!)}
                                                    onMouseLeave={e => (e.currentTarget.style.color = `${config.color}99`)}
                                                >
                                                    {config.websiteUrl}
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                </a>
                                            </div>
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0 text-[9px] font-bold uppercase tracking-widest"
                                                style={{ background: `${config.color}15`, border: `1px solid ${config.color}30`, color: config.color }}>
                                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: config.color }} />
                                                Agent aktivan
                                            </div>
                                        </div>

                                        {/* Instagram handle */}
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${config.color}15` }}>
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ color: config.color }}>
                                                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="currentColor" strokeWidth="2" fill="none"/>
                                                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
                                                    <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/>
                                                </svg>
                                            </div>
                                            <span className="text-zinc-300 text-sm font-medium">{config.instagramHandle}</span>
                                        </div>

                                        {/* Divider */}
                                        <div className="h-px" style={{ background: `${config.color}15` }} />

                                        {/* Module count + status */}
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                                                <Activity className="w-3 h-3" style={{ color: config.color }} />
                                                <span>5 aktivnih modula</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-[10px]" style={{ color: `${config.color}80` }}>
                                                <CheckCircle2 className="w-3 h-3" />
                                                Konfigurisano
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald/10 border border-emerald/20 flex items-center justify-center shrink-0">
                                    <Settings className="w-4 h-4 text-emerald" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-zinc-300">Konfiguracija brendova</p>
                                    <p className="text-xs text-zinc-600 mt-0.5">Kontaktirajte SmartFlow za izmenu konfiguracije, dodavanje novih brendova ili promenu modula.</p>
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                )}

                {/* ── Obaveštenja tab ─────────────────────────────────────── */}
                <TabsContent value="notifications" className="space-y-4">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/[0.05]">
                            <p className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Obaveštenja o konverzacijama</p>
                            <p className="text-xs text-zinc-600 mt-1">Kada agent označi konverzaciju za pažnju</p>
                        </div>

                        <div className="divide-y divide-white/[0.04]">
                            {[
                                {
                                    id: 'intervention',
                                    label: 'Intervencija obaveštenja',
                                    description: 'Obavesti me kada kupac treba ličnu pažnju',
                                    active: interventionAlerts,
                                    toggle: () => setInterventionAlerts(v => !v),
                                    color: '#ef4444',
                                },
                                {
                                    id: 'new-conv',
                                    label: 'Novi razgovori',
                                    description: 'Obavesti me o svakom novom kupcu koji kontaktira agenta',
                                    active: newConvAlerts,
                                    toggle: () => setNewConvAlerts(v => !v),
                                    color: '#10b981',
                                },
                            ].map(({ id, label, description, active, toggle, color }) => (
                                <div key={id} className="flex items-center justify-between px-6 py-5 group">
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-semibold text-zinc-200">{label}</p>
                                        <p className="text-xs text-zinc-600">{description}</p>
                                    </div>
                                    <button
                                        onClick={toggle}
                                        className={cn(
                                            "relative w-12 h-6 rounded-full transition-all duration-300 shrink-0 ml-4 border",
                                            active ? "border-transparent" : "bg-white/5 border-white/10"
                                        )}
                                        style={active ? { background: `${color}cc`, boxShadow: `0 0 12px ${color}40` } : {}}
                                    >
                                        <span
                                            className={cn(
                                                "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300",
                                                active ? "left-[26px]" : "left-0.5"
                                            )}
                                        />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-6 py-4">
                        <p className="text-xs text-zinc-600 italic">Obaveštenja se šalju putem email-a. SMS notifikacije su dostupne u naprednom planu.</p>
                    </div>
                </TabsContent>

                {/* ── Bezbednost tab ──────────────────────────────────────── */}
                <TabsContent value="security" className="space-y-4">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                        <div className="px-6 py-4 border-b border-white/[0.05]">
                            <p className="text-sm font-bold text-zinc-300 uppercase tracking-widest">Nalog</p>
                        </div>

                        <div className="px-6 py-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Email naloga</p>
                                    <p className="text-sm text-zinc-200 font-mono">{userEmail ?? '—'}</p>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald/10 text-emerald border border-emerald/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Verifikovan
                                </div>
                            </div>

                            <div className="h-px bg-white/[0.05]" />

                            <div>
                                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Promena lozinke</p>
                                <p className="text-xs text-zinc-600">Za promenu lozinke kontaktirajte SmartFlow ili koristite "Zaboravljena lozinka" pri sledećem login-u.</p>
                            </div>

                            <div className="h-px bg-white/[0.05]" />

                            <div>
                                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-1">Pristup sistemu</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="w-2 h-2 rounded-full bg-emerald animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                                    <p className="text-xs text-zinc-400">Aktivna sesija · {new Date().toLocaleDateString('sr-RS', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-6 py-4">
                        <div className="flex items-start gap-3">
                            <Shield className="w-4 h-4 text-emerald mt-0.5 shrink-0" />
                            <p className="text-xs text-zinc-600">Svi podaci su zaštićeni Row Level Security (RLS) politikama. Nikada nećete videti podatke drugog klijenta.</p>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
