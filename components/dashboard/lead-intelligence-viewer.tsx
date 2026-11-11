"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { getDemoShift, shiftRows, shiftRowsDays } from "@/lib/demo/time-shift"
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
import { bucketForRow, bucketLabel, BUCKET_STYLE } from "@/lib/lead-status"
import { ChannelGlyph } from "@/components/dashboard/channel-glyph"
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
    /** Demo tenant: re-anchor the seeded conversation log to now. */
    demoMode?: boolean
    /** Onboarding tour: shorten the panel so the narration bar can't sit on top of it. */
    tourMode?: boolean
    /** made-to-order business: no calendar, the history is the offer */
    quoteMode?: boolean
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

/** First customer photo the inbox has for this thread — same face in the file as in the inbox. */
function customerPhoto(messages: Message[]): string | null {
    for (const m of messages) {
        const pic = m.role === 'user' ? m.metadata?.profile_pic : null
        if (pic) return pic
    }
    return null
}

function CustomerAvatar({ src, name, size = 28 }: { src: string | null; name: string; size?: number }) {
    const [broken, setBroken] = useState(false)
    if (src && !broken) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={src} alt="" onError={() => setBroken(true)} className="rounded-full object-cover ring-2 ring-black/30 shrink-0" style={{ width: size, height: size }} />
    }
    return (
        <div className="rounded-full shrink-0 flex items-center justify-center font-bold text-white bg-gradient-to-br from-emerald-500/60 to-cyan-600/60 ring-2 ring-black/30"
            style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
            {(name || '?')[0]?.toUpperCase()}
        </div>
    )
}

interface HistoryItem { id: string; when: Date; title: string; status: string; tone: 'next' | 'done' | 'miss' | 'neutral'; note?: string | null }

const APPT_STATUS: Record<string, { label: string; tone: HistoryItem['tone'] }> = {
    completed: { label: 'Završen', tone: 'done' },
    cancelled: { label: 'Otkazan', tone: 'miss' },
    no_show:   { label: 'Nije došao', tone: 'miss' },
}

/**
 * The outcome, written as a sentence. A status pill says "Zainteresovan"; the owner
 * wants to know what happened. This is the first thing on the file and the thing the
 * tour points at.
 */
function outcomeOf(lead: any, service: boolean, quote = false) {
    const s = (lead.status || '').toLowerCase()
    const bucket = bucketForRow(lead)
    if (s === 'ponuda' || (quote && s === 'zakazano')) return { title: 'Ponuda zatražena', bucket, fallback: null }
    if (s === 'zakazano')                       return { title: 'Termin zakazan', bucket, fallback: null }
    if (s === 'završeno')                       return { title: 'Termin održan', bucket, fallback: null }
    if (s === 'naručio' || s === 'poručio')     return { title: 'Porudžbina primljena', bucket, fallback: null }
    if (s === 'isporučeno' || s === 'dostavljeno') return { title: 'Porudžbina isporučena', bucket, fallback: null }
    if (s === 'intervencija')                   return { title: 'Čeka Vaš odgovor', bucket, fallback: 'Agent je prosledio razgovor Vama. Odgovorite iz inboxa.' }
    if (s === 'reklamacija' || lead.status_porudzbine === 'Reklamacija') return { title: 'Reklamacija', bucket, fallback: 'Kupac ima reklamaciju. Javite mu se što pre.' }
    if (bucket === 'lost')                      return { title: 'Izgubljen upit', bucket, fallback: 'Bez odgovora više od nedelju dana.' }
    if (bucket === 'no_reply')                  return { title: 'Bez odgovora', bucket, fallback: 'Agent je poslednji pisao, a odgovor još nije stigao.' }
    if (s === 'zainteresovan')                  return { title: quote ? 'Razgovor bez ponude' : service ? 'Razgovor bez termina' : 'Razgovor bez porudžbine', bucket, fallback: quote ? 'Interesovanje postoji, ali ponuda još nije zatražena.' : service ? 'Interesovanje postoji, ali termin još nije zakazan.' : 'Interesovanje postoji, ali porudžbine još nema.' }
    return { title: 'Novi upit', bucket, fallback: null }
}

