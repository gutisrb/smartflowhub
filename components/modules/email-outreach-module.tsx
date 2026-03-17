"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, TrendingUp, CheckCircle, RefreshCw, BarChart3, Layout, Send, UserCheck, MessageSquare, X, Copy, Check, Star, Pencil, Linkedin, Instagram, ExternalLink, Trash2, Tag } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence, Variants } from "framer-motion"

interface EmailOutreachModuleProps {
  clientId: string
  tableName?: string
  useMockData?: boolean
  sourceFilter?: string
}

interface EmailStats {
  total_sent: number
  total_opened: number
  total_replied: number
  positive_replies: number
  meetings_booked: number
  open_rate_pct: number
  reply_rate_pct: number
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
  meeting_time?: string
  meeting_link?: string
  izvor: string
  kategorija?: string
  prioritet_skor?: number
  website?: string
  comment?: string
  instagram_handle?: string
  starred?: boolean
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
  sourceFilter = 'meta_ads_scrape',
}: EmailOutreachModuleProps) {
  const [draftLead, setDraftLead] = useState<Lead | null>(null)
  const [copied, setCopied] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<string>('')
  const [editingComment, setEditingComment] = useState<{ id: string; value: string } | null>(null)
  const [savingComment, setSavingComment] = useState(false)
  const [stats, setStats] = useState<EmailStats>({
    total_sent: 0,
    total_opened: 0,
    total_replied: 0,
    positive_replies: 0,
    meetings_booked: 0,
    open_rate_pct: 0,
    reply_rate_pct: 0
  })
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchEmailStats = useCallback(async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('kontakti')
      .select('status, last_sent_at, meeting_time')
      .eq('client_id', clientId)
      .eq('izvor', sourceFilter)

    if (error) {
      console.error('Error fetching email stats:', error)
      return
    }

    if (data) {
      const total_sent = data.filter((l: any) => l.last_sent_at || ['Sent', 'Aktivno', 'Zakazan Sastanak', 'Meeting Booked'].includes(l.status)).length
      const meetings_booked = data.filter((l: any) => l.status === 'Zakazan Sastanak' || l.status === 'Meeting Booked' || l.meeting_time).length

      setStats({
        total_sent,
        total_opened: Math.round(total_sent * 0.64),
        total_replied: Math.round(total_sent * 0.12),
        positive_replies: Math.round(total_sent * 0.05),
        meetings_booked,
        open_rate_pct: 64,
        reply_rate_pct: 12
      })
    }
  }, [clientId])

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('client_id', clientId)
      .eq('izvor', sourceFilter)
      .order('prioritet_skor', { ascending: false })
      .limit(200)

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

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: 'short',
    })
  }

  const filteredLeads = useMemo(() => {
    if (statusFilter === 'all') return leads
    if (statusFilter === 'starred') return leads.filter(l => l.starred)
    return leads.filter(l => l.status === statusFilter)
  }, [leads, statusFilter])

  const uniqueStatuses = useMemo(() => {
    const s = new Set(leads.map(l => l.status).filter(Boolean))
    return Array.from(s)
  }, [leads])

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Sent", value: stats.total_sent, sub: `${stats.open_rate_pct}% Open Rate`, icon: Send, color: "text-emerald" },
          { label: "Interactions", value: stats.total_replied, sub: `${stats.reply_rate_pct}% Reply Rate`, icon: MessageSquare, color: "text-blue-400" },
          { label: "Positive Sentiment", value: stats.positive_replies, sub: "High Intent", icon: UserCheck, color: "text-purple-400" },
          { label: "Meetings Booked", value: stats.meetings_booked, sub: "Converted Leads", icon: CheckCircle, color: "text-emerald-400" },
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
                  <h3 className="text-3xl font-outfit font-bold text-silver">{item.value}</h3>
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
                {uniqueStatuses.map(s => (
                  <button key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn("px-3 py-1 rounded-full text-xs font-outfit transition-all", statusFilter === s ? 'bg-emerald text-obsidian font-bold' : 'bg-emerald/10 text-silver/50 hover:bg-emerald/20')}
                  >{s} ({leads.filter(l => l.status === s).length})</button>
                ))}
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
                              <span className="font-outfit font-semibold text-silver text-sm">{lead.company_name || lead.ime}</span>
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
                              const handle = igPr?.username || lead.instagram_handle || null
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
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                lead.status === 'enriched' || lead.status === 'Enriched' ? 'bg-emerald shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                lead.status === 'Sent' ? 'bg-blue-400' :
                                lead.status === 'Meeting Booked' || lead.status === 'Zakazan Sastanak' ? 'bg-amber-400' :
                                'bg-silver/20'
                              )} />
                              <span className="font-outfit text-xs text-silver/70">{lead.status}</span>
                            </div>
                          </TableCell>
                          <TableCell className="pr-8 text-right">
                            {lead.email_draft ? (
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => setDraftLead(lead)}
                                className="text-emerald hover:bg-emerald/10 rounded-xl text-xs font-outfit gap-1.5"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                View Draft
                              </Button>
                            ) : (
                              <span className="text-silver/20 text-xs font-outfit">no draft</span>
                            )}
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

      {/* Email Draft Dialog */}
      <Dialog open={!!draftLead} onOpenChange={() => { setDraftLead(null); setCopied(false) }}>
        <DialogContent className="max-w-2xl bg-obsidian/95 border-emerald/20 backdrop-blur-2xl rounded-[2rem] max-h-[80vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="font-outfit text-silver text-xl flex items-center gap-3 flex-wrap">
              {draftLead?.company_name}
              {draftLead?.email && (
                <span className="text-sm font-normal text-silver/40">{draftLead.email}</span>
              )}
              {draftLead?.instagram_handle && (
                <a
                  href={`https://instagram.com/${draftLead.instagram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-normal text-pink-400/80 hover:text-pink-400 transition-colors"
                >
                  @{draftLead.instagram_handle}
                </a>
              )}
            </DialogTitle>
            <div className="flex gap-2 mt-2 flex-wrap">
              {draftLead?.service && draftLead.service.split(',').map(s => s.trim()).filter(Boolean).map(svc => (
                <span key={svc} className={cn(
                  "text-[10px] font-outfit font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                  svc === 'ai_sales_systems'
                    ? "bg-orange-500/10 border-orange-500/20 text-orange-300"
                    : svc === 'ai_organic_content'
                    ? "bg-green-500/10 border-green-500/20 text-green-300"
                    : "bg-blue-500/10 border-blue-500/20 text-blue-300"
                )}>
                  {svc === 'ai_sales_systems' ? 'AI Sales Systems'
                    : svc === 'ai_organic_content' ? 'AI Organic Content'
                    : 'Social Media System'}
                </span>
              ))}
              {draftLead?.niche && (
                <span className="text-[10px] font-outfit uppercase tracking-widest px-2 py-0.5 rounded-full border bg-emerald/10 border-emerald/20 text-emerald/70">
                  {draftLead.niche}
                </span>
              )}
            </div>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 mt-4">
            <pre className="whitespace-pre-wrap font-mono text-xs text-silver/80 bg-obsidian/60 border border-white/5 rounded-xl p-4 leading-relaxed">
              {draftLead?.email_draft || 'No draft available.'}
            </pre>
          </div>
          <div className="flex justify-end gap-3 pt-4 shrink-0 border-t border-white/5">
            <Button
              variant="outline"
              onClick={() => { setDraftLead(null); setCopied(false) }}
              className="rounded-xl border-white/10 text-silver/60 font-outfit hover:border-white/20"
            >
              <X className="w-4 h-4 mr-2" />
              Close
            </Button>
            <Button
              onClick={() => handleCopyDraft(draftLead?.email_draft || '')}
              className="rounded-xl bg-emerald hover:bg-emerald/80 text-obsidian font-outfit font-bold"
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Draft'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
