"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { StatsGrid } from "@/components/dashboard/stats-grid"
import { LeadsTable } from "@/components/dashboard/leads-table"
import { ChatLogViewer } from "@/components/dashboard/chat-log-viewer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function DashboardPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalLeads: 0,
    bookedCalls: 0,
    closedDeals: 0,
    avgCpl: 12.5,
  })
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchLeads()
    subscribeToLeads()
  }, [])

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from("kontakti")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching leads:", error)
    } else {
      setLeads(data || [])
      calculateStats(data || [])
    }
  }

  const subscribeToLeads = () => {
    const channel = supabase
      .channel("kontakti-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kontakti" },
        (payload) => {
          fetchLeads()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const calculateStats = (data: any[]) => {
    const total = data.length
    const booked = data.filter((l) => l.status === "Zakazan Sastanak").length
    const closed = data.filter((l) => l.status === "Prodat").length

    setStats({
      ...stats,
      totalLeads: total,
      bookedCalls: booked,
      closedDeals: closed,
    })
  }

  const handleOpenChat = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (lead?.id_razgovora) {
      setSelectedChatId(lead.id_razgovora)
      setIsChatOpen(true)
    } else {
      alert("Ovaj lead nema ID razgovora.")
    }
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">AI Growth Agency Dashboard</h2>
      </div>
      <StatsGrid stats={stats} />

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Svi Leadovi</TabsTrigger>
          <TabsTrigger value="deals">Pipeline</TabsTrigger>
          <TabsTrigger value="analytics">Analitika</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-4">
          <LeadsTable leads={leads} onOpenChat={handleOpenChat} />
        </TabsContent>
        <TabsContent value="deals" className="space-y-4">
          <LeadsTable
            leads={leads.filter(l => ["Zakazan Sastanak", "Prodat"].includes(l.status))}
            onOpenChat={handleOpenChat}
          />
        </TabsContent>
      </Tabs>

      <ChatLogViewer
        idRazgovora={selectedChatId}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  )
}
