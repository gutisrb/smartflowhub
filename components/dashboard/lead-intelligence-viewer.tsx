"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
    Instagram,
    Facebook,
    MessageCircle,
    Bot,
    User,
    MapPin,
    Calendar,
    RefreshCw,
    Phone,
    Mail,
    Globe,
    Linkedin,
    TrendingUp,
    TrendingDown,
    Minus,
    Heart,
    Eye,
    Film,
    Zap,
    Star,
    ChevronRight,
    ExternalLink,
    BarChart2,
    Key,
    Copy,
    Check,
    ShoppingBag,
    AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { format } from "date-fns"

interface Message {
    id: string
    role: "user" | "assistant" | "system"
    message: string
    created_at: string
    platform: string
    metadata?: any
}

interface LeadIntelligenceViewerProps {
    lead: any | null
    isOpen: boolean
    onClose: () => void
    isClientView?: boolean
    isRecruitment?: boolean
}

// ─── B2B Lead Intel Panel ─────────────────────────────────────────────────────

function DemoCopyRow({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false)
    const copy = () => {
        navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }
    return (
        <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 w-14 shrink-0 uppercase tracking-widest">{label}</span>
            <span className="text-xs text-zinc-200 font-mono flex-1 truncate">{value}</span>
            <button onClick={copy} className="shrink-0 text-zinc-600 hover:text-cyan-400 transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
        </div>
    )
}

