"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import {
  RefreshCw,
  Plus,
  Search,
  Star,
  Instagram,
  MessageSquare,
  ChevronDown,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  niche: string | null
  intake_data: any
  created_at: string
  client_id: string
}

type FilterChip = "sve" | "vreo" | "topao" | "email" | "starred"
type SortKey = "prioritet" | "datum" | "pratioci"

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICE_OPTIONS = [
  { value: "social_media_system", label: "Social Media System" },
  { value: "ai_organic_content",  label: "AI Organic Content" },
  { value: "ai_sales_systems",    label: "AI Sales Systems" },
]

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

const STATUS_BADGE_STYLES: Record<string, string> = {
  "Novi Lead":      "bg-zinc-800 text-zinc-400",
  "Kontaktiran":    "bg-blue-500/15 text-blue-400",
  "Demo Zakazan":   "bg-amber-500/15 text-amber-400",
  "Meeting Booked": "bg-emerald-500/15 text-emerald-400",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTemperature(score: number | null): "vreo" | "topao" | null {
  if (score == null) return null
  if (score >= 70) return "vreo"
  if (score >= 40) return "topao"
  return null
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

// ─── Service Dropdown Cell ────────────────────────────────────────────────────

function ServiceCell({
  lead,
  onUpdate,
}: {
  lead: Lead
  onUpdate: (id: string, usluga: string) => void
}) {
  const supabase = createClient()
  const current = lead.usluga || ""

  const handleChange = async (val: string) => {
    const { error } = await supabase
      .from("contacts")
      .update({ usluga: val })
      .eq("id", lead.id)
    if (error) {
      toast.error("Greška pri ažuriranju usluge")
      return
    }
    onUpdate(lead.id, val)
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger
        className={cn(
          "h-7 w-full border text-[11px] font-bold uppercase tracking-widest rounded-full px-2.5 focus:ring-0 bg-transparent",
          current ? SERVICE_BADGE_STYLES[current] : "border-white/10 text-zinc-600"
        )}
        onClick={e => e.stopPropagation()}
      >
        <SelectValue placeholder="—">
          {current ? SERVICE_LABELS[current] || current : "—"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-zinc-950 border-white/10">
        {SERVICE_OPTIONS.map(opt => (
          <SelectItem
            key={opt.value}
            value={opt.value}
            className="text-xs text-zinc-300 focus:bg-white/5"
          >
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// ─── Leads Module ─────────────────────────────────────────────────────────────

export function LeadsModule({ clientId }: { clientId: string }) {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterChip>("sve")
  const [sort, setSort] = useState<SortKey>("prioritet")
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
      .channel(`leads-module:${clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kontakti" }, () => {
        fetchLeads(true)
      })
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [clientId, supabase, fetchLeads])

  const toggleStar = async (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation()
    const newVal = !lead.starred
    const { error } = await supabase
      .from("contacts")
      .update({ starred: newVal })
      .eq("id", lead.id)
    if (error) {
      toast.error("Greška")
      return
    }
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, starred: newVal } : l))
  }

  const handleServiceUpdate = (id: string, usluga: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, usluga } : l))
  }

  // Analytics stats
  const vreoCount = leads.filter(l => (l.prioritet_skor ?? 0) >= 70).length
  const emailCount = leads.filter(l => l.email).length
  const igCount = leads.filter(l => l.intake_data?.enrichment?.instagram_profile).length

  // Filtered + sorted leads
  const displayed = useMemo(() => {
    let result = leads

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(l =>
        (l.company_name || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q)
      )
    }

    // Chip filter
    if (filter === "vreo") result = result.filter(l => (l.prioritet_skor ?? 0) >= 70)
    if (filter === "topao") result = result.filter(l => {
      const s = l.prioritet_skor ?? 0
      return s >= 40 && s < 70
    })
    if (filter === "email") result = result.filter(l => !!l.email)
    if (filter === "starred") result = result.filter(l => l.starred)

    // Sort
    if (sort === "prioritet") result = [...result].sort((a, b) => (b.prioritet_skor ?? 0) - (a.prioritet_skor ?? 0))
    if (sort === "datum") result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (sort === "pratioci") result = [...result].sort((a, b) => {
      const af = a.intake_data?.enrichment?.instagram_profile?.followers ?? 0
      const bf = b.intake_data?.enrichment?.instagram_profile?.followers ?? 0
      return bf - af
    })

    return result
  }, [leads, search, filter, sort])

  const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
    { key: "sve",     label: "Sve" },
    { key: "vreo",    label: "Vreo" },
    { key: "topao",   label: "Topao" },
    { key: "email",   label: "Email" },
    { key: "starred", label: "★ Starred" },
  ]

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
    <div className="flex flex-col gap-5">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-outfit font-light text-silver tracking-tight">Leads</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Intelligence baza — svi leadovi, filtrirano i sortirano</p>
      </div>

      {/* Analytics Strip */}
      <div className="flex items-center gap-8 px-6 py-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
        {/* Total */}
        <div className="flex flex-col">
          <span className="text-xl font-bold font-outfit text-silver">{leads.length}</span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest mt-0.5">Leads</span>
        </div>
        <div className="w-px h-8 bg-white/10" />
        {/* Vreo */}
        <div className="flex flex-col">
          <span className="text-xl font-bold font-outfit text-red-400">{vreoCount}</span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest mt-0.5">Vreo 🔴</span>
        </div>
        <div className="w-px h-8 bg-white/10" />
        {/* Email */}
        <div className="flex flex-col">
          <span className="text-xl font-bold font-outfit text-silver">
            {emailCount}<span className="text-sm text-zinc-500 font-normal">/{leads.length}</span>
          </span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest mt-0.5">Email</span>
        </div>
        <div className="w-px h-8 bg-white/10" />
        {/* IG Profili */}
        <div className="flex flex-col">
          <span className="text-xl font-bold font-outfit text-pink-400">{igCount}</span>
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest mt-0.5">IG Profili</span>
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-white/5 rounded-full border border-white/[0.06] focus-within:border-emerald/30 transition-all w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Pretraži leadove..."
            className="bg-transparent border-none text-sm text-zinc-300 focus:outline-none flex-1 placeholder:text-zinc-600 font-light"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_CHIPS.map(chip => (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-all",
                filter === chip.key
                  ? "bg-white/10 text-silver border-white/20"
                  : "text-zinc-500 border-white/[0.06] hover:border-white/10"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Sort */}
        <Select value={sort} onValueChange={v => setSort(v as SortKey)}>
          <SelectTrigger className="h-8 w-36 rounded-full border-white/[0.06] bg-white/5 text-[11px] text-zinc-400 uppercase tracking-widest focus:ring-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-950 border-white/10">
            <SelectItem value="prioritet" className="text-xs text-zinc-300 focus:bg-white/5">Prioritet</SelectItem>
            <SelectItem value="datum"     className="text-xs text-zinc-300 focus:bg-white/5">Datum</SelectItem>
            <SelectItem value="pratioci"  className="text-xs text-zinc-300 focus:bg-white/5">Pratioci</SelectItem>
          </SelectContent>
        </Select>

        {/* Osvezi */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchLeads(true)}
          disabled={refreshing}
          className="rounded-full h-8 px-3.5 text-[11px] font-bold uppercase tracking-widest text-zinc-500 border border-white/[0.06] hover:text-zinc-300 hover:bg-white/5"
        >
          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")} />
          Osvezi
        </Button>

        {/* Add Lead */}
        <Button
          onClick={() => setIsAddOpen(true)}
          size="sm"
          className="rounded-full h-8 px-4 bg-emerald text-obsidian text-[11px] font-bold uppercase tracking-widest hover:bg-emerald/90"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Dodaj Lead
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/[0.05] hover:bg-transparent">
              <TableHead className="sticky top-0 bg-obsidian/80 backdrop-blur-sm w-10 text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                ★
              </TableHead>
              <TableHead className="sticky top-0 bg-obsidian/80 backdrop-blur-sm text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                Kompanija
              </TableHead>
              <TableHead className="sticky top-0 bg-obsidian/80 backdrop-blur-sm w-[120px] text-[10px] text-zinc-600 uppercase tracking-widest font-bold hidden sm:table-cell">
                Instagram
              </TableHead>
              <TableHead className="sticky top-0 bg-obsidian/80 backdrop-blur-sm w-[150px] text-[10px] text-zinc-600 uppercase tracking-widest font-bold hidden md:table-cell">
                Usluga
              </TableHead>
              <TableHead className="sticky top-0 bg-obsidian/80 backdrop-blur-sm w-[100px] text-[10px] text-zinc-600 uppercase tracking-widest font-bold">
                Status
              </TableHead>
              <TableHead className="sticky top-0 bg-obsidian/80 backdrop-blur-sm w-[80px] text-[10px] text-zinc-600 uppercase tracking-widest font-bold text-right hidden lg:table-cell">
                Oglasi
              </TableHead>
              <TableHead className="sticky top-0 bg-obsidian/80 backdrop-blur-sm w-[60px] text-[10px] text-zinc-600 uppercase tracking-widest font-bold text-center">
                Intel
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence>
              {displayed.length === 0 ? (
                <TableRow className="border-white/[0.05]">
                  <TableCell colSpan={7} className="text-center py-16 text-zinc-600 text-sm">
                    Nema leadova koji odgovaraju filterima
                  </TableCell>
                </TableRow>
              ) : (
                displayed.map(lead => {
                  const igProfile = lead.intake_data?.enrichment?.instagram_profile
                  const igHandle = igProfile?.username as string | undefined
                  const igFollowers = igProfile?.followers as number | undefined
                  const activeAds = lead.intake_data?.active_ads_count as number | undefined
                  const temp = getTemperature(lead.prioritet_skor)
                  const statusStyle = lead.status ? (STATUS_BADGE_STYLES[lead.status] || "bg-zinc-800 text-zinc-400") : "bg-zinc-800 text-zinc-400"

                  return (
                    <TableRow
                      key={lead.id}
                      onClick={() => {
                        setSelectedLead(lead)
                        setIsIntelOpen(true)
                      }}
                      className="border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-all group"
                    >
                      {/* Star */}
                      <TableCell className="w-10" onClick={e => toggleStar(lead, e)}>
                        <Star
                          className={cn(
                            "w-4 h-4 transition-all",
                            lead.starred
                              ? "fill-amber-400 text-amber-400"
                              : "text-zinc-700 group-hover:text-zinc-500"
                          )}
                        />
                      </TableCell>

                      {/* Kompanija */}
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-silver">
                            {lead.company_name || "—"}
                          </span>
                          {lead.niche && (
                            <span className="inline-flex w-fit px-1.5 py-0.5 rounded-full bg-white/5 border border-white/[0.06] text-[10px] text-zinc-500">
                              {lead.niche}
                            </span>
                          )}
                          {temp && (
                            <span className={cn(
                              "inline-flex w-fit px-1.5 py-0.5 rounded-full text-[10px] font-bold mt-0.5",
                              temp === "vreo" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
                            )}>
                              {temp === "vreo" ? "Vreo" : "Topao"}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Instagram */}
                      <TableCell className="w-[120px] hidden sm:table-cell">
                        {igHandle ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <Instagram className="w-3 h-3 text-pink-400" />
                              <span className="text-[12px] text-pink-400 font-medium">@{igHandle}</span>
                            </div>
                            {igFollowers != null && igFollowers > 0 && (
                              <span className="text-[10px] text-zinc-500">
                                {igFollowers.toLocaleString()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </TableCell>

                      {/* Usluga */}
                      <TableCell className="w-[150px] hidden md:table-cell" onClick={e => e.stopPropagation()}>
                        <ServiceCell lead={lead} onUpdate={handleServiceUpdate} />
                      </TableCell>

                      {/* Status */}
                      <TableCell className="w-[100px]">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
                          statusStyle
                        )}>
                          {lead.status || "—"}
                        </span>
                      </TableCell>

                      {/* Oglasi */}
                      <TableCell className="w-[80px] text-right hidden lg:table-cell">
                        <span className="text-sm text-zinc-400">
                          {activeAds != null ? activeAds : "—"}
                        </span>
                      </TableCell>

                      {/* Akcije */}
                      <TableCell className="w-[60px] text-center">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedLead(lead)
                            setIsIntelOpen(true)
                          }}
                          className="p-1.5 rounded-lg text-zinc-600 hover:text-emerald hover:bg-emerald/10 transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
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
