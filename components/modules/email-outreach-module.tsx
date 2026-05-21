"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, TrendingUp, CheckCircle, RefreshCw, BarChart3, Layout, Send, UserCheck, MessageSquare, X, Copy, Check, Star, Pencil, Linkedin, Instagram, Tag, Zap, Trash2, Eye, Phone } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence, Variants } from "framer-motion"
import { LeadIntelligenceViewer } from "@/components/dashboard/lead-intelligence-viewer"

interface EmailOutreachModuleProps {
  clientId: string
  tableName?: string
  useMockData?: boolean
}

interface EmailStats {
  total_sent: number
  replied: number
  meetings_booked: number
  no_response: number
  bounced: number
  opened: number
}

interface Lead {
  id: string
  ime: string
  email: string
  company_name: string
  niche: string
  service?: string
  status: string
  last_sent_at?: string
  email_draft?: string
  email_2_draft?: string
  email_1_poslat?: boolean
  email_2_poslat?: boolean
  meeting_time?: string
  meeting_link?: string
  izvor: string
  kategorija?: string
  prioritet_skor?: number
  website?: string
  comment?: string
  instagram_handle?: string
  starred?: boolean
  email_framework?: string
  created_at?: string
  client_id?: string
  replied_at?: string
  reply_snippet?: string
  reply_intent?: string
  email_opened_at?: string
  open_count?: number
  manual_contacts?: any[]
  bounced_at?: string
  niche_v2?: string
  subject_variant?: number
  demo_tenant_url?: string
  demo_tenant_email?: string
  demo_tenant_password?: string
  demo_built_at?: string
  intake_data?: {
    active_ads_count?: number
    enrichment?: {
      contact?: { email?: string; name?: string; title?: string; seniority?: string; linkedin?: string; source?: string }
      instagram_profile?: { username?: string; followers?: number; follower_count?: number; posts_count?: number }
      instagram_reels?: { views?: number; viewsCount?: number }[]
    }
  }
}

const tableVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" }
  }
}

const cardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.1,
      duration: 0.5,
      ease: "easeOut"
    }
  })
}

