"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import { RefreshCw, Plus, Instagram, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LeadIntelligenceViewer } from "@/components/dashboard/lead-intelligence-viewer"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  company_name: string | null
  email: string | null
  status: string | null
  prioritet_skor: number | null
  usluga: string | null
  starred: boolean | null
  intake_data: any
  created_at: string
  client_id: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = ["Novi Lead", "Kontaktiran", "Demo Zakazan", "Meeting Booked"] as const
type Stage = typeof STAGES[number]

const STAGE_BADGE_STYLES: Record<Stage, string> = {
  "Novi Lead":      "bg-zinc-800 text-zinc-400",
  "Kontaktiran":    "bg-blue-500/20 text-blue-400",
  "Demo Zakazan":   "bg-amber-500/20 text-amber-400",
  "Meeting Booked": "bg-emerald-500/20 text-emerald-400",
}

const SERVICE_BADGE_STYLES: Record<string, string> = {
  social_media_system: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  ai_organic_content:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  ai_sales_systems:    "bg-orange-500/15 text-orange-400 border-orange-500/25",
}

const SERVICE_LABELS: Record<string, string> = {
  social_media_system: "Social Media",
  ai_organic_content:  "AI Organic",
  ai_sales_systems:    "AI Sales",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTemperature(score: number | null): "vreo" | "topao" | null {
  if (score == null) return null
  if (score >= 70) return "vreo"
  if (score >= 40) return "topao"
  return null
}

function getInitialChipStyle(name: string): string {
  const gradients = [
    "from-emerald-500/40 to-teal-500/40",
    "from-blue-500/40 to-indigo-500/40",
    "from-purple-500/40 to-pink-500/40",
    "from-amber-500/40 to-orange-500/40",
    "from-rose-500/40 to-red-500/40",
    "from-cyan-500/40 to-sky-500/40",
  ]
  const code = name.charCodeAt(0) || 0
  return gradients[code % gradients.length]
}

// ─── Empty Column ─────────────────────────────────────────────────────────────

function EmptyColumn() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-zinc-700">
      <div className="w-10 h-10 rounded-full border border-dashed border-zinc-700 flex items-center justify-center mb-3">
        <Plus className="w-4 h-4" />
      </div>
      <p className="text-xs">Nema leads u ovoj fazi</p>
    </div>
  )
}

// ─── Lead Card ────────────────────────────────────────────────────────────────

