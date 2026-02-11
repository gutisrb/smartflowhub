"use client"

import { useState, useEffect, useCallback } from "react"
import { StatsGrid } from "@/components/dashboard/stats-grid"
import { LeadsTable } from "@/components/dashboard/leads-table"
import { ChatLogViewer } from "@/components/dashboard/chat-log-viewer"
import { getLeadsByClientId } from "@/lib/supabase/queries"
import { createClient } from "@/lib/supabase/client"

interface BusinessCRMModuleProps {
  clientId: string
}

export function BusinessCRMModule({ clientId }: BusinessCRMModuleProps) {
  const [leads, setLeads] = useState<any[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [stats, setStats] = useState({
    totalLeads: 0,
    bookingRate: 0,
    showUpRate: 0,
    conversionRate: 0,
  })

  const supabase = createClient()

  const calculateStats = useCallback((data: any[]) => {
    const total = data.length
    if (total === 0) {
      setStats({ totalLeads: 0, bookingRate: 0, showUpRate: 0, conversionRate: 0 })
      return
    }

    // 1. Booking Rate: Leads who booked a call
    const booked = data.filter(l =>
      ['Meeting Booked', 'Meeting Complete', 'Closed'].includes(l.status) || l.booking_timestamp
    ).length
    const bookingRate = Math.round((booked / total) * 100)

    // 2. Show-Up Rate: Of those booked, how many were complete
    const attended = data.filter(l =>
      ['Meeting Complete', 'Closed'].includes(l.status) || l.meeting_completed_at
    ).length
    const showUpRate = booked > 0 ? Math.round((attended / booked) * 100) : 0

    // 3. Conversion Rate: Of those attended, how many closed
    const closedCount = data.filter(l => l.status === 'Closed').length
    const conversionRate = attended > 0 ? Math.round((closedCount / attended) * 100) : 0

    setStats({
      totalLeads: total,
      bookingRate,
      showUpRate,
      conversionRate,
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

  const handleOpenChat = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (lead?.id_razgovora) {
      setSelectedChatId(lead.id_razgovora)
      setIsChatOpen(true)
    }
  }

  return (
    <div className="space-y-8">
      <StatsGrid stats={stats} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Business CRM (Job Owners)</h3>
        </div>
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden uppercase text-[10px] tracking-wider font-semibold">
          <LeadsTable leads={leads} onOpenChat={handleOpenChat} />
        </div>
      </div>

      <ChatLogViewer
        idRazgovora={selectedChatId}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  )
}
