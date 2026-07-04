"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
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
  Settings2,
  AlertTriangle,
} from "lucide-react"
import { LeadIntelligenceViewer } from "@/components/dashboard/lead-intelligence-viewer"

interface CommandCenterModuleProps {
  clientId: string
}

interface MachineConfig {
  source_enabled: boolean
  source_daily_limit: number
  source_follower_floor: number
  build_enabled: boolean
  send_enabled: boolean
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

const SELECT_FIELDS =
  "id, company_name, email, status, pipeline_stage, instagram_handle, instagram_followers, email_draft, email_2_draft, email_1_poslat, email_2_poslat, approved_to_send, last_sent_at, email_opened_at, replied_at, reply_intent, reply_snippet, meeting_time, niche, demo_tenant_url"

// per-stage accent — used ONLY on the numbered marker + thin rules, never on body text
type Accent = "emerald" | "amber" | "cyan" | "purple" | "blue"
const ACCENT: Record<Accent, { text: string; ring: string; line: string; dot: string; glow: string }> = {
  emerald: { text: "text-emerald", ring: "border-emerald/60", line: "bg-emerald/25", dot: "bg-emerald", glow: "shadow-[0_0_24px_-4px_rgba(16,185,129,0.5)]" },
  amber: { text: "text-amber-400", ring: "border-amber-400/60", line: "bg-amber-400/25", dot: "bg-amber-400", glow: "shadow-[0_0_24px_-4px_rgba(251,191,36,0.5)]" },
  cyan: { text: "text-cyan-400", ring: "border-cyan-400/60", line: "bg-cyan-400/25", dot: "bg-cyan-400", glow: "shadow-[0_0_24px_-4px_rgba(34,211,238,0.5)]" },
  purple: { text: "text-purple-400", ring: "border-purple-400/60", line: "bg-purple-400/25", dot: "bg-purple-400", glow: "shadow-[0_0_24px_-4px_rgba(192,132,252,0.5)]" },
  blue: { text: "text-blue-400", ring: "border-blue-400/60", line: "bg-blue-400/25", dot: "bg-blue-400", glow: "shadow-[0_0_24px_-4px_rgba(96,165,250,0.5)]" },
}

function draftOf(c: Contact): string | null {
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
function fmtFollowers(n: number | null): string {
  if (!n) return "—"
  return n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n)
}

export function CommandCenterModule({ clientId }: CommandCenterModuleProps) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [intelLead, setIntelLead] = useState<Contact | null>(null)
  const [emailLead, setEmailLead] = useState<Contact | null>(null)
  const [config, setConfig] = useState<MachineConfig | null>(null)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const [{ data, error }, { data: cfg }] = await Promise.all([
      supabase
        .from("contacts")
        .select(SELECT_FIELDS)
        .eq("client_id", clientId)
        .in("pipeline_stage", ["novi", "demo_building", "email_ready", "sent", "replied", "booked"])
        .order("instagram_followers", { ascending: false }),
      supabase.from("machine_config").select("*").eq("client_id", clientId).maybeSingle(),
    ])
    if (error) console.error(error)
    else setContacts((data || []) as Contact[])
    if (cfg) setConfig(cfg as MachineConfig)
    setLoading(false)
  }, [clientId])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setTimeout(() => setRefreshing(false), 500)
  }

  const updateConfig = async (patch: Partial<MachineConfig>) => {
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev))
    const supabase = createClient()
    const { error } = await supabase.from("machine_config").update({ ...patch, updated_at: new Date().toISOString() }).eq("client_id", clientId)
    if (error) { toast.error("Greška u podešavanjima"); fetchData() }
  }

  const setStage = async (id: string, stage: string, extra: Record<string, unknown> = {}) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, pipeline_stage: stage, ...extra } : c)))
    const supabase = createClient()
    const { error } = await supabase.from("contacts").update({ pipeline_stage: stage, ...extra }).eq("id", id)
    if (error) { toast.error("Greška — poništavam"); fetchData() }
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

  if (loading) {
    return <div className="flex items-center justify-center h-96"><RefreshCw className="w-6 h-6 text-emerald animate-spin" /></div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-outfit font-bold text-white tracking-tight">Danas</h2>
          <p className="text-sm text-silver/70 font-outfit mt-1">Traka koja radi za tebe — leadovi teku odozgo nadole. Ti klikneš dvaput.</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} className="rounded-xl border-emerald/40 text-emerald hover:bg-emerald/10 font-outfit font-semibold">
          <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} /> Osveži
        </Button>
      </div>

      {/* Glance strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat n={novi.length} label="Novi" icon={Sparkles} accent="emerald" />
        <Stat n={building.length} label="Demo se pravi" icon={Hammer} accent="amber" />
        <Stat n={emailReady.length} label="Email spreman" icon={Mail} accent="cyan" />
        <Stat n={sentToday} label="Poslato danas" icon={Send} accent="blue" />
        <Stat n={replied.length} label="Odgovori" icon={MessageSquare} accent="purple" />
      </div>

      {/* The conveyor — 5 numbered stations */}
      <div className="space-y-0">
        <Station n={1} accent="emerald" title="Novi leadovi" tagline="Pregledaj i odobri" count={novi.length}
          info="Sistem svako jutro traži nove firme koje se oglašavaju video-oglasima na Instagramu i imaju dovoljno pratilaca. Klikni na firmu da vidiš njihov Instagram i sve što je sistem prikupio. Odobreni idu u izradu demoa; odbačeni nestaju."
          settings={config && (
            <div className="space-y-4">
              <p className="text-[11px] font-outfit font-bold uppercase tracking-widest text-emerald">Podešavanja skrejpera</p>
              <Toggle label="Automatsko traženje svako jutro (06h)" checked={config.source_enabled} onChange={(v) => updateConfig({ source_enabled: v })} />
              <NumberField label="Koliko novih leadova dnevno" value={config.source_daily_limit} onChange={(v) => updateConfig({ source_daily_limit: v })} />
              <NumberField label="Minimum Instagram pratilaca" value={config.source_follower_floor} step={5000} onChange={(v) => updateConfig({ source_follower_floor: v })} />
              <p className="text-xs text-silver/60 leading-relaxed">Skrejper: <span className="text-silver/80">source_leads.mjs</span> (Meta Ads Library preko Apify-ja). Pozadinski posao se pali u <span className="font-mono text-silver/80">launchd/README.md</span>; ovaj prekidač ga pauzira i kad je upaljen.</p>
            </div>
          )}>
          {novi.length === 0
            ? <Empty text="Još nema novih leadova. Uključi traženje ili pokreni skrejper." />
            : novi.map((c) => (
              <Row key={c.id} c={c} onIntel={() => setIntelLead(c)}>
                <IconBtn onClick={() => openInstagram(c)} tone="pink"><Instagram className="w-3.5 h-3.5" /> Instagram</IconBtn>
                <IconBtn onClick={() => setIntelLead(c)} tone="silver"><Eye className="w-3.5 h-3.5" /> Intel</IconBtn>
                <Button size="sm" onClick={() => approveLead(c)} className="h-9 rounded-xl bg-emerald text-obsidian font-outfit font-bold text-xs hover:brightness-110 px-4">
                  <Check className="w-4 h-4 mr-1" /> Odobri
                </Button>
                <Button size="sm" variant="ghost" onClick={() => discardLead(c)} className="h-9 w-9 p-0 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-400/10">
                  <X className="w-4 h-4" />
                </Button>
              </Row>
            ))}
        </Station>

        <Station n={2} accent="amber" title="Demo se pravi" tagline="Automatski" count={building.length}
          info="Za svaki lead koji odobriš, sistem sam napravi personalizovani demo dashboard sa njihovim brendom i primerima razgovora (par minuta). Troši malo API novca po demou. Kad je gotovo, lead prelazi u „Email spreman“."
          settings={config && (
            <Toggle label="Automatska izrada demoa za odobrene" checked={config.build_enabled} onChange={(v) => updateConfig({ build_enabled: v })} />
          )}>
          {building.length === 0
            ? <Empty text="Ništa se trenutno ne pravi." />
            : building.map((c) => (
              <Row key={c.id} c={c} onIntel={() => setIntelLead(c)}>
                <span className="flex items-center gap-2 text-xs text-amber-400 font-outfit font-semibold"><Hammer className="w-4 h-4 animate-pulse" /> pravi se…</span>
              </Row>
            ))}
        </Station>

        <Station n={3} accent="cyan" title="Email spreman" tagline="Pročitaj i odobri slanje" count={emailReady.length}
          info="Demo je gotov, email je napisan (sa njihovim login podacima unutra). Klikni „Pogledaj email“ da ga pročitaš, pa „Odobri za slanje“. Slanje ide preko skripte — nikad iz pregledača."
          settings={config && (
            <div className="space-y-3">
              <Toggle label="Automatsko slanje odobrenih (10h dnevno)" checked={config.send_enabled} onChange={(v) => updateConfig({ send_enabled: v })} danger />
              <div className="flex items-start gap-2 text-xs text-amber-300 leading-relaxed">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Ovo šalje <b>prave email-ove</b>. Drži isključeno dok ne budeš siguran. Do tada šalji ručno: <span className="font-mono text-amber-200">node send_outreach.mjs --mode approved --force-send</span></span>
              </div>
            </div>
          )}>
          {emailReady.length === 0
            ? <Empty text="Nijedan email još nije spreman." />
            : emailReady.map((c) => (
              <Row key={c.id} c={c} onIntel={() => setIntelLead(c)}>
                <IconBtn onClick={() => setEmailLead(c)} tone="cyan"><Mail className="w-3.5 h-3.5" /> Pogledaj email</IconBtn>
                <Button size="sm" disabled={c.approved_to_send} onClick={() => approveEmail(c)}
                  className={cn("h-9 rounded-xl font-outfit font-bold text-xs px-4", c.approved_to_send ? "bg-emerald/15 text-emerald cursor-default" : "bg-emerald text-obsidian hover:brightness-110")}>
                  {c.approved_to_send ? <><CheckCircle2 className="w-4 h-4 mr-1" /> Odobreno</> : <><Send className="w-4 h-4 mr-1" /> Odobri</>}
                </Button>
              </Row>
            ))}
        </Station>

        <Station n={4} accent="purple" title="Odgovori i sastanci" tagline="Tvoj posao — vodi razgovor" count={replied.length}
          info="Topli odgovori koje sistem prepozna iz tvog inboxa (proverava na svaka 4 sata). Ovde vodiš razgovor i zakazuješ pozive. Promeni status padajućim menijem sa desne strane.">
          {replied.length === 0
            ? <Empty text="Nema toplih odgovora za sada." />
            : replied.map((c) => (
              <Row key={c.id} c={c} onIntel={() => setIntelLead(c)} subtitle={c.reply_snippet || c.reply_intent || c.status}>
                {c.meeting_time && <span className="flex items-center gap-1 text-xs text-emerald font-semibold"><CalendarCheck className="w-4 h-4" /> sastanak</span>}
                <StatusDropdown status={c.status} onUpdate={(s) => updateStatus(c.id, s)} />
              </Row>
            ))}
        </Station>

        <Station n={5} accent="blue" title="Poslato" tagline="Praćenje" count={sent.length} last
          info="Poslati email-ovi. Sistem prati ko je otvorio email i ko je odgovorio (odgovori se pojave u koraku 4). Samo za praćenje — nema akcije.">
          {sent.length === 0
            ? <Empty text="Još ništa nije poslato." />
            : sent.slice(0, 30).map((c) => (
              <Row key={c.id} c={c} onIntel={() => setIntelLead(c)}
                subtitle={c.replied_at ? "odgovorio" : c.email_opened_at ? "otvorio email" : "poslato, čeka se"}>
                {c.email_opened_at && <span className="flex items-center gap-1 text-xs text-cyan-400 font-semibold"><Eye className="w-4 h-4" /> otvorio</span>}
              </Row>
            ))}
        </Station>
      </div>

      <LeadIntelligenceViewer lead={intelLead} isOpen={!!intelLead} onClose={() => setIntelLead(null)} />
      <EmailPreview lead={emailLead} onClose={() => setEmailLead(null)} onApprove={approveEmail} />
    </div>
  )
}

