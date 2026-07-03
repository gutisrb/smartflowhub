"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  Sparkles,
  Hammer,
  Mail,
  Send,
  MessageSquare,
  RefreshCw,
  Instagram,
  Check,
  X,
  Eye,
  CheckCircle2,
  CalendarCheck,
  ExternalLink,
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
  pipeline_stage: string | null
  instagram_handle: string | null
  instagram_followers: number | null
  email_draft: string | null
  email_2_draft: string | null
  email_1_poslat: boolean
  email_2_poslat: boolean
  approved_to_send: boolean
  last_sent_at: string | null
  email_opened_at: string | null
  replied_at: string | null
  reply_intent: string | null
  reply_snippet: string | null
  meeting_time: string | null
  niche: string | null
  demo_tenant_url: string | null
}

const STATUS_OPTIONS = ["Novi Lead", "Kontaktiran", "Follow Up", "Odgovorio", "Zakazan Sastanak", "Lost"]

// which stages the cockpit shows (archived/discarded/lost are hidden)
const SELECT_FIELDS =
  "id, company_name, email, status, pipeline_stage, instagram_handle, instagram_followers, email_draft, email_2_draft, email_1_poslat, email_2_poslat, approved_to_send, last_sent_at, email_opened_at, replied_at, reply_intent, reply_snippet, meeting_time, niche, demo_tenant_url"

function draftOf(c: Contact): string | null {
  // the draft this lead is waiting to send: follow-up if already contacted, else initial
  if (c.email_1_poslat && c.email_2_draft && !c.email_2_poslat) return c.email_2_draft
  return c.email_draft
}

function parseDraft(draft: string): { subject: string; body: string } {
  const lines = draft.split("\n")
  const subject = lines[0].replace(/^Subject:\s*/i, "").trim()
  const blankAt = lines.findIndex((l, i) => i > 0 && l.trim() === "")
  const body = lines.slice(blankAt + 1).join("\n").trim()
  return { subject, body }
}