function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const temp = getTemperature(lead.prioritet_skor)
  const initial = (lead.company_name || "?")[0].toUpperCase()
  const gradientClass = getInitialChipStyle(lead.company_name || "A")

  const igProfile = lead.intake_data?.enrichment?.instagram_profile
  const igFollowers = igProfile?.followers as number | undefined
  const activeAds = lead.intake_data?.active_ads_count as number | undefined
  const service = lead.usluga || ""

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.18 }}
      onClick={onClick}
      className={cn(
        "rounded-xl border cursor-pointer transition-all duration-200 p-3.5",
        "border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.1]",
        temp === "vreo" && "border-l-2 !border-l-red-500/40 shadow-[0_0_20px_-8px_rgba(239,68,68,0.25)]",
        temp === "topao" && "border-l-2 !border-l-amber-500/40 shadow-[0_0_20px_-8px_rgba(245,158,11,0.2)]",
      )}
    >
      {/* Top row: company initial + name */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn(
          "w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0 text-[11px] font-bold text-white/80",
          gradientClass
        )}>
          {initial}
        </div>
        <span className="text-sm font-semibold text-silver truncate flex-1">
          {lead.company_name || "—"}
        </span>
      </div>

      {/* IG followers row */}
      {igFollowers != null && igFollowers > 0 && (
        <div className="flex items-center gap-1 mb-2 text-[11px] text-zinc-500">
          <Instagram className="w-3 h-3" />
          <span>{igFollowers.toLocaleString()} pratilaca</span>
        </div>
      )}

      {/* Bottom row: service + temperature + ads */}
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        {service && (
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border",
            SERVICE_BADGE_STYLES[service] || SERVICE_BADGE_STYLES.social_media_system
          )}>
            {SERVICE_LABELS[service] || service}
          </span>
        )}
        {temp === "vreo" && (
          <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold uppercase tracking-widest">
            Vreo
          </span>
        )}
        {temp === "topao" && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold uppercase tracking-widest">
            Topao
          </span>
        )}
        {activeAds != null && activeAds > 0 && (
          <span className="ml-auto text-[10px] text-zinc-600 font-medium">
            {activeAds} oglasa
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Add Lead Dialog ──────────────────────────────────────────────────────────

function AddLeadDialog({
  clientId,
  onClose,
  onAdded,
}: {
  clientId: string
  onClose: () => void
  onAdded: () => void
}) {
  const supabase = createClient()
  const [companyName, setCompanyName] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) return
    setLoading(true)
    const { error } = await supabase.from("contacts").insert({
      company_name: companyName.trim(),
      email: email.trim() || null,
      status: "Novi Lead",
      client_id: clientId,
      izvor: "manual",
    })
    setLoading(false)
    if (error) {
      toast.error("Greška pri dodavanju leada")
      return
    }
    toast.success("Lead dodat!")
    onAdded()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-outfit font-semibold text-silver">Dodaj Lead</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-zinc-500 uppercase tracking-widest font-bold">
              Naziv Kompanije *
            </label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              required
              placeholder="npr. Restoran Kod Mame"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-silver placeholder:text-zinc-600 focus:outline-none focus:border-emerald/40 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-zinc-500 uppercase tracking-widest font-bold">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="kontakt@kompanija.rs"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-silver placeholder:text-zinc-600 focus:outline-none focus:border-emerald/40 transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 text-zinc-400"
            >
              Otkaži
            </Button>
            <Button
              type="submit"
              disabled={loading || !companyName.trim()}
              className="flex-1 rounded-xl bg-emerald text-obsidian font-bold hover:bg-emerald/90"
            >
              {loading ? "Dodajem..." : "Dodaj Lead"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Pipeline Module ──────────────────────────────────────────────────────────

export function PipelineModule({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isIntelOpen, setIsIntelOpen] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)

  const fetchLeads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data, error } = await supabase
      .from("kontakti")
      .select("*")
      .eq("client_id", clientId)
      .eq("izvor", "meta_ads_scrape")
      .order("prioritet_skor", { ascending: false })

    if (!error && data) setLeads(data as Lead[])
    setLoading(false)
    setRefreshing(false)
  }, [clientId, supabase])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`pipeline:${clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kontakti" }, () => {
        fetchLeads(true)
      })
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [clientId, supabase, fetchLeads])

  // Group leads by stage
  const grouped = STAGES.reduce<Record<Stage, Lead[]>>((acc, stage) => {
    acc[stage] = []
    return acc
  }, {} as Record<Stage, Lead[]>)

  for (const lead of leads) {
    const stage = STAGES.includes(lead.status as Stage) ? (lead.status as Stage) : "Novi Lead"
    grouped[stage].push(lead)
  }

  const vreoCount = leads.filter(l => (l.prioritet_skor ?? 0) >= 70).length
  const topaoCount = leads.filter(l => {
    const s = l.prioritet_skor ?? 0
    return s >= 40 && s < 70
  }).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-emerald/20 rounded-full" />
          <div className="w-12 h-12 border-t-2 border-emerald rounded-full animate-spin absolute top-0 left-0" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-outfit font-light text-silver tracking-tight">Pipeline</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {leads.length} leads · {vreoCount} vreo · {topaoCount} topao
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fetchLeads(true)}
            disabled={refreshing}
            className="rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-white/[0.06]"
          >
            <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
          </Button>
          <Button
            onClick={() => setIsAddOpen(true)}
            className="rounded-full px-5 bg-emerald text-obsidian text-sm font-bold hover:bg-emerald/90 transition-all"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Dodaj Lead
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
        {STAGES.map(stage => (
          <div
            key={stage}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
          >
            {/* Column Header */}
            <div className="px-4 py-3 border-b border-white/[0.05] flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                {stage}
              </span>
              <span className={cn(
                "w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center",
                STAGE_BADGE_STYLES[stage]
              )}>
                {grouped[stage].length}
              </span>
            </div>

            {/* Column Body */}
            <div className="p-3 space-y-2.5 min-h-[400px]">
              <AnimatePresence>
                {grouped[stage].length === 0 ? (
                  <EmptyColumn />
                ) : (
                  grouped[stage].map(lead => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => {
                        setSelectedLead(lead)
                        setIsIntelOpen(true)
                      }}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>

      {/* Lead Intelligence Viewer */}
      <LeadIntelligenceViewer
        lead={selectedLead}
        isOpen={isIntelOpen}
        onClose={() => setIsIntelOpen(false)}
      />

      {/* Add Lead Dialog */}
      <AnimatePresence>
        {isAddOpen && (
          <AddLeadDialog
            clientId={clientId}
            onClose={() => setIsAddOpen(false)}
            onAdded={() => fetchLeads(true)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
