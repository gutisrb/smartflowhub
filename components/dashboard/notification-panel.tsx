"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createClient } from "@/lib/supabase/client"
import {
  Bell, MessageCircle, Calendar, AlertTriangle, CheckCheck,
  X, Bot, Sparkles, ExternalLink
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { sr } from "date-fns/locale"

export interface AppNotification {
  id: string
  type: "nova_poruka" | "zakazano" | "intervencija" | "ai_odgovor" | "status"
  title: string
  body: string
  at: string        // ISO
  read: boolean
  action?: string   // module key to navigate to
}

interface NotificationPanelProps {
  clientId: string | null
  demoNiche?: string | null
  onNavigate: (key: string) => void
}

const TYPE_META: Record<AppNotification["type"], { icon: any; color: string; bg: string }> = {
  nova_poruka:  { icon: MessageCircle, color: "#e879f9", bg: "rgba(232,121,249,0.12)" },
  zakazano:     { icon: Calendar,      color: "#10b981", bg: "rgba(16,185,129,0.12)"  },
  intervencija: { icon: AlertTriangle, color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  ai_odgovor:   { icon: Bot,           color: "#10b981", bg: "rgba(16,185,129,0.08)"  },
  status:       { icon: CheckCheck,    color: "#60a5fa", bg: "rgba(96,165,250,0.10)"  },
}

function reltime(iso: string) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: sr }) } catch { return "" }
}

async function fetchNotifications(sb: any, clientId: string): Promise<AppNotification[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const out: AppNotification[] = []

  // incoming customer messages (user role)
  const { data: msgs } = await sb
    .from("razgovori")
    .select("id_razgovora, message, platform, created_at, metadata, role")
    .eq("client_id", clientId)
    .eq("role", "user")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20)

  const seen = new Set<string>()
  for (const m of msgs ?? []) {
    if (seen.has(m.id_razgovora)) continue
    seen.add(m.id_razgovora)
    const meta = typeof m.metadata === "string" ? JSON.parse(m.metadata) : (m.metadata ?? {})
    const name = meta?.name ?? "Nepoznat kupac"
    const ch = (m.platform ?? "").toLowerCase()
    const chLabel = ch === "whatsapp" ? "WhatsApp" : ch === "instagram" ? "Instagram" : ch === "facebook" ? "Facebook" : "Website"
    out.push({
      id: `msg_${m.id_razgovora}`,
      type: "nova_poruka",
      title: `${name} poslao/la poruku`,
      body: `${chLabel} · ${(m.message ?? "").slice(0, 60)}${m.message?.length > 60 ? "…" : ""}`,
      at: m.created_at,
      read: false,
      action: "social-chatbot",
    })
  }

  // CRM status events
  const { data: crm } = await sb
    .from("demo_crm")
    .select("id_razgovora, full_name, status, razlog, created_at")
    .eq("client_id", clientId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20)

  for (const row of crm ?? []) {
    if (row.status === "Zakazano") {
      out.push({
        id: `crm_z_${row.id_razgovora}`,
        type: "zakazano",
        title: `Termin zakazan — ${row.full_name}`,
        body: "AI agent zakazao termin. Vidite u Terminima.",
        at: row.created_at,
        read: false,
        action: "calendar",
      })
    } else if (row.status === "Intervencija") {
      out.push({
        id: `crm_i_${row.id_razgovora}`,
        type: "intervencija",
        title: `Potrebna intervencija — ${row.full_name}`,
        body: row.razlog ?? "Kupac čeka Vaš odgovor.",
        at: row.created_at,
        read: false,
        action: "social-chatbot",
      })
    } else if (row.status === "Naručio" || row.status === "Isporučeno") {
      out.push({
        id: `crm_n_${row.id_razgovora}`,
        type: "status",
        title: `${row.full_name} — ${row.status}`,
        body: "Agent vodio ceo razgovor i zatvorio prodaju.",
        at: row.created_at,
        read: false,
        action: "business-crm",
      })
    }
  }

  // appointments
  const { data: appts } = await sb
    .from("appointments")
    .select("id, customer_name, service_name, starts_at")
    .eq("client_id", clientId)
    .gte("starts_at", since)
    .order("starts_at", { ascending: false })
    .limit(5)

  for (const a of appts ?? []) {
    out.push({
      id: `appt_${a.id}`,
      type: "zakazano",
      title: `Termin: ${a.customer_name}`,
      body: `${a.service_name} · ${new Date(a.starts_at).toLocaleDateString("sr-Latn-RS", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`,
      at: a.starts_at,
      read: false,
      action: "calendar",
    })
  }

  // de-dupe and sort
  const ids = new Set<string>()
  const unique: AppNotification[] = []
  for (const n of out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())) {
    if (!ids.has(n.id)) { ids.add(n.id); unique.push(n) }
  }
  return unique.slice(0, 30)
}

