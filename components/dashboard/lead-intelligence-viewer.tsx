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

    if (!isEnriched) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-zinc-600">
                <BarChart2 className="w-10 h-10 mb-4 opacity-20" />
                <p className="text-xs font-bold uppercase tracking-widest">Nije enriched</p>
                <p className="text-xs text-zinc-700 mt-1">Pokreni: node enrich-instagram.mjs</p>
            </div>
        )
    }

    return (
        <div className="px-8 py-6 space-y-5 pb-12">

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

    // Detect B2B lead (SmartFlow outreach) vs recruitment lead
    const isB2BLead = lead?.izvor === 'meta_ads_scrape' || lead?.izvor === 'Chatbot Outreach' || !!lead?.intake_data?.enrichment || !!lead?.email_draft

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
        if (s === 'zaposlen')    return 'bg-emerald/15 text-emerald border-emerald/20'
        if (s === 'intervju')    return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
        if (s === 'kvalifikovan') return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        if (s === 'enriched')    return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
        if (s === 'vreo')        return 'bg-red-500/10 text-red-400 border-red-500/20'
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

    // Header info items — adapt based on B2B vs recruitment
    const infoItems = isB2BLead ? [
        lead.email && { icon: <Mail className="w-3 h-3" />, label: "Email", value: lead.email },
        lead.website && { icon: <Globe className="w-3 h-3" />, label: "Website", value: lead.website.replace(/https?:\/\/(www\.)?/, '').split('/')[0] },
        lead.izvor && { icon: <Facebook className="w-3 h-3" />, label: "Izvor", value: lead.izvor },
        lead.created_at && { icon: <Calendar className="w-3 h-3" />, label: "Datum", value: format(new Date(lead.created_at), 'dd.MM.yyyy.') },
    ].filter(Boolean) : [
        lead.starost && { icon: <User className="w-3 h-3" />, label: "Godine", value: `${lead.starost} god.` },
        lead.lokacija && { icon: <MapPin className="w-3 h-3" />, label: "Lokacija", value: lead.lokacija },
        lead.email && { icon: <Mail className="w-3 h-3" />, label: "Email", value: lead.email },
        lead.phone && { icon: <Phone className="w-3 h-3" />, label: "Telefon", value: lead.phone },
        lead.izvor && { icon: getKanalIcon(lead.izvor), label: "Kanal", value: lead.izvor },
        lead.created_at && { icon: <Calendar className="w-3 h-3" />, label: "Prijava", value: format(new Date(lead.created_at), 'dd.MM.yyyy.') },
    ].filter(Boolean) as { icon: React.ReactNode; label: string; value: string }[]

    // Display name
    const displayName = lead.company_name || lead.ime || lead.full_name || lead.name || '?'
    const displayInitial = displayName[0] || '?'

    // Status
    const statusLabel = lead.kategorija || lead.status || 'Lead'

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
                            {isB2BLead ? 'Lead Intelligence' : 'Istorija Razgovora'}
                            {!isB2BLead && messages.length > 0 && (
                                <span className="ml-2 text-emerald">· {messages.length} poruka</span>
                            )}
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0">
                        {isB2BLead ? (
                            <B2BLeadIntelPanel lead={lead} />
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