export function CommandCenterModule({ clientId }: CommandCenterModuleProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [intelLead, setIntelLead] = useState<Contact | null>(null)
  const [emailLead, setEmailLead] = useState<Contact | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("contacts")
      .select(SELECT_FIELDS)
      .eq("client_id", clientId)
      .in("pipeline_stage", ["novi", "demo_building", "email_ready", "sent", "replied", "booked"])
      .order("instagram_followers", { ascending: false })
    if (error) {
      console.error(error)
    } else {
      setContacts((data || []) as Contact[])
    }
    setLoading(false)
  }, [clientId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setTimeout(() => setRefreshing(false), 500)
  }

  const setStage = async (id: string, stage: string, extra: Record<string, unknown> = {}) => {
    // optimistic: remove/move the row right away so nothing lingers
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, pipeline_stage: stage, ...extra } : c)))
    const supabase = createClient()
    const { error } = await supabase.from("contacts").update({ pipeline_stage: stage, ...extra }).eq("id", id)
    if (error) {
      toast.error("Greška — poništavam")
      fetchData()
    }
  }

  const approveLead = (c: Contact) => { setStage(c.id, "demo_building"); toast.success("Odobreno — demo se pravi") }
  const discardLead = (c: Contact) => { setStage(c.id, "discarded"); toast("Odbačeno") }
  const approveEmail = async (c: Contact) => {
    setContacts((prev) => prev.map((x) => (x.id === c.id ? { ...x, approved_to_send: true } : x)))
    const supabase = createClient()
    const { error } = await supabase.from("contacts").update({ approved_to_send: true }).eq("id", c.id)
    if (error) { toast.error("Greška"); fetchData() } else { toast.success("Odobreno za slanje"); setEmailLead(null) }
  }
  const updateStatus = async (id: string, status: string) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
    const supabase = createClient()
    await supabase.from("contacts").update({ status }).eq("id", id)
  }

  const openInstagram = (c: Contact) => {
    if (c.instagram_handle) window.open(`https://instagram.com/${c.instagram_handle.replace(/^@/, "")}`, "_blank")
    else toast("Nema Instagram handle za ovaj lead")
  }

  const byStage = (s: string) => contacts.filter((c) => c.pipeline_stage === s)
  const novi = byStage("novi")
  const building = byStage("demo_building")
  const emailReady = byStage("email_ready")
  const sent = byStage("sent")
  const replied = [...byStage("replied"), ...byStage("booked")]

  const sentToday = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    return sent.filter((c) => c.last_sent_at && new Date(c.last_sent_at) >= start).length
  }, [sent])

  const stats = [
    { label: "Novi leadovi", value: novi.length, icon: Sparkles, color: "text-emerald" },
    { label: "Demo se pravi", value: building.length, icon: Hammer, color: "text-amber-400" },
    { label: "Email spreman", value: emailReady.length, icon: Mail, color: "text-cyan-400" },
    { label: "Poslato danas", value: sentToday, icon: Send, color: "text-blue-400" },
    { label: "Odgovori", value: replied.length, icon: MessageSquare, color: "text-purple-400" },
  ]

  if (loading) {
    return <div className="flex items-center justify-center h-96"><RefreshCw className="w-6 h-6 text-emerald animate-spin" /></div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-outfit font-bold text-silver">Danas</h2>
          <p className="text-sm text-silver/40 font-outfit">Odobri leadove → odobri email → prati odgovore</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} className="rounded-xl border-emerald/20 text-emerald hover:bg-emerald/10">
          <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} /> Osveži
        </Button>
      </div>

      {/* Stat strip = the 5 stage counts */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="glass-card border-emerald/10 bg-obsidian/40 backdrop-blur-2xl rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl bg-obsidian/60 border border-emerald/10 flex items-center justify-center shrink-0", s.color)}>
                <s.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-outfit font-bold text-silver leading-none">{s.value}</p>
                <p className="text-[11px] font-outfit text-silver/40 uppercase tracking-wider truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 1. NOVI LEADOVI — approve / discard */}
      <StageCard title="1 · Novi leadovi" hint="Pregledaj i odobri — odobreni idu u izradu demoa" count={novi.length} accent="emerald">
        {novi.map((c) => (
          <Row key={c.id} c={c} onIntel={() => setIntelLead(c)}>
            <Button size="sm" variant="ghost" onClick={() => openInstagram(c)} className="h-8 rounded-lg text-pink-400/70 hover:text-pink-400 hover:bg-pink-400/5 text-xs">
              <Instagram className="w-3.5 h-3.5 mr-1" /> Instagram
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIntelLead(c)} className="h-8 rounded-lg text-silver/60 hover:text-silver hover:bg-white/5 text-xs">
              <Eye className="w-3.5 h-3.5 mr-1" /> Intel
            </Button>
            <Button size="sm" onClick={() => approveLead(c)} className="h-8 rounded-lg bg-gradient-to-r from-emerald to-emerald/80 text-obsidian font-bold text-xs hover:brightness-110">
              <Check className="w-3.5 h-3.5 mr-1" /> Odobri
            </Button>
            <Button size="sm" variant="ghost" onClick={() => discardLead(c)} className="h-8 w-8 p-0 rounded-lg text-rose-400/60 hover:text-rose-400 hover:bg-rose-400/5">
              <X className="w-3.5 h-3.5" />
            </Button>
          </Row>
        ))}
      </StageCard>

      {/* 2. PRAVI SE DEMO — automatic, read-only */}
      {building.length > 0 && (
        <StageCard title="2 · Demo se pravi" hint="Automatski — sistem gradi demo za odobrene leadove" count={building.length} accent="amber">
          {building.map((c) => (
            <Row key={c.id} c={c} onIntel={() => setIntelLead(c)}>
              <span className="flex items-center gap-2 text-xs text-amber-400/80 font-outfit"><Hammer className="w-3.5 h-3.5 animate-pulse" /> pravi se…</span>
            </Row>
          ))}
        </StageCard>
      )}

      {/* 3. EMAIL SPREMAN — review + approve to send */}
      <StageCard title="3 · Email spreman" hint="Pregledaj email → odobri → šalje se" count={emailReady.length} accent="cyan">
        {emailReady.map((c) => (
          <Row key={c.id} c={c} onIntel={() => setIntelLead(c)}>
            <Button size="sm" variant="ghost" onClick={() => setEmailLead(c)} className="h-8 rounded-lg text-cyan-400/70 hover:text-cyan-400 hover:bg-cyan-400/5 text-xs">
              <Mail className="w-3.5 h-3.5 mr-1" /> Pogledaj email
            </Button>
            <Button size="sm" disabled={c.approved_to_send} onClick={() => approveEmail(c)}
              className={cn("h-8 rounded-lg font-bold text-xs", c.approved_to_send ? "bg-emerald/10 text-emerald/60 cursor-default" : "bg-gradient-to-r from-emerald to-emerald/80 text-obsidian hover:brightness-110")}>
              {c.approved_to_send ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Odobreno</> : <><Send className="w-3.5 h-3.5 mr-1" /> Odobri za slanje</>}
            </Button>
          </Row>
        ))}
      </StageCard>

      {/* 4. ODGOVORI / U TOKU — warm handling */}
      <StageCard title="4 · Odgovori i sastanci" hint="Topli leadovi — otvori razgovor, zakaži poziv" count={replied.length} accent="purple">
        {replied.map((c) => (
          <Row key={c.id} c={c} onIntel={() => setIntelLead(c)} subtitle={c.reply_snippet || c.reply_intent || c.status}>
            {c.meeting_time && <span className="flex items-center gap-1 text-xs text-emerald/80"><CalendarCheck className="w-3.5 h-3.5" /> sastanak</span>}
            <StatusDropdown status={c.status} onUpdate={(s) => updateStatus(c.id, s)} />
          </Row>
        ))}
      </StageCard>

      {/* 5. POSLATO — tracking, read-only */}
      {sent.length > 0 && (
        <StageCard title="5 · Poslato" hint="Praćenje — otvoreno / odgovorio" count={sent.length} accent="blue">
          {sent.slice(0, 30).map((c) => (
            <Row key={c.id} c={c} onIntel={() => setIntelLead(c)}
              subtitle={c.replied_at ? "odgovorio" : c.email_opened_at ? "otvorio email" : "poslato, čeka se"}>
              {c.email_opened_at && <Eye className="w-3.5 h-3.5 text-cyan-400/70" />}
            </Row>
          ))}
        </StageCard>
      )}

      <LeadIntelligenceViewer lead={intelLead} isOpen={!!intelLead} onClose={() => setIntelLead(null)} />
      <EmailPreview lead={emailLead} onClose={() => setEmailLead(null)} onApprove={approveEmail} />
    </div>
  )
}

