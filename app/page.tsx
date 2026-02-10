
"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { StatsGrid } from "@/components/dashboard/stats-grid"
import { LeadsTable } from "@/components/dashboard/leads-table"
import { ChatLogViewer } from "@/components/dashboard/chat-log-viewer"
import { LoginForm } from "@/components/auth/login-form"
import { JobsCRM } from "@/components/dashboard/jobs-crm"
import { CandidatesCRM } from "@/components/dashboard/candidates-crm"
import { Sidebar, ViewType } from "@/components/dashboard/sidebar"
import { getLeadsByClientId } from "@/lib/supabase/queries"
import { Button } from "@/components/ui/button"
import { LogOut, Menu } from "lucide-react"

export default function DashboardPage() {
  const [currentView, setCurrentView] = useState<ViewType>("jobs")
  const [leads, setLeads] = useState<any[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [clientName, setClientName] = useState("")
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [stats, setStats] = useState({
    totalLeads: 0,
    bookingRate: 0,
    showUpRate: 0,
    conversionRate: 0,
  })

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [isChatOpen, setIsChatOpen] = useState(false)

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

  const fetchLeads = useCallback(async (clientId: string) => {
    const data = await getLeadsByClientId(clientId)
    setLeads(data || [])
    calculateStats(data || [])
  }, [calculateStats])

  const checkSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      setIsAuthenticated(true)
      setUserEmail(session.user.email || null)
      if (session.user.email) {
        const { data } = await supabase
          .from('clients')
          .select('id, name')
          .eq('email', session.user.email)
          .single()

        if (data) {
          setSelectedClientId(data.id)
          setClientName(data.name)
        }
      }
    }
  }, [supabase])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  useEffect(() => {
    if (selectedClientId) {
      fetchLeads(selectedClientId)

      const channel = supabase
        .channel(`leads-realtime-${selectedClientId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "kontakti", filter: `client_id=eq.${selectedClientId}` },
          () => fetchLeads(selectedClientId)
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
  }, [selectedClientId, fetchLeads, supabase])

  const handleOpenChat = (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (lead?.id_razgovora) {
      setSelectedChatId(lead.id_razgovora)
      setIsChatOpen(true)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setIsAuthenticated(false)
    setSelectedClientId(null)
    setUserEmail(null)
    setLeads([])
  }

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={checkSession} />
  }

  const viewLabels: Record<ViewType, string> = {
    "jobs": "Poslovi",
    "candidates": "Kandidati",
    "business-leads": "Business CRM",
    "analytics": "Analitika"
  }

  return (
    <div className="flex h-screen bg-gray-50/50">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        clientName={clientName}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b bg-white flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-gray-900 uppercase tracking-wider">
              {viewLabels[currentView]}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{userEmail}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-red-600">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-8">
            {selectedClientId ? (
              <>
                {currentView === "business-leads" && <StatsGrid stats={stats} />}

                <div className="space-y-6">
                  {currentView === "jobs" && <JobsCRM clientId={selectedClientId} />}
                  {currentView === "candidates" && <CandidatesCRM clientId={selectedClientId} />}
                  {currentView === "business-leads" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold">Business CRM (Job Owners)</h3>
                      </div>
                      <div className="rounded-xl border bg-white shadow-sm overflow-hidden uppercase text-[10px] tracking-wider font-semibold">
                        <LeadsTable leads={leads} onOpenChat={handleOpenChat} />
                      </div>
                    </div>
                  )}
                  {currentView === "analytics" && (
                    <div className="h-[400px] flex items-center justify-center rounded-xl border-2 border-dashed bg-white">
                      <p className="text-muted-foreground">Analitika uskoro.</p>
                    </div>
                  )}
                </div>

                <ChatLogViewer
                  idRazgovora={selectedChatId}
                  isOpen={isChatOpen}
                  onClose={() => setIsChatOpen(false)}
                />
              </>
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-muted-foreground italic">Povezivanje sa klijentom...</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