export function NotificationPanel({ clientId, demoNiche, onNavigate }: NotificationPanelProps) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const sb = createClient()

  const unread = notifications.filter((n) => !n.read).length

  const load = async () => {
    if (!clientId) return
    setLoading(true)
    const ns = await fetchNotifications(sb, clientId)
    setNotifications(ns)
    setLoading(false)
  }

  // load on mount + realtime
  useEffect(() => {
    if (!clientId) return
    load()

    const channel = sb
      .channel(`notif_${clientId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "razgovori", filter: `client_id=eq.${clientId}` }, () => { load() })
      .on("postgres_changes", { event: "*",      schema: "public", table: "demo_crm",  filter: `client_id=eq.${clientId}` }, () => { load() })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "appointments", filter: `client_id=eq.${clientId}` }, () => { load() })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId])

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const markAllRead = () => setNotifications((ns) => ns.map((n) => ({ ...n, read: true })))

  const handleClick = (n: AppNotification) => {
    setNotifications((ns) => ns.map((x) => x.id === n.id ? { ...x, read: true } : x))
    if (n.action) { onNavigate(n.action); setOpen(false) }
  }

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={() => { setOpen((o) => !o); if (!open) markAllRead() }}
        className="p-2 md:p-2.5 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-emerald hover:border-emerald/30 transition-all duration-300 relative group"
      >
        <Bell className="w-4 h-4 md:w-5 md:h-5" />
        {unread > 0 ? (
          <motion.span
            key={unread}
            initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400 }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-[9px] font-black flex items-center justify-center text-white px-1 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        ) : (
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-emerald rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-3 w-[360px] md:w-[420px] rounded-2xl border border-white/10 bg-[#0c0f16]/98 backdrop-blur-2xl shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9)] z-[400] overflow-hidden"
          >
            {/* header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald" />
                <span className="text-sm font-bold text-white font-outfit">Obaveštenja</span>
                {unread > 0 && (
                  <span className="text-[11px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald text-obsidian">{unread}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {notifications.some(n => !n.read) && (
                  <button onClick={markAllRead} className="text-[11px] text-zinc-500 hover:text-zinc-200 transition-colors font-semibold">
                    Označi sve pročitano
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* list */}
            <div className="max-h-[420px] overflow-y-auto scrollbar-none divide-y divide-white/[0.04]">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-emerald/30 border-t-emerald rounded-full animate-spin" />
                </div>
              )}
              {!loading && notifications.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-500">
                  <Bell className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Nema obaveštenja</p>
                </div>
              )}
              {!loading && notifications.map((n, i) => {
                const meta = TYPE_META[n.type]
                const Icon = meta.icon
                return (
                  <motion.button
                    key={n.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.025 }}
                    onClick={() => handleClick(n)}
                    className="w-full flex items-start gap-3.5 px-5 py-4 text-left transition-colors hover:bg-white/[0.04] relative group"
                  >
                    {!n.read && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-emerald shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
                    )}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: meta.bg, border: `1px solid ${meta.color}25` }}>
                      <Icon className="w-4 h-4" style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[13px] font-semibold leading-tight ${n.read ? "text-zinc-400" : "text-white"}`}>{n.title}</p>
                      <p className="text-[12px] text-zinc-500 mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                      <p className="text-[11px] text-zinc-600 mt-1.5">{reltime(n.at)}</p>
                    </div>
                    {n.action && (
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0 mt-1" />
                    )}
                  </motion.button>
                )
              })}
            </div>

            {/* footer */}
            {notifications.length > 0 && (
              <div className="px-5 py-3 border-t border-white/8 bg-white/[0.01]">
                <p className="text-[11px] text-zinc-600 text-center">AI agent beleži svaki razgovor · obaveštenja se ažuriraju uživo</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
