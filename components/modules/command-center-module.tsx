"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { motion, type Variants } from "framer-motion"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Send,
  MessageSquare,
  CalendarCheck,
  Eye,
  ListChecks,
  RefreshCw,
  MoreHorizontal,
  CheckCircle2,
  TrendingUp,
} from "lucide-react"
import { LeadIntelligenceViewer } from "@/components/dashboard/lead-intelligence-viewer"

interface CommandCenterModuleProps {
  clientId: string
}

interface Contact {
  id: string
  company_name: string
  email: string | null
  status: string
  email_draft: string | null
  email_2_draft: string | null
  email_1_poslat: boolean
  email_2_poslat: boolean
  approved_to_send: boolean
  last_sent_at: string | null
  replied_at: string | null
  reply_intent: string | null
  reply_snippet: string | null
  meeting_time: string | null
  demo_client_id: string | null
  demo_built_at: string | null
  instagram_followers: number | null
  kategorija: string | null
}

const WARM_INTENTS = new Set(["interested", "price_question", "meeting_requested"])
const STATUS_OPTIONS = [
  "Novi Lead",
  "enriched",
  "Kontaktiran",
  "Follow Up",
  "Odgovorio",
  "Meeting Booked",
  "Lost",
  "Disqualified",
]

function hasMeeting(c: Contact) {
  return c.status === "Zakazan Sastanak" || c.status === "Meeting Booked" || !!c.meeting_time
}

function isWarmReply(c: Contact) {
  return !!c.replied_at && !!c.reply_intent && WARM_INTENTS.has(c.reply_intent) && !hasMeeting(c)
}

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" },
  }),
}

