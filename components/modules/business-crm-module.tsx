"use client"

import { useState, useEffect, useCallback } from "react"
import { StatsGrid } from "@/components/dashboard/stats-grid"
import { LeadIntelligenceViewer } from "@/components/dashboard/lead-intelligence-viewer"
import { getLeadsByClientId } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Sparkles, MoreHorizontal, Calendar, Mail, AlertCircle, CheckCircle2, Flame, Users, BarChart2, Globe } from "lucide-react"
import { format } from "date-fns"
import { toast } from "sonner"

interface BusinessCRMModuleProps {
  clientId: string
}

export function BusinessCRMModule({ clientId }: BusinessCRMModuleProps) {
  const [leads, setLeads] = useState<any[]>([])
  const [selectedLead, setSelectedLead] = useState<any | null>(null)
  const [isIntelligenceOpen, setIsIntelligenceOpen] = useState(false)
  const [stats, setStats] = useState({
    totalLeads: 0,
    hotLeads: 0,
    demosBooked: 0,
    avgScore: 0,
  })

  const supabase = createClient()

  const calculateStats = useCallback((data: any[]) => {
    const total = data.length
    if (total === 0) {
      setStats({ totalLeads: 0, hotLeads: 0, demosBooked: 0, avgScore: 0 })
      return
    }

    const hot = data.filter(l => l.kategorija === 'Vreo' || l.prioritet_skor >= 70).length
    const booked = data.filter(l =>
      ['Meeting Booked', 'Meeting Complete', 'Closed', 'Demo Scheduled - Video', 'Demo Scheduled - Meeting'].includes(l.status)
    ).length

    const totalScore = data.reduce((acc, curr) => acc + (curr.prioritet_skor || 0), 0)
    const avgScore = Math.round(totalScore / total)

    setStats({
      totalLeads: total,
      hotLeads: hot,
      demosBooked: booked,
      avgScore,
    })
  }, [])

  const fetchLeads = useCallback(async () => {
    const data = await getLeadsByClientId(clientId)
    setLeads(data || [])
    calculateStats(data || [])
  }, [clientId, calculateStats])

  useEffect(() => {
    if (clientId) {
      fetchLeads()

      const channel = supabase
        .channel(`leads-realtime-${clientId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "kontakti", filter: `client_id=eq.${clientId}` },
          () => fetchLeads()
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [clientId, fetchLeads, supabase])

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('kontakti')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error
      toast.success("Status updated")
      fetchLeads() // Optimistic update would be better in prod
    } catch (e) {
      toast.error("Failed to update status")
      console.error(e)
    }
  }

  const handleOpenIntelligence = (lead: any) => {
    setSelectedLead(lead)
    setIsIntelligenceOpen(true)
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-500"
    if (score >= 50) return "bg-yellow-500"
    return "bg-gray-300"
  }

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'Vreo': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-red-200">🔥 Vreo</Badge>
      case 'Topao': return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200">🔸 Topao</Badge>
      case 'Hladan': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">❄️ Hladan</Badge>
      default: return <Badge variant="outline">{category || 'N/A'}</Badge>
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Custom Stats Grid for Business CRM */}
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="hover:shadow-md transition-shadow duration-200 border-indigo-100 bg-white/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Total Leads
            </CardTitle>
            <Users className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.totalLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active in pipeline
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200 border-rose-100 bg-white/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Hot Leads
            </CardTitle>
            <Flame className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.hotLeads}</div>
            <p className="text-xs text-muted-foreground mt-1">
              High priority
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200 border-emerald-100 bg-white/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Demos Booked
            </CardTitle>
            <Calendar className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.demosBooked}</div>
            <p className="text-xs text-muted-foreground mt-1">
              This month
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow duration-200 border-blue-100 bg-white/50 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Avg Quality
            </CardTitle>
            <BarChart2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">{stats.avgScore}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Lead quality score
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Active Pipeline</h3>
            <p className="text-sm text-gray-500">Manage and track your qualified business leads.</p>
          </div>
        </div>

        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead className="w-[180px]">Lead Source</TableHead>
                <TableHead className="w-[120px]">Value</TableHead>
                <TableHead className="w-[140px]">Qualification</TableHead>
                <TableHead className="w-[120px]">Priority</TableHead>
                <TableHead className="w-[180px]">Status</TableHead>
                <TableHead className="w-[80px] text-right">Intel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No leads found. Waiting for new submissions...
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id} className="group hover:bg-gray-50/50 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-900 leading-none mb-1">{lead.ime}</span>
                        <span className="text-xs text-gray-500 font-medium truncate max-w-[200px]">
                          {lead.kompanija ? `${lead.kompanija} • ` : ''}{lead.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-zinc-100 flex items-center justify-center">
                          <Globe className="w-3 h-3 text-zinc-500" />
                        </div>
                        <span className="text-sm text-zinc-600 font-medium">{lead.izvor || 'Website'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-bold text-zinc-900">
                        {lead.procenjena_vrednost ? `€${lead.procenjena_vrednost}` : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getCategoryBadge(lead.kategorija)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={lead.prioritet_skor}
                          className="h-1.5 w-[40px] bg-zinc-100"
                          indicatorClassName={getScoreColor(lead.prioritet_skor)}
                        />
                        <span className="text-xs font-bold text-zinc-500">{lead.prioritet_skor || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-8 w-full justify-between items-center font-semibold text-[11px] uppercase tracking-wider px-3 border-zinc-200 transition-all hover:border-zinc-300 shadow-sm",
                              lead.status === 'Closed' && "bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100",
                              lead.status?.includes('Demo') && "bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100",
                              lead.status === 'Lost' && "bg-rose-50 text-rose-700 border-rose-100 hover:bg-rose-100"
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div className={cn(
                                "w-1.5 h-1.5 rounded-full animate-pulse",
                                lead.status === 'Closed' ? "bg-emerald-500" :
                                  lead.status?.includes('Demo') ? "bg-indigo-500" :
                                    lead.status === 'Lost' ? "bg-rose-500" : "bg-zinc-400"
                              )} />
                              {lead.status || 'Novi Lead'}
                            </div>
                            <MoreHorizontal className="w-3 h-3 opacity-50" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px] p-2">
                          <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Update Pipeline</div>
                          <DropdownMenuItem className="rounded-md" onClick={() => handleStatusUpdate(lead.id, 'Novi Lead')}>🏠 Novi Lead</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-md" onClick={() => handleStatusUpdate(lead.id, 'Kontaktiran')}>📧 Kontaktiran</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-md" onClick={() => handleStatusUpdate(lead.id, 'Demo Scheduled - Video')}>📹 Demo (Video)</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-md" onClick={() => handleStatusUpdate(lead.id, 'Meeting Complete')}>✅ Meeting Complete</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-md font-bold text-emerald-600" onClick={() => handleStatusUpdate(lead.id, 'Closed')}>💎 Closed (Won)</DropdownMenuItem>
                          <DropdownMenuItem className="rounded-md text-rose-600" onClick={() => handleStatusUpdate(lead.id, 'Lost')}>❌ Lost</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-full transition-all"
                        onClick={() => handleOpenIntelligence(lead)}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <LeadIntelligenceViewer
        lead={selectedLead}
        isOpen={isIntelligenceOpen}
        onClose={() => setIsIntelligenceOpen(false)}
      />
    </div>
  )
}