// a parcel is couriered, a sofa or a house is delivered (lib/shop-story.mjs DELIVERY_STAGES)
const DELIVERY_SETS = [['Obrađuje se', 'Poslato', 'Dostavljeno'], ['U pripremi', 'Zakazana dostava', 'Isporučeno']]

function DemoCRMCustomerPanel({ lead, messages, messagesLoading, tourMode, demoMode, quoteMode }: { lead: any; messages: Message[]; messagesLoading: boolean; tourMode?: boolean; demoMode?: boolean; quoteMode?: boolean }) {
    // During the tour the point of opening this panel is the conversation log.
    // Pin its own scroller to the newest message rather than making the viewer look for it.
    const logRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!tourMode || messagesLoading || messages.length === 0) return
        const t = setTimeout(() => {
            const pane = logRef.current?.querySelector('.overflow-y-auto') as HTMLElement | null
            if (pane) pane.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' })
        }, 700)
        return () => clearTimeout(t)
    }, [tourMode, messagesLoading, messages.length])

    const [copiedField, setCopiedField] = useState<string | null>(null)
    const copy = (text: string, field: string) => {
        navigator.clipboard.writeText(text)
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 2000)
    }

    const statusLc = (lead.status || '').toLowerCase()
    const service = !lead.status_porudzbine && !['naručio', 'poručio', 'isporučeno', 'dostavljeno'].includes(statusLc)
    const outcome = outcomeOf(lead, service, quoteMode)
    const tone = BUCKET_STYLE[outcome.bucket].color
    const product  = lead.proizvod || lead.knjiga || null
    const category = lead.zdravstveni_cilj || lead.tema || lead.kategorija || null
    const photo = customerPhoto(messages)
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    const lastIsUnanswered = ['active', 'no_reply', 'lost', 'new'].includes(outcome.bucket) && !!lastUser
    const deliveryStep = lead.status_porudzbine as string | null
    const DELIVERY_STEPS = DELIVERY_SETS.find((set) => set.includes(deliveryStep ?? '')) ?? DELIVERY_SETS[0]
    const deliveryIdx = DELIVERY_STEPS.indexOf(deliveryStep ?? '')
    const iz = (lead.izvor || '').toLowerCase()
    const channel = iz.includes('instagram') ? 'instagram' : iz.includes('facebook') ? 'facebook' : iz.includes('whatsapp') ? 'whatsapp' : 'website'
    const channelColor = { instagram: '#E1306C', facebook: '#1877F2', whatsapp: '#25D366', website: '#8b5cf6' }[channel]

    // ── History: past and upcoming meetings, or the order on file ──────────────
    const [history, setHistory] = useState<HistoryItem[] | null>(null)
    useEffect(() => {
        let alive = true
        ;(async () => {
            if (quoteMode) {
                // a made-to-order business has no calendar: the history is the offer asked for and any order
                const asked = ['zakazano', 'ponuda', 'naručio'].includes(statusLc)
                if (alive) setHistory(asked && lead.created_at ? [{
                    id: 'offer', when: new Date(lead.created_at), title: product || 'Ponuda',
                    status: statusLc === 'naručio' ? 'Naručeno' : 'Ponuda zatražena', note: lead.komentar || null, tone: 'done',
                }] : [])
                return
            }
            if (!service) {
                const hasOrder = !!lead.status_porudzbine || ['naručio', 'poručio', 'isporučeno', 'dostavljeno'].includes(statusLc)
                const items: HistoryItem[] = hasOrder && lead.created_at ? [{
                    id: 'order', when: new Date(lead.created_at), title: product || 'Porudžbina',
                    status: lead.status_porudzbine || lead.status, note: lead.komentar || null,
                    tone: (lead.status_porudzbine || lead.status) === 'Reklamacija' ? 'miss' : 'done',
                }] : []
                if (alive) setHistory(items)
                return
            }
            const sb = createClient()
            const [{ data }, shift] = await Promise.all([
                sb.from('appointments').select('id, starts_at, service_name, status, notes')
                    .eq('client_id', lead.client_id).eq('customer_name', lead.full_name)
                    .order('starts_at', { ascending: false }).limit(12),
                getDemoShift(sb, lead.client_id, !!demoMode),
            ])
            const rows = demoMode ? shiftRowsDays(data || [], ['starts_at'], shift.deltaDays) : (data || [])
            const now = Date.now()
            const items: HistoryItem[] = rows.map((r: any) => {
                const when = new Date(r.starts_at)
                const st = APPT_STATUS[r.status]
                const upcoming = when.getTime() > now && r.status !== 'cancelled'
                const today = r.status === 'confirmed' && when.toDateString() === new Date(now).toDateString()
                return {
                    id: r.id, when, title: r.service_name || 'Termin',
                    status: today ? 'Danas' : upcoming ? 'Predstoji' : (st?.label ?? 'Završen'),
                    tone: today || upcoming ? 'next' : (st?.tone ?? 'done'),
                }
            })
            if (alive) setHistory(items)
        })()
        return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lead?.id])

    const Section = ({ title, count, children, focus }: { title: string; count?: number; children: React.ReactNode; focus?: string }) => (
        <section data-tour-focus={focus} className="px-5 py-4 border-t border-white/[0.06] first:border-t-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b9d9a] mb-2.5 flex items-baseline gap-2">
                {title}{count != null && count > 0 && <span className="tabular-nums text-[#5f6f6c]">{count}</span>}
            </p>
            {children}
        </section>
    )
    const CopyBtn = ({ value, field, label }: { value: string; field: string; label: string }) => (
        <button onClick={() => copy(value, field)} aria-label={label} className="shrink-0 text-zinc-600 hover:text-emerald-400 transition-colors">
            {copiedField === field ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
    )

    return (
        // Facts left, the conversation right, each scrolling on its own.
        <div className="flex h-full min-h-0">
        <div className="w-[340px] shrink-0 overflow-y-auto scrollbar-none border-r border-white/[0.07]">

            {/* Outcome — what happened, in a sentence */}
            <div className="p-4">
                <div data-tour-focus="lead-outcome" className="rounded-xl p-4 relative overflow-hidden border" style={{ borderColor: `${tone}40`, background: `${tone}0f` }}>
                    <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: tone }} />
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: tone }}>Ishod</p>
                    <p className="mt-1 text-[18px] font-bold text-white font-outfit leading-tight">{outcome.title}</p>
                    {(lead.razlog || outcome.fallback) && <p className="mt-1.5 text-[13px] text-zinc-300 leading-relaxed">{lead.razlog || outcome.fallback}</p>}
                    {lastIsUnanswered && (
                        <div className="mt-3 pt-3 border-t border-white/[0.07]">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8b9d9a]">Poslednja poruka klijenta</p>
                            <p className="mt-1 text-[13.5px] text-white italic leading-snug">„{lastUser!.message}“</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Delivery — shops that track the order */}
            {!service && deliveryStep && deliveryStep !== 'Reklamacija' && (
                <Section title="Isporuka">
                    <div className="flex items-center">
                        {DELIVERY_STEPS.map((step, i) => {
                            const done = deliveryIdx >= 0 && i <= deliveryIdx
                            return (
                                <div key={step} className="flex items-center flex-1 last:flex-none">
                                    <div className="flex flex-col items-center gap-1">
                                        <span className={cn("w-6 h-6 rounded-full border-2 flex items-center justify-center",
                                            done ? "border-emerald-400 bg-emerald-400/20" : "border-white/15")}>
                                            {done ? <Check className="w-3 h-3 text-emerald-300" /> : <span className="w-1.5 h-1.5 rounded-full bg-white/20" />}
                                        </span>
                                        <span className={cn("text-[10px] whitespace-nowrap", done ? "text-zinc-200" : "text-zinc-600")}>{step}</span>
                                    </div>
                                    {i < DELIVERY_STEPS.length - 1 && <span className={cn("h-px flex-1 mx-1.5 -mt-4", i < deliveryIdx ? "bg-emerald-400/40" : "bg-white/10")} />}
                                </div>
                            )
                        })}
                    </div>
                    {deliveryIdx < 0 && <p className="text-[12px] text-zinc-400 mt-2">{deliveryStep}</p>}
                </Section>
            )}

            {/* History — meetings (services) or orders (shops) */}
            <Section title={quoteMode ? 'Ponuda' : service ? 'Termini' : 'Porudžbine'} count={history?.length} focus="lead-history">
                {history === null ? (
                    <div className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
                ) : history.length === 0 ? (
                    <p className="text-[13px] text-zinc-500 leading-snug">
                        {quoteMode ? 'Ponuda još nije zatražena. Ovo je prvi kontakt.' : service ? 'Još nema termina. Ovo je prvi kontakt.' : 'Još nema porudžbina. Ovo je prvi kontakt.'}
                    </p>
                ) : (
                    <ol className="relative">
                        {history.map((h, idx) => (
                            <li key={h.id} className="relative pl-5 pb-3 last:pb-0">
                                {idx < history.length - 1 && <span className="absolute left-[4px] top-3 bottom-0 w-px bg-white/[0.09]" />}
                                <span className={cn(
                                    "absolute left-0 top-[5px] w-[9px] h-[9px] rounded-full border-2",
                                    h.tone === 'next' ? "border-emerald-400 bg-emerald-400/30"
                                        : h.tone === 'miss' ? "border-orange-400/70 bg-transparent"
                                        : "border-zinc-500 bg-zinc-500/40",
                                )} />
                                <div className="flex items-baseline justify-between gap-2">
                                    <p className="text-[13px] font-semibold text-white leading-snug truncate">{h.title}</p>
                                    <span className={cn("text-[10px] font-bold uppercase tracking-wider shrink-0",
                                        h.tone === 'next' ? "text-emerald-300" : h.tone === 'miss' ? "text-orange-300" : "text-zinc-500")}>{h.status}</span>
                                </div>
                                <p className="text-[12px] text-zinc-500 tabular-nums mt-0.5">
                                    {service ? format(h.when, 'dd.MM.yyyy. · HH:mm') : format(h.when, 'dd.MM.yyyy.')}
                                </p>
                                {h.note && <p className="text-[12px] text-zinc-400 mt-1 leading-snug">{h.note}</p>}
                            </li>
                        ))}
                    </ol>
                )}
            </Section>

            {/* Interest */}
            {(category || product) && (
                <Section title="Interesovanje">
                    {product && <p className="text-[14px] font-semibold text-white leading-snug">{product}</p>}
                    {category && <span className="inline-block mt-1.5 text-[11px] text-zinc-300 bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-full">{category}</span>}
                </Section>
            )}

            {/* Contact */}
            <Section title="Kontakt">
                <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                        <Phone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className={cn("text-[13px] tabular-nums flex-1 truncate", lead.telefon ? "text-zinc-200" : "text-zinc-600")}>{lead.telefon || 'Telefon nije zabeležen'}</span>
                        {lead.telefon && <CopyBtn value={lead.telefon} field="phone" label="Kopiraj telefon" />}
                    </div>
                    <div className="flex items-center gap-2.5">
                        <Mail className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span className={cn("text-[12.5px] truncate flex-1", lead.email ? "text-zinc-300 font-mono" : "text-zinc-600")}>{lead.email || 'Email nije zabeležen'}</span>
                        {lead.email && <CopyBtn value={lead.email} field="email" label="Kopiraj email" />}
                    </div>
                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-white/[0.05]">
                        <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: channelColor }}>
                            <ChannelGlyph platform={channel} className="w-3.5 h-3.5" /> {lead.izvor || 'Nepoznat izvor'}
                        </span>
                        {lead.created_at && <span className="text-[12px] text-zinc-500 tabular-nums">od {format(new Date(lead.created_at), 'dd.MM.yyyy.')}</span>}
                    </div>
                    {lead.komentar && <p className="text-[12px] text-zinc-400 leading-snug pt-1">{lead.komentar}</p>}
                </div>
            </Section>
        </div>

        {/* The conversation — same faces and agent marks as the inbox */}
        <div ref={logRef} data-tour-focus="lead-log" className="flex-1 min-w-0 flex flex-col min-h-0 bg-black/15">
                <div className="shrink-0 px-6 py-3.5 border-b border-white/[0.07] flex items-baseline gap-2.5">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400">Razgovor sa agentom</span>
                    {messages.length > 0 && (
                        <span className="text-[11px] font-medium text-[#8b9d9a] tabular-nums">{messages.length} poruka</span>
                    )}
                </div>

                {messagesLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin opacity-40" />
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                        <Bot className="w-7 h-7 mb-2 opacity-30" />
                        <p className="text-[12px]">Nema zabeleženih poruka za ovaj kontakt.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto scrollbar-none px-6 py-5 space-y-3">
                        {messages.map((msg, idx) => {
                            const isUser  = msg.role === 'user'
                            const hasImage = msg.metadata?.type === 'image'
                            const isStory  = msg.metadata?.type === 'story_reply'
                            return (
                                <motion.div
                                    key={msg.id || idx}
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.2 }}
                                    className={cn("flex gap-2.5", isUser ? "justify-start" : "justify-end")}
                                >
                                    {isUser && <div className="mt-1"><CustomerAvatar src={msg.metadata?.profile_pic || photo} name={lead.full_name} /></div>}
                                    <div
                                        className={cn(
                                            "max-w-[74%] rounded-2xl px-3.5 py-2.5 font-outfit",
                                            isUser ? "bg-[#1a1a28] text-zinc-200 rounded-tl-none border border-white/[0.07]" : "text-[#05140d] rounded-tr-none shadow-lg",
                                        )}
                                        style={!isUser ? { background: "linear-gradient(135deg, #34d39e, #10b981)" } : undefined}
                                    >
                                        {(hasImage || isStory) && (
                                            <p className="text-[9px] font-mono uppercase tracking-widest opacity-50 mb-1">{isStory ? '↩ Story odgovor' : '📷 Slika'}</p>
                                        )}
                                        <p className="leading-relaxed text-[13px]">{msg.message}</p>
                                        <span className={cn("text-[10px] mt-1.5 block font-mono", isUser ? "opacity-35 text-zinc-400" : "opacity-50 text-[#05140d]")}>
                                            {format(new Date(msg.created_at), 'HH:mm')}
                                        </span>
                                    </div>
                                    {!isUser && (
                                        <div className="shrink-0 mt-1">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center border border-emerald-400/35 bg-emerald-400/12" title="Odgovorio AI agent">
                                                <Bot className="w-3.5 h-3.5 text-emerald-300" />
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )
                        })}
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

export function LeadIntelligenceViewer({ lead, isOpen, onClose, demoMode, tourMode, quoteMode }: LeadIntelligenceViewerProps) {
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

        if (!error) {
            // Demo tenants: same read-time re-anchor the inbox uses, so the log
            // timestamps agree with the conversation the lead just watched.
            const { deltaMs } = await getDemoShift(supabase, lead.client_id, !!demoMode)
            setMessages(shiftRows(data || [], ['created_at'], deltaMs))
        }
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
        lead.izvor && { icon: getKanalIcon(lead.izvor), label: "Kanal", value: lead.izvor },
        lead.telefon && { icon: <Phone className="w-3 h-3" />, label: "Telefon", value: lead.telefon },
        lead.created_at && { icon: <Calendar className="w-3 h-3" />, label: "U bazi od", value: `u bazi od ${format(new Date(lead.created_at), 'dd.MM.yyyy.')}` },
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
            <DialogContent
                // the tour opens and closes this file itself; Escape or a stray click must not
                onEscapeKeyDown={tourMode ? (e) => e.preventDefault() : undefined}
                onPointerDownOutside={tourMode ? (e) => e.preventDefault() : undefined}
                onInteractOutside={tourMode ? (e) => e.preventDefault() : undefined}
                data-tour-focus={tourMode ? "lead-file" : undefined}
                className={cn(
                    "flex flex-col p-0 overflow-hidden border-white/5 bg-obsidian/95 backdrop-blur-2xl rounded-2xl shadow-2xl",
                    // Two columns: facts and the conversation. Same size in and out of the tour —
                    // the tour card sits beside the file, it never resizes or moves it.
                    isDemoCRMCustomer ? "sm:max-w-[1080px]" : "sm:max-w-[640px]",
                    "h-[88vh]",
                )}
            >

                {/* Header */}
                {isDemoCRMCustomer ? (() => {
                    const b = bucketForRow(lead)
                    const c = BUCKET_STYLE[b].color
                    return (
                        // one compact block: who, where they stand, where they came from
                        <div className="px-6 py-4 pr-14 shrink-0 border-b border-white/[0.06] flex items-center gap-3.5">
                            <CustomerAvatar src={customerPhoto(messages)} name={displayName} size={40} />
                            <div className="min-w-0">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <DialogTitle className="text-[20px] font-outfit font-bold text-white tracking-tight leading-tight">{displayName}</DialogTitle>
                                    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2 py-0.5 rounded-md" style={{ color: c, background: `${c}1a` }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />{bucketLabel(b, lead.niche, lead.status)}
                                    </span>
                                    {lead.status && bucketLabel(b, lead.niche, lead.status) !== lead.status && (
                                        <span className="text-[11px] text-zinc-500">u bazi: {quoteMode && String(lead.status).toLowerCase() === 'zakazano' ? 'Ponuda' : lead.status}</span>
                                    )}
                                </div>
                                <p className="text-[12.5px] text-zinc-500 mt-0.5 truncate">
                                    {[lead.proizvod, lead.kategorija].filter(Boolean).join(' · ') || 'Bez navedenog interesovanja'}
                                </p>
                            </div>
                        </div>
                    )
                })() : (
                <div className="px-8 pt-8 pb-5 shrink-0 border-b border-white/5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            {isDemoCRMCustomer ? (
                                <CustomerAvatar src={customerPhoto(messages)} name={displayName} size={48} />
                            ) : (
                            <div className={cn(
                                "w-12 h-12 rounded-xl border border-white/10 flex items-center justify-center font-bold text-lg shrink-0",
                                isB2BLead
                                    ? "bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-400"
                                    : "bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400"
                            )}>
                                {displayInitial}
                            </div>
                            )}
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
                )}

                {/* Content area */}
                <div className="flex-1 min-h-0 flex flex-col">
                    <div className={cn("px-8 py-3 border-b border-white/5 shrink-0", isDemoCRMCustomer && "hidden")}>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            {isB2BLead ? 'Lead Intelligence' : isDemoCRMCustomer ? 'Profil Kupca' : 'Istorija Razgovora'}
                            {!isB2BLead && !isDemoCRMCustomer && messages.length > 0 && (
                                <span className="ml-2 text-emerald">· {messages.length} poruka</span>
                            )}
                        </span>
                    </div>

                    <div className={cn("flex-1 min-h-0", isDemoCRMCustomer ? "overflow-hidden" : "overflow-y-auto")}>
                        {isB2BLead ? (
                            <B2BLeadIntelPanel lead={lead} />
                        ) : isDemoCRMCustomer ? (
                            <DemoCRMCustomerPanel lead={lead} messages={messages} messagesLoading={loading} tourMode={tourMode} demoMode={demoMode} quoteMode={quoteMode} />
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
