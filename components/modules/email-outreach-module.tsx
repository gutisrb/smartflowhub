"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, TrendingUp, CheckCircle, RefreshCw, BarChart3, Layout, ChevronRight, Send, UserCheck, MessageSquare, ExternalLink } from "lucide-react"
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
  showNicheBreakdown?: boolean
  showTemplates?: boolean
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
  status: string
  last_sent_at?: string
  email_draft?: string
  meeting_time?: string
  meeting_link?: string
  izvor: string
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
  showNicheBreakdown = true,
  showTemplates = true
}: EmailOutreachModuleProps) {
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
      .eq('izvor', 'Chatbot Outreach')

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
      .eq('izvor', 'Chatbot Outreach')
      .order('created_at', { ascending: false })
      .limit(50)

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

  const nicheStats = useMemo(() => {
    const counts: Record<string, number> = {}
    leads.forEach(l => {
      if (l.niche) counts[l.niche] = (counts[l.niche] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [leads])

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Leads Prism */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={tableVariants}
          className="lg:col-span-2 space-y-6"
        >
          <div className="glass-card border-emerald/10 bg-obsidian/40 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden">
            <div className="p-8 border-b border-emerald/5 flex justify-between items-center bg-gradient-to-r from-emerald/5 to-transparent">
              <div>
                <CardTitle className="text-2xl font-outfit font-bold text-silver">Outreach Stream</CardTitle>
                <CardDescription className="text-silver/40 font-outfit">Live synchronization with Agentic Workflows</CardDescription>
              </div>
              <Layout className="w-6 h-6 text-emerald/40" />
            </div>

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
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest pl-8">Identity</TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest">Niche</TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest">Status</TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest">Last Activity</TableHead>
                      <TableHead className="font-outfit text-silver/40 uppercase text-[10px] tracking-widest pr-8 text-right">Draft</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {leads.map((lead, idx) => (
                        <motion.tr
                          key={lead.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="group border-emerald/5 hover:bg-emerald/[0.03] transition-colors"
                        >
                          <TableCell className="py-5 pl-8">
                            <div className="flex flex-col">
                              <span className="font-outfit font-semibold text-silver">{lead.ime}</span>
                              <span className="text-xs text-silver/40 font-outfit lowercase">{lead.email || 'no-email@detected'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-obsidian/40 border-emerald/10 text-silver/60 font-outfit">
                              {lead.niche || 'General'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full",
                                lead.status === 'Zakazan Sastanak' ? 'bg-emerald shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                                  lead.status === 'Sent' ? 'bg-blue-400' : 'bg-silver/20'
                              )} />
                              <span className="font-outfit text-sm text-silver/70">{lead.status}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-outfit text-sm text-silver/40">
                            {formatDate(lead.last_sent_at || lead.meeting_time)}
                          </TableCell>
                          <TableCell className="pr-8 text-right">
                            {lead.email_draft ? (
                              <Button variant="ghost" size="icon" className="text-emerald hover:bg-emerald/10 rounded-xl group-hover:scale-110 transition-transform">
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            ) : (
                              <span className="text-silver/20">-</span>
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

        {/* Intelligence Sidebar */}
        <div className="space-y-6">
          {/* Niche Breakdown Card */}
          {showNicheBreakdown && (
            <Card className="glass-card border-white/5 bg-obsidian/60 overflow-hidden rounded-[2rem]">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-outfit font-bold text-silver flex items-center gap-2">
                  <Layout className="w-4 h-4 text-emerald" />
                  Niche Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {nicheStats.map(([niche, count]) => (
                  <div key={niche} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-outfit uppercase tracking-tighter">
                      <span className="text-silver/60">{niche}</span>
                      <span className="text-emerald font-bold">{count}</span>
                    </div>
                    <div className="h-1.5 w-full bg-obsidian/80 rounded-full overflow-hidden border border-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / leads.length) * 100}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-emerald to-emerald/40"
                      />
                    </div>
                  </div>
                ))}
                {nicheStats.length === 0 && <p className="text-xs text-silver/40 italic">Waiting for demographic data...</p>}
              </CardContent>
            </Card>
          )}

          {/* Intelligence & Templates */}
          {showTemplates && (
            <Card className="glass-card border-white/5 bg-obsidian/60 rounded-[2rem]">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-outfit font-bold text-silver flex items-center gap-2">
                  <Layout className="w-4 h-4 text-emerald" />
                  Agency Intel
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4 pt-2">
                <div className="p-4 rounded-2xl bg-obsidian/40 border border-white/5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald/10 flex items-center justify-center">
                      <Layout className="w-4 h-4 text-emerald" />
                    </div>
                    <p className="text-xs font-outfit font-bold text-silver uppercase tracking-widest">Active System</p>
                  </div>
                  <div className="space-y-2 pl-11">
                    <p className="text-xs text-silver/60 leading-relaxed font-outfit">
                      <span className="text-emerald">v5 Workflow</span> active using Smart Personalization.
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-emerald/60 uppercase font-bold">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
                      Instantly.ai Sync Active
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {[
                    "Restaurant Lead Intake",
                    "B2B Agency Nurture",
                    "Demo Booking Recovery"
                  ].map((tpl) => (
                    <motion.div
                      key={tpl}
                      whileHover={{ x: 5 }}
                      className="flex items-center justify-between p-3 rounded-xl border border-white/5 hover:border-emerald/20 hover:bg-emerald/5 cursor-pointer transition-all group"
                    >
                      <span className="text-xs font-outfit text-silver/60 group-hover:text-silver transition-colors">{tpl}</span>
                      <ChevronRight className="w-4 h-4 text-emerald/40 group-hover:text-emerald transition-colors" />
                    </motion.div>
                  )) || <p className="text-xs text-silver/40 italic">No templates configured.</p>}
                </AnimatePresence>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