function StageCard({ title, hint, count, accent, children }: { title: string; hint: string; count: number; accent: string; children: React.ReactNode }) {
  const border = accent === "emerald" ? "border-emerald/20" : accent === "amber" ? "border-amber-400/20" : accent === "cyan" ? "border-cyan-400/20" : accent === "purple" ? "border-purple-400/20" : "border-blue-400/20"
  return (
    <Card className={cn("glass-card bg-obsidian/40 backdrop-blur-2xl rounded-[2rem] overflow-hidden", border)}>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <h3 className="font-outfit font-bold text-silver text-sm uppercase tracking-widest">{title}</h3>
          <p className="text-[11px] text-silver/30 font-outfit">{hint}</p>
        </div>
        <Badge className="bg-white/5 text-silver/70 border-white/10">{count}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[440px] overflow-y-auto">
        {count === 0 && <p className="text-xs text-silver/25 font-outfit italic py-5 text-center">Prazno</p>}
        {children}
      </CardContent>
    </Card>
  )
}

function Row({ c, onIntel, subtitle, children }: { c: Contact; onIntel: () => void; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-colors group">
      <button type="button" onClick={onIntel} className="min-w-0 flex-1 text-left cursor-pointer">
        <p className="text-sm font-outfit font-semibold text-silver truncate group-hover:text-emerald transition-colors">{c.company_name}</p>
        <p className="text-xs text-silver/40 font-outfit truncate">
          {c.instagram_followers ? `${(c.instagram_followers / 1000).toFixed(0)}K` : "—"}
          {c.niche ? ` · ${c.niche}` : ""}{subtitle ? ` · ${subtitle}` : ""}
        </p>
      </button>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </div>
  )
}

function StatusDropdown({ status, onUpdate }: { status: string; onUpdate: (s: string) => void }) {
  return (
    <select value={STATUS_OPTIONS.includes(status) ? status : ""} onChange={(e) => onUpdate(e.target.value)}
      className="h-8 rounded-lg bg-white/5 border border-white/10 text-silver/70 text-xs font-outfit px-2 hover:border-emerald/40 cursor-pointer">
      {!STATUS_OPTIONS.includes(status) && <option value="">{status}</option>}
      {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="bg-obsidian">{s}</option>)}
    </select>
  )
}

function EmailPreview({ lead, onClose, onApprove }: { lead: Contact | null; onClose: () => void; onApprove: (c: Contact) => void }) {
  const draft = lead ? draftOf(lead) : null
  const parsed = draft ? parseDraft(draft) : null
  return (
    <Dialog open={!!lead} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-obsidian/95 border-emerald/20 backdrop-blur-2xl rounded-[2rem] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-outfit text-silver">{lead?.company_name}</DialogTitle>
        </DialogHeader>
        {parsed ? (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-silver/40 font-outfit mb-1">Naslov</p>
              <p className="text-sm text-silver font-outfit font-semibold">{parsed.subject}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-silver/40 font-outfit mb-1">Poruka</p>
              <div className="text-sm text-silver/80 font-outfit whitespace-pre-wrap leading-relaxed bg-white/[0.02] border border-white/5 rounded-xl p-4">{parsed.body}</div>
            </div>
            {lead?.demo_tenant_url && (
              <a href={lead.demo_tenant_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-cyan-400/80 hover:text-cyan-400">
                <ExternalLink className="w-3.5 h-3.5" /> Njihov demo
              </a>
            )}
          </div>
        ) : <p className="text-sm text-silver/40 py-8 text-center">Nema nacrta.</p>}
        <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
          <Button variant="outline" onClick={onClose} className="rounded-xl border-white/10 text-silver/60">Zatvori</Button>
          {lead && !lead.approved_to_send && (
            <Button onClick={() => onApprove(lead)} className="rounded-xl bg-gradient-to-r from-emerald to-emerald/80 text-obsidian font-bold">
              <Send className="w-4 h-4 mr-2" /> Odobri za slanje
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