function Stat({ n, label, icon: Icon, accent }: { n: number; label: string; icon: typeof Sparkles; accent: Accent }) {
  const a = ACCENT[accent]
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", a.text)} />
        <span className="text-[11px] font-outfit font-bold uppercase tracking-wider text-silver/70">{label}</span>
      </div>
      <p className="text-3xl font-outfit font-bold text-white leading-none">{n}</p>
    </div>
  )
}

function Station({ n, accent, title, tagline, count, info, settings, last, children }: {
  n: number; accent: Accent; title: string; tagline: string; count: number
  info?: string; settings?: React.ReactNode; last?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const a = ACCENT[accent]
  return (
    <div className="flex gap-4 md:gap-6">
      {/* Rail: numbered marker + connecting line */}
      <div className="flex flex-col items-center pt-1">
        <div className={cn("w-11 h-11 rounded-2xl border-2 bg-obsidian flex items-center justify-center shrink-0", a.ring, a.glow)}>
          <span className={cn("text-xl font-outfit font-light", a.text)}>{n}</span>
        </div>
        {!last && <div className={cn("w-0.5 flex-1 my-2 rounded-full", a.line)} />}
      </div>

      {/* Station body */}
      <div className={cn("flex-1 rounded-3xl bg-white/[0.03] border border-white/10 overflow-hidden", last ? "mb-0" : "mb-6")}>
        <div className="flex items-center justify-between px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-lg font-outfit font-bold text-white leading-tight">{title}</h3>
            <p className="text-xs text-silver/60 font-outfit">{tagline}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {(info || settings) && (
              <button onClick={() => setOpen((o) => !o)}
                className={cn("flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-outfit font-semibold transition-colors border",
                  open ? "text-white bg-white/10 border-white/20" : "text-silver/70 border-white/10 hover:text-white hover:bg-white/5")}>
                <Settings2 className="w-3.5 h-3.5" /> Šta je ovo?
              </button>
            )}
            <span className={cn("min-w-8 h-8 px-2 rounded-lg flex items-center justify-center text-sm font-outfit font-bold text-white bg-white/5 border", `border-white/10`)}>{count}</span>
          </div>
        </div>

        {open && (info || settings) && (
          <div className="mx-5 mb-4 rounded-2xl bg-obsidian/60 border border-white/10 p-4 space-y-4">
            {info && <p className="text-sm text-silver/80 font-outfit leading-relaxed">{info}</p>}
            {settings && <div className="pt-3 border-t border-white/10">{settings}</div>}
          </div>
        )}

        <div className="px-3 pb-3 space-y-2 max-h-[460px] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

function Row({ c, onIntel, subtitle, children }: { c: Contact; onIntel: () => void; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/20 hover:bg-white/[0.04] transition-colors group">
      <button type="button" onClick={onIntel} className="min-w-0 flex-1 text-left">
        <p className="text-sm font-outfit font-semibold text-white truncate">{c.company_name}</p>
        <p className="text-xs text-silver/60 font-outfit truncate">
          <span className="text-silver/80 font-medium">{fmtFollowers(c.instagram_followers)}</span>
          {c.niche ? ` · ${c.niche}` : ""}{subtitle ? ` · ${subtitle}` : ""}
        </p>
      </button>
      <div className="flex items-center gap-1.5 shrink-0">{children}</div>
    </div>
  )
}

function IconBtn({ onClick, tone, children }: { onClick: () => void; tone: "pink" | "cyan" | "silver"; children: React.ReactNode }) {
  const c = tone === "pink" ? "text-pink-400 hover:bg-pink-400/10" : tone === "cyan" ? "text-cyan-400 hover:bg-cyan-400/10" : "text-silver/80 hover:bg-white/5 hover:text-white"
  return (
    <Button size="sm" variant="ghost" onClick={onClick} className={cn("h-9 rounded-xl text-xs font-outfit font-medium gap-1", c)}>
      {children}
    </Button>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-silver/50 font-outfit italic py-6 text-center">{text}</p>
}

function StatusDropdown({ status, onUpdate }: { status: string; onUpdate: (s: string) => void }) {
  return (
    <select value={STATUS_OPTIONS.includes(status) ? status : ""} onChange={(e) => onUpdate(e.target.value)}
      className="h-9 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-outfit font-medium px-2 hover:border-emerald/50 cursor-pointer">
      {!STATUS_OPTIONS.includes(status) && <option value="">{status}</option>}
      {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="bg-obsidian text-white">{s}</option>)}
    </select>
  )
}

function Toggle({ label, checked, onChange, danger }: { label: string; checked: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center justify-between w-full gap-3">
      <span className="text-sm text-silver/90 font-outfit text-left">{label}</span>
      <span className={cn("relative w-11 h-6 rounded-full transition-colors shrink-0", checked ? (danger ? "bg-amber-500" : "bg-emerald") : "bg-white/15")}>
        <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all shadow", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  )
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-silver/90 font-outfit">{label}</span>
      <input type="number" step={step} defaultValue={value}
        onBlur={(e) => { const nv = parseInt(e.target.value); if (Number.isFinite(nv) && nv !== value) onChange(nv) }}
        className="w-24 h-9 rounded-xl bg-white/5 border border-white/15 text-white text-sm font-outfit px-3 text-right focus:border-emerald/50 outline-none" />
    </label>
  )
}

function EmailPreview({ lead, onClose, onApprove }: { lead: Contact | null; onClose: () => void; onApprove: (c: Contact) => void }) {
  const draft = lead ? draftOf(lead) : null
  const parsed = draft ? parseDraft(draft) : null
  return (
    <Dialog open={!!lead} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-obsidian border-emerald/20 rounded-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-outfit text-white text-xl">{lead?.company_name}</DialogTitle>
        </DialogHeader>
        {parsed ? (
          <div className="flex-1 overflow-y-auto space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-emerald font-outfit font-bold mb-1">Naslov</p>
              <p className="text-base text-white font-outfit font-semibold">{parsed.subject}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest text-emerald font-outfit font-bold mb-1">Poruka</p>
              <div className="text-sm text-silver/90 font-outfit whitespace-pre-wrap leading-relaxed bg-white/[0.03] border border-white/10 rounded-2xl p-4">{parsed.body}</div>
            </div>
            {lead?.demo_tenant_url && (
              <a href={lead.demo_tenant_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 font-medium">
                <ExternalLink className="w-4 h-4" /> Njihov demo
              </a>
            )}
          </div>
        ) : <p className="text-sm text-silver/60 py-8 text-center">Nema nacrta.</p>}
        <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
          <Button variant="outline" onClick={onClose} className="rounded-xl border-white/15 text-silver/80 hover:text-white">Zatvori</Button>
          {lead && !lead.approved_to_send && (
            <Button onClick={() => onApprove(lead)} className="rounded-xl bg-emerald text-obsidian font-outfit font-bold hover:brightness-110">
              <Send className="w-4 h-4 mr-2" /> Odobri za slanje
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