export function CommandCenterModule({ clientId }: CommandCenterModuleProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [demoOnboarded, setDemoOnboarded] = useState<Map<string, boolean>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [intelLead, setIntelLead] = useState<Contact | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id, company_name, email, status, email_draft, email_2_draft, email_1_poslat, email_2_poslat, approved_to_send, last_sent_at, replied_at, reply_intent, reply_snippet, meeting_time, demo_client_id, demo_built_at, instagram_followers, kategorija"
      )
      .eq("client_id", clientId)
      // .neq alone drops NULL rows — must explicitly include NULLs (same convention as send_outreach.mjs)
      .or("kategorija.neq.Disqualified,kategorija.is.null")

    if (error) {
      console.error(error)
      setLoading(false)
      return
    }
    const rows = (data || []) as Contact[]
    setContacts(rows)

    // Safe two-step join — do not assume a Supabase embedded-resource relation is configured.
    const demoIds = Array.from(new Set(rows.map((r) => r.demo_client_id).filter(Boolean))) as string[]
    if (demoIds.length > 0) {
      const { data: demoClients } = await supabase.from("clients").select("id, onboarded_at").in("id", demoIds)
      const map = new Map<string, boolean>()
      for (const dc of demoClients || []) map.set(dc.id, !!dc.onboarded_at)
      setDemoOnboarded(map)
    } else {
      setDemoOnboarded(new Map())
    }
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setTimeout(() => setRefreshing(false), 600)
  }

  const demoAccessed = useCallback(
    (c: Contact) => !!c.demo_client_id && !!demoOnboarded.get(c.demo_client_id),
    [demoOnboarded]
  )

  const draftsToApprove = useMemo(
    () =>
      contacts.filter(
        (c) =>
          !c.approved_to_send &&
          ((!!c.email_draft && !c.email_1_poslat) || (!!c.email_2_draft && !c.email_2_poslat))
      ),
    [contacts]
  )

  const warmReplies = useMemo(() => contacts.filter(isWarmReply), [contacts])

  const demosNotContacted = useMemo(
    () => contacts.filter((c) => demoAccessed(c) && !c.replied_at && !hasMeeting(c)),
    [contacts, demoAccessed]
  )

  const sentToday = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    return contacts.filter((c) => c.last_sent_at && new Date(c.last_sent_at) >= start).length
  }, [contacts])

  const meetingsBooked = useMemo(() => contacts.filter(hasMeeting).length, [contacts])
  const demoOpenedTotal = useMemo(() => contacts.filter(demoAccessed).length, [contacts, demoAccessed])

  const needsAction = useMemo(() => {
    const ids = new Set<string>()
    draftsToApprove.forEach((c) => ids.add(c.id))
    warmReplies.forEach((c) => ids.add(c.id))
    demosNotContacted.forEach((c) => ids.add(c.id))
    return ids.size
  }, [draftsToApprove, warmReplies, demosNotContacted])

  const handleApprove = async (id: string) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, approved_to_send: true } : c)))
    const supabase = createClient()
    const { error } = await supabase.from("contacts").update({ approved_to_send: true }).eq("id", id)
    if (error) {
      toast.error("Greška pri odobravanju")
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, approved_to_send: false } : c)))
    } else {
      toast.success("Odobreno za slanje")
    }
  }

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c)))
    const supabase = createClient()
    const { error } = await supabase.from("contacts").update({ status: newStatus }).eq("id", id)
    if (error) {
      toast.error("Greška u sinhronizaciji")
      fetchData()
    } else {
      toast.success("Status sinhronizovan")
    }
  }

  const stats = [
    { label: "Poslato danas", value: sentToday, sub: "Emails poslati danas", icon: Send, color: "text-emerald" },
    { label: "Odgovori (novi)", value: warmReplies.length, sub: "Čekaju odgovor", icon: MessageSquare, color: "text-cyan-400" },
    { label: "Zakazani sastanci", value: meetingsBooked, sub: "Ukupno zakazano", icon: CalendarCheck, color: "text-purple-400" },
    { label: "Demo otvoren", value: demoOpenedTotal, sub: "Ušli u demo nalog", icon: Eye, color: "text-amber-400" },
    { label: "Treba akcija", value: needsAction, sub: "Čeka Vašu odluku", icon: ListChecks, color: "text-rose-400" },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-6 h-6 text-emerald animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-outfit font-bold text-silver">Danas</h2>
          <p className="text-sm text-silver/40 font-outfit">Dnevni pregled pipeline-a</p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          className="rounded-xl border-emerald/20 text-emerald hover:bg-emerald/10"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
          Osveži
        </Button>
      </div>

      {/* Top stat row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {stats.map((item, i) => (
          <motion.div
            key={item.label}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className="group relative"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-br from-emerald/20 to-transparent rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition duration-500" />
            <Card className="glass-card relative border-emerald/10 p-2 overflow-hidden bg-obsidian/40 backdrop-blur-2xl rounded-[2rem]">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl bg-obsidian/60 border border-emerald/10 flex items-center justify-center",
                      item.color
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-emerald/40" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-xs font-outfit font-medium text-silver/40 uppercase tracking-widest">{item.label}</p>
                  <h3 className="font-outfit font-bold text-silver text-3xl">{item.value}</h3>
                  <p className="text-xs font-outfit text-emerald/60">{item.sub}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Action queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ActionQueueList
          title="Nacrti za odobrenje"
          emptyLabel="Nema nacrta koji čekaju odobrenje"
          items={draftsToApprove}
          onOpen={setIntelLead}
          onStatusUpdate={handleStatusUpdate}
          renderReason={(c) =>
            c.email_1_poslat && c.email_2_draft && !c.email_2_poslat
              ? "Follow-up nacrt spreman"
              : "Prvi email nacrt spreman"
          }
          renderAction={(c) => (
            <Button
              size="sm"
              onClick={() => handleApprove(c.id)}
              disabled={c.approved_to_send}
              className={cn(
                "rounded-xl font-outfit font-bold text-xs px-4",
                c.approved_to_send
                  ? "bg-emerald/10 text-emerald/60 cursor-default"
                  : "bg-gradient-to-r from-emerald to-emerald/80 text-obsidian hover:brightness-110"
              )}
            >
              {c.approved_to_send ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Odobreno
                </>
              ) : (
                "Odobri za slanje"
              )}
            </Button>
          )}
        />
        <ActionQueueList
          title="Topli odgovori"
          emptyLabel="Nema odgovora koji čekaju"
          items={warmReplies}
          onOpen={setIntelLead}
          onStatusUpdate={handleStatusUpdate}
          renderReason={(c) => c.reply_snippet || c.reply_intent || "Odgovorio"}
        />
        <ActionQueueList
          title="Demo otvoren, bez kontakta"
          emptyLabel="Nema demo naloga koji čekaju kontakt"
          items={demosNotContacted}
          onOpen={setIntelLead}
          onStatusUpdate={handleStatusUpdate}
          renderReason={() => "Ušao u demo, još nije kontaktiran"}
        />
      </div>

      <LeadIntelligenceViewer lead={intelLead} isOpen={!!intelLead} onClose={() => setIntelLead(null)} />
    </div>
  )
}

function ActionQueueList({
  title,
  emptyLabel,
  items,
  onOpen,
  onStatusUpdate,
  renderReason,
  renderAction,
}: {
  title: string
  emptyLabel: string
  items: Contact[]
  onOpen: (c: Contact) => void
  onStatusUpdate: (id: string, status: string) => void
  renderReason: (c: Contact) => string
  renderAction?: (c: Contact) => ReactNode
}) {
  return (
    <Card className="glass-card border-white/10 bg-obsidian/40 backdrop-blur-2xl rounded-[2rem] overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <h3 className="font-outfit font-bold text-silver text-sm uppercase tracking-widest">{title}</h3>
        <Badge className="bg-emerald/10 text-emerald border-emerald/20">{items.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[420px] overflow-y-auto">
        {items.length === 0 && (
          <p className="text-xs text-silver/30 font-outfit italic py-6 text-center">{emptyLabel}</p>
        )}
        {items.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-emerald/20 transition-colors group"
          >
            <button
              type="button"
              onClick={() => onOpen(c)}
              className="min-w-0 flex-1 text-left cursor-pointer"
            >
              <p className="text-sm font-outfit font-semibold text-silver truncate group-hover:text-emerald transition-colors">
                {c.company_name}
              </p>
              <p className="text-xs text-silver/40 font-outfit truncate">{renderReason(c)}</p>
            </button>
            <div className="flex items-center gap-2 shrink-0">
              {renderAction ? renderAction(c) : <StatusMiniBadge status={c.status} onUpdate={(s) => onStatusUpdate(c.id, s)} />}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function StatusMiniBadge({ status, onUpdate }: { status: string; onUpdate: (s: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-xl justify-between items-center font-black text-[9px] uppercase tracking-[0.15em] px-3 bg-white/5 border border-white/10 hover:border-emerald/40 transition-all"
        >
          <div className="flex items-center gap-2 truncate text-zinc-500">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentcolor]",
                status?.includes("Zakazan") || status?.includes("Meeting")
                  ? "bg-emerald text-emerald"
                  : status?.includes("Lost") || status?.includes("Disqualified")
                  ? "bg-rose-500 text-rose-500"
                  : status?.includes("Novi")
                  ? "bg-blue-400 text-blue-400"
                  : "bg-zinc-600 text-zinc-600"
              )}
            />
            {status || "Novi Lead"}
          </div>
          <MoreHorizontal className="w-3 h-3 opacity-30 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass-panel border-white/10 rounded-2xl w-[200px] p-2 bg-obsidian/95 backdrop-blur-3xl">
        {STATUS_OPTIONS.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => onUpdate(s)}
            className="rounded-xl text-zinc-500 hover:text-emerald hover:bg-white/5 cursor-pointer text-[10px] font-black uppercase tracking-[0.15em] py-3 px-4"
          >
            {s}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