function ServiceBadge({ service }: { service: string }) {
    const map: Record<string, { label: string; color: string }> = {
        social_media_system: { label: 'Social Media System', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
        ai_organic_content:  { label: 'AI Organic Content',  color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25' },
        ai_sales_systems:    { label: 'AI Sales Systems',    color: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
    }
    const s = map[service] || map['social_media_system']
    return (
        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border', s.color)}>
            {s.label}
        </span>
    )
}

function EngagementIndicator({ rate }: { rate: number }) {
    if (rate >= 4)   return <span className="flex items-center gap-1 text-emerald-400 text-xs"><TrendingUp className="w-3 h-3" />{rate.toFixed(1)}%</span>
    if (rate >= 1.5) return <span className="flex items-center gap-1 text-amber-400 text-xs"><Minus className="w-3 h-3" />{rate.toFixed(1)}%</span>
    return                  <span className="flex items-center gap-1 text-red-400 text-xs"><TrendingDown className="w-3 h-3" />{rate.toFixed(1)}%</span>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDeliveryStatusColor(s: string) {
    const v = (s || '').toLowerCase()
    if (v === 'dostavljeno')  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
    if (v === 'poslato')      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/15'
    if (v === 'obrađuje se')  return 'bg-amber-500/10 text-amber-400 border-amber-500/15'
    if (v === 'reklamacija')  return 'bg-orange-500/10 text-orange-400 border-orange-500/15'
    return 'bg-white/5 text-zinc-500 border-white/5'
}

// ─── Demo CRM Customer Panel ──────────────────────────────────────────────────

function DemoCRMCustomerPanel({ lead, messages, messagesLoading }: { lead: any; messages: Message[]; messagesLoading: boolean }) {
    const [copiedField, setCopiedField] = useState<string | null>(null)
    const copy = (text: string, field: string) => {
        navigator.clipboard.writeText(text)
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 2000)
    }

    const status   = (lead.status || 'Novi') as string
    const statusLc = status.toLowerCase()
    const product  = lead.proizvod || lead.knjiga || null
    const category = lead.zdravstveni_cilj || lead.tema || lead.kategorija || null
    const joinedDate = lead.created_at ? format(new Date(lead.created_at), 'dd.MM.yyyy.') : null

    // Bookstore/Maguna style: delivery pipeline lives in status_porudzbine
    const deliveryStep    = lead.status_porudzbine as string | null
    const deliverySteps   = ['Obrađuje se', 'Poslato', 'Dostavljeno']
    const deliveryStepIdx = deliverySteps.indexOf(deliveryStep ?? '')
    const hasDelivery     = !!deliveryStep && deliveryStep !== 'Reklamacija'

    // ecommerce/furniture style: status IS the order state
    const isOrdered      = ['naručio', 'poručio'].includes(statusLc)
    const isDelivered    = ['isporučeno', 'dostavljeno'].includes(statusLc)
    const isAppt         = ['zakazano', 'završeno'].includes(statusLc)
    const isComplaint    = statusLc === 'reklamacija' || deliveryStep === 'Reklamacija'
    const isInterested   = statusLc === 'zainteresovan'
    const isIntervention = statusLc === 'intervencija'

    const sourceColor = (() => {
        const iz = (lead.izvor || '').toLowerCase()
        if (iz.includes('instagram'))  return '#e1306c'
        if (iz.includes('facebook'))   return '#1877f2'
        if (iz.includes('whatsapp'))   return '#25d366'
        if (iz.includes('website') || iz.includes('web') || iz.includes('landing')) return '#8b5cf6'
        return '#71717a'
    })()

    const getKanalIcon = (iz: string) => {
        const v = (iz || '').toLowerCase()
        if (v.includes('instagram')) return <Instagram className="w-3 h-3 text-pink-400" />
        if (v.includes('facebook'))  return <Facebook className="w-3 h-3 text-blue-400" />
        if (v.includes('whatsapp'))  return <MessageCircle className="w-3 h-3 text-emerald-400" />
        return <Globe className="w-3 h-3 text-zinc-400" />
    }

    return (
        <div className="px-8 py-6 space-y-4 pb-12">

            {/* Contact info */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                <div className="px-5 py-3 border-b border-white/[0.05]">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Kontakt</span>
                </div>
                <div className="px-5 py-4 space-y-3">
                    {lead.email ? (
                        <div className="flex items-center gap-3">
                            <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="text-xs text-zinc-200 font-mono flex-1 truncate">{lead.email}</span>
                            <button onClick={() => copy(lead.email, 'email')} className="shrink-0 text-zinc-600 hover:text-emerald-400 transition-colors">
                                {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Mail className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
                            <span className="text-xs text-zinc-600 italic">Email nije zabeležen</span>
                        </div>
                    )}
                    {lead.telefon ? (
                        <div className="flex items-center gap-3">
                            <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="text-sm text-zinc-300 flex-1">{lead.telefon}</span>
                            <button onClick={() => copy(lead.telefon, 'phone')} className="shrink-0 text-zinc-600 hover:text-emerald-400 transition-colors">
                                {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Phone className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
                            <span className="text-xs text-zinc-600 italic">Telefon nije zabeležen</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                        <div className="flex items-center gap-1.5">
                            {getKanalIcon(lead.izvor || '')}
                            <span className="text-xs font-semibold" style={{ color: sourceColor }}>{lead.izvor || 'Nepoznat izvor'}</span>
                        </div>
                        {joinedDate && <span className="text-xs text-zinc-600">{joinedDate}</span>}
                    </div>
                </div>
            </motion.div>

            {/* Product / service interest */}
            {(category || product) && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/[0.05]">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Interesovanje</span>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                        {category && (
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] text-zinc-600 uppercase tracking-widest w-20 shrink-0">Kategorija</span>
                                <span className="text-xs text-zinc-300 bg-white/[0.05] border border-white/[0.07] px-2.5 py-1 rounded-full">{category}</span>
                            </div>
                        )}
                        {product && (
                            <div className="flex items-start gap-3">
                                <span className="text-[10px] text-zinc-600 uppercase tracking-widest w-20 shrink-0 mt-0.5">Proizvod</span>
                                <span className="text-sm font-semibold text-white leading-snug">{product}</span>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Order status — ecommerce/furniture direct status */}
            {(isOrdered || isDelivered || isAppt) && !isComplaint && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] overflow-hidden">
                    <div className="px-5 py-3 flex items-center gap-2">
                        <ShoppingBag className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                            {isAppt ? 'Termin' : 'Porudžbina'}
                        </span>
                        <Badge className="ml-auto text-[10px] border px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border-emerald-500/15">
                            {status}
                        </Badge>
                    </div>
                </motion.div>
            )}

            {/* Delivery pipeline — bookstore/Maguna style (status_porudzbine) */}
            {hasDelivery && !isComplaint && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] overflow-hidden">
                    <div className="px-5 py-3 border-b border-emerald-500/10 flex items-center gap-2">
                        <ShoppingBag className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Isporuka</span>
                        <Badge className={cn("ml-auto text-[10px] border px-2.5 py-0.5 rounded-full font-bold uppercase tracking-widest", getDeliveryStatusColor(deliveryStep!))}>
                            {deliveryStep}
                        </Badge>
                    </div>
                    {deliveryStepIdx >= 0 && (
                        <div className="px-5 py-5">
                            <div className="flex items-center">
                                {deliverySteps.map((step, i) => {
                                    const done = i <= deliveryStepIdx
                                    const current = i === deliveryStepIdx
                                    return (
                                        <div key={step} className="flex items-center flex-1 last:flex-none">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <div className={cn(
                                                    "w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-all",
                                                    current ? "border-emerald-400 bg-emerald-400/20 shadow-[0_0_10px_rgba(16,185,129,0.25)]"
                                                        : done ? "border-emerald-600/50 bg-emerald-600/10"
                                                        : "border-white/10 bg-white/[0.02]"
                                                )}>
                                                    {done ? <Check className={cn("w-3 h-3", current ? "text-emerald-400" : "text-emerald-600")} />
                                                         : <span className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                                                </div>
                                                <span className={cn("text-[9px] uppercase tracking-widest whitespace-nowrap", done ? "text-zinc-300" : "text-zinc-600")}>{step}</span>
                                            </div>
                                            {i < deliverySteps.length - 1 && (
                                                <div className={cn("h-px flex-1 mx-2 -mt-4", i < deliveryStepIdx ? "bg-emerald-600/30" : "bg-white/[0.07]")} />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Complaint */}
            {isComplaint && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.04] overflow-hidden">
                    <div className="px-5 py-3 border-b border-orange-500/15 flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-orange-400" />
                        <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Reklamacija</span>
                    </div>
                    <div className="px-5 py-4">
                        {lead.razlog
                            ? <p className="text-sm text-zinc-300">{lead.razlog}</p>
                            : <p className="text-xs text-zinc-400 leading-relaxed">Kupac ima reklamaciju — kontaktirajte ga što pre.</p>
                        }
                    </div>
                </motion.div>
            )}

            {/* Zainteresovan — hasn't ordered yet */}
            {isInterested && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.02] overflow-hidden">
                    <div className="px-5 py-3 border-b border-amber-500/10 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Zainteresovan</span>
                    </div>
                    <div className="px-5 py-4">
                        {lead.razlog
                            ? <p className="text-sm text-zinc-300">{lead.razlog}</p>
                            : <p className="text-xs text-zinc-500">Pokazao interesovanje — nije još naručio.</p>
                        }
                    </div>
                </motion.div>
            )}

            {/* Intervention */}
            {isIntervention && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] px-5 py-3 flex items-center gap-3">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs text-red-300 font-semibold">Zahteva hitnu intervenciju</span>
                    {lead.razlog && <span className="text-xs text-zinc-400 ml-1">— {lead.razlog}</span>}
                </motion.div>
            )}

            {/* Conversation history — the actual AI agent chat */}
            <div className="pt-2">
                <div className="flex items-center gap-3 mb-3">
                    <div className="h-px flex-1 bg-white/[0.06]" />
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        Razgovor sa agentom
                        {messages.length > 0 && <span className="ml-1.5 text-emerald-600">· {messages.length} poruka</span>}
                    </span>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                </div>

                {messagesLoading ? (
                    <div className="flex justify-center py-8">
                        <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin opacity-40" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-zinc-700">
                        <Bot className="w-7 h-7 mb-2 opacity-20" />
                        <p className="text-[10px] uppercase tracking-widest">Nema zabeleženih poruka</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        <AnimatePresence mode="popLayout">
                            {messages.map((msg, idx) => {
                                const isUser  = msg.role === 'user'
                                const hasImage = msg.metadata?.type === 'image'
                                const isStory  = msg.metadata?.type === 'story_reply'
                                return (
                                    <motion.div
                                        key={msg.id || idx}
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.02 }}
                                        className={cn("flex", isUser ? "justify-start" : "justify-end")}
                                    >
                                        <div className={cn(
                                            "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-outfit",
                                            isUser
                                                ? "bg-white/[0.06] text-silver/90 rounded-tl-none border border-white/[0.05]"
                                                : "bg-gradient-to-br from-emerald-600/60 to-cyan-600/60 text-white rounded-tr-none"
                                        )}>
                                            {(hasImage || isStory) && (
                                                <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">
                                                    {isStory ? '↩ Story odgovor' : '📷 Slika'}
                                                </p>
                                            )}
                                            <p className="leading-relaxed">{msg.message}</p>
                                            <span className={cn("text-[10px] mt-1 block opacity-40", isUser ? "text-zinc-400" : "text-white")}>
                                                {format(new Date(msg.created_at), 'HH:mm')}
                                            </span>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    )
}

function formatNum(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000)    return (n / 1000).toFixed(1) + 'k'
    return String(n)
}

function B2BLeadIntelPanel({ lead }: { lead: any }) {
    const enrichment = lead.intake_data?.enrichment
    const dm         = enrichment?.decision_maker
    const intake     = lead.intake_data || {}
    const igProfileRaw = enrichment?.instagram_profile
    // Normalize IG profile — handle both old format (username/url/posts_count) and
    // new format from enrich-leads.mjs (no username, bio_links array, category field)
    const igHandle = igProfileRaw?.username || intake.instagram_handle || null
    const igNorm = igProfileRaw && (igProfileRaw.followers > 0 || igHandle) ? {
        ...igProfileRaw,
        username: igHandle,
        url: igProfileRaw.url || (igHandle ? `https://www.instagram.com/${igHandle}/` : null),
        business_category: igProfileRaw.business_category || igProfileRaw.category || null,
    } : null
    const igProfile  = igNorm
    const igReels    = enrichment?.instagram_reels || []
    const rec        = enrichment?.service_recommendation
    const recReason  = enrichment?.recommendation_reason
    const webIntel   = enrichment?.website_intel

    // Compute engagement rate from reels
    const followers   = igProfile?.followers || 0
    const avgEng      = igReels.length > 0
        ? igReels.reduce((s: number, r: any) => s + (r.likes || 0) + (r.comments || 0), 0) / igReels.length
        : 0
    const engRate     = followers > 0 ? (avgEng / followers) * 100 : 0

    const isEnriched = !!enrichment

    if (!isEnriched && !lead.demo_built_at) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
                <BarChart2 className="w-10 h-10 mb-4 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">Nije enriched</p>
                <p className="text-xs text-zinc-700 mt-1">Pokreni: node enrich-instagram.mjs</p>
            </div>
        )
    }

    const manualContacts: any[] = Array.isArray(lead.manual_contacts) ? lead.manual_contacts : []
    const opens = lead.open_count || 0
    const openedAt = lead.email_opened_at

    return (
        <div className="px-8 py-6 space-y-5 pb-12">

            {/* Demo Dashboard Access */}
            {lead.demo_built_at && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.04] overflow-hidden">
                    <div className="px-5 py-3 border-b border-cyan-500/15 flex items-center gap-2">
                        <Key className="w-3 h-3 text-cyan-400" />
                        <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">Demo Pristup</span>
                        <span className="ml-auto text-[10px] text-zinc-500">
                            izgrađen {format(new Date(lead.demo_built_at), 'dd.MM.yyyy.')}
                        </span>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                        {lead.demo_tenant_url && (
                            <a href={lead.demo_tenant_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors group">
                                <Globe className="w-3.5 h-3.5 shrink-0" />
                                <span className="flex-1 truncate">{lead.demo_tenant_url}</span>
                                <ExternalLink className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100" />
                            </a>
                        )}
                        {lead.demo_tenant_email && (
                            <DemoCopyRow label="Email" value={lead.demo_tenant_email} />
                        )}
                        {lead.demo_tenant_password && (
                            <DemoCopyRow label="Lozinka" value={lead.demo_tenant_password} />
                        )}
                    </div>
                </motion.div>
            )}

            {/* Manual touch log — surfaces phone calls, WhatsApp, off-channel work */}
            {manualContacts.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.03] overflow-hidden">
                    <div className="px-5 py-3 border-b border-amber-400/10 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Manual Contact Log</span>
                        <span className="text-[10px] text-zinc-500">{manualContacts.length} touch{manualContacts.length === 1 ? '' : 'es'}</span>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                        {manualContacts.map((t: any, i: number) => (
                            <div key={i} className="flex gap-3 text-xs">
                                <div className="w-16 shrink-0 text-zinc-500 font-mono">{t.date || '—'}</div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-white/[0.05] text-zinc-400 border-white/10 text-[9px] uppercase tracking-widest px-1.5 py-0">
                                            {t.channel || 'note'}
                                        </Badge>
                                        {t.outcome && (
                                            <span className="text-[10px] text-zinc-500">→ {t.outcome}</span>
                                        )}
                                    </div>
                                    {t.notes && <div className="text-zinc-300 mt-1 leading-relaxed">{t.notes}</div>}
                                    {t.next_action && (
                                        <div className="mt-1.5 text-[10px] text-amber-400/90 italic">
                                            Next: {t.next_action}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Email open tracking */}
            {openedAt && (
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] px-5 py-3 flex items-center gap-3">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-zinc-300">
                        Opened {format(new Date(openedAt), 'MMM d, HH:mm')}
                        {opens > 1 && <span className="text-zinc-500"> · {opens}× total</span>}
                    </span>
                </div>
            )}

            {/* Decision Maker */}
            {dm && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/[0.05]">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Decision Maker</span>
                    </div>
                    <div className="px-5 py-4 space-y-2.5">
                        {dm.name && (
                            <div className="flex items-center gap-2">
                                <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                <span className="text-sm font-semibold text-silver">{dm.name}</span>
                                {dm.title && <span className="text-xs text-zinc-500">· {dm.title}</span>}
                            </div>
                        )}
                        {dm.email && (
                            <div className="flex items-center gap-2">
                                <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                <a href={`mailto:${dm.email}`} className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                                    {dm.email}
                                </a>
                            </div>
                        )}
                        {dm.phone && (
                            <div className="flex items-center gap-2">
                                <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                <span className="text-sm text-zinc-300">{dm.phone}</span>
                            </div>
                        )}
                        {dm.linkedin && (
                            <div className="flex items-center gap-2">
                                <Linkedin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                <a href={dm.linkedin} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1">
                                    LinkedIn profil <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        )}
                        {dm.seniority && (
                            <div className="flex items-center gap-2">
                                <Star className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                                <span className="text-xs text-zinc-400 capitalize">{dm.seniority}</span>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Instagram Profile */}
            {!igProfile && enrichment && (
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/[0.05]">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Instagram Profil</span>
                    </div>
                    <div className="px-5 py-4 flex items-center gap-2 text-zinc-600">
                        <Instagram className="w-4 h-4 opacity-30" />
                        <span className="text-xs">Instagram nalaz nije pronađen — verovatno nema IG ili koristi drugi handle</span>
                    </div>
                </div>
            )}
            {igProfile && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Instagram Profil</span>
                        <a href={igProfile.url} target="_blank" rel="noopener noreferrer"
                            className="text-[10px] text-pink-400 hover:text-pink-300 flex items-center gap-1">
                            @{igProfile.username} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                    </div>
                    <div className="px-5 py-4">
                        {/* Stats row */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                                <div className="text-base font-bold text-silver">{igProfile.followers > 0 ? formatNum(igProfile.followers) : '—'}</div>
                                <div className="text-[10px] text-zinc-500 mt-0.5">Pratioci</div>
                            </div>
                            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                                <div className="text-base font-bold text-silver">{igProfile.posts_count || '—'}</div>
                                <div className="text-[10px] text-zinc-500 mt-0.5">Objave</div>
                            </div>
                            <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                                {igReels.length > 0
                                    ? <div className="text-base font-bold"><EngagementIndicator rate={engRate} /></div>
                                    : <div className="text-base font-bold text-zinc-600">—</div>
                                }
                                <div className="text-[10px] text-zinc-500 mt-0.5">Eng. rate</div>
                            </div>
                        </div>

                        {/* Bio */}
                        {igProfile.bio && (
                            <div className="text-xs text-zinc-400 leading-relaxed bg-white/[0.02] rounded-xl px-3.5 py-3 border border-white/[0.04] mb-3">
                                "{igProfile.bio}"
                            </div>
                        )}

                        {/* Meta */}
                        <div className="flex flex-wrap gap-2">
                            {igProfile.business_category && (
                                <span className="text-[10px] text-zinc-500 bg-white/[0.04] px-2.5 py-1 rounded-full">
                                    {igProfile.business_category}
                                </span>
                            )}
                            {igProfile.is_verified && (
                                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-full">✓ Verifikovan</span>
                            )}
                            {igProfile.business_email && (
                                <span className="text-[10px] text-zinc-400 bg-white/[0.04] px-2.5 py-1 rounded-full">
                                    📧 {igProfile.business_email}
                                </span>
                            )}
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Recent Reels */}
            {igReels.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/[0.05]">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Poslednji Reelsi</span>
                    </div>
                    <div className="divide-y divide-white/[0.04]">
                        {igReels.map((reel: any, i: number) => {
                            const reelUrl = reel.url || (reel.shortcode ? `https://www.instagram.com/reel/${reel.shortcode}/` : null)
                            return (
                            <div key={i} className="px-5 py-3.5">
                                {reel.caption && (
                                    <p className="text-xs text-zinc-300 leading-relaxed mb-2 line-clamp-2">
                                        {reel.caption}
                                    </p>
                                )}
                                {reel.transcript && (
                                    <div className="text-[11px] text-zinc-400 leading-relaxed mb-2 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/[0.04] italic">
                                        🎙 "{reel.transcript.substring(0, 200)}{reel.transcript.length > 200 ? '…' : ''}"
                                    </div>
                                )}
                                <div className="flex items-center gap-4">
                                    {reel.likes != null && (
                                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                                            <Heart className="w-3 h-3 text-pink-500/70" /> {formatNum(reel.likes || 0)}
                                        </span>
                                    )}
                                    {reel.comments != null && (
                                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                                            <MessageCircle className="w-3 h-3 text-blue-400/70" /> {formatNum(reel.comments || 0)}
                                        </span>
                                    )}
                                    {reel.views > 0 && (
                                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                                            <Eye className="w-3 h-3 text-zinc-500/70" /> {formatNum(reel.views)}
                                        </span>
                                    )}
                                    {reelUrl && (
                                        <a href={reelUrl} target="_blank" rel="noopener noreferrer"
                                            className="ml-auto text-[10px] text-zinc-600 hover:text-zinc-400 flex items-center gap-0.5">
                                            <Film className="w-3 h-3" /> Otvori
                                        </a>
                                    )}
                                </div>
                            </div>
                            )
                        })}
                    </div>
                </motion.div>
            )}

            {/* Website Intel */}
            {webIntel && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Website Intel</span>
                        {lead.website && (
                            <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-blue-400/70 hover:text-blue-400 flex items-center gap-1">
                                <Globe className="w-2.5 h-2.5" /> Otvori sajt <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                        )}
                    </div>
                    <div className="px-5 py-4 space-y-3">
                        {webIntel.description && (
                            <p className="text-xs text-zinc-300 leading-relaxed">
                                {webIntel.description}
                            </p>
                        )}
                        {webIntel.products?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {webIntel.products.map((p: string, i: number) => (
                                    <span key={i} className="text-[10px] text-blue-300/80 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
                                        {p}
                                    </span>
                                ))}
                            </div>
                        )}
                        {webIntel.is_female_brand && (
                            <span className="text-[10px] text-pink-400/80 bg-pink-500/10 border border-pink-500/20 px-2.5 py-0.5 rounded-full inline-block">
                                ♀ Female-first brand
                            </span>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Meta Ads Intel */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                <div className="px-5 py-3 border-b border-white/[0.05]">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Meta Ads Intel</span>
                </div>
                <div className="px-5 py-4 space-y-2">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                            <div className="text-base font-bold text-silver">{intake.active_ads_count || '—'}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">Aktivnih oglasa</div>
                        </div>
                        <div className="bg-white/[0.03] rounded-xl p-3 text-center">
                            <div className="text-base font-bold text-silver">{formatNum(intake.page_followers || 0)}</div>
                            <div className="text-[10px] text-zinc-500 mt-0.5">FB pratioci</div>
                        </div>
                    </div>
                    {intake.ad_copies?.[0] && !intake.ad_copies[0].includes('{{') && (
                        <div className="text-xs text-zinc-400 leading-relaxed bg-white/[0.02] rounded-xl px-3.5 py-3 border border-white/[0.04]">
                            "{intake.ad_copies[0].substring(0, 140)}..."
                        </div>
                    )}
                    {intake.page_categories?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {intake.page_categories.map((cat: string, i: number) => (
                                <span key={i} className="text-[10px] text-zinc-500 bg-white/[0.04] px-2 py-0.5 rounded-full">{cat}</span>
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>

            {/* AI Analysis */}
            {enrichment?.ai_analysis && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] overflow-hidden">
                    <div className="px-5 py-3 border-b border-violet-500/15 flex items-center gap-2">
                        <Zap className="w-3 h-3 text-violet-400" />
                        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">AI Analiza Leada</span>
                    </div>
                    <div className="px-5 py-4">
                        <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{enrichment.ai_analysis}</p>
                    </div>
                </motion.div>
            )}

            {/* Service Recommendation */}
            {rec && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/[0.05]">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Preporučena Usluga</span>
                    </div>
                    <div className="px-5 py-4 space-y-3">
                        <ServiceBadge service={rec} />
                        {recReason && (
                            <p className="text-xs text-zinc-400 leading-relaxed">{recReason}</p>
                        )}
                    </div>
                </motion.div>
            )}
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeadIntelligenceViewer({ lead, isOpen, onClose }: LeadIntelligenceViewerProps) {
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(false)
    const supabase = createClient()

    // Detect B2B lead (SmartFlow outreach) vs CRM customer vs recruitment lead
    const isB2BLead = lead?.izvor === 'meta_ads_scrape' || lead?.izvor === 'Chatbot Outreach' || !!lead?.intake_data?.enrichment || !!lead?.email_draft
    // CRM customers (demo or real bookstore/ecommerce): use full_name, not ime
    const isDemoCRMCustomer = !isB2BLead && !!lead?.full_name && !lead?.ime

    useEffect(() => {
        if (lead && isOpen && !isB2BLead) {
            fetchMessages()
        } else if (isOpen) {
            setMessages([])
        }
    }, [lead, isOpen])

    const fetchMessages = async () => {
        setLoading(true)
        let threadId = lead.id_razgovora

        if (!threadId) {
            const firstName = (lead.ime || lead.full_name || '').split(' ')[0]
            if (firstName) {
                const { data: nameHits } = await supabase
                    .from("razgovori")
                    .select("id_razgovora")
                    .eq("client_id", lead.client_id)
                    .filter("metadata->>name", "ilike", `${firstName}%`)
                    .limit(1)
                if (nameHits && nameHits.length > 0) {
                    threadId = nameHits[0].id_razgovora
                }
            }
        }

        if (!threadId) { setMessages([]); setLoading(false); return }

        const { data, error } = await supabase
            .from("razgovori")
            .select("*")
            .eq("id_razgovora", threadId)
            .neq("role", "system")
            .order("created_at", { ascending: true })

        if (!error) setMessages(data || [])
        setLoading(false)
    }

    const getStatusColor = (status: string) => {
        const s = status?.toLowerCase()
        if (s === 'zaposlen')      return 'bg-emerald/15 text-emerald border-emerald/20'
        if (s === 'poručio')       return 'bg-emerald/15 text-emerald border-emerald/20'
        if (s === 'naručio')       return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        if (s === 'isporučeno')    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        if (s === 'završeno')      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        if (s === 'intervju')      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
        if (s === 'zakazano')      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
        if (s === 'kvalifikovan')  return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        if (s === 'zainteresovan') return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        if (s === 'enriched')      return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
        if (s === 'vreo')          return 'bg-red-500/10 text-red-400 border-red-500/20'
        if (s === 'intervencija')  return 'bg-orange-500/15 text-orange-400 border-orange-500/25'
        if (s === 'reklamacija')   return 'bg-orange-500/15 text-orange-400 border-orange-500/25'
        return 'bg-white/5 text-zinc-500 border-white/5'
    }

    const getKanalIcon = (platform: string) => {
        switch (platform?.toLowerCase()) {
            case "instagram": return <Instagram className="h-3 w-3 text-pink-400" />
            case "facebook":  return <Facebook className="h-3 w-3 text-blue-400" />
            case "whatsapp":  return <MessageCircle className="h-3 w-3 text-emerald" />
            default:          return <MessageCircle className="h-3 w-3 text-zinc-400" />
        }
    }

    if (!lead) return null

    // Header info items — adapt based on B2B vs CRM customer vs recruitment
    const infoItems = isB2BLead ? [
        lead.email && { icon: <Mail className="w-3 h-3" />, label: "Email", value: lead.email },
        lead.website && { icon: <Globe className="w-3 h-3" />, label: "Website", value: lead.website.replace(/https?:\/\/(www\.)?/, '').split('/')[0] },
        lead.izvor && { icon: <Facebook className="w-3 h-3" />, label: "Izvor", value: lead.izvor },
        lead.created_at && { icon: <Calendar className="w-3 h-3" />, label: "Datum", value: format(new Date(lead.created_at), 'dd.MM.yyyy.') },
    ].filter(Boolean) : isDemoCRMCustomer ? [
        lead.status_porudzbine && { icon: <ShoppingBag className="w-3 h-3" />, label: "Porudžbina", value: lead.status_porudzbine },
        lead.izvor && { icon: getKanalIcon(lead.izvor), label: "Kanal", value: lead.izvor },
        lead.created_at && { icon: <Calendar className="w-3 h-3" />, label: "Datum", value: format(new Date(lead.created_at), 'dd.MM.yyyy.') },
    ].filter(Boolean) : [
        lead.starost && { icon: <User className="w-3 h-3" />, label: "Godine", value: `${lead.starost} god.` },
        lead.lokacija && { icon: <MapPin className="w-3 h-3" />, label: "Lokacija", value: lead.lokacija },
        lead.email && { icon: <Mail className="w-3 h-3" />, label: "Email", value: lead.email },
        (lead.phone || lead.telefon) && { icon: <Phone className="w-3 h-3" />, label: "Telefon", value: lead.phone || lead.telefon },
        lead.izvor && { icon: getKanalIcon(lead.izvor), label: "Kanal", value: lead.izvor },
        lead.created_at && { icon: <Calendar className="w-3 h-3" />, label: "Prijava", value: format(new Date(lead.created_at), 'dd.MM.yyyy.') },
    ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[]

    // Display name
    const displayName = lead.company_name || lead.ime || lead.full_name || lead.name || '?'
    const displayInitial = displayName[0] || '?'

    // Status — for CRM customers kategorija is product category, not status
    const statusLabel = isDemoCRMCustomer ? (lead.status || 'Lead') : (lead.kategorija || lead.status || 'Lead')

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[640px] h-[88vh] flex flex-col p-0 overflow-hidden border-white/5 bg-obsidian/95 backdrop-blur-2xl rounded-[2rem] shadow-2xl">

                {/* Header */}
                <div className="px-8 pt-8 pb-5 shrink-0 border-b border-white/5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center font-bold text-lg shrink-0",
                                isB2BLead
                                    ? "bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-400"
                                    : "bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400"
                            )}>
                                {displayInitial}
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-outfit font-bold text-silver tracking-tight">
                                    {displayName}
                                </DialogTitle>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <Badge className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border", getStatusColor(statusLabel))}>
                                        {statusLabel}
                                    </Badge>
                                    {lead.niche && lead.niche !== 'ostalo' && (
                                        <span className="text-xs text-zinc-500">· {lead.niche}</span>
                                    )}
                                    {isB2BLead && lead.intake_data?.enrichment && (
                                        <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                                            <Zap className="w-3 h-3" /> enriched
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {infoItems.length > 0 && (
                        <div className="flex flex-wrap gap-3 mt-5">
                            {(infoItems as { icon: React.ReactNode; label: string; value: string }[]).map((item, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-400">
                                    <span className="text-zinc-600">{item.icon}</span>
                                    <span>{item.value}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Content area */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className="px-8 py-3 border-b border-white/5 shrink-0">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            {isB2BLead ? 'Lead Intelligence' : isDemoCRMCustomer ? 'Profil Kupca' : 'Istorija Razgovora'}
                            {!isB2BLead && !isDemoCRMCustomer && messages.length > 0 && (
                                <span className="ml-2 text-emerald">· {messages.length} poruka</span>
                            )}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        {isB2BLead ? (
                            <B2BLeadIntelPanel lead={lead} />
                        ) : isDemoCRMCustomer ? (
                            <DemoCRMCustomerPanel lead={lead} messages={messages} messagesLoading={loading} />
                        ) : (
                            <div className="px-8 py-6 space-y-3 pb-12">
                                {loading && (
                                    <div className="flex justify-center py-16">
                                        <RefreshCw className="w-5 h-5 text-emerald animate-spin opacity-40" />
                                    </div>
                                )}
                                {!loading && messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
                                        <Bot className="w-10 h-10 mb-4 opacity-20" />
                                        <p className="text-xs font-bold uppercase tracking-widest">Nema razgovora</p>
                                    </div>
                                )}
                                <AnimatePresence mode="popLayout">
                                    {messages.map((msg, idx) => {
                                        const isUser    = msg.role === 'user'
                                        const hasImage  = msg.metadata?.type === 'image'
                                        const isStory   = msg.metadata?.type === 'story_reply'
                                        return (
                                            <motion.div
                                                key={msg.id || idx}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.02 }}
                                                className={cn("flex", isUser ? "justify-start" : "justify-end")}
                                            >
                                                <div className={cn(
                                                    "max-w-[76%] rounded-2xl px-4 py-2.5 text-sm font-outfit",
                                                    isUser
                                                        ? "bg-white/[0.07] text-silver/90 rounded-tl-none border border-white/[0.06]"
                                                        : "bg-gradient-to-br from-emerald-600/70 to-cyan-600/70 text-white rounded-tr-none"
                                                )}>
                                                    {(hasImage || isStory) && (
                                                        <p className="text-[10px] uppercase tracking-widest opacity-50 mb-1">
                                                            {isStory ? '↩ Story odgovor' : '📷 Slika'}
                                                        </p>
                                                    )}
                                                    <p className="leading-relaxed">{msg.message}</p>
                                                    <span className={cn("text-[10px] mt-1 block opacity-40", isUser ? "text-zinc-400" : "text-white")}>
                                                        {format(new Date(msg.created_at), 'HH:mm')}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        )
                                    })}
                                </AnimatePresence>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