export function EmailOutreachModule({
  clientId,
  tableName = 'kontakti',
}: EmailOutreachModuleProps) {
  const [draftLead, setDraftLead] = useState<Lead | null>(null)
  const [draftVersion, setDraftVersion] = useState<'1' | '2'>('1')
  const [editingDraft, setEditingDraft] = useState<string | null>(null)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [intelLead, setIntelLead] = useState<Lead | null>(null)
  const [confirmRemoveLead, setConfirmRemoveLead] = useState<Lead | null>(null)
  const [copied, setCopied] = useState(false)
  const [selectedFramework, setSelectedFramework] = useState<'legacy' | '3-sentence'>('3-sentence')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<string>('')
  const [editingComment, setEditingComment] = useState<{ id: string; value: string } | null>(null)
  const [savingComment, setSavingComment] = useState(false)
  const [stats, setStats] = useState<EmailStats>({
    total_sent: 0,
    replied: 0,
    meetings_booked: 0,
    no_response: 0,
    bounced: 0,
    opened: 0,
  })
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchEmailStats = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('kontakti')
      .select('status, last_sent_at, meeting_time, replied_at, email_opened_at')
      .eq('client_id', clientId)
      .or('kategorija.neq.Disqualified,kategorija.is.null')

    if (error) {
      console.error('Error fetching email stats:', error)
      return
    }

    if (data) {
      const sentStatuses = ['Kontaktiran', 'Odgovorio', 'Zakazan Sastanak', 'Meeting Booked', 'Demo Zakazan']
      const total_sent = data.filter((l: any) => l.last_sent_at || sentStatuses.includes(l.status)).length
      const replied = data.filter((l: any) => (l as any).replied_at || l.status === 'Odgovorio').length
      const meetings_booked = data.filter((l: any) => l.status === 'Zakazan Sastanak' || l.status === 'Meeting Booked' || l.meeting_time).length
      const bounced = data.filter((l: any) => l.status === 'Bounced').length
      const opened = data.filter((l: any) => l.email_opened_at).length
      const no_response = data.filter((l: any) => (l.last_sent_at || l.status === 'Kontaktiran') && !(l as any).replied_at && l.status !== 'Zakazan Sastanak' && l.status !== 'Meeting Booked' && l.status !== 'Bounced').length

      setStats({ total_sent, replied, meetings_booked, no_response, bounced, opened })
    }
  }, [clientId])  // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('client_id', clientId)
      .or('kategorija.neq.Disqualified,kategorija.is.null')
      .order('prioritet_skor', { ascending: false })

    if (error || !data) {
      setLeads([])
    } else {
      setLeads(data)
    }
    setLoading(false)
  }, [clientId, tableName])

  useEffect(() => {
    if (clientId) {
      fetchEmailStats()
      fetchLeads()
    }
  }, [clientId, fetchEmailStats, fetchLeads])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchEmailStats(), fetchLeads()])
    setTimeout(() => setRefreshing(false), 800)
  }

  const filteredLeads = useMemo(() => {
    if (statusFilter === 'all') return leads
    if (statusFilter === 'starred') return leads.filter(l => l.starred)
    if (statusFilter === 'replied') return leads.filter(l => l.replied_at || l.status === 'Odgovorio')
    if (statusFilter === 'booked') return leads.filter(l => l.status === 'Zakazan Sastanak' || l.status === 'Meeting Booked')
    if (statusFilter === 'no_response') return leads.filter(l => (l.last_sent_at || l.status === 'Kontaktiran') && !l.replied_at && l.status !== 'Zakazan Sastanak' && l.status !== 'Meeting Booked')
    return leads.filter(l => l.status === statusFilter)
  }, [leads, statusFilter])

  const PIPELINE_STATUS_PILLS = [
    { status: 'Demo Izgrađen', label: 'demo izgrađen' },
    { status: 'Follow Up', label: 'follow up' },
    { status: 'enriched',  label: 'enriched'  },
    { status: 'No Draft',  label: 'no draft'  },
    { status: 'No Email',  label: 'no email'  },
    { status: 'Lost',      label: 'lost'      },
    { status: 'Bounced',   label: 'bounce'    },
  ]

  const handleCopyDraft = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleStar = async (lead: Lead) => {
    const supabase = createClient()
    const newVal = !lead.starred
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, starred: newVal } : l))
    await supabase.from('contacts').update({ starred: newVal }).eq('id', lead.id)
  }

  const handleServiceChange = async (lead: Lead, newService: string) => {
    const supabase = createClient()
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, service: newService } : l))
    await supabase.from('contacts').update({ service: newService }).eq('id', lead.id)
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)))
    }
  }

  const handleBulkStatusChange = async (newStatus: string) => {
    if (!newStatus || selectedIds.size === 0) return
    const supabase = createClient()
    const ids = Array.from(selectedIds)
    setLeads(prev => prev.map(l => selectedIds.has(l.id) ? { ...l, status: newStatus } : l))
    await supabase.from('contacts').update({ status: newStatus }).in('id', ids)
    setSelectedIds(new Set())
    setBulkStatus('')
  }

  const handleBulkStar = async (starred: boolean) => {
    if (selectedIds.size === 0) return
    const supabase = createClient()
    const ids = Array.from(selectedIds)
    setLeads(prev => prev.map(l => selectedIds.has(l.id) ? { ...l, starred } : l))
    await supabase.from('contacts').update({ starred }).in('id', ids)
    setSelectedIds(new Set())
  }

  const handleSaveComment = async () => {
    if (!editingComment) return
    setSavingComment(true)
    const supabase = createClient()
    await supabase.from('contacts').update({ comment: editingComment.value }).eq('id', editingComment.id)
    setLeads(prev => prev.map(l => l.id === editingComment.id ? { ...l, comment: editingComment.value } : l))
    setEditingComment(null)
    setSavingComment(false)
  }

  const handleSaveDraft = async () => {
    if (!draftLead || editingDraft === null) return
    setIsSavingDraft(true)
    const supabase = createClient()
    const updatePayload = draftVersion === '2'
      ? { email_2_draft: editingDraft }
      : { email_draft: editingDraft, email_framework: selectedFramework }
    await supabase.from('contacts').update(updatePayload).eq('id', draftLead.id)
    setLeads(prev => prev.map(l => l.id === draftLead.id ? { ...l, ...updatePayload } : l))
    setDraftLead(prev => prev ? { ...prev, ...updatePayload } : null)
    setEditingDraft(null)
    setIsSavingDraft(false)
  }

  const handleRemoveLead = async (lead: Lead) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('contacts')
      .update({ kategorija: 'Disqualified', status: 'Disqualified' })
      .eq('id', lead.id)
    if (error) {
      console.error('Disqualify failed:', error)
      alert(`Failed to disqualify lead: ${error.message}`)
      return
    }
    setLeads(prev => prev.filter(l => l.id !== lead.id))
  }

  return (
    <div className="space-y-10 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald/10 border border-emerald/20 flex items-center justify-center">
              <Mail className="w-6 h-6 text-emerald" />
            </div>
            <h2 className="text-4xl font-outfit font-bold text-silver tracking-tight">Email <span className="text-emerald">Master</span></h2>
            <Badge className="bg-emerald/10 text-emerald border-emerald/20 hover:bg-emerald/20 font-outfit">v5.0 Agency</Badge>
          </div>
          <p className="text-silver/60 font-outfit text-lg max-w-xl">
            Precision cold outreach engine. Automated personalization and lead conversion tracking.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          className={cn(
            "glass-button rounded-2xl h-14 px-8 border-emerald/20 text-silver font-outfit transition-all hover:border-emerald/40",
            refreshing && "opacity-50 pointer-events-none"
          )}
        >
          <RefreshCw className={cn("w-5 h-5 mr-3 text-emerald", refreshing && "animate-spin")} />
          Sync Outreach
        </Button>
      </div>

      {/* Glass Stat Prism */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
        {[
          { label: "Poslato", value: stats.total_sent, sub: "Emails delivered", icon: Send, color: "text-emerald" },
          { label: "Otvoreno", value: stats.opened, sub: stats.total_sent > 0 ? `${((stats.opened / Math.max(stats.total_sent - stats.bounced, 1)) * 100).toFixed(1)}% open rate` : "Tracking pixel", icon: Eye, color: "text-cyan-400" },
          { label: "Odgovorili", value: stats.replied, sub: stats.total_sent > 0 ? `${((stats.replied / Math.max(stats.total_sent - stats.bounced, 1)) * 100).toFixed(1)}% reply rate` : "No sends yet", icon: MessageSquare, color: "text-purple-400" },
          { label: "Zakazano", value: stats.meetings_booked, sub: "Meetings booked", icon: CheckCircle, color: "text-emerald-400" },
          { label: "Bounce", value: stats.bounced, sub: stats.total_sent > 0 ? `${((stats.bounced / stats.total_sent) * 100).toFixed(1)}% bounce rate` : "No sends yet", icon: UserCheck, color: "text-red-400" },
        ].map((item, i) => (
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
                  <div className={cn("w-10 h-10 rounded-xl bg-obsidian/60 border border-emerald/10 flex items-center justify-center", item.color)}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <TrendingUp className="w-4 h-4 text-emerald/40" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <p className="text-xs font-outfit font-medium text-silver/40 uppercase tracking-widest">{item.label}</p>
                  <h3 className={cn("font-outfit font-bold text-silver", typeof item.value === 'string' ? "text-2xl text-silver/40" : "text-3xl")}>{item.value}</h3>
                  <p className="text-xs font-outfit text-emerald/60">{item.sub}</p>
                </div>
              </CardContent>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BarChart3 className="w-16 h-16 text-emerald" />
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div>
        {/* Main Leads Prism */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={tableVariants}
          className="space-y-6"
        >
          <div className="glass-card border-emerald/10 bg-obsidian/40 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden">
            <div className="p-8 border-b border-emerald/5 bg-gradient-to-r from-emerald/5 to-transparent">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <CardTitle className="text-2xl font-outfit font-bold text-silver">Outreach Stream</CardTitle>
                  <CardDescription className="text-silver/40 font-outfit">{leads.length} leads · sorted by priority score</CardDescription>
                </div>
                <Layout className="w-6 h-6 text-emerald/40" />
              </div>
              {/* Status filter pills */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={cn("px-3 py-1 rounded-full text-xs font-outfit transition-all", statusFilter === 'all' ? 'bg-emerald text-obsidian font-bold' : 'bg-emerald/10 text-silver/50 hover:bg-emerald/20')}
                >all ({leads.length})</button>
                <button
                  onClick={() => setStatusFilter('starred')}
                  className={cn("px-3 py-1 rounded-full text-xs font-outfit transition-all flex items-center gap-1", statusFilter === 'starred' ? 'bg-amber-400 text-obsidian font-bold' : 'bg-amber-400/10 text-amber-400/70 hover:bg-amber-400/20')}
                ><Star className="w-3 h-3" /> starred ({leads.filter(l => l.starred).length})</button>
                <button
                  onClick={() => setStatusFilter('replied')}
                  className={cn("px-3 py-1 rounded-full text-xs font-outfit transition-all flex items-center gap-1", statusFilter === 'replied' ? 'bg-purple-500 text-white font-bold' : 'bg-purple-500/10 text-purple-400/70 hover:bg-purple-500/20')}
                >odgovorili ({leads.filter(l => l.replied_at || l.status === 'Odgovorio').length})</button>
                <button
                  onClick={() => setStatusFilter('booked')}
                  className={cn("px-3 py-1 rounded-full text-xs font-outfit transition-all", statusFilter === 'booked' ? 'bg-amber-400 text-obsidian font-bold' : 'bg-amber-400/10 text-amber-400/70 hover:bg-amber-400/20')}
                >zakazali ({leads.filter(l => l.status === 'Zakazan Sastanak' || l.status === 'Meeting Booked').length})</button>
                <button
                  onClick={() => setStatusFilter('no_response')}
                  className={cn("px-3 py-1 rounded-full text-xs font-outfit transition-all", statusFilter === 'no_response' ? 'bg-silver/30 text-obsidian font-bold' : 'bg-silver/5 text-silver/40 hover:bg-silver/10')}
                >bez odgovora ({leads.filter(l => (l.last_sent_at || l.status === 'Kontaktiran') && !l.replied_at && l.status !== 'Zakazan Sastanak' && l.status !== 'Meeting Booked').length})</button>
                {PIPELINE_STATUS_PILLS.map(({ status, label }) => {
                  const count = leads.filter(l => l.status === status).length
                  if (count === 0) return null
                  return (
                    <button key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn("px-3 py-1 rounded-full text-xs font-outfit transition-all", statusFilter === status ? 'bg-emerald text-obsidian font-bold' : 'bg-emerald/10 text-silver/50 hover:bg-emerald/20')}
                    >{label} ({count})</button>
                  )
                })}
              </div>
            </div>

            {/* Bulk Action Bar */}
            <AnimatePresence>
              {selectedIds.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-3 px-8 py-3 bg-emerald/5 border-b border-emerald/10"
                >
                  <span className="text-xs font-outfit text-emerald font-semibold">{selectedIds.size} selected</span>
                  <div className="flex items-center gap-2 ml-2">
                    <select
                      value={bulkStatus}
                      onChange={e => setBulkStatus(e.target.value)}
                      className="text-[10px] font-outfit bg-obsidian/60 border border-emerald/20 rounded-lg px-2 py-1 text-silver/70 outline-none focus:border-emerald/50"
                    >
                      <option value="">Set status...</option>
                      <option value="Sent">Sent</option>
                      <option value="enriched">Enriched</option>
                      <option value="Meeting Booked">Meeting Booked</option>
                      <option value="Not Interested">Not Interested</option>
                    </select>
                    <button
                      onClick={() => handleBulkStatusChange(bulkStatus)}
                      disabled={!bulkStatus}
                      className="text-[10px] font-outfit px-3 py-1 rounded-lg bg-emerald/10 border border-emerald/20 text-emerald hover:bg-emerald/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                    >
                      <Tag className="w-3 h-3" />
                      Apply
                    </button>
                    <button
                      onClick={() => handleBulkStar(true)}
                      className="text-[10px] font-outfit px-3 py-1 rounded-lg bg-amber-400/10 border border-amber-400/20 text-amber-400 hover:bg-amber-400/20 transition-colors flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" />
                      Star all
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="ml-auto text-silver/30 hover:text-silver/60 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-20 text-center space-y-4">
                  <RefreshCw className="w-10 h-10 text-emerald animate-spin mx-auto" />
                  <p className="text-silver/40 font-outfit italic">Decrypting outreach data...</p>
                </div>
              ) : leads.length === 0 ? (
                <div className="p-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald/5 border border-emerald/10 flex items-center justify-center mx-auto">
                    <Mail className="w-8 h-8 text-emerald/20" />
                  </div>
                  <p className="text-silver/40 font-outfit">No active outreach leads detected.</p>
                </div>
              ) : (
                <Table className="border-collapse">
                  <TableHeader>
                    <TableRow className="border-emerald/5 hover:bg-transparent">
                      <TableHead className="pl-4 w-8">
                        <button onClick={handleSelectAll} className="w-4 h-4 rounded border border-emerald/30 flex items-center justify-center bg-obsidian/40 hover:border-emerald/60 transition-colors">
                          {selectedIds.size === filteredLeads.length && filteredLeads.length > 0
                            ? <Check className="w-2.5 h-2.5 text-emerald" />
                            : selectedIds.size > 0
                            ? <div className="w-2 h-0.5 bg-emerald/60 rounded" />
                            : null}
                        </button>
                      </TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest w-8"></TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest min-w-[160px]">Company</TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest min-w-[140px]">Contact</TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest min-w-[120px]">Instagram</TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest">Service</TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest">Status</TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest min-w-[140px]">Odgovor</TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest">Intel</TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest pr-8 text-right">Draft</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {filteredLeads.map((lead, idx) => (
                        <motion.tr
                          key={lead.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className={cn("group border-emerald/5 hover:bg-emerald/[0.03] transition-colors", selectedIds.has(lead.id) && "bg-emerald/[0.05]")}
                        >
                          <TableCell className="py-4 pl-4 w-8">
                            <button
                              onClick={() => handleToggleSelect(lead.id)}
                              className="w-4 h-4 rounded border border-emerald/30 flex items-center justify-center bg-obsidian/40 hover:border-emerald/60 transition-colors"
                            >
                              {selectedIds.has(lead.id) && <Check className="w-2.5 h-2.5 text-emerald" />}
                            </button>
                          </TableCell>
                          <TableCell className="py-4 w-8">
                            <button
                              onClick={() => handleToggleStar(lead)}
                              className="transition-all hover:scale-110"
                            >
                              <Star className={cn(
                                "w-4 h-4 transition-colors",
                                lead.starred ? "fill-amber-400 text-amber-400" : "text-silver/20 hover:text-amber-400/60"
                              )} />
                            </button>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-outfit font-semibold text-silver text-sm">{lead.company_name || lead.ime}</span>
                                {lead.email_opened_at && (
                                  <span title={`Opened — ${(lead.open_count || 1)}× total`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[9px] font-bold uppercase tracking-widest">
                                    <Eye className="w-2.5 h-2.5" />{lead.open_count && lead.open_count > 1 ? lead.open_count : ''}
                                  </span>
                                )}
                                {lead.manual_contacts && lead.manual_contacts.length > 0 && (
                                  <span title={`${lead.manual_contacts.length} off-channel touches (phone/whatsapp/etc)`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-[9px] font-bold uppercase tracking-widest">
                                    <Phone className="w-2.5 h-2.5" />{lead.manual_contacts.length}
                                  </span>
                                )}
                              </div>
                              {/* Comment row */}
                              {editingComment?.id === lead.id ? (
                                <div className="flex items-center gap-1 mt-1">
                                  <input
                                    autoFocus
                                    value={editingComment.value}
                                    onChange={e => setEditingComment({ id: lead.id, value: e.target.value })}
                                    onKeyDown={e => { if (e.key === 'Enter') handleSaveComment(); if (e.key === 'Escape') setEditingComment(null); }}
                                    className="text-[10px] font-outfit bg-obsidian/60 border border-emerald/20 rounded px-2 py-0.5 text-silver/80 w-40 outline-none focus:border-emerald/50"
                                    placeholder="Add note..."
                                  />
                                  <button onClick={handleSaveComment} disabled={savingComment} className="text-emerald/70 hover:text-emerald">
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => setEditingComment(null)} className="text-silver/30 hover:text-silver/60">
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 mt-0.5 group/comment">
                                  {lead.comment && <span className="text-[10px] font-outfit text-silver/40 italic truncate max-w-[160px]">{lead.comment}</span>}
                                  <button
                                    onClick={() => setEditingComment({ id: lead.id, value: lead.comment || '' })}
                                    className={cn("transition-opacity", lead.comment ? "opacity-0 group-hover/comment:opacity-100" : "opacity-0 group-hover/comment:opacity-60")}
                                  >
                                    <Pencil className="w-2.5 h-2.5 text-silver/40" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          {/* Contact column */}
                          <TableCell className="py-4">
                            {(() => {
                              const contact = lead.intake_data?.enrichment?.contact
                              const email = contact?.email || lead.email || null
                              const name = contact?.name || null
                              const title = contact?.title || null
                              const linkedin = contact?.linkedin || null
                              if (!email && !name) return <span className="text-silver/20 text-xs font-outfit">—</span>
                              return (
                                <div className="flex flex-col gap-0.5">
                                  {name && <span className="text-sm font-outfit font-medium text-silver">{name}</span>}
                                  {title && <span className="text-[10px] font-outfit text-silver/50 uppercase tracking-wide">{title}</span>}
                                  {email && (
                                    <span className="text-xs font-outfit text-silver/60">{email}</span>
                                  )}
                                  {linkedin && (
                                    <a
                                      href={linkedin}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors font-outfit mt-0.5"
                                    >
                                      <Linkedin className="w-3 h-3" />
                                      LinkedIn
                                    </a>
                                  )}
                                </div>
                              )
                            })()}
                          </TableCell>
                          {/* IG signal column */}
                          <TableCell className="py-4">
                            {(() => {
                              const igPr = lead.intake_data?.enrichment?.instagram_profile
                              const igReels = lead.intake_data?.enrichment?.instagram_reels || []
                              const followers = igPr?.followers || igPr?.follower_count || 0
                              const handle = igPr?.username || (lead as any).instagram_handle || (lead.intake_data as any)?.instagram_handle || null
                              if (!followers && !handle) return <span className="text-silver/20 text-xs font-outfit">—</span>
                              return (
                                <div className="flex flex-col gap-0.5">
                                  {handle && (
                                    <a
                                      href={`https://instagram.com/${handle}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-xs text-pink-400/80 hover:text-pink-400 transition-colors font-outfit"
                                    >
                                      <Instagram className="w-3 h-3" />
                                      @{handle}
                                    </a>
                                  )}
                                  {followers > 0 && (
                                    <span className="text-[10px] font-outfit text-silver/50">
                                      {followers >= 1000 ? `${(followers / 1000).toFixed(1)}k` : followers} followers
                                    </span>
                                  )}
                                  {igReels.length > 0 && (
                                    <span className="text-[10px] font-outfit text-silver/40">{igReels.length} reels</span>
                                  )}
                                </div>
                              )
                            })()}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const active = (lead.service || 'social_media_system').split(',').map(s => s.trim()).filter(Boolean)
                              const SERVICES = [
                                { key: 'social_media_system', label: 'SMS', color: 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20' },
                                { key: 'ai_organic_content',  label: 'AIO', color: 'bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20' },
                                { key: 'ai_sales_systems',    label: 'AIS', color: 'bg-orange-500/10 border-orange-500/30 text-orange-300 hover:bg-orange-500/20' },
                              ]
                              const toggle = (key: string) => {
                                const next = active.includes(key)
                                  ? active.filter(s => s !== key)
                                  : [...active, key]
                                const val = next.length ? next.join(',') : 'social_media_system'
                                handleServiceChange(lead, val)
                              }
                              return (
                                <div className="flex flex-col gap-1">
                                  {SERVICES.map(s => (
                                    <button
                                      key={s.key}
                                      onClick={() => toggle(s.key)}
                                      className={cn(
                                        "text-[10px] font-outfit font-semibold rounded-full px-2 py-0.5 border transition-all text-left",
                                        active.includes(s.key)
                                          ? s.color
                                          : "bg-transparent border-white/5 text-silver/20 hover:border-white/15 hover:text-silver/40"
                                      )}
                                    >
                                      {s.label}
                                    </button>
                                  ))}
                                </div>
                              )
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  lead.status === 'enriched' || lead.status === 'Enriched' ? 'bg-emerald shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                  lead.status === 'Demo Izgrađen' ? 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]' :
                                  lead.status === 'Kontaktiran' ? 'bg-blue-400 shadow-[0_0_6px_rgba(96,165,250,0.4)]' :
                                  lead.status === 'Odgovorio' ? 'bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.4)]' :
                                  lead.status === 'Meeting Booked' || lead.status === 'Zakazan Sastanak' ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.4)]' :
                                  'bg-silver/20'
                                )} />
                                <span className="font-outfit text-xs text-silver/70">{lead.status}</span>
                              </div>
                              {/* Email sequence progress — only visible for contacted leads */}
                              {(lead.email_1_poslat || lead.email_draft) && (
                                <div className="flex items-center gap-0.5 pl-0.5" title={
                                  `E1: ${lead.email_1_poslat ? 'sent' : 'draft'} · E2: ${lead.email_2_poslat ? 'sent' : lead.email_2_draft ? 'ready' : '—'}`
                                }>
                                  {/* E1 */}
                                  <div className={cn(
                                    "h-1 w-5 rounded-full transition-all",
                                    lead.email_1_poslat ? "bg-sky-400 shadow-[0_0_4px_rgba(56,189,248,0.6)]" : "bg-white/10"
                                  )} />
                                  {/* E2 */}
                                  <div className={cn(
                                    "h-1 w-5 rounded-full transition-all",
                                    lead.email_2_poslat ? "bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.6)]" :
                                    lead.email_2_draft  ? "bg-amber-400/35 border border-amber-400/40" :
                                    "bg-white/10"
                                  )} />
                                  {/* E3 placeholder */}
                                  <div className="h-1 w-5 rounded-full bg-white/[0.05]" />
                                  {lead.email_2_draft && !lead.email_2_poslat && (
                                    <span className="text-[8px] font-outfit text-amber-400/50 ml-0.5 leading-none">ready</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {lead.replied_at ? (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.5)]" />
                                  <span className="text-[10px] font-outfit text-purple-400/80">
                                    {(() => {
                                      const diff = Date.now() - new Date(lead.replied_at).getTime()
                                      const h = Math.floor(diff / 3600000)
                                      const d = Math.floor(diff / 86400000)
                                      if (d >= 1) return `pre ${d}d`
                                      if (h >= 1) return `pre ${h}h`
                                      return 'malopre'
                                    })()}
                                  </span>
                                </div>
                                {lead.reply_snippet && (
                                  <span
                                    className="text-[10px] font-outfit text-silver/40 italic truncate max-w-[130px]"
                                    title={lead.reply_snippet}
                                  >
                                    {lead.reply_snippet.substring(0, 60)}{lead.reply_snippet.length > 60 ? '…' : ''}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-silver/20 text-xs font-outfit">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => setIntelLead(lead)}
                              className={cn(
                                "flex items-center gap-1.5 text-[10px] font-outfit px-2.5 py-1 rounded-lg border transition-all",
                                lead.intake_data?.enrichment
                                  ? "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20"
                                  : "bg-white/[0.03] border-white/5 text-silver/20 hover:text-silver/40"
                              )}
                            >
                              <Zap className="w-3 h-3" />
                              {lead.intake_data?.enrichment ? "View" : "—"}
                            </button>
                          </TableCell>
                          <TableCell className="pr-8 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {lead.email_1_poslat && !lead.email_2_poslat && lead.email_2_draft ? (
                                /* Follow-up ready state */
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost" size="sm"
                                    onClick={() => { setDraftVersion('2'); setDraftLead(lead) }}
                                    className="text-amber-400 hover:bg-amber-400/10 border border-amber-400/20 bg-amber-400/5 rounded-xl text-xs font-outfit gap-1.5"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                    Follow-up
                                  </Button>
                                  <button
                                    onClick={() => { setDraftVersion('1'); setDraftLead(lead) }}
                                    className="text-[9px] font-outfit text-silver/25 hover:text-silver/50 px-1.5 py-1 rounded-lg hover:bg-white/5 transition-all"
                                    title="View original Email 1"
                                  >
                                    E1
                                  </button>
                                </div>
                              ) : lead.email_draft ? (
                                <Button
                                  variant="ghost" size="sm"
                                  onClick={() => { setDraftVersion('1'); setDraftLead(lead) }}
                                  className="text-emerald hover:bg-emerald/10 rounded-xl text-xs font-outfit gap-1.5"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  View Draft
                                </Button>
                              ) : (
                                <span className="text-silver/20 text-xs font-outfit">no draft</span>
                              )}
                              <button
                                onClick={() => setConfirmRemoveLead(lead)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-silver/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg p-1"
                                title="Disqualify lead"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
        </motion.div>

      </div>

      {/* Confirm Remove Dialog */}
      <Dialog open={!!confirmRemoveLead} onOpenChange={() => setConfirmRemoveLead(null)}>
        <DialogContent className="max-w-sm bg-obsidian/95 border-red-500/20 backdrop-blur-2xl rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="font-outfit text-silver text-lg flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-400" />
              Disqualify Lead?
            </DialogTitle>
          </DialogHeader>
          <p className="font-outfit text-silver/60 text-sm mt-1">
            <span className="text-silver font-semibold">{confirmRemoveLead?.company_name}</span> will be permanently deleted from the database.
          </p>
          <div className="flex gap-3 mt-4">
            <Button
              variant="ghost"
              className="flex-1 font-outfit text-silver/60 hover:text-silver border border-white/10 rounded-xl"
              onClick={() => setConfirmRemoveLead(null)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 font-outfit bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl"
              onClick={() => { handleRemoveLead(confirmRemoveLead!); setConfirmRemoveLead(null) }}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lead Intelligence Dialog */}
      <LeadIntelligenceViewer
        lead={intelLead}
        isOpen={!!intelLead}
        onClose={() => setIntelLead(null)}
      />

      {/* Email Draft Dialog */}
      <Dialog open={!!draftLead} onOpenChange={() => { setDraftLead(null); setEditingDraft(null); setCopied(false) }}>
        <DialogContent className="max-w-3xl bg-obsidian/95 border-emerald/20 backdrop-blur-2xl rounded-[2rem] max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl">
          {/* Custom Header */}
          <div className="p-8 border-b border-white/5 bg-gradient-to-r from-emerald/5 to-transparent shrink-0">
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <DialogTitle className="font-outfit text-silver text-2xl font-bold flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    draftVersion === '2' ? "bg-amber-400/10" : "bg-emerald/10"
                  )}>
                    <Mail className={cn("w-5 h-5", draftVersion === '2' ? "text-amber-400" : "text-emerald")} />
                  </div>
                  {draftLead?.company_name || draftLead?.ime}
                </DialogTitle>
                <div className="flex items-center gap-3 text-silver/40 text-sm">
                  {draftLead?.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {draftLead.email}</span>}
                  {draftLead?.instagram_handle && (
                    <a href={`https://instagram.com/${draftLead.instagram_handle}`} target="_blank" rel="noopener noreferrer" className="text-pink-400/60 hover:text-pink-400 transition-colors flex items-center gap-1.5">
                      <Instagram className="w-3.5 h-3.5" /> @{draftLead.instagram_handle}
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="flex gap-2">
                  {draftLead?.service?.split(',').map(s => s.trim()).filter(Boolean).map(svc => (
                    <Badge key={svc} variant="outline" className={cn(
                      "font-outfit text-[10px] uppercase tracking-widest border-emerald/20 bg-emerald/5 text-emerald/70",
                      svc === 'ai_sales_systems' && "border-orange-500/20 bg-orange-500/5 text-orange-400/80",
                      svc === 'ai_organic_content' && "border-green-500/20 bg-green-500/5 text-green-400/80"
                    )}>
                      {svc === 'ai_sales_systems' ? 'AIS' : svc === 'ai_organic_content' ? 'AIO' : 'SMS'}
                    </Badge>
                  ))}
                </div>
                {/* Version tabs — only shown when a follow-up draft exists */}
                {draftLead?.email_2_draft && (
                  <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
                    <button
                      onClick={() => { setEditingDraft(null); setDraftVersion('1') }}
                      className={cn(
                        "text-[10px] font-outfit font-semibold px-3 py-1 rounded-lg transition-all",
                        draftVersion === '1'
                          ? "bg-sky-400/15 text-sky-400 border border-sky-400/30"
                          : "text-silver/30 hover:text-silver/60"
                      )}
                    >
                      Email 1
                    </button>
                    <button
                      onClick={() => { setEditingDraft(null); setDraftVersion('2') }}
                      className={cn(
                        "text-[10px] font-outfit font-semibold px-3 py-1 rounded-lg transition-all flex items-center gap-1",
                        draftVersion === '2'
                          ? "bg-amber-400/15 text-amber-400 border border-amber-400/30"
                          : "text-silver/30 hover:text-silver/60"
                      )}
                    >
                      Follow-up
                      {!draftLead?.email_2_poslat && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {(() => {
            const activeDraft = draftVersion === '2' ? draftLead?.email_2_draft : draftLead?.email_draft
            return (
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {/* Subject Line Display */}
                <div className="space-y-2">
                  <label className="text-[10px] font-outfit uppercase tracking-widest text-silver/30 pl-1">Subject Line</label>
                  <div className={cn(
                    "p-4 border rounded-2xl font-outfit text-silver/80 text-sm italic",
                    draftVersion === '2' ? "bg-amber-400/5 border-amber-400/10" : "bg-obsidian/60 border-white/5"
                  )}>
                    {activeDraft?.match(/^Subject:\s*(.*)$/m)?.[1] || "No subject detected"}
                  </div>
                </div>

                {/* Content Area */}
                <div className="space-y-2 group">
                  <div className="flex justify-between items-center pl-1">
                    <label className="text-[10px] font-outfit uppercase tracking-widest text-silver/30">Email Body</label>
                    {!editingDraft && (
                      <button
                        onClick={() => {
                          setEditingDraft(activeDraft || '')
                          if (draftVersion === '1') {
                            const fw = draftLead?.email_framework
                            setSelectedFramework(fw === 'legacy' || fw === '3-sentence' ? fw : '3-sentence')
                          }
                        }}
                        className={cn(
                          "flex items-center gap-1.5 text-[10px] transition-colors uppercase tracking-widest font-bold",
                          draftVersion === '2'
                            ? "text-amber-400/60 hover:text-amber-400"
                            : "text-emerald/60 hover:text-emerald"
                        )}
                      >
                        <Pencil className="w-3 h-3" /> Edit Draft
                      </button>
                    )}
                  </div>

                  {editingDraft !== null ? (
                    <div className="space-y-4">
                      {draftVersion === '1' && (
                        <div className="flex gap-4 mb-2">
                          <button
                            onClick={() => setSelectedFramework('3-sentence')}
                            className={cn("text-xs px-4 py-2 rounded-xl transition-colors font-outfit font-medium border", selectedFramework === '3-sentence' ? "bg-emerald/20 border-emerald/50 text-emerald" : "bg-obsidian border-white/10 text-silver/60 hover:text-white")}
                          >
                            3-Sentence Framework (B-C-O)
                          </button>
                          <button
                            onClick={() => setSelectedFramework('legacy')}
                            className={cn("text-xs px-4 py-2 rounded-xl transition-colors font-outfit font-medium border", selectedFramework === 'legacy' ? "bg-emerald/20 border-emerald/50 text-emerald" : "bg-obsidian border-white/10 text-silver/60 hover:text-white")}
                          >
                            Legacy Framework
                          </button>
                        </div>
                      )}

                      {draftVersion === '1' && selectedFramework === '3-sentence' && (
                        <div className="bg-emerald/5 border border-emerald/20 p-4 rounded-xl space-y-2 text-xs text-silver/80">
                          <p className="font-bold text-emerald">3-Sentence B-C-O Framework Guide:</p>
                          <ul className="list-disc pl-4 space-y-1">
                            <li><span className="text-white">Sentence 1 (Buyer):</span> Call out their identity/niche/role implicitly. Focus on context, not general traits.</li>
                            <li><span className="text-white">Sentence 2 (Constraint):</span> Define the exact structural problem creating the gap.</li>
                            <li><span className="text-white">Sentence 3 (Outcome):</span> Explain how your system bypasses the constraint to make the outcome inevitable. Suggest a quick chat.</li>
                          </ul>
                        </div>
                      )}

                      <textarea
                        autoFocus
                        value={editingDraft}
                        onChange={(e) => setEditingDraft(e.target.value)}
                        className={cn(
                          "w-full h-[400px] rounded-2xl p-6 font-mono text-xs text-silver/90 outline-none resize-none leading-relaxed bg-obsidian/60 border",
                          draftVersion === '2'
                            ? "border-amber-400/20 focus:border-amber-400/50"
                            : "border-emerald/20 focus:border-emerald/50"
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingDraft(null)} className="text-silver/40 hover:text-silver/60 rounded-xl">
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveDraft}
                          disabled={isSavingDraft}
                          className={cn(
                            "font-bold rounded-xl px-6",
                            draftVersion === '2'
                              ? "bg-amber-400 text-obsidian hover:bg-amber-300"
                              : "bg-emerald text-obsidian"
                          )}
                        >
                          {isSavingDraft ? <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" /> : <Check className="w-3.5 h-3.5 mr-2" />}
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative group/content">
                      <pre className={cn(
                        "whitespace-pre-wrap font-mono text-xs text-silver/70 border rounded-2xl p-6 leading-relaxed min-h-[300px]",
                        draftVersion === '2' ? "bg-amber-400/[0.03] border-amber-400/10" : "bg-obsidian/60 border-white/5"
                      )}>
                        {activeDraft?.replace(/^Subject:.*$/m, '').trim() || 'No body content available.'}
                      </pre>
                      <div className="absolute top-4 right-4 opacity-0 group-hover/content:opacity-100 transition-opacity flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyDraft(activeDraft || '')}
                          className={cn(
                            "bg-obsidian/80 rounded-xl",
                            draftVersion === '2'
                              ? "border-amber-400/20 hover:border-amber-400/40 text-amber-400"
                              : "border-emerald/20 hover:border-emerald/40 text-emerald"
                          )}
                        >
                          {copied ? <Check className="w-3.5 h-3.5 mr-2" /> : <Copy className="w-3.5 h-3.5 mr-2" />}
                          {copied ? 'Copied' : 'Copy Full Text'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Footer Actions */}
          <div className="p-8 border-t border-white/5 bg-obsidian/80 shrink-0 flex justify-between items-center">
             <div className="flex items-center gap-4 text-silver/20 text-xs italic font-outfit">
               <Zap className="w-3.5 h-3.5" />
               Drafted by SmartFlow AI System
             </div>
             <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => { setDraftLead(null); setEditingDraft(null); setCopied(false) }}
                  className="rounded-xl border-white/10 text-silver/60 font-outfit px-8 py-6"
                >
                  Close
                </Button>
                {!editingDraft && (
                  <Button
                    className="rounded-xl bg-gradient-to-r from-emerald to-emerald/80 hover:brightness-110 text-obsidian font-outfit font-bold px-10 py-6 shadow-lg shadow-emerald/10"
                    onClick={() => {
                      // Logic for sending will be implemented next
                      alert('Preparing transmission... System verification required.');
                    }}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Ready to Send
                  </Button>
                )}
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
